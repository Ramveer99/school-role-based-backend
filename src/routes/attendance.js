import { Router } from 'express';
import {
  getAttendance,
  markAttendance,
  getAttendanceStats,
} from '../controllers/attendanceController.js';

const router = Router();

router.get('/', getAttendance);
router.get('/stats', getAttendanceStats);
router.post('/', markAttendance);

export default router;
