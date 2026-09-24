import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getRefills, addRefill, updateRefill, deleteRefill, getSources } from '../controllers/cylinderController.js';

const router = Router();

router.get('/', authMiddleware, getRefills);
router.get('/sources', authMiddleware, getSources);
router.post('/', authMiddleware, addRefill);
router.put('/:id', authMiddleware, updateRefill);
router.delete('/:id', authMiddleware, deleteRefill);

export default router;
