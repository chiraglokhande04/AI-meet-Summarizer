import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import botRoutes from "./routes/botRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import { connectionDatabase } from "./utility/connectDb.js";
import { links } from "./utility/accessLinks.js";
const app = express();
const PORT = 3000;

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (links.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use("/api/bot", botRoutes);
app.use("/api/user", userRoutes);
app.use("/api/meet", meetingRoutes);

async function start() {
  await connectionDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/bot/start`);
  });
}
start();
