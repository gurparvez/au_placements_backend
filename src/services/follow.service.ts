import { Follow } from '../models/follow.model';
import { User } from '../models/user.model';
import { Recruiter } from '../models/recruiter.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { notificationService } from './notification.service';

export class FollowService {
  private async ensureRecruiter(companyUserId: string) {
    const user = await User.findById(companyUserId);
    if (!user || !user.roles.includes('recruiter')) throw new ApiError(404, 'Company not found.');
    return user;
  }

  async follow(meId: string, companyUserId: string) {
    if (String(meId) === String(companyUserId)) throw new ApiError(400, 'You cannot follow yourself.');
    await this.ensureRecruiter(companyUserId);

    const existing = await Follow.findOne({ follower: meId, company: companyUserId });
    if (!existing) {
      await Follow.create({ follower: meId, company: companyUserId });
      await notificationService.create({
        recipient: companyUserId,
        actor: meId,
        type: 'follow',
        entity: { kind: 'user', id: meId },
        text: 'started following your company',
      });
    }
    const followers = await Follow.countDocuments({ company: companyUserId });
    return { following: true, followers };
  }

  async unfollow(meId: string, companyUserId: string) {
    await Follow.deleteOne({ follower: meId, company: companyUserId });
    const followers = await Follow.countDocuments({ company: companyUserId });
    return { following: false, followers };
  }

  async listFollowing(meId: string) {
    const follows = await Follow.find({ follower: meId }).select('company');
    const companyIds = follows.map((f) => f.company);
    const recruiters = await Recruiter.find({ user: { $in: companyIds } }).populate('user', 'firstName lastName');
    return recruiters.map((r: any) => ({
      companyUserId: r.user._id,
      company: r.company,
      industry: r.industry,
      location: r.location,
      logo: r.company_logo,
      is_following: true,
    }));
  }

  /** Single company profile (public; personalized is_following when logged in). */
  async getCompany(viewerId: string | undefined, companyUserId: string) {
    const user = await User.findById(companyUserId).select('_id firstName lastName roles');
    if (!user || !user.roles.includes('recruiter')) throw new ApiError(404, 'Company not found.');
    const r: any = await Recruiter.findOne({ user: companyUserId });
    if (!r) throw new ApiError(404, 'Company not found.');

    const [followers, mine] = await Promise.all([
      Follow.countDocuments({ company: companyUserId }),
      viewerId ? Follow.findOne({ follower: viewerId, company: companyUserId }) : Promise.resolve(null),
    ]);

    return {
      companyUserId: user._id,
      company: r.company,
      industry: r.industry,
      location: r.location,
      logo: r.company_logo,
      website: r.company_website,
      company_size: r.company_size,
      designation: r.designation,
      linkedin_url: r.linkedin_url,
      about: r.about,
      contact: `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim() || undefined,
      followers,
      is_following: !!mine,
    };
  }

  /** Public directory of companies (recruiter profiles for active recruiters). */
  async listCompanies(viewerId: string | undefined, page: number, limit: number, skip: number, q?: string) {
    const userFilter: Record<string, any> = { roles: 'recruiter', status: 'active' };

    if (q && q.trim()) {
      const rx = new RegExp(escapeRegex(q.trim()), 'i');
      const matched = await Recruiter.find({ company: rx }).select('user');
      userFilter._id = { $in: matched.map((m) => m.user) };
    }

    const [users, total] = await Promise.all([
      User.find(userFilter).select('_id firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(userFilter),
    ]);
    const userIds = users.map((u) => u._id);

    const [recruiters, followAgg, myFollows] = await Promise.all([
      Recruiter.find({ user: { $in: userIds } }),
      Follow.aggregate([{ $match: { company: { $in: userIds } } }, { $group: { _id: '$company', count: { $sum: 1 } } }]),
      viewerId ? Follow.find({ follower: viewerId, company: { $in: userIds } }).select('company') : Promise.resolve([]),
    ]);

    const byUser = new Map(recruiters.map((r: any) => [String(r.user), r]));
    const counts = new Map(followAgg.map((f: any) => [String(f._id), f.count]));
    const following = new Set((myFollows as any[]).map((f) => String(f.company)));

    const data = users
      .map((u: any) => {
        const r = byUser.get(String(u._id));
        if (!r) return null;
        return {
          companyUserId: u._id,
          company: r.company,
          industry: r.industry,
          location: r.location,
          logo: r.company_logo,
          followers: counts.get(String(u._id)) || 0,
          is_following: following.has(String(u._id)),
        };
      })
      .filter(Boolean);

    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
