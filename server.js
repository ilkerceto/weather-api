import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import requestIp from "request-ip";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Nodig om __dirname te krijgen bij ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS (optioneel, maar kan geen kwaad)
app.use(cors());

// Static files (public map)
app.use(express.static(path.join(__dirname, "public")));

// Middleware om IP makkelijk te lezen
app.use(requestIp.mw());

function getClientIp(req) {
  let ip = req.clientIp || req.ip;

  if (ip && ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }

  if (ip === "::1" || ip === "127.0.0.1") {
    return process.env.FALLBACK_IP || "91.184.0.0"; // demo IP
  }

  return ip;
}

// API: /api/weather
app.get("/api/weather", async (req, res) => {
  try {
    const ipFromQuery = req.query.ip;
    const ip = ipFromQuery || getClientIp(req);

    if (!ip) {
      return res.status(400).json({ error: "Kon IP-adres niet bepalen." });
    }

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

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
    const weatherResp = await axios.get(weatherUrl);

    if (!weatherResp.data || !weatherResp.data.current_weather) {
      return res.status(500).json({ error: "Kon weerdata niet ophalen." });
    }

    const current = weatherResp.data.current_weather;

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
        temperature: current.temperature,
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

// Homepage → public/index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
