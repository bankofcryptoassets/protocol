const mongoose = require("mongoose");
const Lend = require("./LendingSchema");

const BorrowingSchema = new mongoose.Schema({
  loan_id: { type: String, required: true },
  user_id: { type: mongoose.Types.ObjectId, required: true, ref: "User" },
  user_address: { type: String, required: true },
  loan_amount: { type: Number, required: true },
  up_front_payment: { type: Number, required: true },
  total_amount_payable: { type: Number, required: true },

  remaining_amount: { type: Number, required: true },
  collateral: { type: Number, required: true }, // USDC or USDT
  asset: { type: String, required: true }, // BTC, ETH
  asset_borrowed: { type: Number, required: true }, // amount of BTC, ETH borrowed
  asset_remaining: { type: Number, required: true }, // amount of BTC, ETH remaining
  asset_price: { type: Number, required: true }, // price of BTC, ETH loan opened at
  asset_released_per_month: { type: Number, required: true }, // amount of BTC, ETH released per month

  chain_id: { type: Number, required: true },
  interest_rate: { type: Number, required: true },
  loan_duration: { type: Number, required: true },
  number_of_monthly_installments: { type: Number, required: true },
  interest: { type: Number, required: true },
  monthly_payable_amount: { type: Number, required: true },
  interest_payable_month: { type: Number, required: true },
  principal_payable_month: { type: Number, required: true },
  liquidation_factor: { type: Number, required: true },
  lends: [{ type: mongoose.Types.ObjectId, ref: "Lend" }],
  receivable_amount_By_lenders: [{ type: Number }],
  receivable_interest_by_lenders: { type: Number },
  payments: [{ type: mongoose.Types.ObjectId, ref: "Payment" }],
  openedOn: { type: Date, required: true },
  lenders_capital_invested: [
    {
      lend_id: { type: mongoose.Types.ObjectId, ref: "Lend" },
      user_id: { type: mongoose.Types.ObjectId, ref: "User" },
      user_address: { type: String },
      amount: { type: Number },
      amount_received: { type: Number, default: 0 },
      received_interest: { type: Number, default: 0 },
      total_received: { type: Number, default: 0 },
      remaining_amount: { type: Number },
    },
  ],
  receivable_amount_monthly_by_lenders: [
    {
      lend_id: { type: mongoose.Types.ObjectId, ref: "Lend" },
      user_id: { type: mongoose.Types.ObjectId, ref: "User" },
      amount: { type: Number },
      interest: { type: Number },
      total_amount: { type: Number },
      remaining_amount: { type: Number },
    },
  ],
  withdrawable_by_user: [
    {
      user_id: { type: mongoose.Types.ObjectId, ref: "User" },
      amount: { type: Number },
    },
  ],
  last_payment_date: { type: Date, required: true },
  next_payment_date: { type: Date, required: true },
  months_not_paid: { type: Number, required: true },
  bounce: { type: Boolean },
  loan_end: { type: Date, required: true },
  amortization_schedule: [
    {
      duePrincipal: { type: Number, required: true },
      dueInterest: { type: Number, required: true },
      paid: { type: Boolean, required: true },
    },
  ],
  liquidation_price: { type: Number },
  is_active: { type: Boolean, required: true },
  is_liquidated: { type: Boolean, default: false },
  is_repaid: { type: Boolean, default: false },
  is_defaulted: { type: Boolean, default: false },
});

const Loan = mongoose.model("Loan", BorrowingSchema);

module.exports = Loan;
