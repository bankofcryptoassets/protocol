const insuranceService = require('../services/insuranceService');

exports.calculateInsurance = async (req, res) => {
  try {
    const { loanId } = req.params;
    const insuranceDetails = await insuranceService.calculateInsuranceDetails(loanId);
    res.status(200).json({
      status: 'success',
      data: insuranceDetails
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.purchaseInsurance = async (req, res) => {
  try {
    const { loanId } = req.params;
    const { userId, userAddress } = req.body;
    
    const insurance = await insuranceService.purchaseInsurance(loanId, userId, userAddress);
    res.status(200).json({
      status: 'success',
      data: insurance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.cancelInsurance = async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const insurance = await insuranceService.cancelInsurance(insuranceId);
    res.status(200).json({
      status: 'success',
      data: insurance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getInsuranceDetails = async (req, res) => {
  try {
    const { loanId } = req.params;
    const insurance = await insuranceService.getInsuranceByLoanId(loanId);
    res.status(200).json({
      status: 'success',
      data: insurance
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

exports.getAllActiveInsurances = async (req, res) => {
  try {
    const insurances = await insuranceService.getActiveInsurances();
    res.status(200).json({
      status: 'success',
      data: insurances
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}; 