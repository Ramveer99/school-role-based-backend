import { Router } from 'express';
import {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getResults,
  recordResult,
} from '../controllers/examController.js';

const router = Router();

router.get('/', getExams);
router.post('/', createExam);
router.get('/results', getResults);
router.post('/results', recordResult);
router.get('/:id', getExamById);
router.put('/:id', updateExam);
router.put('/', updateExam);
router.delete('/:id', deleteExam);
router.delete('/', deleteExam);

export default router;
