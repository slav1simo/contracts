/* global artifacts, contract */
/* eslint-disable no-undef */

// Shared Config
const config = require("../scripts/deploy_config.js");

// Libraries
const Chance = require("chance");
const { ethers } = require("hardhat");
const { buyingEnabled, sellingEnabled } = require("./helper/index");
const { expect } = require("chai");
const exp = require("constants");

// Import contracts to be tested
const Shares = artifacts.require("Shares");
const DraggableShares = artifacts.require("DraggableShares");
const PaymentHub = artifacts.require("PaymentHub");
const Brokerbot = artifacts.require("Brokerbot");

// Contract hardcoded variables
const BUYING_ENABLED = 0x1;
const SELLING_ENABLED = 0x2;

describe("Brokerbot", () => {
  let accounts;
  let brokerbot;
  let paymentHub;
  let draggableShares;
  let deployer;
  let owner;

  before(async () => {
    [deployer,owner,] = await ethers.getSigners();
    accounts = [owner.address];
    paymentHub = await ethers.getContract("PaymentHub");
    draggableShares = await ethers.getContract("DraggableShares");
    brokerbot = await ethers.getContract("Brokerbot");
  });

  describe("init", () => {
    it("should deploy", async () => {
      expect(brokerbot.address).to.exist;
    });
    
    it("should get constructor params correctly", async () => {
      const baseCurrency = await brokerbot.base();
      const brokerbotOwner = await brokerbot.owner();
      const price = await brokerbot.getPrice();
      const increment = await brokerbot.increment();
      
      expect(baseCurrency).to.equal(config.baseCurrencyAddress);
      expect(brokerbotOwner).to.equal(owner.address);
      expect(await price.toString()).to.equal(config.sharePrice);
      expect(increment.isZero()).to.eq(true);
    });
  });

  describe("calculate price", () => {
    beforeEach(async () => {
      await brokerbot.connect(owner).setPrice(config.sharePrice, 0);
    });
    
    it("should calculate buy price correctly - no increment - no drift", async () => {
      // Used Contract: Brokerbot      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getBuyPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getBuyPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 100 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        const priceRandomNumberShares = await brokerbot.getBuyPrice(randomNumberShares);
        expect(priceOneShare.mul(randomNumberShares)).to.eq(priceRandomNumberShares);
      }
    });
    
    it("should calculate sell price correctly - no increment - no drift", async () => {
      // Used Contract: Brokerbot
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getSellPrice(0);
      expect(priceZeroShares.isZero()).to.equal(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getSellPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 100 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        const priceRandomNumberShares = await brokerbot.getSellPrice(randomNumberShares);
        expect(priceOneShare.mul(randomNumberShares)).to.eq(priceRandomNumberShares);
      }
    });
    
    it("should set increment correctly (0.001 per share)", async () => {
      // Used Contract: Brokerbot
      // Get existing and reset while incrementing by delta
      const price = await brokerbot.getPrice();
      const incrementBefore = await brokerbot.increment();
      const delta = ethers.BigNumber.from("1000000000000000");
      await brokerbot.connect(owner).setPrice(price, incrementBefore.add(delta));
      const incrementAfter = await brokerbot.increment();
      
      // Check result
      expect(incrementBefore.add(delta)).to.eq(incrementAfter);
    });
    
    it("should calculate buy price correctly - with increment - no drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random increment
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 1000 }).toString(),"finney");
      
      /*const increment = web3.utils.toWei(new Chance().integer({ min: 1, max: 1000 }),
        "milli"
        );*/
      await brokerbot.connect(owner).setPrice(config.sharePrice, increment);
      
      // 0 cost for 0 shares
      const priceZeroShares = await brokerbot.getBuyPrice(0);
      expect(priceZeroShares.isZero()).to.eq(true);
      
      // getPrice cost for 1 share
      const priceOneShare = await brokerbot.getBuyPrice(1);
      const quotePrice = await brokerbot.getPrice();
      expect(priceOneShare).to.eq(quotePrice);
      
      // Do 10 times with random number of shares
      for (let i = 0; i < 10; i++) {
        const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
        // Get price from contract
        const priceRandomNumberShares = await brokerbot.getBuyPrice(
          randomNumberShares
        );
          
        // Calculate the most straightforward way
        let calculatedPrice = ethers.BigNumber.from(0);
        let priceForShare = priceOneShare;
        for (let share = 0; share < randomNumberShares; share++) {
          calculatedPrice = calculatedPrice.add(priceForShare);
          priceForShare = priceForShare.add(increment);
        }
        
        // Check result
        expect(priceRandomNumberShares).to.eq(calculatedPrice);
      }
    });
          
    it("should calculate sell price correctly - with increment - no drift", async () => {
      // Used Contract: Brokerbot
      // Initialize with random increment
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 10000 }).toString(),
        "gwei"
        );
        await brokerbot.connect(owner).setPrice(config.sharePrice, increment);
        
        // 0 cost for 0 shares
        const priceZeroShares = await brokerbot.getSellPrice(0);
        expect(priceZeroShares.isZero()).to.eq(true);
        
        // getPrice cost for 1 share
        const priceOneShare = await brokerbot.getSellPrice(1);
        const quotePrice = await brokerbot.getPrice();
        expect(priceOneShare).to.eq(quotePrice.sub(increment));
        
        // Do 10 times with random number of shares
        for (let i = 0; i < 10; i++) {
          const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
            // Get price from contract
            const priceRandomNumberShares = await brokerbot.getSellPrice(
              randomNumberShares
              );
              
              // Calculate the most straightforward way
              let calculatedPrice = ethers.BigNumber.from(0);
              let priceForShare = priceOneShare;
              for (let share = 0; share < randomNumberShares; share++) {
                calculatedPrice = calculatedPrice.add(priceForShare);
                priceForShare = priceForShare.sub(increment);
              }
              
              // Check result
              expect(priceRandomNumberShares).to.eq(calculatedPrice);
            }
    });
  });
        
  describe("setting", () => {
    it("should allow enabling/disabling buying/selling.", async () => {
      // Used Contract: Brokerbot
      //await brokerbot.connect(owner).setSettings(BUYING_ENABLED);
      await brokerbot.connect(owner).setEnabled(true, false);      
      expect(await buyingEnabled(brokerbot)).to.eq(true);
      expect(await sellingEnabled(brokerbot)).to.equal(false);
      
      await brokerbot.connect(owner).setEnabled(false, true);
      //await brokerbot.setSettings(SELLING_ENABLED);
      expect(await buyingEnabled(brokerbot)).to.equal(false);
      expect(await sellingEnabled(brokerbot)).to.equal(true);
      
      await brokerbot.connect(owner).setEnabled(true, true);
      //await brokerbot.setSettings(BUYING_ENABLED | SELLING_ENABLED);
      expect(await buyingEnabled(brokerbot)).to.equal(true);
      expect(await sellingEnabled(brokerbot)).to.equal(true);
      
      await brokerbot.connect(owner).setEnabled(false, false);
      //await brokerbot.setSettings("0x0");
      expect(await buyingEnabled(brokerbot)).to.equal(false);
      expect(await sellingEnabled(brokerbot)).to.equal(false);
    });
    
    it("should not allow buying shares when buying is disabled", async () => {
      // Used Contract: Brokerbot, Payment Hub
      // Disable buying
      await brokerbot.connect(owner).setEnabled(false, true);
      
      // Random number of shares to buy
      const sharesToBuy = new Chance().natural({ min: 1, max: 500 });
      const buyPrice = await brokerbot.getBuyPrice(sharesToBuy);
      const buyPriceInETH = await paymentHub.callStatic["getPriceInEther(uint256,address)"](buyPrice, brokerbot.address);
      
      // Base payment should fail
      await expect(paymentHub.connect(owner)["payAndNotify(address,uint256,bytes)"](
        brokerbot.address, buyPrice, "0x20"))
        .to.be.revertedWith("buying disabled");
        
      // ETH payment should fail
      await expect(paymentHub.connect(owner).payFromEtherAndNotify(
        brokerbot.address, buyPrice, "0x20", { value: buyPriceInETH }))
        .to.be.revertedWith("buying disabled");
    });
        
    it("should not allow selling shares when selling is disabled", async () => {
      // Used Contract: Brokerbot, Payment Hub, Draggable Shares
      // Disable selling
      await brokerbot.connect(owner).setEnabled(true, false);
      
      // Random number of shares to buy
      const sharesToSell = new Chance().natural({ min: 1, max: 500 });
      
      // Base payment should fail
      await expect(paymentHub.connect(owner)["payAndNotify(address,address,uint256,bytes)"](
        draggableShares.address,
        brokerbot.address,
        sharesToSell,
        "0x20"
      )).to.be.revertedWith("selling disabled");
    });
  });
  
  describe("shares", () => {  
    it("should calculate number of shares for given baseCurrency amount sent (getShares)", async () => {
      // Used Contract: Brokerbot
      // Set random price and increment
      const price = ethers.utils.parseUnits(new Chance().integer({ min: 1000, max: 10000 }).toString(),
        "finney"
        );
      const increment = ethers.utils.parseUnits(new Chance().integer({ min: 1, max: 1000 }).toString(),
        "finney"
        );
        await brokerbot.connect(owner).setPrice(price, increment);
        
        // No payment no shares
        const sharesZeroPaid = await brokerbot.getShares(0);
        expect(sharesZeroPaid.isZero()).to.equal(true);
        
        // Sent payment worth 1 share
        const singlePrice = await brokerbot.getBuyPrice(1);
        const sharesSinglePaid = await brokerbot.getShares(singlePrice);
        expect(sharesSinglePaid).to.eq(1);
        
        // Repeat with random number of shares
        for (let i = 0; i < 10; i++) {
          const randomNumberShares = new Chance().natural({ min: 2, max: 50000 });
          const priceRandomNumberShares = await brokerbot.getBuyPrice(
            randomNumberShares
            );
          const calculatedShares = await brokerbot.getShares(priceRandomNumberShares);
          expect(calculatedShares).to.eq(randomNumberShares);
        }
    });

    it("should be able to distribute shares to multiple shareholders", async () => {
      // Used Contract: Brokerbot, Draggable Shares
      const buyers = [
        "0xae7eedf49d6c7a777452ee5927e5f8cacd82253b",
        "0xae7eedf49d6c7a777452ee5927e5f8cacd82253b",
        "0xedd9e0b4b1b8a34dd3c90265dd5ed1b93099f178",
        "0x7428a69ecbe26b8d5bfc7d6353fcc71de26e4ed8",
        "0x2f0494ffbdaff332db336dbe8b3ce3c1a049e76a",
        "0x7af19e35b824a88c7fe8241b560a2e278b569af4",
        "0xedd9e0b4b1b8a34dd3c90265dd5ed1b93099f178",
        "0xd9de2e130b6d1d3871a1f2b5301c542542e76063",
        "0x99c4704b59b4d3072d388b17f5e99c27d1d29a4d",
        "0x0df9225bd4fb0cce596d41becbc9b2c116233fb2",
        "0xc4f78b740c7c0cf78670b341487bbe285de2fb7f",
        "0xc4f78b740c7c0cf78670b341487bbe285de2fb7f",
        "0x8824ba7d8e47aab3d04e7f9dcbb456334fd029f6",
        "0xe8fdcee492e7cecce00c0a34fac38cc41679cd8a",
        "0xb866480b21eb64d2b6e2fd710ba3667ab01b2e2e",
        "0xb866480b21eb64d2b6e2fd710ba3667ab01b2e2e",
      ];
      const shares = [
        50, 20, 10, 450, 50, 10, 12, 50, 20, 12, 10, 10, 10, 50, 50, 50,
      ];
      const ref = [
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
        "0x",
      ];

      const brokerbotBalanceBefore = await draggableShares.balanceOf(
        brokerbot.address
      );
      const buyerBalancesBefore = await Promise.all(
        buyers.map(async (address) => {
          return await draggableShares.balanceOf(address);
        })
      );

      await brokerbot.connect(owner).notifyTradesAndTransfer(buyers, shares, ref);

      const brokerbotBalanceAfter = await draggableShares.balanceOf(
        brokerbot.address
      );
      const buyerBalancesAfter = await Promise.all(
        buyers.map(async (address) => {
          return await draggableShares.balanceOf(address);
        })
      );

      // Check result. Double loop, because an address can have multiple allocations i
      for (let i = 0; i < buyers.length; i++) {
        let balance = buyerBalancesBefore[i];
        for (let j = 0; j < buyers.length; j++) {
          if (buyers[i] === buyers[j]) {
            balance = balance.add(shares[j]);
          }
        }
        expect(balance).to.eq(buyerBalancesAfter[i]);
      }

      const totalShares = shares.reduce((a, b) => a + b, 0);
      expect(brokerbotBalanceBefore.sub(totalShares)).to.eq(brokerbotBalanceAfter);
    });
  });

  /*
  // Temporarily disabled - Current Brokerbot doesn't have notifyTrade methods

  it('should support external trades', async () => {
    // Used Contract: Brokerbot

    // Initialize with random increment
    let increment = web3.utils.toWei(new BN(new Chance().integer({ min: 1, max: 1000 })), 'milli');
    await brokerbot.setPrice(config.sharePrice, increment);

    let balanceBefore = await draggableShares.balanceOf(brokerbot.address);
    let price1 = await brokerbot.getBuyPrice(new BN(1));
    await brokerbot.notifyTrade(accounts[0], 700, "0x");
    await brokerbot.notifyTradeAndTransfer(accounts[0], 300, "0x");
    let price2 = await brokerbot.getBuyPrice(new BN(1));
    let balanceAfter = await draggableShares.balanceOf(brokerbot.address);

    expect(price1.add(increment.mul(1000)).to.eq(price2);
    expect(balanceAfter.add(300)).to.eq(balanceBefore);
  })

  it('should allow buying shares with BaseCurrency', async () => {
    let brokerbot = await Brokerbot.deployed();
    await brokerbot.onTokenTransfer(accounts[0], )
    
  })

  it('should allow selling shares against BaseCurrency', async () => {
    
  })
  */
});
