import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private fromHeader: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.getOrThrow<string>('mail.host');
    const port = this.configService.getOrThrow<number>('mail.port');
    const secure = this.configService.getOrThrow<boolean>('mail.secure');
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.pass');
    const fromName = this.configService.getOrThrow<string>('mail.fromName');
    const fromEmail = this.configService.getOrThrow<string>('mail.fromEmail');

    this.fromHeader = `"${fromName}" <${fromEmail}>`;

    if (!user || !pass) {
      this.logger.warn(
        'SMTP credentials are not configured. Using JSON transport (emails will only be logged, not sent).',
      );
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  async send(options: SendMailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromHeader,
        ...options,
      });
      this.logger.log(`Email sent to ${options.to} (id: ${info.messageId})`);
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${err.message}`,
      );
      throw err;
    }
  }

  async sendVerificationEmail(
    to: string,
    name: string,
    verificationUrl: string,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b21a8;">Welcome to Accounting System, ${name}!</h2>
        <p>Thanks for signing up. Please verify your email address to activate your account.</p>
        <p style="margin: 24px 0;">
          <a href="${verificationUrl}"
             style="background-color: #6b21a8; color: #fff; padding: 12px 24px;
                    border-radius: 6px; text-decoration: none; display: inline-block;">
            Verify Email
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          If the button doesn't work, copy this link: <br/>
          <a href="${verificationUrl}">${verificationUrl}</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
      </div>`;

    await this.send({
      to,
      subject: 'Verify your Accounting System email',
      html,
      text: `Hi ${name}, please verify your email: ${verificationUrl}`,
    });
  }

  async sendResetPasswordEmail(
    to: string,
    name: string,
    resetPasswordUrl: string,
  ): Promise<void> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6b21a8;">Welcome to Accounting System, ${name}!</h2>
        <p>Reset your password.</p>
        <p style="margin: 24px 0;">
          <a href="${resetPasswordUrl}"
             style="background-color: #6b21a8; color: #fff; padding: 12px 24px;
                    border-radius: 6px; text-decoration: none; display: inline-block;">
            ResetPassword
          </a>
        </p>
        <p style="color: #666; font-size: 13px;">
          If the button doesn't work, copy this link: <br/>
          <a href="${resetPasswordUrl}">${resetPasswordUrl}</a>
        </p>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
      </div>`;

    await this.send({
      to,
      subject: 'Reset your password',
      html,
      text: `Hi ${name}, please reset your email: ${resetPasswordUrl}`,
    });
  }
}
