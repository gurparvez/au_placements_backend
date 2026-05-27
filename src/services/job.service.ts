import { Types } from 'mongoose';
import { Application } from '../models/application.model';
import { JobListing } from '../models/jobListing.model';
import { Student } from '../models/student.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { evaluateEligibility } from './eligibility.service';

const POSTER_ROLES = ['admin', 'internal_poster', 'recruiter', 'tpo'];
const MANAGER_ROLES = ['admin', 'tpo'];

export class JobService {
  private assertCanPost(user: any) {
    const roles = user?.roles || [];
    if (!roles.some((role: string) => POSTER_ROLES.includes(role))) {
      throw new ApiError(403, 'You do not have permission to post jobs.');
    }
  }

  private posterType(user: any) {
    if (user.roles?.includes('recruiter')) return 'ThirdParty';
    if (user.roles?.includes('internal_poster') || user.roles?.includes('tpo')) return 'Internal';
    return 'Admin';
  }

  private canManageJob(user: any, job: any) {
    const roles = user?.roles || [];
    return roles.some((role: string) => MANAGER_ROLES.includes(role)) || String(job.posted_by) === String(user?._id);
  }

  private assertCanManageJob(user: any, job: any) {
    if (!this.canManageJob(user, job)) {
      throw new ApiError(403, 'You do not have permission to manage this job.');
    }
  }

  private async computeEligibility(job: any) {
    const students = await Student.find({})
      .populate('user', '-password')
      .lean();

    const results = students
      .filter((student: any) => student.user)
      .map((student: any) => {
        const evaluation = evaluateEligibility(job, student, student.user);
        return {
          student: student._id,
          user: student.user._id,
          eligible: evaluation.eligible,
          reasons: evaluation.reasons,
          computed_at: new Date(),
        };
      });

    return JobListing.findByIdAndUpdate(
      job._id,
      { $set: { eligibility_results: results } },
      { new: true }
    );
  }

  private personalizeJob(job: any, userId?: string, applicationsByListing?: Map<string, any>) {
    const listingId = String(job._id);
    const override = userId
      ? job.eligibility_overrides?.find((result: any) => String(result.user) === String(userId))
      : undefined;
    const computedEligibility = userId
      ? job.eligibility_results?.find((result: any) => String(result.user) === String(userId))
      : undefined;
    const eligibility = override
      ? {
          eligible: override.eligible,
          reasons: override.eligible ? [] : [override.reason],
          overridden: true,
          override_reason: override.reason,
        }
      : computedEligibility
        ? {
            eligible: computedEligibility.eligible,
            reasons: computedEligibility.reasons,
            overridden: false,
          }
        : undefined;
    const application = applicationsByListing?.get(listingId);

    return {
      ...job,
      my_eligibility: eligibility,
      my_application: application
        ? {
            _id: application._id,
            current_status: application.current_status,
            applied_at: application.applied_at,
          }
        : undefined,
    };
  }

  async createJob(user: any, payload: Record<string, any>) {
    this.assertCanPost(user);

    const job = await JobListing.create({
      posted_by: user._id,
      poster_type: this.posterType(user),
      target_university: payload.target_university || 'Both',
      company_name: payload.company_name,
      title: payload.title,
      role: payload.role || payload.title,
      description: payload.description,
      type: payload.type,
      ctc_stipend: payload.ctc_stipend,
      location: payload.location,
      eligibility: payload.eligibility || {},
      deadline: payload.deadline,
      status: payload.status || 'Active',
      contact_person: payload.contact_person,
    });

    return this.computeEligibility(job);
  }

  async updateJob(jobId: string, user: any, payload: Record<string, any>) {
    if (!Types.ObjectId.isValid(jobId)) throw new ApiError(400, 'Invalid job id');

    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');
    this.assertCanManageJob(user, job);

    const updatableFields = [
      'target_university',
      'company_name',
      'title',
      'role',
      'description',
      'type',
      'ctc_stipend',
      'location',
      'eligibility',
      'deadline',
      'status',
      'contact_person',
    ];

    const update: Record<string, any> = {};
    updatableFields.forEach((field) => {
      if (payload[field] !== undefined) update[field] = payload[field];
    });

    const updated = await JobListing.findByIdAndUpdate(jobId, { $set: update }, { new: true });
    if (!updated) throw new ApiError(404, 'Job listing not found');

    if (
      payload.eligibility !== undefined ||
      payload.target_university !== undefined ||
      payload.status !== undefined ||
      payload.deadline !== undefined
    ) {
      return this.computeEligibility(updated);
    }

    return updated;
  }

  async recomputeEligibility(jobId: string) {
    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');
    return this.computeEligibility(job);
  }

  async recomputeEligibilityForStudent(userId: string) {
    const profile = await Student.findOne({ user: userId }).populate('user', '-password').lean();
    if (!profile || !profile.user) return;

    const jobs = await JobListing.find({ status: 'Active' });
    await Promise.all(
      jobs.map(async (job: any) => {
        const evaluation = evaluateEligibility(job, profile, profile.user);
        const existingResults = (job.eligibility_results || []).filter(
          (result: any) => String(result.user) !== String(userId)
        );

        existingResults.push({
          student: profile._id,
          user: (profile.user as any)._id,
          eligible: evaluation.eligible,
          reasons: evaluation.reasons,
          computed_at: new Date(),
        });

        job.eligibility_results = existingResults;
        await job.save();
      })
    );
  }

