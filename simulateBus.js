const { io } = require("socket.io-client");
const axios = require("axios");

const SERVER_URL = "http://localhost:5000";

// इचलकरंजी ते कुरुंदवाड महामार्ग पॉईंट्स (Ichalkaranji -> Shirdhon -> Shirol -> Kurundwad)
const fullRouteCoordinates = [
  { latitude: 16.6913, longitude: 74.4608, speed: 25 }, // इचलकरंजी बस स्थानक
  { latitude: 16.6980, longitude: 74.4850, speed: 38 }, // कबनूर
  { latitude: 16.7050, longitude: 74.5200, speed: 45 }, // शिरढोण
  { latitude: 16.7210, longitude: 74.5950, speed: 42 }, // शिरोळ
  { latitude: 16.7000, longitude: 74.6200, speed: 40 }, // नृसिंहवाडी फाटा
  { latitude: 16.6850, longitude: 74.6390, speed: 30 }  // कुरुंदवाड बस स्थानक
];

async function startSimulation() {
  try {
    const res = await axios.get(`${SERVER_URL}/api/buses`);
    const buses = res.data.data;

    if (!buses || buses.length === 0) {
      console.log("डेटाबेसमध्ये बस सापडली नाही!");
      return;
    }

    const targetBus = buses[0];
    const busId = targetBus._id;
    console.log(`बस सिम्युलेशन सुरू: ${targetBus.busNumber} (ID: ${busId})`);

    const socket = io(SERVER_URL);

    let currentIndex = 0; // येथे currentIndex डिफाइन केला आहे

    socket.on("connect", () => {
      console.log("सिम्युलेटर सर्व्हरशी कनेक्ट झाला:", socket.id);

      setInterval(() => {
        const point = fullRouteCoordinates[currentIndex];

        const payload = {
          busId: busId,
          latitude: point.latitude,
          longitude: point.longitude,
          speed: point.speed
        };

        console.log(`[${targetBus.busNumber}] -> थांबा ${currentIndex + 1}/${fullRouteCoordinates.length} | Lat: ${point.latitude}, Lng: ${point.longitude}, वेग: ${point.speed} km/h`);
        
        socket.emit("update_location", payload);

        // कुरुंदवाडला पोहोचल्यावर पुन्हा इचलकरंजीपासून अखंड चालवणे
        if (currentIndex < fullRouteCoordinates.length - 1) {
          currentIndex++;
        } else {
          currentIndex = 0;
          console.log("मार्ग पूर्ण झाला! बस पुन्हा इचलकरंजीवरून निघाली.");
        }
      }, 3000);
    });

  } catch (error) {
    console.error("सिम्युलेशन एरर:", error.message);
  }
}

startSimulation();
