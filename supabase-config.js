/* Public Supabase settings for the browser.
 *
 * Netlify overwrites this file during the build by running
 * scripts/write-supabase-config.js, which reads SUPABASE_URL and either
 * SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY. Keep both values empty in
 * git. An empty pair is the honest "Accounts are being set up" state — the
 * page must not pretend anyone is signed in.
 *
 * The service-role key is never written here.
 */
window.TP_SUPABASE = {
  url: "",
  anon: ""
};
