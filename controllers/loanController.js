const { ethers, toBigInt } = require("ethers");
const { manageLiquidity } = require("../engine/liquidityManager");
const Lend = require("../schema/LendingSchema");
const Loan = require("../schema/LoaningSchema");
const User = require("../schema/UserSchema");
const { getLiquidity } = require("../utils/getLiquidity");
const { matchLendersForLoan } = require("../utils/matchlenders");

// const createLoan = async (req, res) => {
//   console.log(req.body);
//   try {
//     const loan = await Loan.create({
//       user_id: req.user._id,
//       ...req.body,
//       liquidation_factor: req.body.loan_amount - req.body.upFrontAmount,
//       remaining_amount: req.body.loan_amount,
//       asset_remaining: req.body.asset_borrowed,
//       asset_released_per_month:
//         req.body.asset_borrowed / req.body.number_of_monthly_installments,

//       monthly_payable_amount:
//         req.body.total_amount_payable / req.body.number_of_monthly_installments,
//       interest_payable_month:
//         req.body.interest / req.body.number_of_monthly_installments,
//       principal_payable_month:
//         req.body.loan_amount / req.body.number_of_monthly_installments,
//       liquidation_factor: req.body.loan_amount - req.body.up_front_payment,
//       openedOn: new Date(),
//       last_payment_date: new Date(),
//       next_payment_date: new Date().setMonth(new Date().getMonth() + 1),
//       loan_end: new Date(Date.now() + req.body.loan_duration * 1000),
//       months_not_paid: 0,
//     });

//     const user = await User.findById(req.user._id);
//     user.loans.push(loan._id);
//     user.totalCapitalBorrowed = {
//       chain_id: req.body.chain_id,
//       amount: req.body.collateral,
//       asset: req.body.asset,
//     };

//     // run match engine
//     const matchingEngine = await manageLiquidity(loan._id);
//     // update lenders lentAmount
//     // call smart contract to open a loan
//     const lendingDetails = [
//       {
//         loanId: loan._id,
//         ...matchingEngine,
//         totalAmount: loan.loan_amount,
//         loanDuration: loan.loan_duration,
//         startDate: loan.openedOn,
//         endDate: loan.loan_end,
//         monthsNotPaid: loan.months_not_paid,
//         upFrontAmount: loan.up_front_payment,
//       },
//     ];

//     // things needed for contract : loan Id, lending details arrays, loanduration, interest rate, loan amount
//     await loan.save();
//     await user.save();
//     const createdLoan = await Loan.findById(loan._id).populate("lends user_id");
//     return res.json({
//       message: "Loan created successfully",
//       lendingDetails,
//       loan: createdLoan,
//     });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ error: error.message });
//   }
// };

const getLoans = async (req, res) => {
  console.log(req.user);
  try {
    const loans = await Loan.find({ user_id: req.user._id }).populate(
      "lends user_id",
    );
    return res.json({ loans });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getLoanById = async (req, res) => {
  try {
    let loan;
    const { id } = req.params;
    loan = await Loan.findOne({ loan_id: id });
    if (!loan) {
      loan = await Loan.findById(id);
    }
    return res.json({ loan });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// const updateLoan = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updated = await Loan.findByIdAndUpdate(id, req.body, { new: true });
//     return res.json({ updated });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

const initialDetails = async (req, res) => {
  try {
    const { duration, amount } = req.query;
    // fetch available liquidity
    const totalAvailableLiquidity = await getLiquidity(duration, req.user._id);

    console.log("totalAvailableLiquidity", totalAvailableLiquidity);
    if (totalAvailableLiquidity < amount) {
      return res.json({ message: "Insufficient liquidity", success: false });
    }
    return res.json({
      message: "Liquidity available",
      success: true,
      totalAvailableLiquidity,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const matchLenders = async (req, res) => {
  try {
    const { loan_amount, borrower_address, interest_rate, duration_months } =
      req.body;

    console.log("Matching lenders for loan amount:", loan_amount);

    const loanAmountBN = loan_amount;
    const availableAllowances = await Lend.find({
      user_address: { $ne: borrower_address.toLowerCase() }, // Exclude borrower
      lending_amount_approved: { $gt: "0" },
    }).sort({ lending_amount_approved: -1 });

    console.log("Available Allowances:", availableAllowances);

    if (availableAllowances.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No available lenders found",
      });
    }

    const matchResult = matchLendersForLoan(
      availableAllowances,
      loanAmountBN,
      interest_rate,
      duration_months,
    );

    if (!matchResult.success) {
      return res.status(404).json({
        success: false,
        message: "Not enough liquidity available to fund this loan",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Lenders matched successfully",
      data: {
        matched_lenders: matchResult.lenders,
        total_amount_matched: matchResult.totalMatched,
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getLoans,
  getLoanById,
  initialDetails,
  matchLenders,
};
