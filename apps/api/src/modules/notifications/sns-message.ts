import { createVerify, X509Certificate } from 'node:crypto';

/** An Amazon SNS message as POSTed to an HTTPS subscription. */
export type SnsMessage = {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Subject?: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: '1' | '2';
  Signature: string;
  SigningCertURL: string;
  SubscribeURL?: string;
  Token?: string;
};

/** Only certificates served by SNS itself, over HTTPS, are trusted. */
export function isSnsUrl(value: string | undefined, path?: RegExp): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname) &&
      (!path || path.test(url.pathname))
    );
  } catch {
    return false;
  }
}

/** The exact text SNS signed (documented field order, one "Name\nValue\n" pair per field). */
export function stringToSign(message: SnsMessage): string {
  const fields =
    message.Type === 'Notification'
      ? ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type']
      : ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'];
  return fields
    .filter((field) => message[field as keyof SnsMessage] !== undefined)
    .map((field) => `${field}\n${message[field as keyof SnsMessage]}\n`)
    .join('');
}

export function parseSnsMessage(body: unknown): SnsMessage | null {
  if (typeof body !== 'object' || body === null) return null;
  const m = body as Partial<SnsMessage>;
  const ok =
    (m.Type === 'Notification' ||
      m.Type === 'SubscriptionConfirmation' ||
      m.Type === 'UnsubscribeConfirmation') &&
    typeof m.MessageId === 'string' &&
    typeof m.TopicArn === 'string' &&
    typeof m.Message === 'string' &&
    typeof m.Timestamp === 'string' &&
    (m.SignatureVersion === '1' || m.SignatureVersion === '2') &&
    typeof m.Signature === 'string' &&
    typeof m.SigningCertURL === 'string';
  return ok ? (m as SnsMessage) : null;
}

/** Checks the message was signed by SNS with the certificate at its (SNS-hosted) URL. */
export function verifySnsSignature(message: SnsMessage, certificatePem: string): boolean {
  try {
    const certificate = new X509Certificate(certificatePem);
    const now = Date.now();
    if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) {
      return false;
    }
    const verifier = createVerify(message.SignatureVersion === '2' ? 'RSA-SHA256' : 'RSA-SHA1');
    verifier.update(stringToSign(message), 'utf8');
    return verifier.verify(certificate.publicKey, message.Signature, 'base64');
  } catch {
    return false;
  }
}

export type SesFeedback = {
  kind: 'BOUNCE' | 'COMPLAINT';
  /** Lowercased addresses that should not be emailed again. */
  addresses: string[];
  detail: string | null;
  /** Which of our emails it was (the "template" message tag), e.g. "orders.receipt". */
  template: string | null;
};

/**
 * What an SES event published through SNS means for our suppression list. Only permanent
 * bounces and complaints suppress; a full mailbox or a temporary failure does not.
 */
export function sesFeedback(snsMessageBody: string): SesFeedback | null {
  let event: {
    eventType?: string;
    mail?: { tags?: Record<string, string[] | undefined> };
    notificationType?: string;
    bounce?: {
      bounceType?: string;
      bouncedRecipients?: { emailAddress?: string; diagnosticCode?: string }[];
    };
    complaint?: {
      complainedRecipients?: { emailAddress?: string }[];
      complaintFeedbackType?: string;
    };
  };
  try {
    event = JSON.parse(snsMessageBody);
  } catch {
    return null;
  }
  const type = event.eventType ?? event.notificationType;
  const template = event.mail?.tags?.template?.[0] ?? null;
  const clean = (list: { emailAddress?: string }[] | undefined) =>
    (list ?? [])
      .map((recipient) => recipient.emailAddress?.trim().toLowerCase())
      .filter((address): address is string => Boolean(address && address.includes('@')));
  if (type === 'Bounce' && event.bounce?.bounceType === 'Permanent') {
    const recipients = event.bounce.bouncedRecipients ?? [];
    return {
      kind: 'BOUNCE',
      addresses: clean(recipients),
      detail: recipients[0]?.diagnosticCode?.slice(0, 300) ?? null,
      template,
    };
  }
  if (type === 'Complaint') {
    return {
      kind: 'COMPLAINT',
      addresses: clean(event.complaint?.complainedRecipients),
      detail: event.complaint?.complaintFeedbackType ?? null,
      template,
    };
  }
  return null;
}
