const Loan = require("../schema/LoaningSchema");
const Lend = require("../schema/LendingSchema");
const { ethers } = require("ethers");
const User = require("../schema/UserSchema");

async function manageLiquidity(loanId) {
  try {
    // Step 1: Query for the loan and validate it
    const loan = await Loan.findById(loanId);
    if (!loan) {
      throw new Error("Loan not found");
    }

    // Step 2: Get all lendings within the specified time frame
    const lendings = await Lend.find({
      lending_duration: { $gte: loan.loan_duration },
      user_id: { $ne: loan.user_id },
      chain_id: loan.chain_id,
    });

    // Total amount required for the loan
    let remainingLoanAmount = loan.collateral;
    let totalInterest = loan.interest;
    const monthlyInterestRate =
      totalInterest / loan.number_of_monthly_installments; // Monthly interest rate as a percentage

    // Arrays to store details of each lender's contributions
    const receivableAmountMonthlyByLenders = [];
    const receivableInterestMonthlyByLenders = [];
    const totalReceivableAmountMonthlyByLenders = [];
    const lendersCapitalInvested = [];
    const lendersList = [];
    const capitalList = [];
    const interestList = [];
    const totalPrincipalList = [];
    let totalLendContribution = 0;

    // Step 3: Distribute loan amount among lenders and calculate monthly receivables
    for (let lending of lendings) {
      // Calculate each lender's contribution to the loan and interest
      const lendAmount = Math.min(
        lending.lending_amount_approved,
        remainingLoanAmount
      );
      const lenderContributionRatio = lendAmount / loan.loan_amount;

      // Monthly principal and interest amounts based on the lender's contribution ratio
      const monthlyPrincipal =
        lenderContributionRatio *
        (loan.loan_amount / loan.number_of_monthly_installments);
      const monthlyInterest =
        lenderContributionRatio *
        (totalInterest / loan.number_of_monthly_installments);

      // Add entries to track each lender's monthly principal and interest receivables
      receivableAmountMonthlyByLenders.push({
        lend_id: lending._id,
        user_id: lending.user_id,
        amount: monthlyPrincipal,
        interest: monthlyInterest,
        total_amount: monthlyPrincipal + monthlyInterest,
        remaining_amount: lendAmount,
      });

      receivableInterestMonthlyByLenders.push({
        lend_id: lending._id,
        user_id: lending.user_id,
        amount: monthlyInterest,
      });

      totalReceivableAmountMonthlyByLenders.push({
        lend_id: lending._id,
        user_id: lending.user_id,
        amount: monthlyPrincipal + monthlyInterest,
      });

      lendersCapitalInvested.push({
        lend_id: lending._id,
        user_id: lending.user_id,
        amount: lendAmount,
        remaining_amount: lendAmount,
      });

      lendersList.push(lending.user_address);
     // Convert BigInt to String to make it serializable
     capitalList.push(ethers.parseEther(lendAmount.toString()).toString());
     interestList.push(ethers.parseEther(monthlyInterest.toString()).toString());
     totalPrincipalList.push(
       ethers.parseEther((monthlyPrincipal + monthlyInterest).toString()).toString()
     );
      // Reduce the remaining loan amount and track total contributions
      remainingLoanAmount -= lendAmount;
      totalLendContribution += lendAmount;

      lending.avaialble_amount -= lendAmount;
      lending.ifSlashedReceivable = lendAmount;

      lending.loans.push(loan._id);
      lending.save();

      const user = await User.findById(lending.user_id);
      user.totalCapitalLent += lendAmount;
      user.investments.push({
        loan_id: loan._id,
        amount: lendAmount,
        interest: monthlyInterest,
        total: lendAmount + monthlyInterest,
      });

      // Break if the loan amount has been fully met
      if (remainingLoanAmount <= 0) break;
    }

    // Step 4: Update the loan document with calculated lender receivables
    loan.receivable_amount_monthly_by_lenders =
      receivableAmountMonthlyByLenders;
    loan.lenders_capital_invested = lendersCapitalInvested;

    loan.lends = lendings.map((lend) => lend._id);

    // Save updates to the Loan document
    await loan.save();

    console.log("Loan document updated successfully with lender receivables");

    return {
      lendersList,
      capitalList,
      interestList,
      totalPrincipalList,
      receivableAmountMonthlyByLenders,
    };
  } catch (error) {
    console.error("Error in matching engine:", error);
  }
}

module.exports = { manageLiquidity };
