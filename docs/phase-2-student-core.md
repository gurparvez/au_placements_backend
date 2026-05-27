# Phase 2 Student Core

Date: 25 May 2026

## Implemented

- Registration now captures the SRS-required student metadata:
  - Programme
  - Branch/Department
  - Batch Year
- Registration and account email updates enforce official university email domains.
- Official domains are configurable:
  - `AU_EMAIL_DOMAINS`
  - `EU_EMAIL_DOMAINS`
- Student profiles now support:
  - Semester-wise academic records
  - Current CGPA derived from latest semester CGPA
  - Additional professional/social links
  - Achievements
  - Extra-curricular activities
  - Supporting document uploads
  - Profile completion percentage
  - Profile version increment on updates
- Email verification tokens are generated at registration and enforced before login.
- Password recovery endpoints support forgot/reset flows with hashed reset tokens.
- Student profile updates create immutable profile-history snapshots before changes are applied.
- Students can mark their profile as reviewed for the semester cycle.
- Supporting documents are saved through the local media storage path introduced in Phase 1.

## Still Needed

- Real email delivery for verification and password reset links.
- Profile review reminder scheduling at semester start.
- Admin view for manually reviewing registrations when OCR runs in review mode.
- Admin/TPO profile-history viewing tools.

## Notes

Student and public profile browsing remains permissive. AU/EU partitioning should be enforced for admin writes, reports, private recruiter access, and approval workflows rather than general student discovery.
