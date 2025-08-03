const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);

exports.initializePayment = async (email, amount, metadata = {}) => {
  try {
    const response = await paystack.transaction.initialize({
      email,
      amount: amount * 100, // Paystack uses kobo (multiply by 100)
      metadata,
      callback_url: process.env.PAYSTACK_CALLBACK_URL
    });
    return response.data;
  } catch (error) {
    throw new Error(`Paystack initialization error: ${error.message}`);
  }
};

exports.verifyPayment = async (reference) => {
  try {
    const response = await paystack.transaction.verify(reference);
    return response.data;
  } catch (error) {
    throw new Error(`Paystack verification error: ${error.message}`);
  }
};

// Add other Paystack methods as needed (create customer, etc.)