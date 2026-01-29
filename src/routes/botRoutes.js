import express from 'express';
import { startMeetingBot } from '../controllers/botController.js';

const router = express.Router();

// POST route to trigger the bot
router.post('/start', startMeetingBot);

export default router;