// Must run first so root .env is loaded before bolt and others read process.env
import './env';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { boltApp } from './slack/bolt';
import { setupSlackHandlers } from './slack/handlers';
import { initializeSocketIO } from './socket/events';
import ticketsRouter from './api/tickets';
import devRouter from './api/dev';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.APP_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Initialize Socket.IO
initializeSocketIO(io);

// Middleware
app.use(cors({ origin: process.env.APP_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// Routes
app.use('/api/tickets', ticketsRouter);
app.use('/dev', devRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;

// Start Express server
httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

// Start Slack Bolt app
setupSlackHandlers();
boltApp.start().then(() => {
  console.log('Slack Bolt app started');
}).catch((error) => {
  console.error('Failed to start Slack Bolt app:', error);
  process.exit(1);
});
