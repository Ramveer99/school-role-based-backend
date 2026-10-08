import { Router } from 'express';
import mongoose from 'mongoose';
import { requireRole } from '../middleware/auth.js';
import { Organization, Student, Teacher, Parent, User } from '../models/index.js';
import students from '../controllers/studentController.js';
import teachers from '../controllers/teacherController.js';
import parents from '../controllers/parentController.js';

const router = Router({ mergeParams: true });
const resources = [
  ['students', Student, students, 'Student', 'Students'],
  ['teachers', Teacher, teachers, 'Teacher', 'Teachers'],
  ['parents', Parent, parents, 'Parent', 'Parents'],
];
const writable = {
  students: ['full_name', 'email', 'phone', 'password', 'admission_no', 'roll_no', 'class_grade', 'section', 'gender', 'dob', 'address', 'teacher_id', 'status'],
  teachers: ['full_name', 'email', 'phone', 'password', 'employee_id', 'department', 'subjects', 'classes', 'status', 'joining_date'],
  parents: ['full_name', 'email', 'phone', 'password', 'occupation', 'address'],
};
const validId = (id) => typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
const fail = (res, status, error) => res.status(status).json({ success: false, error });

// Leave the existing organization detail/update/delete routes untouched.
router.use((req, res, next) => /^\/(students|teachers|parents)(\/|$)/.test(req.path) ? next() : next('router'));
router.use(requireRole('super_admin'));
router.use(async (req, res, next) => {
  try {
    if (!validId(req.params.organizationId)) return fail(res, 400, 'Invalid organization ID');
    const organization = await Organization.findById(req.params.organizationId);
    if (!organization) return fail(res, 404, 'Organization not found');
    req.memberOrganizationId = organization.id;
    return next();
  } catch (error) { return next(error); }
});

for (const [resource, Model, handlers, singular, plural] of resources) {
  const delegate = (action) => async (req, res, next) => {
    try {
      const organization_id = req.memberOrganizationId;
      if (req.params.id) {
        if (!validId(req.params.id)) return fail(res, 400, `Invalid ${singular.toLowerCase()} ID`);
        if (!await Model.exists({ _id: req.params.id, organization_id })) {
          return fail(res, 404, `${singular} not found in organization`);
        }
      }
      const body = req.body || {};
      if (body.organization_id !== undefined && body.organization_id !== organization_id) {
        return fail(res, 400, 'organization_id must match the organization in the URL');
      }
      if (action === 'create' || action === 'update') {
        const allowed = [...writable[resource], 'organization_id'];
        if (action === 'create') allowed.push('avatar_image', ...(resource === 'students' ? ['parent', 'parent_id'] : []));
        if (Object.keys(body).some((key) => !allowed.includes(key))) {
          return fail(res, 400, 'Unsupported field; account links and organization membership cannot be changed');
        }
        for (const key of ['teacher_id', 'parent_id']) {
          if (!body[key]) continue;
          const Related = key === 'teacher_id' ? Teacher : Parent;
          if (!validId(body[key]) || !await Related.exists({ _id: body[key], organization_id })) {
            return fail(res, 400, `${key} must belong to this organization`);
          }
        }
        // Validate before existing handlers synchronize login records or create accounts.
        const candidate = action === 'update'
          ? await Model.findOne({ _id: req.params.id, organization_id })
          : new Model({ organization_id });
        for (const key of writable[resource]) {
          if (key !== 'password' && body[key] !== undefined) candidate.set(key, body[key]);
        }
        await candidate.validate();
        if (action === 'create') {
          const emails = [body.email, resource === 'students' ? body.parent?.email : null]
            .filter(Boolean).map((email) => String(email).toLowerCase().trim());
          for (const email of emails) {
            // Existing parents within this school can be reused by the original flow.
            const reusableParent = (resource === 'parents' || email === body.parent?.email?.toLowerCase().trim())
              && await Parent.exists({ email, organization_id });
            if (!reusableParent && await User.exists({ email })) return fail(res, 409, 'User account with this email already exists');
          }
          if (emails.length === 2 && emails[0] === emails[1]) return fail(res, 400, 'Student and parent emails must differ');
        }
      }
      // Delegate with school-admin scope so existing orgFilter queries enforce the
      // selected school. The original authenticated request/identity is unchanged.
      const scopedRequest = Object.create(req);
      scopedRequest.profile = { ...req.profile, role: 'admin', organization_id };
      scopedRequest.body = { ...body, organization_id };
      const handler = action === 'list' ? handlers[`get${plural}`]
        : action === 'get' ? handlers[`get${singular}ById`]
        : handlers[`${action}${singular}`];
      return handler(scopedRequest, res, next);
    } catch (error) {
      if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
        return fail(res, 400, error.message);
      }
      return next(error);
    }
  };
  router.get(`/${resource}`, delegate('list'));
  router.post(`/${resource}`, delegate('create'));
  router.get(`/${resource}/:id`, delegate('get'));
  router.put(`/${resource}/:id`, delegate('update'));
  router.delete(`/${resource}/:id`, delegate('delete'));
}

export default router;
