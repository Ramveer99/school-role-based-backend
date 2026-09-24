import { Router } from 'express';
import {
  getClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
} from '../controllers/classController.js';

const router = Router();

router.get('/', getClasses);
router.get('/:id', getClassById);
router.post('/', createClass);
router.put('/:id', updateClass);
router.put('/', updateClass);
router.delete('/:id', deleteClass);
router.delete('/', deleteClass);

export default router;
