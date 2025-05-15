const { isLoggedIn } = require("../controllers/authController");
const {
  getLoans,
  getLoanById,
  initialDetails,
} = require("../controllers/loanController");

const router = require("express").Router();

router.get("/", isLoggedIn, getLoans);
router.get("/:id", getLoanById);
router.get("/check/liquidity", isLoggedIn, initialDetails);

module.exports = router;