  async getJobs(query: Record<string, any>, currentUser?: any) {
    const filter: Record<string, any> = {};

    if (query.status) filter.status = query.status;
    else filter.status = 'Active';

    if (query.type) filter.type = query.type;
    if (query.company) filter.company_name = new RegExp(query.company, 'i');
    if (query.target_university) {
      filter.target_university = { $in: [query.target_university, 'Both'] };
    }

    const jobs = await JobListing.find(filter).sort({ deadline: 1, createdAt: -1 }).lean();

    let applicationsByListing = new Map<string, any>();
    if (currentUser) {
      const applications = await Application.find({ user: currentUser._id }).lean();
      applicationsByListing = new Map(
        applications.map((application: any) => [String(application.listing), application])
      );
    }

    return jobs.map((job) => this.personalizeJob(job, currentUser?._id, applicationsByListing));
  }

  async getJobById(jobId: string, currentUser?: any) {
    if (!Types.ObjectId.isValid(jobId)) throw new ApiError(400, 'Invalid job id');

    const job = await JobListing.findById(jobId).lean();
    if (!job) throw new ApiError(404, 'Job listing not found');

    let application: any;
    if (currentUser) {
      application = await Application.findOne({ user: currentUser._id, listing: job._id }).lean();
    }

    return this.personalizeJob(
      job,
      currentUser?._id,
      application ? new Map([[String(job._id), application]]) : undefined
    );
  }

  async apply(jobId: string, user: any) {
    if (!Types.ObjectId.isValid(jobId)) throw new ApiError(400, 'Invalid job id');

    const [job, profile] = await Promise.all([
      JobListing.findById(jobId),
      Student.findOne({ user: user._id }),
    ]);

    if (!job) throw new ApiError(404, 'Job listing not found');
    if (!profile) throw new ApiError(400, 'Create your student profile before applying.');

    const existing = await Application.findOne({ user: user._id, listing: job._id });
    if (existing) throw new ApiError(409, 'You have already applied to this listing.');

    const override = job.eligibility_overrides.find(
      (result: any) => String(result.user) === String(user._id)
    );
    const eligibility =
      override ||
      job.eligibility_results.find((result: any) => String(result.user) === String(user._id)) ||
      evaluateEligibility(job, profile, user);
    const eligibilityReasons =
      'reason' in eligibility ? [eligibility.reason] : eligibility.reasons || [];

    if (!eligibility.eligible) {
      throw new ApiError(
        400,
        `You are not eligible for this listing: ${eligibilityReasons.join(' ')}`
      );
    }

    return Application.create({
      student: profile._id,
      user: user._id,
      listing: job._id,
      current_status: 'Applied',
      status_history: [{ status: 'Applied', updated_at: new Date() }],
      eligibility_snapshot: {
        eligible: true,
        reasons: [],
      },
    });
  }

  async myApplications(user: any) {
    return Application.find({ user: user._id })
      .populate('listing')
      .sort({ applied_at: -1 });
  }

  async getApplicants(jobId: string, user: any) {
    if (!Types.ObjectId.isValid(jobId)) throw new ApiError(400, 'Invalid job id');

    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');
    this.assertCanManageJob(user, job);

    return Application.find({ listing: job._id })
      .populate('user', '-password')
      .populate('student')
      .sort({ applied_at: -1 });
  }

  async updateApplicationStatus(
    jobId: string,
    applicationId: string,
    user: any,
    payload: { status: string; note?: string }
  ) {
    if (!Types.ObjectId.isValid(jobId) || !Types.ObjectId.isValid(applicationId)) {
      throw new ApiError(400, 'Invalid job or application id');
    }

    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');
    this.assertCanManageJob(user, job);

    const application = await Application.findOne({ _id: applicationId, listing: job._id });
    if (!application) throw new ApiError(404, 'Application not found');

    application.current_status = payload.status as any;
    application.status_history.push({
      status: payload.status as any,
      note: payload.note,
      updated_at: new Date(),
    });
    await application.save();

    return application.populate([
      { path: 'user', select: '-password' },
      { path: 'student' },
      { path: 'listing' },
    ]);
  }

  async overrideEligibility(
    jobId: string,
    user: any,
    payload: { userId: string; eligible: boolean; reason: string }
  ) {
    if (!Types.ObjectId.isValid(jobId) || !Types.ObjectId.isValid(payload.userId)) {
      throw new ApiError(400, 'Invalid job or student user id');
    }

    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');

    if (!user?.roles?.some((role: string) => MANAGER_ROLES.includes(role))) {
      throw new ApiError(403, 'Only admin/TPO users can override eligibility.');
    }

    const profile = await Student.findOne({ user: payload.userId });
    if (!profile) throw new ApiError(404, 'Student profile not found');

    const overrides = (job.eligibility_overrides || []).filter(
      (override: any) => String(override.user) !== String(payload.userId)
    );

    overrides.push({
      student: (profile as any)._id,
      user: (profile as any).user,
      eligible: payload.eligible,
      reason: payload.reason,
      overridden_by: user._id,
      overridden_at: new Date(),
    });

    job.eligibility_overrides = overrides as any;
    await job.save();
    return job;
  }
}
