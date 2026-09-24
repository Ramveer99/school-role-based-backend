import { Router } from 'express';
import {
  getParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
} from '../controllers/parentController.js';

const router = Router();

router.get('/', getParents);
router.get('/:id', getParentById);
router.post('/', createParent);
router.put('/:id', updateParent);
router.put('/', updateParent);
router.delete('/:id', deleteParent);
router.delete('/', deleteParent);

export default router;
