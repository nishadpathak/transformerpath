#!/usr/bin/env node
/* Writes the four free Engineer Track self-study pages.
 * Chrome is copied from the practical-guide shell so the header matches.
 * Run: node scripts/write-engineer-track-modules.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const shell = fs.readFileSync(path.join(ROOT, 'guides', 'factory-acceptance-tests', 'index.html'), 'utf8');
const headerEnd = shell.indexOf('</header>');
const footerStart = shell.indexOf('<footer>');
if (headerEnd < 0 || footerStart < 0) throw new Error('guide shell markers missing');
let header = shell.slice(0, headerEnd + '</header>'.length);
header = header.replace(
  '.guide-wrap ul{margin:8px 0 16px;padding-left:1.2rem}',
  '.guide-wrap ul,.guide-wrap ol{margin:8px 0 16px;padding-left:1.2rem}'
);
const footer = shell.slice(footerStart);

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(mod) {
  const canonical = 'https://transformerpath.com/engineer-track/module-' + mod.n + '.html';
  const head = header
    .replace(/<title>[^<]*<\/title>/, '<title>' + esc(mod.title) + ' | TransformerPath</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + esc(mod.description) + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + esc(mod.title) + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + esc(mod.description) + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">');
  const links = mod.links.map(function (item) {
    return '<li><a href="' + item.href + '">' + esc(item.label) + '</a></li>';
  }).join('\n');
  return head + '\n' +
    '<section class="hero" style="padding:48px 0 28px"><div class="container">' +
    '<p style="margin:0 0 8px"><a href="/engineer-track.html" style="color:var(--accent);font-weight:700">Engineer Track</a></p>' +
    '<h1 style="font-size:2.05rem">' + esc(mod.title) + '</h1>' +
    '<p>' + esc(mod.description) + '</p></div></section>\n' +
    '<main id="main" class="guide-wrap" tabindex="-1">\n' +
    '<p class="guide-note"><strong>Self-study notes.</strong> This page is static reading. It does not ask you to sign in. It does not certify a product, a factory, or a person. Use the edition of each standard named in the contract. Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>\n' +
    mod.body + '\n' +
    '<h2>Continue</h2>\n<ul>\n' + links + '\n</ul>\n' +
    '</main>\n' + footer;
}

const modules = [];

modules.push({
  n: 1,
  title: 'Module 1 — Specification and rating plate',
  description: 'How to read a transformer enquiry, assemble the rating-plate data, check a vector-group symbol, and match a tap changer to its winding. Use the cited edition.',
  links: [
    { href: '/engineer-track/module-2.html', label: 'Module 2 — Factory acceptance testing' },
    { href: '/guides/transformer-inquiry/', label: 'What belongs in a transformer inquiry' },
    { href: '/guides/reading-a-transformer-nameplate/', label: 'How to read a power transformer nameplate' },
    { href: '/guides/vector-group-and-paralleling/', label: 'Vector group, clock number, and paralleling' },
    { href: '/guides/cooling-and-temperature-rise/', label: 'Cooling codes and temperature rise' },
    { href: '/engineer-track.html', label: 'Engineer Track' }
  ],
  body: `
<p>This module is the first of four reading notes. It covers the documents that fix a transformer before any steel is cut: the enquiry, the rating the nameplate will have to carry, the vector group, and the tap changer. Later modules cover factory tests, the checks before the first voltage, and how a dissolved-gas trend is read against a frequency-response baseline. Nothing on these pages is scored, and nothing on them is withheld until another page is finished.</p>
<h2>Read the enquiry before you accept the rating</h2>
<p>A manufacturer cannot design from a system voltage and a power figure alone. IEC 60076-1 is the general requirement for power transformers. IEEE C57.12.00 is the general requirement used for many liquid-immersed units in IEEE practice. The enquiry should name one of those documents, and the edition, as the base, and then list the departures. A sentence that says the unit shall meet IEC and IEEE names neither document. Temperature rise, test code, and tolerances then stay ambiguous.</p>
<p>Write the rated power of each cooling stage, not one number with the fans assumed. A line that says the transformer is 40&nbsp;MVA, with no cooling stage beside it, is incomplete. That 40&nbsp;MVA figure is a power rating. It is not a distribution-transformer class, and IEC 60076-1 does not assign it a standard impedance band. Impedance is a value the enquiry states, at a stated power and a reference temperature, because it sets fault current and voltage regulation.</p>
<p>State the high-voltage, low-voltage, and any tertiary voltages. State the highest voltage for equipment, Um, for each winding. IEC 60076-3 uses Um, not the rated voltage, when insulation levels are selected. State the lightning-impulse withstand, the switching-impulse withstand where that voltage calls for it, and the short-duration power-frequency withstand. If the enquiry wants a standard level, it should say so and name the table. Do not invent a level by scaling from another project.</p>
<p>A 110&nbsp;kV system is normally assigned a highest voltage for equipment of 123&nbsp;kV. In IEC 60076-3:2013 Table 2 the minimum row for that Um is a 450&nbsp;kV lightning impulse, with a 185&nbsp;kV separate-source AC level beside it. If a chopped wave is specified, the chopped level is the one in the same row, not a second full-wave choice. The purchaser may specify a higher standard level. A 650&nbsp;kV lightning impulse is not that 123&nbsp;kV row. It belongs with a higher Um. Use the table in the edition the contract names. IEEE C57.12.00 lists the basic insulation levels for the IEEE voltage class. Do not convert an IEC level into an IEEE level from memory.</p>
<p>State the frequency. A unit designed and tested at 50&nbsp;Hz is not automatically rated at 60&nbsp;Hz. Flux is set by voltage, frequency, and turns. Running a 60&nbsp;Hz design at 50&nbsp;Hz at the same voltage raises the flux and can saturate the core. No-load loss, noise, and temperature rise all move. That is a design question, not a field adjustment.</p>
<p>State the ambient and the altitude. Normal service conditions in IEC 60076-1 and IEC 60076-2 include a cooling-air temperature not above 40&nbsp;°C and an altitude not above 1&nbsp;000&nbsp;m. Above that altitude, external clearances and temperature rise both need the corrections in IEC 60076-2 and IEC 60076-3. If losses are to be capitalized, state the capitalization rates for no-load loss and load loss and the reference temperature. If they are not capitalized, still ask for guaranteed no-load loss, load loss, and total loss. Those guarantees are what the factory test is judged against.</p>
<h2>What the rating plate has to identify</h2>
<p>The nameplate is the manufacturer's statement of the rating the transformer was designed and tested to. It is not a statement of remaining life, and it is not evidence that the unit suits every site. IEC 60076-1 sets out the information a power-transformer nameplate carries. IEEE C57.12.00 does the same job for liquid-immersed distribution, power, and regulating transformers built to IEEE practice. Read the plate against the standard named in the contract.</p>
<p>Record the manufacturer, the works serial number, the year, and the number of phases before you record the power. Those items tie a factory test report, a transport record, and a later oil sample to this tank. Rated power is the continuous power at rated voltage and rated frequency under the cooling method printed next to that power. When the plate shows an ONAN value and a higher ONAF value, each value belongs to the cooling stage beside it. The higher number is not available with the fans stopped.</p>
<p>IEC 60076-2 assigns the four-letter cooling code for a liquid-immersed transformer. The first letter is the internal liquid, the second is how that liquid moves, the third is the external medium, and the fourth is how that medium moves. IEEE C57.12.00 uses its own letter code and its own temperature-rise limits. For a conventional mineral-oil unit, buyers commonly specify a 65&nbsp;K average winding rise and a 60&nbsp;K top-liquid rise under IEC 60076-2, and a 65&nbsp;°C average winding rise with a 65&nbsp;°C top-oil rise under IEEE C57.12.00. Those pairs are not interchangeable. Confirm them in the edition you cite. A plate that only says 65&nbsp;°C rise does not, by itself, name the document.</p>
<p>Rated voltage is the voltage the winding is designed for at rated power. It is not Um, and it is not the lightning-impulse level. Short-circuit impedance is the voltage, as a percent of rated voltage, that circulates rated current with the other winding shorted. It is stated at a stated power and a reference temperature, usually on the principal tapping. For a liquid-immersed transformer whose average winding temperature-rise limit is 65&nbsp;K, IEC 60076-1 uses 75&nbsp;°C as that reference temperature for load loss and for impedance. Confirm the pair in the edition named in the contract. A dry-type transformer follows IEC 60076-11. It does not inherit 75&nbsp;°C.</p>
<p>Load loss is the loss measured in the short-circuit test, at rated current, and then corrected to that reference temperature. No-load loss is measured at rated voltage and rated frequency with the other winding open. Both can be guaranteed. IEC 60076-1 tolerances, unless the contract replaces them, include these for a tested unit: total losses +10&nbsp;percent; no-load loss and load loss each +15&nbsp;percent, provided the total losses stay within +10&nbsp;percent; no-load current +30&nbsp;percent. The tolerance on voltage ratio at the principal tapping is the lower of ±0.5&nbsp;percent of the declared ratio and one tenth of the actual percentage impedance. For a two-winding transformer, the principal-tapping impedance tolerance is ±10&nbsp;percent when the guaranteed impedance is below 10&nbsp;percent, and ±7.5&nbsp;percent when it is 10&nbsp;percent or greater. Other tappings, and transformers with more than two windings, have their own rows in the same table. IEEE tolerances are the IEEE table. Do not mix the two.</p>
<h2>Walk a vector group back to the windings</h2>
<p>An IEC vector-group symbol has three parts. The capital letter is the high-voltage connection. The lowercase letter is the lower-voltage connection. The clock number is the phase displacement. D or d is delta. Y or y is star. Z or z is zigzag. N or n means the neutral of that winding is brought out. A is used for an auto-connected winding. Dyn11 is a delta high-voltage winding, a star low-voltage winding with the neutral brought out, and clock number 11. IEC 60076-1 defines the notation.</p>
<p>The clock number multiplied by 30 degrees is the angle by which the lower-voltage voltage lags the high-voltage voltage. Clock 0 is in phase. Clock 1 is 30 degrees of lag. Clock 11 is 330 degrees of lag, which is the same as 30 degrees of lead. It is not 30 degrees of lag, and it is not "11 times 30 degrees of lead." Dyn11 and YNd1 are not the same displacement. They cannot be substituted because both symbols contain the digit 1.</p>
<p>Dyn11 is the usual distribution symbol because the delta high-voltage winding gives triplen currents a path inside the transformer, and the star low-voltage winding with a brought-out neutral can supply phase-to-neutral loads. A Yyn connection can also present a low-voltage neutral, but without a delta path the neutral current has to be limited or a stabilizing winding has to be added. The enquiry has to say which behaviour is required. IEEE nameplates often show a phasor diagram and an angular displacement in degrees instead of a clock number. Convert one into the other only when you can point to the same two phasors on both drawings.</p>
<p>The displacement comes from how the windings are seated on the core and how the terminals are labelled. Changing it after the windings are built means reterminating, a new ratio test, and a new diagram. Off-circuit links that choose between two groups exist only when the manufacturer provided them and the plate lists both. Two units can share a bus only when the frequency matches, the tap positions make the voltage ratio match, the phase displacement matches on the terminals that will actually be joined, and the percent impedances are close enough for the load share you will accept. The IEC impedance tolerance of a single unit is not automatically tight enough for paralleling. Close the parallel breaker on the test sheet for this serial number, not on the symbol in the enquiry.</p>
<h2>Match the tap changer to a real winding</h2>
<p>Tappings change the turns ratio. A de-energized tap changer is used only with the transformer isolated. An on-load tap changer moves between positions in service, within the range and the step on the plate. IEC 60214-1 is the tap-changer standard. The enquiry is incomplete until it says which winding is tapped, whether the changer operates on load or only off circuit, the number of steps, the step size, and whether rated power is held across the whole range.</p>
<p>IEC 60076-1 distinguishes constant-flux, variable-flux, and combined regulation. In constant-flux regulation the voltage per turn stays constant over the range, so the tapped winding's voltage varies and the current limit can change. In variable-flux regulation the flux varies. If the plate does not say which regime applies, the tapping diagram and the test report must. An on-load changer on a star winding is commonly placed at the neutral end, where the voltage to earth is lower than at the line end. A delta winding has no neutral, so the changer is a line-end or a bridging arrangement. A specification that says only "on-load taps, plus or minus 10 percent on HV" does not yet identify the winding end, the number of positions, or the flux regime. Those three facts decide the insulation of the changer and the current it switches.</p>
<p>The tapping diagram, the nameplate range, and the winding the changer is built into have to describe the same thing. A changer specified for the high-voltage neutral, built instead at a line end, is a different insulation and a different current. Find that mismatch on the diagram, before the active part is finished.</p>
<h2>Check your reading</h2>
<p>The answers follow the questions. This is a reading check, not a gate.</p>
<ol>
<li>In Dyn11, what does 11 mean?</li>
<li>What lightning-impulse level is the IEC 60076-3:2013 Table 2 minimum for Um = 123&nbsp;kV, and is 650&nbsp;kV that row?</li>
<li>Is a 40&nbsp;MVA rating, written with no cooling stage, a complete distribution specification?</li>
<li>Which loss is measured with one winding shorted, at rated current?</li>
<li>Where is an on-load tap changer on a star winding commonly connected, and why does a delta winding differ?</li>
</ol>
<p><strong>Answers.</strong> Clock 11 means the lower-voltage voltage lags the high-voltage voltage by 330 degrees, which is 30 degrees of lead. For Um = 123&nbsp;kV the IEC 60076-3:2013 Table 2 minimum lightning impulse is 450&nbsp;kV, with 185&nbsp;kV as the separate-source AC level in that row. 650&nbsp;kV is not that row. A bare 40&nbsp;MVA line is not a complete specification and it is not a distribution class; the cooling stage and the impedance still have to be stated. Load loss is the short-circuit measurement, corrected to the reference temperature, which is 75&nbsp;°C for the common 65&nbsp;K liquid-immersed case and not for every insulation class. An on-load changer on a star winding is commonly at the neutral end. A delta winding has no neutral, so the changer cannot be specified as a neutral-end device.</p>
`
});

modules.push({
  n: 2,
  title: 'Module 2 — Factory acceptance testing',
  description: 'How routine, type, and special tests are divided in IEC 60076-1, how dielectric tests are ordered, and what an impulse or short-circuit test shows.',
  links: [
    { href: '/engineer-track/module-1.html', label: 'Module 1 — Specification and rating plate' },
    { href: '/engineer-track/module-3.html', label: 'Module 3 — Site checks and energization' },
    { href: '/guides/factory-acceptance-tests/', label: 'Factory acceptance tests to name in the contract' },
    { href: '/guides/frequency-response-analysis/', label: 'Frequency-response traces and winding movement' },
    { href: '/engineer-track.html', label: 'Engineer Track' }
  ],
  body: `
<p>Module 1 fixed the rating, the vector group, and the tap changer. This module is about the factory tests that show whether this serial number meets that rating. The words routine, type, and special are different promises. An invitation that says "full factory tests" does not say which list applies.</p>
<h2>Three lists, not one stamp</h2>
<p>IEC 60076-1 divides tests into routine tests, done on every unit, type tests, done to prove a design, and special tests, done only when the contract asks. IEEE C57.12.00 and the test code IEEE C57.12.90 make the same kind of split. Name the document, then name any test you want on this serial number that the document would otherwise treat as a type test or a special test.</p>
<p>Routine measurements on an IEC unit include winding resistance, voltage ratio and phase displacement, no-load loss and no-load current, load loss and short-circuit impedance, and the dielectric routine tests in IEC 60076-3. Resistance is measured with the oil temperature recorded, because copper resistance changes with temperature, and it is the figure used to correct load loss to the reference temperature from Module 1. Ratio and phase displacement confirm the turns and the vector group on the taps that will be used. A ratio outside the IEC 60076-1 tolerance, or the IEEE limit you named, is a reason not to ship.</p>
<p>No-load loss and no-load current are measured at rated voltage and rated frequency. Load loss and short-circuit impedance are measured with one winding shorted, at rated current, or at a reduced current corrected to rated current by the method in the test code. The report has to show the correction to the reference temperature, not only the raw meter reading. The tolerance table from Module 1 is the contractual reference unless the contract replaced it.</p>
<p>A temperature-rise test, a sound-level test, and a short-circuit withstand test are the items most often assumed to be included and most often not included. Temperature rise is a type test under IEC 60076-2. Sound level under IEC 60076-10 is a type or special test unless the contract makes it routine. Short-circuit withstand under IEC 60076-5 is a special test. A calculation of short-circuit ability is not a test. If you need the test, the contract has to name it.</p>
<h2>Dielectric tests have an order</h2>
<p>IEC 60076-3 covers the separate-source AC test, the induced-voltage test, lightning impulse, and switching impulse where it applies. IEEE C57.12.90 is the corresponding IEEE code. Partial-discharge measurement during the induced test is routine above the voltage threshold in the IEC edition you named. The acceptance level is the level in that edition, or a tighter level the contract wrote down.</p>
<p>IEC 60076-3:2013 sorts the tests by Um. Check Table 1 of the edition in the contract before you treat a sister unit's test as covering this serial number. In that edition, lightning impulse is a type test when Um is 72.5&nbsp;kV or below, and a routine test when Um is above 72.5&nbsp;kV. Above 170&nbsp;kV the chopped-wave lightning impulse is the routine impulse test, and a full-wave test still applies to line terminals at or below 170&nbsp;kV on the same transformer. Switching impulse levels are defined for Um above 72.5&nbsp;kV. Switching impulse is a special test up to 170&nbsp;kV and a routine test above 170&nbsp;kV. A chopped wave on a lower-voltage unit is a special test unless the contract asks for it.</p>
<p>When several dielectric tests are performed on the same unit, IEC 60076-3:2013 puts them in this order: lightning-impulse tests; switching impulse; the separate-source applied-voltage test; the line-terminal AC withstand test, when that test applies; the induced-voltage withstand test; and the induced-voltage test with partial-discharge measurement. By agreement, switching impulse may be done before lightning impulse. When the partial-discharge induced test is performed, it is last. Temperature rise is not in that sequence. It is a thermal type test under IEC 60076-2. Short-circuit withstand is not in that sequence. It is a special test under IEC 60076-5. A list that runs temperature rise, then impulse, then short circuit is not the dielectric order.</p>
<h2>What to watch on an impulse test</h2>
<p>A witness does not repeat the measurement. A witness checks that the transformer on the floor is the serial number in the contract, that the tap is the tap in the procedure, that the instruments are in calibration, and that the connection matches the diagram. For a lightning-impulse test, the witness checks that the crest voltage and the waveform meet IEC 60076-3 or IEEE C57.12.90, and that a comparison between the reduced wave and the full wave was kept.</p>
<p>The comparison is the discriminator. A collapse, a growing difference between the reduced-wave and full-wave current oscillograms, or a chop that was not specified, is the thing to stop on. A single "pass" stamp without the oscillograms is not a record you can defend later. Each line terminal is tested in the connection the standard requires, with the tap position recorded. The neutral, if it is brought out and the insulation level applies to it, is a separate test. Do not treat a test on one phase as a test of the other two unless the procedure says the connection covers them.</p>
<h2>What to watch on a short-circuit test</h2>
<p>IEC 60076-5 is the withstand standard. The test, when the contract requires it, demonstrates the ability to withstand the dynamic effects of short circuit. The current is set from the measured impedance, not from a catalogue percent. The test includes the asymmetrical peak, which depends on the instant of closure and on the ratio of reactance to resistance. The laboratory record should show the current traces, the tap, and the number of tests the standard or the contract requires.</p>
<p>After the shots, the short-circuit reactance is measured again. IEC 60076-5 limits how far that reactance may move, and the limit depends on the winding shape. Use the limit in the edition you named. Do not substitute a single percent remembered from a slide. The other evidence is the visual and diagnostic checks the standard names, which can include an inspection of the active part and, for a liquid-filled unit, a look at the oil. A unit that still has the right ratio and the right reactance change can still have displaced clamping. The standard's pass criteria are the criteria. A quiet test bay is not one of them.</p>
<h2>Leave with records the site can open</h2>
<p>The report should contain the serial number, the standards, the measured values, the guarantees, the corrections, the calibration status the quality system requires, and the connection diagram for the dielectric tests. A one-page pass stamp without numbers cannot be compared with site results.</p>
<p>Ask for a frequency-response measurement to IEC 60076-18 on the taps and the connections the site will repeat, as an electronic record and not only as a picture. IEEE C57.149 is the guide used to compare those traces. The factory trace is the baseline for Module 3. A trace taken for the first time after a transport incident has no baseline. On-load tap-changer operation across the range, the ratio and polarity of bushing current transformers, and the rotation of cooler fans belong on the factory schedule as well. They are a common source of delay on site when they were skipped. Liquid filled at the factory should meet the unused-liquid specification: mineral oil to IEC 60296, natural ester to IEC 62770, or synthetic ester to IEC 61099. Breakdown voltage is measured by IEC 60156.</p>
<p>Read the report against the guarantees before the unit is released for transport. A loss overrun, an impedance outside tolerance, or a dielectric test that was repeated after a repair needs a written disposition. The report should say what was corrected. Copy the frequency-response file and the ratio sheet in a format the site instrument can open.</p>
<h2>Check your reading</h2>
<ol>
<li>Is a short-circuit withstand test a routine test under IEC 60076-1?</li>
<li>What is the dielectric order in IEC 60076-3:2013 when several of those tests are done on one unit, and which of them is last when partial discharge is measured?</li>
<li>What makes an impulse record usable after you leave the factory?</li>
<li>Why does the short-circuit current have to be calculated from the measured impedance?</li>
<li>Which document defines the frequency-response measurement you need before shipment?</li>
</ol>
<p><strong>Answers.</strong> Short-circuit withstand is a special test under IEC 60076-5, not a routine test. The dielectric order is lightning impulse, then switching impulse, then the applied-voltage test, then the line-terminal AC test when it applies, then the induced-voltage withstand test, then the induced test with partial-discharge measurement. That last test stays last. Switching impulse may be moved ahead of lightning impulse by agreement. Temperature rise and short circuit are outside that order. An impulse record needs the crest, the waveform, and the comparison of reduced and full waves, tied to the serial number and the tap. The test current comes from the measured impedance because the catalogue percent is not the tested value. The measurement standard for the baseline trace is IEC 60076-18.</p>
`
});

modules.push({
  n: 3,
  title: 'Module 3 — Site checks and energization',
  description: 'The order of checks after transport and before the first voltage: identity, liquid, a frequency-response baseline, bushings, protection, then energization.',
  links: [
    { href: '/engineer-track/module-2.html', label: 'Module 2 — Factory acceptance testing' },
    { href: '/engineer-track/module-4.html', label: 'Module 4 — Field failure diagnostics' },
    { href: '/guides/site-tests-before-energization/', label: 'Site tests before first energization' },
    { href: '/guides/frequency-response-analysis/', label: 'Frequency-response traces and winding movement' },
    { href: '/guides/insulating-liquid-acceptance/', label: 'Accepting new and in-service insulating liquid' },
    { href: '/engineer-track.html', label: 'Engineer Track' }
  ],
  body: `
<p>A transformer that passed its factory tests can be damaged, wet, or misconnected on the way to site. Module 2 is the factory record. This module is the comparison of this serial number with that record, and the order of work before the first voltage. IEEE C57.152 is the IEEE guide for diagnostic field testing. IEEE C57.93 covers installation and maintenance practice. IEC practice uses the same measurements, with IEC 60076-1 and IEC 60076-18 as the reference for ratio, resistance, and frequency response. Name those documents in the procedure so the acceptance limits are the ones already agreed.</p>
<p>Do not apply voltage to see whether the unit is fine and then treat a successful energization as a substitute for the tests. A unit can pick up for a short time with a wrong tap, a reversed current transformer, or a wet bushing. The damage shows up as a trip, a circulating current, or a failure on the first through-fault.</p>
<h2>Identity and the mechanical setup come first</h2>
<p>Confirm the serial number against the routine-test report and the nameplate from Module 1. Confirm the impact-recorder record and the transport locks. A recorder event above the limit the manufacturer set is a reason to stop and inspect, not a reason to hurry the electrical tests. Confirm the liquid level, the breather, and that the valves between the tank, the conservator, and the coolers are in the position the drawing requires. A closed valve at the gas-operated relay leaves the unit unprotected while the rest of the checks look normal.</p>
<p>Confirm that fans and pumps, where they are fitted, rotate in the marked direction and that their alarms function. Confirm the earthing of the tank, the core if a separate core earth is brought out, and the neutral connection the protection study requires. A core earth left open, or a second accidental core earth, is checked by the core-to-tank insulation test the manufacturer specified. Repeat it if the manual says it is a site test. Do not invent a megohm limit for it. The factory figure is the comparison.</p>
<h2>Liquid, then the electrical fingerprint</h2>
<p>Fill and process the liquid to the contract before the dielectric conclusions are drawn. Unused mineral oil is specified in IEC 60296. Natural ester is IEC 62770. Synthetic ester is IEC 61099. After filling, let the unit stand for the time the manufacturer requires so the sample represents the liquid in the tank rather than the bottom of a hose. Breakdown voltage is measured by IEC 60156. IEC 60422 and IEEE C57.106 give acceptance guidance by voltage class. Use the row for this Um. A limit copied from a distribution unit is the wrong row for an extra-high-voltage unit. An ester is not mineral oil. Do not paste a mineral-oil limit onto an ester report.</p>
<p>Then measure voltage ratio on the tap the unit will be energized on, and on the other taps the procedure lists. Compare with the factory values for this serial number. IEC 60076-1 tolerances are the reference unless the site procedure tightens them. Measure winding resistance and compare the pattern, corrected to the same temperature as the factory sheet, or compare phase to phase. A single high phase can be a joint or a tap-changer contact. Confirm the vector group the same way the factory did. Terminal marking errors are still found at this step on units that were correct in the factory, because bushing leads are removed for transport.</p>
<p>Insulation resistance and polarization index are comparisons with the factory figure and between phases, corrected for temperature as far as the procedure allows. There is no single megohm value that means pass for every rating and every temperature. IEEE C57.152 discusses how to use the measurement. A value that collapses against the factory figure is a reason to investigate moisture, a bushing, or contamination before voltage is applied.</p>
<h2>Bushings and the frequency-response baseline</h2>
<p>Bushing capacitance and dissipation factor, sometimes called power factor, are compared with the bushing nameplate and with the factory reading. IEC 60137 covers bushings. The IEEE field context is IEEE C57.152. A large change in capacitance after transport points at that bushing, often a shorted layer in a condenser bushing. Do not add the bushing result to the winding result and call the sum a winding test. They are separate insulation systems. Investigate a change against the limit in the procedure. Do not substitute a percent remembered from a different apparatus.</p>
<p>Repeat the frequency-response measurement on the same taps and the same connections as the factory baseline taken under IEC 60076-18. Compare the traces with IEEE C57.149 and with the manufacturer's comparison. IEC 60076-18 defines the measurement so that someone else can repeat it: connections, taps, frequency range, and the record of the setup. The useful configurations include end-to-end open-circuit, end-to-end short-circuit, and the inter-winding measurements the standard names. A different connection from the baseline makes a difference that looks like damage and is only a setup error.</p>
<p>There is no single decibel limit that means the winding has moved on every design. The guides associate parts of the trace with the core, the windings, and the connections. Read the band in the guide you named. Oil level, tap position, and whether the unit is filled all change the trace. A comparison between a drained factory trace and an oil-filled site trace, without the allowance in IEC 60076-18, is not valid. A trace with no factory baseline is still worth keeping. It cannot prove that the road did nothing. Ratio can stay inside tolerance when a winding has moved, because ratio depends on turns. A normal ratio does not clear a bad frequency-response comparison, and a normal frequency-response comparison does not clear a wrong ratio. Do the set.</p>
<h2>Protection before voltage</h2>
<p>Prove the gas-operated relay, the pressure-relief device, the winding and liquid temperature indicators, and the sudden-pressure device. A device that the drawing says should trip has to trip the breaker it is wired to. A device that should only alarm must not be found to trip. Prove current-transformer ratio and polarity into the relay, not only at the marshalling box. A reversed current transformer on a differential scheme trips on load or, worse, restrains during a fault. Operate the on-load tap changer through its range with the transformer isolated, and confirm the position indication matches the mechanism. These checks use the factory results from Module 2 as the comparison, not as a reason to skip the site check. Leads are disturbed in transport.</p>
<h2>The first energization</h2>
<p>Apply voltage with the secondary open unless the system study says otherwise. The usual case is no-load from one side, for long enough to listen, to watch the current, and to confirm the voltage with the system voltages. Magnetizing inrush on the first closure can be several times rated current and can decay over seconds. Differential protection has to be able to ride through that inrush by the method in the protection scheme, usually a harmonic restraint or an equivalent setting. Inrush is not, by itself, a failure. A large unbalance that does not decay, or a loud internal noise, is a reason to switch off.</p>
<p>No-load current should be in the order of the factory no-load current, allowing for the actual system voltage. Load is applied after the no-load check, the protection check, and the cooler check. Record the tap, the liquid temperature, and the time. That record is the start of the operating history the dissolved-gas samples in Module 4 will be compared with. File the ratio sheet, the resistance sheet, the bushing readings, the frequency-response overlay, the liquid results, and the protection-trip checks with the factory report before the first load.</p>
<h2>Check your reading</h2>
<ol>
<li>Why is a successful first energization not a substitute for the site tests?</li>
<li>What is the frequency-response baseline compared against?</li>
<li>Why is a normal ratio not enough to accept the unit after transport?</li>
<li>What has to be proved about a current transformer before the unit is energized?</li>
<li>What should you expect the current to do at the moment of first closure?</li>
</ol>
<p><strong>Answers.</strong> A unit can pick up with a wrong tap, a reversed current transformer, or a wet bushing and still run briefly. The frequency-response comparison is this serial number against its own IEC 60076-18 factory trace, taken with the same connections and the same tap. Ratio checks turns. Winding movement can change the frequency-response trace while the ratio stays inside tolerance, so both results are required. Current-transformer ratio and polarity have to be proved at the relay, and the trip path of each protective device has to match the drawing. The first closure can draw a magnetizing inrush of several times rated current, decaying over seconds. A current that stays unbalanced is a different event.</p>
`
});

modules.push({
  n: 4,
  title: 'Module 4 — Field failure diagnostics',
  description: 'How to read a dissolved-gas trend, compare a new frequency-response trace with the site baseline, and choose re-energizing, a site repair, or a factory return.',
  links: [
    { href: '/engineer-track/module-3.html', label: 'Module 3 — Site checks and energization' },
    { href: '/guides/dissolved-gas-analysis/', label: 'How to read a dissolved-gas result' },
    { href: '/guides/frequency-response-analysis/', label: 'Frequency-response traces and winding movement' },
    { href: '/guides/site-tests-before-energization/', label: 'Site tests before first energization' },
    { href: '/engineer-track.html', label: 'Engineer Track' }
  ],
  body: `
<p>Module 3 ends when the unit is in service and the first records are filed. This module is how those records are used after something changes: a gas alarm, a through-fault, a strange noise, or a trace that no longer matches. The decision at the end is one of three practical outcomes. Return the unit to service. Repair it where it stands. Or return it to a factory or a workshop that can dry it and test it again. The notes below are a way to assemble the evidence. They are not a rule that replaces the procedure or the manufacturer, with the records in front of them.</p>
<h2>One dissolved-gas sample is not a diagnosis</h2>
<p>Dissolved-gas analysis measures gases dissolved in the insulating liquid. IEC 60599 is the IEC guide to interpreting dissolved and free gases. IEEE C57.104 is the IEEE guide for gases generated in mineral-oil-immersed transformers. Both expect a history. A single report, read against a limit remembered from an older edition, is not the method in either guide.</p>
<p>Identify the sample before you read the numbers. Serial number, date, sampling point, whether the unit was on load, and whether a known event came first: a through-fault, a tap-changer operation, a trip, or oil handling. A sample from the wrong valve answers a different question. Free gas from a gas-operated relay is not the same specimen as gas dissolved in the bulk oil. An on-load tap changer that interrupts current in oil, in its own compartment, produces gases that must not be read as if they came from the main tank. Confirm which compartment was sampled.</p>
<p>The qualitative picture in both guides is stable enough to learn, and too coarse to name a failed part. Hydrogen is associated with partial discharge and with other low-energy electrical activity, and it can also rise from stray gassing that is not an active fault. Methane and ethane are associated with lower-temperature thermal faults in the oil. Ethylene becomes more prominent as the temperature of a thermal fault rises. Acetylene is associated with arcing and with temperatures high enough to take seriously even at a low concentration. Carbon monoxide and carbon dioxide are associated with cellulose, not only with a fault in the oil, and they also rise with normal aging. Oxygen and nitrogen say something about leaks and about how the sample was handled. They are not fault gases in the same sense.</p>
<p>Acetylene means a high-temperature event has occurred in the liquid that was sampled. It does not, by itself, name the lead, the changer, or the winding. IEEE C57.104 was revised so that interpretation uses status, rates of change, and the combination of gases, rather than one table of parts per million applied to every unit. IEC 60599 uses ratios and typical values, and it says when a ratio is meaningful. Do not apply a ratio when the concentrations are too low for it to mean anything. Do not copy a parts-per-million threshold from an old slide into a specification. If a contractual attention level is required, cite the edition and the table or the status definition in that edition. Levels have changed between editions.</p>
<p>A result that is stable over several samples is a different situation from the same number reached in a week. A unit just energized after a dry-out can show a rise that then flattens. A unit that shows acetylene after a relay trip needs the electrical investigation as well as another sample. The second sample checks that the first was not contaminated, and it starts the rate. A satisfactory gas result does not measure moisture, acidity, or breakdown voltage. Those are IEC 60422 and IEEE C57.106. It does not measure winding movement. That is the frequency-response comparison. Natural and synthetic esters are not mineral oil. Do not paste a mineral-oil limit onto an ester report.</p>
<h2>Compare the new trace with the baseline</h2>
<p>The baseline is the factory trace from Module 2, confirmed on site in Module 3, taken to IEC 60076-18. The new trace has to use the same connections, the same tap, and a comparable liquid fill. IEEE C57.149 is the interpretation guide. A difference is investigated. It is not, by itself, a decision to scrap the unit, and a trace that still overlays the baseline is not, by itself, a decision to energize.</p>
<p>Read the frequency bands in the guide you named rather than from memory. The low-frequency end of an open-circuit trace is sensitive to the core. The middle of the trace is where bulk winding movement usually appears. The high-frequency end is sensitive to leads, bushing connections, and tap leads, and also to how the test leads were draped. Repeat the setup before you repeat the alarm. Ratio, winding resistance, and excitation current answer different questions and belong in the same file. A shorted turn moves ratio. A poor contact moves resistance. Bulk movement can move the frequency-response trace while ratio stays inside tolerance.</p>
<p>After a through-fault, protection records say how large the current was and how long it lasted. IEC 60076-5 is about withstand at the design stage. It is not a field tool for deciding that this particular fault was harmless. If the current was within the nameplate withstand and the traces, the ratio, and the resistance match the baseline, the usual course is to return the unit to service and to plan the next oil sample. If the traces have changed in the winding band, the usual course is to keep the unit isolated and investigate. Those are usual courses. They are not a requirement that overrides the procedure.</p>
<h2>Three outcomes, and the evidence each one needs</h2>
<p>Re-energizing is the outcome when the identity is certain, the new dissolved-gas sample is explained by the history, acetylene is absent or is explained by the compartment that was actually sampled, the frequency-response overlay matches the baseline in the bands the guide treats as the winding, ratio and resistance match, and the protective devices that tripped have been proved. Record the tap, the temperatures, and the time, as in Module 3. Plan the next sample close enough to see whether the rate flattens.</p>
<p>A repair where the unit stands is the outcome when the evidence points at a part that can be replaced or repaired without opening the winding assembly: a bushing whose capacitance has moved, a cooler valve, a current transformer, a tap-changer mechanism, or a lead that the resistance test and the high-frequency end of the trace both point at. The repair is confirmed by repeating the tests that found it. A bushing change is confirmed by a new capacitance reading and a new frequency-response trace, because the bushing is part of the circuit that was measured. Do not return the unit to service on the strength of the replacement alone.</p>
<p>A return to a factory, or to a workshop that can dry the insulation and repeat dielectric tests, is the outcome when the evidence points inside the winding assembly and the site cannot restore it. Examples are acetylene in a sample that is confirmed to be from the main tank, a frequency-response change in the winding band that a repeated measurement still shows, a ratio error, or a reactance change of the kind IEC 60076-5 treats as damage, together with a fault current that was large. Internal inspection, vapour-phase or other drying, and a new set of factory tests are then the work. A site crew that cannot do those tests should not be asked to "try voltage and see."</p>
<p>Online gas monitors are useful for rate. They are not automatically equivalent to a laboratory chromatograph. When a monitor alarms, the usual next step is a laboratory sample from a known point, read with the history. Keep the reports. A file with several samples is interpretable. A file with one highlighted cell is not.</p>
<h2>Check your reading</h2>
<ol>
<li>Why is a single dissolved-gas report not a diagnosis under IEC 60599 or IEEE C57.104?</li>
<li>What must you confirm before you treat acetylene as a main-tank event?</li>
<li>What has to match before a new frequency-response trace can be compared with the baseline?</li>
<li>Which result can stay normal while the winding has still moved?</li>
<li>What extra check follows a bushing replacement before the unit is energized?</li>
</ol>
<p><strong>Answers.</strong> Both guides interpret history, rates, and the combination of gases. One row of numbers has no rate. Acetylene has to be tied to the compartment that was sampled, because an oil-switching tap changer in its own compartment produces gas that is not the main tank. The new trace needs the same connections, the same tap, and a comparable fill, measured so that IEC 60076-18 and IEEE C57.149 can be applied. Voltage ratio can remain inside tolerance when the frequency-response trace has changed, because ratio depends on turns. After a bushing change, measure the new capacitance and take a new frequency-response trace. The old overlay no longer describes the circuit.</p>
`
});

const outDir = path.join(ROOT, 'engineer-track');
fs.mkdirSync(outDir, { recursive: true });
modules.forEach(function (mod) {
  const file = path.join(outDir, 'module-' + mod.n + '.html');
  fs.writeFileSync(file, page(mod));
  const text = fs.readFileSync(file, 'utf8').replace(/<[^>]+>/g, ' ');
  const words = text.match(/[A-Za-z0-9'’%°+-]+/g) || [];
  console.log('module-' + mod.n + '.html words~' + words.length);
});
