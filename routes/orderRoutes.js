const express = require('express');
const {
  getOrders,
  getOrder,
  checkout,
  updateOrderStatus
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.route('/')
  .get(protect, getOrders);

router.route('/:id')
  .get(protect, getOrder);

router.post('/checkout', protect, checkout);
router.put('/:id/status', protect, authorize('seller', 'admin'), updateOrderStatus);

module.exports = router;