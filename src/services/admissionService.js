import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { User, Profile, Student, Parent, ClassModel, StudentParent, Organization } from '../models/index.js';
import { sendStudentCredentials, sendParentCredentials } from './emailService.js';

function generateTemporaryPassword() {
  const randomHex = crypto.randomBytes(4).toString('hex');
  return `Edu@${randomHex}9!`;
}

export async function processStudentAdmission({
  actorProfile,
  studentData,
  parentData,
  parentId: existingParentId,
  organizationId: requestedOrgId,
}) {
  // 1. Validate Organization Access
  const organization_id =
    actorProfile.role === 'super_admin'
      ? requestedOrgId || actorProfile.organization_id
      : actorProfile.organization_id;

  if (!organization_id) {
    return { error: 'organization_id is required', status: 400 };
  }

  const orgDoc = await Organization.findById(organization_id);
  const schoolName = orgDoc?.name || 'EduCore School';

  // 2. Validate Student Data
  if (!studentData?.full_name?.trim()) {
    return { error: 'student.full_name is required', status: 400 };
  }
  if (!studentData?.admission_no?.trim()) {
    return { error: 'student.admission_no is required', status: 400 };
  }
  if (!studentData?.email?.trim()) {
    return { error: 'student.email is required for student login account', status: 400 };
  }

  const studentEmail = studentData.email.toLowerCase().trim();
  const admissionNo = studentData.admission_no.trim();

  // 3. Pre-flight duplicate checks
  const existingAdmission = await Student.findOne({
    organization_id,
    admission_no: admissionNo,
  });
  if (existingAdmission) {
    return {
      error: `Admission number "${admissionNo}" already exists in this organization`,
      status: 409,
      code: 'DUPLICATE_ADMISSION_NO',
    };
  }

  const existingStudentUser = await User.findOne({ email: studentEmail });
  if (existingStudentUser) {
    return {
      error: `User account with email "${studentEmail}" already exists`,
      status: 409,
      code: 'DUPLICATE_STUDENT_EMAIL',
    };
  }

  // 4. Validate Parent Info
  let parentId = existingParentId || null;
  let isNewParent = false;
  let newParentTempPassword = null;
  let parentEmail = null;
  let parentFullName = null;

  if (parentId) {
    const parentDoc = await Parent.findById(parentId);
    if (!parentDoc || parentDoc.organization_id.toString() !== organization_id.toString()) {
      return { error: 'Selected parent was not found in this organization', status: 400 };
    }
    parentEmail = parentDoc.email;
    parentFullName = parentDoc.full_name;
  } else if (parentData) {
    if (!parentData.full_name?.trim() || !parentData.email?.trim()) {
      return { error: 'parent.full_name and parent.email are required', status: 400 };
    }
    parentEmail = parentData.email.toLowerCase().trim();
    parentFullName = parentData.full_name.trim();

    // Check if parent already exists in this organization
    const existingParent = await Parent.findOne({
      organization_id,
      email: parentEmail,
    });

    if (existingParent) {
      parentId = existingParent._id;
    } else {
      isNewParent = true;
      newParentTempPassword = generateTemporaryPassword();
    }
  } else {
    return { error: 'Parent information (parent object or parent_id) is required', status: 400 };
  }

  // 5. Generate secure temporary password for student
  const studentTempPassword = generateTemporaryPassword();

  // Tracking created IDs for compensating rollback if replica set transactions are unavailable
  const created = {
    studentUserId: null,
    studentProfileId: null,
    studentId: null,
    parentUserId: null,
    parentProfileId: null,
    parentId: null,
    studentParentId: null,
  };

  try {
    // A. Handle Parent User & Record if new
    if (isNewParent) {
      let parentUser = await User.findOne({ email: parentEmail });
      if (!parentUser) {
        parentUser = await User.create({
          email: parentEmail,
          password: newParentTempPassword,
        });
        created.parentUserId = parentUser._id;
      }

      let parentProfile = await Profile.findOne({ user_id: parentUser._id });
      if (!parentProfile) {
        parentProfile = await Profile.create({
          user_id: parentUser._id,
          email: parentEmail,
          full_name: parentFullName,
          role: 'parent',
          organization_id,
          phone: parentData.phone?.trim() || null,
        });
        created.parentProfileId = parentProfile._id;
      }

      const newParentDoc = await Parent.create({
        organization_id,
        profile_id: parentProfile._id,
        full_name: parentFullName,
        email: parentEmail,
        phone: parentData.phone?.trim() || null,
        occupation: parentData.occupation?.trim() || null,
        address: parentData.address?.trim() || null,
      });
      created.parentId = newParentDoc._id;
      parentId = newParentDoc._id;
    }

    // B. Create Student User & Profile
    const studentUser = await User.create({
      email: studentEmail,
      password: studentTempPassword,
    });
    created.studentUserId = studentUser._id;

    const studentProfile = await Profile.create({
      user_id: studentUser._id,
      email: studentEmail,
      full_name: studentData.full_name.trim(),
      role: 'student',
      organization_id,
      phone: studentData.phone?.trim() || null,
    });
    created.studentProfileId = studentProfile._id;

    // C. Create Student Record
    const student = await Student.create({
      organization_id,
      profile_id: studentProfile._id,
      admission_no: admissionNo,
      full_name: studentData.full_name.trim(),
      roll_no: studentData.roll_no?.trim() || null,
      class_grade: studentData.class_grade ? String(studentData.class_grade).trim() : '',
      section: studentData.section?.trim() || null,
      gender: studentData.gender?.trim() || null,
      dob: studentData.dob ? new Date(studentData.dob) : null,
      phone: studentData.phone?.trim() || null,
      address: studentData.address?.trim() || null,
      teacher_id: studentData.teacher_id || null,
      status: studentData.status || 'Active',
    });
    created.studentId = student._id;

    // D. Link Student <-> Parent
    if (parentId) {
      const link = await StudentParent.create({
        student_id: student._id,
        parent_id: parentId,
      });
      created.studentParentId = link._id;
    }

    // E. Link or create Class if grade & section provided
    if (studentData.class_grade && studentData.section) {
      const grade = String(studentData.class_grade).trim();
      const section = String(studentData.section).trim();

      const existingClass = await ClassModel.findOne({
        organization_id,
        grade,
        section,
      });

      if (!existingClass) {
        await ClassModel.create({
          organization_id,
          grade,
          section,
          teacher_id: studentData.teacher_id || null,
        });
      } else if (studentData.teacher_id && !existingClass.teacher_id) {
        existingClass.teacher_id = studentData.teacher_id;
        await existingClass.save();
      }
    }

    // F. Dispatch credentials via email service asynchronously
    sendStudentCredentials({
      email: studentEmail,
      fullName: studentData.full_name.trim(),
      temporaryPassword: studentTempPassword,
      schoolName,
    }).catch((err) => console.error('[admission] Student email error:', err.message));

    if (isNewParent && newParentTempPassword) {
      sendParentCredentials({
        email: parentEmail,
        fullName: parentFullName,
        studentName: studentData.full_name.trim(),
        temporaryPassword: newParentTempPassword,
        schoolName,
      }).catch((err) => console.error('[admission] Parent email error:', err.message));
    }

    // Format student output
    const studentJson = student.toJSON();

    return {
      success: true,
      ok: true,
      message: 'Student and parent accounts created successfully. Login credentials have been sent by email.',
      student: studentJson,
      parent_id: parentId ? parentId.toString() : null,
      // For test harness validation only (not exposed in production APIs)
      _meta: {
        studentEmail,
        parentEmail,
        studentCreated: true,
        parentCreated: isNewParent,
      },
    };
  } catch (err) {
    // Compensating rollback if standalone Mongo or uncaught error
    console.error('[admission] Error in student admission transaction, executing compensating cleanup:', err);

    if (created.studentParentId) await StudentParent.findByIdAndDelete(created.studentParentId).catch(() => {});
    if (created.studentId) await Student.findByIdAndDelete(created.studentId).catch(() => {});
    if (created.studentProfileId) await Profile.findByIdAndDelete(created.studentProfileId).catch(() => {});
    if (created.studentUserId) await User.findByIdAndDelete(created.studentUserId).catch(() => {});

    if (isNewParent) {
      if (created.parentId) await Parent.findByIdAndDelete(created.parentId).catch(() => {});
      if (created.parentProfileId) await Profile.findByIdAndDelete(created.parentProfileId).catch(() => {});
      if (created.parentUserId) await User.findByIdAndDelete(created.parentUserId).catch(() => {});
    }

    throw err;
  }
}

export default {
  processStudentAdmission,
};
