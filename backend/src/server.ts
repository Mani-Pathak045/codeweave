import 'dotenv/config';

import http from 'http';
import { Server } from 'socket.io';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';
import app from './app.js';
import { setupSyncGateway } from './modules/sync-gateway/sync.gateway.js';

const PORT = process.env.PORT || 4000;
const REDIS_URL = process.env.REDIS_URL as string;

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

io.adapter(createAdapter(pubClient, subClient));

setupSyncGateway(io);

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});