const { ethers } = require("hardhat");

async function main() {
  console.log("Starting LendingPool deployment...");

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Existing deployed contract addresses
  const usdcAddress = "0x377faBD7d29562c059Dd2D3A9C41eF6974d26B21";
  const cbBtcAddress = "0x905DFbD63Eb404E9A6A03B447c037EC7260478cF";
  const aavePoolAddress = "0x044a1Caf72d89f67a4801bB77F858C9A2795b57A";
  const swapRouterAddress = "0xb1c026CFce4478DaF34FD72cB8ac959e35823F21";
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
