/**
 * Server-authoritative fulfillment store (Phase-2 §10).
 *
 * Records processed Stripe event IDs (idempotency), entitlements (grant/revoke),
 * and an append-only audit log. The default implementation is JSON-file backed
 * for local/dev and tests; in production this MUST be backed by a durable store
 * (KV / database) because Netlify function filesystems are ephemeral. Swap the
 * backend by passing a custom store to createHandler() — the fulfillment logic
 * is storage-agnostic.
 *
 * Client state is never authoritative: access is decided by getEntitlement().
 */
'use strict';
const fs = require('fs');
const path = require('path');

function entKey(customer, sku) {
  return String(customer || 'unknown').toLowerCase() + '::' + String(sku || '');
}

function makeMemoryStore(seed) {
  const data = seed || { processedEvents: {}, entitlements: {}, auditLog: [] };

  return {
    hasProcessed(eventId) {
      return Boolean(data.processedEvents[eventId]);
    },
    markProcessed(eventId, meta) {
      data.processedEvents[eventId] = Object.assign({ at: new Date().toISOString() }, meta || {});
    },
    grantEntitlement(e) {
      const key = entKey(e.customer, e.sku);
      const existing = data.entitlements[key];
      data.entitlements[key] = {
        customer: e.customer,
        sku: e.sku,
        productId: e.productId || null,
        priceId: e.priceId || null,
        status: 'active',
        grantedAt: (existing && existing.grantedAt) || new Date().toISOString(),
        lastEventId: e.eventId,
        lastSessionId: e.sessionId || null,
        revokedAt: null,
        revokeReason: null
      };
      return data.entitlements[key];
    },
    revokeEntitlement(e) {
      const key = entKey(e.customer, e.sku);
      const existing = data.entitlements[key];
      if (!existing) return null;
      existing.status = 'revoked';
      existing.revokedAt = new Date().toISOString();
      existing.revokeReason = e.reason || null;
      existing.lastEventId = e.eventId;
      return existing;
    },
    getEntitlement(customer, sku) {
      return data.entitlements[entKey(customer, sku)] || null;
    },
    revokeAllForCustomer(customer, reason, eventId) {
      const revoked = [];
      for (const key of Object.keys(data.entitlements)) {
        if (key.startsWith(String(customer || '').toLowerCase() + '::')) {
          const ent = data.entitlements[key];
          if (ent.status === 'active') {
            ent.status = 'revoked';
            ent.revokedAt = new Date().toISOString();
            ent.revokeReason = reason || null;
            ent.lastEventId = eventId;
            revoked.push(ent.sku);
          }
        }
      }
      return revoked;
    },
    audit(entry) {
      data.auditLog.push(Object.assign({ at: new Date().toISOString() }, entry));
    },
    dump() {
      return data;
    }
  };
}

function makeFileStore(file) {
  let seed = { processedEvents: {}, entitlements: {}, auditLog: [] };
  try {
    seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    /* first run */
  }
  const mem = makeMemoryStore(seed);
  const persist = () => {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(mem.dump(), null, 2) + '\n');
    } catch (e) {
      console.error('fulfillment-store persist failed:', e.message);
    }
  };
  // Wrap mutators to persist after each change.
  return {
    hasProcessed: mem.hasProcessed,
    getEntitlement: mem.getEntitlement,
    dump: mem.dump,
    markProcessed: (id, meta) => { mem.markProcessed(id, meta); persist(); },
    grantEntitlement: (e) => { const r = mem.grantEntitlement(e); persist(); return r; },
    revokeEntitlement: (e) => { const r = mem.revokeEntitlement(e); persist(); return r; },
    revokeAllForCustomer: (c, reason, id) => { const r = mem.revokeAllForCustomer(c, reason, id); persist(); return r; },
    audit: (entry) => { mem.audit(entry); persist(); }
  };
}

function defaultStore() {
  const file = process.env.FULFILLMENT_STORE_PATH || path.join(__dirname, '..', '..', 'data', 'fulfillment-ledger.json');
  return makeFileStore(file);
}

module.exports = { makeMemoryStore, makeFileStore, defaultStore, entKey };
