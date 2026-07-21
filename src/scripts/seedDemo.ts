/**
 * Demo data generator — 750 students plus the placement history around them.
 *
 * Every document written here carries `_seed: true`, so the whole dataset can be
 * removed in one pass without touching real records:
 *
 *   npm run seed:demo -- --purge
 *
 * The numbers are shaped to look like an actual Indian university placement
 * season rather than uniform noise: CGPA is normally distributed, package bands
 * are bimodal (mass-recruiter service roles around 4 LPA, a thin product-company
 * tail above 20), placement rates decay for junior batches, and a realistic
 * slice of each cohort opts out for higher studies or competitive exams.
 */

import bcrypt from 'bcrypt';
import mongoose, { Types } from 'mongoose';
import { CONFIG } from '../config/environment';

/* ----------------------------- RNG (seeded) ----------------------------- */

/** Deterministic PRNG so re-running produces the same cohort. */
let rngState = 42;
function rnd(): number {
  rngState = (rngState * 1664525 + 1013904223) % 4294967296;
  return rngState / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const int = (lo: number, hi: number) => Math.floor(rnd() * (hi - lo + 1)) + lo;
const chance = (p: number) => rnd() < p;

/** Box–Muller, clamped — gives a believable bell curve for CGPA. */
function normal(mean: number, sd: number, lo: number, hi: number): number {
  const u = Math.max(rnd(), 1e-9), v = Math.max(rnd(), 1e-9);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(hi, Math.max(lo, mean + z * sd));
}

/** Weighted choice from [value, weight] pairs. */
function weighted<T>(pairs: readonly (readonly [T, number])[]): T {
  const total = pairs.reduce((n, p) => n + p[1], 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) {
    r -= w;
    if (r <= 0) return v;
  }
  return pairs[pairs.length - 1][0];
}

/* ------------------------------ Vocabulary ------------------------------ */

const MALE_FIRST = [
  'Aarav', 'Vihaan', 'Arjun', 'Harshit', 'Gurpreet', 'Manpreet', 'Rohan', 'Karan', 'Rahul', 'Sahil',
  'Jaspreet', 'Amandeep', 'Rajat', 'Nikhil', 'Ankit', 'Vikram', 'Simranjit', 'Tarun', 'Yash', 'Dev',
  'Ishaan', 'Kabir', 'Aditya', 'Sarthak', 'Mohit', 'Abhishek', 'Ravinder', 'Sukhwinder', 'Pranav', 'Lakshay',
];
const FEMALE_FIRST = [
  'Ananya', 'Simran', 'Navneet', 'Harleen', 'Priya', 'Kirandeep', 'Ishita', 'Sneha', 'Ritika', 'Manjot',
  'Gurleen', 'Aditi', 'Pooja', 'Komal', 'Jasleen', 'Shreya', 'Tanvi', 'Amrit', 'Diya', 'Kavya',
  'Meher', 'Rupinder', 'Sanjana', 'Muskan', 'Nidhi', 'Prabhjot', 'Anjali', 'Sakshi',
];
const LAST = [
  'Singh', 'Kaur', 'Sharma', 'Verma', 'Gupta', 'Chaudhary', 'Sidhu', 'Brar', 'Dhillon', 'Gill',
  'Bansal', 'Mittal', 'Aggarwal', 'Jindal', 'Sekhon', 'Randhawa', 'Kumar', 'Yadav', 'Thakur', 'Rana',
  'Bhatia', 'Malhotra', 'Kapoor', 'Sethi', 'Grewal', 'Sandhu', 'Chahal', 'Bajwa',
];

const CITIES = [
  'Bathinda', 'Patiala', 'Ludhiana', 'Amritsar', 'Chandigarh', 'Jalandhar', 'Mohali',
  'Sirsa', 'Shimla', 'Solan', 'Hisar', 'Sangrur', 'Barnala', 'Muktsar',
];

/** Department → the courses that actually belong to it. */
const DEPARTMENTS = [
  { name: 'Computer Science & Engineering', courses: ['B.Tech Computer Science', 'M.Tech Computer Science', 'BCA', 'MCA'], weight: 26, techy: true },
  { name: 'Electronics & Communication', courses: ['B.Tech Electronics & Communication'], weight: 12, techy: true },
  { name: 'Mechanical Engineering', courses: ['B.Tech Mechanical'], weight: 10, techy: false },
  { name: 'Civil Engineering', courses: ['B.Tech Civil'], weight: 7, techy: false },
  { name: 'Agriculture', courses: ['B.Sc Agriculture', 'M.Sc Agronomy'], weight: 16, techy: false },
  { name: 'Biotechnology', courses: ['B.Sc Biotechnology', 'M.Sc Biotechnology'], weight: 8, techy: false },
  { name: 'Management Studies', courses: ['BBA', 'MBA'], weight: 12, techy: false },
  { name: 'Nursing', courses: ['B.Sc Nursing'], weight: 5, techy: false },
  { name: 'Basic Sciences', courses: ['B.Sc Physics', 'M.Sc Mathematics'], weight: 4, techy: false },
] as const;

const COURSE_CATEGORY: Record<string, 'ug' | 'pg'> = {
  'B.Tech Computer Science': 'ug', 'M.Tech Computer Science': 'pg', BCA: 'ug', MCA: 'pg',
  'B.Tech Electronics & Communication': 'ug', 'B.Tech Mechanical': 'ug', 'B.Tech Civil': 'ug',
  'B.Sc Agriculture': 'ug', 'M.Sc Agronomy': 'pg', 'B.Sc Biotechnology': 'ug', 'M.Sc Biotechnology': 'pg',
  BBA: 'ug', MBA: 'pg', 'B.Sc Nursing': 'ug', 'B.Sc Physics': 'ug', 'M.Sc Mathematics': 'pg',
};

const TECH_SKILLS = [
  'React', 'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'Node.js', 'SQL', 'MongoDB',
  'Machine Learning', 'Data Analysis', 'Django', 'Spring Boot', 'AWS', 'Docker', 'Git',
  'HTML/CSS', 'Flutter', 'Power BI', 'Excel',
];
const GENERAL_SKILLS = [
  'Communication', 'Excel', 'Power BI', 'Data Analysis', 'Project Management', 'AutoCAD',
  'SolidWorks', 'MATLAB', 'Tally', 'Digital Marketing', 'Content Writing', 'SPSS',
];

/** Recruiters, shaped like a real campus season: mass hirers dominate volume. */
const COMPANIES = [
  { name: 'Infosys', sector: 'IT Services', ctc: [3.6, 4.5], hires: 34, tier: 'regular' },
  { name: 'TCS', sector: 'IT Services', ctc: [3.4, 4.2], hires: 38, tier: 'regular' },
  { name: 'Wipro', sector: 'IT Services', ctc: [3.5, 4.4], hires: 26, tier: 'regular' },
  { name: 'Cognizant', sector: 'IT Services', ctc: [4.0, 5.5], hires: 20, tier: 'regular' },
  { name: 'Capgemini', sector: 'IT Services', ctc: [4.2, 5.8], hires: 16, tier: 'regular' },
  { name: 'Tech Mahindra', sector: 'IT Services', ctc: [3.8, 4.8], hires: 14, tier: 'regular' },
  { name: 'HCLTech', sector: 'IT Services', ctc: [4.0, 6.0], hires: 12, tier: 'regular' },
  { name: 'Zoho', sector: 'Product', ctc: [7.0, 10.0], hires: 8, tier: 'core' },
  { name: 'Freshworks', sector: 'Product', ctc: [8.0, 12.0], hires: 5, tier: 'core' },
  { name: 'Deloitte', sector: 'Consulting', ctc: [7.5, 11.0], hires: 7, tier: 'core' },
  { name: 'EY', sector: 'Consulting', ctc: [6.5, 9.5], hires: 6, tier: 'core' },
  { name: 'Amazon', sector: 'Product', ctc: [22.0, 32.0], hires: 3, tier: 'dream' },
  { name: 'Microsoft', sector: 'Product', ctc: [28.0, 44.0], hires: 2, tier: 'dream' },
  { name: 'Adobe', sector: 'Product', ctc: [20.0, 28.0], hires: 2, tier: 'dream' },
  { name: 'JCB India', sector: 'Core Engineering', ctc: [5.5, 7.5], hires: 6, tier: 'core' },
  { name: 'L&T Construction', sector: 'Core Engineering', ctc: [4.5, 6.5], hires: 8, tier: 'regular' },
  { name: 'Ashok Leyland', sector: 'Core Engineering', ctc: [5.0, 7.0], hires: 5, tier: 'regular' },
  { name: 'ITC Agri', sector: 'Agritech', ctc: [4.5, 6.5], hires: 9, tier: 'regular' },
  { name: 'Godrej Agrovet', sector: 'Agritech', ctc: [4.2, 6.0], hires: 7, tier: 'regular' },
  { name: 'Fortis Healthcare', sector: 'Healthcare', ctc: [3.5, 5.0], hires: 6, tier: 'regular' },
  { name: 'Biocon', sector: 'Pharma & Biotech', ctc: [5.0, 7.5], hires: 5, tier: 'regular' },
] as const;

const INTERN_COMPANIES = [
  { name: 'Zoho', location: 'Chennai', stipend: [20000, 35000] },
  { name: 'Infosys', location: 'Mysuru', stipend: [15000, 25000] },
  { name: 'Amazon', location: 'Hyderabad', stipend: [60000, 90000] },
  { name: 'Freshworks', location: 'Chennai', stipend: [30000, 45000] },
  { name: 'ITC Agri', location: 'Bengaluru', stipend: [12000, 20000] },
  { name: 'L&T Construction', location: 'Mumbai', stipend: [10000, 18000] },
  { name: 'Biocon', location: 'Bengaluru', stipend: [15000, 22000] },
] as const;

const LOCATIONS = ['Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Gurugram', 'Noida', 'Mumbai', 'Mohali', 'Indore'];

/** Older batches have had longer to convert offers. */
const BATCHES = [
  { year: 2026, weight: 18, placedRate: 0.78 },
  { year: 2027, weight: 34, placedRate: 0.61 }, // current final year
  { year: 2028, weight: 26, placedRate: 0.22 },
  { year: 2029, weight: 22, placedRate: 0.04 },
] as const;

const INTENTS = [
  ['placement', 82], ['higher_studies', 8], ['competitive_exam', 5],
  ['entrepreneurship', 2], ['family_business', 2], ['not_interested', 1],
] as const;

const ROUND_SETS = [
  ['Pre-placement talk', 'Aptitude test', 'Technical interview', 'HR interview'],
  ['Online assessment', 'Technical round 1', 'Technical round 2', 'HR interview'],
  ['Group discussion', 'Personal interview'],
];

/* ------------------------------- Helpers ------------------------------- */

const TOTAL_STUDENTS = 750;
const SEED = { _seed: true };

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);
const round1 = (n: number) => Math.round(n * 10) / 10;

