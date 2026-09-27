import './config/env.js';
import { connectDb } from './config/db.js';
import {
  Organization,
  User,
  Profile,
  Teacher,
  Parent,
  Student,
  ClassModel,
  StudentParent,
  Notice,
  Attendance,
  Fee,
  Exam,
  Result,
  Timetable,
  Subject,
} from './models/index.js';

async function seed() {
  await connectDb();

  await Promise.all([
    Subject.deleteMany({}),
    Attendance.deleteMany({}),
    Fee.deleteMany({}),
    Exam.deleteMany({}),
    Result.deleteMany({}),
    Timetable.deleteMany({}),
    Notice.deleteMany({}),
    StudentParent.deleteMany({}),
    Student.deleteMany({}),
    ClassModel.deleteMany({}),
    Parent.deleteMany({}),
    Teacher.deleteMany({}),
    Profile.deleteMany({}),
    User.deleteMany({}),
    Organization.deleteMany({}),
  ]);

  const [greenwood, sunrise] = await Organization.insertMany([
    {
      name: 'Greenwood Academy',
      code: 'GWA',
      address: '12 Park Avenue, Delhi',
      phone: '+91 98765 43210',
      email: 'info@greenwood.edu',
      active: true,
    },
    {
      name: 'Sunrise Public School',
      code: 'SPS',
      address: '88 Lake Road, Mumbai',
      phone: '+91 99887 76655',
      email: 'hello@sunrise.edu',
      active: true,
    },
  ]);

  const password = 'password123';

  async function makeUserProfile({ email, full_name, role, organization_id, phone }) {
    const user = await User.create({ email, password });
    const profile = await Profile.create({
      user_id: user._id,
      email,
      full_name,
      role,
      organization_id: organization_id || null,
      phone: phone || null,
    });
    return profile;
  }

  const superAdmin = await makeUserProfile({
    email: 'superadmin@educore.edu',
    full_name: 'Super Admin',
    role: 'super_admin',
  });

  const admin = await makeUserProfile({
    email: 'admin@greenwood.edu',
    full_name: 'Greenwood Admin',
    role: 'admin',
    organization_id: greenwood._id,
    phone: '+91 90000 11111',
  });

  const teacherProfile = await makeUserProfile({
    email: 'sarah.j@greenwood.edu',
    full_name: 'Sarah Johnson',
    role: 'teacher',
    organization_id: greenwood._id,
    phone: '+91 90000 22222',
  });

  const studentProfile = await makeUserProfile({
    email: 'rahul.k@greenwood.edu',
    full_name: 'Rahul Kumar',
    role: 'student',
    organization_id: greenwood._id,
    phone: '+91 90000 33333',
  });

  const parentProfile = await makeUserProfile({
    email: 'rajesh.k@greenwood.edu',
    full_name: 'Rajesh Kumar',
    role: 'parent',
    organization_id: greenwood._id,
    phone: '+91 90000 44444',
  });

  const [sarah, amit] = await Teacher.create([
    {
      organization_id: greenwood._id,
      profile_id: teacherProfile._id,
      full_name: 'Sarah Johnson',
      email: 'sarah.j@greenwood.edu',
      phone: '+91 90000 22222',
      employee_id: 'T-1001',
      department: 'Science',
      subjects: 'Physics, Math',
      classes: '10-A, 9-B',
      status: 'Active',
      joining_date: new Date('2022-06-01'),
    },
    {
      organization_id: greenwood._id,
      profile_id: null,
      full_name: 'Amit Verma',
      email: 'amit.v@greenwood.edu',
      phone: '+91 90000 55555',
      employee_id: 'T-1002',
      department: 'Arts',
      subjects: 'English, History',
      classes: '8-A',
      status: 'Active',
      joining_date: new Date('2023-01-15'),
    },
  ]);

  const rajesh = await Parent.create({
    organization_id: greenwood._id,
    profile_id: parentProfile._id,
    full_name: 'Rajesh Kumar',
    email: 'rajesh.k@greenwood.edu',
    phone: '+91 90000 44444',
    occupation: 'Engineer',
    address: '45 Nehru Nagar, Delhi',
  });

  const [rahul] = await Student.create([
    {
      organization_id: greenwood._id,
      profile_id: studentProfile._id,
      admission_no: 'ADM-2024-001',
      full_name: 'Rahul Kumar',
      email: 'rahul.k@greenwood.edu',
      roll_no: '12',
      class_grade: '10',
      section: 'A',
      gender: 'Male',
      dob: new Date('2010-04-12'),
      phone: '+91 90000 33333',
      address: '45 Nehru Nagar, Delhi',
      teacher_id: sarah._id,
      status: 'Active',
    },
    {
      organization_id: greenwood._id,
      admission_no: 'ADM-2024-002',
      full_name: 'Priya Sharma',
      email: 'priya.s@greenwood.edu',
      roll_no: '05',
      class_grade: '9',
      section: 'B',
      gender: 'Female',
      dob: new Date('2011-08-21'),
      address: '22 MG Road, Delhi',
      teacher_id: sarah._id,
      status: 'Active',
    },
    {
      organization_id: greenwood._id,
      admission_no: 'ADM-2024-003',
      full_name: 'Arjun Mehta',
      email: 'arjun.m@greenwood.edu',
      roll_no: '18',
      class_grade: '8',
      section: 'A',
      gender: 'Male',
      dob: new Date('2012-01-05'),
      address: '9 Civil Lines, Delhi',
      teacher_id: amit._id,
      status: 'Active',
    },
  ]);

  const [class10A, class9B, class8A] = await ClassModel.create([
    {
      organization_id: greenwood._id,
      grade: '10',
      section: 'A',
      teacher_id: sarah._id,
      teachers: [sarah._id, amit._id],
    },
    {
      organization_id: greenwood._id,
      grade: '9',
      section: 'B',
      teacher_id: sarah._id,
      teachers: [sarah._id],
    },
    {
      organization_id: greenwood._id,
      grade: '8',
      section: 'A',
      teacher_id: amit._id,
      teachers: [amit._id],
    },
  ]);

  await Subject.create([
    {
      organization_id: greenwood._id,
      name: 'Mathematics',
      code: 'MATH-10',
      class_grade: '10',
      section: 'A',
      class_id: class10A._id,
      teacher_id: sarah._id,
      teachers: [sarah._id],
      description: 'Advanced Mathematics for Grade 10',
    },
    {
      organization_id: greenwood._id,
      name: 'Physics',
      code: 'PHY-10',
      class_grade: '10',
      section: 'A',
      class_id: class10A._id,
      teacher_id: sarah._id,
      teachers: [sarah._id],
      description: 'Mechanics and Thermodynamics',
    },
    {
      organization_id: greenwood._id,
      name: 'English Literature',
      code: 'ENG-10',
      class_grade: '10',
      section: 'A',
      class_id: class10A._id,
      teacher_id: amit._id,
      teachers: [amit._id],
      description: 'English Literature and Composition',
    },
    {
      organization_id: greenwood._id,
      name: 'History',
      code: 'HIST-8',
      class_grade: '8',
      section: 'A',
      class_id: class8A._id,
      teacher_id: amit._id,
      teachers: [amit._id],
      description: 'World History and Civics',
    },
  ]);

  await StudentParent.create({ student_id: rahul._id, parent_id: rajesh._id });

  await Notice.create([
    {
      organization_id: greenwood._id,
      title: 'Welcome to the new term',
      description: 'Classes begin Monday. Please check the timetable.',
      audience: 'Everyone',
      color: 'blue',
      created_by: admin._id,
    },
    {
      organization_id: greenwood._id,
      title: 'PTM scheduled',
      description: 'Parent-teacher meeting on Friday at 4 PM.',
      audience: 'Parents',
      color: 'green',
      created_by: teacherProfile._id,
    },
  ]);

  // Seed Timetable for Class 10-A
  await Timetable.create({
    organization_id: greenwood._id,
    class_grade: '10',
    section: 'A',
    schedule: [
      { time: '09:00 - 09:45', mon: 'Math', tue: 'Science', wed: 'English', thu: 'Social', fri: 'Math' },
      { time: '09:45 - 10:30', mon: 'Science', tue: 'Math', wed: 'Social', thu: 'English', fri: 'Math' },
      { time: '10:30 - 11:00', mon: 'BREAK', tue: 'BREAK', wed: 'BREAK', thu: 'BREAK', fri: 'BREAK' },
      { time: '11:00 - 11:45', mon: 'English', tue: 'Social', wed: 'Math', thu: 'Science', fri: 'English' },
      { time: '11:45 - 12:30', mon: 'Social', tue: 'English', wed: 'Science', thu: 'Math', fri: 'PE' },
      { time: '12:30 - 01:15', mon: 'PE', tue: 'CS', wed: 'Art', thu: 'CS', fri: 'Library' },
    ],
  });

  // Seed Attendance for Rahul
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  await Attendance.create([
    {
      organization_id: greenwood._id,
      student_id: rahul._id,
      class_grade: '10',
      section: 'A',
      date: new Date(today.setHours(0, 0, 0, 0)),
      status: 'present',
      remarks: 'Present on time',
      recorded_by: teacherProfile._id,
    },
    {
      organization_id: greenwood._id,
      student_id: rahul._id,
      class_grade: '10',
      section: 'A',
      date: new Date(yesterday.setHours(0, 0, 0, 0)),
      status: 'present',
      remarks: 'Present',
      recorded_by: teacherProfile._id,
    },
  ]);

  // Seed Fees for Rahul (₹84,000 total, ₹62,000 paid, ₹22,000 pending)
  await Fee.create({
    organization_id: greenwood._id,
    student_id: rahul._id,
    title: 'Academic Year Fee 2025-26',
    fee_type: 'Tuition',
    academic_year: '2025-2026',
    total_amount: 84000,
    paid_amount: 62000,
    due_date: new Date('2026-06-15'),
    status: 'Partial',
    payments: [
      {
        amount: 32000,
        date: new Date('2026-01-10'),
        payment_method: 'Online NetBanking',
        transaction_id: 'TXN-GWA-10029',
        receipt_no: 'REC-001029',
      },
      {
        amount: 30000,
        date: new Date('2026-03-05'),
        payment_method: 'UPI',
        transaction_id: 'TXN-GWA-10481',
        receipt_no: 'REC-001048',
      },
    ],
  });

  // Seed Exams & Results for Class 10
  const [mathExam, scienceExam] = await Exam.create([
    {
      organization_id: greenwood._id,
      title: 'Term 1 Mathematics Exam',
      term: 'Term 1',
      class_grade: '10',
      subject: 'Mathematics',
      date: new Date('2026-10-15'),
      start_time: '09:00 AM',
      duration: '2.5 Hours',
      total_marks: 100,
      passing_marks: 35,
    },
    {
      organization_id: greenwood._id,
      title: 'Term 1 Science Exam',
      term: 'Term 1',
      class_grade: '10',
      subject: 'Science',
      date: new Date('2026-10-18'),
      start_time: '09:00 AM',
      duration: '2.5 Hours',
      total_marks: 100,
      passing_marks: 35,
    },
  ]);

  await Result.create([
    {
      organization_id: greenwood._id,
      exam_id: mathExam._id,
      student_id: rahul._id,
      marks_obtained: 88,
      grade: 'A',
      remarks: 'Excellent problem solving ability',
    },
    {
      organization_id: greenwood._id,
      exam_id: scienceExam._id,
      student_id: rahul._id,
      marks_obtained: 84,
      grade: 'A',
      remarks: 'Strong practical comprehension',
    },
  ]);

  console.log('Seed complete.');
  console.log('Demo logins (password: password123):');
  console.log('  superadmin@educore.edu');
  console.log('  admin@greenwood.edu');
  console.log('  sarah.j@greenwood.edu');
  console.log('  rahul.k@greenwood.edu');
  console.log('  rajesh.k@greenwood.edu');
  console.log(`Organizations: ${greenwood.code}, ${sunrise.code}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed', err);
  process.exit(1);
});
