// Netlify function: email a human-readable lead notification for any site form
// submission. Forms still POST to Netlify Forms (which stores submissions); this
// function sends you a formatted email so a high-intent lead like a manufacturer
// software enquiry never sits unnoticed.
//
// Environment variables:
//   RESEND_API_KEY  — Resend API key (https://resend.com/api-keys). Required to send.
//   RESEND_FROM     — verified sender, e.g. "TransformerPath <noreply@transformerpath.com>"
//                     (default: "TransformerPath <onboarding@resend.dev>")
//   NOTIFY_TO       — where notifications go (default: hello@transformerpath.com)
//
// If RESEND_API_KEY is not set the function does NOT fail the form: it logs the
// lead and returns { sent:false, reason:'not_configured' } so the visitor still
// sees success. To flip on real email, set the key and redeploy.
const RESEND_API_KEY = (process.env.RESEND_API_KEY || '').trim();
const NOTIFY_TO = (process.env.NOTIFY_TO || 'hello@transformerpath.com').trim();
const RESEND_FROM = (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim();

// Nicely printable field order for the email body.
const FIELD_ORDER = ['form', 'name', 'company', 'email', 'phone', 'range', 'interest', 'service', 'product', 'seats', 'standards', 'message', 'url', 'note'];

function fmtVal(field, v) {
  if (v === undefined || v === null || v === '') return null;
  const label = field.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${label}: ${Array.isArray(v) ? v.join(', ') : v}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!RESEND_API_KEY) {
    console.log('Notifying form lead (RESEND_API_KEY not set — email not sent):', event.body || '(no body)');
    return { statusCode: 200, body: JSON.stringify({ sent: false, reason: 'not_configured' }) };
  }

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const lines = FIELD_ORDER
    .map((f) => fmtVal(f, data[f]))
    .filter(Boolean)
    .join('\n');
  const bodyText = `New TransformerPath enquiry\n\n${lines || '(no fields captured)'}\n\n—\nSent from the TransformerPath website.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [NOTIFY_TO],
        subject: '🔔 TransformerPath enquiry' + (data.form ? ` — ${data.form}` : ''),
        text: bodyText,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error('Resend error:', res.status, t);
      return { statusCode: 200, body: JSON.stringify({ sent: false, reason: 'provider_error' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (e) {
    console.error('Notify failed:', e && e.message);
    return { statusCode: 200, body: JSON.stringify({ sent: false, reason: 'error' }) };
  }
};
