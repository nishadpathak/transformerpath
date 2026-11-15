/* Internal outreach flags stay in source JSON and must not be rendered. */
'use strict';

const INTERNAL = [
  'never_contact',
  'do_not_contact',
  'outreach_flags',
  'flags',
  'no_email_outreach',
  'directory_publish'
];

function publicCopy(row) {
  const copy = Object.assign({}, row);
  INTERNAL.forEach(function (key) { delete copy[key]; });
  return copy;
}

function leaked(text) {
  return /do_not_contact|never_contact|no_email_outreach|outreach_flags/i.test(String(text || ''));
}

module.exports = {
  INTERNAL: INTERNAL,
  publicCopy: publicCopy,
  leaked: leaked
};
