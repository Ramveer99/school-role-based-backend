import { Router } from 'express';
import {
  getClasses,
  getClassById,
  getClassStudents,
  createClass,
  updateClass,
  setClassTeacher,
  assignTeachersToClass,
  removeTeacherFromClass,
  deleteClass,
} from '../controllers/classController.js';

const router = Router();

router.get('/', getClasses);
router.get('/:id', getClassById);
router.get('/:id/students', getClassStudents);
router.post('/', createClass);
router.post('/:id/teachers', assignTeachersToClass);
router.delete('/:id/teachers/:teacherId', removeTeacherFromClass);
router.put('/:id/class-teacher', setClassTeacher);
router.put('/:id', updateClass);
router.put('/', updateClass);
router.delete('/:id', deleteClass);
router.delete('/', deleteClass);

export default router;
