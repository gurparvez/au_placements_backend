import { CONFIG } from '../config/environment';

export type SupportedUniversity = 'Akal University' | 'Eternal University';

export const SUPPORTED_UNIVERSITIES: SupportedUniversity[] = [
  'Akal University',
  'Eternal University',
];

export function isSupportedUniversity(value: string): value is SupportedUniversity {
  return SUPPORTED_UNIVERSITIES.includes(value as SupportedUniversity);
}

export function isOfficialUniversityEmail(email: string, university: string) {
  if (!isSupportedUniversity(university)) return false;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;

  const allowedDomains = CONFIG.universityEmailDomains[university];
  return allowedDomains.includes(domain);
}

export function officialEmailDomainsFor(university: string) {
  if (!isSupportedUniversity(university)) return [];
  return CONFIG.universityEmailDomains[university];
}
