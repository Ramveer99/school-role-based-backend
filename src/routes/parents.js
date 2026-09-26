import { Router } from 'express';
import {
  getParents,
  getMyChildren,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
} from '../controllers/parentController.js';

const router = Router();

router.get('/my-children', getMyChildren);
router.get('/me/children', getMyChildren);
router.get('/', getParents);
router.get('/:id', getParentById);
router.post('/', createParent);
router.put('/:id', updateParent);
router.put('/', updateParent);
router.delete('/:id', deleteParent);
router.delete('/', deleteParent);

export default router;
