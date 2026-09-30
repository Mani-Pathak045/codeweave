import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { register, login, refresh, me } from './auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/me', requireAuth, me);

export default router;