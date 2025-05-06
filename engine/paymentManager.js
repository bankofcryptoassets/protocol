const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");
const Payment = require("../schema/PaymentSchema");

async function processPayment(paymentId) {
  try {
    // Retrieve the payment and loan details
    const payment = await Payment.findById(paymentId).populate("loan_id");
    const loan = await Loan.findById(payment.loan_id).populate(
      "lenders_capital_invested.user_id"
    );

    if (!payment || !loan) {
      throw new Error("Payment or Loan not found");
    }

    const { payment_amount } = payment;
    const interestRate = loan.interest_rate;

    // Separate interest and principal from the payment amount
    const interestAmount = (payment_amount * interestRate) / 100;
    const principalAmount = payment_amount - interestAmount;

    // Calculate total lenders' capital to determine each lender's share
    const totalLendersCapital = loan.lenders_capital_invested.reduce(
      (acc, lender) => acc + lender.amount,
      0
    );

    // Distribute principal and interest to lenders based on their share
    const lendersDistribution = loan.lenders_capital_invested.map((lender) => {
      const lenderShare = lender.amount / totalLendersCapital;

      // Calculate lender's portion of the principal and interest
      const lenderPrincipal = principalAmount * lenderShare;
      const lenderInterest = interestAmount * lenderShare;

      // Update lender's received amounts in the loan schema
      lender.amount_received = (lender.amount_received || 0) + lenderPrincipal;
      lender.received_interest =
        (lender.received_interest || 0) + lenderInterest;
      lender.total_received =
        (lender.total_received || 0) + lenderPrincipal + lenderInterest;

      return {
        lend_id: lender.lend_id,
        principal: lenderPrincipal,
        interest: lenderInterest,
        total_amount: lenderPrincipal + lenderInterest,
      };
    });

    // Update the loan's data with new lender amounts
    loan.lenders_capital_invested = loan.lenders_capital_invested.map(
      (lender, index) => ({
        ...lender.toObject(),
        ...lendersDistribution[index],
      })
    );

    // // Save the updated loan information
    // await loan.save();

    // Update the payment record with calculated amounts for each lender
    payment.amount_to_lenders = lendersDistribution.map((distribution) => ({
      lend_id: distribution.lend_id,
      amount: distribution.principal,
    }));
    payment.interest_to_lenders = lendersDistribution.map((distribution) => ({
      lend_id: distribution.lend_id,
      amount: distribution.interest,
    }));
    payment.total_to_lenders = lendersDistribution.map((distribution) => ({
      lend_id: distribution.lend_id,
      amount: distribution.total_amount,
    }));

    // Save the updated payment record
    await payment.save();

    console.log(
      "Payment processed, with principal and interest separated successfully."
    );
  } catch (error) {
    console.error("Error processing payment:", error);
  }
}

module.exports = { processPayment };
