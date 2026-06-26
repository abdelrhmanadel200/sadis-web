// Centralised Resend wrapper that applies every best-practice deliverability
// flag we can flip without external services:
//
//  - Real `From` name (Gmail penalises addresses without a friendly name).
//  - `Reply-To: support@6thultra.com` so replies land somewhere a human reads.
//  - `List-Unsubscribe` and `List-Unsubscribe-Post` headers — Gmail's bulk
//    sender guidelines (Feb 2024+) require these for any sender over ~5k/day,
//    and including them on smaller volumes improves inbox placement.
//  - Plain-text alternative alongside the HTML body — single-format emails
//    score higher on Spamassassin/Postmark filters.
//  - Custom `Message-ID`-friendly tags via Resend's `tags` array for analytics
//    (Gmail factors per-tag complaint rate, but we get clean reports too).
//  - Quiet, transactional language (no "FREE!!!", no all-caps, no emoji in
//    subject) — content score matters.
//
// Use these helpers from API routes; don't call the Resend REST endpoint
// directly anymore.

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const FROM_DEFAULT =
  process.env.RESEND_FROM || 'Sadis Ultra <noreply@6thultra.com>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'support@6thultra.com';
const APP_BASE = process.env.APP_BASE_URL || 'https://www.6thultra.com';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Free-form tag for analytics in Resend (e.g. "subscription_activated"). */
  tag?: string;
}

/** Strip HTML to a plaintext fallback for clients/spam-filters that read it. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendEmail(msg: EmailMessage): Promise<{ id?: string; error?: string }> {
  if (!RESEND_KEY) {
    console.warn('Resend API key not configured; skipping email to', msg.to);
    return { error: 'no_api_key' };
  }
  if (!msg.to || !msg.subject || !msg.html) {
    return { error: 'invalid_message' };
  }

  // Build a one-click unsubscribe link that we'll serve from /api/email/unsubscribe.
  const unsubUrl = `${APP_BASE}/api/email/unsubscribe?to=${encodeURIComponent(msg.to)}`;
  const text = msg.text || htmlToText(msg.html);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_DEFAULT,
        to: msg.to,
        reply_to: REPLY_TO,
        subject: msg.subject,
        html: msg.html,
        text,
        // Headers that meaningfully improve Gmail inbox placement.
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@6thultra.com?subject=Unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          // Auto-Submitted tells receiving servers this is a transactional
          // mail, not user-typed. Big help for filtering.
          'Auto-Submitted': 'auto-generated',
        },
        tags: msg.tag ? [{ name: 'category', value: msg.tag }] : undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('Resend send failed', res.status, detail);
      return { error: detail || `http_${res.status}` };
    }
    const data = await res.json();
    return { id: data.id };
  } catch (e) {
    console.error('Resend network error', e);
    return { error: e instanceof Error ? e.message : 'unknown' };
  }
}

/* ---------------------------------------------------------------- */
/* Templates                                                        */
/* ---------------------------------------------------------------- */

const baseLayout = (title: string, body: string, ctaUrl?: string, ctaLabel?: string) => `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:24px;background:#f5f7fa;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif;direction:rtl;color:#1a202c;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
    <tr><td style="padding:16px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="padding:32px 28px 8px;text-align:right;">
          <div style="font-size:18px;font-weight:700;color:#0369a1;letter-spacing:0;">سادس ألترا</div>
        </td></tr>
        <tr><td style="padding:8px 28px 28px;text-align:right;">
          <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a;font-weight:700;">${title}</h1>
          <div style="font-size:15px;line-height:1.8;color:#334155;">${body}</div>
          ${
            ctaUrl && ctaLabel
              ? `<div style="margin-top:24px;"><a href="${ctaUrl}" style="display:inline-block;background:#0369a1;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">${ctaLabel}</a></div>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:20px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:right;font-size:12px;color:#64748b;line-height:1.7;">
          <div>سادس ألترا — منصة تعليمية للمنهج العراقي السادس الإعدادي.</div>
          <div style="margin-top:6px;">للدعم: <a href="mailto:support@6thultra.com" style="color:#0369a1;">support@6thultra.com</a></div>
          <div style="margin-top:6px;">
            <a href="${APP_BASE}/privacy" style="color:#64748b;text-decoration:underline;">الخصوصية</a>
            &nbsp;·&nbsp;
            <a href="${APP_BASE}/terms" style="color:#64748b;text-decoration:underline;">الشروط</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

export function subscriptionActivatedEmail(opts: {
  to: string;
  planName: string;
  expiresAt: Date;
  invoiceId: string;
}) {
  const expiry = opts.expiresAt.toLocaleDateString('ar-IQ');
  const body = `
    <p>تم تفعيل اشتراكك في باقة <strong>${opts.planName}</strong> بنجاح.</p>
    <p>تاريخ انتهاء الاشتراك: <strong>${expiry}</strong></p>
    <p>رقم الفاتورة: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;">${opts.invoiceId}</code></p>
    <p>تقدر تبدأ استخدام الأستاذ ذكي من الآن.</p>
  `;
  return sendEmail({
    to: opts.to,
    subject: `تأكيد تفعيل اشتراك سادس ألترا — ${opts.planName}`,
    html: baseLayout(
      'تم تفعيل اشتراكك',
      body,
      `${APP_BASE}/chat`,
      'ابدأ التعلم',
    ),
    tag: 'subscription_activated',
  });
}

export function subscriptionExpiryWarningEmail(opts: {
  to: string;
  planName: string;
  daysLeft: number;
}) {
  const body = `
    <p>تنتهي صلاحية باقة <strong>${opts.planName}</strong> خلال <strong>${opts.daysLeft} أيام</strong>.</p>
    <p>جدّد اشتراكك الآن لتستمر بدون انقطاع وتحافظ على وصولك لكل المواد والمميزات.</p>
  `;
  return sendEmail({
    to: opts.to,
    subject: `اشتراك سادس ألترا ينتهي خلال ${opts.daysLeft} أيام`,
    html: baseLayout(
      'اشتراكك ينتهي قريباً',
      body,
      `${APP_BASE}/account/subscription`,
      'تجديد الاشتراك',
    ),
    tag: 'subscription_expiry_warning',
  });
}
