const { contract, provider } = require("../constants");
const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");
const Lend = require("../schema/LendingSchema"); // Import the allowance schema

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
      blockNumber - 1000,
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

    const loanDetails = await contract.loans(id);
    const installments = await contract.getInstallmentSchedule(id);
    const chainId = Number((await provider.getNetwork()).chainId);

    const totalPrincipal = Number(loanDetails.principal) / 1e6;
    const interestRate = Number(loanDetails.interestRate);
    const loanDuration = Number(loanDetails.duration);
    const borrowerDeposit = Number(loanDetails.borrowerDeposit) / 1e6;
    const monthlyPayment = Number(loanDetails.monthlyPayment) / 1e6;
    const startTime = new Date(Number(loanDetails.startTime) * 1000);
    const btcPriceAtCreation = Number(loanDetails.btcPriceAtCreation) / 1e8;

    const interest = (interestRate / 100) * totalPrincipal;
    const totalAmountPayable = totalPrincipal + interest;
    const interestPayableMonth = interest / loanDuration;
    const principalPayableMonth = totalPrincipal / loanDuration;
    const assetBorrowed = Number(loanDetails.stakedAmount) / 1e8;
    const assetRemaining = assetBorrowed;
    const assetReleasedPerMonth = assetBorrowed / loanDuration;
    const loanEndDate = new Date(startTime.getTime() + loanDuration * 30 * 24 * 60 * 60 * 1000);

    const user = await User.findOne({ user_address: borrower.toLowerCase() });
    if (!user) {
      console.error(`User with wallet address ${borrower} not found`);
      return;
    }

    const existingLoan = await Loan.findOne({ loan_id: id });
    if (existingLoan) {
      console.log(`Loan ${id} already exists. Skipping creation.`);
      return;
    }

    const amortization_schedule = installments.map((inst) => ({
      duePrincipal: Number(inst.duePrincipal) / 1e6,
      dueInterest: Number(inst.dueInterest) / 1e6,
      paid: inst.paid,
    }));

    const loan = await Loan.create({
      loan_id: id,
      user_id: user._id,
      user_address: borrower,
      loan_amount: totalPrincipal,
      up_front_payment: borrowerDeposit,
      total_amount_payable: totalAmountPayable,
      remaining_amount: totalAmountPayable,
      collateral: borrowerDeposit,
      asset: "BTC",
      asset_borrowed: assetBorrowed,
      asset_remaining: assetRemaining,
      asset_price: btcPriceAtCreation,
      asset_released_per_month: assetReleasedPerMonth,
      chain_id: chainId,
      interest_rate: interestRate,
      loan_duration: loanDuration,
      number_of_monthly_installments: loanDuration,
      interest: interest,
      monthly_payable_amount: monthlyPayment,
      interest_payable_month: interestPayableMonth,
      principal_payable_month: principalPayableMonth,
      liquidation_factor: totalPrincipal - borrowerDeposit,
      openedOn: startTime,
      last_payment_date: startTime,
      next_payment_date: new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000),
      months_not_paid: 0,
      loan_end: loanEndDate,
      amortization_schedule,
      is_active: true,
      is_liquidated: false,
      is_repaid: false,
      is_defaulted: false,
      allowances_updated: false,
      bounce: false,
    });

    user.loans.push(loan._id);
    user.totalCapitalBorrowed = {
      chain_id: chainId,
      amount: totalPrincipal,
      asset: "BTC",
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
    console.log(
      `Processing installment paid for loan ${loanId}, index ${index}`,
    );

    // Get the loan from database
    const loan = await Loan.findOne({ loan_contract_id: loanId });
    if (!loan) {
      console.error(`Loan with contract ID ${loanId} not found`);
      return;
    }

    // Update loan payment info
    const now = new Date();
    loan.last_payment_date = now;
    loan.next_payment_date = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days later

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

const updateAllowancesAfterLoan = async (loanId, contributions) => {
  try {
    const loan = await Loan.findOne({ loan_id: loanId });
    if (!loan) {
      console.error(`Loan ${loanId} not found`);
      return;
    }

    if (loan.allowances_updated) {
      console.log(`Allowances for loan ${loanId} already updated. Skipping.`);
      return;
    }

    console.log(
      `Updating allowances for loan ${loanId} with ${contributions.length} lenders`,
    );

    for (const contribution of contributions) {
      const lenderAddress = contribution.lender;
      const contributionAmount = contribution.amount;

      const allowance = await Lend.findOne({ user_address: lenderAddress });

      if (!allowance) {
        console.error(`No allowance record found for ${lenderAddress}`);
        continue;
      }

      const currentAvailable = Number(allowance.available_amount);

      if (currentAvailable < contributionAmount) {
        console.error(
          `Lender ${lenderAddress} has insufficient allowance: available=${currentAvailable}, required=${contributionAmount}`,
        );
        continue;
      }

      allowance.available_amount = currentAvailable - contributionAmount;
      allowance.utilisedAmount =
        Number(allowance.utilisedAmount) + contributionAmount;
      allowance.updated_at = new Date();
      allowance.loans.push(loan._id);

      await allowance.save();

      console.log(
        `Updated allowance for lender ${lenderAddress}, new available: ${allowance.available_amount}, utilised: ${allowance.utilisedAmount}`,
      );
    }

    // ✅ Mark as updated
    loan.allowances_updated = true;
    await loan.save();

    console.log(`Finished updating allowances for loan ${loanId}`);
  } catch (error) {
    console.error("Error updating allowances after loan:", error);
  }
};


module.exports = {
  recordLoanEvents,
};
