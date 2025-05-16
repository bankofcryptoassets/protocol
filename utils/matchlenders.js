import { toBigInt } from 'ethers';

const toBN = (value) => toBigInt(value);

function matchLendersForLoan(allowances, loanAmountBN, interestRate, durationMonths) {
    let remainingAmount = loanAmountBN;
    const matchedLenders = [];
    let totalMatched = toBN(0);
    
    // First pass: try to match lenders with matching preferences
    for (const allowance of allowances) {
      // Skip if we've already fully funded the loan
      if (remainingAmount <= 0) break;
      
      const availableAmountBN = toBN(allowance.available_amount);
      
      // Skip lenders with no available funds
      if (availableAmountBN <= 0) continue;
      
      const durationMatches = allowance.duration_preference === 0 || 
                             allowance.duration_preference >= durationMonths;
      
      // If preferences match, include this lender
      if (durationMatches) {
        const contributionAmount = BigNumber.min(availableAmountBN, remainingAmount);
        
        matchedLenders.push({
          lender_address: allowance.user_address,
          lender_id: allowance.user_id,
          amount: contributionAmount.toString()
        });
        
        remainingAmount -= contributionAmount;
        totalMatched += contributionAmount;
      }
    }
    
    // Second pass: if we still need more funds, include lenders regardless of preferences
    if (remainingAmount > 0) {
      for (const allowance of allowances) {
        // Skip lenders already included
        if (matchedLenders.some(l => l.lender_address === allowance.user_address)) continue;
        
        // Skip if we've already fully funded the loan
        if (remainingAmount <= 0) break;
        
        const availableAmountBN = toBN(allowance.available_amount);
        
        // Skip lenders with no available funds
        if (availableAmountBN <= 0) continue;
        
        const contributionAmount = BigNumber.min(availableAmountBN, remainingAmount);
        
        matchedLenders.push({
          lender_address: allowance.user_address,
          lender_id: allowance.user_id,
          amount: contributionAmount.toString()
        });
        
        remainingAmount -= contributionAmount;
        totalMatched += contributionAmount;
      }
    }
    
    return {
      success: remainingAmount <= 0,
      lenders: matchedLenders,
      totalMatched: totalMatched.toString()
    };
  }

export { matchLendersForLoan };