async function connect() {
  const uri = CONFIG.mongoUri ?? process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set.');
  await mongoose.connect(uri);
  return mongoose.connection.db!;
}

/* -------------------------------- Purge -------------------------------- */

async function purge() {
  const db = await connect();
  const collections = [
    'users', 'students', 'courses', 'skills', 'openings',
    'applications', 'placements', 'invitations', 'notifications',
  ];
  const results: Record<string, number> = {};
  for (const c of collections) {
    results[c] = (await db.collection(c).deleteMany({ _seed: true })).deletedCount ?? 0;
  }
  console.log('🧹 Purged demo data:', results);
  await mongoose.disconnect();
}

/* --------------------------------- Seed --------------------------------- */

async function seed() {
  const db = await connect();

  const already = await db.collection('users').countDocuments({ _seed: true });
  if (already > 0) {
    console.log(`⚠️  ${already} demo users already exist. Run with --purge first to reseed.`);
    await mongoose.disconnect();
    return;
  }

  /* ---- Skills (reuse any that already exist, by lowercase name) ---- */

  const allSkillNames = [...new Set([...TECH_SKILLS, ...GENERAL_SKILLS])];
  const existingSkills = await db.collection('skills').find({}).toArray();
  const skillByName = new Map<string, Types.ObjectId>(
    existingSkills.map((s: any) => [String(s.name).toLowerCase(), s._id])
  );

  const newSkills = allSkillNames
    .filter((n) => !skillByName.has(n.toLowerCase()))
    .map((displayName) => ({
      _id: new Types.ObjectId(),
      name: displayName.toLowerCase(),
      displayName,
      ...SEED,
      createdAt: new Date(), updatedAt: new Date(), __v: 0,
    }));
  if (newSkills.length) await db.collection('skills').insertMany(newSkills);
  newSkills.forEach((s) => skillByName.set(s.name, s._id));

  const skillId = (display: string) => skillByName.get(display.toLowerCase())!;

  /* ---- Courses ---- */

  const courseNames = [...new Set(DEPARTMENTS.flatMap((d) => d.courses))];
  const existingCourses = await db.collection('courses').find({}).toArray();
  const courseByName = new Map<string, Types.ObjectId>(existingCourses.map((c: any) => [c.name, c._id]));

  const newCourses = courseNames
    .filter((n) => !courseByName.has(n))
    .map((name) => ({
      _id: new Types.ObjectId(),
      name,
      category: COURSE_CATEGORY[name] ?? 'ug',
      ...SEED,
      createdAt: new Date(), updatedAt: new Date(), __v: 0,
    }));
  if (newCourses.length) await db.collection('courses').insertMany(newCourses);
  newCourses.forEach((c) => courseByName.set(c.name, c._id));

  /* ---- Students ---- */

  const passwordHash = await bcrypt.hash('student123', 10);
  const users: any[] = [];
  const students: any[] = [];

  // AUIDs start well clear of the existing 2271xxxxx accounts.
  let auidSeq = 230100001;

  for (let i = 0; i < TOTAL_STUDENTS; i++) {
    const dept = weighted(DEPARTMENTS.map((d) => [d, d.weight] as const));
    const batch = weighted(BATCHES.map((b) => [b, b.weight] as const));
    const gender = weighted([['male', 58], ['female', 41], ['other', 1]] as const);
    const first = gender === 'female' ? pick(FEMALE_FIRST) : pick(MALE_FIRST);
    const last = gender === 'female' && chance(0.55) ? 'Kaur' : pick(LAST);

    // Nursing and Agriculture skew to Eternal University.
    const university =
      dept.name === 'Nursing' ? (chance(0.85) ? 'Eternal University' : 'Akal University')
      : dept.name === 'Agriculture' ? (chance(0.6) ? 'Eternal University' : 'Akal University')
      : chance(0.7) ? 'Akal University' : 'Eternal University';

    const uid = new Types.ObjectId();
    const auid = String(auidSeq++);

    users.push({
      _id: uid,
      auid,
      password: passwordHash,
      firstName: first.toLowerCase(),
      lastName: last.toLowerCase(),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@student.demo`,
      university,
      gender,
      roles: ['student'],
      status: 'active',
      ...SEED,
      createdAt: daysAgo(int(30, 900)), updatedAt: new Date(), __v: 0,
    });

    const cgpa = round1(normal(7.2, 1.05, 4.8, 9.9) * 10) / 10;
    const cgpaR = Math.round(cgpa * 100) / 100;
    // Weak students carry backlogs far more often.
    const backlogs = cgpaR < 6 ? weighted([[0, 40], [1, 35], [2, 18], [3, 7]] as const)
      : cgpaR < 7 ? weighted([[0, 78], [1, 18], [2, 4]] as const)
      : weighted([[0, 96], [1, 4]] as const);

    const intent = weighted(INTENTS);
    const courseName = pick(dept.courses);
    const pool = dept.techy ? TECH_SKILLS : GENERAL_SKILLS;
    const skillCount = int(2, 7);
    const chosen = [...new Set(Array.from({ length: skillCount }, () => pick(pool)))];

    // Better students engage more with preparation — keeps the readiness
    // indicators correlated with outcomes instead of random.
    const engaged = cgpaR > 7 ? chance(0.8) : chance(0.45);

    students.push({
      _id: new Types.ObjectId(),
      user: uid,
      headline: `${courseName} · ${dept.name}`,
      location: pick(CITIES),
      about: `${courseName} student at ${university}, graduating in ${batch.year}.`,
      preferred_field: dept.name,
      department: dept.name,
      course: courseByName.get(courseName),
      batch_year: batch.year,
      cgpa: cgpaR,
      backlogs,
      placement_intent: intent,
      opted_out_reason: intent === 'higher_studies' ? 'Preparing for GATE / MS applications'
        : intent === 'competitive_exam' ? 'Preparing for UPSC / banking exams'
        : intent === 'family_business' ? 'Joining the family business'
        : undefined,
      aptitude_score: engaged ? Math.round(normal(cgpaR * 8, 11, 25, 99)) : undefined,
      mock_interviews: engaged ? int(1, 5) : 0,
      mock_interview_score: engaged ? Math.round(normal(cgpaR * 0.85, 1.3, 3, 10) * 10) / 10 : undefined,
      training_attendance: engaged ? int(60, 100) : int(10, 60),
      resume_verified: engaged && chance(0.7),
      looking_for: {
        type: batch.year <= 2027 ? (chance(0.75) ? 'job' : 'internship') : (chance(0.7) ? 'internship' : 'job'),
        from_date: daysAgo(-int(0, 120)),
      },
      skills: chosen.map(skillId),
      education: [],
      experience: [],
      projects: [],
      certificates: [],
      total_experience: 0,
      ...SEED,
      createdAt: daysAgo(int(20, 800)), updatedAt: new Date(),
      __v: 0,
    });
  }

  await db.collection('users').insertMany(users);
  await db.collection('students').insertMany(students);
  console.log(`👥 ${users.length} students created`);

  /* ---- Recruiter accounts + openings ---- */

  const recruiterUsers: any[] = [];
  const recruiterProfiles: any[] = [];
  const openings: any[] = [];

  for (const c of COMPANIES) {
    const ruid = new Types.ObjectId();
    const slug = c.name.toLowerCase().replace(/[^a-z]/g, '');
    recruiterUsers.push({
      _id: ruid,
      password: passwordHash,
      firstName: 'talent',
      lastName: slug,
      email: `careers@${slug}.demo`,
      roles: ['recruiter'],
      status: 'active',
      ...SEED,
      createdAt: daysAgo(int(100, 700)), updatedAt: new Date(), __v: 0,
    });
    recruiterProfiles.push({
      _id: new Types.ObjectId(),
      user: ruid,
      company: c.name,
      industry: c.sector,
      location: pick(LOCATIONS),
      company_size: c.tier === 'dream' ? '500+' : pick(['201-500', '500+'] as const),
      about: `${c.name} hires across campuses in the ${c.sector} sector.`,
      ...SEED,
      createdAt: new Date(), updatedAt: new Date(), __v: 0,
    });

    // One or two live roles per company, with realistic eligibility bars.
    const roleCount = c.hires > 15 ? 2 : 1;
    for (let r = 0; r < roleCount; r++) {
      const isIntern = r === 1;
      const techDepts = DEPARTMENTS.filter((d) => d.techy).map((d) => d.name);
      const targetDepts =
        c.sector === 'Agritech' ? ['Agriculture', 'Biotechnology']
        : c.sector === 'Healthcare' ? ['Nursing']
        : c.sector === 'Core Engineering' ? ['Mechanical Engineering', 'Civil Engineering']
        : c.sector === 'Consulting' ? ['Management Studies', ...techDepts]
        : techDepts;

      openings.push({
        _id: new Types.ObjectId(),
        recruiter: ruid,
        company: c.name,
        title: isIntern ? `${c.sector} Intern` : c.tier === 'dream' ? 'Software Development Engineer' : `Graduate Engineer Trainee`,
        description: `${c.name} is hiring for its ${new Date().getFullYear()} campus cohort. Selected candidates join the ${c.sector} practice.`,
        type: isIntern ? 'internship' : 'job',
        work_mode: pick(['onsite', 'hybrid', 'remote'] as const),
        location: pick(LOCATIONS),
        skills: [...new Set(Array.from({ length: 3 }, () => pick(TECH_SKILLS)))].map(skillId),
        eligible_universities: ['Akal University', 'Eternal University'],
        eligible_departments: targetDepts,
        eligible_batches: [2027],
        min_cgpa: c.tier === 'dream' ? 8 : c.tier === 'core' ? 7 : 6,
        max_backlogs: c.tier === 'regular' ? 1 : 0,
        allow_placed: false,
        tier: c.tier,
        ctc_lpa: round1((c.ctc[0] + c.ctc[1]) / 2),
        stipend_or_salary: isIntern ? '₹25,000/month' : `${c.ctc[0]}–${c.ctc[1]} LPA`,
        rounds: pick(ROUND_SETS).map((name, i) => ({ name, order: i + 1 })),
        apply_by: daysAgo(-int(5, 60)),
        status: chance(0.8) ? 'open' : 'closed',
        ...SEED,
        createdAt: daysAgo(int(10, 200)), updatedAt: new Date(), __v: 0,
      });
    }
  }

  await db.collection('users').insertMany(recruiterUsers);
  await db.collection('recruiters').insertMany(recruiterProfiles);
  await db.collection('openings').insertMany(openings);
  console.log(`🏢 ${recruiterUsers.length} recruiters, ${openings.length} openings created`);

  /* ---- Placements ---- */

  // Only students seeking placement can be placed.
  const seeking = students.filter((s) => s.placement_intent === 'placement');
  const byBatch = new Map<number, any[]>();
  for (const s of seeking) {
    const arr = byBatch.get(s.batch_year) ?? [];
    arr.push(s);
    byBatch.set(s.batch_year, arr);
  }

  const placements: any[] = [];
  const placedUserIds = new Set<string>();

  for (const batch of BATCHES) {
    const cohort = (byBatch.get(batch.year) ?? []).slice();
    // Higher CGPA students get placed first — mirrors reality and makes the
    // "does CGPA predict placement" chart meaningful rather than flat.
    cohort.sort((a, b) => (b.cgpa - a.cgpa) + (rnd() - 0.5) * 2.5);

    const target = Math.round(cohort.length * batch.placedRate);
    for (let i = 0; i < target; i++) {
      const s = cohort[i];
      if (!s) break;

      // Strong students reach the higher tiers.
      const eligibleCos = COMPANIES.filter((c) =>
        c.tier === 'dream' ? s.cgpa >= 8.3
        : c.tier === 'core' ? s.cgpa >= 7.2
        : true
      );
      const co = weighted(eligibleCos.map((c) => [c, c.hires] as const));
      const ctc = round1(co.ctc[0] + rnd() * (co.ctc[1] - co.ctc[0]));
      const offerDate = daysAgo(int(10, batch.year === 2026 ? 500 : 300));

      placements.push({
        _id: new Types.ObjectId(),
        student: s.user,
        company: co.name,
        role: co.tier === 'dream' ? 'Software Development Engineer' : 'Graduate Engineer Trainee',
        type: chance(0.12) ? 'ppo' : 'job',
        source: chance(0.85) ? 'campus' : 'off_campus',
        location: pick(LOCATIONS),
        sector: co.sector,
        ctc_lpa: ctc,
        offer_date: offerDate,
        start_date: new Date(offerDate.getTime() + int(30, 180) * 864e5),
        status: chance(0.06) ? 'declined' : weighted([['accepted', 60], ['joined', 35], ['completed', 5]] as const),
        ...SEED,
        createdAt: offerDate, updatedAt: new Date(), __v: 0,
      });
      placedUserIds.add(String(s.user));

      // A small number of top students hold a second offer — this is exactly
      // what the one-offer policy exists to prevent.
      if (s.cgpa >= 8.5 && chance(0.18)) {
        const co2 = pick(COMPANIES.filter((c) => c.tier !== 'regular'));
        placements.push({
          _id: new Types.ObjectId(),
          student: s.user,
          company: co2.name,
          role: 'Software Development Engineer',
          type: 'job',
          source: 'campus',
          location: pick(LOCATIONS),
          sector: co2.sector,
          ctc_lpa: round1(co2.ctc[0] + rnd() * (co2.ctc[1] - co2.ctc[0])),
          offer_date: daysAgo(int(10, 200)),
          status: 'accepted',
          ...SEED,
          createdAt: new Date(), updatedAt: new Date(), __v: 0,
        });
      }
    }
  }

  /* ---- Internships (mostly pre-final year) ---- */

  const internCandidates = seeking.filter((s) => s.batch_year >= 2028 || (s.batch_year === 2027 && !placedUserIds.has(String(s.user))));
  for (const s of internCandidates) {
    if (!chance(0.28)) continue;
    const ic = pick(INTERN_COMPANIES);
    const start = daysAgo(int(20, 260));
    placements.push({
      _id: new Types.ObjectId(),
      student: s.user,
      company: ic.name,
      role: 'Intern',
      type: 'internship',
      source: 'campus',
      location: ic.location,
      sector: COMPANIES.find((c) => c.name === ic.name)?.sector ?? 'Product',
      stipend: Math.round((ic.stipend[0] + rnd() * (ic.stipend[1] - ic.stipend[0])) / 1000) * 1000,
      offer_date: start,
      start_date: start,
      status: weighted([['joined', 55], ['completed', 40], ['accepted', 5]] as const),
      ...SEED,
      createdAt: start, updatedAt: new Date(), __v: 0,
    });
  }

  await db.collection('placements').insertMany(placements);
  console.log(`🎓 ${placements.length} placement records created`);

  /* ---- Applications with round progress ---- */

  const applications: any[] = [];
  const openOpenings = openings.filter((o) => o.status === 'open');

  for (const s of seeking) {
    if (s.batch_year > 2028) continue;
    // Engaged students apply widely; disengaged ones barely at all.
    const n = s.resume_verified ? int(3, 9) : chance(0.45) ? int(1, 3) : 0;
    const targets = [...new Set(Array.from({ length: n }, () => pick(openOpenings)))];

    for (const op of targets) {
      const isPlacedHere = placements.some(
        (p) => String(p.student) === String(s.user) && p.company === op.company && p.type !== 'internship'
      );
      const rounds: { name: string; order: number; result: string; date?: Date }[] =
        (op.rounds as any[]).map((r) => ({ name: r.name, order: r.order, result: 'pending' }));

      // Walk the pipeline: each round has a survival probability tied to CGPA.
      let cleared = 0;
      for (let i = 0; i < rounds.length; i++) {
        const survive = isPlacedHere ? 1 : Math.min(0.92, 0.32 + (s.cgpa - 5) * 0.13);
        if (chance(survive)) { rounds[i].result = 'cleared'; rounds[i].date = daysAgo(int(5, 120)); cleared++; }
        else { rounds[i].result = chance(0.85) ? 'failed' : 'absent'; rounds[i].date = daysAgo(int(5, 120)); break; }
      }

      const finished = cleared === rounds.length;
      const status = isPlacedHere || finished ? (isPlacedHere ? 'accepted' : 'offered')
        : cleared === 0 ? weighted([['applied', 55], ['reviewed', 25], ['rejected', 20]] as const)
        : cleared >= rounds.length - 1 ? 'interviewed'
        : weighted([['shortlisted', 45], ['rejected', 55]] as const);

      // Rounds only make sense once the application has actually progressed.
      const keepRounds = ['applied', 'reviewed'].includes(status)
        ? rounds.map((r) => ({ ...r, result: 'pending', date: undefined }))
        : rounds;

      applications.push({
        _id: new Types.ObjectId(),
        opening: op._id,
        student: s.user,
        recruiter: op.recruiter,
        status,
        rounds: keepRounds,
        current_round: ['applied', 'reviewed'].includes(status) ? 0 : cleared,
        ...SEED,
        createdAt: daysAgo(int(10, 180)), updatedAt: new Date(), __v: 0,
      });
    }
  }

  await db.collection('applications').insertMany(applications);
  console.log(`📄 ${applications.length} applications created`);

  /* ---- Company outreach across three sessions ---- */

  const thisSession = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const invitations: any[] = [];

  for (let s = 2; s >= 0; s--) {
    const session = thisSession - s;
    // Earlier sessions saw fewer companies — the programme has been growing.
    const roster = COMPANIES.slice(0, COMPANIES.length - s * 4);
    for (const c of roster) {
      const seenBefore = invitations.some((i) => i.company === c.name && i.session < session);
      const stage = s === 0
        ? weighted([['hired', 45], ['visited', 15], ['scheduled', 15], ['responded', 12], ['invited', 8], ['declined', 5]] as const)
        : weighted([['hired', 70], ['visited', 12], ['declined', 12], ['responded', 6]] as const);

      invitations.push({
        _id: new Types.ObjectId(),
        company: c.name,
        sector: c.sector,
        contact_name: 'Campus Relations',
        contact_email: `campus@${c.name.toLowerCase().replace(/[^a-z]/g, '')}.demo`,
        session,
        stage,
        is_repeat: seenBefore,
        invited_at: new Date(session, 7, int(1, 28)),
        responded_at: stage !== 'invited' ? new Date(session, 8, int(1, 28)) : undefined,
        visit_date: ['visited', 'hired'].includes(stage) ? new Date(session, 9, int(1, 28)) : undefined,
        hires: stage === 'hired' ? int(2, c.hires) : 0,
        ...SEED,
        createdAt: new Date(), updatedAt: new Date(), __v: 0,
      });
    }
  }

  await db.collection('invitations').insertMany(invitations);
  console.log(`🤝 ${invitations.length} company outreach records created`);

  /* ---- Summary ---- */

  const placedJobs = new Set(
    placements.filter((p) => p.type !== 'internship' && ['accepted', 'joined', 'completed'].includes(p.status))
      .map((p) => String(p.student))
  );
  const fy = seeking.filter((s) => s.batch_year === 2027);
  const fyPlaced = fy.filter((s) => placedJobs.has(String(s.user)));
  const ctcs = placements.filter((p) => p.ctc_lpa && ['accepted', 'joined', 'completed'].includes(p.status))
    .map((p) => p.ctc_lpa).sort((a, b) => a - b);

  console.log('\n📊 Summary');
  console.log(`   students            ${students.length} (${seeking.length} seeking placement)`);
  console.log(`   placed (job/PPO)    ${placedJobs.size}`);
  console.log(`   final year 2027     ${fyPlaced.length}/${fy.length} = ${((fyPlaced.length / fy.length) * 100).toFixed(1)}%`);
  console.log(`   median CTC          ${ctcs[Math.floor(ctcs.length / 2)]} LPA`);
  console.log(`   mean CTC            ${(ctcs.reduce((a, b) => a + b, 0) / ctcs.length).toFixed(2)} LPA`);
  console.log(`   highest CTC         ${ctcs[ctcs.length - 1]} LPA`);
  console.log('\n   Student login: any AUID from 230100001, password "student123"');
  console.log('   Remove everything with:  npm run seed:demo -- --purge\n');

  await mongoose.disconnect();
}

/* --------------------------------- Main --------------------------------- */

const isPurge = process.argv.includes('--purge');
(isPurge ? purge() : seed()).catch((err) => {
  console.error('❌ Demo seed failed:', err);
  process.exit(1);
});
