const { ethers } = require("hardhat");

async function main() {
  console.log("Starting LendingPool deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Existing deployed contract addresses
  const usdcAddress = "0xe270578586FA80B627a0B84a3D86169B4B515730";
  const cbBtcAddress = "0xB4BF7595a438a41Dd9f691bfE7AF16A82123dF8d";
  const aavePoolAddress = "0xa14E6B439De8B7cd36D61b13De49319e85282B99";
  const swapRouterAddress = "0xea8D7FB0C67236B90485A5983A5927119918fCBF";
  const oracleAddress = "0x0FB99723Aee6f420beAD13e6bBB79b7E6F034298";

  // Deploy LendingPool
  const LendingPool = await ethers.getContractFactory("LendingPool");
  const lendingPool = await LendingPool.deploy(
    usdcAddress,
    cbBtcAddress,
    oracleAddress,
    aavePoolAddress,
    swapRouterAddress,
  );
  await lendingPool.waitForDeployment();
  const lendingPoolAddress = await lendingPool.getAddress();

  console.log(`\n✅ LendingPool deployed to: ${lendingPoolAddress}`);
  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
