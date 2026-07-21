import { Types } from 'mongoose';
import { Student, INTENT_LABELS, type PlacementIntent } from '../models/student.model';
import { User } from '../models/user.model';
import { Opening } from '../models/opening.model';
import { Skill } from '../models/skill.model';
import { Application, APPLICATION_STAGES } from '../models/application.model';
import { Placement, ACCEPTED_STATUSES } from '../models/placement.model';
import { Invitation } from '../models/invitation.model';
import { getPolicy } from '../models/policy.model';
import { cached } from '../utils/cache';

const ANALYTICS_NS = 'analytics';
const TTL = 120; // seconds — dashboard tolerates a 2-minute lag

/**
 * The graduating batch for the current academic session. Indian academic years
 * start in July, so from July onwards the "final year" cohort is next calendar
 * year's batch.
 */
export function currentFinalYearBatch(now = new Date(), startMonth = 6): number {
  return now.getMonth() >= startMonth ? now.getFullYear() + 1 : now.getFullYear();
}

/** Session year: 2026 means the 2026-27 academic session. */
export function currentSession(now = new Date(), startMonth = 6): number {
  return now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
}

const PLACED_MATCH = { status: { $in: ACCEPTED_STATUSES } };

/** Only students actually seeking placement belong in the denominator. */
const SEEKING = { placement_intent: { $in: ['placement', null] } };

export interface DashboardFilters {
  university?: string;
  department?: string;
  batch_year?: number;
  course?: string;
  type?: string;
  from?: string;
  to?: string;
}

type Bucket = { key: string; count: number };

const oid = (v: string) => (Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);

function bucketStages(field: string, missingLabel = 'Not specified') {
  return [
    { $group: { _id: { $ifNull: [field, null] }, count: { $sum: 1 } } },
    { $sort: { count: -1 as const, _id: 1 as const } },
    { $project: { _id: 0, key: { $ifNull: ['$_id', missingLabel] }, count: 1 } },
  ];
}

/** Percentile from a pre-sorted numeric array (linear interpolation). */
function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  const val = lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return +val.toFixed(2);
}

/** Five-number summary + outliers, for the salary box plot. */
function boxStats(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const q1 = percentile(s, 0.25)!, median = percentile(s, 0.5)!, q3 = percentile(s, 0.75)!;
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr, hiFence = q3 + 1.5 * iqr;
  const inliers = s.filter((v) => v >= loFence && v <= hiFence);
  return {
    min: s[0],
    q1, median, q3,
    max: s[s.length - 1],
    whisker_low: inliers.length ? inliers[0] : s[0],
    whisker_high: inliers.length ? inliers[inliers.length - 1] : s[s.length - 1],
    outliers: s.filter((v) => v < loFence || v > hiFence),
    mean: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(2),
    n: s.length,
  };
}

export class AnalyticsService {
  private hasStudentScope(f: DashboardFilters) {
    return !!(f.university || f.department || f.batch_year || f.course);
  }

