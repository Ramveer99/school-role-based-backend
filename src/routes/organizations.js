import { Router } from 'express';
import { organizationPasswordAccess, readDefaultPassword, updateDefaultPassword } from '../controllers/defaultPasswordController.js';
import organizationLedger from './organizationLedger.js';
import organizationMembers from './organizationMembers.js';
import {
  getOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/organizationController.js';

const router = Router();

router.use('/:organizationId/ledger', organizationLedger);
router.use('/:organizationId', organizationMembers);

router.get('/:id/default-password', organizationPasswordAccess, readDefaultPassword);
router.put('/:id/default-password', organizationPasswordAccess, updateDefaultPassword);

router.get('/', getOrganizations);
router.get('/:id', getOrganizationById);
router.post('/', createOrganization);
router.put('/:id', updateOrganization);
router.put('/', updateOrganization);
router.delete('/:id', deleteOrganization);
router.delete('/', deleteOrganization);

export default router;
