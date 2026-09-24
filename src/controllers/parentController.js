import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Parent, StudentParent } from '../models/index.js';
import { createAuthUser, resolveOrgId } from '../utils/users.js';

export async function getParents(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    // Parent can only view own record
    if (profile.role === 'parent') {
      filter = { ...filter, profile_id: new mongoose.Types.ObjectId(profile.id) };
    }

    const rows = await Parent.find(filter).sort({ created_at: -1 });
    const parentIds = rows.map((p) => p._id);

    let children = [];
    if (parentIds.length) {
      children = await StudentParent.find({ parent_id: { $in: parentIds } }).populate(
        'student_id',
        'full_name class_grade section admission_no'
      );
    }

    const data = rows.map((p) => {
      const json = p.toJSON();
      return {
        ...json,
        children: children
          .filter((c) => c.parent_id.toString() === p._id.toString())
          .map((c) => (c.student_id ? c.student_id.toJSON() : null))
          .filter(Boolean),
      };
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function getParentById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid parent ID' });
    }

    const parent = await Parent.findById(id);
    if (!parent) return res.status(404).json({ success: false, error: 'Parent not found' });

    const profile = req.profile;

    // Check organization isolation
    if (
      profile.role !== 'super_admin' &&
      parent.organization_id.toString() !== profile.organization_id?.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization' });
    }

    // Parent can only view own record
    if (profile.role === 'parent' && parent.profile_id?.toString() !== profile.id?.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot access other parent records' });
    }

    const childrenLinks = await StudentParent.find({ parent_id: parent._id }).populate(
      'student_id',
      'full_name class_grade section admission_no phone'
    );

    return res.json({
      ...parent.toJSON(),
      children: childrenLinks.map((c) => (c.student_id ? c.student_id.toJSON() : null)).filter(Boolean),
    });
  } catch (err) {
    return next(err);
  }
}

export async function createParent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const b = req.body || {};
    if (!b.full_name || !b.email) {
      return res.status(400).json({ success: false, error: 'full_name and email required' });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id required' });

    const existing = await Parent.findOne({
      organization_id,
      email: b.email.toLowerCase().trim(),
    });
    if (existing) return res.json(existing.toJSON());

    const userId = await createAuthUser({
      email: b.email,
      password: b.password || 'EduCore@123!',
      full_name: b.full_name,
      role: 'parent',
      organization_id,
      phone: b.phone,
    });

    const parent = await Parent.create({
      organization_id,
      profile_id: userId,
      full_name: b.full_name,
      email: b.email.toLowerCase().trim(),
      phone: b.phone || null,
      occupation: b.occupation || null,
      address: b.address || null,
    });

    return res.status(201).json(parent.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateParent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid parent ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const { id: _ignored, ...updateData } = req.body || {};

    const parent = await Parent.findOneAndUpdate(filter, updateData, { new: true });
    if (!parent) return res.status(404).json({ success: false, error: 'Parent not found' });

    return res.json(parent.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteParent(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid parent ID required' });
    }

    const deleted = await Parent.findOneAndDelete({ _id: id, ...orgFilter(req.profile) });
    if (!deleted) return res.status(404).json({ success: false, error: 'Parent not found' });

    await StudentParent.deleteMany({ parent_id: id });
    return res.json({ ok: true, success: true, message: 'Parent deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getParents,
  getParentById,
  createParent,
  updateParent,
  deleteParent,
};
