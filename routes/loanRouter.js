const { isLoggedIn } = require("../controllers/authController");
const {
  getLoans,
  getLoanById,
  initialDetails,
  matchLenders,
  getLoanByAddress,
  reminderUpdate
} = require("../controllers/loanController");

const router = require("express").Router();

router.get("/", isLoggedIn, getLoans);
router.get("/:id", getLoanById);
router.get("/address/:address", getLoanByAddress);
router.get("/check/liquidity", isLoggedIn, initialDetails);
router.post("/match", matchLenders);
router.patch("/reminder", isLoggedIn, reminderUpdate);

module.exports = router;
