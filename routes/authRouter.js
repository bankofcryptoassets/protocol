const { getNonce, verifyUser } = require("../controllers/authController");

const router = require("express").Router();

router.get("/nonce", getNonce);
router.post("/verify", verifyUser);

module.exports = router;
