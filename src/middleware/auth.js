import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Profile } from '../models/index.js';
import { env } from '../config/env.js';

export function signToken(profile) {
  const orgRef = profile.organization_id;
  const organizationId =
    orgRef?._id?.toString?.() ||
    (typeof orgRef === 'string' ? orgRef : orgRef?.toString?.()) ||
    null;

  return jwt.sign(
    {
      sub: profile._id.toString(),
      userId: profile.user_id?.toString?.() || profile.user_id,
      role: profile.role,
      email: profile.email,
      organization_id: organizationId,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function resolveProfileFromToken(token) {
  if (!token) return null;

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }

  const profile = await Profile.findById(payload.sub).populate('organization_id', 'name code active');
  if (!profile) return null;

  const json = profile.toJSON();
  const org = profile.organization_id;
  const orgId =
    org?._id?.toString?.() ||
    (typeof org === 'string' ? org : null) ||
    json.organization_id ||
    null;

  return {
    ...json,
    user_id: profile.user_id?.toString?.() || profile.user_id,
    organization_id: orgId,
    organization: org && org.name
      ? {
          id: org._id?.toString?.() || org.id,
          name: org.name,
          code: org.code,
          active: org.active,
        }
      : null,
  };
}

export async function getProfile(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  return resolveProfileFromToken(token);
}

export function profileHasRole(profile, roles) {
  if (!profile) return false;
  return roles.includes(profile.role);
}

export function orgFilter(profile, field = 'organization_id') {
  if (profile.role === 'super_admin') return {};
  if (!profile.organization_id) return { [field]: null };
  return { [field]: new mongoose.Types.ObjectId(profile.organization_id) };
}

export async function authenticateToken(req, res, next) {
  try {
    const profile = await getProfile(req);
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });
    req.profile = profile;
    req.user = profile;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** @deprecated use authenticateToken */
export const requireAuth = authenticateToken;

export function requireRole(...roles) {
  const flat = roles.flat();
  return (req, res, next) => {
    if (!profileHasRole(req.profile, flat)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

/** @deprecated use profileHasRole in route handlers or requireRole middleware */
export function requireRoles(...roles) {
  return requireRole(...roles);
}

export function requireOrganizationAccess(options = {}) {
  const paramKey = options.param || 'organization_id';
  const bodyKey = options.bodyKey || 'organization_id';

  return (req, res, next) => {
    const profile = req.profile;
    if (!profile) return res.status(401).json({ error: 'Unauthorized' });
    if (profile.role === 'super_admin') return next();

    const targetOrg =
      req.params?.[paramKey] ||
      req.body?.[bodyKey] ||
      req.query?.[paramKey] ||
      null;

    if (targetOrg && targetOrg.toString() !== profile.organization_id?.toString()) {
      return res.status(403).json({ error: 'Forbidden: organization access denied' });
    }
    return next();
  };
}
