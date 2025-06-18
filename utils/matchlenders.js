const { BigNumber } = require("bignumber.js");

// Configure BigNumber for financial calculations
// Using ROUND_HALF_UP for standard financial rounding
BigNumber.config({ DECIMAL_PLACES: 2, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });

// Convert to BigNumber with proper decimal handling
const toBN = (value) => {
  return new BigNumber(value.toString());
};

function matchLendersForLoan(
  allowances,
  loanAmount,
  interestRate,
  durationMonths,
) {
  // Convert loan amount to BigNumber and round to 2 decimal places
  const loanAmountBN = toBN(loanAmount);
  let remainingAmount = toBN(loanAmountBN);

  const matchedLenders = [];
  let totalMatched = new BigNumber(0);

  // First pass: try to match lenders with matching preferences
  for (const allowance of allowances) {
    // Skip if we've already fully funded the loan
    if (remainingAmount.lte(0)) break;

    const availableAmountBN = toBN(allowance.available_amount);
    const available = toBN(availableAmountBN);

    // Skip lenders with no available funds
    if (available.lte(0)) continue;

    const durationMatches =
      allowance.duration_preference === 0 ||
      allowance.duration_preference >= durationMonths;

    // If preferences match, include this lender
    if (durationMatches) {
      // Use BigNumber for precise decimal comparison
      let contributionAmount = BigNumber.min(available, remainingAmount);

      // Ensure we round to 2 decimal places
      contributionAmount = toBN(contributionAmount);

      matchedLenders.push({
        lender_address: allowance.user_address,
        lender_id: allowance.user_id,
        amount: contributionAmount,
      });

      remainingAmount = remainingAmount.minus(contributionAmount);
      // Ensure we don't have floating point errors in remainingAmount
      remainingAmount = toBN(remainingAmount);

      totalMatched = totalMatched.plus(contributionAmount);
      // Ensure we don't have floating point errors in totalMatched
      totalMatched = toBN(totalMatched);
    }
  }

  // Second pass: if we still need more funds, include lenders regardless of preferences
  if (remainingAmount.gt(0)) {
    for (const allowance of allowances) {
      // Skip lenders already included
      if (
        matchedLenders.some((l) => l.lender_address === allowance.user_address)
      )
        continue;

      // Skip if we've already fully funded the loan
      if (remainingAmount.lte(0)) break;

      const availableAmountBN = toBN(allowance.available_amount);
      const available = toBN(availableAmountBN);

      // Skip lenders with no available funds
      if (available.lte(0)) continue;

      // Use BigNumber for precise decimal comparison
      let contributionAmount = BigNumber.min(available, remainingAmount);

      // Ensure we round to 2 decimal places
      contributionAmount = toBN(contributionAmount);

      matchedLenders.push({
        lender_address: allowance.user_address,
        lender_id: allowance.user_id,
        amount: contributionAmount,
      });

      remainingAmount = remainingAmount.minus(contributionAmount);
      // Ensure we don't have floating point errors in remainingAmount
      remainingAmount = toBN(remainingAmount);

      totalMatched = totalMatched.plus(contributionAmount);
      // Ensure we don't have floating point errors in totalMatched
      totalMatched = toBN(totalMatched);
    }
  }

  // Handle any remaining small amount due to rounding
  if (remainingAmount.gt(0) && matchedLenders.length > 0) {
    // Add any remaining small amount to the first lender
    const firstLender = matchedLenders[0];
    const currentAmount = toBN(firstLender.amount);
    const newAmount = currentAmount.plus(remainingAmount);

    firstLender.amount = newAmount;
    remainingAmount = new BigNumber(0);

    // Update totalMatched
    totalMatched = toBN(loanAmountBN);
  }

  console.log("Total matched amount:", totalMatched);

  return {
    success: remainingAmount.lte(0),
    lenders: matchedLenders,
    totalMatched: totalMatched,
  };
}

module.exports = { matchLendersForLoan };
