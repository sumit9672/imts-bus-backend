const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

// CORS आणि JSON मिडलवेअर
app.use(cors());
app.use(express.json());

// Socket.io कॉन्फिगरेशन
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// MongoDB Schema (Bilingual + Flexible)
const busSchema = new mongoose.Schema({
  busNumber: { type: String, required: true },
  route: {
    from: { type: mongoose.Schema.Types.Mixed },
    to: { type: mongoose.Schema.Types.Mixed },
    fromEn: { type: String, default: "" },
    fromMr: { type: String, default: "" },
    toEn: { type: String, default: "" },
    toMr: { type: String, default: "" }
  },
  via: { type: Array, default: [] },
  status: { type: String, default: "running" },
  location: {
    latitude: { type: Number, default: 16.6956 },
    longitude: { type: Number, default: 74.4667 }
  }
}, { timestamps: true });

const Bus = mongoose.models.Bus || mongoose.model("Bus", busSchema);

// MongoDB कनेक्शन
const MONGO_URI = "mongodb+srv://sumitkoli9672_db_user:SumitKoli9672@cluster0.obh2s1p.mongodb.net/bus-tracker?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB कनेक्ट झाले आहे.");

    // पहिली बस आपोआप तयार करणे (नसल्यास)
    const count = await Bus.countDocuments();
    if (count === 0) {
      await Bus.create({
        busNumber: "MH-09-IMTS-2026",
        route: {
          from: "इचलकरंजी",
          to: "कुरुंदवाड",
          fromEn: "Ichalkaranji",
          fromMr: "इचलकरंजी",
          toEn: "Kurundwad",
          toMr: "कुरुंदवाड"
        },
        via: ["शिरढोण", "शिरोळ", "नृसिंहवाडी"],
        status: "running"
      });
      console.log("इचलकरंजी-कुरुंदवाड डिफॉल्ट बस तयार केली.");
    }
  })
  .catch((err) => {
    console.log("MongoDB एरर:", err.message);
  });

// --- API Routes ---

// १. सर्व बसेस मिळवणे
app.get("/api/buses", async (req, res) => {
  try {
    const buses = await Bus.find().sort({ createdAt: -1 });
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// २. नवीन बस तयार करणे (Admin Add Bus API - 100% Safe Parsing)
app.post("/api/buses", async (req, res) => {
  try {
    const { busNumber, routeFrom, routeTo, viaStops, status } = req.body;

    if (!busNumber) {
      return res.status(400).json({ success: false, message: "Bus Number आवश्यक आहे." });
    }

    // Safe extraction of English & Marathi names
    const fromEnglish = typeof routeFrom === 'object' ? (routeFrom?.en || '') : (routeFrom || '');
    const fromMarathi = typeof routeFrom === 'object' ? (routeFrom?.mr || routeFrom?.en || '') : (routeFrom || '');
    
    const toEnglish = typeof routeTo === 'object' ? (routeTo?.en || '') : (routeTo || '');
    const toMarathi = typeof routeTo === 'object' ? (routeTo?.mr || routeTo?.en || '') : (routeTo || '');

    const newBus = new Bus({
      busNumber: busNumber.trim().toUpperCase(),
      route: {
        from: fromMarathi || fromEnglish,
        to: toMarathi || toEnglish,
        fromEn: fromEnglish,
        fromMr: fromMarathi,
        toEn: toEnglish,
        toMr: toMarathi
      },
      via: viaStops || [],
      status: status || "running",
      location: {
        latitude: 16.6956,
        longitude: 74.4667
      }
    });

    const savedBus = await newBus.save();
    console.log(`[नवीन बस सेव्ह झाली]: ${savedBus.busNumber}`);

    // सॉकेटवर नवीन बसचा इव्हेंट पाठवणे
    io.emit("new_bus_added", savedBus);

    res.status(201).json({ success: true, data: savedBus });
  } catch (err) {
    console.error("Save Error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ३. बस अपडेट करणे
app.put("/api/buses/:id", async (req, res) => {
  try {
    const { busNumber, routeFrom, routeTo, viaStops, status } = req.body;

    const fromVal = typeof routeFrom === 'object' ? (routeFrom?.mr || routeFrom?.en) : routeFrom;
    const toVal = typeof routeTo === 'object' ? (routeTo?.mr || routeTo?.en) : routeTo;

    const updatedBus = await Bus.findByIdAndUpdate(
      req.params.id,
      {
        busNumber: busNumber,
        "route.from": fromVal,
        "route.to": toVal,
        via: viaStops,
        status: status || "running"
      },
      { new: true }
    );

    if (!updatedBus) {
      return res.status(404).json({ success: false, message: "बस सापडली नाही" });
    }

    io.emit("bus_info_updated", updatedBus);
    console.log(`मार्ग अपडेट झाला: ${updatedBus.busNumber}`);

    res.json({ success: true, data: updatedBus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Auth Routes ---
const OTP_STORE = {};
const ADMIN_SECRET_KEY = "IMTS@Admin#2026";

app.post("/api/auth/send-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, message: "Valid mobile number टाका" });
  }

  const otp = "1234";
  OTP_STORE[phone] = otp;

  console.log(`[AUTH] OTP sent to ${phone}: ${otp}`);
  res.json({ success: true, message: "OTP पाठवला आहे (Test OTP: 1234)" });
});

app.post("/api/auth/verify-login", (req, res) => {
  const { phone, otp, role, adminPassword } = req.body;

  if (OTP_STORE[phone] !== otp && otp !== "1234") {
    return res.status(400).json({ success: false, message: "चुकीचा OTP आहे!" });
  }

  if (role === "admin") {
    if (adminPassword !== ADMIN_SECRET_KEY) {
      return res.status(401).json({ success: false, message: "चुकीचा Admin Password! Access Denied." });
    }
  }

  delete OTP_STORE[phone];

  res.json({
    success: true,
    message: "Login यशस्वी!",
    user: {
      phone,
      role: role || "passenger"
    }
  });
});

// --- Socket.io Real-time Handling ---
io.on("connection", (socket) => {
  console.log("क्लायंट जोडला गेला:", socket.id);

  socket.on("join_bus_room", (busId) => {
    socket.join(busId);
  });

  socket.on("update_location", (data) => {
    io.emit("bus_location_changed", data);
  });

  socket.on("disconnect", () => {
    console.log("क्लायंट डिस्कनेक्ट झाला:", socket.id);
  });
});

// --- Health Check Route ---
app.get("/", (req, res) => {
  res.send("IMTS Bus Tracker Backend is Live & Running!");
});

// --- Server Start (नेहेमी सर्व रूट्सच्या शेवटी) ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`सर्व्हर पोर्ट ${PORT} वर सुरू झाला आहे!`);
});