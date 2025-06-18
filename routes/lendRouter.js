const {
  getLendings,
  getLendingById,
  createAllowance,
  stats,
} = require("../controllers/lendingController");

const router = require("express").Router();

router.get("/", getLendings);
router.get("/:id", getLendingById);
router.post("/", createAllowance);
router.get("/stats", stats);

module.exports = router;
