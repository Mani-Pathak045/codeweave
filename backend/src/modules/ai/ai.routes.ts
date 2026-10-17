import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { handleExplainError, handleReviewCode } from './ai.controller.js';

const router = Router();

// All AI endpoints require authentication.
router.use(requireAuth);

// POST /api/ai/explain-error — explain a runtime error in plain English
router.post('/explain-error', handleExplainError);

// POST /api/ai/review — review the current code for bugs / improvements
router.post('/review', handleReviewCode);

export default router;
