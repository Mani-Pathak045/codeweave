import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { create, join, listMine, getOne } from './rooms.controller.js';

const router = Router();

router.use(requireAuth);

router.post('/', create);
router.post('/:roomId/join', join);
router.get('/mine', listMine);
router.get('/:roomId', getOne);

export default router;