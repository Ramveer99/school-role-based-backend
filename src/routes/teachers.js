import { Router } from 'express';
import {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
} from '../controllers/teacherController.js';

const router = Router();

router.get('/', getTeachers);
router.get('/:id', getTeacherById);
router.post('/', createTeacher);
router.put('/:id', updateTeacher);
router.put('/', updateTeacher);
router.delete('/:id', deleteTeacher);
router.delete('/', deleteTeacher);

export default router;
