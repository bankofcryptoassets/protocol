const { getLendings, getLendingById } = require("../controllers/lendingController");

const router = require("express").Router();

router.get("/", getLendings);
router.get("/:id", getLendingById);

module.exports = router;