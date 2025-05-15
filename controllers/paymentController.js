const Payment = require("../schema/PaymentSchema");
const {
  processPaymentWithVariedLiquidationFactor,
} = require("../engine/disbursalManager");
const { processPayment } = require("../engine/paymentManager");
const Loan = require("../schema/LoaningSchema");

// const createPayment = async (req, res) => {
//   try {
//     const payment = await Payment.create({
//       user_id: req.user._id,
//       ...req.body,
//       payment_time: Date.now(),
//     });

//     await processPayment(payment._id);
//     await payment.save();

//     const disbursals = await processPaymentWithVariedLiquidationFactor(
//       req.body.loan_id,
//       req.body.payment_amount
//     );
     
//     const loan = await Loan.findById(req.body.loan_id);
//     loan.payments.push(payment._id);
//     loan.last_payment_date = Date.now();
//     loan.next_payment_date = new Date().setMonth(new Date().getMonth() + 1);
//     await loan.save();
//     const data = {
//       paymentId: payment._id,
//       loanId: payment.loan_id,
//       lenders: disbursals.lendersAddresses,
//       amounts: disbursals.lendersAmounts,
//       interests: disbursals.lendersInterest,
//       totalAmount: disbursals.totalLendersPayable,
//     };

//     res.json({
//       message: "Payment created successfully",
//       data: payment,
//       disbursals: data,
//     });
//     return res.json({ message: "Payment created successfully" });
//   } catch (error) {
//     console.log(error);
//     return res.status(500).json({ error: error.message });
//   }
// };

const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.user_id });
    return res.json({ payments });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);
    return res.json({ payment });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// const updatePayment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updated = await Payment.findByIdAndUpdate(id, req.body, {
//       new: true,
//     });
//     return res.json({ updated });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

module.exports = {
  getPayments,
  getPaymentById,
};
