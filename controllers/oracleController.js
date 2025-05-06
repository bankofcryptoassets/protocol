const { setOraclePrice } = require("../engine/OracleManager");

exports.setPrice = async (req, res) => {
  try {
    await setOraclePrice();
    return res.json({ message: "Oracle price set successfully" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};