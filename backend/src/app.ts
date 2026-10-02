import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './modules/auth/auth.routes.js';
import { requireAuth, AuthRequest } from './middleware/auth.middleware.js';
import roomRoutes from './modules/rooms/rooms.routes.js';
import executionRoutes from './modules/execution/execution.routes.js';

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/execution', executionRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


app.get('/api/protected-test', requireAuth, (req: AuthRequest, res) => {
  res.json({ message: 'You are authenticated', userId: req.userId });
});

export default app;