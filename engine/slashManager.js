const cron = require("node-cron");
const Loan = require("../schema/LoaningSchema"); 
const User = require("../schema/UserSchema");

cron.schedule("0 0 * * *", async () => {
  try {
    const today = new Date();
    const loans = await Loan.find();

    loans.forEach(async (loan) => {
      const lastPaymentDate = new Date(loan.last_payment_date);
      const monthsDifference =
        today.getMonth() -
        lastPaymentDate.getMonth() +
        12 * (today.getFullYear() - lastPaymentDate.getFullYear());

      if (monthsDifference >= 1) {
        loan.months_not_paid += 1;

        const returnAbleAMounts = loan.lenders_capital_invested.map(
          (lender) => {
            return lender.remaining_amount;
          }
        );

        const userAddresses = loan.lenders_capital_invested.map(
          async (lender) => {
            const userId = lender.user_id;
            const user = await User.findById(userId).select("user_address");
            return user.user_address;
          }
        );

        if (loan.months_not_paid > 3) {
          // call contract with above 2 arrays and loan id
        }

        await loan.save();
      }
    });
  } catch (error) {
    console.error("Error in scheduled task:", error);
  }
});
