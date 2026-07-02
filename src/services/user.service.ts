import { User } from '../models/user.model';
import { Student } from '../models/student.model';
import { Recruiter } from '../models/recruiter.model';
import { ApiError } from '../utils/ApiError';
import { escapeRegex } from '../utils/escapeRegex';

type Role = 'student' | 'admin';

interface CreateUserInput {
  auid: string;
  password: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  university: 'Akal University' | 'Eternal University';
  roles?: Role[];
}

type UpdateUserInput = Partial<Omit<CreateUserInput, 'auid'>>;

function sanitize(user: any) {
  return {
    _id: user._id,
    auid: user.auid,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    university: user.university,
    roles: user.roles,
    verified: user.verified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class UserService {
  async createUser(data: CreateUserInput) {
    const existing = await User.findOne({ auid: data.auid });
    if (existing) throw new ApiError(409, 'User with this AUID already exists.');

    const user = await User.create({
      auid: data.auid,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      university: data.university,
      roles: data.roles && data.roles.length ? data.roles : ['student'],
    });

    return sanitize(user);
  }

  async listUsers(page: number, limit: number, skip: number, search?: string) {
    const filter: Record<string, any> = {};

    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ auid: rx }, { firstName: rx }, { lastName: rx }, { email: rx }];
    }

    const [users, total] = await Promise.all([
      User.find(filter).select('-password -__v').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);

    return {
      users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUserById(userId: string) {
    const user = await User.findById(userId).select('-password -__v');
    if (!user) throw new ApiError(404, 'User not found.');
    return user;
  }

  /** Lightweight search for @mention pickers — active users, name/email match. */
  async searchForMention(q: string, limit = 8) {
    if (!q || !q.trim()) return [];
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    return User.find({ status: 'active', $or: [{ firstName: rx }, { lastName: rx }, { email: rx }] })
      .select('firstName lastName roles')
      .limit(limit);
  }

  async updateUser(userId: string, data: UpdateUserInput) {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found.');

    if (data.firstName !== undefined) user.firstName = data.firstName;
    if (data.lastName !== undefined) user.lastName = data.lastName;
    if (data.email !== undefined) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    if (data.university !== undefined) user.university = data.university;
    if (data.roles !== undefined && data.roles.length) user.roles = data.roles;
    if (data.password !== undefined) user.password = data.password; // re-hashed by pre-save hook

    await user.save();
    return sanitize(user);
  }

  async deleteUser(userId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new ApiError(400, 'You cannot delete your own account.');
    }

    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, 'User not found.');

    // Remove any linked role profile so we don't leave orphans.
    await Promise.all([
      Student.deleteOne({ user: userId }),
      Recruiter.deleteOne({ user: userId }),
    ]);
    await user.deleteOne();

    return { _id: userId };
  }
}
