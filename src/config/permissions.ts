import { Role } from '../models/user.model';

/**
 * Module/permission-based access control. Routes are guarded by a permission
 * string (e.g. 'opening:create') via requirePermission(), rather than raw role
 * checks — so adding roles/modules later doesn't mean touching every route.
 */
export type Permission =
  | 'post:create'
  | 'post:react'
  | 'post:comment'
  | 'post:share'
  | 'message:send'
  | 'notification:read:own'
  | 'profile:write:own'
  | 'opening:read'
  | 'opening:create'
  | 'opening:update:own'
  | 'outreach:send'
  | 'connection:manage'
  | 'follow:manage'
  | 'user:manage'
  | 'recruiter:approve'
  | 'moderate';

const ROLE_PERMISSIONS: Record<Role, Permission[] | ['*']> = {
  student: [
    'post:create',
    'post:react',
    'post:comment',
    'post:share',
    'message:send',
    'notification:read:own',
    'profile:write:own',
    'opening:read',
    'connection:manage',
    'follow:manage',
  ],
  recruiter: [
    'post:create',
    'post:react',
    'post:comment',
    'post:share',
    'message:send',
    'notification:read:own',
    'outreach:send',
    'opening:create',
    'opening:update:own',
    'opening:read',
    'connection:manage',
    'follow:manage',
  ],
  admin: ['*'],
};

interface PermissionUser {
  roles?: Role[];
  status?: string;
}

/**
 * True only if the user is active AND one of their roles grants the permission.
 * A non-active user (pending/suspended/rejected) is denied everything.
 */
export function hasPermission(user: PermissionUser | undefined | null, perm: Permission): boolean {
  if (!user) return false;
  if (user.status && user.status !== 'active') return false;

  for (const role of user.roles ?? []) {
    const perms = ROLE_PERMISSIONS[role];
    if (!perms) continue;
    if (perms[0] === '*') return true;
    if ((perms as Permission[]).includes(perm)) return true;
  }
  return false;
}
