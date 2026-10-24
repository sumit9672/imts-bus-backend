const mongoose = require("mongoose");

const BusSchema = new mongoose.Schema({
  busNumber: { 
    type: String, 
    required: true, 
    unique: true 
  },
  busName: { 
    type: String, 
    default: "" 
  },
  source: { 
    type: String, 
    required: true 
  },
  destination: { 
    type: String, 
    required: true 
  },
  status: {
    type: String,
    enum: ["ON_TIME", "DELAYED", "CANCELLED", "NOT_STARTED"],
    default: "NOT_STARTED"
  },
  currentLocation: {
    latitude: { type: Number, default: 0 },
    longitude: { type: Number, default: 0 },
    speed: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  stops: [
    {
      stopName: { type: String, required: true },
      scheduledTime: { type: String, required: true },
      latitude: { type: Number, default: 0 },
      longitude: { type: Number, default: 0 }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model("Bus", BusSchema);