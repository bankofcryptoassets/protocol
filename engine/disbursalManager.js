const mongoose = require("mongoose");
const Loan = require("../schema/LoaningSchema"); // Adjust the path as necessary
const User = require("../schema/UserSchema"); // Adjust the path as necessary
const ethers = require("ethers");

async function processPayment(loanId, paymentAmount) {
  const loan = await Loan.findById(loanId).populate("lends");
  if (!loan) throw new Error("Loan not found");
  const lendersAddresses = [];
  const lendersAmounts = [];
  const lendersInterest = [];

  // Step 1: Calculate interest and principal portions
  const interestAmount = (paymentAmount * loan.interest_rate) / 100;
  const principalAmount = paymentAmount - interestAmount;

  // Step 2: Calculate receivables for each lender
  loan.lenders_capital_invested.forEach((lender) => {
    const lenderShare = lender.amount / loan.collateral; // 8000/8000 = 1
    const interestForLender = interestAmount * lenderShare; // 0
    const principalForLender = principalAmount * lenderShare; // 1000
    lender.remaining_amount =
      lender.remaining_amount - (interestForLender + principalForLender); // 8000-1000 = 7000
    lender.total_received += interestForLender + principalForLender; // 0+1000 = 1000
    lender.amount_received += principalForLender; // 0+1000 = 1000
    lender.received_interest += interestForLender; // 0+0 = 0
    lendersAddresses.push(lender.user_address);
    lendersAmounts.push(ethers.parseEther(principalForLender));
    lendersInterest.push(ethers.parseEther(interestForLender));
  });

  // Step 3: Update the receivable amount by lenders
  loan.receivable_amount_By_lenders = loan.lenders_capital_invested.map(
    (lender) => ({
      lend_id: lender.lend_id,
      remaining_amount: lender.remaining_amount,
    })
  );

  // Step 4: Calculate loan repayment percentage
  const loanRepaymentPercent = (paymentAmount / loan.collateral) * 100; // 1000/8000 = 0.125

  // Step 5: Calculate the asset released
  const assetReleased = (loanRepaymentPercent / 100) * loan.asset_remaining; // gets 0.125 out of 1
  loan.asset_remaining -= assetReleased; // 1 - 0.125 = 0.875

  // Step 6: Update remaining collateral and asset remaining
  loan.collateral -= principalAmount; // 8000 - 1000 = 7000

  // Step 7: Update liquidation factor
  const remainingCollateral = loan.collateral; // 7000
  const remainingAsset = loan.asset_remaining; // 0.875
  loan.liquidation_factor = remainingCollateral / remainingAsset; // 7000 / 0.875 = 8000

  // Step 8: Update user investments
  await Promise.all(
    loan.lenders_capital_invested.map(async (lender) => {
      const user = await User.findById(lender.user_id);
      const userInvestment = user.investments.find(
        (investment) => investment.loan_id.toString() === loanId.toString()
      );

      if (userInvestment) {
        userInvestment.received += principalForLender;
        userInvestment.interestReceived += interestForLender;
        userInvestment.totalReceived += principalForLender + interestForLender;
      }

      await user.save();
    })
  );

  // Save the loan with the updated fields
  await loan.save();
  console.log("Loan payment processed successfully.");
}

// 1000 payment amount
async function processPaymentWithVariedLiquidationFactor(
  loanId,
  paymentAmount
) {
  console.log(
    "Processing payment with varied liquidation factor",
    paymentAmount,
    loanId
  );
  const loan = await Loan.findById(loanId).populate("lends");
  if (!loan) throw new Error("Loan not found");
  const lendersAddresses = [];
  const lendersAmounts = [];
  const lendersInterest = [];
  const totalLendersPayable = [];

  // Step 1: Calculate interest and principal portions
  const interestAmount = (paymentAmount * loan.interest_rate) / 100;
  const principalAmount = paymentAmount - interestAmount;

  // Step 2: Calculate receivables for each lender
  loan.lenders_capital_invested.forEach(async (lender) => {
    const lenderShare = lender.amount / loan.total_amount_payable; // 10000 / 10000 = 1
    const interestForLender = interestAmount * lenderShare; // 0
    const principalForLender = principalAmount * lenderShare; // 1000
    lender.remaining_amount =
      lender.remaining_amount - (interestForLender + principalForLender); // 10000-1000 = 9000
    lender.total_received += interestForLender + principalForLender; // 0+1000 = 1000
    lender.amount_received += principalForLender; // 0+1000 = 1000
    lender.received_interest += interestForLender; // 0+0 = 0
    const user = await User.findById(lender.user_id);
    lendersAddresses.push(user.user_address);
    lendersAmounts.push(
      ethers.parseEther(principalForLender.toString()).toString()
    );
    lendersInterest.push(
      ethers.parseEther(interestForLender.toString()).toString()
    );
    totalLendersPayable.push(
      ethers
        .parseEther((principalForLender + interestForLender).toString())
        .toString()
    );
  });

  console.debug(
    "Lender receivable details,",
    loan.receivable_amount_monthly_by_lenders
  );
  // Step 3: Update the receivable amount monthly by lenders
  loan.receivable_amount_monthly_by_lenders = loan.lenders_capital_invested.map(
    (lender) => {
      const interestForLender =
        interestAmount * (lender.amount / loan.total_amount_payable);
      const principalForLender =
        principalAmount * (lender.amount / loan.total_amount_payable);
      return {
        remaining_amount:
          lender.remaining_amount - (interestForLender + principalForLender), // Keep track of the remaining amount for the lender
      };
    }
  );

  // Note: receivable_amount_By_lenders should stay as it is (only storing ObjectId references).
  loan.receivable_amount_By_lenders = loan.lenders_capital_invested.map(
    (lender) => lender.amount
  );

  // Step 4: Calculate loan repayment percentage
  const loanRepaymentPercent =
    (paymentAmount / loan.total_amount_payable) * 100; // 1000/10000 = 10

  // Step 5: Calculate the asset released
  const assetReleased = (loanRepaymentPercent / 100) * loan.asset_remaining; // 0.1 * 1 = 0.1
  loan.asset_remaining -= assetReleased; // 1 - 0.1 = 0.9

  // Step 6: Update remaining collateral and asset remaining
  loan.remaining_amount -= loan.up_front_payment + principalAmount; // 10000 - 1000 - 2000 = 7000

  // Step 7: Update liquidation factor
  const remainingCollateral = loan.remaining_amount; // 7000
  const remainingAsset = loan.asset_remaining; // 0.9
  loan.liquidation_factor = remainingCollateral / remainingAsset; // 7000 / 0.9 = 7777.777

  // Step 8: Update user investments
  await Promise.all(
    loan.lenders_capital_invested.map(async (lender) => {
      const user = await User.findById(lender.user_id);
      const userInvestment = user.investments.find(
        (investment) => investment.loan_id.toString() === loanId.toString()
      );

      if (userInvestment) {
        userInvestment.received += principalForLender;
        userInvestment.interestReceived += interestForLender;
        userInvestment.totalReceived += principalForLender + interestForLender;
      }

      await user.save();
    })
  );

  // Save the loan with the updated fields
  await loan.save();
  console.log("Loan payment processed successfully.");
  return {
    lendersAddresses,
    lendersAmounts,
    lendersInterest,
    totalLendersPayable,
  };
}

module.exports = { processPayment, processPaymentWithVariedLiquidationFactor };
