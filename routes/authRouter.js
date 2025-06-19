const { getNonce, verifyUser, telegramLogin, isLoggedIn } = require("../controllers/authController");

const router = require("express").Router();

router.get("/nonce", getNonce);
router.post("/verify", verifyUser);
router.post("/telegram", isLoggedIn, telegramLogin);

module.exports = router;
