import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import auth from './auth.js';
import me from './me.js';
import organizations from './organizations.js';
import teachers from './teachers.js';
import students from './students.js';
import parents from './parents.js';
import classes from './classes.js';
import notices from './notices.js';
import admissions from './admissions.js';
import attendance from './attendance.js';
import fees from './fees.js';
import exams from './exams.js';
import results from './results.js';
import timetable from './timetable.js';
import dashboard from './dashboard.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'school-dashboard-api', db: 'mongodb' });
});

router.use('/auth', auth);

router.use(authenticateToken);

router.use('/me', me);
router.use('/organizations', organizations);
router.use('/teachers', teachers);
router.use('/students', students);
router.use('/parents', parents);
router.use('/classes', classes);
router.use('/notices', notices);
router.use('/admissions', admissions);
router.use('/attendance', attendance);
router.use('/fees', fees);
router.use('/exams', exams);
router.use('/results', results);
router.use('/timetable', timetable);
router.use('/dashboard', dashboard);

export default router;
