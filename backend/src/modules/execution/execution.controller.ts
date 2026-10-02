import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { submitCode, getRoomSubmissions } from './execution.service.js';
import { isRoomMember } from '../rooms/rooms.service.js';

export async function submit(req: AuthRequest, res: Response) {
  try {
    const { roomId, code, language } = req.body;
    const userId = req.userId as string;

    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const result = await submitCode({ roomId, userId, code, language });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function listRoomSubmissions(req: AuthRequest, res: Response) {
  try {
    const { roomId } = req.params as { roomId: string };
    const userId = req.userId as string;

    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const submissions = await getRoomSubmissions(roomId);
    res.status(200).json(submissions);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}