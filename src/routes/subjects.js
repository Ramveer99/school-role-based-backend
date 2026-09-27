import { Router } from 'express';
import {
  getSubjects,
  getGroupedSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../controllers/subjectController.js';

const router = Router();

router.get('/grouped', getGroupedSubjects);
router.get('/', getSubjects);
router.get('/:id', getSubjectById);
router.post('/', createSubject);
router.put('/:id', updateSubject);
router.put('/', updateSubject);
router.delete('/:id', deleteSubject);
router.delete('/', deleteSubject);

export default router;
