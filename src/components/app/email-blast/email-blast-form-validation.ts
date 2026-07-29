export const MAX_ATTACHMENT_TOTAL_BYTES = 30 * 1024 * 1024;

export type EmailBlastFormValues = {
  subject: string;
  body: string;
  recipientCount: number;
  attachmentTotalBytes: number;
};

export type EmailBlastFormErrors = {
  subject?: string;
  body?: string;
  recipients?: string;
  attachments?: string;
};

export function validateEmailBlastForm(values: EmailBlastFormValues): EmailBlastFormErrors {
  const errors: EmailBlastFormErrors = {};

  if (!values.subject.trim()) {
    errors.subject = "Subjek wajib diisi.";
  }

  if (!values.body.trim()) {
    errors.body = "Isi email wajib diisi.";
  }

  if (values.recipientCount < 1) {
    errors.recipients = "Tambahkan minimal satu penerima.";
  }

  if (values.attachmentTotalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
    errors.attachments = `Total lampiran maksimal ${Math.round(MAX_ATTACHMENT_TOTAL_BYTES / 1024 / 1024)}MB.`;
  }

  return errors;
}

export function isEmailBlastFormValid(values: EmailBlastFormValues) {
  return Object.keys(validateEmailBlastForm(values)).length === 0;
}
