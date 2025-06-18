const ethers = require("ethers");
const { abi } = require("./artifacts/Contracts/Lending.sol/LendingPool.json");
const { abi : abiUSDC } = require("./artifacts/Contracts/Helper.sol/MockUSDC.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org", // change RPC URL
);

const contractAddress = "0xb7B9a796E324506dB76db2f69F1dbBef07d01Fc9"; // change
const USDC_Address = "0x377faBD7d29562c059Dd2D3A9C41eF6974d26B21";
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);
const usdc = new ethers.Contract(USDC_Address, abiUSDC, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
  USDC_Address,
  usdc,
};
