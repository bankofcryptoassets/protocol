const { getNonce, verifyUser, telegramLogin, isLoggedIn } = require("../controllers/authController");
const {
    googleAuthCallback,
    googleAuthRedirect,
    addEmailToWaitlist
} = require('../controllers/WaitlistController');

const router = require("express").Router();

router.get("/nonce", getNonce);
router.post("/verify", verifyUser);
router.post("/telegram", isLoggedIn, telegramLogin);


// Redirect to Google OAuth
router.get('/google', googleAuthRedirect);
// Handle Google OAuth callback
router.get('/google/callback', googleAuthCallback);

router.post('/waitlist', addEmailToWaitlist);

module.exports = router;
