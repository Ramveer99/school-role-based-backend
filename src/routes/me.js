import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  const profile = req.profile;
  res.json({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role: profile.role,
    organization_id: profile.organization_id,
    organization_name: profile.organization?.name || null,
    avatar_url: profile.avatar_url,
    phone: profile.phone,
  });
});

export default router;
