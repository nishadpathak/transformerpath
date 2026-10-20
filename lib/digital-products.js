/* Checkout products fulfilled without a Supabase row.
 * The download or claim page asks Stripe again. A missing database
 * must not make the webhook return 500.
 */
'use strict';

module.exports = {
  dga_report: true,
  report_template: true,
  template_bundle: true,
  commissioning_job_post: true,
  buyer_guide_us_eu: true
};
