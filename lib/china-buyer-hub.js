'use strict';

const CSS = `
.cn-buyer{--cn-border:#345167;margin:1.4rem 0 2.2rem;color:var(--ink,#edf6fa);line-height:1.55}
.cn-buyer .cn-shell{background:radial-gradient(ellipse at 95% 0%,#19394a 0%,#112432 43%,#0e202c 100%);color:#edf6fa;border:1px solid #426075;border-radius:18px;padding:clamp(1rem,4vw,2rem)}
.cn-buyer h2.cn-title{margin:.25rem 0 .4rem;color:#f4f9fb;font-size:clamp(1.6rem,4vw,2.3rem);line-height:1.15}
.cn-buyer h3.cn-step-title{margin:0;font-size:1.05rem;color:#f4f9fb;line-height:1.4}
.cn-buyer p,.cn-buyer ul{margin:.45rem 0;color:inherit}
.cn-buyer .cn-kicker{color:#91dccc;font-size:.75rem;font-weight:750;letter-spacing:.09em;text-transform:uppercase}
.cn-buyer .cn-lead{max-width:64ch;color:#cfe1eb}
.cn-buyer .cn-nav{display:flex;flex-wrap:wrap;gap:.4rem .85rem;margin:.75rem 0 1.2rem}
.cn-buyer .cn-nav a,.cn-buyer summary{min-height:44px;display:flex;align-items:center}
.cn-buyer a{color:#aee9da;text-decoration:underline;text-underline-offset:.16em}
.cn-buyer a:focus-visible,.cn-buyer summary:focus-visible{outline:2px solid #fbd779;outline-offset:3px;border-radius:2px}
.cn-buyer .cn-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,16rem),1fr));gap:.7rem;list-style:none;margin:0;padding:0}
.cn-buyer .cn-step,.cn-buyer details{border:1px solid var(--cn-border);border-radius:12px;background:#132a3a;padding:.85rem 1rem;min-width:0}
.cn-buyer .cn-step{display:grid;grid-template-columns:auto minmax(0,1fr);gap:.6rem}
.cn-buyer .cn-count{color:#aee9da;font-weight:750;font-variant-numeric:tabular-nums}
.cn-buyer .cn-step p,.cn-buyer .cn-step li,.cn-buyer details li{font-size:.91rem;color:#dbe8ef}
.cn-buyer ul{padding-left:1.25rem}
.cn-buyer details{margin-top:.8rem;padding-block:.25rem .45rem}
.cn-buyer summary{cursor:pointer;font-weight:750;display:list-item;align-content:center;min-height:44px}
.cn-buyer .cn-pause{margin:1rem 0;color:#fff3d2;background:#312a1c;border-left:4px solid #fbd779;border-radius:8px;padding:.65rem .85rem}
.cn-buyer .cn-note{color:#cfe1eb;margin-top:.9rem;font-size:.86rem}
.cn-buyer [id]{scroll-margin-top:5rem}
`;

function renderStyles() { return '<style>' + CSS + '</style>'; }

