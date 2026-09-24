import { Router } from 'express';
import { getResults, recordResult } from '../controllers/examController.js';

const router = Router();

router.get('/', getResults);
router.post('/', recordResult);

export default router;
