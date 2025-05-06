const {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
} = require("../controllers/paymentController");

const router = require("express").Router();

router.post("/", createPayment);
router.get("/", getPayments);
router.get("/:id", getPaymentById);
router.patch("/:id", updatePayment);

module.exports = router;
