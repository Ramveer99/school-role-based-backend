import {
  loginWithEmailPassword,
  registerUser,
  getMeFromProfileId,
  requestPasswordReset,
  resetPasswordWithToken,
  changePassword,
} from '../services/authService.js';
import { resolveOrgId } from '../utils/users.js';
import { profileHasRole } from '../middleware/auth.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const result = await loginWithEmailPassword(email, password);
    if (result.error) {
      return res.status(result.status || 401).json({ success: false, error: result.error });
    }

    return res.json({ success: true, token: result.token, user: result.user, profile: result.profile });
  } catch (err) {
    return next(err);
  }
}

export async function register(req, res, next) {
  try {
    const actor = req.profile;
    const { email, password, full_name, role, organization_id, phone } = req.body || {};

    if (!email || !password || !full_name || !role) {
      return res.status(400).json({ success: false, error: 'email, password, full_name, and role required' });
    }

    const allowedRoles = ['admin', 'teacher', 'student', 'parent'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role for registration' });
    }

    if (profileHasRole(actor, ['super_admin'])) {
      // Super admin can register any user
    } else if (profileHasRole(actor, ['admin'])) {
      if (role === 'admin' || role === 'super_admin') {
        return res.status(403).json({ success: false, error: 'Admins cannot create other administrators' });
      }
    } else {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const orgId = resolveOrgId(actor, organization_id);
    if (!orgId) {
      return res.status(400).json({ success: false, error: 'organization_id required' });
    }

    const result = await registerUser({
      email,
      password,
      full_name,
      role,
      organization_id: orgId,
      phone,
    });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        duplicate: result.duplicate || false,
      });
    }

    return res.status(201).json({ success: true, token: result.token, user: result.user });
  } catch (err) {
    return next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const me = await getMeFromProfileId(req.profile.id);
    if (!me) return res.status(404).json({ success: false, error: 'Profile not found' });
    return res.json(me);
  } catch (err) {
    return next(err);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, error: 'email required' });

    const result = await requestPasswordReset(email);
    const payload = { ok: result.ok, success: true, message: result.message };
    if (process.env.NODE_ENV !== 'production' && result.resetToken) {
      payload.resetToken = result.resetToken;
    }
    return res.json(payload);
  } catch (err) {
    return next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { token, password } = req.body || {};
    const result = await resetPasswordWithToken(token, password);
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }
    return res.json({ ok: true, success: true, message: result.message });
  } catch (err) {
    return next(err);
  }
}

export async function userChangePassword(req, res, next) {
  try {
    const userId = req.profile.user_id;
    const { currentPassword, newPassword } = req.body || {};

    const result = await changePassword({ userId, currentPassword, newPassword });
    if (result.error) {
      return res.status(result.status || 400).json({ success: false, error: result.error });
    }

    return res.json({ ok: true, success: true, message: result.message });
  } catch (err) {
    return next(err);
  }
}

export function logout(_req, res) {
  return res.json({ ok: true, success: true, message: 'Logged out. Discard the JWT on the client.' });
}

export default {
  login,
  register,
  getMe,
  forgotPassword,
  resetPassword,
  userChangePassword,
  logout,
};
