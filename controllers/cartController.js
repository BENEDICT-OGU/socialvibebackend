const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate({
        path: 'items.productId',
        select: 'title price images sellerId',
        populate: {
          path: 'sellerId',
          select: 'username'
        }
      });

    if (!cart) {
      // Create empty cart if not exists
      const newCart = await Cart.create({ userId: req.user.id, items: [] });
      return res.status(200).json({
        success: true,
        data: newCart
      });
    }

    res.status(200).json({
      success: true,
      data: cart
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add item to cart
// @route   POST /api/cart
// @access  Private
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is in stock
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    let cart = await Cart.findOne({ userId: req.user.id });

    // If cart doesn't exist, create one
    if (!cart) {
      cart = await Cart.create({
        userId: req.user.id,
        items: [{ productId, quantity }]
      });
    } else {
      // Check if product already in cart
      const itemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (itemIndex > -1) {
        // Product exists in cart, update quantity
        cart.items[itemIndex].quantity += quantity;
      } else {
        // Product not in cart, add new item
        cart.items.push({ productId, quantity });
      }

      await cart.save();
    }

    // Populate product details
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'title price images sellerId',
        populate: {
          path: 'sellerId',
          select: 'username'
        }
      });

    res.status(200).json({
      success: true,
      data: populatedCart
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update cart item quantity
// @route   PUT /api/cart/:productId
// @access  Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if product is in stock
    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Not enough stock available' });
    }

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Check if product is in cart
    const itemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }

    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    await cart.save();

    // Populate product details
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'title price images sellerId',
        populate: {
          path: 'sellerId',
          select: 'username'
        }
      });

    res.status(200).json({
      success: true,
      data: populatedCart
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:productId
// @access  Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Filter out the item to remove
    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId
    );

    await cart.save();

    // Populate product details
    const populatedCart = await Cart.findById(cart._id)
      .populate({
        path: 'items.productId',
        select: 'title price images sellerId',
        populate: {
          path: 'sellerId',
          select: 'username'
        }
      });

    res.status(200).json({
      success: true,
      data: populatedCart
    });
  } catch (err) {
    next(err);
  }
};