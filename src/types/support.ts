export type ContactStatus = "new" | "reviewing" | "closed";
export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: number;
  updatedAt: number;
};
export type ContactResult = { saved: true };
export type NewsletterSubscriber = {
  id: string;
  email: string;
  status: "pending" | "unsubscribed";
  preferenceKeyHash: string;
  consentVersion: "vela-newsletter-v1";
  consentedAt: number;
  unsubscribedAt: number | null;
  createdAt: number;
  updatedAt: number;
};
/** Generic for new, duplicate, unknown, and nonmatching-capability requests. */
export type NewsletterResult = { accepted: true };
export type AdminSupportList = {
  messages: ContactMessage[];
  limit: 100;
  truncated: boolean;
  next: string | null;
};
