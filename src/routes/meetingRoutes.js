import express from "express";
import {
  saveMeeting,
  getUserMeetings,
  getMeetingById,
} from "../controllers/meetingController.js";
import { authMiddleware } from "../middleware/AuthMiddleware.js";

const router = express.Router();

router.use(authMiddleware);

router.post("/", saveMeeting);

router.get("/user", getUserMeetings);

router.get("/:id", getMeetingById);

export default router;
