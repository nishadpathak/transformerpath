/* Single AdSense configuration for the public site.
 *
 * CLIENT is the AdSense publisher id already published in ads.txt.
 * INCONTENT_SLOT is the manual responsive ad unit. Leave it as the
 * placeholder until the numeric ad-unit id exists in the AdSense dashboard.
 * A non-numeric value is rendered into data-ad-slot but the unit stays
 * collapsed, so an unconfigured slot does not reserve blank space.
 *
 * EEA / UK / Switzerland consent for personalized ads is Google's certified
 * CMP (Privacy & messaging / Funding Choices), turned on in the AdSense
 * account. This file does not invent a second CMP. consent.js still asks
 * before Google Analytics loads.
 */
'use strict';

const CLIENT = 'ca-pub-5646978915498298';
const PUBLISHER = 'pub-5646978915498298';

/** Replace with the numeric ad unit id (Ads → By ad unit). */
const INCONTENT_SLOT = 'placeholder';

/* defer, not async: the tag stays in <head> for the AdSense crawler, and
 * adsbygoogle.push in the in-content slot still queues until this file runs.
 * consent.js only injects a second copy when this tag is missing. */
const LOADER = '<script defer src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' +
  CLIENT + '" crossorigin="anonymous"></script>';

const ADS_TXT_LINE = 'google.com, ' + PUBLISHER + ', DIRECT, f08c47fec0942fa0';

module.exports = {
  CLIENT: CLIENT,
  PUBLISHER: PUBLISHER,
  INCONTENT_SLOT: INCONTENT_SLOT,
  LOADER: LOADER,
  ADS_TXT_LINE: ADS_TXT_LINE,
};
