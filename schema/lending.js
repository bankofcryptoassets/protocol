const lendingSchema = {
  lending_id,
  user_id,
  user_address,
  lending_amount, // allowance
  lending_duration,
  loanedAmount: [
    {
      loanId,
      loanAmount,
      loanTime,
    },
  ],
  approvalhash,
  transactionHash,
  interestRate,
};

const borrowingSchema = {
  loan_id,
  user_id,
  user_address,
  loan_amount,
  loan_duration,
  lentAmount: [
    {
      lendingId,
      lendingAmount,
      lendingTime,
    },
  ],
  approvalhash,
  transactionHash,
  upFrontAmount,
  interestRate,
  existingLoanAmount,
  paymentDetails: {
    paymentId,
    paymentAmount,
    paymentTime,
  },
  loanBounce,
  monthsNotPaid,
};

const userSchema = {
  user_address,
  totalCapitalLent,
  totalCapitalBorrowed,
  totalInterestEarned,
  assets: [],
  loans: [],
  lendings: [],
};

const liquidityManagerSchema = {
  asset,
  totalAvailableLiquidity,
};

