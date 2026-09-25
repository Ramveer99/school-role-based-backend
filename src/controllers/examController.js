import mongoose from 'mongoose';
import { orgFilter, profileHasRole } from '../middleware/auth.js';
import { Exam, Result, Student, Parent, StudentParent } from '../models/index.js';

function computeGrade(marks, total) {
  if (!total || total <= 0) return 'N/A';
  const pct = (marks / total) * 100;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 35) return 'E';
  return 'F';
}

export async function getExams(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { class_grade, term } = req.query;
    if (class_grade) filter = { ...filter, class_grade: String(class_grade) };
    if (term) filter = { ...filter, term: String(term) };

    const exams = await Exam.find(filter).sort({ date: 1 });
    return res.json(exams.map((e) => e.toJSON()));
  } catch (err) {
    return next(err);
  }
}

export async function getExamById(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid exam ID' });
    }

    const exam = await Exam.findOne({ _id: id, ...orgFilter(req.profile) });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });
    return res.json(exam.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function createExam(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const profile = req.profile;
    const b = req.body || {};
    const orgId = profile.role === 'super_admin' ? b.organization_id || profile.organization_id : profile.organization_id;

    if (!orgId) return res.status(400).json({ success: false, error: 'organization_id required' });
    if (!b.title || !b.class_grade || !b.subject || !b.date) {
      return res.status(400).json({ success: false, error: 'title, class_grade, subject, and date required' });
    }

    const exam = await Exam.create({
      organization_id: new mongoose.Types.ObjectId(orgId),
      title: b.title,
      term: b.term || 'Term 1',
      class_grade: String(b.class_grade),
      subject: b.subject,
      date: new Date(b.date),
      start_time: b.start_time || '09:00 AM',
      duration: b.duration || '2 Hours',
      total_marks: Number(b.total_marks || 100),
      passing_marks: Number(b.passing_marks || 35),
    });

    return res.status(201).json(exam.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function updateExam(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid exam ID required' });
    }

    const b = req.body || {};
    const updates = {};
    if (b.title !== undefined) updates.title = b.title;
    if (b.term !== undefined) updates.term = b.term;
    if (b.class_grade !== undefined) updates.class_grade = String(b.class_grade);
    if (b.subject !== undefined) updates.subject = b.subject;
    if (b.date !== undefined) updates.date = new Date(b.date);
    if (b.start_time !== undefined) updates.start_time = b.start_time;
    if (b.duration !== undefined) updates.duration = b.duration;
    if (b.total_marks !== undefined) updates.total_marks = Number(b.total_marks);
    if (b.passing_marks !== undefined) updates.passing_marks = Number(b.passing_marks);

    const exam = await Exam.findOneAndUpdate(
      { _id: id, ...orgFilter(req.profile) },
      updates,
      { new: true }
    );
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });
    return res.json(exam.toJSON());
  } catch (err) {
    return next(err);
  }
}

export async function deleteExam(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const id = req.params.id || req.body?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Valid exam ID required' });
    }

    const filter = { _id: id, ...orgFilter(req.profile) };
    const deleted = await Exam.findOneAndDelete(filter);
    if (!deleted) return res.status(404).json({ success: false, error: 'Exam not found' });

    await Result.deleteMany({ exam_id: deleted._id });
    return res.json({ ok: true, success: true, message: 'Exam deleted successfully' });
  } catch (err) {
    return next(err);
  }
}

export async function getResults(req, res, next) {
  try {
    const profile = req.profile;
    let filter = orgFilter(profile);

    const { exam_id, student_id } = req.query;

    if (profile.role === 'student') {
      const student = await Student.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!student) return res.json([]);
      filter = { ...filter, student_id: student._id };
    } else if (profile.role === 'parent') {
      const parent = await Parent.findOne({ profile_id: new mongoose.Types.ObjectId(profile.id) });
      if (!parent) return res.json([]);
      const links = await StudentParent.find({ parent_id: parent._id }).select('student_id');
      const studentIds = links.map((l) => l.student_id);

      if (student_id) {
        if (!studentIds.some((id) => id.toString() === student_id)) {
          return res.status(403).json({ success: false, error: 'Forbidden' });
        }
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      } else {
        filter = { ...filter, student_id: { $in: studentIds } };
      }
    } else {
      if (student_id && mongoose.Types.ObjectId.isValid(student_id)) {
        filter = { ...filter, student_id: new mongoose.Types.ObjectId(student_id) };
      }
    }

    if (exam_id && mongoose.Types.ObjectId.isValid(exam_id)) {
      filter = { ...filter, exam_id: new mongoose.Types.ObjectId(exam_id) };
    }

    const results = await Result.find(filter)
      .populate('exam_id', 'title term subject total_marks passing_marks date')
      .populate('student_id', 'full_name admission_no roll_no class_grade section');

    const data = results.map((r) => {
      const json = r.toJSON();
      return {
        ...json,
        exam_title: r.exam_id?.title || null,
        subject: r.exam_id?.subject || null,
        term: r.exam_id?.term || null,
        total_marks: r.exam_id?.total_marks || 100,
        passing_marks: r.exam_id?.passing_marks || 35,
        student_name: r.student_id?.full_name || null,
        admission_no: r.student_id?.admission_no || null,
      };
    });

    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

export async function recordResult(req, res, next) {
  try {
    if (!profileHasRole(req.profile, ['admin', 'super_admin', 'teacher'])) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin or Teacher access required' });
    }

    const profile = req.profile;
    const b = req.body || {};
    const orgId = profile.role === 'super_admin' ? b.organization_id || profile.organization_id : profile.organization_id;

    if (!b.exam_id || !b.student_id || b.marks_obtained === undefined) {
      return res.status(400).json({ success: false, error: 'exam_id, student_id, and marks_obtained required' });
    }

    const exam = await Exam.findById(b.exam_id);
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    const marks = Number(b.marks_obtained);
    const calculatedGrade = b.grade || computeGrade(marks, exam.total_marks);

    const result = await Result.findOneAndUpdate(
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        exam_id: new mongoose.Types.ObjectId(b.exam_id),
        student_id: new mongoose.Types.ObjectId(b.student_id),
      },
      {
        organization_id: new mongoose.Types.ObjectId(orgId),
        exam_id: new mongoose.Types.ObjectId(b.exam_id),
        student_id: new mongoose.Types.ObjectId(b.student_id),
        marks_obtained: marks,
        grade: calculatedGrade,
        remarks: b.remarks || '',
      },
      { upsert: true, new: true }
    );

    return res.status(201).json(result.toJSON());
  } catch (err) {
    return next(err);
  }
}

export default {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
  getResults,
  recordResult,
};
