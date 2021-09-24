//const { ethers, hre } = require("hardhat");
const {network, ethers} = require("hardhat");
const { expect } = require("chai");

// Shared Migration Config
const config = {
  symbol: "TEST",
  name: "Test Bond",
  terms: "test.ch/terms",
  totalBonds: 40000000,
  bondPrice: "500000000000000000",
  timeToMarturity: "432000000000", //5000days around 14y
  mintDecrement: 10,
  baseCurrencyAddress: "0xB4272071eCAdd69d933AdcD19cA99fe80664fc08",
  baseCurrencyMinterAddress: "0x1e24bf6f6cbafe8ffb7a1285d336a11ba12e0eb9",
  infiniteAllowance: "0x8000000000000000000000000000000000000000000000000000000000000000",
  brokerbotOwnerAddress: "",
  brokerbotCopyrightOwnerAddress: "0x29Fe8914e76da5cE2d90De98a64d0055f199d06D",
  quorumBps: 7500,
  votePeriodSeconds: 5184000,
  uniswapRouterAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
}

describe("Bond Contract", () => {
  let BondBotFactory;
  let BondFactory;
  let PaymentHubFactory;
  let ForceSendFactory;

  let bond;
  let bondBot;
  let baseCurrency;
  let paymentHub;
  let forceSend;

  let owner;
  let adr1;
  let adr2;
  let adr3;
  let adr4;
  let accounts;

  before(async () =>{
    BondBotFactory = await ethers.getContractFactory("BondBot");
    BondFactory = await ethers.getContractFactory("Bond");
    PaymentHubFactory = await ethers.getContractFactory("PaymentHub");
    ForceSendFactory = await ethers.getContractFactory("ForceSend");
    
  });
  
  beforeEach(async () => {
    [owner,adr1,adr2,adr3,adr4] = await ethers.getSigners();
    accounts = [owner.address,adr1.address,adr2.address,adr3.address,adr4.address];
    //console.log(accounts);

    baseCurrency = await ethers.getContractAt("ERC20Basic",config.baseCurrencyAddress);
    bond = await BondFactory.deploy(config.symbol, config.name, config.terms, config.totalBonds, config.timeToMarturity, config.mintDecrement, owner.address);
    bondBot = await BondBotFactory.deploy(bond.address, config.bondPrice, config.baseCurrencyAddress, owner.address);
    paymentHub = await PaymentHubFactory.deploy(config.baseCurrencyAddress);
    forceSend = await ForceSendFactory.deploy();

    await bond.deployed();
    await bondBot.deployed();
    await paymentHub.deployed();
    await forceSend.deployed();

    // Mint baseCurrency Tokens (xchf) to first 5 accounts
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [config.baseCurrencyMinterAddress],
    });
    const signer = await ethers.provider.getSigner(config.baseCurrencyMinterAddress);
    await forceSend.send(config.baseCurrencyMinterAddress, {value: ethers.BigNumber.from("1000000000000000000")});
    for (let i = 0; i < 5; i++) {
      await baseCurrency.connect(signer).mint(accounts[i], ethers.utils.parseEther("10000000"));
     //console.log("account %s chf %s", accounts[i], await baseCurrency.balanceOf(accounts[i]));
    }
    await network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [config.baseCurrencyMinterAddress],
    });

    //Mint bonds to first 5 accounts
    await bond.setMinter(owner.address);
    for( let i = 0; i < 5; i++) {
      await bond.mint(accounts[i], 1000000);
    }

    //Deposit Bonds and BaseCurrency into BondBot
    //await bond.transfer(bondBot.address, 50000000);
    await baseCurrency.transfer(bondBot.address, ethers.utils.parseEther("100000"));


    // Allow payment hub to spend baseCurrency from accounts[0] and bond from Brokerbot
    await bond.approve(paymentHub.address, config.infiniteAllowance, { from: owner.address });
    await baseCurrency.approve(paymentHub.address, config.infiniteAllowance, { from: owner.address });
    await bondBot.approve(bond.address, paymentHub.address, config.infiniteAllowance);
    await bondBot.approve(baseCurrency.address, paymentHub.address, config.infiniteAllowance);

     // Set Payment Hub for bondBot
     await bondBot.setPaymentHub(paymentHub.address);

     // Set Bond Bot as Minter
     await bond.setMinter(bondBot.address);


  });

  describe("Deployment", () => {
    it("should deploy", async () => {
      assert(bond.address !== "");
    });
  
    it("should get constructor params correctly", async () => {
      assert.equal(await bond.symbol(), config.symbol);
      assert.equal(await bond.name(), config.name);
      assert.equal(await bond.terms(), config.terms);
      assert.equal(await bond.maxSupply(), config.totalBonds);
    });
    it("Should set the right owner", async () =>{
      expect(await bond.owner()).to.equal(owner.address);
    });

    it("Should calculate correct max mintable supply", async () => {
      expect(await bond.maxMintable()).to.equal(config.totalBonds);
    });
  });

  describe("Setup", () => {
    it("should have some ETH in first 5 accounts", async () => {  
      for (let i = 0; i < 5; i++) {
        const balance = ethers.BigNumber.from(await ethers.provider.getBalance(accounts[i]));
        assert(!balance.isZero(), "Balance is 0");
      }
    });
  
    it("should have some BaseCurrency in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await baseCurrency.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have some Bonds in first 5 accounts", async () => {
      for (let i = 0; i < 5; i++) {
        const balance = await bond.balanceOf(accounts[i]);
        assert(!balance.isZero(), "Balance is 0");
      }
    });

    it("should have BaseCurrency deposited into the Brokerbot", async () => {
      const baseBalance = await baseCurrency.balanceOf(bondBot.address);
      assert(!baseBalance.isZero());
    });
  });

  describe("Transctions", () => {
    it("should mint token when buying bonds", async () => {
      //console.log(await paymentHub.getPriceInEther(ethers.utils.parseEther("1000")));
      await bond.connect(adr1).approve(paymentHub.address, config.infiniteAllowance);
      await baseCurrency.connect(adr1).approve(paymentHub.address, config.infiniteAllowance);

      await paymentHub["payAndNotify(address, uint256, bytes calldata)"](bondBot.address, ethers.utils.parseEther("1000"), '0x');
      //await paymentHub.connect(adr1).multiPayAndNotify(baseCurrency.address, [bondBot.address], [ethers.utils.parseEther("1")], '0x');
      //await paymentHub.connect(adr1).multiPay([adr1.address], [ethers.utils.parseEther("1")]);
      console.log(bond.balanceOf(adr1.address));
    })
  });
});

