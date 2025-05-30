const ethers = require("ethers");
const { abi } = require("./artifacts/Contracts/Lending.sol/LendingPool.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org", // change RPC URL
);
const contractAddress = "0x920D7263014303530E92eE98E4eb4599a0a8af0E"; // change
const USDC_Address = "0x377faBD7d29562c059Dd2D3A9C41eF6974d26B21";
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
  USDC_Address,
};
