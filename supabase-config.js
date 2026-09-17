/* ============================================================================
 * TransformerPath — Supabase public config
 * ----------------------------------------------------------------------------
 * The anon key is PUBLIC and safe to ship to the browser (Row-Level Security
 * on every table stops users touching anyone else's rows). The service_role
 * key is SECRET and must live only in serverless-function env vars — never in
 * this file.
 *
 * Fill these two values in after creating the Supabase project (see
 * SUPABASE_SETUP.md). While they are blank the whole account layer degrades
 * gracefully to "off" — pages render normally, no errors, and the workspace
 * page shows a "sign in unavailable" state.
 * ========================================================================== */
window.TP_SUPABASE = {
  url:  "https://rpzpgfstrxeevhkizxsx.supabase.co",
  anon: "sb_publishable_Hex-P9AY5L7Kz4WOwpDHNw_X_wNSlVe"   // public publishable key
};
