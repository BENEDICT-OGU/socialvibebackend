const express = require("express");
const router = express.Router();
const {upload} = require("../middleware/upload"); // multer config
// const auth = require("../middleware/auth");
const {
  uploadStory,
  getUserStories,
} = require("../controllers/storyController");

router.post("/", upload.single("media"), uploadStory);
router.get("/:userId", getUserStories);

module.exports = router;