  private studentStages(f: DashboardFilters) {
    const pre: Record<string, any> = {};
    if (f.department) pre.department = f.department;
    if (f.batch_year) pre.batch_year = f.batch_year;
    if (f.course) {
      const id = oid(f.course);
      if (id) pre.course = id;
    }
    const stages: any[] = [];
    if (Object.keys(pre).length) stages.push({ $match: pre });
    stages.push({ $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } });
    stages.push({ $unwind: '$u' });
    if (f.university) stages.push({ $match: { 'u.university': f.university } });
    return stages;
  }

  private byStudentStages(f: DashboardFilters, dateField?: string) {
    const stages: any[] = [];
    if (dateField && (f.from || f.to)) {
      const range: Record<string, Date> = {};
      if (f.from) range.$gte = new Date(f.from);
      if (f.to) range.$lte = new Date(f.to);
      stages.push({ $match: { [dateField]: range } });
    }
    if (!this.hasStudentScope(f)) return stages;

    stages.push({ $lookup: { from: 'students', localField: 'student', foreignField: 'user', as: '_sp' } });
    stages.push({ $unwind: '$_sp' });
    const sm: Record<string, any> = {};
    if (f.department) sm['_sp.department'] = f.department;
    if (f.batch_year) sm['_sp.batch_year'] = f.batch_year;
    if (f.course) {
      const id = oid(f.course);
      if (id) sm['_sp.course'] = id;
    }
    if (Object.keys(sm).length) stages.push({ $match: sm });
    if (f.university) {
      stages.push({ $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: '_su' } });
      stages.push({ $unwind: '$_su' });
      stages.push({ $match: { '_su.university': f.university } });
    }
    return stages;
  }

  private async distinctPlacedStudents(f: DashboardFilters, extra: Record<string, any>) {
    const rows = await Placement.aggregate([
      { $match: { ...PLACED_MATCH, ...extra } },
      ...this.byStudentStages(f, 'offer_date'),
      { $group: { _id: '$student' } },
    ]);
    return rows.map((r: any) => String(r._id));
  }

  async filterOptions() {
    return cached(ANALYTICS_NS, ['filters'], TTL, async () => {
      const [departments, batches, courses, universities, sectors] = await Promise.all([
        Student.distinct('department', { department: { $nin: [null, ''] } }),
        Student.distinct('batch_year', { batch_year: { $ne: null } }),
        Student.aggregate([
          { $match: { course: { $ne: null } } },
          { $group: { _id: '$course', count: { $sum: 1 } } },
          { $lookup: { from: 'courses', localField: '_id', foreignField: '_id', as: 'c' } },
          { $unwind: '$c' },
          { $project: { _id: 0, id: { $toString: '$_id' }, name: '$c.name', count: 1 } },
          { $sort: { name: 1 } },
        ]),
        User.distinct('university', { roles: 'student', university: { $ne: null } }),
        Placement.distinct('sector', { sector: { $nin: [null, ''] } }),
      ]);

      return {
        departments: (departments as string[]).sort(),
        batches: (batches as number[]).sort((a, b) => a - b),
        courses,
        universities: (universities as string[]).sort(),
        sectors: (sectors as string[]).sort(),
        types: ['job', 'internship', 'ppo'],
      };
    });
  }

  async overview(filters: DashboardFilters = {}) {
    const parts = [
      'overview', filters.university, filters.department, filters.batch_year,
      filters.course, filters.type, filters.from, filters.to,
    ];
    return cached(ANALYTICS_NS, parts, TTL, () => this.compute(filters));
  }

  private async compute(f: DashboardFilters) {
    const policy = await getPolicy();
    const finalYearBatch = currentFinalYearBatch(new Date(), policy.session_start_month);
    const session = currentSession(new Date(), policy.session_start_month);
    const scoped = this.hasStudentScope(f);
    const typeMatch = f.type ? { type: f.type } : {};
    const jobTypes = f.type ? [f.type] : ['job', 'ppo'];

    const [
      studentUserCount, profileAgg, seekingAgg, intentBreakdown,
      recruiterCounts, openingCounts,
      byUniversity, byDepartment, byCourse, byBatch, byCgpaBand, byGender,
      funnel, applicationTrend, roundDropoff, applicationsPerStudent,
      ctcValues, stipendValues, placementByType, placementTrend, ctcBands,
      placedStudentIds, internStudentIds,
      topCompanies, internshipCompanies, recentPlacements, sectorSplit, geoSplit,
      topSkills, lookingFor, deptTotals, deptPlacedRows,
      offersPerStudent, cgpaVsPlacement, yoyRows, pacingRows,
      skillDemand, prepStats, invitationFunnel, recruiterChurn,
    ] = await Promise.all([
      scoped ? Promise.resolve(0) : User.countDocuments({ roles: 'student' }),
      Student.aggregate([...this.studentStages(f), { $count: 'n' }]),
      Student.aggregate([...this.studentStages(f), { $match: SEEKING }, { $count: 'n' }]),

      // Outcome composition — the honest picture of a graduating batch.
      Student.aggregate([
        ...this.studentStages(f),
        { $group: { _id: { $ifNull: ['$placement_intent', 'placement'] }, count: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),

      User.aggregate([{ $match: { roles: 'recruiter' } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Opening.aggregate([
        ...(f.university ? [{ $match: { eligible_universities: f.university } }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),

      Student.aggregate([...this.studentStages(f), ...bucketStages('$u.university', 'Unassigned')]),
      Student.aggregate([...this.studentStages(f), ...bucketStages('$department')]),
      Student.aggregate([
        ...this.studentStages(f),
        { $lookup: { from: 'courses', localField: 'course', foreignField: '_id', as: 'c' } },
        { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
        ...bucketStages('$c.name'),
      ]),
      Student.aggregate([
        ...this.studentStages(f),
        { $group: { _id: { $ifNull: ['$batch_year', null] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, count: 1, key: { $toString: { $ifNull: ['$_id', 'Not specified'] } }, _null: { $cond: [{ $eq: ['$_id', null] }, 1, 0] } } },
        { $sort: { _null: 1 } },
        { $project: { _null: 0 } },
      ]),
      Student.aggregate([
        ...this.studentStages(f),
        { $match: { cgpa: { $gt: 0 } } },
        { $bucket: { groupBy: '$cgpa', boundaries: [0, 5, 6, 7, 8, 9, 10.01], default: 'Unknown', output: { count: { $sum: 1 } } } },
        { $project: { _id: 0, key: { $toString: '$_id' }, count: 1 } },
      ]),
      Student.aggregate([...this.studentStages(f), ...bucketStages('$u.gender', 'Not recorded')]),

      Application.aggregate([...this.byStudentStages(f, 'createdAt'), { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Application.aggregate([
        { $match: { createdAt: { $gte: new Date(Date.now() - 365 * 24 * 3600 * 1000) } } },
        ...this.byStudentStages(f, 'createdAt'),
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),

      // Round-wise attrition — where in the process students actually fail.
      Application.aggregate([
        ...this.byStudentStages(f, 'createdAt'),
        { $unwind: '$rounds' },
        { $group: { _id: { name: '$rounds.name', order: '$rounds.order', result: '$rounds.result' }, count: { $sum: 1 } } },
        { $sort: { '_id.order': 1 } },
        { $project: { _id: 0, name: '$_id.name', order: '$_id.order', result: '$_id.result', count: 1 } },
      ]),

      // Application activity per student — passive students are the risk group.
      Application.aggregate([
        ...this.byStudentStages(f, 'createdAt'),
        { $group: { _id: '$student', n: { $sum: 1 } } },
        { $bucket: { groupBy: '$n', boundaries: [1, 2, 4, 7, 11, 1000], default: 'other', output: { count: { $sum: 1 } } } },
        { $project: { _id: 0, key: { $toString: '$_id' }, count: 1 } },
      ]),

      // Raw values — medians and box stats are computed in JS.
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch, ctc_lpa: { $gt: 0 } } },
        ...this.byStudentStages(f, 'offer_date'),
        { $project: { _id: 0, v: '$ctc_lpa' } },
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, type: 'internship', stipend: { $gt: 0 } } },
        ...this.byStudentStages(f, 'offer_date'),
        { $project: { _id: 0, v: '$stipend' } },
      ]),

      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch } },
        ...this.byStudentStages(f, 'offer_date'),
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch, offer_date: { $gte: new Date(Date.now() - 365 * 24 * 3600 * 1000) } } },
        ...this.byStudentStages(f),
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$offer_date' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch, ctc_lpa: { $gt: 0 } } },
        ...this.byStudentStages(f, 'offer_date'),
        { $bucket: { groupBy: '$ctc_lpa', boundaries: [0, 5, 10, 15, 20, 30, 1000], default: 'Other', output: { count: { $sum: 1 } } } },
        { $project: { _id: 0, key: { $toString: '$_id' }, count: 1 } },
      ]),

      this.distinctPlacedStudents(f, { type: { $in: jobTypes } }),
      this.distinctPlacedStudents(f, { type: 'internship' }),

      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch } },
        ...this.byStudentStages(f, 'offer_date'),
        { $group: { _id: '$company', count: { $sum: 1 }, avg_ctc: { $avg: '$ctc_lpa' }, max_ctc: { $max: '$ctc_lpa' } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 10 },
        { $project: { _id: 0, key: '$_id', count: 1, avg_ctc: 1, max_ctc: 1 } },
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, type: 'internship' } },
        ...this.byStudentStages(f, 'offer_date'),
        { $group: { _id: { company: '$company', location: { $ifNull: ['$location', ''] } }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
        { $project: { _id: 0, company: '$_id.company', location: '$_id.location', count: 1 } },
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch } },
        ...this.byStudentStages(f, 'offer_date'),
        { $sort: { offer_date: -1, createdAt: -1 } },
        { $limit: 12 },
        { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            company: 1, role: 1, type: 1, ctc_lpa: 1, stipend: 1, status: 1, offer_date: 1, location: 1, sector: 1,
            student_name: { $trim: { input: { $concat: [{ $ifNull: ['$u.firstName', ''] }, ' ', { $ifNull: ['$u.lastName', ''] }] } } },
            student_id: '$u._id',
          },
        },
      ]),

      // Sector concentration — 80% in one sector is a fragility risk.
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch } },
        ...this.byStudentStages(f, 'offer_date'),
        ...bucketStages('$sector', 'Unclassified'),
      ]),
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, ...typeMatch } },
        ...this.byStudentStages(f, 'offer_date'),
        ...bucketStages('$location', 'Not recorded'),
        { $limit: 12 },
      ]),

      Student.aggregate([
        ...this.studentStages(f),
        { $unwind: '$skills' },
        { $group: { _id: '$skills', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 12 },
        { $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 's' } },
        { $unwind: '$s' },
        { $project: { _id: 0, key: '$s.displayName', count: 1 } },
      ]),
      Student.aggregate([...this.studentStages(f), ...bucketStages('$looking_for.type', 'Not specified')]),

      Student.aggregate([
        ...this.studentStages(f),
        { $match: SEEKING },
        { $group: { _id: { $ifNull: ['$department', 'Not specified'] }, total: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', total: 1 } },
      ]),

      Placement.aggregate([
        { $match: { ...PLACED_MATCH, type: { $in: jobTypes } } },
        ...(f.from || f.to
          ? [{ $match: { offer_date: { ...(f.from ? { $gte: new Date(f.from) } : {}), ...(f.to ? { $lte: new Date(f.to) } : {}) } } }]
          : []),
        { $lookup: { from: 'students', localField: 'student', foreignField: 'user', as: '_sp' } },
        { $unwind: '$_sp' },
        ...(f.department ? [{ $match: { '_sp.department': f.department } }] : []),
        ...(f.batch_year ? [{ $match: { '_sp.batch_year': f.batch_year } }] : []),
        ...(f.course && oid(f.course) ? [{ $match: { '_sp.course': oid(f.course) } }] : []),
        ...(f.university
          ? [
              { $lookup: { from: 'users', localField: 'student', foreignField: '_id', as: '_su' } },
              { $unwind: '$_su' },
              { $match: { '_su.university': f.university } },
            ]
          : []),
        { $group: { _id: { d: { $ifNull: ['$_sp.department', 'Not specified'] }, s: '$student' } } },
        { $group: { _id: '$_id.d', placed: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', placed: 1 } },
      ]),

      // Offer hoarding — how many students hold 1, 2, 3+ offers.
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, type: { $in: ['job', 'ppo'] } } },
        ...this.byStudentStages(f, 'offer_date'),
        { $group: { _id: '$student', n: { $sum: 1 } } },
        { $group: { _id: '$n', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, key: { $concat: [{ $toString: '$_id' }, ' offer(s)'] }, count: 1, offers: '$_id' } },
      ]),

      // Does CGPA predict placement? Needs the join both ways.
      Student.aggregate([
        ...this.studentStages(f),
        { $match: { cgpa: { $gt: 0 }, ...SEEKING } },
        {
          $lookup: {
            from: 'placements',
            let: { uid: '$user' },
            pipeline: [
              { $match: { $expr: { $eq: ['$student', '$$uid'] }, status: { $in: ACCEPTED_STATUSES }, type: { $in: ['job', 'ppo'] } } },
              { $limit: 1 },
            ],
            as: '_p',
          },
        },
        {
          $bucket: {
            groupBy: '$cgpa',
            boundaries: [0, 5, 6, 7, 8, 9, 10.01],
            default: 'Unknown',
            output: { total: { $sum: 1 }, placed: { $sum: { $cond: [{ $gt: [{ $size: '$_p' }, 0] }, 1, 0] } } },
          },
        },
        { $project: { _id: 0, key: { $toString: '$_id' }, total: 1, placed: 1 } },
      ]),

      // Year-on-year, by graduating batch.
      Student.aggregate([
        { $match: { batch_year: { $ne: null }, ...SEEKING } },
        {
          $lookup: {
            from: 'placements',
            let: { uid: '$user' },
            pipeline: [
              { $match: { $expr: { $eq: ['$student', '$$uid'] }, status: { $in: ACCEPTED_STATUSES }, type: { $in: ['job', 'ppo'] } } },
              { $sort: { ctc_lpa: -1 } },
              { $limit: 1 },
            ],
            as: '_p',
          },
        },
        {
          $group: {
            _id: '$batch_year',
            total: { $sum: 1 },
            placed: { $sum: { $cond: [{ $gt: [{ $size: '$_p' }, 0] }, 1, 0] } },
            ctcs: { $push: { $arrayElemAt: ['$_p.ctc_lpa', 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, batch: '$_id', total: 1, placed: 1, ctcs: 1 } },
      ]),

      // Season pacing: offers by day-offset within each academic session.
      Placement.aggregate([
        { $match: { ...PLACED_MATCH, type: { $in: ['job', 'ppo'] }, offer_date: { $ne: null } } },
        {
          $project: {
            offer_date: 1,
            session: {
              $cond: [
                { $gte: [{ $month: '$offer_date' }, policy.session_start_month + 1] },
                { $year: '$offer_date' },
                { $subtract: [{ $year: '$offer_date' }, 1] },
              ],
            },
          },
        },
        { $group: { _id: { session: '$session', month: { $month: '$offer_date' } }, count: { $sum: 1 } } },
        { $sort: { '_id.session': 1, '_id.month': 1 } },
        { $project: { _id: 0, session: '$_id.session', month: '$_id.month', count: 1 } },
      ]),

      // Skills demanded by open roles — pair with supply for the gap chart.
      Opening.aggregate([
        { $match: { status: 'open' } },
        { $unwind: '$skills' },
        { $group: { _id: '$skills', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
        { $lookup: { from: 'skills', localField: '_id', foreignField: '_id', as: 's' } },
        { $unwind: '$s' },
        { $project: { _id: 0, key: '$s.displayName', count: 1, skill_id: { $toString: '$_id' } } },
      ]),

      // Preparation readiness — leading indicators.
      Student.aggregate([
        ...this.studentStages(f),
        {
          $group: {
            _id: null,
            avg_aptitude: { $avg: '$aptitude_score' },
            avg_mock: { $avg: '$mock_interview_score' },
            avg_attendance: { $avg: '$training_attendance' },
            with_aptitude: { $sum: { $cond: [{ $gt: ['$aptitude_score', 0] }, 1, 0] } },
            mock_attended: { $sum: { $cond: [{ $gt: ['$mock_interviews', 0] }, 1, 0] } },
            resume_verified: { $sum: { $cond: ['$resume_verified', 1, 0] } },
            n: { $sum: 1 },
          },
        },
      ]),

      Invitation.aggregate([
        { $match: { session } },
        { $group: { _id: '$stage', count: { $sum: 1 } } },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),
      Invitation.aggregate([
        { $group: { _id: { session: '$session', repeat: '$is_repeat' }, count: { $sum: 1 } } },
        { $sort: { '_id.session': 1 } },
        { $project: { _id: 0, session: '$_id.session', repeat: '$_id.repeat', count: 1 } },
      ]),
    ]);

    /* ---------------- Final-year cohort ---------------- */

    const placedSet = new Set(placedStudentIds);
    const internSet = new Set(internStudentIds);

    const fyQuery: Record<string, any> = { batch_year: f.batch_year ?? finalYearBatch };
    if (f.department) fyQuery.department = f.department;
    if (f.course) {
      const id = oid(f.course);
      if (id) fyQuery.course = id;
    }

    let fyAll = await Student.find(fyQuery)
      .select('user department placement_intent')
      .populate('user', 'university')
      .lean();
    if (f.university) fyAll = fyAll.filter((s: any) => s.user?.university === f.university);

    // Denominator excludes anyone not seeking placement.
    const fySeeking = fyAll.filter((s: any) => (s.placement_intent ?? 'placement') === 'placement');
    const fyPlaced = fySeeking.filter((s: any) => s.user && placedSet.has(String(s.user._id)));

    const deptMap = new Map<string, { total: number; placed: number }>();
    for (const s of fySeeking as any[]) {
      const d = s.department || 'Not specified';
      const e = deptMap.get(d) ?? { total: 0, placed: 0 };
      e.total += 1;
      if (s.user && placedSet.has(String(s.user._id))) e.placed += 1;
      deptMap.set(d, e);
    }

    /* ---------------- Department × batch heatmap ---------------- */

    const heatSource = await Student.find({ batch_year: { $ne: null }, ...SEEKING })
      .select('user department batch_year')
      .populate('user', 'university')
      .lean();

    const heatMap = new Map<string, { total: number; placed: number }>();
    const heatDepts = new Set<string>();
    const heatBatches = new Set<number>();
    for (const s of heatSource as any[]) {
      if (f.university && s.user?.university !== f.university) continue;
      const d = s.department || 'Not specified';
      heatDepts.add(d);
      heatBatches.add(s.batch_year);
      const k = `${d}|${s.batch_year}`;
      const e = heatMap.get(k) ?? { total: 0, placed: 0 };
      e.total += 1;
      if (s.user && placedSet.has(String(s.user._id))) e.placed += 1;
      heatMap.set(k, e);
    }
    const heatmap = {
      departments: [...heatDepts].sort(),
      batches: [...heatBatches].sort((a, b) => a - b),
      cells: [...heatMap.entries()].map(([k, v]) => {
        const [department, batch] = k.split('|');
        return {
          department, batch: Number(batch), total: v.total, placed: v.placed,
          rate: v.total ? +((v.placed / v.total) * 100).toFixed(1) : 0,
        };
      }),
    };

    /* ---------------- Shape ---------------- */

    const toMap = (rows: any[]) =>
      rows.reduce<Record<string, number>>((acc, r) => ((acc[r._id ?? 'unknown'] = r.count), acc), {});

    const recruiterByStatus = toMap(recruiterCounts);
    const openingByStatus = toMap(openingCounts);
    const funnelMap = toMap(funnel);

    const ctcs = (ctcValues as any[]).map((r) => r.v);
    const stipends = (stipendValues as any[]).map((r) => r.v);
    const ctcBox = boxStats(ctcs);
    const stipendBox = boxStats(stipends);

    const profileTotal = profileAgg[0]?.n ?? 0;
    const seekingTotal = seekingAgg[0]?.n ?? 0;
    const registeredTotal = scoped ? profileTotal : studentUserCount;
    const placedCount = placedSet.size;

    const placedByDept = new Map<string, number>(deptPlacedRows.map((r: any) => [r.key, r.placed]));
    const deptComparison = (deptTotals as any[])
      .map((d) => {
        const placed = placedByDept.get(d.key) ?? 0;
        return {
          key: d.key, total: d.total, placed,
          unplaced: Math.max(0, d.total - placed),
          rate: d.total ? +((placed / d.total) * 100).toFixed(1) : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    const bandLabel = (b: string, kind: 'cgpa' | 'ctc' | 'apps') => {
      const n = Number(b);
      if (Number.isNaN(n)) return b;
      // CGPA buckets are [0,5,6,7,8,9,10.01] — the first spans everything under 5.
      if (kind === 'cgpa') return n === 0 ? '< 5' : n >= 9 ? '9 – 10' : `${n} – ${n + 1}`;
      if (kind === 'apps') return ({ 1: '1', 2: '2–3', 4: '4–6', 7: '7–10', 11: '11+' } as Record<number, string>)[n] ?? b;
      return ({ 0: '< 5', 5: '5 – 10', 10: '10 – 15', 15: '15 – 20', 20: '20 – 30', 30: '30+' } as Record<number, string>)[n] ?? b;
    };

    // Skill supply vs demand.
    const supplyMap = new Map<string, number>((topSkills as any[]).map((s) => [s.key, s.count]));
    const skillGap = (skillDemand as any[]).map((d) => ({
      key: d.key,
      demand: d.count,
      supply: supplyMap.get(d.key) ?? 0,
    }));

    const yoy = (yoyRows as any[]).map((r) => {
      const vals = (r.ctcs ?? []).filter((v: any) => typeof v === 'number' && v > 0).sort((a: number, b: number) => a - b);
      return {
        batch: r.batch,
        total: r.total,
        placed: r.placed,
        rate: r.total ? +((r.placed / r.total) * 100).toFixed(1) : 0,
        median_ctc: percentile(vals, 0.5),
        avg_ctc: vals.length ? +(vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(2) : null,
      };
    });

    // Cumulative pacing curve per session, indexed by months into the session.
    const pacingSessions = new Map<number, number[]>();
    for (const r of pacingRows as any[]) {
      const idx = (r.month - 1 - policy.session_start_month + 12) % 12;
      const arr = pacingSessions.get(r.session) ?? new Array(12).fill(0);
      arr[idx] += r.count;
      pacingSessions.set(r.session, arr);
    }
    const monthNames = Array.from({ length: 12 }, (_, i) =>
      new Date(2000, (policy.session_start_month + i) % 12, 1).toLocaleString('en', { month: 'short' })
    );
    const pacing = {
      months: monthNames,
      series: [...pacingSessions.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([sess, arr]) => {
          let run = 0;
          return { session: sess, label: `${sess}-${String((sess + 1) % 100).padStart(2, '0')}`, values: arr.map((v) => (run += v)) };
        }),
    };

    const churn = (() => {
      const bySession = new Map<number, { repeat: number; fresh: number }>();
      for (const r of recruiterChurn as any[]) {
        const e = bySession.get(r.session) ?? { repeat: 0, fresh: 0 };
        if (r.repeat) e.repeat += r.count; else e.fresh += r.count;
        bySession.set(r.session, e);
      }
      return [...bySession.entries()].sort((a, b) => a[0] - b[0]).map(([s, v]) => ({ session: s, ...v }));
    })();

    const prep = prepStats[0] ?? null;

    return {
      generated_at: new Date().toISOString(),
      final_year_batch: finalYearBatch,
      session,
      filters_applied: f,
      policy: {
        one_offer_lock: policy.one_offer_lock,
        allow_upgrade_to_higher_tier: policy.allow_upgrade_to_higher_tier,
        dream_ctc_threshold: policy.dream_ctc_threshold,
        max_offers_per_student: policy.max_offers_per_student,
      },

      overview: {
        total_students: registeredTotal,
        profiles_completed: profileTotal,
        profiles_missing: Math.max(0, registeredTotal - profileTotal),
        seeking_placement: seekingTotal,
        opted_out: Math.max(0, profileTotal - seekingTotal),
        recruiters_active: recruiterByStatus.active ?? 0,
        recruiters_pending: recruiterByStatus.pending ?? 0,
        openings_open: openingByStatus.open ?? 0,
        openings_closed: openingByStatus.closed ?? 0,
        total_applications: APPLICATION_STAGES.reduce((n, s) => n + (funnelMap[s] ?? 0), 0),
        students_placed: placedCount,
        students_interning: internSet.size,
        // Denominator is students *seeking* placement — not everyone enrolled.
        placement_rate: seekingTotal ? +((placedCount / seekingTotal) * 100).toFixed(1) : 0,
        placement_rate_all: registeredTotal ? +((placedCount / registeredTotal) * 100).toFixed(1) : 0,
        median_ctc_lpa: ctcBox?.median ?? null,
        avg_ctc_lpa: ctcBox?.mean ?? null,
        highest_ctc_lpa: ctcBox?.max ?? null,
        lowest_ctc_lpa: ctcBox?.min ?? null,
        p25_ctc_lpa: ctcBox?.q1 ?? null,
        p75_ctc_lpa: ctcBox?.q3 ?? null,
        median_stipend: stipendBox?.median ?? null,
        avg_stipend: stipendBox?.mean ?? null,
        highest_stipend: stipendBox?.max ?? null,
      },

      distribution: {
        by_university: byUniversity as Bucket[],
        by_department: byDepartment as Bucket[],
        by_course: byCourse as Bucket[],
        by_batch: byBatch as Bucket[],
        by_looking_for: lookingFor as Bucket[],
        by_cgpa: (byCgpaBand as Bucket[]).map((b) => ({ ...b, key: bandLabel(b.key, 'cgpa') })),
        by_gender: byGender as Bucket[],
        outcome_composition: (intentBreakdown as any[]).map((r) => ({
          key: INTENT_LABELS[r.key as PlacementIntent] ?? r.key,
          count: r.count,
        })),
        top_skills: topSkills as Bucket[],
        skill_gap: skillGap,
      },

      applications: {
        funnel: APPLICATION_STAGES.map((s) => ({ key: s, count: funnelMap[s] ?? 0 })),
        trend: applicationTrend as Bucket[],
        round_dropoff: roundDropoff,
        per_student: (applicationsPerStudent as Bucket[]).map((b) => ({ ...b, key: bandLabel(b.key, 'apps') })),
        shortlisted: funnelMap.shortlisted ?? 0,
        offered: funnelMap.offered ?? 0,
      },

      placements: {
        by_type: ['job', 'ppo', 'internship'].map((t) => ({
          key: t, count: (placementByType as any[]).find((r) => r.key === t)?.count ?? 0,
        })),
        trend: placementTrend as Bucket[],
        ctc_bands: (ctcBands as Bucket[]).map((b) => ({ ...b, key: bandLabel(b.key, 'ctc') })),
        ctc_box: ctcBox,
        stipend_box: stipendBox,
        by_department: deptComparison,
        heatmap,
        offers_per_student: offersPerStudent,
        cgpa_vs_placement: (cgpaVsPlacement as any[]).map((r) => ({
          key: bandLabel(r.key, 'cgpa'),
          total: r.total,
          placed: r.placed,
          rate: r.total ? +((r.placed / r.total) * 100).toFixed(1) : 0,
        })),
        sectors: sectorSplit as Bucket[],
        locations: geoSplit as Bucket[],
        top_companies: topCompanies,
        internship_destinations: internshipCompanies,
        recent: recentPlacements,
      },

      companies: {
        invitation_funnel: ['invited', 'responded', 'scheduled', 'visited', 'hired'].map((s) => ({
          key: s, count: (invitationFunnel as any[]).find((r) => r.key === s)?.count ?? 0,
        })),
        declined: (invitationFunnel as any[]).find((r) => r.key === 'declined')?.count ?? 0,
        churn,
      },

      readiness: prep
        ? {
            avg_aptitude: prep.avg_aptitude ? +prep.avg_aptitude.toFixed(1) : null,
            avg_mock_score: prep.avg_mock ? +prep.avg_mock.toFixed(1) : null,
            avg_attendance: prep.avg_attendance ? +prep.avg_attendance.toFixed(1) : null,
            with_aptitude: prep.with_aptitude ?? 0,
            mock_attended: prep.mock_attended ?? 0,
            resume_verified: prep.resume_verified ?? 0,
            total: prep.n ?? 0,
          }
        : null,

      trends: { yoy, pacing },

      final_year: {
        batch: f.batch_year ?? finalYearBatch,
        enrolled: fyAll.length,
        total: fySeeking.length,
        placed: fyPlaced.length,
        remaining: fySeeking.length - fyPlaced.length,
        opted_out: fyAll.length - fySeeking.length,
        rate: fySeeking.length ? +((fyPlaced.length / fySeeking.length) * 100).toFixed(1) : 0,
        by_department: [...deptMap.entries()]
          .map(([key, v]) => ({
            key, total: v.total, placed: v.placed, remaining: v.total - v.placed,
            rate: v.total ? +((v.placed / v.total) * 100).toFixed(1) : 0,
          }))
          .sort((a, b) => b.total - a.total),
      },
    };
  }

  /** Unplaced students in the graduating batch — the list a TPO chases. */
  async unplacedFinalYear(f: DashboardFilters = {}) {
    const policy = await getPolicy();
    const batch = f.batch_year ?? currentFinalYearBatch(new Date(), policy.session_start_month);
    const placed = new Set(await this.distinctPlacedStudents(f, { type: { $in: ['job', 'ppo'] } }));

    const query: Record<string, any> = { batch_year: batch, ...SEEKING };
    if (f.department) query.department = f.department;
    if (f.course) {
      const id = oid(f.course);
      if (id) query.course = id;
    }

    const rows = await Student.find(query)
      .select('user department cgpa backlogs course aptitude_score mock_interviews training_attendance')
      .populate('user', 'firstName lastName auid email university')
      .populate('course', 'name')
      .lean();

    const ids = rows.filter((s: any) => s.user).map((s: any) => s.user._id);
    const appCounts = await Application.aggregate([
      { $match: { student: { $in: ids } } },
      { $group: { _id: '$student', n: { $sum: 1 } } },
    ]);
    const appMap = new Map(appCounts.map((a: any) => [String(a._id), a.n]));

    return rows
      .filter((s: any) => s.user && !placed.has(String(s.user._id)))
      .filter((s: any) => !f.university || s.user.university === f.university)
      .map((s: any) => {
        const applications = appMap.get(String(s.user._id)) ?? 0;
        // Simple risk score — the TPO's call-list ordering.
        let risk = 0;
        if (applications === 0) risk += 3;
        else if (applications < 3) risk += 2;
        if ((s.backlogs ?? 0) > 0) risk += 2;
        if (s.cgpa != null && s.cgpa < 6.5) risk += 2;
        if (!s.aptitude_score) risk += 1;
        if (!s.mock_interviews) risk += 1;

        return {
          _id: s._id,
          name: `${s.user.firstName ?? ''} ${s.user.lastName ?? ''}`.trim(),
          auid: s.user.auid,
          email: s.user.email,
          university: s.user.university,
          department: s.department ?? null,
          course: s.course?.name ?? null,
          cgpa: s.cgpa ?? null,
          backlogs: s.backlogs ?? 0,
          applications,
          aptitude_score: s.aptitude_score ?? null,
          mock_interviews: s.mock_interviews ?? 0,
          risk,
          risk_band: risk >= 6 ? 'high' : risk >= 3 ? 'medium' : 'low',
        };
      })
      .sort((a, b) => b.risk - a.risk || a.applications - b.applications);
  }
}

export const analyticsService = new AnalyticsService();