function renderHub() {
  return `<section class="cn-buyer" id="china-buyer-guide" aria-labelledby="china-buyer-title">
  <div class="cn-shell">
    <p class="cn-kicker">China market · Transformer procurement</p>
    <h2 class="cn-title" id="china-buyer-title">Buying transformers from China: verify before you pay</h2>
    <p class="cn-lead">Use listings to build a shortlist. Then verify who will build your transformer, whether the reports cover the design you are buying, and what must be checked before you release payment or shipment.</p>
    <nav class="cn-nav" aria-label="China procurement shortcuts">
      <a href="/directory/country/china/">China supplier directory</a>
      <a href="/knowledge/transformer-rfq-specification.html">RFQ specification checklist</a>
      <a href="#china-buying-checks">Buyer verification steps</a>
      <a href="#china-selling">Selling into China</a>
    </nav>
    <ol class="cn-steps" id="china-buying-checks">
      <li class="cn-step"><span class="cn-count" aria-hidden="true">01</span><div><h3 class="cn-step-title">Write one RFQ for all bidders</h3><p>Specify rating, voltages and frequency, vector group, impedance, tap range, insulation levels, cooling, loss guarantees, site conditions, and the required standards and editions. Ask bidders for a signed deviation list.</p><p><a href="/knowledge/how-to-buy-transformer.html">Transformer buying guide</a></p></div></li>
      <li class="cn-step"><span class="cn-count" aria-hidden="true">02</span><div><h3 class="cn-step-title">Verify the seller and factory</h3><p>Record the seller’s legal name, the factory’s legal name and address, and the account beneficiary. If a trading company bids, ask it to document its relationship to the factory and identify who owns the warranty. Verify identities through an independently confirmed channel.</p><p>Ask which stages are done at this site (winding, assembly, drying, testing) and which are outsourced. For a first or critical order, inspect the named production site yourself or through an independent inspector.</p></div></li>
      <li class="cn-step"><span class="cn-count" aria-hidden="true">03</span><div><h3 class="cn-step-title">Check the evidence against your design</h3><p>Request complete reports, not a certificate screenshot. Match the test object, serial or design reference, rating, voltage and insulation levels, cooling and applicable standard. Ask the lab to confirm the report and check its scope for the specific test where accreditation is required.</p><p>Agree what counts as comparable type-test evidence, what special tests the order requires, and which ordered serials will receive routine tests and witnessed FAT.</p><p><a href="/knowledge/transformer-acceptance-testing.html">Acceptance testing guide</a> · <a href="/laboratories.html">Test lab directory</a></p></div></li>
      <li class="cn-step"><span class="cn-count" aria-hidden="true">04</span><div><h3 class="cn-step-title">Check references and factory quality</h3><p>Request recent comparable installations and ask permission to contact the customers. Confirm delivery, commissioning and warranty response through an independently confirmed channel. If a reference cannot be verified, record that gap rather than clearing it.</p><p>Ask for the inspection and test plan, material traceability records, test equipment calibration, and how the factory resolves defects and controls design or material substitutions.</p></div></li>
      <li class="cn-step"><span class="cn-count" aria-hidden="true">05</span><div><h3 class="cn-step-title">Put release conditions in the contract</h3><p>Attach the accepted specification and deviations, test and witness plan, change approvals, warranty, and document requirements. Agree payment milestones and who can release shipment after FAT and written closure of outstanding issues.</p><p>Define site acceptance separately. A factory inspection or passed FAT does not replace site inspection and checks after transport and installation.</p><p><a href="/knowledge/fat-vs-sat.html">FAT versus SAT</a> · <a href="/rfq.html">TransformerPath RFQ</a></p></div></li>
    </ol>
    <p class="cn-pause"><strong>Pause the order</strong> if the beneficiary changes unexpectedly, the factory or reports cannot be verified, or a material deviation remains open. Resolve the issue through a known contact before paying or authorizing shipment.</p>
    <details id="china-selling">
      <summary>Selling into China: check product and buyer requirements</summary>
      <ul>
        <li><strong>CCC applicability:</strong> Check the current mandatory catalogue and implementation rules for the exact model, rated characteristics, and intended use. Confirm which documentation applies before quoting. This guide does not classify any model as required or exempt. <a href="https://www.cnca.gov.cn/hlwfw/ywzl/qzxcprz/" rel="noopener">CNCA: catalogue and implementation rules</a>.</li>
        <li><strong>State Grid / China Southern Power Grid:</strong> Start from the exact procurement notice and lot documents. Check the tender’s bidder eligibility, supplier registration or qualification requirements, required reports, local documentation, deadlines and amendments. A directory profile or registration is not proof of eligibility. <a href="https://www.bidding.csg.cn/" rel="noopener">China Southern Power Grid procurement portal</a>.</li>
      </ul>
      <nav class="cn-nav" aria-label="China public procurement routes"><a href="/utilities/state-grid-corp-of-china-sgcc/">State Grid profile</a><a href="/utilities/china-southern-power-grid-csg/">China Southern Power Grid profile</a><a href="/tenders/country/china/">China transformer tenders</a><a href="/grids/china/">China grid profile</a></nav>
    </details>
    <p class="cn-note">TransformerPath listings are starting points, not endorsements or confirmation of a factory’s suitability. Verify destination-market and purchaser requirements for your exact order.</p>
  </div>
</section>`;
}

module.exports = { renderStyles, renderHub };
