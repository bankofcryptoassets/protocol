const User = require("../schema/UserSchema");

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
    if(req.user){
        id = req.user._id;
    }else{
        id = req.params.id;
    }
    const user = await User.findById(id);
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


module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
};