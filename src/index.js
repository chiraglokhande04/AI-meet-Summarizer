import express from 'express';
import botRoutes from './routes/botRoutes.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());

// Routes
app.use('/api/bot', botRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/bot/start`);
});