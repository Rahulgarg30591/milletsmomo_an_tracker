import { Router } from 'express';
import { createClientLogs } from '../controllers/clientLogController.js';

const router = Router();

router.post('/', createClientLogs);

export default router;
