const router = require('express').Router();
const {
  calculateInsurance,
  purchaseInsurance,
  cancelInsurance,
  getInsuranceDetails,
  getAllActiveInsurances
} = require('../controllers/insuranceController');

// Calculate insurance details for a loan
router.get('/calculate/:loanId', calculateInsurance);

// Purchase insurance for a loan
router.post('/purchase/:loanId', purchaseInsurance);

// Cancel insurance
router.post('/cancel/:insuranceId', cancelInsurance);

// Get insurance details for a loan
router.get('/details/:loanId', getInsuranceDetails);

// Get all active insurances
router.get('/active', getAllActiveInsurances);

module.exports = router; 