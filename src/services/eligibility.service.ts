import { IEligibilityCriteria, IJobListing } from '../models/jobListing.model';

function normalize(value?: string) {
  return (value || '').trim().toLowerCase();
}

function latestBacklogs(profile: any) {
  const records = [...(profile.academic_records || [])].sort(
    (a, b) => (b.semester || 0) - (a.semester || 0)
  );
  return records[0]?.backlog_count || 0;
}

function includesNormalized(values: unknown[] | undefined, value?: string) {
  if (!values || values.length === 0) return true;
  const target = normalize(value);
  return values.map((item) => normalize(String(item))).includes(target);
}

export function evaluateEligibility(job: IJobListing | any, profile: any, user: any) {
  const criteria = (job.eligibility || {}) as IEligibilityCriteria;
  const reasons: string[] = [];
  const userUniversity = user?.university;

  if (job.target_university !== 'Both' && userUniversity !== job.target_university) {
    reasons.push(`Target university is ${job.target_university}.`);
  }

  if (
    criteria.allowed_universities?.length &&
    !criteria.allowed_universities.includes(userUniversity)
  ) {
    reasons.push('University is not allowed for this listing.');
  }

  if (typeof criteria.min_cgpa === 'number') {
    const currentCgpa = profile.cgpa_current || 0;
    if (currentCgpa < criteria.min_cgpa) {
      reasons.push(`Minimum CGPA required is ${criteria.min_cgpa}.`);
    }
  }

  if (!includesNormalized(criteria.allowed_branches, user?.branch_department)) {
    reasons.push('Branch/department does not match the eligibility criteria.');
  }

  if (!includesNormalized(criteria.allowed_programmes, user?.programme)) {
    reasons.push('Programme does not match the eligibility criteria.');
  }

  if (
    criteria.allowed_batch_years?.length &&
    !criteria.allowed_batch_years.includes(Number(user?.batch_year))
  ) {
    reasons.push('Batch year does not match the eligibility criteria.');
  }

  const backlogs = latestBacklogs(profile);
  if (criteria.no_active_backlogs && backlogs > 0) {
    reasons.push('Active backlogs are not allowed.');
  }

  if (typeof criteria.max_backlogs === 'number' && backlogs > criteria.max_backlogs) {
    reasons.push(`Maximum allowed backlogs is ${criteria.max_backlogs}.`);
  }

  if (job.status !== 'Active') {
    reasons.push('Listing is not active.');
  }

  if (job.deadline && new Date(job.deadline) < new Date()) {
    reasons.push('Application deadline has passed.');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
