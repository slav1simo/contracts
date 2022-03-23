const Confirm = require('prompt-confirm');
const config = require("../deploy_config_modulare.js");

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = config.multisigAddress;

  const shares = await ethers.getContractAt('Shares', config.shareAddress);
  const recoveryHub = await ethers.getContractAt("RecoveryHub", config.recoveryHubAddress);
  const offerFactory = await ethers.getContractAt("OfferFactory", config.offerFactoryAddress);
  
  const terms = config.terms;
  const quorumBps = config.quorumBps;
  const votePeriodSeconds = config.votePeriodSeconds;
  
  if (network.name != "hardhat") {
    console.log("-----------------------");
    console.log("Deploy Modula-re DraggableShares");
    console.log("-----------------------");
    console.log("deployer: %s", deployer);
    console.log("shares: %s", shares.address);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("offer factory: %s", offerFactory.address);
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
      shares.address,
      quorumBps,
      votePeriodSeconds,
      recoveryHub.address,
      offerFactory.address,
      owner],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
};

module.exports.tags = ["DraggableSharesMRE"];
module.exports.dependencies = ["SharesMRE"];