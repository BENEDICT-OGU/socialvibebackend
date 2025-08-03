// socialvibe/backend/models/Business.js
const mongoose = require('mongoose');
const validator = require('validator');

const businessSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User ',
    required: [true, 'Business must belong to a user'],
    unique: true
  },
  businessName: {
    type: String,
    required: [true, 'Please provide your business name'],
    trim: true,
    maxlength: [50, 'Business name cannot exceed 50 characters']
  },
  businessType: {
    type: String,
    required: [true, 'Please specify your business type'],
    enum: {
      values: ['fashion', 'electronics', 'home', 'food', 'beauty', 'other'],
      message: 'Invalid business type'
    }
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  logo: {
    type: String,
    default: 'default-business.jpg'
  },
  coverImage: {
    type: String
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  contact: {
    phone: {
      type: String,
      validate: {
        validator: function(v) {
          return /^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s\./0-9]*$/.test(v);
        },
        message: 'Invalid phone number'
      }
    },
    website: {
      type: String,
      validate: [validator.isURL, 'Please provide a valid URL']
    }
  },
  socialMedia: {
    facebook: String,
    instagram: String,
    twitter: String
  },
  verificationStatus: {
    type: String,
    enum: ['unverified', 'pending', 'verified'],
    default: 'unverified'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Business', businessSchema);
