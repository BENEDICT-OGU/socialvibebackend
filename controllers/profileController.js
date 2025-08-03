const User = require("../models/User");
const Post = require("../models/Post");
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { validationResult } = require('express-validator');

// Enhanced Profile Controller
module.exports = {
  /**
   * Get current user's profile
   */
  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user.id)
        .select('-password -twoFactorSecret -emailVerificationToken -passwordResetToken -passwordResetExpires')
        .populate('followers following', 'name username avatar')
        .lean();
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      // Get additional stats
      const [postsCount, followersCount, followingCount] = await Promise.all([
        Post.countDocuments({ user: user._id }),
        User.countDocuments({ following: user._id }),
        user.following?.length || 0
      ]);
      
      res.json({
        success: true,
        data: {
          ...user,
          stats: {
            posts: postsCount,
            followers: followersCount,
            following: followingCount
          }
        }
      });
    } catch (err) {
      console.error('Get profile error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },

  /**
   * Get public profile by username
   */
  getPublicProfile: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const username = req.params.username.toLowerCase().trim();
      
      const user = await User.findOne({ username })
        .select('-password -email -phone -twoFactorSecret -emailVerificationToken')
        .lean();

      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }

      // Get counts with error handling
      const [postsCount, followersCount] = await Promise.all([
        Post.countDocuments({ user: user._id }).catch(() => 0),
        User.countDocuments({ following: user._id }).catch(() => user.followers?.length || 0)
      ]);

      // Check if current user follows this profile
      let isFollowing = false;
      if (req.user?._id) {
        const currentUser = await User.findById(req.user._id);
        isFollowing = currentUser?.following?.some(id => id.equals(user._id)) || false;
      }

      // Format avatar URL
      const getAvatarUrl = (avatar) => {
        if (!avatar) return '/default-avatar.png';
        return avatar.startsWith('http') ? avatar : `${process.env.BASE_URL || ''}${avatar}`;
      };

      res.json({
        success: true,
        data: {
          user: {
            ...user,
            avatar: getAvatarUrl(user.avatar),
            coverPhoto: user.coverPhoto || '/default-cover.jpg'
          },
          stats: {
            posts: postsCount,
            followers: followersCount,
            following: user.following?.length || 0
          },
          isFollowing,
          isCurrentUser: req.user?._id?.equals(user._id) || false
        }
      });
    } catch (error) {
      console.error('Public profile error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to load profile',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Update current user profile
   */
  updateProfile: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { 
        name, 
        username, 
        bio, 
        location,
        website,
        social,
        skills,
        preferences
      } = req.body;
      
      const updates = {};
      const allowedFields = ['name', 'username', 'bio', 'location', 'website'];
      
      // Update basic fields
      allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      // Update social links
      if (social) {
        updates.social = {
          twitter: social.twitter || null,
          linkedin: social.linkedin || null,
          github: social.github || null,
          instagram: social.instagram || null
        };
      }

      // Update skills
      if (skills) {
        updates.skills = Array.isArray(skills) ? skills : [];
      }

      // Update preferences
      if (preferences) {
        updates.preferences = {
          darkMode: typeof preferences.darkMode === 'boolean' ? preferences.darkMode : false,
          notifications: {
            email: typeof preferences.notifications?.email === 'boolean' ? preferences.notifications.email : true,
            push: typeof preferences.notifications?.push === 'boolean' ? preferences.notifications.push : true
          }
        };
      }

      // Check username availability if changing
      if (username && username !== req.user.username) {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
          return res.status(400).json({
            success: false,
            error: 'Username already taken'
          });
        }
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      ).select('-password -twoFactorSecret -emailVerificationToken');

      res.json({
        success: true,
        data: updatedUser,
        message: 'Profile updated successfully'
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to update profile',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Upload profile picture with Cloudinary
   */
  uploadAvatar: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      // Upload to Cloudinary
      const result = await uploadToCloudinary(req.file.path, {
        folder: 'avatars',
        width: 300,
        height: 300,
        crop: 'fill',
        format: 'webp',
        quality: 'auto'
      });

      // Delete temporary file
      fs.unlinkSync(req.file.path);

      // Update user avatar
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: result.secure_url },
        { new: true }
      ).select('avatar name username');

      res.json({
        success: true,
        data: {
          avatar: user.avatar,
          user: {
            id: user._id,
            name: user.name,
            username: user.username
          }
        },
        message: 'Avatar uploaded successfully'
      });
    } catch (error) {
      console.error('Avatar upload error:', error);
      // Clean up temp file if still exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ 
        success: false,
        error: 'Avatar upload failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Upload cover photo with Cloudinary
   */
  uploadCoverPhoto: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: 'No file uploaded' 
        });
      }

      const result = await uploadToCloudinary(req.file.path, {
        folder: 'covers',
        width: 1500,
        height: 500,
        crop: 'fill',
        format: 'webp',
        quality: 'auto'
      });

      fs.unlinkSync(req.file.path);

      const user = await User.findByIdAndUpdate(
        req.user._id,
        { coverPhoto: result.secure_url },
        { new: true }
      ).select('coverPhoto');

      res.json({
        success: true,
        data: {
          coverPhoto: user.coverPhoto
        },
        message: 'Cover photo uploaded successfully'
      });
    } catch (error) {
      console.error('Cover photo upload error:', error);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ 
        success: false,
        error: 'Cover photo upload failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Change password
   */
  changePassword: async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');
      
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ 
          success: false,
          error: 'Current password is incorrect' 
        });
      }
      
      // Validate new password
      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
      }
      
      const hash = await bcrypt.hash(newPassword, 12);
      user.password = hash;
      await user.save();
      
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Password change failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Follow a user
   */
  followUser: async (req, res) => {
    try {
      const { userId } = req.params;
      
      if (req.user._id.equals(userId)) {
        return res.status(400).json({ 
          success: false,
          error: 'You cannot follow yourself' 
        });
      }
      
      const [userToFollow, currentUser] = await Promise.all([
        User.findById(userId),
        User.findById(req.user._id)
      ]);
      
      if (!userToFollow || !currentUser) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      // Check if already following
      if (currentUser.following.some(id => id.equals(userId))) {
        return res.status(400).json({ 
          success: false,
          error: 'Already following this user' 
        });
      }
      
      // Add to following list
      currentUser.following.push(userId);
      userToFollow.followers.push(req.user._id);
      
      await Promise.all([currentUser.save(), userToFollow.save()]);
      
      res.json({
        success: true,
        message: 'Successfully followed user',
        data: {
          followingCount: currentUser.following.length,
          followersCount: userToFollow.followers.length
        }
      });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to follow user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Unfollow a user
   */
  unfollowUser: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const [userToUnfollow, currentUser] = await Promise.all([
        User.findById(userId),
        User.findById(req.user._id)
      ]);
      
      if (!userToUnfollow || !currentUser) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      // Remove from following list
      currentUser.following = currentUser.following.filter(
        id => !id.equals(userId)
      );
      userToUnfollow.followers = userToUnfollow.followers.filter(
        id => !id.equals(req.user._id)
      );
      
      await Promise.all([currentUser.save(), userToUnfollow.save()]);
      
      res.json({
        success: true,
        message: 'Successfully unfollowed user',
        data: {
          followingCount: currentUser.following.length,
          followersCount: userToUnfollow.followers.length
        }
      });
    } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to unfollow user',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Get user's followers list with pagination
   */
  getFollowers: async (req, res) => {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const followers = await User.find({ _id: { $in: user.followers } })
        .select('name username avatar bio')
        .skip(skip)
        .limit(limit)
        .lean();
      
      const totalFollowers = user.followers.length;
      const totalPages = Math.ceil(totalFollowers / limit);
      
      res.json({
        success: true,
        data: {
          followers,
          pagination: {
            total: totalFollowers,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get followers error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get followers',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Get user's following list with pagination
   */
  getFollowing: async (req, res) => {
    try {
      const { username } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const following = await User.find({ _id: { $in: user.following } })
        .select('name username avatar bio')
        .skip(skip)
        .limit(limit)
        .lean();
      
      const totalFollowing = user.following.length;
      const totalPages = Math.ceil(totalFollowing / limit);
      
      res.json({
        success: true,
        data: {
          following,
          pagination: {
            total: totalFollowing,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Get following error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get following',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Search users by username or name
   */
  searchUsers: async (req, res) => {
    try {
      const { query } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      if (!query || query.length < 2) {
        return res.status(400).json({ 
          success: false,
          error: 'Search query must be at least 2 characters' 
        });
      }
      
      const searchRegex = new RegExp(query, 'i');
      
      const [users, total] = await Promise.all([
        User.find({
          $or: [
            { username: searchRegex },
            { name: searchRegex }
          ]
        })
        .select('name username avatar')
        .skip(skip)
        .limit(limit)
        .lean(),
        
        User.countDocuments({
          $or: [
            { username: searchRegex },
            { name: searchRegex }
          ]
        })
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Search users error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Search failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  },

  /**
   * Get suggested users to follow (excluding already followed users)
   */
  getSuggestedUsers: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 5;
      
      const currentUser = await User.findById(req.user._id);
      if (!currentUser) {
        return res.status(404).json({ 
          success: false,
          error: 'User not found' 
        });
      }
      
      const suggestedUsers = await User.aggregate([
        { $match: { 
          _id: { 
            $ne: currentUser._id,
            $nin: currentUser.following 
          } 
        }},
        { $sample: { size: limit } },
        { $project: { 
          name: 1,
          username: 1,
          avatar: 1,
          bio: 1 
        }}
      ]);
      
      res.json({
        success: true,
        data: suggestedUsers
      });
    } catch (error) {
      console.error('Get suggested users error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get suggestions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};