import nodemailer from 'nodemailer';

// ─── Email Service Abstraction ──────────────────────────────────────────────
// Single abstraction for all outgoing email — swap provider by changing transporter

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

class EmailService {
  private transporter!: nodemailer.Transporter;
  private from = 'AlumniConnect <noreply@alumniconnect.dev>';
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    // Auto-create Ethereal test account for development
    const testAccount = await nodemailer.createTestAccount();
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log('[Email] Ethereal test account:', testAccount.user);
    this.initialized = true;
  }

  async send(payload: EmailPayload): Promise<void> {
    await this.init();
    const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
    const info = await this.transporter.sendMail({
      from: this.from,
      to: recipients,
      subject: payload.subject,
      html: payload.html,
    });
    console.log(`[Email] Sent to ${recipients}: ${payload.subject}`);
    console.log(`[Email] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
  }

  async sendConnectionConfirmation(studentEmail: string, alumniEmail: string, studentName: string, alumniName: string): Promise<void> {
    await Promise.all([
      this.send({
        to: studentEmail,
        subject: ` You're connected with ${alumniName}!`,
        html: `<h2>Mentorship Connection Confirmed</h2><p>Hi ${studentName}, your mentorship request has been accepted by <strong>${alumniName}</strong>. You can now chat and schedule sessions on AlumniConnect!</p>`,
      }),
      this.send({
        to: alumniEmail,
        subject: `New mentee connected: ${studentName}`,
        html: `<h2>Mentorship Connection Confirmed</h2><p>Hi ${alumniName}, you've accepted a mentorship request from <strong>${studentName}</strong>. Start a conversation on AlumniConnect!</p>`,
      }),
    ]);
  }

  async sendSessionReminder(toEmail: string, toName: string, sessionStart: Date, meetingLink: string): Promise<void> {
    const timeStr = sessionStart.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    await this.send({
      to: toEmail,
      subject: ` Session Reminder: ${timeStr}`,
      html: `<h2>Upcoming Session Reminder</h2><p>Hi ${toName}, your session is scheduled for <strong>${timeStr} IST</strong>.</p><p><a href="${meetingLink}">Join Meeting</a></p>`,
    });
  }

  async sendDigest(toEmail: string, toName: string, items: { type: string; summary: string }[]): Promise<void> {
    const itemsHtml = items.map(i => `<li><strong>${i.type}</strong>: ${i.summary}</li>`).join('');
    await this.send({
      to: toEmail,
      subject: ` Your AlumniConnect Digest`,
      html: `<h2>Your Activity Digest</h2><p>Hi ${toName}, here's what you missed:</p><ul>${itemsHtml}</ul>`,
    });
  }

  async sendReEngagementNudge(toEmail: string, toName: string, partnerName: string): Promise<void> {
    await this.send({
      to: toEmail,
      subject: ` Don't lose your momentum with ${partnerName}`,
      html: `<h2>Time to reconnect!</h2><p>Hi ${toName}, it looks like your mentorship connection with <strong>${partnerName}</strong> has been quiet recently. Log in to AlumniConnect to send a message or schedule a session!</p>`,
    });
  }
}

export const emailService = new EmailService();
