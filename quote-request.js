/* Request a quote on a maker profile.
 * Inserts one row into quote_requests with the publishable anon key.
 * Does not email the company. A private SQL trigger marks rows that
 * must not be forwarded. This file does not name those companies.
 */
(function () {
  var CSS = '#tp-quote-open{margin:12px 0 0}'
    + '#tp-quote-dialog{border:1px solid var(--border);border-radius:12px;background:var(--card, #13263a);color:var(--text);padding:18px;max-width:520px;width:calc(100% - 24px);max-height:calc(100vh - 24px);overflow:auto}'
    + '#tp-quote-dialog::backdrop{background:rgba(0,0,0,.55)}'
    + '#tp-quote-dialog h2{margin:0 0 8px;font-size:1.2rem;color:var(--ink)}'
    + '#tp-quote-dialog p{margin:0 0 10px;color:var(--muted);font-size:.88rem;line-height:1.45}'
    + '#tp-quote-dialog label{display:flex;flex-direction:column;gap:4px;font-size:.82rem;font-weight:700;margin:0 0 8px}'
    + '#tp-quote-dialog input,#tp-quote-dialog textarea{width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text)}'
    + '#tp-quote-dialog textarea{min-height:88px;resize:vertical}'
    + '#tp-quote-dialog .tp-quote-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}'
    + '.tp-quote-hp{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}'
    + '#tp-quote-status{margin-top:8px;font-size:.9rem}';

  function profile() {
    var link = document.querySelector('link[rel="canonical"]');
    var href = link ? (link.getAttribute('href') || '') : (location.pathname || '');
    var match = String(href).match(/\/(manufacturers|accessories)\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
    if (!match) return null;
    if (match[1] === 'manufacturers' && !document.querySelector('[data-follow-type="company"]')) return null;
    var h1 = document.querySelector('main h1');
    var name = match[2];
    if (h1) {
      var copy = h1.cloneNode(true);
      var extra = copy.querySelectorAll('.event-badge, button, .follow-btn');
      Array.prototype.forEach.call(extra, function (node) { node.remove(); });
      name = String(copy.textContent || '').replace(/\s+/g, ' ').trim() || name;
    }
    return { kind: match[1], slug: match[2], name: name.slice(0, 160) };
  }

  function validEmail(email) {
    var s = String(email || '').trim();
    if (!s || s.length > 160) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  function clip(value, max, keepLines) {
    var s = String(value || '');
    s = keepLines
      ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
    s = keepLines ? s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/[ \t]+/g, ' ');
    s = s.trim();
    if (!s) return null;
    return s.slice(0, max);
  }

  function readConfig() {
    var cfg = window.TP_SUPABASE;
    if (!cfg || !cfg.url || !cfg.anon) return null;
    return cfg;
  }

  function loadConfig() {
    if (readConfig()) return Promise.resolve(readConfig());
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = '/supabase-config.js';
      s.onload = function () { resolve(readConfig()); };
      s.onerror = function () { resolve(null); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function insertLead(row, cfg) {
    return fetch(String(cfg.url).replace(/\/$/, '') + '/rest/v1/quote_requests', {
      method: 'POST',
      headers: {
        apikey: cfg.anon,
        Authorization: 'Bearer ' + cfg.anon,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    }).then(function (res) { return { ok: !!(res && res.ok) }; }, function () { return { ok: false }; });
  }

  function mount(maker) {
    if (document.getElementById('tp-quote-open')) return;
    var style = document.createElement('style');
    style.id = 'tp-quote-style';
    style.textContent = CSS;
    document.head.appendChild(style);

    var h1 = document.querySelector('main h1');
    var openWrap = document.createElement('p');
    openWrap.className = 'tp-quote-launch';
    var open = document.createElement('button');
    open.type = 'button';
    open.className = 'btn btn-amber';
    open.id = 'tp-quote-open';
    open.setAttribute('data-quote-maker', maker.slug);
    open.textContent = 'Request a quote';
    openWrap.appendChild(open);
    if (h1 && h1.parentNode) h1.parentNode.insertBefore(openWrap, h1.nextSibling);
    else document.querySelector('main').insertBefore(openWrap, document.querySelector('main').firstChild);

    var dialog = document.createElement('dialog');
    dialog.id = 'tp-quote-dialog';
    dialog.innerHTML = ''
      + '<form method="dialog" id="tp-quote-form">'
      + '<h2>Request a quote</h2>'
      + '<p id="tp-quote-intro"></p>'
      + '<div class="tp-quote-hp"><label>Website<input name="bot-field" type="text" tabindex="-1" autocomplete="off"></label></div>'
      + '<label>Name<input name="name" required maxlength="120" autocomplete="name"></label>'
      + '<label>Company<input name="company" maxlength="160" autocomplete="organization"></label>'
      + '<label>Email<input name="email" type="email" required maxlength="160" autocomplete="email" inputmode="email"></label>'
      + '<label>Country<input name="country" maxlength="80" autocomplete="country-name"></label>'
      + '<label>Product / requirement<textarea name="product" required maxlength="1000"></textarea></label>'
      + '<label>Voltage / MVA, if relevant<input name="voltage_mva" maxlength="120"></label>'
      + '<label>Quantity<input name="quantity" maxlength="80"></label>'
      + '<label>Timeline<input name="timeline" maxlength="120"></label>'
      + '<label>Message<textarea name="message" maxlength="2000"></textarea></label>'
      + '<p>TransformerPath stores this request. This form does not email the company. <a href="/privacy.html">Privacy</a>.</p>'
      + '<div class="tp-quote-actions"><button class="btn btn-amber" type="submit">Send request</button><button class="btn btn-outline" type="button" id="tp-quote-cancel">Cancel</button></div>'
      + '<p id="tp-quote-status" role="status"></p>'
      + '</form>';
    document.body.appendChild(dialog);
    dialog.querySelector('#tp-quote-intro').textContent = 'Ask ' + maker.name + ' for a quote. TransformerPath logs the request. Nothing is sent to the company from this form.';

    function showNote(text) {
      var status = dialog.querySelector('#tp-quote-status');
      if (status) status.textContent = text;
    }

    open.addEventListener('click', function () {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    });
    dialog.querySelector('#tp-quote-cancel').addEventListener('click', function () {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    });

    dialog.querySelector('#tp-quote-form').addEventListener('submit', function (event) {
      event.preventDefault();
      var form = event.target;
      var email = form.email.value;
      if (!validEmail(email)) {
        if (form.email.reportValidity) form.email.reportValidity();
        return;
      }
      var buyerName = clip(form.name.value, 120);
      if (!buyerName) {
        if (form.name.setCustomValidity) form.name.setCustomValidity('Enter your name.');
        if (form.name.reportValidity) form.name.reportValidity();
        if (form.name.setCustomValidity) form.name.setCustomValidity('');
        return;
      }
      var product = clip(form.product.value, 1000, true);
      if (!product) {
        if (form.product.reportValidity) form.product.reportValidity();
        return;
      }
      if (form.getAttribute('data-sending') === '1') return;
      form.setAttribute('data-sending', '1');
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      if (clip(form.elements['bot-field'].value, 200)) {
        showNote('Request received. We logged it for TransformerPath. Nothing is sent to the company from this form.');
        form.querySelector('.tp-quote-actions').hidden = true;
        return;
      }
      var row = {
        maker_slug: maker.slug,
        maker_name: clip(maker.name, 160),
        maker_kind: maker.kind,
        name: buyerName,
        company: clip(form.company.value, 160),
        email: String(email).trim(),
        country: clip(form.country.value, 80),
        product: product,
        voltage_mva: clip(form.voltage_mva.value, 120),
        quantity: clip(form.quantity.value, 80),
        timeline: clip(form.timeline.value, 120),
        message: clip(form.message.value, 2000, true),
        page_path: location.pathname
      };
      showNote('Saving your request…');
      loadConfig().then(function (cfg) {
        if (!cfg) return { ok: false };
        return insertLead(row, cfg);
      }).then(function (res) {
        if (!res || !res.ok) {
          form.removeAttribute('data-sending');
          if (submitBtn) submitBtn.disabled = false;
          showNote('We could not save this request. Email hello@transformerpath.com. Nothing was sent to the company.');
          return;
        }
        showNote('Request received. We logged it for TransformerPath. Nothing is sent to the company from this form.');
        form.querySelector('.tp-quote-actions').hidden = true;
      });
    });
  }

  function start() {
    var maker = profile();
    if (!maker) return;
    mount(maker);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
