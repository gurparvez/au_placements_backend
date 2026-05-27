# Phase 3 Jobs, Eligibility, And Applications

Date: 26 May 2026

## Implemented

- Job listing model with:
  - Company, title, role, description, type, CTC/stipend, location, deadline, status.
  - Target university: `Akal University`, `Eternal University`, or `Both`.
  - Eligibility criteria for CGPA, branch, programme, batch year, university, and backlogs.
- Eligibility engine:
  - Computes eligibility for all student profiles when a listing is created.
  - Stores per-student eligibility results on the listing.
  - Returns personalized eligibility for logged-in students.
  - Explains ineligibility reasons.
- Application model:
  - One application per student per listing.
  - Stores application status and eligibility snapshot.
- Student-facing API routes:
  - `GET /api/jobs`
  - `GET /api/jobs/:jobId`
  - `POST /api/jobs/:jobId/apply`
  - `GET /api/jobs/applications/me`
- Poster/admin routes:
  - `POST /api/jobs`
  - `PATCH /api/jobs/:jobId`
  - `GET /api/jobs/:jobId/applications`
  - `PATCH /api/jobs/:jobId/applications/:applicationId`
  - `POST /api/jobs/:jobId/recompute-eligibility`
  - `POST /api/jobs/:jobId/eligibility-overrides`
- Job managers can update application statuses across the placement workflow.
- Admin/TPO users can manually override eligibility with a mandatory reason.
- Student profile creation/update recomputes that student's eligibility across active listings.

## Frontend Support

- `/jobs` page for opportunity discovery.
- `/jobs/new` page for authorized users to post opportunities.
- `/applications` page for students to track submitted applications.
- `/jobs/:jobId/applications` page for authorized job managers to review applicants and update status.
- Search and filters for type and university.
- Eligibility/Not Eligible badge for logged-in students.
- Ineligibility reason display.
- One-click apply when eligible.
- Applied status shown after submission.

## Access Policy

- Public users can browse active job listings.
- Logged-in students get personalized eligibility and can apply only when eligible.
- Job creation is limited to users with one of these roles:
  - `admin`
  - `tpo`
  - `internal_poster`
  - `recruiter`
- Job/applicant management is available to the job poster, `admin`, or `tpo`.
- Eligibility override is limited to `admin` and `tpo`.

## Still Needed

- Recruiter account request/approval workflow.
- Admin-configurable third-party job approval gate.
- Detailed interview scheduling screens with venues, panels, and time slots.
- Dedicated UI for eligibility overrides.
- Notifications for eligible jobs and submitted applications.
