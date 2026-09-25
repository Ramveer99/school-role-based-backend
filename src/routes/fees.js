import { Router } from 'express';
import { getFees, createFee, updateFee, payFee, getFeeStats } from '../controllers/feeController.js';

const router = Router();

router.get('/', getFees);
router.get('/stats', getFeeStats);
router.post('/', createFee);
router.put('/:id', updateFee);
router.post('/:id/pay', payFee);

export default router;
