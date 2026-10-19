/* A sitemap URL with no file in dist is the commissioning-jobs 404. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { auditDistSitemap, JOBS_BUTTON, JOBS_BUY } = require('../scripts/check-dist-sitemap');

let failed = 0;
function check(name, cond) {
  if (cond) console.log('  PASS  ' + name);
  else { failed++; console.error('  FAIL  ' + name); }
}

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-sitemap-'));
  Object.keys(files).forEach(function (rel) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, files[rel]);
  });
  return dir;
}

const missing = fixture({
  'sitemap.xml': '<url><loc>https://transformerpath.com/commissioning-jobs/</loc></url>'
});
const missingErrors = auditDistSitemap(missing, { requireJobs: false });
check('a listed page that was not copied fails', missingErrors.some(function (e) {
  return e.indexOf('https://transformerpath.com/commissioning-jobs/') !== -1;
}));

const present = fixture({
  'sitemap.xml': '<url><loc>https://transformerpath.com/tools/dga/</loc></url>',
  'tools/dga/index.html': '<html></html>'
});
check('a copied page passes', auditDistSitemap(present, { requireJobs: false }).length === 0);

const jobs = fixture({
  'sitemap.xml': '<url><loc>https://transformerpath.com/commissioning-jobs/</loc></url>',
  'commissioning-jobs/index.html': '<a href="' + JOBS_BUY + '">' + JOBS_BUTTON + '</a>'
});
check('the published board keeps the $199 button', auditDistSitemap(jobs).length === 0);

const noButton = fixture({
  'sitemap.xml': '<url><loc>https://transformerpath.com/commissioning-jobs/</loc></url>',
  'commissioning-jobs/index.html': '<p>No posts yet.</p>'
});
const noButtonErrors = auditDistSitemap(noButton);
check('a board page without the Payment Link fails', noButtonErrors.some(function (e) {
  return e.indexOf('Payment Link') !== -1;
}));

const unlisted = fixture({
  'sitemap.xml': '<url><loc>https://transformerpath.com/tools/dga/</loc></url>',
  'tools/dga/index.html': '<html></html>'
});
check('dropping the board from the sitemap fails', auditDistSitemap(unlisted).some(function (e) {
  return e.indexOf('/commissioning-jobs/') !== -1;
}));

const noSitemap = fixture({});
check('dist without a sitemap fails', auditDistSitemap(noSitemap, { requireJobs: false }).some(function (e) {
  return e.indexOf('sitemap.xml') !== -1;
}));

if (failed) {
  console.error('DIST SITEMAP TESTS FAILED (' + failed + ')');
  process.exit(1);
}
console.log('DIST SITEMAP TESTS OK');
