const {
  getPayments,
  getPaymentById,
} = require("../controllers/paymentController");

const router = require("express").Router();

router.get("/", getPayments);
router.get("/:id", getPaymentById);

module.exports = router;
