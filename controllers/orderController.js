const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private
exports.getOrders = async (req, res, next) => {
  try {
    let query;
    
    if (req.user.role === 'seller') {
      // For sellers, get orders of their products
      query = Order.find({ sellerId: req.user.id })
        .populate('userId', 'username email')
        .populate({
          path: 'items.productId',
          select: 'title images'
        });
    } else {
      // For regular users, get their own orders
      query = Order.find({ userId: req.user.id })
        .populate('sellerId', 'username')
        .populate({
          path: 'items.productId',
          select: 'title images'
        });
    }

    const orders = await query.sort('-createdAt');

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Private
exports.getOrder = async (req, res, next) => {
  try {
    let order = await Order.findById(req.params.id)
      .populate('userId', 'username email')
      .populate('sellerId', 'username')
      .populate({
        path: 'items.productId',
        select: 'title price images'
      });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Make sure user is order owner or seller
    if (order.userId._id.toString() !== req.user.id && order.sellerId._id.toString() !== req.user.id) {
      return res.status(401).json({ message: 'Not authorized to access this order' });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new order (checkout)
// @route   POST /api/orders/checkout
// @access  Private
exports.checkout = async (req, res, next) => {
  try {
    // Get user cart
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate({
        path: 'items.productId',
        select: 'title price sellerId stock'
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'No items in cart' });
    }

    // Check stock and calculate total
    let total = 0;
    const orderItems = [];
    const sellerId = cart.items[0].productId.sellerId; // Assuming single seller for simplicity

    for (const item of cart.items) {
      const product = item.productId;

      // Check stock
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Not enough stock for ${product.title}`
        });
      }

      // Calculate item total
      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      // Add to order items
      orderItems.push({
        productId: product._id,
        quantity: item.quantity,
        price: product.price
      });

      // Update product stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      total,
      paymentMethod: req.body.paymentMethod || 'credit_card',
      shippingAddress: req.body.shippingAddress,
      sellerId
    });

    // Clear cart
    cart.items = [];
    await cart.save();

    // Populate order data
    const populatedOrder = await Order.findById(order._id)
      .populate('userId', 'username email')
      .populate('sellerId', 'username')
      .populate({
        path: 'items.productId',
        select: 'title price images'
      });

    res.status(201).json({
      success: true,
      data: populatedOrder
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Seller/Admin)
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check if user is seller or admin
    if (order.sellerId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(401).json({ message: 'Not authorized to update this order' });
    }

    order.status = status;
    
    // Add tracking number if provided and status is shipped
    if (status === 'shipped' && req.body.trackingNumber) {
      order.trackingNumber = req.body.trackingNumber;
    }

    await order.save();

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (err) {
    next(err);
  }
};