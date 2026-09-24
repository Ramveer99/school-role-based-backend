import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  login,
  register,
  getMe,
  forgotPassword,
  resetPassword,
  userChangePassword,
  logout,
} from '../controllers/authController.js';

const router = Router();

router.post('/login', login);
router.post('/register', authenticateToken, register);
router.post('/logout', logout);
router.get('/me', authenticateToken, getMe);
router.post('/change-password', authenticateToken, userChangePassword);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
