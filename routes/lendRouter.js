const {
  getLendings,
  getLendingById,
  createAllowance,
} = require("../controllers/lendingController");

const router = require("express").Router();

router.get("/", getLendings);
router.get("/:id", getLendingById);
router.post("/", createAllowance);

module.exports = router;
