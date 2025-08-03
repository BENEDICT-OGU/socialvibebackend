const express = require('express');
const router = express.Router();
const { protect, sellerOnly, authorize } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// @desc    Initialize Paystack payment
// @route   POST /api/payments/initialize
// @access  Private
router.post('/initialize', protect, paymentController.initializePayment);

// @desc    Verify Paystack payment
// @route   GET /api/payments/verify/:reference
// @access  Private
router.get('/verify/:reference', protect, paymentController.verifyPayment);

// @desc    Paystack webhook handler
// @route   POST /api/payments/webhook
// @access  Public (called by Paystack)
router.post('/webhook', paymentController.handleWebhook);

// @desc    Create transfer recipient (for seller payouts)
// @route   POST /api/payments/recipient
// @access  Private, Seller only
router.post('/recipient', protect, sellerOnly, paymentController.createTransferRecipient);

// @desc    Initiate transfer to seller
// @route   POST /api/payments/transfer
// @access  Private, Admin only
router.post('/transfer', protect, authorize('admin'), paymentController.initiateTransfer);

module.exports = router;