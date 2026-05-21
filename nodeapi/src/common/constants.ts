export const QUEUE_NAMES = {
  NOTIFICATION: 'notification',
  BULK_APPOINTMENT: 'bulk-appointment',
} as const;

export const JOB_NAMES = {
  SEND_EMAIL: 'send-email',
  SEND_VERIFICATION: 'send-verification',
  PROCESS_BULK: 'process-bulk',
  CONFIRM_APPOINTMENT: 'confirm-appointment',
} as const;

export const SOCKET_EVENTS = {
  NOTIFICATION_PROGRESS: 'notification:progress',
  NOTIFICATION_COMPLETED: 'notification:completed',
  NOTIFICATION_FAILED: 'notification:failed',
  BULK_PROGRESS: 'bulk:progress',
  BULK_COMPLETED: 'bulk:completed',
  APPOINTMENT_CREATED: 'appointment:created',
  APPOINTMENT_UPDATED: 'appointment:updated',
} as const;

export const TIME_SLOT_INTERVAL_MINUTES = 30;
