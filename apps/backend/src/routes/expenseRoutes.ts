import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getDayExpenses, saveDayExpenses } from '../controllers/expenseController.js';

const router = Router();

router.get('/', authMiddleware, getDayExpenses);
router.put('/', authMiddleware, saveDayExpenses);

export default router;
