import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Teacher } from '../models/index.js';
import { createAuthUser, resolveOrgId } from '../utils/users.js';
import { attachAvatarUrls } from '../utils/avatarMap.js';

export async function getTeachers(req, res, next) {
  try {
    const rows = await Teacher.find(orgFilter(req.profile))
      .populate('organization_id', 'name')
      .sort({ created_at: -1 });

    const data = rows.map((t) => {
      const json = t.toJSON();
      return {
        ...json,
        organization: t.organization_id ? { name: t.organization_id.name } : null,
        organization_id: t.organization_id?._id?.toString?.() || json.organization_id,
      };
    });
    return res.json(await attachAvatarUrls(data));
  } catch (err) {
    return next(err);
  }
}

export async function getTeacherById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid teacher ID' });
    }

    const teacher = await Teacher.findById(id).populate('organization_id', 'name code');
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    const profile = req.profile;
    if (
      profile.role !== 'super_admin' &&
      teacher.organization_id?._id?.toString() !== profile.organization_id?.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization' });
    }

    const json = teacher.toJSON();
    const [enriched] = await attachAvatarUrls([
      {
        ...json,
        organization: teacher.organization_id ? { name: teacher.organization_id.name } : null,
        organization_id: teacher.organization_id?._id?.toString?.() || json.organization_id,
      },
    ]);
    return res.json(enriched);
  } catch (err) {
    return next(err);
  }
}

export async function createTeacher(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const b = req.body || {};
    if (!b.full_name || !b.email || !b.employee_id) {
      return res.status(400).json({ success: false, error: 'full_name, email, employee_id required' });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id required' });

    const existingEmployee = await Teacher.findOne({ organization_id, employee_id: b.employee_id });
    if (existingEmployee) {
      return res.status(409).json({ success: false, error: 'Employee ID already registered in this organization' });
    }

    const userId = await createAuthUser({
      email: b.email,
      password: b.password || 'EduCore@123!',
      full_name: b.full_name,
      role: 'teacher',
      organization_id,
      phone: b.phone,
      avatar_image: b.avatar_image,
    });

    const teacher = await Teacher.create({
      organization_id,
      profile_id: userId,
      full_name: b.full_name,
      email: b.email.toLowerCase().trim(),
      phone: b.phone || null,
      employee_id: b.employee_id,
      department: b.department || null,
      subjects: b.subjects || null,
      classes: b.classes || null,
      status: b.status || 'Active',
      joining_date: b.joining_date ? new Date(b.joining_date) : null,
    });

    return res.status(201).json(teacher.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateTeacher(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid teacher ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const { id: _ignored, ...rest } = req.body || {};
    const teacher = await Teacher.findOneAndUpdate(filter, rest, { new: true });
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });
    return res.json(teacher.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteTeacher(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid teacher ID required' });
    }

    const deleted = await Teacher.findOneAndDelete({ _id: id, ...orgFilter(req.profile) });
    if (!deleted) return res.status(404).json({ success: false, error: 'Teacher not found' });
    return res.json({ ok: true, success: true, message: 'Teacher deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
  deleteTeacher,
};
