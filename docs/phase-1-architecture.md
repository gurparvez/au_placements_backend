# Phase 1 Architecture Alignment

Date: 24 May 2026

## Decisions

- The backend is the system of record and lives in `../au_placements_backend`.
- Uploaded files are stored on the backend server under `MEDIA_ROOT`, defaulting to `media/`.
- Public file URLs are served from `MEDIA_URL_PATH`, defaulting to `/media`.
- The frontend defaults to `http://localhost:8000` for local/on-prem development.
- Cloudinary and Gemini are removed from the active backend path.
- ID-card verification now uses a local Python OCR script at `scripts/ocr_id_card.py`.
- AU/EU partitioning should protect admin and write workflows, but student/profile browsing remains open and filterable by university.

## Local Media Storage

Profile images and resumes are saved by the backend using `src/utils/mediaStorage.ts`.

Environment variables:

- `PUBLIC_BASE_URL`: base URL used when returning media links, for example `http://localhost:8000`.
- `MEDIA_ROOT`: local folder where files are written, default `media`.
- `MEDIA_URL_PATH`: URL prefix used to serve files, default `/media`.

The backend serves media statically with Express. In production/on-prem deployment, point `PUBLIC_BASE_URL` to the internal server hostname and keep `MEDIA_ROOT` on a backed-up disk.

## Local Python OCR

The registration flow calls `verifyIdCard`, which invokes:

```bash
python scripts/ocr_id_card.py
```

Python dependencies needed on the backend server:

```bash
pip install Pillow pytesseract
```

The server also needs the Tesseract OCR binary installed and available on `PATH`.

Verification mode is controlled by `ID_CARD_VERIFICATION_MODE`:

- `strict`: fail registration if OCR cannot verify the ID card.
- `review`: allow registration when OCR is unavailable so admins can manually review later.
- `disabled`: bypass OCR for local development only.

## AU/EU Partitioning Policy

Phase 1 keeps browsing intentionally permissive:

- `GET /api/student/all` remains public.
- `GET /api/student/profile` remains public.
- University is included on student records so UI can filter AU/EU students.

For future admin, recruiter, job, application, and reporting modules:

- Write operations must use authenticated user context.
- Admin/TPO views should scope by `user.university` unless the role is explicitly cross-university.
- Public job/student discovery can show both universities, with filters and target-university metadata.
- Sensitive contact details should be limited once recruiter roles and student consent are implemented.

