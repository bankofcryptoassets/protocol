const { getRate } = require("../utils/getPrice");
const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");

async function checkLiquidations() {
  const price = await getRate();

  const loans = await Loan.find().populate(
    "lenders_capital_invested.user_id",
    "user_address"
  );

  const threshold = price * 1.0005; // +0.05% of the price

  const remainingAmountsArray = [];
  const userAddressesArray = [];
  loans.forEach(async (loan) => {
    if (loan.liquidation_factor >= threshold) {
      loan.loanBounce = true;
      loan.loan_end = new Date();
      loan.save();

      for (const lender of loan.lenders_capital_invested) {
        remainingAmountsArray.push(lender.remaining_amount);
      }

      for (const lender of loan.lends) {
        const user = await User.findById(lender.user_id);
        userAddressesArray.push(user.user_address);
        for (investment of user.investments) {
          if (investment.loan_id === loan._id) {
            investment.amount = 0;
          }
          await user.save();
        }
      }
      slash(remainingAmountsArray, userAddressesArray, loan._id);
      // call slash with loan id, above arrays
    }
  });
}

function slash(remainingAmountsArray, userAddressesArray, loanId) {
  // Implement the logic to handle the loan liquidation
  // call contract
  console.log(`Loan ${loanId} has been liquidated.`);
}

module.exports = { checkLiquidations };
