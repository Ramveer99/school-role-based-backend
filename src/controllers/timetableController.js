import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Timetable, Student, Parent, StudentParent } from '../models/index.js';

export async function getTimetable(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { class_grade, section } = req.query;

    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (student) {
        if (!class_grade) filter.class_grade = student.class_grade;
        if (!section && student.section) filter.section = student.section;
      }
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (parent) {
        const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
        const students = await Student.find({ _id: { $in: links.map((l) => l.student_id) } });
        if (students.length > 0 && !class_grade) {
          const grades = [...new Set(students.map((s) => s.class_grade))];
          filter.class_grade = { $in: grades };
        }
      }
    }

    if (class_grade) filter.class_grade = String(class_grade);
    if (section) filter.section = String(section);

    const timetables = await Timetable.find(filter).sort({ class_grade: 1, section: 1 });
    return res.json(timetables.map((t) => t.toJSON()));
  } catch (err) {
    return next(err);
  }
}

export async function getTimetableById(req, res, next) {
  try {
    const profile = req.profile;
    const filter = { ...orgFilter(profile), _id: new mongoose.Types.ObjectId(req.params.id) };
    const timetable = await Timetable.findOne(filter);
    if (!timetable) {
      return res.status(404).json({ success: false, error: 'Timetable not found' });
    }
    return res.json(timetable.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function saveTimetable(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const profile = req.profile;
    const b = req.body || {};
    const orgId = profile.role === 'super_admin' ? b.organization_id || profile.organization_id : profile.organization_id;

    if (!orgId) return res.status(400).json({ success: false, error: 'organization_id required' });
    if (!b.class_grade || !b.section) {
      return res.status(400).json({ success: false, error: 'class_grade and section required' });
    }

    const timetable = await Timetable.findOneAndUpdate(
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        class_grade: String(b.class_grade),
        section: String(b.section),
      },
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        class_grade: String(b.class_grade),
        section: String(b.section),
        schedule: Array.isArray(b.schedule) ? b.schedule : [],
      },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json(timetable.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteTimetable(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid timetable ID required' });
    }

    const filter = { ...orgFilter(req.profile), _id: new mongoose.Types.ObjectId(id) };
    const deleted = await Timetable.findOneAndDelete(filter);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Timetable not found' });
    }

    return res.json({ success: true, message: 'Timetable deleted' });
  } catch (err) {
    return next(err);
  }
}

export default {
  getTimetable,
  getTimetableById,
  saveTimetable,
  deleteTimetable,
};
