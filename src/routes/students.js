import { Router } from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
} from '../controllers/studentController.js';

const router = Router();

router.get('/', getStudents);
router.get('/:id', getStudentById);
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.put('/', updateStudent);
router.delete('/:id', deleteStudent);
router.delete('/', deleteStudent);

export default router;
