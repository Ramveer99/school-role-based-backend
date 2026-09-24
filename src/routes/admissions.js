import { Router } from 'express';
import { createAdmission } from '../controllers/admissionController.js';

const router = Router();

router.post('/', createAdmission);

export default router;
