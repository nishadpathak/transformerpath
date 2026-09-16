#!/usr/bin/env node
/* Print TransformerPath APPLY_SQL (identity + entitlement + learning spine).
 *
 * *.sql is gitignored in this repo, so the canonical DDL lives in
 * functions/lib/account-model.js. This script is the runnable copy:
 *
 *   node apply-sql.js
 *   node apply-sql.js > /tmp/tp-apply.sql
 *
 * Then paste into the Supabase SQL editor (service role). Additive:
 * existing tables are kept; missing columns are added. Also available
 * unauthenticated as GET /.netlify/functions/apply-sql (text/plain).
 */
'use strict';
process.stdout.write(require('./functions/lib/account-model').APPLY_SQL);
