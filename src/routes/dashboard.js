import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController.js';

const router = Router();

router.get('/stats', getDashboardStats);
router.get('/', getDashboardStats);

export default router;
