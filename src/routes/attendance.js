import { Router } from 'express';
import {
  getAttendance,
  markAttendance,
  updateAttendance,
  getAttendanceStats,
} from '../controllers/attendanceController.js';

const router = Router();

router.get('/', getAttendance);
router.get('/stats', getAttendanceStats);
router.post('/', markAttendance);
router.put('/:id', updateAttendance);

export default router;
