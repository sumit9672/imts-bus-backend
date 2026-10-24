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
    methods: ["GET", "POST", "PUT"]
  }
});

// MongoDB Schema
const busSchema = new mongoose.Schema({
  busNumber: { type: String, required: true },
  route: {
    from: { type: String, default: "इचलकरंजी" },
    to: { type: String, default: "कुरुंदवाड" }
  },
  via: { type: String, default: "शिरढोण, शिरोळ" },
  status: { type: String, default: "running" },
  currentLocation: {
    latitude: { type: Number, default: 16.6913 },
    longitude: { type: Number, default: 74.4608 },
    speed: { type: Number, default: 0 }
  }
});

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
        route: { from: "इचलकरंजी", to: "कुरुंदवाड" },
        via: "शिरढोण, शिरोळ, नृसिंहवाडी",
        status: "running"
      });
      console.log("इचलकरंजी-कुरुंदवाड डिफॉल्ट बस तयार केली.");
    }
  })
  .catch((err) => {
    console.log("MongoDB एरर (स्थानिक डेटा वापरत आहोत):", err.message);
  });

// --- API Routes ---

// सर्व बसेस मिळवणे
app.get("/api/buses", async (req, res) => {
  try {
    const buses = await Bus.find();
    res.json({ success: true, data: buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Route Update API
app.put("/api/buses/:id", async (req, res) => {
  try {
    const { busNumber, routeFrom, routeTo, viaStops, status } = req.body;

    const updatedBus = await Bus.findByIdAndUpdate(
      req.params.id,
      {
        busNumber: busNumber,
        "route.from": routeFrom,
        "route.to": routeTo,
        via: viaStops,
        status: status || "running"
      },
      { new: true }
    );

    if (!updatedBus) {
      return res.status(404).json({ success: false, message: "बस सापडली नाही" });
    }

    io.emit("bus_info_updated", updatedBus);
    console.log(`मार्ग अपडेट झाला: ${updatedBus.busNumber} (${routeFrom} ➔ ${routeTo})`);

    res.json({ success: true, data: updatedBus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Socket.io Real-time Handling
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

// Server Start
const PORT = 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`सर्व्हर पोर्ट ${PORT} वर सुरू झाला आहे!`);
});



// Dummy/Static OTP Storage (Production sathi Twilio/Fast2SMS vaparta yete)
const OTP_STORE = {};
const ADMIN_SECRET_KEY = "IMTS@Admin#2026"; // Tumcha secret admin password

// 1. Send OTP API
app.post("/api/auth/send-otp", (req, res) => {
  const { phone } = req.body;
  if (!phone || phone.length < 10) {
    return res.status(400).json({ success: false, message: "Valid mobile number taka" });
  }

  // 4-digit OTP generate karne (Testing sathi '1234' thevuya kiva random)
  const otp = "1234"; 
  OTP_STORE[phone] = otp;

  console.log(`[AUTH] OTP sent to ${phone}: ${otp}`);
  res.json({ success: true, message: "OTP pathavla ahe (Test OTP: 1234)" });
});

// 2. Verify OTP & Login API
app.post("/api/auth/verify-login", (req, res) => {
  const { phone, otp, role, adminPassword } = req.body;

  // OTP check
  if (OTP_STORE[phone] !== otp && otp !== "1234") {
    return res.status(400).json({ success: false, message: "Chukicha OTP ahe!" });
  }

  // Admin Security check
  if (role === "admin") {
    if (adminPassword !== ADMIN_SECRET_KEY) {
      return res.status(401).json({ success: false, message: "Chukicha Admin Password! Access Denied." });
    }
  }

  delete OTP_STORE[phone]; // OTP expire karne

  res.json({
    success: true,
    message: "Login यशस्वी!",
    user: {
      phone,
      role: role || "passenger"
    }
  });
});