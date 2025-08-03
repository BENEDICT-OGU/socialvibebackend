const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const passport = require("passport");
const { protect } = require("../middleware/auth");

// ============ 📦 LOCAL AUTH ROUTES ============
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);

// ============ 🛍️ MARKETPLACE SPECIFIC ROUTES ============
router.post("/become-seller", protect, authController.becomeSeller);

// ============ 🔐 GOOGLE OAUTH ROUTES ============
router.get(
  "/google",
  passport.authenticate("google", { 
    scope: ["profile", "email"],
    prompt: "select_account" // Forces account selection
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=google-auth-failed`,
    session: false,
  }),
  async (req, res) => {
    try {
      const token = jwt.sign(
        { 
          id: req.user._id, 
          email: req.user.email,
          role: req.user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      // Set cookie and redirect
      res.cookie('jwt', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      const redirectUrl = req.user.role === 'seller' 
        ? `${process.env.FRONTEND_URL}/seller/dashboard` 
        : `${process.env.FRONTEND_URL}/`;

      res.redirect(redirectUrl);
    } catch (err) {
      console.error("OAuth Redirect Error:", err);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=server-error`);
    }
  }
);

module.exports = router;