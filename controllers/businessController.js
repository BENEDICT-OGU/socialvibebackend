// socialvibe/backend/controllers/businessController.js
const Business = require('../models/Business');
// const AppError = require('../utils/appError');
// const catchAsync = require('../utils/catchAsync');

// @desc    Create business profile
// @route   POST /api/v1/business
exports.createBusiness = catchAsync(async (req, res, next) => {
  const existingBusiness = await Business.findOne({ user: req.user.id });
  if (existingBusiness) {
    return next(new AppError('User  already has a business profile', 400));
  }

  const businessData = {
    user: req.user.id,
    ...req.body
  };

  const business = await Business.create(businessData);

  res.status(201).json({
    status: 'success',
    data: {
      business
    }
  });
});

// @desc    Get current user's business profile
// @route   GET /api/v1/business/me
exports.getMyBusiness = catchAsync(async (req, res, next) => {
  const business = await Business.findOne({ user: req.user.id });

  if (!business) {
    return next(new AppError('No business found for this user', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      business
    }
  });
});

// @desc    Update business profile
// @route   PATCH /api/v1/business/me
exports.updateBusiness = catchAsync(async (req, res, next) => {
  const business = await Business.findOneAndUpdate(
    { user: req.user.id },
    req.body,
    {
      new: true,
      runValidators: true
    }
  );

  if (!business) {
    return next(new AppError('No business found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      business
    }
  });
});
