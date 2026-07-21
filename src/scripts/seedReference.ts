/**
 * Permanent reference data — the official departments, courses, and skills that
 * students, recruiters, and admins pick from.
 *
 * Unlike seedDemo, these documents are NOT tagged `_seed`, so they survive a
 * `npm run seed:demo -- --purge`. The script is idempotent: it upserts by name,
 * so re-running only adds what's missing and never duplicates.
 *
 *   npm run seed:reference
 */

import mongoose from 'mongoose';
import { CONFIG } from '../config/environment';
import { Department } from '../models/department.model';
import { Course } from '../models/course.model';
import { Skill } from '../models/skill.model';

/* ------------------------------ The lists ------------------------------ */

const DEPARTMENTS: { name: string; code: string }[] = [
  { name: 'Computer Science & Engineering', code: 'CSE' },
  { name: 'Information Technology', code: 'IT' },
  { name: 'Electronics & Communication', code: 'ECE' },
  { name: 'Electrical Engineering', code: 'EE' },
  { name: 'Mechanical Engineering', code: 'ME' },
  { name: 'Civil Engineering', code: 'CE' },
  { name: 'Chemical Engineering', code: 'CHE' },
  { name: 'Agriculture', code: 'AGRI' },
  { name: 'Biotechnology', code: 'BT' },
  { name: 'Management Studies', code: 'MGMT' },
  { name: 'Commerce', code: 'COM' },
  { name: 'Nursing', code: 'NUR' },
  { name: 'Pharmacy', code: 'PHARM' },
  { name: 'Basic Sciences', code: 'SCI' },
  { name: 'Humanities & Social Sciences', code: 'HSS' },
];

const COURSES: { name: string; category: 'high_school' | 'ug' | 'pg' | 'diploma' | 'other' }[] = [
  // Engineering UG
  { name: 'B.Tech Computer Science', category: 'ug' },
  { name: 'B.Tech Information Technology', category: 'ug' },
  { name: 'B.Tech Electronics & Communication', category: 'ug' },
  { name: 'B.Tech Electrical Engineering', category: 'ug' },
  { name: 'B.Tech Mechanical', category: 'ug' },
  { name: 'B.Tech Civil', category: 'ug' },
  { name: 'B.Tech Chemical', category: 'ug' },
  // Engineering PG
  { name: 'M.Tech Computer Science', category: 'pg' },
  { name: 'M.Tech VLSI Design', category: 'pg' },
  { name: 'M.Tech Structural Engineering', category: 'pg' },
  // Computer applications
  { name: 'BCA', category: 'ug' },
  { name: 'MCA', category: 'pg' },
  // Sciences
  { name: 'B.Sc Agriculture', category: 'ug' },
  { name: 'M.Sc Agronomy', category: 'pg' },
  { name: 'B.Sc Biotechnology', category: 'ug' },
  { name: 'M.Sc Biotechnology', category: 'pg' },
  { name: 'B.Sc Physics', category: 'ug' },
  { name: 'B.Sc Chemistry', category: 'ug' },
  { name: 'M.Sc Mathematics', category: 'pg' },
  { name: 'B.Sc Nursing', category: 'ug' },
  // Management & commerce
  { name: 'BBA', category: 'ug' },
  { name: 'MBA', category: 'pg' },
  { name: 'B.Com', category: 'ug' },
  { name: 'M.Com', category: 'pg' },
  // Pharmacy
  { name: 'B.Pharm', category: 'ug' },
  { name: 'D.Pharm', category: 'diploma' },
];

// A broad starting catalogue so students rarely hit a gap. Admin curates from here.
const SKILLS: string[] = [
  // Programming languages
  'Python', 'Java', 'JavaScript', 'TypeScript', 'C', 'C++', 'C#', 'Go', 'Rust', 'Kotlin', 'Swift', 'PHP', 'Ruby', 'R', 'MATLAB',
  // Web & mobile
  'HTML/CSS', 'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Next.js', 'Django', 'Flask', 'Spring Boot', 'Flutter', 'React Native', 'Android Development',
  // Data & AI
  'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Data Analysis', 'Data Visualization', 'Machine Learning', 'Deep Learning', 'Natural Language Processing',
  'Computer Vision', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'Power BI', 'Tableau', 'Excel', 'Statistics',
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'Git', 'Linux', 'CI/CD', 'Jenkins',
  // Core engineering
  'AutoCAD', 'SolidWorks', 'CATIA', 'ANSYS', 'Revit', 'STAAD Pro', 'Thermodynamics', 'PLC Programming', 'Circuit Design', 'VLSI',
  // Business & general
  'Communication', 'Public Speaking', 'Project Management', 'Digital Marketing', 'Content Writing', 'Business Analysis',
  'Financial Analysis', 'Accounting', 'Tally', 'SAP', 'Market Research', 'Leadership', 'Teamwork', 'Problem Solving',
  // Domain
  'Agronomy', 'Soil Science', 'Food Technology', 'Molecular Biology', 'Bioinformatics', 'Pharmacology', 'Clinical Research', 'Patient Care',
];

/* -------------------------------- Seed -------------------------------- */

async function run() {
  const uri = CONFIG.mongoUri ?? process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set.');
  await mongoose.connect(uri);

  let deptAdded = 0;
  for (const d of DEPARTMENTS) {
    const res = await Department.updateOne(
      { name: d.name },
      { $setOnInsert: { name: d.name, code: d.code, active: true } },
      { upsert: true }
    );
    if (res.upsertedCount) deptAdded++;
  }

  let courseAdded = 0;
  for (const c of COURSES) {
    const res = await Course.updateOne(
      { name: c.name },
      { $setOnInsert: { name: c.name, category: c.category } },
      { upsert: true }
    );
    if (res.upsertedCount) courseAdded++;
  }

  let skillAdded = 0;
  for (const displayName of SKILLS) {
    const name = displayName.toLowerCase();
    const res = await Skill.updateOne(
      { name },
      { $setOnInsert: { name, displayName } },
      { upsert: true }
    );
    if (res.upsertedCount) skillAdded++;
  }

  // Promote to permanent: strip the demo `_seed` tag from any course/skill that
  // is on the official list. Otherwise a later `seed:demo --purge` would delete
  // an official entry that the demo run happened to create first. Explicit
  // updateMany (not $unset-on-upsert, which Mongo skips when nothing else changes).
  // Native driver, not the Mongoose model: strict mode would strip `_seed`
  // (not in the schema) from the update and the $unset would silently no-op.
  const db = mongoose.connection.db!;
  const officialCourseNames = COURSES.map((c) => c.name);
  const officialSkillNames = SKILLS.map((s) => s.toLowerCase());
  const [cPromoted, sPromoted] = await Promise.all([
    db.collection('courses').updateMany({ name: { $in: officialCourseNames }, _seed: true }, { $unset: { _seed: '' } }),
    db.collection('skills').updateMany({ name: { $in: officialSkillNames }, _seed: true }, { $unset: { _seed: '' } }),
  ]);

  console.log('📚 Reference data seeded (idempotent — existing entries untouched):');
  console.log(`   departments  +${deptAdded}  (total ${await Department.countDocuments()})`);
  console.log(`   courses      +${courseAdded}  (total ${await Course.countDocuments()}, ${cPromoted.modifiedCount} promoted from demo)`);
  console.log(`   skills       +${skillAdded}  (total ${await Skill.countDocuments()}, ${sPromoted.modifiedCount} promoted from demo)`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌ Reference seed failed:', err);
  process.exit(1);
});
