import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/authMiddleware.js';
import { getSummary, getOrders, getMinimumSaleValue } from '../controllers/adminController.js';
import { getItems, getOrder, createOrder, upsertOrder, listOrders, getLogs, markNoSupply, getNoSupply } from '../controllers/supplyController.js';
import { getStaffLogs } from '../controllers/staffLogController.js';
import { getClientLogs } from '../controllers/clientLogController.js';

const router = Router();

router.get('/summary', authMiddleware, requireRole('admin'), getSummary);
router.get('/orders', authMiddleware, requireRole('admin'), getOrders);
router.get('/minimum-sale-value', authMiddleware, requireRole('admin'), getMinimumSaleValue);
router.get('/supply/items', authMiddleware, requireRole('admin'), getItems);
router.get('/supply/order', authMiddleware, requireRole('admin'), getOrder);
router.get('/supply/orders', authMiddleware, requireRole('admin'), listOrders);
router.get('/supply/logs', authMiddleware, requireRole('admin'), getLogs);
router.post('/supply/order', authMiddleware, requireRole('admin'), createOrder);
router.put('/supply/order', authMiddleware, requireRole('admin'), upsertOrder);
router.get('/supply/no-supply', authMiddleware, requireRole('admin'), getNoSupply);
router.post('/supply/no-supply', authMiddleware, requireRole('admin'), markNoSupply);
router.get('/staff-logs', authMiddleware, requireRole('admin'), getStaffLogs);
router.get('/client-logs', authMiddleware, requireRole('admin'), getClientLogs);

export default router;