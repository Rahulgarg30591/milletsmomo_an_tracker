import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { getPublicKey, subscribe, unsubscribe, sendTest } from '../controllers/pushController.js';

const router = Router();

// Only admin devices receive notifications.
router.get('/public-key', authMiddleware, requireRole('admin'), getPublicKey);
router.post('/subscription', authMiddleware, requireRole('admin'), subscribe);
router.delete('/subscription', authMiddleware, requireRole('admin'), unsubscribe);
router.post('/test', authMiddleware, requireRole('admin'), sendTest);

export default router;
