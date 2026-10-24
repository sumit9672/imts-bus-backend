const express = require("express");
const router = express.Router();
const Bus = require("../models/Bus");

// १. Get all buses
router.get("/", async (req, res) => {
  try {
    const { source, destination } = req.query;
    let query = {};

    if (source && destination) {
      query = {
        source: { $regex: source, $options: "i" },
        destination: { $regex: destination, $options: "i" }
      };
    }

    const buses = await Bus.find(query);
    res.status(200).json({ success: true, data: buses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// २. POST /add (हा रूट वरच असायला हवा)
router.post("/add", async (req, res) => {
  try {
    const newBus = new Bus(req.body);
    const savedBus = await newBus.save();
    res.status(201).json({ success: true, data: savedBus });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ३. GET /:id (हा रूट सर्वात खाली असावा)
router.get("/:id", async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: "Bus not found" });
    }
    res.status(200).json({ success: true, data: bus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;