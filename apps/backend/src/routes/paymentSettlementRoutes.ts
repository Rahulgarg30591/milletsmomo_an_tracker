import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { getSettlement, createSettlement, listSettlements } from '../controllers/paymentSettlementController.js';

const router = Router();

router.get('/settlement', authMiddleware, requireRole('admin'), getSettlement);
router.post('/settlement', authMiddleware, requireRole('admin'), createSettlement);
router.get('/settlements', authMiddleware, requireRole('admin'), listSettlements);

export default router;
