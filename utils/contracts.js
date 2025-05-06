const ethers = require("ethers");

const erc20Abi = require("../public/ERC20Abi.json");
const routerAbi = require("../public/RouterAbi.json");
const zeistalAbi = require("../public/ZeistalAbi.json");

const rpc = new ethers.JsonRpcProvider("https://rpc.testnet.citrea.xyz");
const routerContractAddress = "0xb45670f668EE53E62b5F170B5B1d3C6701C8d03A";
const usdcContractAddress = "0xb669dC8cC6D044307Ba45366C0c836eC3c7e31AA";
const zeistalContractAddress = "0x47BfDA04dEA5FDe151541feB33C2cd24A9c0b4f7";

const routerContract = new ethers.Contract(
  routerContractAddress,
  routerAbi.abi,
  rpc
);
const usdcContract = new ethers.Contract(
  usdcContractAddress,
  erc20Abi.abi,
  rpc
);
const zeistalContract = new ethers.Contract(
  zeistalContractAddress,
  zeistalAbi.abi,
  rpc
);

module.exports = { routerContract, usdcContract, zeistalContract };
