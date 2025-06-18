const Lend = require("../schema/LendingSchema");
const User = require("../schema/UserSchema");
const { globalUSDInvested, uniqueLenders } = require("../utils/helperStats");

// const createLending = async (req, res) => {
//   console.log("Creating Lending");
//   console.log(req.user);

//   try {
//     const lending = await Lend.create({
//       user_id: req.user._id,
//       ...req.body,
//       available_amount: req.body.lending_amount_approved,
//       openedOn: new Date(),
//       loans: [],
//       avaialble_amount: req.body.lending_amount_approved,
//     });

//     await lending.save();
//     const user = await User.findById(req.user._id);
//     user.lendings.push(lending._id);
//     user.totalCapitalLent = {
//       chain_id: req.body.chain_id,
//       asset: req.body.asset,
//       amount: req.body.lending_amount_approved,
//     };
//     await user.save();

//     const deposit = await Lend.findById(lending._id).populate("user_id loans");
//     return res.json({
//       message: "Lending created successfully",
//       deposit: deposit,
//     });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

const getLendings = async (req, res) => {
  try {
    const lendings = await Lend.find({ user_id: req.user._id }).populate(
      "user_id loans",
    );
    return res.json({ lendings });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const getLendingById = async (req, res) => {
  try {
    const { id } = req.params;
    const lending = await Lend.findById(id).populate("user_id loans");
    return res.json({ lending });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// const updateLending = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const updated = await Lend.findByIdAndUpdate(id, req.body, { new: true });
//     return res.json({ updated });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

const createAllowance = async (req, res) => {
  try {
    const { user_id, user_address, allowance_amount, duration_preference } =
      req.body;

    const existingLending = await Lend.findOne({ user_address });
    if (existingLending) {
      // Update existing allowance
      existingLending.lending_amount_approved += Number(allowance_amount);
      existingLending.available_amount += Number(allowance_amount);
      existingLending.updated_at = Date.now();

      existingLending.duration_preference = duration_preference;

      await existingLending.save();
    } else {
      // Create new allowance
      const newLending = await Lend.create({
        user_id,
        user_address,
        lending_amount_approved: allowance_amount,
        available_amount: allowance_amount,
        duration_preference,
        openedOn: new Date(),
      });

      await newLending.save();
    }

    return res.status(200).json({
      message: "Allowance created/updated successfully",
      allowance: {
        user_id,
        user_address,
        allowance_amount,
        duration_preference,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const stats = async(req, res) => {
    const totalUSDInvested = await globalUSDInvested();
    const totallenders = await uniqueLenders();
    const baseAPR = 0.05;
    const loanAPR = 0.07;

    res.status(200).json({
        totalUSDInvested,
        totallenders,
        baseAPR,
        loanAPR,
    });
}

module.exports = {
  getLendings,
  getLendingById,
  createAllowance,
  stats,
};
