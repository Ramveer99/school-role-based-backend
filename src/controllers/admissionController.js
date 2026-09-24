import { profileHasRole } from '../middleware/auth.js';
import { processStudentAdmission } from '../services/admissionService.js';

export async function createAdmission(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const body = req.body || {};
    const studentData = body.student || {};
    const parentData = body.parent || null;
    const parentId = body.parent_id || null;
    const organizationId = body.organization_id || studentData.organization_id || null;

    const result = await processStudentAdmission({
      actorProfile: req.profile,
      studentData,
      parentData,
      parentId,
      organizationId,
    });

    if (result.error) {
      return res.status(result.status || 400).json({
        success: false,
        error: result.error,
        code: result.code,
      });
    }

    return res.status(201).json({
      success: true,
      ok: true,
      message: result.message,
      student: result.student,
      parent_id: result.parent_id,
    });
  } catch (err) {
    return next(err);
  }
}

export default {
  createAdmission,
};
