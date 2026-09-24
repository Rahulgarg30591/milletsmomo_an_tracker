import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getStaffNames, getTakeawayItems } from '../controllers/staffController.js';

const router = Router();

// Name suggestions for the admin leave and takeaway forms.
router.get('/names', authMiddleware, getStaffNames);
// Staff screens read what was taken so stock adds up; only admin records it.
router.get('/takeaway-items', authMiddleware, getTakeawayItems);

export default router;
