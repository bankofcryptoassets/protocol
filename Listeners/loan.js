const { contract, provider } = require("../constants");

const recordLoan = async () => {
  const blockNumber = await provider.getBlockNumber();
  console.log(blockNumber);

  const loanEvent = await contract.queryFilter(
    contract.filters.Loan(),
    blockNumber - 100
  );

  console.log(loanEvent);
  // update to DB -> offchain calculations and liquidity factor calculations
};

module.exports = {
  recordLoan,
};
