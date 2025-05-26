const router = require("express").Router();
const {
  LoanSummary,
  LoanAvailability,
  getBTCPrice,
  getUSDRate,
} = require("../controllers/loanInitialisationController");

router.post("/loansummary", LoanSummary);
router.get("/loanavailability", LoanAvailability);
router.get("/getbtcprice", getBTCPrice);
router.get("/getusdprice", getUSDRate);

module.exports = router;
