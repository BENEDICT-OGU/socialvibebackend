// socialvibe/backend/routes/businessRoutes.js
const express = require('express');
const businessController = require('../controllers/businessController');
const authController = require('../controllers/authController');
const router = express.Router();
// Protect all routes after this middleware
router.use(authController.protect);
router
  .route('/')
  .post(businessController.createBusiness);
router
  .route('/me')
  .get(businessController.getMyBusiness)
  .patch(businessController.updateBusiness);
module.exports = router;