export type EmailTemplateContext = {
  ['invite-user']: {
    firstName: string;
    invitationUrl: string;
  };

  ['reset-password']: {
    firstName: string;
    resetPasswordUrl: string;
  };

  ['verify-email']: {
    firstName: string;
    verificationUrl: string;
  };
};

export type EmailJobType = {
  [K in keyof EmailTemplateContext]: {
    email: string;
    templateName: K;
    context: EmailTemplateContext[K];
  };
}[keyof EmailTemplateContext];
