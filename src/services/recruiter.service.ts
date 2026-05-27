import { Types } from 'mongoose';
import { CONFIG } from '../config/environment';
import { RecruiterAccountRequest } from '../models/recruiterAccountRequest.model';
import { User } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { createRawToken } from '../utils/tokens';

type RecruiterRequestPayload = {
  company_name: string;
  cin_registration_number: string;
  contact_person: string;
  designation: string;
  official_email: string;
  phone: string;
  website?: string;
  company_brief: string;
};

type RecruiterReviewPayload = {
  action: 'approve' | 'reject' | 'request_info';
  decision_note?: string;
};

const ADMIN_ROLES = ['admin', 'tpo'];

export class RecruiterService {
  private assertCanReview(user: any) {
    if (!user?.roles?.some((role: string) => ADMIN_ROLES.includes(role))) {
      throw new ApiError(403, 'Only admin/TPO users can review recruiter requests.');
    }
  }

  private splitContactName(contactPerson: string) {
    const parts = contactPerson.trim().split(/\s+/);
    return {
      firstName: parts[0] || contactPerson,
      lastName: parts.slice(1).join(' '),
    };
  }

  async createRequest(payload: RecruiterRequestPayload) {
    const officialEmail = payload.official_email.trim().toLowerCase();

    const existingRecruiter = await User.findOne({
      email: officialEmail,
      roles: 'recruiter',
    });
    if (existingRecruiter) {
      throw new ApiError(409, 'A recruiter account already exists for this official email.');
    }

    const activeRequest = await RecruiterAccountRequest.findOne({
      official_email: officialEmail,
      status: { $in: ['Pending', 'MoreInfoRequested'] },
    }).sort({ createdAt: -1 });

    if (activeRequest?.status === 'Pending') {
      throw new ApiError(409, 'A recruiter request is already pending for this official email.');
    }

    if (activeRequest?.status === 'MoreInfoRequested') {
      activeRequest.set({
        ...payload,
        official_email: officialEmail,
        status: 'Pending',
        decision_note: undefined,
        reviewed_by: undefined,
        reviewed_at: undefined,
      });
      return activeRequest.save();
    }

    return RecruiterAccountRequest.create({
      ...payload,
      official_email: officialEmail,
      status: 'Pending',
    });
  }

  async listRequests(user: any, query: { status?: string }) {
    this.assertCanReview(user);

    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;

    return RecruiterAccountRequest.find(filter)
      .populate('reviewed_by', 'firstName lastName email roles')
      .populate('approved_user', 'firstName lastName email roles company_name')
      .sort({ createdAt: -1 });
  }

  async reviewRequest(requestId: string, reviewer: any, payload: RecruiterReviewPayload) {
    this.assertCanReview(reviewer);
    if (!Types.ObjectId.isValid(requestId)) throw new ApiError(400, 'Invalid recruiter request id.');

    const request = await RecruiterAccountRequest.findById(requestId);
    if (!request) throw new ApiError(404, 'Recruiter request not found.');

    if (request.status === 'Approved' && payload.action === 'approve') {
      throw new ApiError(409, 'This recruiter request is already approved.');
    }

    request.decision_note = payload.decision_note;
    request.reviewed_by = reviewer._id;
    request.reviewed_at = new Date();

    if (payload.action === 'reject') {
      request.status = 'Rejected';
      await request.save();
      return { request };
    }

    if (payload.action === 'request_info') {
      request.status = 'MoreInfoRequested';
      await request.save();
      return { request };
    }

    const { firstName, lastName } = this.splitContactName(request.contact_person);
    const temporaryPassword = `Rec-${createRawToken().slice(0, 12)}`;

    const existingUser = await User.findOne({ email: request.official_email });
    if (existingUser && !existingUser.roles.includes('recruiter')) {
      throw new ApiError(409, 'A non-recruiter account already uses this official email.');
    }

    const recruiterUser =
      existingUser ||
      (await User.create({
        password: temporaryPassword,
        firstName,
        lastName,
        email: request.official_email,
        phone: request.phone,
        account_type: 'recruiter',
        company_name: request.company_name,
        roles: ['recruiter'],
        verified: true,
        email_verified: true,
      }));

    if (existingUser) {
      existingUser.firstName = firstName;
      existingUser.lastName = lastName;
      existingUser.phone = request.phone;
      existingUser.account_type = 'recruiter';
      existingUser.company_name = request.company_name;
      existingUser.email_verified = true;
      existingUser.password = temporaryPassword;
      await existingUser.save();
    }

    request.status = 'Approved';
    request.approved_user = recruiterUser._id as Types.ObjectId;
    await request.save();

    return {
      request,
      recruiter_user: {
        _id: recruiterUser._id,
        email: recruiterUser.email,
        firstName: recruiterUser.firstName,
        lastName: recruiterUser.lastName,
        company_name: recruiterUser.company_name,
        roles: recruiterUser.roles,
      },
      login_identifier: recruiterUser.email,
      ...(CONFIG.env === 'production' ? {} : { temporary_password: temporaryPassword }),
    };
  }
}
