import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EmailTemplateContext } from './types/email.job.types';

@Injectable()
export class QueueService {
    private readonly logger = new Logger(QueueService.name);
    constructor(
        @InjectQueue('email-queue')
        private readonly queueService: Queue,
    ) {}

    // NOW THIS CAN BE CALLED FROM ANYWHERE IN THE APP
    async addEmailToQueue(
        email: string,
        templateName: string,
        context: EmailTemplateContext[
            | 'invite-user'
            | 'reset-password'
            | 'verify-email'],
    ) {
        this.logger.log(`Adding email-job to email-queue`);
        await this.queueService.add(
            'email-job',
            {
                email,
                templateName,
                context,
            },
            {
                attempts: 3, // 2 retry
                // delay: 90000,
                backoff: {
                    type: 'exponential',
                    delay: 30000,
                },
                removeOnComplete: true,
                removeOnFail: false,
            },
        );
        return { message: 'process started in email-queue' };
    }
}
