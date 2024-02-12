const Confirm = require('prompt-confirm');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, owner } = await getNamedAccounts();

  
  const shares = await deployments.get('Shares');
  const recoveryHub = await deployments.get("RecoveryHub");
  const offerFactory = await deployments.get("OfferFactory");
  const permit2Hub = await deployments.get("Permit2Hub");
  
  const terms = "test.ch/terms";
  const quorumBps = 7500;
  const quorumMigration = 7500;
  const votePeriodSeconds = 5184000;

  const params = {
    wrappedToken: shares.address,
    quorumDrag: quorumBps,
    quorumMigration: quorumMigration,
    votePeriod: votePeriodSeconds
  }
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy DraggableShares");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("offer factory: %s", offerFactory.address);
    console.log("permit2hub: %s", permit2Hub.address);
    console.log("owner: %s", owner);  // don't forget to set it in hardhat.config.js as the multsig account

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("DraggableShares", {
    contract: "DraggableShares",
    from: deployer,
    args: [
      terms,
      params,
      recoveryHub.address,
      offerFactory.address,
      owner,
      permit2Hub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["DraggableShares"];
module.exports.dependencies = ["Shares", "RecoveryHub", "OfferFactory", "Permit2Hub"];