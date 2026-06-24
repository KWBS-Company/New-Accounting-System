import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailJobType } from './types/email.job.types';
import { MailService } from 'src/mail/mail.service';

//queue
@Processor('email-queue')
@Injectable()
export class QueueProcessor extends WorkerHost {
  constructor(
    private readonly emailService: MailService,
  ) {
    super();
  }

  //job
  async process(job: Job<EmailJobType>) {
    if (job.name === 'email-job') {
      const { email, templateName, context } = job.data;
      // check templateName and map and then send to recipient
      // if error, it will retry for 2 times
      if (templateName === 'reset-password') {
        await this.emailService.sendResetPasswordEmail(
          email,
          context.firstName,
          context.resetPasswordUrl,
        );
      } else if (templateName === 'verify-email') {
        await this.emailService.sendVerificationEmail(
          email,
          context.firstName,
          context.verificationUrl,
        );
      } else if (templateName === 'invite-user') {
        await this.emailService.sendInvitationUrl(
          email,
          context.firstName,
          context.invitationUrl,
        );
      }
    }
  }
}
