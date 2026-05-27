# Phase 4 - Recruiter Onboarding

## Built

- Added third-party recruiter account requests.
- Added admin/TPO review actions: approve, reject, and request more information.
- Approved requests create recruiter users with the `recruiter` role.
- Recruiters can log in with their official email and use the existing job posting flow.
- Login now accepts either student AUID/roll number or email.
- User accounts now support `account_type` and optional student-only academic fields.

## Backend

- Public request endpoint:
  - `POST /api/recruiters/requests`
- Admin/TPO endpoints:
  - `GET /api/recruiters/requests?status=Pending`
  - `PATCH /api/recruiters/requests/:requestId`
- New persistence:
  - `RecruiterAccountRequest`
  - recruiter user creation through the existing `User` model

## Frontend

- Public recruiter request page:
  - `/recruiters/request`
- Admin/TPO review queue:
  - `/admin/recruiter-requests`
- Navbar links now expose recruiter request/review entry points based on login state and role.
- Recruiter/admin/TPO logins redirect to `/jobs` instead of the student profile page.

## Notes

- In development, the approval response includes a temporary recruiter password so the flow is testable without email delivery.
- Production should send approval credentials or password setup links by email instead of returning them in the API response.
- Internal poster onboarding is still a remaining admin workflow. The role exists and job posting permissions already support it, but there is no dedicated invite/approval UI yet.
