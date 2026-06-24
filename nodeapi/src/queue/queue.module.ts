import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QueueProcessor } from './queue.processor';
import { QueueService } from './queue.service';
import { MailModule } from 'src/mail/mail.module';

@Module({
    imports: [BullModule.registerQueue({ name: 'email-queue' }), MailModule],
    providers: [QueueProcessor, QueueService],
    exports: [QueueService],
})
export class QueueModule {}
