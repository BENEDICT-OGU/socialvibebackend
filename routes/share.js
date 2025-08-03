const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { sharePost } = require("../controllers/shareController");

router.post("/share", protect, sharePost);

module.exports = router;
