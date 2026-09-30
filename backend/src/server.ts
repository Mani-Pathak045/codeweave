import 'dotenv/config';

import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { setupSyncGateway } from './modules/sync-gateway/sync.gateway.js';

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL as string;
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
});

const pubClient = createClient({ url: REDIS_URL });
const subClient = pubClient.duplicate();

await Promise.all([pubClient.connect(), subClient.connect()]);

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('No token provided'));
  }
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { userId: string };
    (socket as any).userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

io.adapter(createAdapter(pubClient, subClient));

setupSyncGateway(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});