import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import botRoutes from "./routes/botRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import { connectionDatabase } from "./utility/connectDb.js";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
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
