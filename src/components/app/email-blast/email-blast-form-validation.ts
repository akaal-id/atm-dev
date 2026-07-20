export type EmailBlastFormValues = {
  subject: string;
  body: string;
  recipientCount: number;
};

export type EmailBlastFormErrors = {
  subject?: string;
  body?: string;
  recipients?: string;
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

  return errors;
}

export function isEmailBlastFormValid(values: EmailBlastFormValues) {
  return Object.keys(validateEmailBlastForm(values)).length === 0;
}
