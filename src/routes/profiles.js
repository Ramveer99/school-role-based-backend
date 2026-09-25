import { Router } from 'express';
import { uploadProfileAvatar } from '../controllers/profileController.js';

const router = Router();

router.post('/:id/avatar', uploadProfileAvatar);

export default router;
