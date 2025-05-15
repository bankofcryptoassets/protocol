
const { contract, provider } = require("../constants");
const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");

/**
 * Records loan creation events from the blockchain and updates the database
 */
const recordLoanEvents = async () => {
  try {
    const blockNumber = await provider.getBlockNumber();
    console.log(`Current block number: ${blockNumber}`);

    // Fetch loan creation events from the last 100 blocks
    const loanCreatedEvents = await contract.queryFilter(
      contract.filters.LoanCreated(),
      blockNumber - 100
    );
    
    console.log(`Found ${loanCreatedEvents.length} LoanCreated events`);
    
    for (const event of loanCreatedEvents) {
      await processLoanCreatedEvent(event);
    }
    
  } catch (error) {
    console.error("Error recording loan events:", error);
  }
};


/**
 * Process a LoanCreated event and store the data in the database
 */
const processLoanCreatedEvent = async (event) => {
  try {
    const { id, amount, collateral, borrower } = event.args;
    console.log(`Processing loan created: ${id}`);
    
    // Get the loan details from the contract
    const loanDetails = await contract.loans(id);
    
    // Get the amortization schedule from the contract
    const installments = await contract.getInstallmentSchedule(id);
    
    // Calculate important values for the loan based on contract data
    const totalPrincipal = loanDetails.principal;
    const interestRate = loanDetails.interestRate.toNumber();
    const loanDuration = loanDetails.duration.toNumber();
    const borrowerDeposit = loanDetails.borrowerDeposit.toNumber();
    const monthlyPayment = loanDetails.monthlyPayment.toNumber();
    const startTime = new Date(loanDetails.startTime.toNumber() * 1000);
    const btcPriceAtCreation = loanDetails.btcPriceAtCreation.toNumber();
    
    // Extract lender contributions
    const contributions = [];
    for (let i = 0; i < loanDetails.contributions.length; i++) {
      const contribution = await contract.loans(id).contributions(i);
      contributions.push({
        lender: contribution.lender,
        amount: contribution.amount.toNumber(),
        receivableInterest: contribution.receivableInterest.toNumber(),
        repaidPrincipal: contribution.repaidPrincipal.toNumber(),
        repaidInterest: contribution.repaidInterest.toNumber()
      });
    }
    
    // Check if we already have this loan in our database
    const existingLoan = await Loan.findOne({ loan_id: id });
    
    if (existingLoan) {
      console.log(`Loan ${id} already exists in database, updating`);
      // Update existing loan
      // existingLoan.asset_price = btcPriceAtCreation;
      // existingLoan.openedOn = startTime;
      await existingLoan.save();
      return;
    }
    
    // Calculate additional required fields based on contract data
    const interest = (interestRate / 100) * totalPrincipal;
    const totalAmountPayable = totalPrincipal + interest;
    const numberOfMonthlyInstallments = loanDuration;
    const interestPayableMonth = interest / numberOfMonthlyInstallments;
    const principalPayableMonth = totalPrincipal / numberOfMonthlyInstallments;
    
    // Find user by blockchain address
    const user = await User.findOne({ user_address: borrower });
    
    if (!user) {
      console.error(`User with wallet address ${borrower} not found`);
      return;
    }
    
    // Create a new loan in the database
    const loan = await Loan.create({
      user_id: user._id,
      user_address: borrower,
      loan_amount: totalPrincipal,
      up_front_payment: borrowerDeposit,
      total_amount_payable: totalAmountPayable,
      remaining_amount: totalPrincipal,
      collateral: borrowerDeposit,
      asset: "BTC", // From contract this appears to be cbBTC
      asset_borrowed: totalPrincipal / btcPriceAtCreation, // Convert USDC to BTC amount
      asset_remaining: totalPrincipal / btcPriceAtCreation,
      asset_price: btcPriceAtCreation,
      asset_released_per_month: (totalPrincipal / btcPriceAtCreation) / numberOfMonthlyInstallments,
      chain_id: await provider.getNetwork().then(net => net.chainId),
      interest_rate: interestRate,
      loan_duration: loanDuration,
      number_of_monthly_installments: numberOfMonthlyInstallments,
      interest: interest,
      monthly_payable_amount: monthlyPayment,
      interest_payable_month: interestPayableMonth,
      principal_payable_month: principalPayableMonth,
      liquidation_factor: totalPrincipal - borrowerDeposit,
      openedOn: startTime,
      last_payment_date: startTime,
      next_payment_date: new Date(startTime.getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 days later
      months_not_paid: 0,
      loan_end: new Date(startTime.getTime() + (loanDuration * 30 * 24 * 60 * 60 * 1000)),
      loan_id: id, // Store the contract loan ID
      is_active: true
    });
    
    // Add lender contributions
    const lendersCapitalInvested = [];
    const receivableAmountMonthlyByLenders = [];
    
    for (const contribution of contributions) {
      lendersCapitalInvested.push({
        user_address: contribution.lender,
        amount: contribution.amount,
        amount_received: 0,
        received_interest: 0,
        total_received: 0,
        remaining_amount: contribution.amount
      });
      
      receivableAmountMonthlyByLenders.push({
        user_address: contribution.lender,
        amount: contribution.amount / numberOfMonthlyInstallments,
        interest: contribution.receivableInterest / numberOfMonthlyInstallments,
        total_amount: (contribution.amount + contribution.receivableInterest) / numberOfMonthlyInstallments,
        remaining_amount: contribution.amount
      });
    }
    
    loan.lenders_capital_invested = lendersCapitalInvested;
    loan.receivable_amount_monthly_by_lenders = receivableAmountMonthlyByLenders;

    loan.amortization_schedule = installments.map(inst => ({
      duePrincipal: inst.duePrincipal.toNumber(),
      dueInterest: inst.dueInterest.toNumber(),
      paid: inst.paid
    }));
    
    await loan.save();
    
    // Update user
    user.loans.push(loan._id);
    user.totalCapitalBorrowed = {
      chain_id: await provider.getNetwork().then(net => net.chainId),
      amount: totalPrincipal,
      asset: "BTC"
    };
    await user.save();
    
    console.log(`Loan ${id} saved to database`);
  } catch (error) {
    console.error(`Error processing loan created event:`, error);
  }
};

/**
 * Process an InstallmentPaid event
 */
const processInstallmentPaidEvent = async (event) => {
  try {
    const { loanId, index } = event.args;
    console.log(`Processing installment paid for loan ${loanId}, index ${index}`);
    
    // Get the loan from database
    const loan = await Loan.findOne({ loan_contract_id: loanId });
    if (!loan) {
      console.error(`Loan with contract ID ${loanId} not found`);
      return;
    }
    
    // Update loan payment info
    const now = new Date();
    loan.last_payment_date = now;
    loan.next_payment_date = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days later
    
    // Get installment details from contract
    const installmentSchedule = await contract.getInstallmentSchedule(loanId);
    const installment = installmentSchedule[index];
    
    const principalPaid = installment.duePrincipal.toNumber();
    const interestPaid = installment.dueInterest.toNumber();
    
    // Update remaining loan amount
    loan.remaining_amount -= principalPaid;
    
    // Calculate remaining asset (BTC)
    const currentBtcPrice = await contract.getPrice();
    loan.asset_remaining = loan.remaining_amount / currentBtcPrice;
    
    await loan.save();
    
    console.log(`Updated loan ${loanId} payment info`);
  } catch (error) {
    console.error(`Error processing installment paid event:`, error);
  }
};

module.exports = {
  recordLoanEvents
};
