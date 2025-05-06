const ethers = require("ethers");
const { abi } = require("./public/Zeistal02Abi.json");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(
  "https://rpc.testnet.citrea.xyz"
);
const contractAddress = "0x96BD2F1AffB134c0d67CfF763Ec33f073cc7F618";
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const contract = new ethers.Contract(contractAddress, abi, wallet);

module.exports = {
  provider,
  contractAddress,
  wallet,
  contract,
};
