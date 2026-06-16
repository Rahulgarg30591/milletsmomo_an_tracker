import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import {
  getOrders,
  createOrder,
  completeOrder,
  deleteOrder,
} from '../controllers/ordersController.js';

const router = Router();

router.get('/', authMiddleware, getOrders);
router.post('/', authMiddleware, createOrder);
router.patch('/:id/complete', authMiddleware, completeOrder);
router.delete('/:id', authMiddleware, deleteOrder);

export default router;