import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { createRoom, joinRoom, getUserRooms, getRoomById } from './rooms.service.js';

export async function create(req: AuthRequest, res: Response) {
  try {
    const { name, language } = req.body;
    const room = await createRoom(req.userId as string, name, language);
    res.status(201).json(room);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function join(req: AuthRequest, res: Response) {
  try {
    const { roomId } = req.params as { roomId: string };
    const membership = await joinRoom(roomId, req.userId as string);
    res.status(200).json(membership);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}

export async function listMine(req: AuthRequest, res: Response) {
  try {
    const rooms = await getUserRooms(req.userId as string);
    res.status(200).json(rooms);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getOne(req: AuthRequest, res: Response) {
  try {
    const { roomId } = req.params as { roomId: string };
    const room = await getRoomById(roomId);
    res.status(200).json(room);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
}