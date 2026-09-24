import mongoose from 'mongoose';
import { profileHasRole } from '../middleware/auth.js';
import { Organization, Student, Teacher, Parent } from '../models/index.js';
import { createAuthUser } from '../utils/users.js';

export async function getOrganizations(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Super Admin access required' });
    }

    const orgs = await Organization.find().sort({ created_at: -1 });

    const withStats = await Promise.all(
      orgs.map(async (o) => {
        const id = o._id;
        const [students, teachers, parents] = await Promise.all([
          Student.countDocuments({ organization_id: id }),
          Teacher.countDocuments({ organization_id: id }),
          Parent.countDocuments({ organization_id: id }),
        ]);
        return { ...o.toJSON(), stats: { students, teachers, parents } };
      })
    );

    return res.json(withStats);
  } catch (err) {
    return next(err);
  }
}

export async function getOrganizationById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid organization ID' });
    }

    const profile = req.profile;
    // Allow super_admin or admin of that organization
    if (profile.role !== 'super_admin' && profile.organization_id?.toString() !== id.toString()) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization' });
    }

    const org = await Organization.findById(id);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    const [students, teachers, parents] = await Promise.all([
      Student.countDocuments({ organization_id: id }),
      Teacher.countDocuments({ organization_id: id }),
      Parent.countDocuments({ organization_id: id }),
    ]);

    return res.json({
      ...org.toJSON(),
      stats: { students, teachers, parents },
    });
  } catch (err) {
    return next(err);
  }
}

export async function createOrganization(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['super_admin'])) {
      return res.status(403).json({ success: false, error: 'Only Super Admin can create organizations' });
    }

    const { name, code, address, phone, email, admin_name, admin_email } = req.body || {};
    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'name and code required' });
    }

    const existingCode = await Organization.findOne({ code: code.toUpperCase().trim() });
    if (existingCode) {
      return res.status(409).json({ success: false, error: 'Organization code already in use' });
    }

    const org = await Organization.create({
      name,
      code: code.toUpperCase().trim(),
      address,
      phone,
      email,
      active: true,
    });

    if (admin_email) {
      await createAuthUser({
        email: admin_email,
        full_name: admin_name || admin_email,
        role: 'admin',
        organization_id: org._id,
      });
    }

    return res.status(201).json(org.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateOrganization(req, res, next) {
  try {
    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid organization ID required' });
    }

    const profile = req.profile;
    // super_admin can update all; admin can only update non-code fields of own org
    if (profile.role !== 'super_admin') {
      if (!profileHasRole(profile, ['admin']) || profile.organization_id?.toString() !== id.toString()) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    }

    const { id: _ignored, code: _ignoredCode, ...rest } = req.body || {};
    // Only super_admin can alter code or active state
    if (profile.role !== 'super_admin') {
      delete rest.active;
    }

    const org = await Organization.findByIdAndUpdate(id, rest, { new: true });
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    return res.json(org.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteOrganization(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid organization ID required' });
    }

    const org = await Organization.findByIdAndDelete(id);
    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });
    return res.json({ ok: true, success: true, message: 'Organization deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
};
