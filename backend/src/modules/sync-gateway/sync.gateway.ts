import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import { joinRoom } from '../rooms/rooms.service.js';

const docs = new Map<string, Y.Doc>();

function getOrCreateDoc(roomId: string): Y.Doc {
  let doc = docs.get(roomId);
  if (!doc) {
    doc = new Y.Doc();
    docs.set(roomId, doc);
  }
  return doc;
}

export function setupSyncGateway(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('sync-join', async (roomId: string) => {
      const userId = (socket as any).userId;
      try {
        await joinRoom(roomId, userId);
      } catch (err) {
        socket.emit('sync-error', 'Failed to join room');
        return;
      }

      socket.join(roomId);
      const doc = getOrCreateDoc(roomId);
      const state = Y.encodeStateAsUpdate(doc);
      socket.emit('sync-init', state);
    });

    socket.on('sync-update', (roomId: string, update: Uint8Array) => {
      const doc = getOrCreateDoc(roomId);
      Y.applyUpdate(doc, new Uint8Array(update));
      socket.to(roomId).emit('sync-update', update);
    });

    socket.on('awareness-update', (roomId: string, update: Uint8Array) => {
      socket.to(roomId).emit('awareness-update', update);
    });
  });
}