import { Follow } from '../models/follow.model';
import { User } from '../models/user.model';
import { Recruiter } from '../models/recruiter.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';
import { notificationService } from './notification.service';
import { cached, bumpVersion } from '../utils/cache';
import { CONFIG } from '../config/environment';

const COMPANIES_NS = 'companies';

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
    await bumpVersion(COMPANIES_NS); // follower count + is_following changed
    return { following: true, followers };
  }

  async unfollow(meId: string, companyUserId: string) {
    await Follow.deleteOne({ follower: meId, company: companyUserId });
    const followers = await Follow.countDocuments({ company: companyUserId });
    await bumpVersion(COMPANIES_NS);
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
    // Shared profile + follower count cached once for everyone…
    const shared = await cached(COMPANIES_NS, ['one', companyUserId], CONFIG.cache.defaultTtl, () =>
      this._getCompanyShared(companyUserId)
    );
    // …is_following is a cheap per-viewer overlay, never cached.
    const is_following = viewerId ? !!(await Follow.findOne({ follower: viewerId, company: companyUserId }).lean()) : false;
    return { ...shared, is_following };
  }

  private async _getCompanyShared(companyUserId: string) {
    const user = await User.findById(companyUserId).select('_id firstName lastName roles').lean();
    if (!user || !user.roles.includes('recruiter')) throw new ApiError(404, 'Company not found.');
    const r: any = await Recruiter.findOne({ user: companyUserId }).lean();
    if (!r) throw new ApiError(404, 'Company not found.');

    const followers = await Follow.countDocuments({ company: companyUserId });

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
    };
  }

  /** Public directory of companies (recruiter profiles for active recruiters). */
  async listCompanies(viewerId: string | undefined, page: number, limit: number, skip: number, q?: string) {
    // Shared directory (company data + follower counts) cached once for all viewers.
    const shared = await cached(COMPANIES_NS, ['list', page, limit, q?.trim().toLowerCase()], CONFIG.cache.defaultTtl, async () => {
      const userFilter: Record<string, any> = { roles: 'recruiter', status: 'active' };

      if (q && q.trim()) {
        const rx = new RegExp(escapeRegex(q.trim()), 'i');
        const matched = await Recruiter.find({ company: rx }).select('user').lean();
        userFilter._id = { $in: matched.map((m) => m.user) };
      }

      const [users, total] = await Promise.all([
        User.find(userFilter).select('_id firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        User.countDocuments(userFilter),
      ]);
      const userIds = users.map((u) => u._id);

      const [recruiters, followAgg] = await Promise.all([
        Recruiter.find({ user: { $in: userIds } }).lean(),
        Follow.aggregate([{ $match: { company: { $in: userIds } } }, { $group: { _id: '$company', count: { $sum: 1 } } }]),
      ]);

      const byUser = new Map(recruiters.map((r: any) => [String(r.user), r]));
      const counts = new Map(followAgg.map((f: any) => [String(f._id), f.count]));

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
          };
        })
        .filter(Boolean);

      return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });

    // Per-viewer is_following overlay — a single indexed query, never cached.
    const data = await this.applyIsFollowing(shared.data as any[], viewerId);
    return { data, pagination: shared.pagination };
  }

  private async applyIsFollowing(companies: any[], viewerId?: string) {
    if (!viewerId || !companies.length) return companies.map((c) => ({ ...c, is_following: false }));
    const ids = companies.map((c) => c.companyUserId);
    const mine = await Follow.find({ follower: viewerId, company: { $in: ids } }).select('company').lean();
    const following = new Set(mine.map((f: any) => String(f.company)));
    return companies.map((c) => ({ ...c, is_following: following.has(String(c.companyUserId)) }));
  }
}
