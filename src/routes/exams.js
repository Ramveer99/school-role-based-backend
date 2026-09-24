import { Router } from 'express';
import {
  getExams,
  createExam,
  getResults,
  recordResult,
} from '../controllers/examController.js';

const router = Router();

router.get('/', getExams);
router.post('/', createExam);
router.get('/results', getResults);
router.post('/results', recordResult);

export default router;
