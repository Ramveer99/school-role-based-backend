import { Router } from 'express';
import {
  getTimetable,
  getTimetableById,
  saveTimetable,
  deleteTimetable,
} from '../controllers/timetableController.js';

const router = Router();

router.get('/', getTimetable);
router.get('/:id', getTimetableById);
router.post('/', saveTimetable);
router.put('/:id', saveTimetable);
router.put('/', saveTimetable);
router.delete('/:id', deleteTimetable);
router.delete('/', deleteTimetable);

export default router;
