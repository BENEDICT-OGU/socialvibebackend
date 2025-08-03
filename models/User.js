const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, unique: true, required: true },
  phone: { type: String, max: 14, trim: true, unique: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  avatar: String,
  bio: { type: String, maxlength: 200 },
  coverPhoto: String,
  social: {
    twitter: String,
    linkedin: String,
    github: String,
    instagram: String,
    website: String
  },
  skills: [String],
  darkMode: { type: Boolean, default: false },
  notificationsEnabled: { type: Boolean, default: true },
  googleId: { type: String, unique: true, sparse: true },
  isBanned: { type: Boolean, default: false },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: String,
  acceptedTerms: { type: Boolean, default: false },
  role: { 
    type: String, 
    enum: ['user', 'seller', 'admin'], 
    default: 'user' 
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastActive: Date,
  privacySettings: {
    profileVisibility: { type: String, enum: ['public', 'private'], default: 'public' },
    activityStatus: { type: Boolean, default: true }
  },
  points: {
    type: Number,
    default: 0,
    min: 0,
    index: true
  },
  // Add to your User schema
sellerProfile: {
  isVerified: { type: Boolean, default: false },
  businessName: String,
  bankAccount: {
    accountNumber: String,
    bankCode: String,
    bankName: String
  },
  paystackSubAccountCode: String, // Stores Paystack sub-account ID
  settlementBalance: { type: Number, default: 0 } // Available for withdrawal
},
  // Marketplace specific fields
  stripeAccountId: String, // For seller payments
  sellerRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  sellerSince: Date,
  shippingAddress: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  billingAddress: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.emailVerificationToken;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.twoFactorSecret;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Virtual for follower/following counts
userSchema.virtual('followerCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// Method to follow/unfollow users
userSchema.methods.follow = async function(userId) {
  if (!this.following) this.following = [];
  if (!this.following.includes(userId)) {
    this.following.push(userId);
    await this.save();
  }
};

userSchema.methods.unfollow = async function(userId) {
  if (!this.following) this.following = [];
  this.following = this.following.filter(id => id.toString() !== userId.toString());
  await this.save();
};

// Marketplace specific methods
userSchema.methods.becomeSeller = async function() {
  if (this.role === 'user') {
    this.role = 'seller';
    this.sellerSince = new Date();
    await this.save();
  }
};

// Add to your existing User model
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};
module.exports = mongoose.model("User", userSchema);