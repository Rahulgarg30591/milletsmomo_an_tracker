import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getVerification, createVerification, listVerifications } from '../controllers/supplyVerificationController.js';
import { getClosingStock, createClosingStock } from '../controllers/closingStockController.js';
import { getClosingCash, saveClosingCash } from '../controllers/closingCashController.js';

const router = Router();

router.get('/verifications', authMiddleware, listVerifications);
router.get('/verification', authMiddleware, getVerification);
router.post('/verification', authMiddleware, createVerification);
router.get('/closing-stock', authMiddleware, getClosingStock);
router.post('/closing-stock', authMiddleware, createClosingStock);
router.get('/closing-cash', authMiddleware, getClosingCash);
router.put('/closing-cash', authMiddleware, saveClosingCash);

export default router;
