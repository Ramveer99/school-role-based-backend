import { Router } from 'express';
import { uploadMyAvatar } from '../controllers/profileController.js';
import { getMyChildren } from '../controllers/parentController.js';

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

router.get('/children', getMyChildren);
router.post('/avatar', uploadMyAvatar);

export default router;
