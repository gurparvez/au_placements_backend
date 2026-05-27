import { Types } from 'mongoose';
import { Application } from '../models/application.model';
import { JobListing } from '../models/jobListing.model';
import { Student } from '../models/student.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { evaluateEligibility } from './eligibility.service';

const POSTER_ROLES = ['admin', 'internal_poster', 'recruiter', 'tpo'];

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
    const eligibility = userId
      ? job.eligibility_results?.find((result: any) => String(result.user) === String(userId))
      : undefined;
    const application = applicationsByListing?.get(listingId);

    return {
      ...job,
      my_eligibility: eligibility
        ? { eligible: eligibility.eligible, reasons: eligibility.reasons }
        : undefined,
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

  async recomputeEligibility(jobId: string) {
    const job = await JobListing.findById(jobId);
    if (!job) throw new ApiError(404, 'Job listing not found');
    return this.computeEligibility(job);
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

    const eligibility =
      job.eligibility_results.find((result: any) => String(result.user) === String(user._id)) ||
      evaluateEligibility(job, profile, user);

    if (!eligibility.eligible) {
      throw new ApiError(
        400,
        `You are not eligible for this listing: ${(eligibility.reasons || []).join(' ')}`
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
}
