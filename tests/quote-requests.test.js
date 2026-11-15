/* Directory quote requests: form, anon insert, do-not-contact flag, weekly count.
 * Run: node tests/quote-requests.test.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const outreach = require('../lib/quote-outreach');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'quote-request.js'), 'utf8');
const sql = fs.readFileSync(path.join(root, 'supabase/migrations/20261115110000_quote_requests.sql'), 'utf8');
const dist = fs.readFileSync(path.join(root, 'build-dist.js'), 'utf8');
const slugs = outreach.suppressedSlugs(root);

assert.ok(slugs.indexOf('bf-s-r-l') !== -1);
assert.ok(sql.indexOf("('bf-s-r-l', true)") !== -1);
assert.ok(/create table if not exists public\.quote_requests/.test(sql));
assert.ok(/grant insert on table public\.quote_requests to anon/.test(sql));
assert.ok(/for insert\s+to anon\s+with check \(true\)/.test(sql));
assert.strictEqual(/for select/.test(sql), false);
assert.strictEqual(/for update/.test(sql), false);
assert.strictEqual(/for delete/.test(sql), false);
assert.ok(/revoke all on table public\.quote_requests from public, anon, authenticated/.test(sql));
assert.ok(/forward_blocked/.test(sql));
assert.ok(/quote_requests_by_week/.test(sql));
assert.ok(/date_trunc\('week', created_at\)/.test(sql));
assert.ok(/revoke all on table public\.quote_requests_by_week from public, anon, authenticated/.test(sql));
assert.ok(sql.indexOf('never_contact') !== -1);
assert.ok(/create schema if not exists private/.test(sql));
assert.ok(/revoke all on schema private from public, anon, authenticated/.test(sql));
assert.ok(/create table if not exists private\.quote_outreach_flags/.test(sql));
assert.ok(/revoke all on table private\.quote_outreach_flags from public, anon, authenticated/.test(sql));
assert.strictEqual(/create table if not exists public\.quote_outreach_flags/.test(sql), false);
assert.ok(/function private\.quote_requests_before_insert\(\)/.test(sql));
assert.ok(/set search_path = ''/.test(sql));
assert.ok(/from private\.quote_outreach_flags/.test(sql));
assert.ok(/revoke execute on function private\.quote_requests_before_insert\(\) from public, anon, authenticated/.test(sql));
assert.ok(/execute function private\.quote_requests_before_insert\(\)/.test(sql));
assert.ok(/drop function if exists public\.quote_requests_before_insert\(\)/.test(sql));
assert.strictEqual(/create or replace function public\.quote_requests_before_insert/.test(sql), false);
assert.ok(/with \(security_invoker = true\)/.test(sql));

assert.ok(js.indexOf('Request a quote') !== -1);
assert.ok(js.indexOf('name="bot-field"') !== -1);
assert.ok(js.indexOf('name="voltage_mva"') !== -1);
assert.ok(js.indexOf('/rest/v1/quote_requests') !== -1);
assert.ok(js.indexOf('Prefer: \'return=minimal\'') !== -1 || js.indexOf("Prefer: 'return=minimal'") !== -1);
assert.ok(js.indexOf('Nothing is sent to the company') !== -1);
assert.ok(js.indexOf('does not email the company') !== -1);
assert.strictEqual(js.indexOf('mailto:'), -1);
assert.strictEqual(/never_contact|do_not_contact/.test(js), false);
assert.ok(dist.indexOf("'quote-request.js'") !== -1);

const maker = fs.readFileSync(path.join(root, 'manufacturers/hitachi-energy/index.html'), 'utf8');
const accessory = fs.readFileSync(path.join(root, 'accessories/bf-s-r-l/index.html'), 'utf8');
const category = fs.readFileSync(path.join(root, 'manufacturers/power-transformers/index.html'), 'utf8');
assert.ok(maker.indexOf('src="/quote-request.js"') !== -1);
assert.ok(accessory.indexOf('src="/quote-request.js"') !== -1);
assert.strictEqual(category.indexOf('quote-request.js'), -1);
assert.strictEqual(/never_contact|do_not_contact/.test(maker + accessory), false);

const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
assert.ok(privacy.indexOf('The form does not email the company.') !== -1);

const companyBuilder = fs.readFileSync(path.join(root, 'build-company-pages.js'), 'utf8');
const accessoryBuilder = fs.readFileSync(path.join(root, 'build-accessories.js'), 'utf8');
assert.ok(companyBuilder.indexOf('src="/quote-request.js"') !== -1);
assert.ok(accessoryBuilder.indexOf('src="/quote-request.js"') !== -1);

console.log('quote requests: PASS (' + slugs.length + ' do-not-contact slugs)');
