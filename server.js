import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import requestIp from "request-ip";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS zodat je frontend deze API mag aanroepen
app.use(cors());

// Middleware om IP makkelijk te lezen
app.use(requestIp.mw());

// Helper om client IP te bepalen
function getClientIp(req) {
  // request-ip middleware voegt dit toe
  let ip = req.clientIp || req.ip;

  // Als er meerdere IP's in de header staan (proxy), pak de eerste
  if (ip && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  // In dev kan het "::1" of "127.0.0.1" zijn (localhost)
  if (ip === "::1" || ip === "127.0.0.1") {
    // Optioneel: fallback naar demo IP (bijv. Amsterdam) voor testen
    return process.env.FALLBACK_IP || "91.184.0.0";
  }

  return ip;
}

// GET /api/weather
app.get("/api/weather", async (req, res) => {
  try {
    // Optioneel: ip override via query: /api/weather?ip=1.2.3.4
    const ipFromQuery = req.query.ip;
    const ip = ipFromQuery || getClientIp(req);

    if (!ip) {
      return res.status(400).json({ error: "Kon IP-adres niet bepalen." });
    }

    // 1) IP → locatie (ipapi.co)
    const geoUrl = `https://ipapi.co/${ip}/json/`;
    const geoResp = await axios.get(geoUrl);

    if (!geoResp.data || !geoResp.data.latitude || !geoResp.data.longitude) {
      return res.status(500).json({ error: "Kon locatie op basis van IP niet vinden." });
    }

    const {
      city,
      region,
      country_name: country,
      latitude,
      longitude
    } = geoResp.data;

    // 2) Locatie → weer (Open-Meteo)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const weatherResp = await axios.get(weatherUrl);

    if (!weatherResp.data || !weatherResp.data.current_weather) {
      return res.status(500).json({ error: "Kon weerdata niet ophalen." });
    }

    const current = weatherResp.data.current_weather;

    // 3) Response naar frontend
    return res.json({
      ip,
      location: {
        city,
        region,
        country,
        latitude,
        longitude
      },
      weather: {
        temperature: current.temperature, // °C
        windspeed: current.windspeed,
        winddirection: current.winddirection,
        weathercode: current.weathercode,
        time: current.time
      }
    });
  } catch (err) {
    console.error("Error in /api/weather:", err.message);
    return res.status(500).json({ error: "Interne serverfout." });
  }
});

app.get("/", (req, res) => {
  res.send("IP Weather API is running. Use /api/weather");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
