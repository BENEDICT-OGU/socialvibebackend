const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendEmail } = require("../utils/emailService");
const sellerService = require("../services/sellerServices");

// Helper to generate a unique username
async function generateUniqueUsername(name) {
  const base = name.replace(/\s+/g, '').toLowerCase();
  let username = base + Math.floor(1000 + Math.random() * 9000);
  while (await User.findOne({ username })) {
    username = base + Math.floor(1000 + Math.random() * 9000);
  }
  return username;
}

exports.register = async (req, res) => {
  try {
    const { name, email, phone, password, avatar, acceptedTerms, role, 
            businessName, accountNumber, bankCode, bankName } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone || !password || !acceptedTerms) {
      return res.status(400).json({ 
        success: false,
        message: "All fields and terms acceptance are required." 
      });
    }

    // Check for existing user
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ 
        success: false,
        message: "Email already in use." 
      });
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      return res.status(400).json({ 
        success: false,
        message: "Phone already in use." 
      });
    }

    // Additional validation for sellers
    if (role === 'seller') {
      if (!businessName || !accountNumber || !bankCode) {
        return res.status(400).json({ 
          success: false,
          message: "Business details required for sellers" 
        });
      }
    }

    // Generate username and hash password
    const username = await generateUniqueUsername(name);
    const hash = await bcrypt.hash(password, 10);

    // Base user object
    const userData = {
      name,
      email,
      phone,
      password: hash,
      avatar,
      username,
      acceptedTerms,
      emailVerified: true,
      role: role === 'seller' ? 'seller' : 'user'
    };

    // Handle seller-specific setup
    if (role === 'seller') {
      // Create Paystack sub-account
      const subAccount = await sellerService.createSubAccount({
        businessName,
        bankAccount: { accountNumber, bankCode }
      });

      userData.sellerProfile = {
        businessName,
        bankAccount: {
          accountNumber,
          bankCode,
          bankName: bankName || ''
        },
        paystackSubAccountCode: subAccount.subaccount_code,
        isVerified: false
      };
      userData.sellerSince = new Date();
    }

    // Create user
    const user = await User.create(userData);

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRES_IN || "7d" 
    });

    // Return sanitized user data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    res.status(201).json({
      success: true,
      token,
      user: userResponse,
      message: "Registration successful."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: err.message || "Server error" 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ 
        success: false,
        message: "All fields are required." 
      });
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { phone: emailOrPhone }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials." 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false,
        message: "Invalid credentials." 
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { 
      expiresIn: process.env.JWT_EXPIRES_IN || "7d" 
    });

    // Return sanitized user data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    res.json({
      success: true,
      token,
      user: userResponse,
      message: "Login successful."
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: err.message || "Server error" 
    });
  }
};

exports.becomeSeller = async (req, res) => {
  try {
    const { businessName, accountNumber, bankCode, bankName } = req.body;
    
    if (!businessName || !accountNumber || !bankCode) {
      return res.status(400).json({ 
        success: false,
        message: "Business details are required" 
      });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found." 
      });
    }

    if (user.role === 'seller') {
      return res.status(400).json({ 
        success: false,
        message: "User is already a seller." 
      });
    }

    // Create Paystack sub-account
    const subAccount = await sellerService.createSubAccount({
      businessName,
      bankAccount: { accountNumber, bankCode }
    });

    // Update user to seller
    user.role = 'seller';
    user.sellerSince = new Date();
    user.sellerProfile = {
      businessName,
      bankAccount: {
        accountNumber,
        bankCode,
        bankName: bankName || ''
      },
      paystackSubAccountCode: subAccount.subaccount_code,
      isVerified: false
    };
    await user.save();

    // Return sanitized user data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.passwordResetToken;
    delete userResponse.passwordResetExpires;

    res.json({
      success: true,
      user: userResponse,
      message: "You are now a seller!"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: err.message || "Server error" 
    });
  }
};
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const message = `
      <h1>Password Reset</h1>
      <p>Please reset your password by clicking the link below:</p>
      <a href="${resetUrl}">${resetUrl}</a>
    `;
    await sendEmail({
      to: email,
      subject: "Password Reset Request",
      html: message,
    });

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token and new password are required" });

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
