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
  - `POST /api/jobs/:jobId/recompute-eligibility`

## Frontend Support

- `/jobs` page for opportunity discovery.
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

## Still Needed

- Full job posting UI for admins, TPOs, internal posters, and recruiters.
- Recruiter account request/approval workflow.
- Admin-configurable third-party job approval gate.
- Interview scheduling and status update screens.
- Eligibility recomputation trigger when a student updates profile data.
- Manual admin/TPO eligibility override with reason.
- Notifications for eligible jobs and submitted applications.

