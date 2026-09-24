import { Router } from 'express';
import mongoose from 'mongoose';
import { profileHasRole, orgFilter } from '../middleware/auth.js';
import { Notice } from '../models/index.js';
import { resolveOrgId } from '../utils/users.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    if (profile.role === 'student') {
      filter = { ...filter, audience: { $in: ['Everyone', 'Students', 'students', 'all'] } };
    } else if (profile.role === 'parent') {
      filter = { ...filter, audience: { $in: ['Everyone', 'Parents', 'parents', 'all'] } };
    } else if (profile.role === 'teacher') {
      filter = { ...filter, audience: { $in: ['Everyone', 'Teachers', 'teachers', 'all'] } };
    }

    const rows = await Notice.find(filter).sort({ created_at: -1 });
    return res.json(rows.map((n) => n.toJSON()));
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notice ID' });
    }

    const notice = await Notice.findOne({ _id: id, ...orgFilter(req.profile) });
    if (!notice) return res.status(404).json({ success: false, error: 'Notice not found' });

    return res.json(notice.toJSON());
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const b = req.body || {};
    if (!b.title) {
      return res.status(400).json({ success: false, error: 'title is required' });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) return res.status(400).json({ success: false, error: 'organization_id required' });

    const notice = await Notice.create({
      organization_id,
      title: b.title,
      description: b.description || '',
      audience: b.audience || 'Everyone',
      color: b.color || 'blue',
      created_by: req.profile.id,
    });

    return res.status(201).json(notice.toJSON());
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid notice ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const { id: _ignored, ...updateData } = req.body || {};

    const updated = await Notice.findOneAndUpdate(filter, updateData, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: 'Notice not found' });

    return res.json(updated.toJSON());
  } catch (err) {
    return next(err);
  }
});

router.put('/', async (req, res, next) => {
  return router.handle({ ...req, url: `/${req.body?.id}`, method: 'PUT' }, res, next);
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid notice ID required' });
    }

    const deleted = await Notice.findOneAndDelete({ _id: id, ...orgFilter(req.profile) });
    if (!deleted) return res.status(404).json({ success: false, error: 'Notice not found' });

    return res.json({ ok: true, success: true, message: 'Notice deleted successfully' });
  } catch (err) {
    return next(err);
  }
});

router.delete('/', async (req, res, next) => {
  return router.handle({ ...req, url: `/${req.body?.id}`, method: 'DELETE' }, res, next);
});

export default router;
