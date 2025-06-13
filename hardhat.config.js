/** @type import('hardhat/config').HardhatUserConfig */
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Use the IR pipeline
    },
  },
  paths: {
    sources: "./Contracts",
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    base_sepolia: {
      url: "https://sepolia.base.org",
      accounts: {
        mnemonic: process.env.MNEMONIC ?? "",
      },
    },
  },
};
