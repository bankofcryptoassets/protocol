const { createLending, getLendings, getLendingById, updateLending } = require("../controllers/lendingController");

const router = require("express").Router();

router.post("/", createLending);
router.get("/", getLendings);
router.get("/:id", getLendingById);
router.patch("/:id", updateLending);

module.exports = router;