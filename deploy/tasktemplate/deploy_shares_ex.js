const Confirm = require('prompt-confirm');
const nconf = require('nconf');

module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const owner = nconf.get("multisigAddress");
  
  const recoveryHub = await deployments.get("RecoveryHub");
  nconf.set("address:recoveryHub", recoveryHub.address);
  const permit2Hub = await deployments.get("Permit2Hub");

  const symbol = nconf.get("symbol");
  const name = nconf.get("name");
  const terms = nconf.get("terms");
  const totalShares = nconf.get("totalShares");
  
  if (network.name != "hardhat" && !nconf.get("silent")) {
    console.log("-----------------------")
    console.log("Deploy Shares "+ symbol)
    console.log("-----------------------")
    console.log("deployer: %s", deployer);
    console.log("recoveryHub: %s", recoveryHub.address);
    console.log("permit2hub: %s", permit2Hub.address);
    console.log("owner: %s", owner); // don't forget to set it in deploy_config.js as the multsigadr

    const prompt = await new Confirm("Addresses correct?").run();
    if(!prompt) {
      console.log("exiting");
      process.exit();
    }
  }

  const feeData = await ethers.provider.getFeeData();

  const { address, receipt } = await deploy(symbol+"Shares", {
    contract: "Shares",
    from: deployer,
    args: [
      symbol,
      name,
      terms,
      totalShares,
      owner,
      recoveryHub.address,
      permit2Hub.address
    ],
    log: true,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas
  });
  const sharesContract = await ethers.getContract(symbol+"Shares");
  const version = await sharesContract.VERSION();

  // set config 
  nconf.set("brokerbot:shares", address);
  nconf.set("address:share", address);
  nconf.set("blocknumber", receipt.blockNumber.toString());
  nconf.set("version:shares", version.toString());
};

module.exports.tags = [nconf.get("symbol")+"Shares"];
module.exports.dependencies = ["RecoveryHub"];