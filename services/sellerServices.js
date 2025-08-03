const paystack = require('paystack-api')(process.env.PAYSTACK_SECRET_KEY);

exports.createSubAccount = async (userData) => {
  try {
    const response = await paystack.subaccount.create({
      business_name: userData.businessName,
      settlement_bank: userData.bankAccount.bankCode,
      account_number: userData.bankAccount.accountNumber,
      percentage_charge: process.env.MARKETPLACE_COMMISSION, // Your cut (e.g., 10%)
      primary_account_email: process.env.ADMIN_EMAIL // Your Paystack account email
    });
    
    return response.data;
  } catch (error) {
    console.error('Paystack subaccount error:', error);
    throw new Error('Failed to create seller payment account');
  }
};