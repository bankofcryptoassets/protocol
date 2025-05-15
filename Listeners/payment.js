const { contract, provider } = require("../constants");
const Payment = require("../schema/PaymentSchema");
const Loan = require("../schema/LoaningSchema");

const recordPayoutEvents = async () => {
try {
        // Process payout events
        const blockNumber = await provider.getBlockNumber();
        const payoutEvents = await contract.queryFilter(
          contract.filters.Payout(),
          blockNumber - 100
        );
        
        console.log(`Found ${payoutEvents.length} Payout events`);
        
        for (const event of payoutEvents) {
          await processPayoutEvent(event);
        }
      
} catch (error) {
    console.error("Error recording payout events:", error);
  
}
}


/**
 * Process a Payout event
 */
const processPayoutEvent = async (event) => {
  try {
    const { loanId, borrower, amount, fullyRepaid } = event.args;
    console.log(`Processing payout for loan ${loanId}, amount ${amount}, fully repaid: ${fullyRepaid}`);

    const loan = await Loan.findOne({ loan_id: loanId });
    if (!loan) {
      console.error(`Loan with contract ID ${loanId} not found`);
      return;
    }

    const contractLoan = await contract.loans(loanId);
    const contributions = contractLoan.contributions;
    const installmentSchedule = await contract.getInstallmentSchedule(loanId);

    const now = new Date();

    const distributions = [];
    for (const c of contributions) {
      const prev = loan.lenders_capital_invested.find(
        (l) => l.user_address.toLowerCase() === c.lender.toLowerCase()
      );
      if (!prev) continue;

      const principalDelta = c.repaidPrincipal.toNumber() - (prev.amount_received || 0);
      const interestDelta = c.repaidInterest.toNumber() - (prev.received_interest || 0);
      const totalDelta = principalDelta + interestDelta;

      distributions.push({
        user_address: c.lender,
        amount: principalDelta,
        interest: interestDelta,
        total: totalDelta,
      });

      prev.amount_received += principalDelta;
      prev.received_interest += interestDelta;
      prev.total_received += totalDelta;
      prev.remaining_amount -= principalDelta;
    }

    let totalPrincipalPaid = 0;
    const updatedInstallments = loan.amortization_schedule || [];
    for (let i = 0; i < installmentSchedule.length; i++) {
      const inst = installmentSchedule[i];
      if (inst.paid) {
        totalPrincipalPaid += inst.duePrincipal.toNumber();

        // update amortization schedule in DB if tracked
        if (updatedInstallments[i]) {
          updatedInstallments[i].paid = true;
        }
      }
    }

    loan.amortization_schedule = updatedInstallments;
    loan.remaining_amount -= totalPrincipalPaid;

    const currentBtcPrice = await contract.getPrice();
    loan.asset_remaining = loan.remaining_amount / currentBtcPrice;

    if (fullyRepaid) {
      loan.is_active = false;
      loan.remaining_amount = 0;
      loan.asset_remaining = 0;
      loan.next_payment_date = null;
      loan.is_repaid = true;
    } else {
      loan.next_payment_date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    loan.liquidation_factor = loan.remaining_amount - amount.toNumber();
    loan.last_payment_date = now;

    await loan.save();

    await Payment.create({
      user_id: loan.user_id,
      user_address: borrower,
      payment_amount: amount.toNumber(),
      payment_time: now.getTime(),
      loan_id: loan._id,
      asset: loan.asset,
      distributions,
      transaction_hash: event.transactionHash,
    });

    // Update user

    // const user = await User.findOne({ user_address: borrower });
    // if (!user) {
    //   console.error(`User with wallet address ${borrower} not found`);
    //   return;
    // }

    // user.totalCapitalBorrowed = {
    //   chain_id: await provider.getNetwork().then((net) => net.chainId),
    //   amount: loan.remaining_amount,
    //   asset: "BTC",
    // };
    // await user.save();
    // console.log(`User ${borrower} updated with new total capital borrowed`);

    console.log(`Payment recorded for loan ${loanId}, tx: ${event.transactionHash}`);
  } catch (error) {
    console.error("Error processing payout event:", error);
  }
};

module.exports = {
  recordPayoutEvents,
};
