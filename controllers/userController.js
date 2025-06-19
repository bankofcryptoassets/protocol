const User = require("../schema/UserSchema");
const Loan = require("../schema/LoaningSchema");
const Payment = require("../schema/PaymentSchema");
const Lend = require("../schema/LendingSchema");

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    let id;
    if (req.user) {
      id = req.user._id;
    } else {
      id = req.params.id;
    }
    const user = await User.findById(id).populate(
      "lends loans payments withdraws",
    );
    return res.json({ user });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await User.findByIdAndUpdate(id, req.body, { new: true });
    return res.json({ updated });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getUserDashboard = async (req, res) => {
  try {
    const { user_address } = req.query;
    if (!user_address)
      return res.status(400).json({ error: "User address is required" });

    const user = await User.findOne({ user_address })
      .populate({ path: "loans", model: Loan })
      .populate({ path: "payments", model: Payment })
      .populate({ path: "lendings", model: Lend });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Calculate totals
    let totalLent = 0;
    let totalInterestEarned = 0;
    let totalReturns = 0;
    let totalBorrowed = 0;

    for (const lend of user.lendings) {
      totalLent += lend.amount || 0;
      totalInterestEarned += lend.received_interest || 0;
      totalReturns += lend.total_received || 0;
    }

    for (const loan of user.loans) {
      totalBorrowed += loan.loan_amount || 0;
    }

    const dashboard = {
      user_address: user.user_address,
      loans: user.loans,
      lendings: user.lendings,
      payments: user.payments,
      stats: {
        totalLent,
        totalInterestEarned,
        totalReturns,
        totalBorrowed,
      },
    };

    res.json(dashboard);
  } catch (err) {
    console.error("Error in getUserDashboard:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getTelegramId = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ telegramId: user.telegramId });
  } catch (err) {
    console.error("Error in getTelegramId:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  getUserDashboard,
  getTelegramId,
};
