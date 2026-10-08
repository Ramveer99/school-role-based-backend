import { Organization } from '../models/index.js';
import { getDefaultPassword, setDefaultPassword, validateDefaultPassword } from '../services/defaultPasswordService.js';

export async function organizationPasswordAccess(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!['admin', 'super_admin'].includes(req.profile.role)) {
    return res.status(403).json({ error: 'Admin or Super Admin access required' });
  }
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return res.status(400).json({ error: 'Invalid organization ID' });
  if (req.profile.role === 'admin' && req.profile.organization_id?.toString() !== id.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden: organization access denied' });
  }
  try {
    if (!await Organization.exists({ _id: id })) return res.status(404).json({ error: 'Organization not found' });
    return next();
  } catch (error) { return next(error); }
}

export async function readDefaultPassword(req, res, next) {
  try {
    return res.json({ organization_id: req.params.id, default_password: await getDefaultPassword(req.params.id) });
  } catch (error) { return next(error); }
}

export async function updateDefaultPassword(req, res, next) {
  const password = req.body?.default_password;
  if (!validateDefaultPassword(password)) {
    return res.status(400).json({ error: 'default_password must be at least 8 characters, at most 72 UTF-8 bytes, nonblank, and not a bcrypt hash' });
  }
  try {
    await setDefaultPassword(req.params.id, password);
    return res.json({ organization_id: req.params.id, default_password: password });
  } catch (error) { return next(error); }
}
