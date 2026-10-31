#!/usr/bin/env node
/* Public module 1 for every /learn course.
 * The Learning Payment Link is read from lib/paid-listings.js and is not
 * rewritten here. Run: node scripts/write-learn-free-modules.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { PAYMENT_LINKS } = require('../lib/paid-listings');

const ROOT = path.join(__dirname, '..');
const CHECKOUT = PAYMENT_LINKS.learning.url;
const EXPECTED = 'https://buy.stripe.com/8x27sE3pS4dfak8c1AfYY0p';
if (CHECKOUT !== EXPECTED) {
  throw new Error('Learning checkout is not the existing Payment Link');
}

const BRAND = ' | TransformerPath';

function fitDescription(lead) {
  let s = String(lead).replace(/\s+/g, ' ').trim();
  if (!/[.]$/.test(s)) s += '.';
  if (s.length > 160) {
    s = s.slice(0, 157).replace(/\s+\S*$/, '').replace(/[,:;]+$/, '') + '.';
  }
  const pads = [
    ' Module 1 is free to read.',
    ' Later modules stay on the paid plan.',
    ' Published by TransformerPath.',
    ' Module 1 is free.',
    ' Free to read.'
  ];
  pads.forEach(function (pad) {
    if (s.length >= 140) return;
    if (s.length + pad.length <= 160) s += pad;
  });
  if (s.length < 140 || s.length > 160 || !/[.]$/.test(s)) {
    throw new Error('description length ' + s.length + ' for: ' + s);
  }
  return s;
}

function p(text) { return '<p>' + text + '</p>\n'; }
function h2(text) { return '<h2>' + text + '</h2>\n'; }
function ul(items) {
  return '<ul>\n' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('\n') + '\n</ul>\n';
}

const COURSES = [
  {
    id: 'design',
    volume: null,
    h1: 'Module 1 — How a transformer works',
    lead: 'How a transformer works: mutual induction, the induced-voltage equation, ideal and real behaviour, and the rating inputs that drive the later modules.',
    body: [
      p('A transformer moves power between two circuits by a changing magnetic field. It does not create energy, and it does not, in the ideal picture, change frequency. Two or more windings share a core. Alternating current in one winding produces alternating flux. That flux links the other winding and induces a voltage. The course that follows this module is the design sequence: core, windings, insulation, cooling, losses, and the tests that show whether the finished unit matches the rating. This module is only the behaviour those later choices have to serve.'),
      h2('Mutual induction, stated without a design'),
      p('The primary winding is the one that receives power from the source. The secondary is the one that delivers power to the load. Those names describe the direction of power in a two-winding unit. They are not a statement that one winding is always the high-voltage winding. A generator step-up transformer takes a lower voltage from the machine and delivers a higher voltage to the line. The induced voltage in a winding is set by how fast the flux changes and by how many turns link that flux.'),
      p('For a sinusoidal flux, the root-mean-square voltage induced in a winding is written E = 4.44 · f · N · B · A. Here f is frequency in hertz, N is the number of turns, B is the peak flux density, and A is the net core area that carries the flux. The factor 4.44 is the root-mean-square value of a sine wave’s derivative, √2 · π, rounded. It is not a tolerance, and it is not a value taken from a purchaser’s specification. If the flux is not sinusoidal, the 4.44 factor does not apply as written. Harmonic voltage and a core pushed into saturation both move the flux away from that clean sine.'),
      p('An ideal transformer has no resistance, no leakage flux, and no magnetising current. Under that fiction the voltage ratio equals the turns ratio, and the currents are in the inverse ratio, so the power in equals the power out. A real transformer spends some of the voltage on winding resistance and on leakage reactance. It draws a magnetising current even with the secondary open. The core dissipates no-load loss as heat. Those four departures are why a nameplate rating is not the same thing as the ideal equation, and why a later module has to size copper, steel, and cooling instead of stopping at the turns ratio.'),
      h2('The rating inputs this course keeps in view'),
      p('Four inputs drive everything downstream. Rated power, in kilovolt-amperes, is the continuous throughput the cooling on the nameplate can support at rated voltage and rated frequency. It is not a measure of efficiency, and it is not a short-circuit rating. The voltage ratio states the rated voltages of the windings. Frequency is part of the rating because flux depends on voltage, frequency, and turns together. A unit wound and tested at one frequency is not automatically rated at the other. Phases fix whether the currents and voltages in the equation are line quantities or winding quantities. On a three-phase unit, line current and winding current differ when the winding is connected in delta, and line voltage and winding voltage differ when it is connected in star.'),
      p('IEC 60076-1 is the general requirement used for power transformers in IEC practice. IEEE C57.12.00 is the general requirement used for many liquid-immersed distribution, power, and regulating transformers in IEEE practice. This module names those documents. It does not assign a clause, a table, or a tolerance. The edition in the contract is the one that later modules and the factory test are judged against. A sentence that says the unit shall meet both families, without naming an edition, has not yet chosen a rule for temperature rise, insulation level, or loss tolerance.'),
      ul([
        'Rated power belongs to a cooling stage. A second power on the same plate belongs to the fans or pumps printed beside it.',
        'Rated voltage and frequency together set the flux. Changing one and not the other changes the core duty.',
        'The ideal turns ratio is the start of a design, not the guarantee. Resistance, leakage, magnetising current, and core loss are still to come.',
        'Line and winding quantities are not interchangeable. The connection decides which voltage and which current the conductor sees.'
      ]),
      p('Later modules size the core, the windings, the insulation, and the cooling, and they work a numerical example. Those pages stay on the paid plan. Nothing in this module is a design you can issue, and nothing in it replaces the edition named in the contract.')
    ].join('')
  },
  {
    id: 'volume-0',
    volume: 0,
    h1: 'Module 1 — Magnetic circuit basics',
    lead: 'The closed magnetic circuit every later volume assumes: magnetomotive force, reluctance, flux, and why the core is not an optional shell.',
    body: [
      p('Volume 0 is the physics the rest of the series treats as already known. This module is that physics in one sitting: a magnetic circuit, why it is closed, and what happens when the steel can no longer carry more flux. It is not a core-design calculation. Stacking factor, grade, and a chosen flux density belong to a later, paid module.'),
      h2('A core is a magnetic conductor'),
      p('Magnetomotive force is the ampere-turns that push flux around a path. Reluctance is the opposition that path offers. Flux is what results. The relationship has the same shape as a simple electric circuit: a push, an opposition, and a flow. The useful difference is that flux does not disappear at the end of a wire. It has to close. If the core is open, the return path is air, and air has a much higher reluctance than grain-oriented steel. Almost all of the magnetomotive force is then spent on the air path, the flux collapses, and the secondary voltage collapses with it.'),
      p('That is why a transformer core is a loop: a limb under each wound phase, yokes that join the limbs, and, on some large units, extra return limbs. The steel is there to carry flux at a flux density the material can support, with a magnetising current the no-load loss and the noise can live with. The tank, the oil, and the windings do not do that job. A drawing that shows windings and no closed steel path is not yet a transformer.'),
      h2('Saturation is a property of the steel, not a setting'),
      p('As magnetising force rises, flux density rises, and then it stops rising in proportion. That knee is saturation. Past it, more magnetising current buys very little extra flux, the current waveform distorts, and the no-load loss and the noise climb. The induced-voltage equation in the design course still holds only for the flux that actually exists. Pushing voltage up, or frequency down, at a fixed turns count drives the core toward that knee. The designer’s answer is a larger core area, more turns, or a lower voltage — not a hope that the steel will accept more flux than its grade allows.'),
      p('Different grades saturate at different densities, and a manufacturer’s curve is the record of that grade. This module does not quote a density and does not pick a design value. The paid core module states the band this course uses and why it sits below saturation. What you should take from this page is the direction: flux is not free, the path must close, and a rating that ignores frequency is a rating that has not yet looked at the steel.'),
      ul([
        'Flux closes. An open magnetic path puts the return in air and starves the secondary.',
        'Ampere-turns push. Reluctance opposes. The steel exists to keep that reluctance low.',
        'Saturation bends the flux-current curve. Extra magnetising current is then mostly heat and noise.',
        'Voltage, frequency, and turns move together. A frequency change at the same voltage is a flux change.'
      ]),
      p('The matching volume page lists titles and outcomes only. It is not this lesson, and it is not a reprint of a book. Later modules of the course stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-1',
    volume: 1,
    h1: 'Module 1 — Specification to service',
    lead: 'The path from an enquiry to a unit in service: which decision is made in the specification, which in the works, and which only after the first voltage.',
    body: [
      p('Volume 1 is the practical path from specification to service. This module is the map of that path. It does not design a transformer, and it does not fill in a test sheet. It says, in order, where a decision has to be made if the unit that arrives is to be the unit that was bought.'),
      h2('The enquiry fixes more than a power and a voltage'),
      p('A manufacturer cannot cut steel from a system voltage and a kilovolt-ampere figure alone. The enquiry has to name the base standard and the edition, then list the departures. Rated power belongs beside a cooling stage. Impedance is a value the enquiry states, because it sets fault current and voltage regulation. Voltages, the highest voltage for equipment, insulation levels, frequency, ambient, and altitude are all rating decisions. If losses are capitalised, the rates are part of the enquiry. If they are not, the guaranteed no-load loss and load loss still have to be asked for, because the factory test is judged against those guarantees.'),
      p('A sentence that says the unit shall comply with IEC and IEEE names neither document. Temperature rise, test code, and tolerances then stay ambiguous. Two honest practices exist. IEC 60076-1 is the general requirement in IEC practice. IEEE C57.12.00 is the general requirement for many liquid-immersed units in IEEE practice. Pick the edition the contract will use. Do not convert one family’s numbers into the other from memory.'),
      h2('What is decided later, and cannot be assumed now'),
      p('Design turns the enquiry into steel, copper or aluminium, insulation, and a tank. The works then does things that a drawing cannot undo: the core joint, the winding tension, the dry-out, the oil fill. Factory tests show whether this serial number meets the rating. Site tests show whether transport and assembly left that result intact. Only then does the unit take voltage. Each of those steps has its own module later in the course. Skipping one and hoping the next step will catch it is how a wrong vector group, a closed cooler valve, or a missing loss guarantee reaches service.'),
      ul([
        'Name one base standard and its edition. List departures. Do not cite two families as if they were one.',
        'Put a cooling stage next to every rated power. The higher number is not available with the fans stopped.',
        'State impedance, frequency, and insulation levels. They are not implied by the voltage ratio.',
        'Keep the factory result and the site result as two records. Transport sits between them.'
      ]),
      p('The volume page for this book lists titles and outcomes only. The worked design, the test lists, and the site checks stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-2',
    volume: 2,
    h1: 'Module 1 — Power transformer scope',
    lead: 'What changes when the unit is a power transformer rather than a distribution unit: voltage, taps on load, cooling stages, and transport.',
    body: [
      p('Volume 2 is large two-winding and generator step-up practice. This module says what that change of scale actually changes. It is not a worked high-voltage design, and it does not size a 500 MVA unit. That numerical work stays on the paid plan.'),
      h2('Power is not a larger copy of distribution'),
      p('A distribution transformer and a power transformer can share the same induced-voltage equation and still be different machines. The power unit is asked to live at a higher voltage for equipment, so lightning impulse and, at the higher levels, switching impulse become design drivers rather than a line copied from a catalogue. The tap changer, when it operates under load, is a switching device inside the rating, not a link that is moved only with the unit isolated. Cooling is often more than one stage: a self-cooled rating and a higher rating that exists only when fans or pumps run. Each stage needs its own power on the plate and its own thermal check.'),
      p('Mass and size stop being a trucking detail. Transport limits, impact recorders, and whether the unit ships full of oil or under a dry gas are part of the design, because a bushing, a conservator, or an on-load tap changer that cannot travel with the tank has to come off and go back on at site. That second assembly is a manufacturing step performed by people who did not build the active part. The site module treats it that way. This module only flags that the power unit usually has one.'),
      h2('What the enquiry has to add'),
      p('State the insulation levels against the highest voltage for equipment, not against a nominal system voltage you remember. State whether the tap changer is on load or off circuit, which winding it sits on, and whether rated power holds across the range. State the cooling stages as separate powers. State the impedance at a stated power and a reference temperature. A single percent written with no power beside it cannot be checked on test.'),
      ul([
        'Impulse duty grows with voltage class. Do not copy a distribution insulation list onto a transmission unit.',
        'An on-load tap changer is in the rating. The step, the range, and the winding end are part of the enquiry.',
        'Two cooling stages are two ratings. The fans are not a silent upgrade of the self-cooled number.',
        'Transport and site assembly are in the scope. A power unit often arrives in more than one piece.'
      ]),
      p('The 500 MVA worked example and the power-mode calculator stay on the paid plan. This page is the scope, not the design.')
    ].join('')
  },
  {
    id: 'volume-3',
    volume: 3,
    h1: 'Module 1 — Factory test promises',
    lead: 'Routine, type, and special tests are different promises. This module says what each word commits the factory to show before a unit ships.',
    body: [
      p('Volume 3 is factory testing, from the measurements made on every unit to the investigations made when a design is new. This module separates three words that invitations like to blur: routine, type, and special. It does not write a test plan for a serial number. That plan stays on the paid plan, judged against the edition the contract names.'),
      h2('Three lists, not one phrase'),
      p('A routine test is the list performed on every unit of that contract. It is how this serial number shows that it meets the rating: ratio, winding resistance, losses, impedance, and the dielectric checks the chosen standard puts on the routine list. A type test is evidence about the design. Temperature rise, and a lightning impulse when the standard places it there, are the usual examples. One unit’s type test can cover a design. It does not, by itself, re-prove the next serial number. A special test is what the contract adds: a short-circuit withstand test, a sound-level measurement, a zero-sequence measurement, or another item the base list does not contain. An invitation that says “full factory tests” has not chosen any of the three lists.'),
      p('IEC 60076-1 names the general test structure in IEC practice. The dielectric tests sit in IEC 60076-3. IEEE C57.12.90 is the test code many IEEE contracts use beside IEEE C57.12.00. The two codes are not a single merged list. A ratio limit, a loss tolerance, and the order of dielectric tests have to be read from the edition you named. This module does not invent a combined table.'),
      h2('What the report has to show'),
      p('A number without its conditions is not a result. Resistance needs the oil temperature at which it was measured, because copper resistance moves with temperature and load loss is corrected to a reference temperature. Load loss and impedance need the current they were taken at, and the correction to rated current if the test was run lower. No-load loss needs rated voltage and rated frequency. A report that prints only the raw meter reading has not yet met the guarantee. The tolerance that applies is the one in the contract’s edition, or the tighter band the contract wrote in its place.'),
      ul([
        'Routine means this serial number. Type means this design. Special means the contract asked for it.',
        '“Full tests” is not a list. Name the standard, the edition, and any special items.',
        'Correct load loss to the reference temperature. Do not file the cold reading as the guarantee.',
        'Do not merge an IEC list and an IEEE list into one column without saying which rule won.'
      ]),
      p('The sequence of a real factory day, including which dielectric test comes last, is a later module and stays on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-4',
    volume: 4,
    h1: 'Module 1 — Condition is a judgment',
    lead: 'Condition assessment is a judgment from several measurements over time. One oil sample, one number, or one alarm is not yet a diagnosis.',
    body: [
      p('Volume 4 is how monitor data becomes a condition call. This module is the rule that call has to obey. A transformer does not have a single health percentage. Dissolved gas, moisture, power factor, furans, and a temperature trend each answer a different question. Reading one of them as the whole condition is how a wet unit is called “gassing” and a gassing unit is called “wet”.'),
      h2('Each test asks one question'),
      p('Dissolved-gas analysis looks at gases in the oil and, with a history, at whether a fault is producing them. A single sample is a point. A diagnosis needs the rate, the ratios among gases, and the load and temperature at which the oil was taken. Moisture in oil, read as a concentration without the oil temperature, is easy to misread, because water moves between paper and oil as the unit heats and cools. A dielectric response or a power-factor measurement is about the insulation system, not about a gas. Furan compounds are a clue to paper aging, not a remaining-life certificate. None of these replaces the others.'),
      p('The standard you cite has to match the question. IEC 60599 is widely used to interpret dissolved gases. IEEE C57.104 is the IEEE guide used for the same job. They are not the same tables, and this module does not merge them or quote a limit. The laboratory method and the sampling temperature belong in the record next to the number. A monitor that alarms on one gas has started a question. It has not finished it.'),
      h2('A judgment needs a baseline and a trend'),
      p('The factory and the commissioning tests are the baseline this serial number left with. A later result is meaningful against that baseline and against the last few samples, not against a typical value copied from another unit. Load, top-oil temperature, and the cooling stage in service belong beside the sample. Without them, two identical gas numbers can be two different conditions. The paid modules of this course go through how those records are weighed together. This page only refuses the shortcut: one number, one alarm, one visit.'),
      ul([
        'Name the question before you name the test. Gas, water, and paper aging are not one measurement.',
        'Keep the sampling temperature and the load. A concentration without them is incomplete.',
        'Compare with this serial number’s baseline. Another unit’s “typical” value is not this unit’s history.',
        'An alarm starts the record. It does not close it.'
      ]),
      p('Interpretation methods and worked histories stay on the paid plan. This module does not diagnose a unit.')
    ].join('')
  },
  {
    id: 'volume-5',
    volume: 5,
    h1: 'Module 1 — Evidence before a cause',
    lead: 'A failure investigation starts from evidence. The cause is what the records, the wreckage, and the tests still support after the alternatives are tried.',
    body: [
      p('Volume 5 is how a failed unit is investigated. This module is the discipline of that work. A cause you cannot tie to a record is a guess. A guess offered early closes off the measurements that would have tested it. The rest of the course, on the paid plan, walks mechanisms. This page walks the file.'),
      h2('Freeze the record before you explain it'),
      p('Write down what is known on the day of the event, and keep it separate from what is inferred later. Protection traces say how large the current was and how long it lasted. The nameplate and the routine-test report say what this serial number was built and tested as. Oil samples taken before the event, if they exist, say whether the unit was already abnormal. Photographs, the position of valves, the state of the breather, and the impact-recorder record from the last move are evidence. A theory about lightning, through-fault, or moisture is not evidence until one of those records points at it.'),
      p('Do not start by replacing parts to see if the problem goes away. A replaced bushing, a changed tap-changer contact, or a reprocessed oil charge destroys the state you needed to inspect. If the unit is unsafe to approach, make it safe first, and record what you had to disturb. Safety of people on site outranks a neat investigation. It does not require you to invent a cause in the same hour.'),
      h2('A cause has to exclude the neighbours'),
      p('Several mechanisms leave a similar external mark. A tank rupture can follow an internal arc. It can also follow a pressure event whose electrical source is still unknown. A high combustible gas can follow arcing, a thermal fault, or oil that was already contaminated. The investigation earns a cause when the other plausible causes disagree with the records you hold. “Consistent with” is not “shown by”. The paid modules treat individual mechanisms. They still depend on this rule.'),
      ul([
        'Separate observation from inference. Date both.',
        'Keep the pre-event samples and the protection record. They are the history the wreckage no longer shows.',
        'Do not replace the suspected part before it has been inspected and photographed.',
        'A cause that fits every failure fits none. Say which records would have contradicted it.'
      ]),
      p('The volume page lists outcomes, not a case file. Worked investigations stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-6',
    volume: 6,
    h1: 'Module 1 — Decisions in the works',
    lead: 'Manufacturing decides things a drawing cannot undo: the core joint, the winding build, the dry-out, and the oil fill. This module names those gates.',
    body: [
      p('Volume 6 is what is decided in the works. This module is the list of gates that turn a design into one serial number. It is not a factory manual, and it does not set a process time, a vacuum level, or a moisture target. Those values belong to the process the manufacturer qualified, checked against the contract. The point here is which decisions, once made, do not come back.'),
      h2('The active part is built before it is proved'),
      p('Core laminations are cut, stacked, and jointed. A poor joint raises no-load loss and noise for the life of the unit. The winding is then built on that core or on a cylinder that will sit on it: turns counted, transpositions made where parallel strands would otherwise share current unequally, axial pressure applied so the winding cannot loosen under a later fault. Untanked checks — ratio, resistance, and a look at the leads — happen while the active part can still be opened. After vapour-phase or oven drying and after the tank is on, the same correction is a different and larger job.'),
      p('Drying is the step that takes water out of the cellulose before oil is admitted. Oil filled into a wet insulation system locks that water into the life of the unit. Filling under vacuum is how the manufacturer avoids leaving gas pockets in the ducts. A standing time before the high-voltage tests lets the oil finish penetrating the paper. Skipping the order — oil first, dry later, test whenever the bay is free — produces a unit that can pass a hurried check and then age as a wet unit.'),
      h2('A record is part of the product'),
      p('Turn count, resistance per phase, the press force, the dry-out curve, and the oil quality at fill are the manufacturing record. They are what a later failure investigation will ask for, and what a purchaser’s inspector can actually see. A brochure claim about process is not a record. The paid manufacturing modules go into how those processes are controlled. This module only insists that each gate has a record, and that the record is tied to the serial number on the plate.'),
      ul([
        'Core joint, winding pressure, and lead dress are fixed before the tank goes on.',
        'Dry the insulation before the oil fill. The order is the process.',
        'Untanked electrical checks are the last easy look at the active part.',
        'File the process record against the serial number, not against the contract in general.'
      ]),
      p('Process parameters and a works audit stay on the paid plan. This page does not certify a factory.')
    ].join('')
  },
  {
    id: 'volume-7',
    volume: 7,
    h1: 'Module 1 — Insulation as a system',
    lead: 'Oil and cellulose age together. Moisture, temperature, and oxygen move that age. This module treats the insulation as one system, not a list of materials.',
    body: [
      p('Volume 7 is dielectrics, cellulose, oil, and the clocks they keep. This module is the system view. It does not size a duct, pick a paper thickness, or quote a withstand stress. Those are design steps on the paid plan, and they depend on the edition named in the contract. What this page fixes is that the oil and the paper are not two separate products that happen to share a tank.'),
      h2('The oil does three jobs'),
      p('In a liquid-immersed unit the oil insulates, it carries heat, and it is the sample you can take without opening the tank. Mineral oil is specified by the oil standard the contract names. Esters and other liquids are specified by their own standards, usually because of fire behaviour or environmental duty, and they are not a drop-in correction to a mineral-oil temperature-rise design. The cooling code and the thermal class have to be read with the liquid that is actually in the tank. A nameplate that says only “oil” has not identified which liquid the limits were written for.'),
      p('Cellulose — the paper on the conductor and the pressboard that forms barriers and cylinders — holds most of the water in the unit. Water moves between paper and oil as temperature changes. A single oil moisture reading, without the temperature and the load at sampling, does not say how wet the paper is. Heat is the other clock: paper ages faster as it runs hotter. Oxygen, where a free-breathing conservator admits it, is a third. Sealing arrangements exist to keep one or more of those clocks slow. They do not stop the clocks.'),
      h2('Barriers divide a weak gap'),
      p('A long oil gap is weaker, for its length, than the same distance broken into short gaps by solid barriers. That is the point of the pressboard structure around a winding. Creepage along a surface is a different and usually weaker path than a puncture through the solid. Angle rings and caps exist to make that surface path longer and to turn it across the stress. This module does not give a stress in kilovolts per millimetre. Any such number has to come from the design rules and the test levels in the contract, not from a rule of thumb carried between projects.'),
      ul([
        'Name the liquid. Mineral oil, ester, and silicone are different specifications and different thermal designs.',
        'Most of the water sits in the cellulose. An oil sample needs its temperature.',
        'Temperature, moisture, and oxygen are the aging clocks. Sealing slows a clock. It does not delete it.',
        'Barriers subdivide oil gaps. A single large gap is not the same insulation as several small ones.'
      ]),
      p('Grading, impulse distribution, and drying practice stay on the paid plan. This page does not set a clearance.')
    ].join('')
  },
  {
    id: 'volume-8',
    volume: 8,
    h1: 'Module 1 — Bushings, taps, cooling',
    lead: 'Bushings, tap changers, and cooling are the interfaces around the active part. This module says what each interface is for, and what a specification still has to name.',
    body: [
      p('Volume 8 is bushings, tap changers, cooling, and the joints between them. This module introduces those interfaces. It does not select a bushing technology, a tap-changer type, or a radiator area. Those choices are paid modules, and they have to match the insulation level, the current, and the cooling stage already fixed in the enquiry.'),
      h2('Three interfaces, three jobs'),
      p('A bushing takes a lead from the oil, or from the air around a dry winding, out to the terminal without letting the voltage track over a short surface. At distribution voltages a solid bushing is usual. At higher voltages a condenser-graded bushing shares the voltage across many layers. The test tap on that kind of bushing is how capacitance and dissipation factor are watched later. The bushing is a leading place for a serious failure because it stores energy and it sits in the tank cover. Specifying “a bushing” without a voltage class, a current, a creepage duty, and a technology is not yet a specification.'),
      p('A tap changer changes the turns ratio. Off-circuit, it is moved only with the transformer isolated. On load, it moves in service, inside a defined range and step. The enquiry has to say which winding is tapped, whether the changer breaks current, the number of steps, and whether rated power holds across the range. IEC 60214-1 is the tap-changer standard. It is not, by being cited, a complete tap specification.'),
      p('Cooling moves the heat of no-load loss and load loss out to air or water. IEC 60076-2 assigns a four-letter code for a liquid-immersed unit: the internal liquid, how that liquid moves, the external medium, and how that medium moves. IEEE practice uses its own letter code and its own temperature-rise limits. ONAN and ONAF are not two names for the same rating. The higher power exists only in the stage whose fans or pumps are running.'),
      h2('The interfaces have to agree'),
      p('A bushing current below the winding current, a tap changer on the wrong winding end, or a cooler valve that can be left shut between the tank and the radiator are interface errors. They are not visible in the ideal turns ratio. The paid component modules open each device. This module asks you to write the interface down: voltage, current, cooling stage, and who may operate the tap changer.'),
      ul([
        'A bushing has a voltage class, a current, a creepage duty, and a technology. One of those missing is an incomplete line.',
        'Say whether taps are on load or off circuit, on which winding, and at which end.',
        'Read the cooling code as four decisions. Do not treat a forced stage as the self-cooled rating.',
        'IEC and IEEE letter codes are not a translation of each other. Use the code in the contract.'
      ]),
      p('Cutaways, condenser grading, and diverter operation stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-9',
    volume: 9,
    h1: 'Module 1 — No-load and load loss',
    lead: 'No-load loss and load loss are different measurements, capitalised differently, and guaranteed separately. This module separates them before any money is attached.',
    body: [
      p('Volume 9 is measurement, capitalisation, and the money in a loss figure. This module separates the two losses a guarantee is actually about. It does not set a capitalisation rate, and it does not call a loss “low” against a regulation you have not opened. Rates and regulatory bands are purchaser’s rules. They are not constants of the transformer.'),
      h2('Two losses, two tests'),
      p('No-load loss is measured with the secondary open, at rated voltage and rated frequency. It is mostly core loss: hysteresis and eddy loss in the steel, plus a smaller share elsewhere. It is present whenever the unit is energised, whether or not it carries load. Load loss is measured with one winding shorted, at rated current, and it is corrected to a reference temperature because winding resistance changes with temperature. It is mostly the resistive loss in the windings, plus stray loss from leakage flux in the tank, clamps, and the windings themselves. A total loss figure that is not split cannot be capitalised sensibly, because the two losses are bought at different rates and they occur for different hours.'),
      p('Impedance is measured in the same short-circuit setup as load loss, and it is a guaranteed value of its own. It is not a loss. A unit can meet a loss guarantee and miss an impedance guarantee, or the reverse. The tolerance that applies is the tolerance in the edition the contract names, or a tighter band the contract wrote. This module does not print a percent and call it universal.'),
      h2('Capitalisation is arithmetic the buyer declares'),
      p('A capitalisation rate turns a kilowatt of loss into a present cost so two offers can be compared. The no-load rate and the load rate are different because a core loss runs all the hours the unit is energised, and a load loss runs with the square of the loading. If the enquiry does not state the rates, the offers cannot be ranked on lifetime cost. They can still be ranked on the guaranteed kilowatts and on price. Inventing a rate after the bids are in is not a evaluation. It is a new enquiry.'),
      ul([
        'No-load loss: open circuit, rated voltage, rated frequency. It runs whenever the unit is energised.',
        'Load loss: short circuit, rated current, corrected to the reference temperature. It follows the load.',
        'Impedance is not a loss. Keep its guarantee and its tolerance separate.',
        'Capitalisation rates come from the buyer. They are not a property of the steel or the copper.'
      ]),
      p('Worked capitalisation and the tender comparison stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-10',
    volume: 10,
    h1: 'Module 1 — Radial and axial forces',
    lead: 'Short-circuit forces scale with the square of current. Impedance is the first limit on that current. This module separates radial force from axial force.',
    body: [
      p('Volume 10 is forces, buckling, clamping, and how strength is shown. This module is the direction of those forces and the reason impedance shows up in a mechanical discussion. It does not calculate a stress, and it does not declare a winding safe. IEC 60076-5 is the withstand standard in IEC practice. The method it allows — calculation or test — is the one the contract invokes. This page does not invent a pass criterion.'),
      h2('Current sets the force, and impedance sets the current'),
      p('The current that flows in a through-fault is limited by the impedance of the transformer and of the system behind it. A lower transformer impedance lets through a higher fault current. Electromagnetic force between conductors scales with the square of that current. Doubling the current multiplies the force by four. That is why a loss-optimised, very low impedance is not a free improvement. The mechanical design has to live with the current that impedance allows, for the time the protection actually takes to clear.'),
      p('In a concentric pair, the ampere-turns of the inner and outer windings repel. The outer winding is driven outward, in hoop tension. The inner winding is driven inward, toward the core, where buckling is the risk. Any axial mismatch between the magnetic centres of the two windings adds an end thrust on the clamping structure. A winding that was pressed in the factory and then allowed to relax can meet the radial picture on paper and still move axially on the first serious fault.'),
      h2('What has to be true before a number is worth calculating'),
      p('The fault current used in the check has to be the current the enquiry defined, with the system strength the enquiry defined. A calculation done at an assumed infinite bus, or at a fault duration nobody will actually clear, answers a different question from the one the contract asked. The paid module goes through the force estimate and the failure mode each component of force drives. This module stops at the split: radial outward, radial inward, and axial thrust, with impedance as the first lever.'),
      ul([
        'Force follows the square of current. A small drop in impedance is a large rise in force.',
        'The outer winding sees hoop tension. The inner winding sees inward buckling.',
        'Axial force appears when the magnetic centres do not match, including on tap positions where the centres shift.',
        'Name the system strength and the clearing time. A force with neither is not yet the contract’s force.'
      ]),
      p('The numerical withstand check stays on the paid plan. This page does not clear a design.')
    ].join('')
  },
  {
    id: 'volume-11',
    volume: 11,
    h1: 'Module 1 — Relays and the machine',
    lead: 'Differential protection, overcurrent, and the devices on the tank do different jobs. Inrush is not a fault. This module separates those jobs before any setting is chosen.',
    body: [
      p('Volume 11 puts the transformer in a network: relays, trip paths, and the settings that have to ignore magnetising inrush and still see a real fault. This module names the jobs. It does not set a relay, and it does not pick a curve. Settings are a later, paid module, and they are only as good as the current transformer locations and the tank devices the scheme assumes are there.'),
      h2('Electrical protection and the tank devices'),
      p('Differential protection compares current into the transformer with current out of it. An internal fault produces a difference. A through-fault, ideally, does not. Overcurrent protection sees magnitude. It is simpler and it is slower to tell an internal fault from a heavy through-load or a downstream fault. Restricted earth fault looks at residual current on one winding. These are different zones. A scheme that says only “full protection” has not said which zones exist.'),
      p('On the tank, a gas-operated relay in the pipe to the conservator responds to gas accumulation and to a sudden oil surge. A pressure-relief device responds to a sudden rise of pressure in the tank. A winding-temperature image and an oil-temperature indicator start fans and, at a further step, alarm or trip. They are not substitutes for the electrical relays. A shut valve between the tank and the conservator leaves the gas-operated relay blind while every other check can still look normal. That valve position is part of the protection, not a maintenance detail.'),
      h2('Inrush is a magnetising event'),
      p('When a core is energised, the flux may not start from zero. For a cycle or more the core can saturate and the magnetising current can be many times the rated current, rich in second harmonic, and larger on one phase than another. Differential protection that treats every current difference as a fault will trip on energisation. Restrain it with a harmonic check or an equivalent method the relay actually implements. Do not “solve” inrush by raising the differential setting until a real fault is also ignored. The size of inrush depends on the point on the wave, the remanent flux, and the source impedance. It is not a single number you can copy from a similar rating.'),
      ul([
        'Say which zones exist: differential, overcurrent, restricted earth fault, and the tank devices.',
        'A gas-operated relay needs an open pipe to the conservator. A shut valve removes it.',
        'Inrush is not an internal fault. The restraint has to ignore it without blinding the relay.',
        'Do not copy a setting from another rating. Source impedance and remanence move the current.'
      ]),
      p('Worked settings and coordination with the network stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-12',
    volume: 12,
    h1: 'Module 1 — Duty that is not standard',
    lead: 'Special transformers are units whose duty a plain two-winding specification does not describe. This module sorts the families before any one of them is designed.',
    body: [
      p('Volume 12 covers converter, phase-shifting, furnace, traction, rectifier, and other non-standard duty. This module is a sorting page. It does not design any of those units. A special transformer is not a standard unit with a different label. The duty — harmonics, a direct-current component, a short-time overload far above the continuous rating, or a phase shift that is the product — changes the winding, the thermal design, or both.'),
      h2('Name the duty before the construction'),
      p('An autotransformer shares part of the winding between the two voltages. The saving in material is real, and so is the change in how impedance and a fault behave. It is not a small two-winding unit. A rectifier or converter transformer feeds a power-electronic bridge. It sees harmonic currents the fundamental rating does not describe, and it may see a direct-current bias. Eddy loss and a hot spot then sit in places a sinusoidal load-loss calculation never looked. A furnace transformer is built around a short-time overload and a wide on-load voltage range. Its thermal design is a cycle, not a continuous nameplate. A traction transformer is constrained by mass, a harsh electrical environment, and a duty cycle. A phase-shifting transformer exists to control power flow. Its rating is an angle and a throughput, not only a voltage ratio.'),
      p('Calling any of these “a transformer of the same megavolt-amperes” and then using a distribution design is how the winding overheats or the impedance comes out meaningless. The enquiry has to describe the duty: the harmonic spectrum or the pulse number, the overload cycle and its duration, the direct-current component if there is one, and the phase shift if the shift is the point of the unit.'),
      h2('What does not change'),
      p('The induced-voltage equation, the need for a closed core, and the need for a named standard and edition still apply. Special duty adds questions. It does not delete the general ones. Insulation level, cooling, and a factory test list still have to be chosen, and the test list often has to be extended because the base routine list was written for sinusoidal duty. The paid modules treat one family at a time. This module only stops you from starting with the wrong family.'),
      ul([
        'An autotransformer is not a two-winding unit with a shared lead. Impedance and fault behaviour change.',
        'Converter and rectifier duty add harmonics and sometimes a direct-current component. Eddy loss moves.',
        'Furnace and traction duty are cycles. A continuous rating alone does not describe them.',
        'A phase-shifting transformer is specified by an angle and a throughput, not by a voltage ratio only.'
      ]),
      p('Family-by-family design stays on the paid plan. This page does not rate a special unit.')
    ].join('')
  },
  {
    id: 'volume-13',
    volume: 13,
    h1: 'Module 1 — Site work before voltage',
    lead: 'Installation and commissioning are manufacturing steps carried out away from the works. This module is the order of checks before the first voltage.',
    body: [
      p('Volume 13 treats site work as manufacturing performed by people who are not the manufacturer. This module is the order of that work up to, and not including, the moment of energisation. It does not authorise a unit for service. The person who holds that duty uses the contract’s procedure. This page says what the procedure is for.'),
      h2('The serial number has to survive the journey'),
      p('Confirm the serial number on the tank against the routine-test report and the nameplate before any other check is worth filing. An impact recorder that shows a shock above the limit the manufacturer set is a reason to stop and inspect, not a reason to hurry the electrical tests. Transport locks, a shipping gas pressure, and braces on bushings or radiators were there for the journey. They have to come off, or be set to the service position, in the order the drawing states. A lock left in place is a site defect with a factory-looking nameplate.'),
      p('Valves between the tank, the conservator, and the coolers are then a protection question. A closed valve at the gas-operated relay leaves the unit unprotected while oil level and voltages can still look right. Liquid level, the breather, and the earthing of the tank and of current-transformer secondaries belong in the same pass. None of these is an electrical test. All of them can make an electrical test meaningless or unsafe.'),
      h2('The baseline is taken before the unit is asked to work'),
      p('Ratio, winding resistance, and a frequency-response trace taken at site are meaningful because they can be set beside the factory results for this serial number. IEC 60076-18 is the frequency-response document. A site trace with no factory baseline is a picture of an unknown state. It becomes the baseline only if you accept that you have none from the works, and you say so. Oil samples taken before energisation are the start of the service history, not a substitute for the factory oil quality. The paid site module continues into the first voltage and the watch period after it. This module ends when the unit is ready to be considered for that step, not when it has been energised.'),
      ul([
        'Match the serial number to the factory report before you test.',
        'Read the impact record. A shock above the set limit stops the electrical programme.',
        'Set every transport lock and every valve to the service position on the drawing.',
        'Take ratio, resistance, and a frequency-response trace against the factory baseline, and file them before voltage.'
      ]),
      p('The energisation watch and the handover record stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-14',
    volume: 14,
    h1: 'Module 1 — Nameplate and overload',
    lead: 'The nameplate is a continuous rating under a stated cooling stage. Loading above it is a thermal decision with a life cost, not a hidden extra rating.',
    body: [
      p('Volume 14 is the thermal model, the loading guide, and the decision taken hour by hour. This module separates the nameplate from an overload. It does not authorise a load above the plate, and it does not quote a percent of rated current as universally safe. IEC 60076-7 is the loading guide in IEC practice. IEEE has its own loading guide. Use the one the contract and the operator’s procedure name. This page does not merge them.'),
      h2('What the plate already promised'),
      p('Rated power is the continuous power at rated voltage and rated frequency under the cooling method printed next to that power. An ONAN value and a higher ONAF value are two promises. The higher one is available when that stage is running, not whenever someone wishes the unit were larger. Ambient and altitude sit under the assumptions of the temperature-rise standard. A site hotter or higher than those assumptions is not the site the plate was written for, even if the kilovolt-amperes match.'),
      p('The limit that ages the paper is the hot spot, not the average winding temperature and not the top oil alone. Paper aging speeds up as that hot spot rises. A short peak can be carried on the thermal mass of the oil and the windings. A peak that is repeated every day is no longer an emergency. It is the new duty, and it needs to have been designed and guaranteed as a duty. Ancillary equipment — bushings, tap-changer contacts, and current transformers — can be the limit before the winding is. A loading decision that looks only at the winding temperature has not looked at the whole unit.'),
      h2('An overload is a decision you record'),
      p('If an operator loads above the plate, the record should show the power, the duration, the cooling stage that was running, the ambient, and which guide was used. A scorch mark found years later cannot be interpreted without that record. The paid module works the thermal model. This module only refuses two mistakes: treating the forced-cooled power as the self-cooled power, and treating an emergency loading as if it had no life cost.'),
      ul([
        'Read the cooling stage beside the power. Do not borrow the fan-cooled number with the fans stopped.',
        'Hot-spot temperature, not the average, is what ages the paper.',
        'A daily peak is a duty. An emergency is occasional. They are not the same guarantee.',
        'Bushings, tap changers, and current transformers can limit the load before the winding does.'
      ]),
      p('The thermal calculation and the guide’s loading tables stay on the paid plan, in the edition you cite.')
    ].join('')
  },
  {
    id: 'volume-15',
    volume: 15,
    h1: 'Module 1 — Repair and life extension',
    lead: 'Maintenance, repair, and refurbishment are different bets on a failure mechanism. This module separates them before any scope of work is written.',
    body: [
      p('Volume 15 treats a maintenance programme as a set of bets about how a unit actually fails. This module names the three words a work order tends to mix: maintenance, repair, and refurbishment. It does not write a scope, price a rewind, or promise added life. A life figure without an inspection of this serial number is advertising.'),
      h2('Three different decisions'),
      p('Maintenance is work done so that a mechanism you already understand does not get a head start. Breather service, fan replacement, tap-changer contact inspection at the interval the changer requires, and oil treatment when the oil — not the paper — is what has deteriorated, are maintenance. They presume the active part is still the active part the factory built. Repair is a response to damage: a leaking gasket, a failed bushing, a tap-changer diverter that has reached its contact life, a winding that has moved. The repair replaces or restores a part. It does not, by itself, reset the age of the paper that stayed behind. Refurbishment, sometimes called a rewind or a remanufacture, opens the active part and replaces enough of it that the unit’s remaining life is a new claim. That claim needs a new specification, a new dry-out, and a new test record. It is closer to a manufacture than to a service visit.'),
      p('Choosing the wrong word changes the contract. A “repair” that quietly becomes a rewind has a different test list, a different drying requirement, and a different argument about what the nameplate still means. A “life extension” that changes the oil and paints the tank has maintained the unit. It has not rewound it. Say which parts will be replaced, which tests will be repeated, and which nameplate values are being re-declared.'),
      h2('The mechanism comes first'),
      p('A programme that inspects everything on a fixed calendar, with no view of how this design fails, spends money on the wrong joints. Bushings, tap changers, oil preservation, and through-faults are common places a fleet actually loses units. The paid modules tie inspections to those mechanisms. This module asks only that the work order name the mechanism it is buying down, and that it not call a maintenance visit a new transformer.'),
      ul([
        'Maintenance keeps a sound active part in service. It does not reset paper age.',
        'Repair replaces a damaged part. The tests should match the part that was opened.',
        'Refurbishment re-declares capability. It needs a specification and a new test record.',
        'Name the mechanism. A calendar full of unrelated checks is not yet a programme.'
      ]),
      p('Scopes, process steps, and a judgment of remaining life stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-16',
    volume: 16,
    h1: 'Module 1 — A named edition, not a slogan',
    lead: 'Compliance and quality are different things. Compliance is a named edition and a test record. Quality is whether the works can repeat that result.',
    body: [
      p('Volume 16 separates compliance from quality. This module is that separation. A logo, a certificate on the wall, or the words “meets IEC and IEEE” are not a compliance argument. Compliance is a sentence you can check: this edition, these clauses that the contract actually invoked, this test record for this serial number. Quality is the process control that makes the next serial number look like this one. Buying one does not buy the other.'),
      h2('Name the document and the edition'),
      p('IEC 60076 is a family. Part 1 is general, other parts cover temperature rise, insulation levels, short-circuit withstand, dry-type units, loading, and further subjects. IEEE C57 is a different family, with its own general requirements and its own test code. A contract that lists both families without saying which clause wins is not yet a contract a factory can build to. Where the purchaser wants a particular table — an insulation level, a loss tolerance, a temperature-rise limit — the enquiry should say so. A designer who fills the gap from the last project is designing a different unit from the one the purchaser thinks was bought.'),
      p('Component standards sit beside the transformer standard. A bushing, a tap changer, and an insulating liquid each have their own documents. Citing the transformer standard does not automatically cite them. This module does not list clause numbers. The edition on the purchaser’s desk is the list. If that edition is not in the room, the honest state is that the requirement has not been read, not that it has been remembered.'),
      h2('A test record is not a quality system'),
      p('One unit that passes routine tests shows that one unit met the list that was applied. It does not show that the core-cutting line, the drying oven, or the oil plant will do the same thing next month. That is what process records, calibration, and a repeat test are for. The paid modules of this course go into how a works stays honest. This module only stops two substitutions: a slogan in place of an edition, and a single test sheet in place of a process.'),
      ul([
        'Cite the part and the edition. “IEC 60076” alone is a family, not a requirement.',
        'Do not cite IEC and IEEE as if a conflict between them had already been decided.',
        'Component standards are separate citations. A bushing is not covered by naming the transformer alone.',
        'A passed routine list is about this serial number. Process control is about the next one.'
      ]),
      p('Audit methods and a quality plan stay on the paid plan. This page does not certify a works or a person.')
    ].join('')
  },
  {
    id: 'volume-17',
    volume: 17,
    h1: 'Module 1 — Fleet risk and replacement',
    lead: 'A fleet decision is not a single-unit design calculation. This module separates condition, consequence, and the choice to maintain, repair, or replace.',
    body: [
      p('Volume 17 is utility asset management: risk, intervention, and replacement across a fleet. This module is the distinction a design calculation does not make. A unit can be in poor condition and still be the wrong unit to replace this year, if the consequence of its failure is low and a neighbour’s consequence is high. The reverse is also true. Condition alone is not a ranking.'),
      h2('Three different questions'),
      p('Condition is what the tests and the history say about this serial number. Consequence is what happens to the network, to safety, and to supply if this unit fails without warning. Intervention is the action you can actually buy: maintain, repair, refurbish, add a spare, or replace. A spreadsheet that sorts units by age and replaces the oldest has answered none of the three. Age is a clue to paper condition only when temperature, moisture, and loading went with it. Two units of the same year can be in different states.'),
      p('A design engineer’s calculation tells you whether a specified unit can be built and tested. An asset manager’s calculation tells you which installed unit to spend on. Mixing them produces a fleet plan that reads like a design report and does not say what will be done on site this year. The paid modules work the fleet questions. This module only insists they stay separate from the kilovolt-ampere calculation.'),
      h2('A ranking you can explain'),
      p('Write the consequence in the language of the network: which other unit picks up the load, how long a replacement takes, and who is at risk if the tank fails violently. Write the condition from named tests and a trend, not from a colour on a dashboard. Write the intervention as a scope with a test record at the end. A rank that cannot be traced to those three lines will not survive the next person who opens the file. This course does not supply a score, a weighting, or a software model. Those are the owner’s method. What the method must not do is hide a missing test behind a precise-looking number.'),
      ul([
        'Condition, consequence, and intervention are three columns. Age is not a substitute for any of them.',
        'A design calculation does not rank a fleet. A fleet rank does not design the replacement.',
        'Say which tests support the condition. A colour code without a test is a label.',
        'The intervention needs a scope and a closing test. “Replace sometime” is not yet a plan.'
      ]),
      p('Worked fleet rankings stay on the paid plan. This page does not score a utility’s units.')
    ].join('')
  },
  {
    id: 'volume-18',
    volume: 18,
    h1: 'Module 1 — A question-first handbook',
    lead: 'A handbook is the series inverted: indexed by the question an engineer is asking, not by the order a design is taught. This module says how to use that index without treating a line as a specification.',
    body: [
      p('Volume 18 inverts the series. The other volumes follow a machine from specification to service. A handbook starts from the question in front of you and points at the volume that holds the argument. This module is how to use that kind of book without promoting a reminder into a requirement.'),
      h2('A line in a handbook is not a clause'),
      p('An engineer under time pressure wants a number: a clearance, a loss, a temperature, a multiplier. A handbook that prints one without the conditions is a hazard. The number was true for a stated cooling code, a stated frequency, a stated insulation level, and a stated edition. Copied onto a different enquiry, it is a different number that happens to use the same digits. The habit this module asks for is short. Read the line. Read the condition under it. Open the standard the contract named before you put the line into a specification or a test sheet.'),
      p('The same applies to a formula. The induced-voltage equation with the 4.44 factor is a sinusoidal, root-mean-square relationship. A handbook that prints it is reminding you of that case. It is not licensing the factor for a distorted flux, and it is not a purchaser’s tolerance. Indexes are for finding the argument. They are not the argument.'),
      h2('How this course expects you to arrive'),
      p('Come with the question, not with the hoped-for answer. “What limits an overload on this cooling stage?” is a question the loading volume can start. “Confirm that 120 percent is acceptable” is a request for permission the book does not have. The paid handbook modules are arranged by question so that a working engineer can enter in the middle. They still point back at the edition and the test record. This free module only installs the habit: find the question, read the condition, do not promote a reminder into a requirement.'),
      ul([
        'Start from the question. An index that only confirms what you already decided is not being used.',
        'Read the conditions under a number. Cooling, frequency, and edition travel with it.',
        'A formula in a handbook has a case. The sinusoidal induced-voltage factor is one case, not every case.',
        'The contract’s edition outranks the handbook when they disagree. The handbook should tell you to look.'
      ]),
      p('The question index itself stays on the paid plan. This page is the rule for using it.')
    ].join('')
  },
  {
    id: 'volume-19',
    volume: 19,
    h1: 'Module 1 — Converter and HVDC duty',
    lead: 'Converter and HVDC transformers carry a duty the alternating-current fleet was often not specified for: harmonics, a possible direct-current bias, and a firing pattern.',
    body: [
      p('Volume 19 is the grid the installed fleet was not necessarily specified for: power electronics, high-voltage direct current, and the transformers that sit against converters. This module says what is different about that duty. It does not design a converter transformer, and it does not size a valve hall. Those designs stay on the paid plan and in the project’s own specification.'),
      h2('The current is not a clean sine'),
      p('A converter transformer feeds, or is fed by, a power-electronic bridge. The current contains harmonics set by the pulse number and by how the bridge is fired. Eddy loss in the windings and in structural steel follows those harmonics, not the fundamental load-loss calculation used for a sinusoidal industrial load. A direct-current component, where the scheme allows one, biases the core and can drive it into saturation in one direction. Magnetising current, noise, and vibration then move. None of this is visible if the specification only states a fundamental megavolt-ampere rating and a power frequency.'),
      p('The insulation duty can include a direct voltage as well as the alternating and impulse voltages a conventional unit is tested for. A test list copied from a network transformer will not ask the questions this duty asks. The contract has to add them. This module does not invent those tests and does not quote a withstand. The project specification and the edition it names are the list.'),
      h2('An existing unit is not automatically fit for a new converter'),
      p('A transformer specified for sinusoidal network duty can be electrically excellent and still be the wrong machine to put against a new converter. Its eddy-loss margin, its tap range, and its noise limit were set for a different current. Redeclaring it for converter duty is a new specification and a new look at the thermal and mechanical design, not a note in the operating manual. The paid modules treat that redeclaration and the new-build case. This module only makes the difference explicit so the wrong machine is not assumed to be close enough.'),
      ul([
        'State the pulse number and the harmonic current. A fundamental rating does not describe converter duty.',
        'Ask whether a direct-current bias exists. It changes flux, noise, and magnetising current.',
        'Do not copy a network-transformer test list onto a converter transformer without an added duty list.',
        'An installed alternating-current unit needs a new assessment before it is declared fit for a converter.'
      ]),
      p('Converter-transformer design and the project test list stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-20',
    volume: 20,
    h1: 'Module 1 — Specifying and buying',
    lead: 'Procurement is an engineering document plus a commercial comparison. This module says what the enquiry must fix so that two offers can be compared at all.',
    body: [
      p('Volume 20 is specifying, buying, and capitalising transformers. This module is the minimum an enquiry has to contain before a price is meaningful. It is not a tender form, and it is not legal advice. Commercial terms, guarantees, and penalties are the contract. This page is about the engineering lines without which those terms have nothing to attach to.'),
      h2('Offers are comparable only on a shared specification'),
      p('Two manufacturers who are free to choose impedance, loss, cooling stage, and insulation level will offer two different machines. The prices will not be comparable. The enquiry closes those choices or it states the band that is allowed. Rated power and its cooling stage, voltages, frequency, impedance at a stated power, insulation levels, loss guarantees or capitalisation rates, tap range, and the test list are the lines that make an offer a response rather than a new proposal. A blank that says “manufacturer’s standard” is a blank the purchaser has decided not to control.'),
      p('Loss capitalisation, when it is used, is declared in the enquiry: a rate for no-load loss and a rate for load loss. Bidders then compete on a evaluated cost, not on a sticker price that hides an inefficient core. Changing the rates after the offers arrive changes the winner. That is a new enquiry. A deviation schedule is how a bidder says it cannot, or will not, meet a line. A silent deviation is not a deviation. It is a different product described with the purchaser’s words.'),
      h2('Factory and site acceptance are part of the buy'),
      p('The offer should say which tests are included in the price, which are optional, and who witnesses them. A type test from a similar unit is evidence about a design only when the contract says that similarity is acceptable. It is not evidence about this serial number’s routine results. Site acceptance repeats the checks the journey can undo. Leaving both “to be agreed” means the price does not yet include a known test list. The paid procurement module works a tender in detail. This module sets the condition for that work: fix the engineering lines first.'),
      ul([
        'Close power, cooling, impedance, insulation, taps, and the test list in the enquiry.',
        'If losses are capitalised, print both rates in the enquiry. Do not invent them after the bids.',
        'A deviation is a written line. Silence is not acceptance of the specification.',
        'Say which tests the price includes, and whether a type test from another unit is allowed.'
      ]),
      p('A full tender comparison stays on the paid plan. This page does not rank a bidder.')
    ].join('')
  },
  {
    id: 'volume-21',
    volume: 21,
    h1: 'Module 1 — Fire, oil, noise, and life',
    lead: 'Fire behaviour, oil containment, noise, and end of life are specification lines. This module says what each line is asking, without ranking a product.',
    body: [
      p('Volume 21 is safe work, fire, oil, noise, and the life-cycle footprint. This module separates four specification lines that are often written as slogans. It does not certify a liquid, a bund, or a noise level, and it does not offer an environmental claim for a product. The limit that applies is the limit in the regulation and the contract that govern the site.'),
      h2('Fire and containment are different duties'),
      p('A liquid’s fire point changes how a fire can start and how it behaves. Mineral oil, natural ester, synthetic ester, and silicone are different liquids with different specifications. Choosing one for fire behaviour does not automatically satisfy a temperature-rise design written for another, and it does not remove the need to contain a spill. Containment — a bund, a tank, a separator — is about where the liquid goes if it leaves the transformer. A high fire point does not absorb a spill. Write the fire requirement and the containment requirement as two lines, each with the rule that applies at the site.'),
      p('Noise is a guarantee with a stated measure: sound power or sound pressure, the cooling stage that was running, and the distance or the surface the figure uses. A decibel number with none of those is not a guarantee you can test. Load noise and no-load noise are different. A unit that meets a no-load figure can miss the figure once the fans are on. End of life is a materials question: what is in the tank, what can be reprocessed, and what has to be handled as waste under the rule that applies. It is not a slogan on the front of a brochure, and this course does not assign a recycling rate.'),
      h2('The site rule outranks a catalogue line'),
      p('Indoor installation, a basement, a tunnel, or a place where people work beside the unit can exclude a liquid or demand a fire behaviour the catalogue unit does not have. The answer is in the site’s rules and in the contract, not in a general preference for one technology. Dry-type construction avoids a liquid spill and brings its own fire, temperature, and clearance questions, which the dry-type standard addresses. This module does not choose between them. It asks that the enquiry say which hazard it is buying down.'),
      ul([
        'Fire point and spill containment are two requirements. Meeting one does not meet the other.',
        'Name the liquid. Do not carry a mineral-oil thermal design onto an ester without redesign.',
        'A noise guarantee needs the measure, the cooling stage, and the distance or surface.',
        'End of life follows the waste rule at the site. Do not invent a recovery rate.'
      ]),
      p('Worked specifications for fire, containment, and noise stay on the paid plan.')
    ].join('')
  },
  {
    id: 'volume-22',
    volume: 22,
    h1: 'Module 1 — A transformer that travels',
    lead: 'A mobile transformer or a mobile substation is specified for the journey as well as for the electrical duty. This module lists what the journey adds.',
    body: [
      p('Volume 22 is transformers and substations that are built to travel. This module is the extra specification the journey imposes. It does not rate a mobile unit, and it does not clear a route. Axle loads, bridge limits, and permits are the rules of the road authority. They are not electrical ratings, and this page does not quote them.'),
      h2('The unit has two duties'),
      p('The electrical duty is the one every other module already asks about: power, voltage, impedance, insulation, cooling, and a test list. The transport duty is added. Mass, the centre of gravity, the height with bushings fitted or removed, and the arrangement of radiators and a conservator decide whether the unit can move as one piece. A bushing that must come off for a bridge and go back on at the destination is a site assembly, with the checks that assembly requires, every time the unit is deployed. A design that ignores that cycle will be electrically sound and still be stuck at the first low bridge.'),
      p('Shock and vibration during travel are a mechanical duty the stationary specification does not include. Bracing, transport locks, and an impact record exist because of it. A mobile unit that is redeployed often sees that duty many times. The winding clamping and the bushing mounts have to be chosen for that repetition, not only for a single delivery from the works. The paid module treats the design changes. This module makes sure both duties are on the enquiry.'),
      h2('A temporary connection is still a rating'),
      p('A mobile substation is asked to replace a failed unit quickly. The voltages, the vector group, the tap range, and the earthing have to match the bay it will land in, or the mismatch has to be designed hardware — not a hope that the crews will sort it out at night. Impedance decides how it shares load if it runs in parallel with a unit that stayed in service. A “universal” spare that states none of these is not yet a spare. It is a transformer looking for a bay.'),
      ul([
        'Write an electrical rating and a transport rating. Mass, height, and centre of gravity are specification lines.',
        'Say which parts come off for travel and which checks are repeated every time they go back on.',
        'Treat repeated road shock as a duty, not as a one-time delivery.',
        'Match vector group, voltage, taps, and earthing to the bay. A spare that matches none is not a spare.'
      ]),
      p('The design changes that make a unit mobile stay on the paid plan. This page does not permit a route.')
    ].join('')
  }
];

function pageHtml(course, header, footer) {
  const pathName = course.volume === null
    ? '/learn/design/module-1/'
    : '/learn/volume-' + course.volume + '/module-1/';
  const canonical = 'https://transformerpath.com' + pathName;
  const title = course.h1 + BRAND;
  if (title.length < 50 || title.length > 60) {
    throw new Error('title length ' + title.length + ' for ' + title);
  }
  const description = fitDescription(course.lead);
  const bookLink = course.volume === null
    ? ''
    : '<li><a href="/books/volume-' + course.volume + '/">Volume ' + course.volume + ' — titles and outcomes</a></li>\n';
  const head = header
    .replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>')
    .replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + description + '">')
    .replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + canonical + '">')
    .replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + course.h1 + '">')
    .replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + description + '">')
    .replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + canonical + '">')
    .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index,follow">');
  return head + '\n' +
    '<section class="hero" style="padding:48px 0 28px"><div class="container">' +
    '<p style="margin:0 0 8px"><a href="/learn.html" style="color:var(--accent);font-weight:700">Learn</a></p>' +
    '<p style="margin:0 0 10px"><span class="free-pill" style="display:inline-block;background:#1e9e5a;color:#fff;font-size:.72rem;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 10px;border-radius:999px">Free</span></p>' +
    '<h1 style="font-size:2.05rem">' + course.h1 + '</h1>' +
    '<p>' + description + '</p></div></section>\n' +
    '<main id="main" class="guide-wrap" tabindex="-1" data-free-module="1">\n' +
    '<p class="guide-note"><strong>Free module.</strong> This page is free to read. It does not ask you to sign in. It does not offer a class or a call. Use the edition of each standard named in the contract. Questions: <a href="mailto:hello@transformerpath.com">hello@transformerpath.com</a>.</p>\n' +
    course.body +
    '<h2>Upgrade</h2>\n' +
    '<p>Module 1 is free. The rest of this course stays on the paid plan. The plan is a one-time payment for 12 months of access, with no auto-renewal. This page does not offer a class or a call.</p>\n' +
    '<p><a class="btn btn-amber" href="' + CHECKOUT + '" target="_blank" rel="noopener" data-upgrade="learning" data-track="learning_checkout_started" data-track-plan="Learning">Upgrade</a></p>\n' +
    '<h2>Continue</h2>\n<ul>\n' +
    bookLink +
    '<li><a href="/learn.html">All courses</a></li>\n' +
    '<li><a href="/pricing.html">Plans</a></li>\n' +
    '</ul>\n</main>\n' + footer;
}

function indexHtml(courses) {
  const items = courses.map(function (course) {
    const pathName = course.volume === null
      ? '/learn/design/module-1/'
      : '/learn/volume-' + course.volume + '/module-1/';
    return '<li><span class="free-pill">Free</span> <a href="' + pathName + '">' + course.h1 + '</a></li>';
  }).join('\n');
  return '<nav aria-label="Free modules" id="free-modules" style="margin:0 0 28px">\n' +
    '<h2>Free module 1 of each course</h2>\n' +
    '<p>Each link is the free module. Later modules stay on the paid plan.</p>\n' +
    '<ul>\n' + items + '\n</ul>\n</nav>';
}

function patchLearn(courses) {
  const file = path.join(ROOT, 'learn.html');
  let html = fs.readFileSync(file, 'utf8');
  const start = '<!-- free-module-index:start -->';
  const end = '<!-- free-module-index:end -->';
  const a = html.indexOf(start);
  const b = html.indexOf(end);
  if (a < 0 || b < a) throw new Error('free-module-index markers missing');
  html = html.slice(0, a + start.length) + '\n' + indexHtml(courses) + '\n' + html.slice(b);
  fs.writeFileSync(file, html);
}

function stampDates(courses) {
  const file = path.join(ROOT, 'data', 'sitemap-content-dates.json');
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  courses.forEach(function (course) {
    const rel = course.volume === null
      ? 'learn/design/module-1/index.html'
      : 'learn/volume-' + course.volume + '/module-1/index.html';
    doc.pages[rel] = '2026-10-31';
  });
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
}

function main() {
  const shell = fs.readFileSync(path.join(ROOT, 'engineer-track', 'module-1.html'), 'utf8');
  const headerEnd = shell.indexOf('</header>');
  const footerStart = shell.indexOf('<footer>');
  if (headerEnd < 0 || footerStart < 0) throw new Error('shell markers missing');
  const header = shell.slice(0, headerEnd + '</header>'.length);
  const footer = shell.slice(footerStart);
  COURSES.forEach(function (course) {
    const rel = course.volume === null
      ? path.join('learn', 'design', 'module-1', 'index.html')
      : path.join('learn', 'volume-' + course.volume, 'module-1', 'index.html');
    const dest = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, pageHtml(course, header, footer));
    process.stdout.write('wrote ' + rel + '\n');
  });
  patchLearn(COURSES);
  stampDates(COURSES);
  console.log('free modules: ' + COURSES.length + ' checkout ' + CHECKOUT);
}

module.exports = { COURSES: COURSES, CHECKOUT: CHECKOUT, fitDescription: fitDescription };

if (require.main === module) main();
