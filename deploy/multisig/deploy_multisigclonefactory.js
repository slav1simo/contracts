module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer, dev, multiSigDefaultOwner } = await getNamedAccounts();

  const multiSigWalletMaster = await deployments.get('MultiSigWalletMaster');

  console.log("------------------------------")
  console.log("Deploy MultiSig Clone Factory")
  console.log("------------------------------")
  console.log(`deployer: ${deployer}`);
  console.log(`multiSigWalletMaster: ${multiSigWalletMaster.address}`);

  const feeData = await ethers.provider.getFeeData();

  const { address } = await deploy("MultiSigCloneFactory", {
    contract: "MultiSigCloneFactory",
    from: deployer,
    args: [multiSigWalletMaster.address],
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    maxFeePerGas: feeData.maxFeePerGas,
    log: true
  });
};

module.exports.tags = ["MultiSigCloneFactory"];
module.exports.dependencies = ['MultiSigWalletMaster'];