// routes/mapRoutes.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

router.post("/route", async (req, res) => {
  const { start, end, mode = "driving-car" } = req.body;
  if (!start || !end) return res.status(400).json({ error: "Start and end required" });

  try {
    const orsRes = await axios.post(
      `https://api.openrouteservice.org/v2/directions/${mode}/geojson`,
      {
        coordinates: [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ],
      },
      {
        headers: {
          Authorization: process.env.ORS_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const geometry = orsRes.data.features[0].geometry;
    const summary = orsRes.data.features[0].properties.summary;
    res.json({ coordinates: geometry.coordinates, summary });
  } catch (err) {
    console.error("ORS error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch directions" });
  }
});

module.exports = router;
