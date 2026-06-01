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
      const { to, name, verificationLink } = job.data;
      // check templateName and map and then send to recipient
      // if error, it will retry for 2 times
      await this.emailService.sendVerificationEmail(
        to,
        name,
        verificationLink,
      );
    }
  }
}
