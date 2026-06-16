import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getMenu } from '../controllers/menuController.js';

const router = Router();

router.get('/', authMiddleware, getMenu);

export default router;