import { Resend } from 'resend';
import type { SupabaseClient } from '@supabase/supabase-js';

export type NotificationEvent =
  | { kind: 'application_status_changed'; status: string; placementTitle: string }
  | { kind: 'agreement_generated'; placementTitle: string }
  | { kind: 'application_withdrawn'; placementTitle: string; reasonCategory: string }
  | { kind: 'business_deverified'; businessName: string };

/**
 * Plain-language copy per event (constitution Principle III: no raw error codes or jargon).
 * Subject and body never contain personal contact details — release is governed by FR-015.
 */
function render(event: NotificationEvent): { subject: string; body: string } {
  switch (event.kind) {
    case 'application_status_changed':
      return {
        subject: `Your application for ${event.placementTitle} was ${event.status}`,
        body: `There is an update on your application for ${event.placementTitle}. Sign in to see what happens next.`,
      };
    case 'agreement_generated':
      return {
        subject: `Your apprenticeship agreement for ${event.placementTitle} is ready`,
        body: `Both you and your mentor now have the same agreement for ${event.placementTitle}. Sign in to read the hours, pay rate, and safety terms.`,
      };
    case 'application_withdrawn':
      return {
        subject: `The placement ${event.placementTitle} has ended`,
        body: `This placement is no longer active. Reason on file: ${event.reasonCategory.replace(/_/g, ' ')}. Sign in for details.`,
      };
    case 'business_deverified':
      return {
        subject: `${event.businessName} is no longer a verified business`,
        body: `A placement you applied to is no longer available because the business's verification was withdrawn. Your application has been closed and no action is needed from you.`,
      };
  }
}

/** Writes the in-app row and sends the email. Both channels, per FR-024. */
export async function notify(
  supabase: SupabaseClient,
  recipient: { profileId: string; email: string | null },
  event: NotificationEvent,
): Promise<void> {
  const { subject, body } = render(event);

  await supabase.from('notifications').insert({
    recipient_id: recipient.profileId,
    subject,
    body,
    event_kind: event.kind,
  });

  await sendEmail(recipient.email, subject, body);
}

async function sendEmail(to: string | null, subject: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  // No key configured (local dev / CI): the in-app notification still lands, and we skip email
  // rather than failing the surrounding transaction's follow-up work.
  if (!apiKey || !to) return;

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.NOTIFICATION_FROM_EMAIL ?? 'notifications@amanah.example',
    to,
    subject,
    text: body,
  });
}
