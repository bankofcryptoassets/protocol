const { isLoggedIn } = require("../controllers/authController");
const {
  createLoan,
  getLoans,
  getLoanById,
  updateLoan,
  initialDetails,
} = require("../controllers/loanController");

const router = require("express").Router();

router.post("/", isLoggedIn, createLoan);
router.get("/", isLoggedIn, getLoans);
router.get("/:id", getLoanById);
router.patch("/:id", updateLoan);
router.get("/check/liquidity", isLoggedIn, initialDetails);

module.exports = router;
