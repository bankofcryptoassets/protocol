const ethers = require("ethers");
const { abi } = require("./artifacts/contracts/Lending.sol/LendingPool.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://sepolia.base.org", // change RPC URL
);

const contractAddress = "0x105Ba0E6d0111d80C82eFE8AF38998CddC5aA96A"; // change
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
