/* Entitlement-gated Learning lesson.
 *
 * Same access signal as the other paid lessons: a server-issued entitlement
 * token (cookie tp_ent or Authorization: Bearer), or a student badge.
 * Fail-closed. The full HTML is not in the static page.
 *
 * GET /.netlify/functions/learn-lesson?id=hv-side-bushing-replacement
 */
'use strict';
const ent = require('./lib/entitlement');
const studentBadge = require('./lib/student-badge');
const lesson = require('./lib/hv-bushing-lesson');

const LESSONS = {};
LESSONS[lesson.id] = lesson;

exports.handler = async (event) => {
  const id = String((event.queryStringParameters && event.queryStringParameters.id) || '').toLowerCase();
  const item = LESSONS[id];
  if (!item) {
    return {
      statusCode: 404,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({ ok: false, error: 'unknown_lesson' })
    };
  }

  const token = ent.extractToken(event);
  const v = ent.verify(token);
  const student = v.valid ? false : await studentBadge.studentBadge(event);
  if (v.valid || student) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        ok: true,
        plan: v.valid ? v.plan : 'student',
        id: item.id,
        title: item.title,
        html: item.html
      })
    };
  }

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({
      ok: false,
      locked: true,
      reason: v.reason || 'not_entitled',
      id: item.id,
      title: item.title,
      preview: item.preview,
      objectives: item.objectives,
      plan: { name: 'Learning', price: '$199 / 12 months', note: 'Professional and Team include Learning.' },
      unlock: '/checkout/?product=learning'
    })
  };
};
