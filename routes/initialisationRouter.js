const router = require("express").Router();
const {
  LoanSummary,
  LoanAvailability,
  getBTCPrice,
  getUSDRate,
  getBasisPoints,
} = require("../controllers/loanInitialisationController");

router.post("/loansummary", LoanSummary);
router.get("/loanavailability", LoanAvailability);
router.get("/getbtcprice", getBTCPrice);
router.get("/getusdprice", getUSDRate);
router.get("/getbasispoints", getBasisPoints);

module.exports = router;
