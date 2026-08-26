/* ============================================================================
 * TransformerPath — Supabase account + saved-workspace client
 * ----------------------------------------------------------------------------
 * Wallet-simple, degrade-gracefully integration. Load AFTER supabase-config.js.
 *
 *   <script src="supabase-config.js"></script>
 *   <script src="supabase.js" defer></script>
 *
 * Exposes  window.TP  with:
 *   TP.ready ............ boolean (true once Supabase is live)
 *   TP.user ............. the current Supabase user or null
 *   TP.onAuth(cb) ....... register a listener fired on sign-in/out
 *   // auth
 *   TP.signUp / TP.signIn / TP.signOut / TP.getSession
 *   // saved workspace
 *   TP.saveItem / TP.unsave / TP.isSaved / TP.listSaved
 *   TP.saveDesign / TP.listDesigns / TP.deleteDesign
 *   TP.addNote / TP.listNotes / TP.deleteNote
 *   TP.follow / TP.unfollow / TP.isFollowing / TP.listFollows
 *   TP.setProgress / TP.listProgress
 *
 * When Supabase is not configured all methods resolve to safe no-ops and
 * nothing on the site changes.
 * ========================================================================== */
(function () {
  'use strict';

  var cfg = window.TP_SUPABASE || { url: '', anon: '' };
  var ready = false;
  var supabase = null;
  var authListeners = [];
  var navInjected = false;

  /* ------------------------------------------------------------------ *
   * No-op promises for the unconfigured case
   * ------------------------------------------------------------------ */
  function noop() { return Promise.resolve(false); }
  function emptyArray() { return Promise.resolve([]); }

  /* ------------------------------------------------------------------ *
   * Expose the API object (functions are swapped in once ready)
   * ------------------------------------------------------------------ */
  var TP = {
    ready: false,
    user: null,
    onAuth: function (cb) { if (typeof cb === 'function') authListeners.push(cb); },
    signUp: noop, signIn: noop, signOut: noop,
    getSession: function () { return Promise.resolve({ user: null, session: null }); },
    saveItem: noop, unsave: noop, isSaved: function () { return Promise.resolve(false); },
    listSaved: emptyArray, saveDesign: noop, listDesigns: emptyArray, deleteDesign: noop,
    addNote: noop, listNotes: emptyArray, deleteNote: noop,
    follow: noop, unfollow: noop, isFollowing: function () { return Promise.resolve(false); },
    listFollows: emptyArray, setProgress: noop, listProgress: emptyArray
  };
  window.TP = TP;

  /* ------------------------------------------------------------------ *
   * If not configured → leave the no-ops in place, do nothing more.
   * ------------------------------------------------------------------ */
  if (!cfg.url || !cfg.anon) {
    return; // graceful degrade
  }

  /* ------------------------------------------------------------------ *
   * Load the Supabase JS client from CDN, then initialise.
   * ------------------------------------------------------------------ */
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  function loadLib() {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve();
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Supabase CDN failed to load')); };
      document.head.appendChild(s);
    });
  }

  function notifyAuth() {
    TP.user = supabase ? supabase.auth.getUser() : null;
    authListeners.forEach(function (cb) { try { cb(TP.user); } catch (e) {} });
  }

  /*  The helpers below all require an authenticated user; RLS on the tables
   *  enforces ownership server-side, and each write pins user_id = current uid. */
  function uid() { var u = supabase.auth.getUser(); return u ? u.id : null; }

  function guard() { return !!uid(); }

  loadLib().then(function () {
    supabase = window.supabase.createClient(cfg.url, cfg.anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });

    /* auth */
    TP.signUp = function (email, password, meta) {
      return supabase.auth.signUp({ email: email, password: password, options: { data: meta || {} } })
        .then(function (r) { if (r.error) throw r.error; return r; });
    };
    TP.signIn = function (email, password) {
      return supabase.auth.signInWithPassword({ email: email, password: password })
        .then(function (r) { if (r.error) throw r.error; return r; });
    };
    TP.signOut = function () {
      return supabase.auth.signOut().then(function () { notifyAuth(); });
    };
    TP.getSession = function () { return supabase.auth.getSession(); };

    supabase.auth.onAuthStateChange(function () { notifyAuth(); });
    TP.getSession().then(function () { notifyAuth(); ready = true; TP.ready = true; injectNav(); });

    /* saved items */
    TP.saveItem = function (o) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('saved_items').upsert({
        user_id: uid(), item_type: o.type, item_id: o.id,
        title: o.title || '', subtitle: o.subtitle || '', url: o.url || '', meta: o.meta || {}
      }, { onConflict: 'user_id,item_type,item_id' }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.unsave = function (type, id) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('saved_items').delete().eq('user_id', uid()).eq('item_type', type).eq('item_id', String(id))
        .then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.isSaved = function (type, id) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('saved_items').select('id').eq('user_id', uid()).eq('item_type', type).eq('item_id', String(id)).maybeSingle()
        .then(function (r) { return !!(r.data); });
    };
    TP.listSaved = function (type) {
      if (!guard()) return emptyArray();
      var q = supabase.from('saved_items').select('*').eq('user_id', uid()).order('created_at', { ascending: false });
      if (type) q = q.eq('item_type', type);
      return q.then(function (r) { return r.error ? [] : r.data; });
    };

    /* designs */
    TP.saveDesign = function (o) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('saved_designs').insert({
        user_id: uid(), name: o.name || 'Untitled', kind: o.kind || 'design', data: o.data || {}
      }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listDesigns = function (kind) {
      if (!guard()) return emptyArray();
      var q = supabase.from('saved_designs').select('*').eq('user_id', uid()).order('updated_at', { ascending: false });
      if (kind) q = q.eq('kind', kind);
      return q.then(function (r) { return r.error ? [] : r.data; });
    };
    TP.deleteDesign = function (id) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('saved_designs').delete().eq('id', id).eq('user_id', uid()).then(function (r) { return !r.error; });
    };

    /* notes */
    TP.addNote = function (o) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('notes').insert({
        user_id: uid(), title: o.title || '', body: o.body || '', item_type: o.itemType || '', item_id: o.itemId || ''
      }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listNotes = function () {
      if (!guard()) return emptyArray();
      return supabase.from('notes').select('*').eq('user_id', uid()).order('updated_at', { ascending: false })
        .then(function (r) { return r.error ? [] : r.data; });
    };
    TP.deleteNote = function (id) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('notes').delete().eq('id', id).eq('user_id', uid()).then(function (r) { return !r.error; });
    };

    /* follows */
    TP.follow = function (o) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('follows').upsert({
        user_id: uid(), subject_type: o.type, subject: o.subject, label: o.label || ''
      }, { onConflict: 'user_id,subject_type,subject' }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.unfollow = function (type, subject) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('follows').delete().eq('user_id', uid()).eq('subject_type', type).eq('subject', subject)
        .then(function (r) { return !r.error; });
    };
    TP.isFollowing = function (type, subject) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('follows').select('id').eq('user_id', uid()).eq('subject_type', type).eq('subject', subject).maybeSingle()
        .then(function (r) { return !!(r.data); });
    };
    TP.listFollows = function (type) {
      if (!guard()) return emptyArray();
      var q = supabase.from('follows').select('*').eq('user_id', uid()).order('created_at', { ascending: false });
      if (type) q = q.eq('subject_type', type);
      return q.then(function (r) { return r.error ? [] : r.data; });
    };

    /* learning progress */
    TP.setProgress = function (course, chapter, status, score) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('learning_progress').upsert({
        user_id: uid(), course: course, chapter: chapter || '', status: status || 'started', score: score || null
      }, { onConflict: 'user_id,course,chapter' }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listProgress = function (course) {
      if (!guard()) return emptyArray();
      var q = supabase.from('learning_progress').select('*').eq('user_id', uid()).order('updated_at', { ascending: false });
      if (course) q = q.eq('course', course);
      return q.then(function (r) { return r.error ? [] : r.data; });
    };

    /* books */
    TP.saveBook = function (bookId, edition) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('user_books').upsert({ user_id: uid(), book_id: bookId, edition: edition || 'digital', activated: true },
        { onConflict: 'user_id,book_id' }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listBooks = function () {
      if (!guard()) return emptyArray();
      return supabase.from('user_books').select('*').eq('user_id', uid()).order('activated_at', { ascending: false })
        .then(function (r) { return r.error ? [] : r.data; });
    };

    /* RFQs */
    TP.saveRfq = function (o) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('user_rfqs').insert({
        user_id: uid(), reference: o.reference || '', category: o.category || '', quantity: o.quantity || '',
        rating: o.rating || '', voltage: o.voltage || '', standard: o.standard || '', destination: o.destination || '', status: 'open'
      }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listRfqs = function () {
      if (!guard()) return emptyArray();
      return supabase.from('user_rfqs').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
        .then(function (r) { return r.error ? [] : r.data; });
    };

    /* company claim / ownership */
    TP.claimCompany = function (company, country) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('company_claims').upsert({ user_id: uid(), company: company, country: country || '', status: 'claimed' },
        { onConflict: 'user_id,company,country' }).then(function (r) { if (r.error) throw r.error; return true; });
    };
    TP.listClaims = function () {
      if (!guard()) return emptyArray();
      return supabase.from('company_claims').select('*').eq('user_id', uid()).order('created_at', { ascending: false })
        .then(function (r) { return r.error ? [] : r.data; });
    };

    /* email preferences */
    TP.getEmailPrefs = function () {
      if (!guard()) return Promise.resolve({ daily_brief: true, alerts: true, newsletters: false });
      return supabase.from('email_prefs').select('*').eq('user_id', uid()).maybeSingle()
        .then(function (r) { return r.data || { daily_brief: true, alerts: true, newsletters: false }; });
    };
    TP.setEmailPrefs = function (prefs) {
      if (!guard()) return Promise.resolve(false);
      return supabase.from('email_prefs').upsert({ user_id: uid(), daily_brief: !!prefs.daily_brief, alerts: !!prefs.alerts, newsletters: !!prefs.newsletters },
        { onConflict: 'user_id' }).then(function (r) { if (r.error) throw r.error; return true; });
    };

    /* entitlements for the current plan (free / engineer / professional / enterprise) */
    TP.getEntitlements = function () {
      if (!guard()) return Promise.resolve({ plan: 'free', features: [] });
      return supabase.from('profiles').select('plan').eq('id', uid()).maybeSingle()
        .then(function (r) { return { plan: (r.data && r.data.plan) || 'free' }; });
    };

    /* inject an "Account" link into the main + tool navs so the workspace page
     * is reachable without editing every header. Idempotent. */
    function injectNav() {
      if (navInjected) return; navInjected = true;
      var href = 'workspace.html';
      ['nav-links', 'tp-navlinks'].forEach(function (cls) {
        var nav = document.querySelector('.' + cls);
        if (!nav || nav.querySelector('[data-tp-account]')) return;
        var a = document.createElement('a');
        a.href = href; a.textContent = 'Account'; a.setAttribute('data-tp-account', '1');
        nav.appendChild(a);
      });
    }
  }).catch(function (e) {
    // stay degraded; log once for developers
    if (window.console && console.info) console.info('[TP] Accounts disabled:', e && e.message);
  });
})();
