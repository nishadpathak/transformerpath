/* Verified profile media: logo, catalogue PDF, and photo gallery.
 * Included with Verified Manufacturer at no extra charge.
 * URLs come from a reviewed listing row or from the claim form fields
 * (logo_url, catalogue_url, photo_urls) after they are published in
 * data/listing-media.json. Missing or unchecked values render as an em dash.
 * RFQ routing is not part of this module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.tpListingMedia = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var IMAGE_EXT = /\.(?:png|jpe?g|gif|webp)(?:$|\?)/i;
  var PDF_EXT = /\.pdf(?:$|\?)/i;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function httpsUrl(value) {
    var s = String(value || '').trim();
    if (!/^https:\/\/[^\s<>"']+$/i.test(s)) return '';
    if (s.length > 500) return '';
    return s;
  }

  function imageUrl(value) {
    var s = httpsUrl(value);
    return s && IMAGE_EXT.test(s) ? s : '';
  }

  function pdfUrl(value) {
    var s = httpsUrl(value);
    return s && PDF_EXT.test(s) ? s : '';
  }

  function dash() {
    return '—';
  }

  function photoList(value) {
    var raw = [];
    if (Array.isArray(value)) raw = value;
    else if (typeof value === 'string') raw = value.split(/[\n,]+/);
    var out = [];
    raw.forEach(function (item) {
      if (out.length >= 12) return;
      var url = '';
      var alt = '';
      if (item && typeof item === 'object') {
        url = imageUrl(item.url || item.src);
        alt = String(item.alt || '').trim().slice(0, 120);
      } else {
        url = imageUrl(item);
      }
      if (!url) return;
      out.push({ url: url, alt: alt || 'Factory photo' });
    });
    return out;
  }

  function normalize(record) {
    if (!record || typeof record !== 'object') return null;
    var logo = imageUrl(record.logo_url || record.logo);
    var catalogue = pdfUrl(record.catalogue_url || record.catalogue_pdf || record.brochure_url);
    var photos = photoList(record.photos || record.photo_urls || record.gallery);
    if (!logo && !catalogue && !photos.length) return null;
    return { logo: logo, catalogue: catalogue, photos: photos };
  }

  function reviewedMediaRow(row) {
    if (!row || row.status !== 'verified') return false;
    if (!row.reviewer || !row.reviewed_at || !row.verification_evidence) return false;
    return true;
  }

  function slugOf(record) {
    return String((record && (record.company_slug || record.slug)) || '').trim().toLowerCase();
  }

  function collect(slug, sources) {
    var want = String(slug || '').trim().toLowerCase();
    if (!want) return null;
    sources = sources || {};
    var paidHit = null;
    (sources.listings || []).forEach(function (row) {
      if (paidHit) return;
      if (slugOf(row) !== want) return;
      if (row.product && row.product !== 'verified_manufacturer') return;
      if (!reviewedMediaRow(row)) return;
      paidHit = row;
    });
    var published = null;
    (sources.profiles || []).forEach(function (row) {
      if (published) return;
      if (slugOf(row) !== want) return;
      if (!reviewedMediaRow(row)) return;
      published = row;
    });
    var company = sources.company || null;
    var companyOk = company && (company.verified === true || company.listing_tier === 'verified');
    var fromCompany = companyOk ? company : null;
    var merged = {};
    [fromCompany, paidHit, published].forEach(function (row) {
      if (!row) return;
      if (row.logo_url || row.logo) merged.logo_url = row.logo_url || row.logo;
      if (row.catalogue_url || row.catalogue_pdf || row.brochure_url) {
        merged.catalogue_url = row.catalogue_url || row.catalogue_pdf || row.brochure_url;
      }
      if (row.photos || row.photo_urls || row.gallery) merged.photos = row.photos || row.photo_urls || row.gallery;
    });
    if (!paidHit && !published && !fromCompany) return null;
    if (!merged.logo_url && !merged.catalogue_url && !merged.photos) {
      return { logo: '', catalogue: '', photos: [] };
    }
    var media = normalize(merged);
    return media || { logo: '', catalogue: '', photos: [] };
  }

  function render(media) {
    if (!media) return '';
    var logo = media.logo
      ? '<img src="' + esc(media.logo) + '" alt="Company logo" width="160" height="64" style="max-width:160px;height:auto;background:#fff;border-radius:8px;padding:6px">'
      : dash();
    var catalogue = media.catalogue
      ? '<a href="' + esc(media.catalogue) + '" target="_blank" rel="noopener">Catalogue PDF</a>'
      : dash();
    var gallery = (media.photos && media.photos.length)
      ? '<div class="tp-photo-gallery" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">' +
        media.photos.map(function (photo) {
          return '<a href="' + esc(photo.url) + '" target="_blank" rel="noopener"><img src="' + esc(photo.url) + '" alt="' + esc(photo.alt || 'Factory photo') + '" width="160" height="120" style="width:160px;height:120px;object-fit:cover;border-radius:8px;border:1px solid var(--border)"></a>';
        }).join('') + '</div>'
      : dash();
    return '<section class="tp-listing-media" data-listing-media="1" style="margin:16px 0;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--card)">' +
      '<h2 style="font-size:1.05rem;margin:0 0 6px">Logo, catalogue and photos</h2>' +
      '<p style="color:var(--muted);font-size:.84rem;margin:0 0 10px">Included with Verified Manufacturer at no extra charge. RFQ routing is coming soon.</p>' +
      '<div style="font-size:.92rem;line-height:1.6"><div><b>Logo</b> ' + logo + '</div>' +
      '<div><b>Catalogue</b> ' + catalogue + '</div>' +
      '<div><b>Photos</b> ' + gallery + '</div></div></section>';
  }

  function renderForCompany(company, mediaDoc) {
    if (!company) return '';
    var slug = company.slug || String(company.id || '').replace(/^cmp:/, '');
    return render(collect(slug, {
      company: company,
      profiles: (mediaDoc && mediaDoc.profiles) || [],
      listings: (mediaDoc && mediaDoc.listings) || []
    }));
  }

  return {
    esc: esc,
    httpsUrl: httpsUrl,
    imageUrl: imageUrl,
    pdfUrl: pdfUrl,
    normalize: normalize,
    collect: collect,
    render: render,
    renderForCompany: renderForCompany
  };
});
