const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ErrorResponse = require('../utils/ErrorResponse');

const protect = async (req, res, next) => {
  let token;

  // Get token from header or cookies
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next(ErrorResponse.unauthorized('No token provided'));
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password -__v');
    
    if (!user) {
      return next(ErrorResponse.notFound('User not found'));
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat)) {
      return next(ErrorResponse.unauthorized('User recently changed password. Please log in again.'));
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (err) {
    return next(ErrorResponse.unauthorized('Invalid token'));
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        ErrorResponse.forbidden(
          `User role ${req.user.role} is not authorized to access this route`
        )
      );
    }
    next();
  };
};

// Specific middleware for sellers
const sellerOnly = (req, res, next) => {
  if (req.user.role !== 'seller') {
    return next(ErrorResponse.forbidden('Only sellers can access this route'));
  }
  next();
};

// Specific middleware for verified sellers
const verifiedSellerOnly = async (req, res, next) => {
  if (req.user.role !== 'seller' || !req.user.sellerVerified) {
    return next(ErrorResponse.forbidden('Only verified sellers can access this route'));
  }
  next();
};

module.exports = {
  protect,
  authorize,
  sellerOnly,
  verifiedSellerOnly
};