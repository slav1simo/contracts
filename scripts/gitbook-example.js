require("dotenv").config();
const { getImpersonatedSigner } = require("../test/helper/index");
const { ethers } = require("hardhat");
// Shared  Config
const config = require("./deploy_config.js");


const xchfWhale = "0x7B4576d06D0Ce1F83F9a9B76BF8077bFFD34FcB1";
const daksWhale = "0xfa20215178a0E69b8DD02462238027cAC19fb7d2"
const daksMulti = "0x4fd9dba1d53b7e6cc933a2fdd12b1c012a0654f6";
const daksBrokerbot = "0x3a2148cea2a8a4dae51487fa28451038c24d2576";
const daksAdr = "0x6f38e0f1a73c96cB3f42598613EA3474F09cB200";
const usdcWhale = "0xDa9CE944a37d218c3302F6B82a094844C6ECEb17";


async function main() {
  const deployment = await hre.run("deploy", {
    tags: "ExampleTrades",
  });
  await hre.run("deploy", {
    tags: "PaymentHub"
  })
  // get common contracts
  const baseCurrency = await ethers.getContractAt("ERC20Named",config.baseCurrencyAddress);
  const usdcContract = await ethers.getContractAt("ERC20Named", config.usdcAddress);
  const daksContract = await ethers.getContractAt("DraggableShares", daksAdr);
  const exampleTrades = await ethers.getContract("ExampleTrades");
  // update to new paymenthub
  const paymentHub = await ethers.getContract("PaymentHub");
  const brokerbot = await ethers.getContractAt("Brokerbot", daksBrokerbot);
  const multisig = await getImpersonatedSigner(daksMulti);
  await brokerbot.connect(multisig).setPaymentHub(paymentHub.address);
  // get a signer with enough xchf
  const signer = await getImpersonatedSigner(xchfWhale);
  const startBlanceXCHF = await baseCurrency.balanceOf(xchfWhale);
  // approve xchf to example trades contract that it can pull in the funds to trade
  console.log(`Approving XCHF...`);
  await baseCurrency.connect(signer).approve(exampleTrades.address, ethers.constants.MaxUint256);
  // trigger the buying shares with xchf
  console.log(`Buying shares...`);
  await exampleTrades.connect(signer).buySharesDirect(10, ethers.utils.parseEther("200"));
  const balanceShares = await daksContract.balanceOf(xchfWhale);
  console.log(`Shares bought: ${balanceShares}`);
  console.log("======================");
  // approve the example contract to pull the daks shares
  console.log("Approving DAKS..");
  await daksContract.connect(signer).approve(exampleTrades.address, 10);
  // sell shares for xchf
  console.log("Selling Shares..");  
  await exampleTrades.connect(signer).sellSharesDirect(10);
  const endBlanceXCHF = await baseCurrency.balanceOf(xchfWhale);
  // after buying and selling the signer should have again the same amount of xchf 
  console.log(`xchf balance difference: ${startBlanceXCHF - endBlanceXCHF}`); // should be 0

  // buying shares via usdc
  // get signer with enough usdc
  const usdcSigner = await getImpersonatedSigner(usdcWhale);
  const startBalanceUsdc = await usdcContract.balanceOf(usdcWhale);
  console.log("Approving USDC to example contract...");
  await usdcContract.connect(usdcSigner).approve(exampleTrades.address, ethers.constants.MaxUint256);
  console.log("Approve Paymenthub for USDC...");
  await paymentHub.connect(usdcSigner).approveERC20(config.usdcAddress);
  console.log("Buying shares with USDC...");
  await exampleTrades.connect(usdcSigner).buySharesMultihop(10, ethers.utils.parseUnits("20000", await usdcContract.decimals()));
  const buyBalanceUsdc = await usdcContract.balanceOf(usdcWhale);
  const balanceDaks = await daksContract.balanceOf(usdcWhale);
  console.log(`Shares bought: ${balanceDaks} for ${ethers.utils.formatUnits(startBalanceUsdc - buyBalanceUsdc, await usdcContract.decimals())}`);
  console.log("======================");
  console.log("Approving DAKS to example contract...");
  await daksContract.connect(usdcSigner).approve(exampleTrades.address, 10);
  console.log("Approve Paymenthub for XCHF...");
  await paymentHub.connect(usdcSigner).approveERC20(config.baseCurrencyAddress);
  console.log("Selling DAKS for USDC...")
  await exampleTrades.connect(usdcSigner).sellSharesMultihop(10);
  const endBalanceUSDC = await usdcContract.balanceOf(usdcWhale);
  console.log(`Solde 10 shares for $${ethers.utils.formatUnits(endBalanceUSDC-buyBalanceUsdc, await usdcContract.decimals())}`);
  console.log(`usdc balance difference because of uniswap slippage: ${ethers.utils.formatUnits(startBalanceUsdc - endBalanceUSDC, await usdcContract.decimals())}`);  
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });