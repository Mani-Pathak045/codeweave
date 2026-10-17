import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { explainError, reviewCode } from './ai.service.js';
import { isRoomMember } from '../rooms/rooms.service.js';

export async function handleExplainError(req: AuthRequest, res: Response) {
  try {
    const { roomId, code, stderr } = req.body;
    const userId = req.userId as string;

    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const result = await explainError({ roomId, userId, code, stderr });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function handleReviewCode(req: AuthRequest, res: Response) {
  try {
    const { roomId, code, language } = req.body;
    const userId = req.userId as string;

    const isMember = await isRoomMember(roomId, userId);
    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    const result = await reviewCode({ roomId, userId, code, language });
    res.status(200).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
