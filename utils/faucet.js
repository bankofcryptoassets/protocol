const { ethers } = require("hardhat");
const { USDC_Address } = require("../constants");
const mockUSDC = require("../artifacts/Contracts/Helper.sol/MockUSDC.json");
const { provider, wallet } = require("../constants");

const MIN_USDC_TO_SEND = ethers.parseUnits("10000", 6); // send 100 USDC (6 decimals)

async function faucet(targetAddress) {
  const deployer = wallet; // Use the deployer wallet
  const provider = deployer.provider; // Use the provider from the deployer wallet

  let walletIsVirgin = false;

  console.log("Deploeyer address: ", deployer.address);

  // 1. Check ETH balance

  const network = await provider.getNetwork();
  console.log(`Network: ${network.name} (${network.chainId})`);
  const ethBalance = await provider.getBalance(targetAddress);
  const hasEth = ethBalance > ethers.parseUnits("0.0001", "ether"); // adjust threshold if needed

  console.log(
    `ETH balance of ${targetAddress}: ${ethers.formatUnits(ethBalance, "ether")} ETH`,
  );

  if (!hasEth) {
    console.log("Address has no ETH. Doing nothing.");
    return;
  }

  // 2. Check USDC balance
  const usdc = new ethers.Contract(USDC_Address, mockUSDC.abi, deployer);
  const usdcBalance = await usdc.balanceOf(targetAddress);
  const hasUSDC = usdcBalance > 0;

  console.log(
    `USDC balance of ${targetAddress}: ${ethers.formatUnits(usdcBalance, 6)} USDC`,
  );
  console.log(
    "Deployer USDC balance: ",
    ethers.formatUnits(await usdc.balanceOf(deployer.address), 6),
  );

  if (hasUSDC) {
    console.log("Address already has USDC. Doing nothing.");
    walletIsVirgin = false;
    return walletIsVirgin;
  }

  console.log("Address has no USDC. Sending USDC...");
  // 3. Send USDC
  const tx = await usdc.transfer(targetAddress, MIN_USDC_TO_SEND);
  await tx.wait();

  console.log(`Transaction hash: ${tx}`);

  console.log(
    `Sent ${ethers.formatUnits(MIN_USDC_TO_SEND, 6)} USDC to ${targetAddress}`,
  );

  walletIsVirgin = true;
  return walletIsVirgin;
}

module.exports = {
  faucet,
};
