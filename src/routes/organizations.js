import { Router } from 'express';
import {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/organizationController.js';

const router = Router();

router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.post('/', createOrganization);
router.put('/:id', updateOrganization);
router.put('/', updateOrganization);
router.delete('/:id', deleteOrganization);
router.delete('/', deleteOrganization);

export default router;
