// config/passport.js

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;

        if (!email) {
          return done(new Error("No email found in Google profile"), null);
        }

        let user = await User.findOne({ googleId });

        if (!user) {
          // Check if user exists by email to avoid duplicate emails
          const existingEmailUser = await User.findOne({ email });

          if (existingEmailUser) {
            // If user exists with same email, just link Google ID
            existingEmailUser.googleId = googleId;
            await existingEmailUser.save();
            return done(null, existingEmailUser);
          }

          user = await User.create({
            name,
            email,
            googleId,
            username: email.split("@")[0],
            emailVerified: true,
          });
        }

        return done(null, user);
      } catch (err) {
        console.error("Google OAuth Error:", err);
        done(err, null);
      }
    }
  )
);

// Optional: for session use; not needed if using JWT only
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
