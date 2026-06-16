import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { getSummary } from '../controllers/adminController.js';

const router = Router();

router.get('/summary', authMiddleware, requireRole('admin'), getSummary);

export default router;