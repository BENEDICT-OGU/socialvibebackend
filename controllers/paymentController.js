const ErrorResponse = require('../utils/ErrorResponse');
const paystack = require('../services/paystack');

exports.initializePayment = async (req, res, next) => {
  try {
    const { email, amount, orderId } = req.body;
    
    if (!email || !amount || !orderId) {
      return next(new ErrorResponse('Email, amount and orderId are required', 400));
    }

    const payment = await paystack.initializePayment(email, amount, {
      order_id: orderId,
      user_id: req.user.id
    });

    res.json({
      success: true,
      data: payment
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.body;
    
    if (!reference) {
      return next(new ErrorResponse('Payment reference is required', 400));
    }

    const verification = await paystack.verifyPayment(reference);

    if (!verification.status) {
      return next(new ErrorResponse('Payment verification failed', 400));
    }

    // Update your order status here
    // ...

    res.json({
      success: true,
      data: verification
    });
  } catch (err) {
    next(err);
  }
};
exports.initializeCheckout = async (req, res, next) => {
  try {
    const { items, sellerId } = req.body;
    
    // 1. Get seller details
    const seller = await User.findById(sellerId);
    if (!seller?.sellerProfile?.paystackSubAccountCode) {
      return next(new ErrorResponse('Seller payment account not setup', 400));
    }

    // 2. Calculate total amount
    const amount = calculateOrderTotal(items); // Implement your logic

    // 3. Initialize payment with SUBACCOUNT parameter
    const payment = await paystack.transaction.initialize({
      email: req.user.email,
      amount: amount * 100, // in kobo
      subaccount: seller.sellerProfile.paystackSubAccountCode,
      bearer: "subaccount", // Seller pays transaction fee
      metadata: {
        buyerId: req.user._id,
        sellerId: sellerId,
        itemIds: items.map(i => i._id)
      }
    });

    res.json({ authorizationUrl: payment.data.authorization_url });
  } catch (error) {
    next(error);
  }
};
exports.handlePaymentWebhook = async (req, res) => {
  // Verify Paystack signature first
  if (!verifyPaystackSignature(req)) return res.sendStatus(400);

  const { event, data } = req.body;

  if (event === 'charge.success') {
    // 1. Update order status
    await Order.create({
      buyer: data.metadata.buyerId,
      seller: data.metadata.sellerId,
      items: data.metadata.itemIds,
      amount: data.amount / 100,
      status: 'completed',
      paymentReference: data.reference
    });

    // 2. Update seller's available balance (minus commission)
    const seller = await User.findById(data.metadata.sellerId);
    const marketplaceCut = data.amount * (process.env.MARKETPLACE_COMMISSION / 100);
    const sellerEarnings = data.amount - marketplaceCut;
    
    seller.sellerProfile.settlementBalance += sellerEarnings;
    await seller.save();
  }

  res.sendStatus(200);
};
exports.requestPayout = async (req, res, next) => {
  try {
    const seller = await User.findById(req.user._id);
    
    if (seller.sellerProfile.settlementBalance < 1000) { // Minimum ₦1000
      return next(new ErrorResponse('Minimum payout amount is ₦1000', 400));
    }

    // Initiate transfer
    const transfer = await paystack.transfer.create({
      source: 'balance',
      amount: seller.sellerProfile.settlementBalance * 100,
      recipient: seller.sellerProfile.paystackSubAccountCode,
      reason: `Marketplace payout for ${seller.businessName}`
    });

    // Reset balance
    seller.sellerProfile.settlementBalance = 0;
    await seller.save();

    res.json({ message: 'Payout initiated', transfer });
  } catch (error) {
    next(error);
  }
};