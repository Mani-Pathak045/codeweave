import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { submit, listRoomSubmissions } from './execution.controller.js';

const router = Router();

// All execution endpoints require authentication.
router.use(requireAuth);

// POST /api/execution/submit — run code via Judge0
router.post('/submit', submit);

// GET /api/execution/rooms/:roomId — recent submission history for a room
router.get('/rooms/:roomId', listRoomSubmissions);

export default router;
