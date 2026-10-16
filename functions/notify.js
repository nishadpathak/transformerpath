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
//
// Recipients are only NOTIFY_TO (the site inbox). The form's email is a field
// in the body, never a recipient. An RFQ email is sent only when Netlify's
// CONTEXT is production and the request host is this site (or absent, as in
// a direct function test). Deploy previews, branch deploys, and a missing
// CONTEXT are recorded and not sent, including when a Resend key is present.

function envMail() {
  return {
    key: (process.env.RESEND_API_KEY || '').trim(),
    to: (process.env.NOTIFY_TO || 'hello@transformerpath.com').trim(),
    from: (process.env.RESEND_FROM || 'TransformerPath <onboarding@resend.dev>').trim(),
    context: (process.env.CONTEXT || '').trim()
  };
}

// Nicely printable field order for the email body.
const FIELD_ORDER = ['form', 'form-name', 'reference', 'name', 'company', 'email', 'phone', 'country', 'category', 'quantity', 'rating', 'voltage', 'standard', 'details', 'deadline', 'budget', 'destination', 'consent', 'consent_version', 'consent_at', 'range', 'interest', 'service', 'product', 'seats', 'standards', 'message', 'url', 'note'];
const OMIT = { 'bot-field': 1, bot_field: 1, consent_text: 1, attachment: 1 };

function formName(data) {
  return String((data && (data.form || data['form-name'])) || '').trim();
}

const PRODUCTION_HOSTS = {
  'transformerpath.com': 1,
  'www.transformerpath.com': 1,
  'transformerpath.netlify.app': 1
};

function requestHost(event) {
  const headers = (event && event.headers) || {};
  const raw = headers.host || headers.Host || headers['x-forwarded-host'] || headers['X-Forwarded-Host'] || '';
  return String(raw).split(',')[0].trim().toLowerCase();
}

function productionDestination(mail, event) {
  if (mail.context !== 'production') return false;
  const host = requestHost(event);
  if (!host) return true;
  return !!PRODUCTION_HOSTS[host];
}

function previewRfq(data, mail, event) {
  return formName(data) === 'rfq' && !productionDestination(mail, event);
}

function fmtVal(field, v) {
  if (v === undefined || v === null || v === '') return null;
  const label = field.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return `${label}: ${Array.isArray(v) ? v.join(', ') : v}`;
}

function linesFor(data) {
  const keys = FIELD_ORDER.slice();
  Object.keys(data || {}).forEach((k) => {
    if (keys.indexOf(k) === -1 && !OMIT[k]) keys.push(k);
  });
  return keys.map((f) => fmtVal(f, data[f])).filter(Boolean).join('\n');
}

exports.recipient = function () {
  return [envMail().to];
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  const mail = envMail();

  let data;
  try { data = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (previewRfq(data, mail, event)) {
    console.log('RFQ notification withheld on ' + (mail.context || 'unset') + ' host=' + (requestHost(event) || 'none') + ' (no email sent). reference=' + (data.reference || ''));
    return {
      statusCode: 200,
      body: JSON.stringify({ sent: false, reason: 'preview_withheld', notification_prepared: true, to: 'site-inbox' })
    };
  }

  if (!mail.key) {
    console.log('Notifying form lead (RESEND_API_KEY not set — email not sent):', event.body || '(no body)');
    return { statusCode: 200, body: JSON.stringify({ sent: false, reason: 'not_configured' }) };
  }

  const bodyText = `New TransformerPath enquiry\n\n${linesFor(data) || '(no fields captured)'}\n\n—\nSent from the TransformerPath website.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mail.key}`,
      },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
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
