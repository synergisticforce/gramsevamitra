export interface ContactRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactResponse {
  success: boolean;
  error?: string;
  message?: string;
}

const CONTACT_EMAIL = 'contact@gramsevamitra.com';

/**
 * Submits in-app support messages to `/api/contact` (Cloudflare → SES/Resend → contact@).
 */
export class ContactService {
  readonly supportEmail = CONTACT_EMAIL;

  async submitContactForm(data: ContactRequest): Promise<ContactResponse> {
    const name = data.name.trim();
    const email = data.email.trim();
    const subject = data.subject.trim();
    const message = data.message.trim();

    if (!name || !email || !subject || !message) {
      return { success: false, error: 'All fields are required.' };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          source: 'app',
        }),
      });

      const result = (await response.json()) as ContactResponse;

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Unable to send your message. Please try again later.',
        };
      }

      return {
        success: true,
        message: result.message || `Message sent successfully to ${CONTACT_EMAIL}!`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.warn('[ContactService]', detail);
      return {
        success: false,
        error: 'Network error. Check your connection and try again.',
      };
    }
  }
}

export const contactService = new ContactService();
