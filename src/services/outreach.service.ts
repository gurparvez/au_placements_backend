import { User } from '../models/user.model';
import { Recruiter } from '../models/recruiter.model';
import { Outreach } from '../models/outreach.model';
import { ApiError } from '../utils/ApiError';
import { sendEmail } from '../utils/email';

export class OutreachService {
  /**
   * A logged-in, active recruiter emails a student through the platform.
   * The email is sent server-side (Resend); the student can reply directly to
   * the recruiter (reply-to = recruiter email). Every attempt is logged.
   */
  async emailStudent(recruiterUserId: string, studentId: string, subject: string, body: string) {
    const [recruiterUser, recruiterProfile, student] = await Promise.all([
      User.findById(recruiterUserId),
      Recruiter.findOne({ user: recruiterUserId }),
      User.findById(studentId),
    ]);

    if (!recruiterUser) throw new ApiError(401, 'Recruiter not found.');
    if (!student || !student.roles.includes('student')) {
      throw new ApiError(404, 'Student not found.');
    }
    if (!student.email) {
      throw new ApiError(400, 'This student has no email on file, so they cannot be contacted.');
    }

    const recruiterName =
      `${recruiterUser.firstName ?? ''} ${recruiterUser.lastName ?? ''}`.trim() || 'A recruiter';
    const company = recruiterProfile?.company ? ` (${recruiterProfile.company})` : '';

    const html = `
      <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#111">
        <p>${escapeHtml(body).replace(/\n/g, '<br/>')}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p style="font-size:13px;color:#666">
          Sent by <strong>${escapeHtml(recruiterName)}</strong>${escapeHtml(company)}
          via Kalgidhar Placements. Reply to this email to respond directly.
        </p>
      </div>`;

    const result = await sendEmail({
      to: student.email,
      subject,
      text: body,
      html,
      replyTo: recruiterUser.email || undefined,
    });

    await Outreach.create({
      recruiter: recruiterUser._id,
      student: student._id,
      subject,
      body,
      status: result.delivered ? 'sent' : 'failed',
      error: result.error,
    });

    if (!result.delivered) {
      throw new ApiError(
        result.error === 'Email service not configured' ? 503 : 502,
        result.error === 'Email service not configured'
          ? 'Email service is not configured yet. Please try again later.'
          : 'Could not send the email. Please try again.'
      );
    }

    return { delivered: true, to: student.email };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
