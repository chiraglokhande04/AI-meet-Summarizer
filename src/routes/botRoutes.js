import express from "express";
import { startMeetingBot } from "../controllers/botController.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";
const router = express.Router();

router.post("/start", authMiddleware, startMeetingBot);
export default router;
