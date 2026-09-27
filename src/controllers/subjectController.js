import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Subject, Teacher, ClassModel } from '../models/index.js';
import { resolveOrgId } from '../utils/users.js';

export async function getSubjects(req, res, next) {
  try {
    const profile = req.profile;
    const baseFilter = orgFilter(profile);

    // If query requests grouped subjects, delegate to grouping logic
    if (req.query.grouped === 'true' || req.query.grouped === '1') {
      return getGroupedSubjects(req, res, next);
    }

    const filter = { ...baseFilter };

    if (req.query.class_grade) {
      filter.class_grade = String(req.query.class_grade).trim();
    }
    if (req.query.section) {
      filter.section = String(req.query.section).trim();
    }
    if (req.query.teacher_id && mongoose.Types.ObjectId.isValid(req.query.teacher_id)) {
      filter.$or = [
        { teacher_id: req.query.teacher_id },
        { teachers: req.query.teacher_id },
      ];
    }
    if (req.query.class_id && mongoose.Types.ObjectId.isValid(req.query.class_id)) {
      filter.class_id = req.query.class_id;
    }

    const subjects = await Subject.find(filter)
      .populate('teacher_id', 'full_name email phone employee_id department subjects')
      .populate('teachers', 'full_name email phone employee_id department subjects')
      .populate('class_id', 'grade section')
      .sort({ class_grade: 1, section: 1, name: 1 });

    const data = subjects.map((s) => {
      const json = s.toJSON();
      const teacher = s.teacher_id;
      return {
        ...json,
        teacher: teacher
          ? {
              id: teacher._id?.toString(),
              full_name: teacher.full_name,
              email: teacher.email,
              phone: teacher.phone,
              employee_id: teacher.employee_id,
              department: teacher.department,
            }
          : null,
        teacher_name: teacher?.full_name || null,
        teachers: (s.teachers || []).map((t) => ({
          id: t._id?.toString?.() || t.toString(),
          full_name: t.full_name || null,
          email: t.email || null,
          phone: t.phone || null,
        })),
        class_name: s.class_grade ? `Class ${s.class_grade}${s.section ? `-${s.section}` : ''}` : '',
      };
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function getGroupedSubjects(req, res, next) {
  try {
    const profile = req.profile;
    const baseFilter = orgFilter(profile);

    const filter = { ...baseFilter };
    if (req.query.class_grade) {
      filter.class_grade = String(req.query.class_grade).trim();
    }
    if (req.query.section) {
      filter.section = String(req.query.section).trim();
    }

    const subjects = await Subject.find(filter)
      .populate('teacher_id', 'full_name email phone employee_id department')
      .populate('teachers', 'full_name email phone employee_id department')
      .sort({ class_grade: 1, section: 1, name: 1 });

    // Fetch classes for this organization to enrich class information
    const classes = await ClassModel.find(baseFilter).populate('teacher_id', 'full_name email');
    const classMap = new Map();
    classes.forEach((c) => {
      classMap.set(`${c.grade}-${c.section}`, c);
    });

    // Group subjects by class_grade and section
    const groupMap = new Map();

    subjects.forEach((s) => {
      const key = `${s.class_grade}__${s.section || 'all'}`;
      if (!groupMap.has(key)) {
        const classObj = classMap.get(`${s.class_grade}-${s.section}`) || null;
        groupMap.set(key, {
          class_grade: s.class_grade,
          section: s.section || '',
          class_name: `Class ${s.class_grade}${s.section ? `-${s.section}` : ''}`,
          class_id: classObj?._id?.toString() || s.class_id?.toString() || null,
          class_teacher: classObj?.teacher_id
            ? {
                id: classObj.teacher_id._id?.toString(),
                full_name: classObj.teacher_id.full_name,
                email: classObj.teacher_id.email,
              }
            : null,
          class_teacher_name: classObj?.teacher_id?.full_name || null,
          subjects_count: 0,
          subjects: [],
        });
      }

      const group = groupMap.get(key);
      const teacher = s.teacher_id;
      group.subjects.push({
        id: s._id.toString(),
        _id: s._id.toString(),
        name: s.name,
        code: s.code || '',
        class_grade: s.class_grade,
        section: s.section || '',
        description: s.description || '',
        status: s.status || 'Active',
        teacher_id: teacher?._id?.toString() || null,
        teacher_name: teacher?.full_name || null,
        teacher: teacher
          ? {
              id: teacher._id?.toString(),
              full_name: teacher.full_name,
              email: teacher.email,
              phone: teacher.phone,
              department: teacher.department,
            }
          : null,
        teachers: (s.teachers || []).map((t) => ({
          id: t._id?.toString?.() || t.toString(),
          full_name: t.full_name || null,
          email: t.email || null,
          phone: t.phone || null,
        })),
      });
      group.subjects_count = group.subjects.length;
    });

    // Also include classes that currently have no subjects registered yet
    if (!req.query.class_grade && !req.query.section) {
      classes.forEach((c) => {
        const key = `${c.grade}__${c.section || 'all'}`;
        if (!groupMap.has(key)) {
          groupMap.set(key, {
            class_grade: c.grade,
            section: c.section || '',
            class_name: `Class ${c.grade}${c.section ? `-${c.section}` : ''}`,
            class_id: c._id.toString(),
            class_teacher: c.teacher_id
              ? {
                  id: c.teacher_id._id?.toString(),
                  full_name: c.teacher_id.full_name,
                  email: c.teacher_id.email,
                }
              : null,
            class_teacher_name: c.teacher_id?.full_name || null,
            subjects_count: 0,
            subjects: [],
          });
        }
      });
    }

    const result = Array.from(groupMap.values()).sort((a, b) => {
      if (a.class_grade !== b.class_grade) {
        return a.class_grade.localeCompare(b.class_grade, undefined, { numeric: true });
      }
      return a.section.localeCompare(b.section);
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

export async function getSubjectById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid subject ID' });
    }

    const subject = await Subject.findById(id)
      .populate('teacher_id', 'full_name email phone employee_id department subjects')
      .populate('teachers', 'full_name email phone employee_id department subjects')
      .populate('class_id', 'grade section teacher_id');

    if (!subject) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    const profile = req.profile;
    if (
      profile.role !== 'super_admin' &&
      subject.organization_id.toString() !== profile.organization_id?.toString()
    ) {
      return res.status(403).json({ success: false, error: 'Forbidden: Access denied to other organization' });
    }

    const json = subject.toJSON();
    const teacher = subject.teacher_id;

    return res.json({
      ...json,
      teacher: teacher
        ? {
            id: teacher._id?.toString(),
            full_name: teacher.full_name,
            email: teacher.email,
            phone: teacher.phone,
            department: teacher.department,
          }
        : null,
      teacher_name: teacher?.full_name || null,
      teachers: (subject.teachers || []).map((t) => ({
        id: t._id?.toString?.() || t.toString(),
        full_name: t.full_name || null,
        email: t.email || null,
        phone: t.phone || null,
      })),
      class_name: subject.class_grade ? `Class ${subject.class_grade}${subject.section ? `-${subject.section}` : ''}` : '',
    });
  } catch (err) {
    return next(err);
  }
}

export async function createSubject(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const b = req.body || {};
    if (!b.name || (!b.class_grade && !b.grade && !b.class_id)) {
      return res.status(400).json({
        success: false,
        error: 'name and class_grade (or grade / class_id) are required',
      });
    }

    const organization_id = resolveOrgId(req.profile, b.organization_id);
    if (!organization_id) {
      return res.status(400).json({ success: false, error: 'organization_id required' });
    }

    let class_grade = b.class_grade || b.grade || '';
    let section = b.section || '';
    let class_id = b.class_id || null;

    if (class_id && mongoose.Types.ObjectId.isValid(class_id)) {
      const classDoc = await ClassModel.findById(class_id);
      if (classDoc && classDoc.organization_id.toString() === organization_id.toString()) {
        class_grade = classDoc.grade;
        section = section || classDoc.section;
      }
    } else if (class_grade) {
      const classDoc = await ClassModel.findOne({
        organization_id,
        grade: String(class_grade).trim(),
        section: section ? String(section).trim() : { $exists: true },
      });
      if (classDoc) {
        class_id = classDoc._id;
      }
    }

    class_grade = String(class_grade).trim();
    section = String(section || '').trim();

    // Verify teacher is from available teachers in DB for this school
    let teacherId = b.teacher_id || null;
    if (teacherId) {
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(400).json({ success: false, error: 'Invalid teacher_id format' });
      }
      const teacher = await Teacher.findOne({ _id: teacherId, organization_id });
      if (!teacher) {
        return res.status(400).json({
          success: false,
          error: 'Assigned teacher not found among available teachers in this school database',
        });
      }
    }

    // Verify multiple teachers if provided
    let teachersList = [];
    if (Array.isArray(b.teachers)) teachersList.push(...b.teachers);
    if (Array.isArray(b.teacher_ids)) teachersList.push(...b.teacher_ids);
    if (teacherId && !teachersList.some((t) => t.toString() === teacherId.toString())) {
      teachersList.push(teacherId);
    }

    if (teachersList.length) {
      const validTeachers = await Teacher.find({
        _id: { $in: teachersList },
        organization_id,
      }).select('_id');
      teachersList = validTeachers.map((t) => t._id);
    }

    const name = String(b.name).trim();

    const existing = await Subject.findOne({
      organization_id,
      class_grade,
      section,
      name,
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Subject "${name}" already exists for Class ${class_grade}${section ? `-${section}` : ''}`,
      });
    }

    const subject = await Subject.create({
      organization_id,
      name,
      code: b.code ? String(b.code).trim().toUpperCase() : '',
      class_grade,
      section,
      class_id,
      teacher_id: teacherId,
      teachers: teachersList,
      description: b.description || '',
      status: b.status || 'Active',
    });

    // If teacher is assigned, also ensure they are part of the class teachers list
    if (class_id && teacherId) {
      await ClassModel.findByIdAndUpdate(class_id, {
        $addToSet: { teachers: teacherId },
      }).catch(() => {});
    }

    const populated = await Subject.findById(subject._id)
      .populate('teacher_id', 'full_name email phone')
      .populate('teachers', 'full_name email phone');

    const json = populated.toJSON();
    const teacher = populated.teacher_id;

    return res.status(201).json({
      ...json,
      teacher_id: teacher?._id?.toString?.() || teacherId?.toString?.() || null,
      teacher_name: teacher?.full_name || null,
      teacher: teacher
        ? {
            id: teacher._id?.toString(),
            full_name: teacher.full_name,
            email: teacher.email,
            phone: teacher.phone,
          }
        : null,
      teachers: (populated.teachers || []).map((t) => ({
        id: t._id?.toString?.() || t.toString(),
        full_name: t.full_name || null,
        email: t.email || null,
        phone: t.phone || null,
      })),
      class_name: populated.class_grade
        ? `Class ${populated.class_grade}${populated.section ? `-${populated.section}` : ''}`
        : '',
    });
  } catch (err) {
    return next(err);
  }
}

export async function updateSubject(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid subject ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const existing = await Subject.findOne(filter);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    const { id: _ignored, ...updateData } = req.body || {};

    // Validate new teacher against available teachers in DB if provided
    if (updateData.teacher_id !== undefined) {
      if (updateData.teacher_id) {
        if (!mongoose.Types.ObjectId.isValid(updateData.teacher_id)) {
          return res.status(400).json({ success: false, error: 'Invalid teacher_id format' });
        }
        const teacher = await Teacher.findOne({
          _id: updateData.teacher_id,
          organization_id: existing.organization_id,
        });
        if (!teacher) {
          return res.status(400).json({
            success: false,
            error: 'Teacher not found among available teachers in this school database',
          });
        }
      }
    }

    if (updateData.teacher_ids && Array.isArray(updateData.teacher_ids)) {
      const validTeachers = await Teacher.find({
        _id: { $in: updateData.teacher_ids },
        organization_id: existing.organization_id,
      }).select('_id');
      updateData.teachers = validTeachers.map((t) => t._id);
      delete updateData.teacher_ids;
    }

    if (updateData.code) {
      updateData.code = String(updateData.code).trim().toUpperCase();
    }
    if (updateData.name) {
      updateData.name = String(updateData.name).trim();
    }

    const updated = await Subject.findOneAndUpdate(filter, updateData, { new: true })
      .populate('teacher_id', 'full_name email phone department')
      .populate('teachers', 'full_name email phone');

    // Keep class teachers synchronized
    if (updated.class_id && updated.teacher_id) {
      await ClassModel.findByIdAndUpdate(updated.class_id, {
        $addToSet: { teachers: updated.teacher_id },
      }).catch(() => {});
    }

    const json = updated.toJSON();
    const teacher = updated.teacher_id;

    return res.json({
      ...json,
      teacher_id: teacher?._id?.toString?.() || (typeof teacher === 'string' ? teacher : null),
      teacher_name: teacher?.full_name || null,
      teacher: teacher && typeof teacher === 'object'
        ? {
            id: teacher._id?.toString(),
            full_name: teacher.full_name,
            email: teacher.email,
            phone: teacher.phone,
            department: teacher.department,
          }
        : null,
      teachers: (updated.teachers || []).map((t) => ({
        id: t._id?.toString?.() || t.toString(),
        full_name: t.full_name || null,
        email: t.email || null,
        phone: t.phone || null,
      })),
      class_name: updated.class_grade
        ? `Class ${updated.class_grade}${updated.section ? `-${updated.section}` : ''}`
        : '',
    });
  } catch (err) {
    return next(err);
  }
}

export async function deleteSubject(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid subject ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const deleted = await Subject.findOneAndDelete(filter);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Subject not found' });
    }

    return res.json({ ok: true, success: true, message: 'Subject deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getSubjects,
  getGroupedSubjects,
  getSubjectById,
  createSubject,
  updateSubject,
  deleteSubject,
};
