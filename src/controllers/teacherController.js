import { getDefaultPassword } from '../services/defaultPasswordService.js';
import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { User, Profile, Teacher } from '../models/index.js';
import { createAuthUser, resolveOrgId } from '../utils/users.js';
import { attachAvatarUrls } from '../utils/avatarMap.js';

async function syncTeacherAuthAccount(teacherDoc, updates = {}) {
  if (!teacherDoc?.profile_id) return;

  const profile = await Profile.findById(teacherDoc.profile_id);
  if (!profile) return;

  const user = await User.findById(profile.user_id);
  if (!user) return;

  const nextEmail = typeof updates.email === 'string' ? updates.email.toLowerCase().trim() : null;
  const nextFullName = typeof updates.full_name === 'string' ? updates.full_name.trim() : null;
  const nextPhone = updates.phone !== undefined ? updates.phone || null : undefined;

  if (nextEmail && nextEmail !== user.email) {
    const existingUser = await User.findOne({ email: nextEmail, _id: { $ne: user._id } });
    if (existingUser) {
      const err = new Error('User account with this email already exists');
      err.statusCode = 409;
      throw err;
    }
    user.email = nextEmail;
  }

  if (updates.password) {
    user.password = updates.password;
  }

  if (nextFullName) {
    profile.full_name = nextFullName;
  }

  if (nextPhone !== undefined) {
    profile.phone = nextPhone;
  }

  if (nextEmail) {
    profile.email = nextEmail;
  }

  await user.save();
  await profile.save();
}

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

    const normalizedEmail = String(b.email).toLowerCase().trim();
    const explicitPassword = typeof b.password === 'string' && b.password.trim() ? b.password : '';
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, error: `User account with email "${normalizedEmail}" already exists` });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id required' });

    const existingEmployee = await Teacher.findOne({ organization_id, employee_id: b.employee_id });
    if (existingEmployee) {
      return res.status(409).json({ success: false, error: 'Employee ID already registered in this organization' });
    }

    const userId = await createAuthUser({
      email: normalizedEmail,
      password: explicitPassword || await getDefaultPassword(organization_id),
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
    const { id: _ignored, password, ...rest } = req.body || {};
    const cleanRest = { ...rest };

    if (cleanRest.email) cleanRest.email = String(cleanRest.email).toLowerCase().trim();
    if (cleanRest.full_name) cleanRest.full_name = String(cleanRest.full_name).trim();
    if (cleanRest.phone !== undefined) cleanRest.phone = cleanRest.phone || null;

    const teacher = await Teacher.findOne(filter);
    if (!teacher) return res.status(404).json({ success: false, error: 'Teacher not found' });

    try {
      await syncTeacherAuthAccount(teacher, { ...cleanRest, password });
    } catch (err) {
      return res.status(err.statusCode || 400).json({ success: false, error: err.message || 'Could not update teacher login account' });
    }

    const updated = await Teacher.findOneAndUpdate(filter, cleanRest, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Teacher not found' });
    return res.json(updated.toJSON());
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
