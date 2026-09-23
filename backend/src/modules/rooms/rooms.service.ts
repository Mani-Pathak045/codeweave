import { PrismaClient } from '../../generated/prisma/client.js';

const prisma = new PrismaClient();

export async function createRoom(ownerId: string, name: string, language: string) {
  const room = await prisma.room.create({
    data: {
      name,
      ownerId,
      language,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
    },
    include: { members: true },
  });

  return room;
}

export async function joinRoom(roomId: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new Error('Room not found');
  }

  const existingMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
  if (existingMembership) {
    return existingMembership;
  }

  const membership = await prisma.roomMember.create({
    data: { roomId, userId, role: 'EDITOR' },
  });

  return membership;
}

export async function getUserRooms(userId: string) {
  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    include: { room: true },
  });

  return memberships.map((m) => m.room);
}

export async function getRoomById(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { members: true },
  });

  if (!room) {
    throw new Error('Room not found');
  }

  return room;
}
