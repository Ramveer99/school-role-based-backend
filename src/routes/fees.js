import { Router } from 'express';
import { getFees, createFee, payFee, getFeeStats } from '../controllers/feeController.js';

const router = Router();

router.get('/', getFees);
router.get('/stats', getFeeStats);
router.post('/', createFee);
router.post('/:id/pay', payFee);

export default router;
