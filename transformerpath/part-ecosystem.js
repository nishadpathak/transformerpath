/**
 * Market-realistic part ecosystem for TransformerPath 3D explorers.
 * Families: power | distribution | ct
 *
 * Each entry maps a clicked 3D assembly to:
 *   components / materials, factory machinery, and real-market OEMs & specialists
 *   (Hitachi Energy, Siemens Energy, SGB-SMIT, GE Vernova, MR, Weidmann, …)
 */
(function (root) {
  function entry(o) { return o; }

  var PARTS = [
    /* ───────── POWER TRANSFORMER (power3d / power500) ───────── */
    entry({
      id: 'core', family: 'power',
      match: [
        'Core — limbs', 'Top yoke, clamping', 'Core (limbs', 'Core (CRGO',
        'Core (limbs + bottom yoke)', 'Top yoke + clamping', 'Core (CRGO, resin',
        'Core (CRGO, VPI', 'Active part (core', '5-limb core', 'Magnetic core'
      ],
      title: 'Magnetic core & clamping',
      marketNote: 'Hitachi Energy, Siemens Energy and SGB-SMIT typically run Hi-B / domain-refined CRGO, step-lap joints and single-point core earthing — the same architecture shown here.',
      components: [
        { name: 'CRGO / Hi-B electrical steel', note: '0.23–0.27 mm laser domain-refined (Nippon, POSCO, TKES, Baosteel)' },
        { name: 'Core banding tape', note: 'Resin-glass hoop banding — no through-bolts on modern designs' },
        { name: 'Clamping frames & insulated tie rods', note: 'Frames earthed at one removable test link' },
        { name: 'Step-lap joint packets', note: '5–7 step mitred joints, cooling ducts in large cores' }
      ],
      machinery: [
        { name: 'Slitting line', note: 'Mother coil → limb/yoke strip widths' },
        { name: 'Cut-to-length / mitre shear', note: 'Step-lap geometry' },
        { name: 'Automatic stacking table', note: 'Limb build + yoke re-lay (GEORG, Heinrich, Laco…)' },
        { name: 'Banding station', note: 'Glass-tape hoop application' },
        { name: 'Annealing furnace (optional)', note: 'Stress relief for some Hi-B grades' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Power OEM — core design & build', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Power OEM', url: 'manufacturers.html' },
        { name: 'SGB-SMIT Group', role: 'Power & distribution OEM', url: 'manufacturers.html' },
        { name: 'GE Vernova / Prolec', role: 'Power OEM (Americas)', url: 'https://www.prolec.energy/' },
        { name: 'CRGO mills', role: 'Steel suppliers', url: 'components.html#core-steel' }
      ],
      detail3d: 'coretopology.html',
      sourceHint: 'Source CRGO, banding and clamping hardware — or ask OEMs who build this class of core.'
    }),
    entry({
      id: 'lv-winding', family: 'power',
      match: [
        'LV winding (33 kV', 'LV windings (inner)', 'LV winding (VPI)',
        'helical, CTC', 'LV helical'
      ],
      title: 'LV winding',
      marketNote: 'Large power units: helical CTC. Distribution & dry-type: foil or layer. Same sourcing logic OEMs use in RFQs.',
      components: [
        { name: 'CTC / foil / layer conductor', note: 'Copper (or Al foil on distribution)' },
        { name: 'End & pressure rings', note: 'Axial clamp of the coil' },
        { name: 'DDP / layer insulation', note: 'Diamond-dotted paper bonding' },
        { name: 'Cooling duct spacers', note: 'Pressboard sticks & wedges' }
      ],
      machinery: [
        { name: 'CTC / foil winding machine', note: 'Tuboly, Tuboly-Laco, BR Technologies…' },
        { name: 'Conductor pay-off & tensioner', note: 'Constant tension' },
        { name: 'Coil press', note: 'Sets final axial build' },
        { name: 'Vapour-phase / oven dry-out', note: 'Pre-tanking moisture removal' }
      ],
      manufacturers: [
        { name: 'Essex / CTC specialists', role: 'Conductor', url: 'components.html#ctc' },
        { name: 'Hitachi Energy / Siemens Energy / SGB', role: 'Wind in-house or specify', url: 'manufacturers.html' }
      ],
      detail3d: 'windings.html',
      sourceHint: 'Buyers typically RFQ CTC/foil + insulation pack, or full wound coils from OEMs.'
    }),
    entry({
      id: 'hv-winding', family: 'power',
      match: [
        'HV winding (132 kV', 'HV windings (outer)', 'HV winding (VPI',
        'HV winding (VPI open', 'continuous disc', 'Active part (core + windings)'
      ],
      title: 'HV winding',
      marketNote: 'Power: continuous/interleaved disc. Cast-resin: epoxy moulded coils. Impulse grading (static rings) is a Hitachi/Siemens standard ask.',
      components: [
        { name: 'Paper-covered Cu strip or cast-resin coil', note: 'Disc turns or epoxy moulding' },
        { name: 'Inter-disc spacers / resin fillers', note: 'Ducts + mechanical strength' },
        { name: 'Static end rings / shields', note: 'Line-end impulse grading' },
        { name: 'Lead exits', note: 'Crepe-wrapped or moulded leads' }
      ],
      machinery: [
        { name: 'Disc / layer winding machine', note: 'Horizontal or vertical' },
        { name: 'Epoxy casting plant (CRT)', note: 'Vacuum casting for cast-resin' },
        { name: 'Shielding / grading station', note: 'Static rings' },
        { name: 'Impulse prep / lead dressing', note: 'Type-test readiness' }
      ],
      manufacturers: [
        { name: 'Power & dry-type OEMs', role: 'Design & wind', url: 'manufacturers.html' },
        { name: 'Conductor / resin suppliers', role: 'Materials', url: 'components.html#hv-winding' }
      ],
      detail3d: 'windings.html',
      sourceHint: 'Source conductor + insulation, or finished HV coils from the OEM tier.'
    }),
    entry({
      id: 'tap-winding', family: 'power',
      match: ['Tapping / regulating winding'],
      title: 'Regulating / tap winding',
      marketNote: 'Coordinated with MR / Hitachi / Huaming OLTC layouts — tap lead geometry is part of the OEM design package.',
      components: [
        { name: 'Tap conductor', note: 'Separate regulating winding on large units' },
        { name: 'Tap leads to OLTC', note: 'Crepe-wrapped flexible leads' },
        { name: 'HV–tap barrier cylinders', note: 'Pressboard insulation' }
      ],
      machinery: [
        { name: 'Regulating-winding winder', note: 'Fine pitch, many taps' },
        { name: 'Lead forming bench', note: 'Dress into OLTC turret' }
      ],
      manufacturers: [
        { name: 'Transformer OEMs', role: 'Wind + lead dress', url: 'manufacturers.html' },
        { name: 'MR / Hitachi Energy OLTC', role: 'Coordinate tap map', url: 'oltc.html' }
      ],
      detail3d: 'windings.html',
      sourceHint: 'Usually sold as part of the active-part package with the OLTC.'
    }),
    entry({
      id: 'pressboard', family: 'power',
      match: ['pressboard', 'barrier cylinders', 'HV–tap barrier', 'Main HV'],
      title: 'Main insulation barriers',
      marketNote: 'Weidmann-class transformerboard remains the reference for Hitachi/Siemens/SGB barrier systems.',
      components: [
        { name: 'Transformerboard / pressboard', note: 'Cylinders, angle rings, washers' },
        { name: 'Machined spacers & wedges', note: 'Ducts + coil support' },
        { name: 'Laminated wood beams', note: 'Clamping & lead supports' }
      ],
      machinery: [
        { name: 'CNC pressboard machining', note: 'Custom shapes' },
        { name: 'Hot press / densification', note: 'High-density board' },
        { name: 'Vacuum dry-out', note: 'Insulation moisture control' }
      ],
      manufacturers: [
        { name: 'Weidmann / Munksjö / specialist mills', role: 'Insulation materials', url: 'components.html#pressboard' },
        { name: 'OEMs', role: 'Barrier system design', url: 'manufacturers.html' }
      ],
      sourceHint: 'Insulation kits are a major sourced BOM line — often Weidmann-spec equivalents.'
    }),
    entry({
      id: 'tank', family: 'power',
      match: [
        'Tank',
        'Tank, skid base', 'Cover bolting', 'Tank fittings', 'Main tank', 'Base channels',
        'Tank cover', 'Cover bolting & gasket', 'Base frame', 'under-carriage',
        'Lifting lugs', 'Rating &', 'Rating plate', 'Drain / sampling',
        'Base channels + rollers', 'Flanged haulage', 'haulage wheels', 'skid base',
        'jacking pads', 'Cover bolting & gasket joint', 'Tank fittings —',
        'Tank cover — hatches', 'hatches & core test link'
      ],
      title: 'Tank, cover & base',
      marketNote: 'Bell tanks on large Hitachi/Siemens units; corrugated walls on SGB-class distribution. C5-M paint systems common for coastal/Gulf specs.',
      components: [
        { name: 'Fabricated steel tank / enclosure', note: 'Bell, cover-joint or corrugated' },
        { name: 'Gaskets & O-rings', note: 'Nitrile/cork or Viton' },
        { name: 'Valves & earth pads', note: 'Drain, filter, sample, earthing' },
        { name: 'Rating plate & lifting', note: 'Contract data + haulage' }
      ],
      machinery: [
        { name: 'Plate cutting & rolling', note: 'Shell fab' },
        { name: 'Welding bay / robots', note: 'Seams & nozzles' },
        { name: 'Shot-blast & paint line', note: 'C3–C5 systems' },
        { name: 'Leak / vacuum test rig', note: 'Before active-part drop-in' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy / Siemens Energy / SGB-SMIT', role: 'Tank design (in-house or fab partners)', url: 'manufacturers.html' },
        { name: 'Specialist tank fabricators', role: 'Outsourced steelwork', url: 'components.html#tank' }
      ],
      sourceHint: 'Tanks are often local-content opportunities for EPC markets.'
    }),
    entry({
      id: 'oil', family: 'power',
      match: ['cooling oil', 'Insulating oil', 'Insulating & cooling oil', 'Insulating & cooling'],
      title: 'Insulating liquid',
      marketNote: 'IEC 60296 mineral oil still dominates; Hitachi/Siemens/SGB increasingly quote natural/synthetic esters for fire-safe and indoor sites.',
      components: [
        { name: 'Mineral transformer oil', note: 'IEC 60296' },
        { name: 'Natural / synthetic esters', note: 'K-class fire-safe' },
        { name: 'Sampling valves & kits', note: 'DGA programme' }
      ],
      machinery: [
        { name: 'Oil filtration / degassing plant', note: 'Mobile or fixed (e.g. Highvac, Filtervac)' },
        { name: 'Vacuum filling system', note: 'Dry fill under vacuum' },
        { name: 'Oil storage farm', note: 'Clean vs used segregation' }
      ],
      manufacturers: [
        { name: 'Nynas / Ergon / Shell', role: 'Mineral oil', url: 'components.html#transformer-oil' },
        { name: 'MIDEL / ester suppliers', role: 'Alternative fluids', url: 'components.html#transformer-oil' }
      ],
      sourceHint: 'Oil is a recurring OPEX/sourced commodity — specify brand + IEC grade in RFQs.'
    }),
    entry({
      id: 'hv-bushings', family: 'power',
      match: [
        '132 kV condenser bushings', 'Bushing mounting flanges', 'HV bushings',
        '400 kV HV bushings', 'condenser bushings', '132 kV condenser bushings (RIP'
      ],
      title: 'HV bushings',
      marketNote: 'RIP preferred on many new Hitachi/Siemens specs; OIP still widely installed. Turrets + bushing CTs are standard on power transformers.',
      components: [
        { name: 'OIP / RIP condenser bushings', note: 'HSP, RHM, Hitachi Energy, Siemens…' },
        { name: 'Bushing turrets', note: 'Tank nozzles' },
        { name: 'Bushing CTs', note: 'Ring-type metering/protection' },
        { name: 'Test taps', note: 'C1/C2, tan δ' }
      ],
      machinery: [
        { name: 'Condenser-core winder', note: 'Capacitive grading' },
        { name: 'Impregnation / curing autoclave', note: 'Oil or resin' },
        { name: 'Bushing test bay', note: 'AC, PD, capacitance' }
      ],
      manufacturers: [
        { name: 'HSP / RHM / Hitachi Energy / Siemens Energy', role: 'Bushing specialists', url: 'bushing.html' },
        { name: 'Transformer OEMs', role: 'Specify & integrate', url: 'manufacturers.html' }
      ],
      detail3d: 'bushing.html',
      sourceHint: 'Bushings are a classic sourced commodity — RFQ by kV, creepage, RIP/OIP, CT ratios.'
    }),
    entry({
      id: 'lv-bushings', family: 'power',
      match: [
        '33 kV bushings', 'LV bushings (4', 'LV bushings', '220 kV LV bushings',
        'Neutral + tertiary', 'neutral bushing', 'HV neutral',
        '33 kV bushings + HV neutral'
      ],
      title: 'LV / MV terminations',
      marketNote: 'DIN porcelain, epoxy, or plug-in elbows on distribution; high-current LV bushings on power.',
      components: [
        { name: 'DIN / epoxy LV bushings', note: 'High current' },
        { name: 'Neutral bushing', note: 'HV or LV neutral' },
        { name: 'Cable boxes / plug-in elbows', note: 'Distribution terminations' }
      ],
      machinery: [
        { name: 'Epoxy casting line', note: 'Cast bushings' },
        { name: 'Porcelain assembly', note: 'Cementing & sealing' }
      ],
      manufacturers: [
        { name: 'Bushing & epoxy specialists', role: 'LV/MV terminations', url: 'bushing.html' },
        { name: 'OEMs', role: 'Integration', url: 'manufacturers.html' }
      ],
      detail3d: 'bushing.html',
      sourceHint: 'High-volume sourced item on distribution fleets.'
    }),
    entry({
      id: 'conservator', family: 'power',
      match: [
        'Conservator (2 compartments)', 'Conservator, Buchholz', 'Conservator tank',
        'Conservator', 'Magnetic oil-level', 'MOG', 'rubber-bag conservator'
      ],
      title: 'Conservator system',
      marketNote: 'Twin-compartment rubber-bag conservators remain Hitachi/Siemens/SGB default on free-breathing power tanks (main + OLTC oil kept separate); hermetic SGB-class distribution deletes the conservator entirely.',
      components: [
        { name: 'Conservator vessel (main + OLTC)', note: 'Oil expansion volume' },
        { name: 'Air cell / rubber bag', note: 'Stops air–oil contact' },
        { name: 'Magnetic oil-level gauges', note: 'Per compartment' },
        { name: 'Equalising / pipework', note: 'To Buchholz & RS' }
      ],
      machinery: [
        { name: 'Small tank fab', note: 'Conservator shells' },
        { name: 'Bag / cell fitment', note: 'Leak-tight' }
      ],
      manufacturers: [
        { name: 'Messko / Qualitrol + OEMs', role: 'Gauges & packages', url: 'components.html#buchholz' },
        { name: 'Hitachi Energy / Siemens Energy / SGB-SMIT', role: 'Tank breathing design', url: 'manufacturers.html' }
      ],
      sourceHint: 'Conservator shells are often local fab; gauges and bags are bought-in.'
    }),
    entry({
      id: 'prd', family: 'power',
      match: [
        'Pressure-relief', 'PRD', 'PRVs', 'spring PRD',
        'Tank cover — PRVs', 'Pressure relief devices'
      ],
      title: 'Pressure relief devices',
      marketNote: 'Spring PRDs with trip contacts are mandatory on sealed/power tanks across Hitachi/Siemens/SGB specs — often two on large covers.',
      components: [
        { name: 'Spring pressure-relief valve', note: 'Vent + flag / contact' },
        { name: 'PRD gasket & flange', note: 'Cover mount' }
      ],
      machinery: [{ name: 'PRD test bench', note: 'Set-point check' }],
      manufacturers: [
        { name: 'Qualitrol / Emco / specialists', role: 'PRD', url: 'components.html#prd' }
      ],
      sourceHint: 'Standard sourced accessory — easy upsell for suppliers.'
    }),
    entry({
      id: 'temperature-devices', family: 'power',
      match: [
        'OTI/WTI', 'OTI', 'WTI', 'thermometer pockets',
        'Oil / winding temperature', 'winding temperature',
        'temperature instrument'
      ],
      title: 'OTI / WTI temperature devices',
      marketNote: 'Top-oil and winding-temperature indicators stage fans/pumps and provide trip — Hitachi/Siemens/SGB fleet practice; fibre hotspot probes increasingly specified on critical units.',
      components: [
        { name: 'OTI / WTI instruments', note: 'Fan staging & trip' },
        { name: 'Thermometer pockets', note: 'Cover / tank wall' },
        { name: 'Fibre hotspot probes (option)', note: 'Direct winding temp' }
      ],
      machinery: [{ name: 'Instrument calibration', note: 'Resistance / curve' }],
      manufacturers: [
        { name: 'Qualitrol / Messko / specialists', role: 'Thermal instruments', url: 'components.html' }
      ],
      sourceHint: 'Bought-in protection package — name the make on the datasheet.'
    }),
    entry({
      id: 'radiators', family: 'power',
      match: [
        'Radiator banks', 'Panel radiator', 'radiator banks',
        'ONAN/ONAF/OFAF', 'detachable radiators', 'Radiator banks, fans'
      ],
      title: 'Radiator banks & cooling fans',
      marketNote: 'Detachable pressed-plate radiators + staged ONAF fans are Hitachi Energy / Siemens Energy power practice; ≥1600 kVA distribution often moves from corrugated fins to the same detachable banks.',
      components: [
        { name: 'Pressed-steel radiator panels', note: '~520 mm elements on headers' },
        { name: 'Cooling fans', note: 'ONAF₁ / ONAF₂ stages' },
        { name: 'Radiator butterfly valves', note: 'Isolate for transport' },
        { name: 'Top/bottom collector headers', note: 'Tank-wall flanges' }
      ],
      machinery: [
        { name: 'Radiator panel press', note: 'Formed panels' },
        { name: 'Header welding line', note: 'Bank assembly' },
        { name: 'Fan test stand', note: 'Airflow verification' }
      ],
      manufacturers: [
        { name: 'Radiator specialists + OEMs', role: 'Cooling hardware', url: 'components.html#radiators' },
        { name: 'Hitachi Energy / Siemens Energy', role: 'Cooling design', url: 'manufacturers.html' }
      ],
      sourceHint: 'Radiators and fans are high-volume sourced parts — strong supplier marketplace fit.'
    }),
    entry({
      id: 'oil-pumps', family: 'power',
      match: [
        'Oil pumps', 'oil pump', 'OFAF pumps', 'forced-oil pumps',
        'pumps & valves', 'Oil circulating pumps'
      ],
      title: 'Forced-oil pumps',
      marketNote: 'OFAF/ODAF duty on large Hitachi/Siemens units: tank-wall or header-mounted pumps with flow indicators, staged by WTI. Not used on small ONAN distribution.',
      components: [
        { name: 'Oil circulating pumps', note: 'Magnetic-drive preferred' },
        { name: 'Flow indicators', note: 'Confirm OFAF loop' },
        { name: 'Pump valves & flanges', note: 'Isolation for service' }
      ],
      machinery: [
        { name: 'Pump test / flow stand', note: 'Head & flow check' }
      ],
      manufacturers: [
        { name: 'Pump OEMs + transformer makers', role: 'Forced cooling', url: 'components.html#radiators' }
      ],
      sourceHint: 'Named bought-in item on power BOMs — specify flow, head and oil compatibility.'
    }),
    entry({
      id: 'bushing-turrets', family: 'power',
      match: [
        'bushing turrets', 'turrets & bushing CTs', 'Turret',
        'Bushing CT rings', 'turret CT'
      ],
      title: 'Bushing turrets & CTs',
      marketNote: 'Power practice (Hitachi/Siemens/SGB large units): each HV/MV bushing sits on a turret that also houses multi-ratio bushing CTs for differential, REF and backup — a standard sourced CT line.',
      components: [
        { name: 'Steel turrets / nozzles', note: 'Tank penetrations' },
        { name: 'Ring-type bushing CTs', note: 'Protection & metering ratios' },
        { name: 'CT secondary leads', note: 'To marshalling' }
      ],
      machinery: [
        { name: 'Turret fab & weld', note: 'Nozzle geometry' },
        { name: 'CT ratio / polarity test', note: 'IEC 61869' }
      ],
      manufacturers: [
        { name: 'IT / bushing-CT specialists', role: 'Ring CTs', url: 'ct3d.html' },
        { name: 'Power OEMs', role: 'Turret design', url: 'manufacturers.html' }
      ],
      detail3d: 'ct3d.html',
      sourceHint: 'Bushing CTs are a classic RFQ line — specify ratios, accuracy class and ID/OD.'
    }),
    entry({
      id: 'buchholz', family: 'power',
      match: [
        'Buchholz relay', 'Buchholz', 'RS relay', 'oil-surge relay',
        'gas relay'
      ],
      title: 'Buchholz & oil-surge relays',
      marketNote: 'Messko/Qualitrol-class Buchholz on the conservator pipe remains mandatory on free-breathing Hitachi/Siemens/SGB power tanks; RS (oil-surge) relays protect the OLTC diverter compartment.',
      components: [
        { name: 'Buchholz relay', note: 'Gas alarm + surge trip' },
        { name: 'RS / oil-surge relay', note: 'OLTC diverter pipe' },
        { name: 'Isolating valves', note: 'In-service relay test' }
      ],
      machinery: [
        { name: 'Relay calibration bench', note: 'Trip settings' }
      ],
      manufacturers: [
        { name: 'Messko / Qualitrol / Emco', role: 'Gas & surge relays', url: 'components.html#buchholz' }
      ],
      sourceHint: 'Almost always a named bought-in protection device — specify make/model on the datasheet.'
    }),
    entry({
      id: 'breathers', family: 'power',
      match: [
        'breather', 'Silica-gel breather', 'maintenance-free breather',
        'dehydrating breather'
      ],
      title: 'Dehydrating breathers',
      marketNote: 'Silica-gel or maintenance-free regenerating breathers on each conservator compartment — Hitachi/Siemens/SGB standard on free-breathing tanks; hermetic distribution deletes them.',
      components: [
        { name: 'Silica-gel / regenerating breather', note: 'Dry every breath' },
        { name: 'Breather pipework', note: 'Conservator end' },
        { name: 'Oil seal / cup', note: 'Classic designs' }
      ],
      machinery: [{ name: 'Breather assembly', note: 'Fill & seal' }],
      manufacturers: [
        { name: 'Messko / Qualitrol / specialists', role: 'Breathers', url: 'components.html#buchholz' }
      ],
      sourceHint: 'High-volume accessory — easy supplier feature on power and free-breathing distribution.'
    }),
    entry({
      id: 'oltc', family: 'power',
      match: [
        'On-load tap-changer', 'OLTC position indicator', 'On-load tap-changer (OLTC)',
        'OLTC motor', 'motor-drive'
      ],
      title: 'On-load tap-changer',
      marketNote: 'MR (Reinhausen) dominates globally; Hitachi Energy and Huaming are major alternatives on Siemens/Hitachi/SGB platforms.',
      components: [
        { name: 'OLTC diverter (vacuum/oil)', note: 'MR VACUTAP / OILTAP class' },
        { name: 'Motor-drive mechanism', note: 'Position TX & controller' },
        { name: 'OLTC oil filter (if oil type)', note: 'Diverter maintenance' },
        { name: 'Drive conduit & indicator', note: 'Deck routing' }
      ],
      machinery: [
        { name: 'Precision machining cells', note: 'Contacts & housings' },
        { name: 'Vacuum interrupter assembly', note: 'Vacuum OLTCs' },
        { name: 'Life / type-test rigs', note: 'Switching endurance' }
      ],
      manufacturers: [
        { name: 'Maschinenfabrik Reinhausen (MR)', role: 'Global OLTC leader', url: 'oltc.html' },
        { name: 'Hitachi Energy', role: 'OLTC + transformers', url: 'manufacturers.html' },
        { name: 'Huaming / others', role: 'OLTC alternatives', url: 'components.html#oltc' }
      ],
      detail3d: 'oltc.html',
      sourceHint: 'Almost always a named bought-in product on the transformer BOM.'
    }),
    entry({
      id: 'monitoring', family: 'power',
      match: [
        'Marshalling cabinet, online DGA', 'online DGA', 'Marshalling cabinet',
        'Control cabling', 'DGA monitor'
      ],
      title: 'Monitoring & marshalling',
      marketNote: 'Online DGA + fibre hot-spot is now common on Hitachi/Siemens fleet-critical units; Qualitrol/Serveron ecosystem is widely specified.',
      components: [
        { name: 'Online DGA monitor', note: 'Multi-gas or hydrogen' },
        { name: 'OTI / WTI / PT100', note: 'Thermal protection' },
        { name: 'Marshalling cabinet', note: 'All secondaries' },
        { name: 'Fibre hot-spot sensors', note: 'Optional winding sensors' }
      ],
      machinery: [
        { name: 'Panel wiring benches', note: 'Marshalling build' },
        { name: 'Sensor calibration', note: 'Gas & temperature' }
      ],
      manufacturers: [
        { name: 'Qualitrol / Serveron / GE', role: 'DGA & monitoring', url: 'components.html#dga' },
        { name: 'OEMs', role: 'Package & commission', url: 'manufacturers.html' }
      ],
      sourceHint: 'Monitoring is a high-margin sourced add-on for suppliers.'
    }),
    entry({
      id: 'arresters', family: 'power',
      match: ['surge arresters'],
      title: 'Surge arresters',
      marketNote: 'ZnO arresters coordinated to BIL — Hitachi Energy, Siemens and ABB/Hitachi lines dominate utility specs.',
      components: [
        { name: 'ZnO metal-oxide arresters', note: 'Close to HV bushings' },
        { name: 'Leakage monitors', note: 'Inspection aids' }
      ],
      machinery: [{ name: 'Arrester assembly & test', note: 'IEC 60099' }],
      manufacturers: [
        { name: 'Hitachi Energy / Siemens Energy', role: 'Arrester makers', url: 'components.html#surge-arresters' },
        { name: 'EPCs & OEMs', role: 'Insulation coordination', url: 'manufacturers.html' }
      ],
      sourceHint: 'Switchyard commodity — source by rated voltage & protective level.'
    }),
    /* ───────── DISTRIBUTION — OIL (SGB-class pad / pole) ───────── */
    entry({
      id: 'dist-core', family: 'distribution',
      match: [
        'Core (limbs + bottom yoke)', 'Top yoke + clamping frame',
        'Distribution core', 'SGB core', 'oil distribution core'
      ],
      title: 'Distribution magnetic core',
      marketNote: 'SGB-SMIT, Hitachi Energy and Siemens Energy distribution lines use step-lap CRGO (often Hi-B) with single-point earthing — same stacking architecture as power, sized for pad/pole losses and noise.',
      components: [
        { name: 'Step-lap CRGO packets', note: 'Limb + yoke' },
        { name: 'Clamping frames & banding', note: 'No through-bolts' },
        { name: 'Core earth link', note: 'Single-point testable' }
      ],
      machinery: [
        { name: 'Cut-to-length / mitre line', note: 'Step-lap' },
        { name: 'Stacking table', note: 'High-volume DT build' }
      ],
      manufacturers: [
        { name: 'SGB-SMIT / Hitachi Energy / Siemens Energy', role: 'Distribution OEMs', url: 'manufacturers.html' },
        { name: 'CRGO mills', role: 'Steel', url: 'components.html#core-steel' }
      ],
      detail3d: 'explorer.html?mode=oil',
      sourceHint: 'Source CRGO packets and clamps — or the complete active part from distribution OEMs.'
    }),
    entry({
      id: 'dist-lv', family: 'distribution',
      match: [
        'LV windings (inner)', 'Distribution LV', 'foil/layer LV (distribution)'
      ],
      title: 'Distribution LV winding',
      marketNote: 'Distribution LV is typically layer or foil (Al or Cu) — high current, few turns. SGB/Hitachi/Siemens quote foil increasingly above a few hundred kVA for SC strength.',
      components: [
        { name: 'Layer / foil conductor', note: 'Cu or Al' },
        { name: 'DDP / interlayer insulation', note: 'Bonded build' },
        { name: 'End rings & ducts', note: 'Axial oil flow' }
      ],
      machinery: [
        { name: 'Foil / layer winder', note: 'High throughput' },
        { name: 'Coil press & dry-out', note: 'Pre-tanking' }
      ],
      manufacturers: [
        { name: 'Distribution OEMs', role: 'Wind in-house', url: 'manufacturers.html' },
        { name: 'Conductor mills', role: 'Foil / wire', url: 'components.html' }
      ],
      sourceHint: 'RFQ conductor alloy and insulation class, or finished LV coils.'
    }),
    entry({
      id: 'dist-hv', family: 'distribution',
      match: [
        'HV windings (outer)', 'Distribution HV', 'layer HV (distribution)'
      ],
      title: 'Distribution HV winding',
      marketNote: 'MV distribution HV is usually multi-layer with inter-layer insulation and electrostatic shields as required — SGB/Hitachi/Siemens padmount and unit-substation practice.',
      components: [
        { name: 'Paper/enamel Cu or Al wire', note: 'Layer wound' },
        { name: 'Inter-layer insulation', note: 'DDP / film' },
        { name: 'Tap leads (DETC/OLTC)', note: 'To tap board or OLTC' }
      ],
      machinery: [
        { name: 'Layer winding machine', note: 'Horizontal/vertical' },
        { name: 'Lead dress bench', note: 'Tap exits' }
      ],
      manufacturers: [
        { name: 'SGB-SMIT / Hitachi / Siemens distribution', role: 'OEM wind', url: 'manufacturers.html' }
      ],
      sourceHint: 'Often wound in-house by the DT OEM — source conductor + insulation pack if localising.'
    }),
    entry({
      id: 'dist-tank', family: 'distribution',
      match: [
        'Tank', 'Hermetic tank', 'distribution tank', 'Oil distribution tank',
        'Cover bolting & gasket joint', 'Base channels + rollers'
      ],
      title: 'Distribution tank & base',
      marketNote: 'SGB-class practice: welded mild-steel tank, often hermetic (cover welded) with corrugated walls doing the cooling. Free-breathing units keep a small conservator. C3–C5 paint for coastal/industrial sites.',
      components: [
        { name: 'Fabricated steel tank', note: 'Hermetic or bolted cover' },
        { name: 'Gaskets or weld seal', note: 'Leak integrity' },
        { name: 'Base channels + rollers', note: 'Haulage' },
        { name: 'C3–C5 paint system', note: 'Corrosion class' }
      ],
      machinery: [
        { name: 'Plate cut / weld bay', note: 'Tank fab' },
        { name: 'Leak / vacuum test', note: 'Before oil fill' },
        { name: 'Shot-blast & paint', note: 'Finish system' }
      ],
      manufacturers: [
        { name: 'SGB-SMIT / Hitachi Energy / Siemens Energy', role: 'DT OEMs', url: 'manufacturers.html' },
        { name: 'Local tank fabricators', role: 'Local content', url: 'components.html#tank' }
      ],
      detail3d: 'explorer.html?mode=oil',
      sourceHint: 'Tanks are a prime local-content opportunity on distribution fleets.'
    }),
    entry({
      id: 'dist-oil', family: 'distribution',
      match: ['Insulating oil', 'Distribution oil', 'hermetic oil fill'],
      title: 'Distribution insulating liquid',
      marketNote: 'IEC 60296 mineral oil dominates pad/pole fleets; Hitachi/Siemens/SGB increasingly offer natural esters for indoor / fire-sensitive sites. Hermetic fills are processed and sealed for life.',
      components: [
        { name: 'Mineral oil IEC 60296', note: 'Standard fill' },
        { name: 'Natural / synthetic ester (option)', note: 'K-class fire-safe' },
        { name: 'Sample / drain fittings', note: 'Even on hermetic units' }
      ],
      machinery: [
        { name: 'Vacuum fill / degas plant', note: 'Factory fill' },
        { name: 'Oil filtration rig', note: 'Service' }
      ],
      manufacturers: [
        { name: 'Nynas / Ergon / MIDEL…', role: 'Fluids', url: 'components.html#transformer-oil' }
      ],
      sourceHint: 'Specify brand + IEC grade in every DT RFQ — recurring commodity.'
    }),
    entry({
      id: 'dist-cover-prd', family: 'distribution',
      match: [
        'Tank cover (+ PRV', 'Tank cover (+ PRV, OTI/WTI pockets)',
        'Distribution PRV', 'OTI/WTI pockets'
      ],
      title: 'Distribution cover, PRV & pockets',
      marketNote: 'Even hermetic SGB-class tanks carry a PRV and thermometer pockets; free-breathing covers also take bushings and the conservator pipe.',
      components: [
        { name: 'Cover plate', note: 'Bolted or welded hermetic' },
        { name: 'Pressure-relief valve', note: 'Spring + contact' },
        { name: 'OTI / WTI pockets', note: 'Thermal protection' }
      ],
      machinery: [{ name: 'Cover fab & drill', note: 'Pocket & PRV holes' }],
      manufacturers: [
        { name: 'Qualitrol / Emco + DT OEMs', role: 'PRV & gauges', url: 'components.html#prd' }
      ],
      sourceHint: 'PRV and pockets are standard sourced accessories on every DT datasheet.'
    }),
    entry({
      id: 'dist-hv-bushings', family: 'distribution',
      match: ['HV bushings (3)', 'Distribution HV bushings', 'MV porcelain bushings'],
      title: 'Distribution HV bushings',
      marketNote: '≤36 kV solid porcelain or epoxy is SGB/Hitachi/Siemens distribution standard; plug-in elbows on many padmounts. Creepage dominates coastal/desert specs.',
      components: [
        { name: 'Porcelain / epoxy HV bushings', note: 'Solid ≤36 kV' },
        { name: 'Plug-in elbows (padmount)', note: 'Dead-front option' },
        { name: 'Shed / creepage design', note: 'Pollution class' }
      ],
      machinery: [
        { name: 'Porcelain / epoxy assembly', note: 'Cementing & seal' }
      ],
      manufacturers: [
        { name: 'Bushing specialists + DT OEMs', role: 'MV terminations', url: 'bushing.html' }
      ],
      detail3d: 'bushing.html',
      sourceHint: 'High-volume sourced item — RFQ by kV, creepage and connection style.'
    }),
    entry({
      id: 'dist-lv-bushings', family: 'distribution',
      match: ['LV bushings (4: a-b-c-n)', 'LV bushings (4', 'Distribution LV bushings'],
      title: 'Distribution LV bushings',
      marketNote: 'Four bushings (a-b-c-n) on Dyn11 distribution — high current palms for bus or cable. Epoxy and DIN porcelain dominate SGB-class fleets.',
      components: [
        { name: 'LV porcelain / epoxy bushings', note: 'Phases + neutral' },
        { name: 'Palm / stud terminals', note: 'Cable or bus' }
      ],
      machinery: [{ name: 'Bushing assembly', note: 'Seal & torque' }],
      manufacturers: [
        { name: 'Bushing specialists', role: 'LV terminations', url: 'bushing.html' }
      ],
      sourceHint: 'Highest-volume bushing line on distribution — strong marketplace fit.'
    }),
    entry({
      id: 'dist-conservator', family: 'distribution',
      match: [
        'Conservator, Buchholz relay & breather',
        'Distribution conservator', 'free-breathing distribution'
      ],
      title: 'Distribution conservator (free-breathing)',
      marketNote: 'Free-breathing SGB/Hitachi/Siemens distribution units keep a small conservator + Buchholz + silica-gel breather. Hermetic corrugated designs delete this assembly — confirm which architecture the RFQ wants.',
      components: [
        { name: 'Small conservator', note: 'Oil expansion' },
        { name: 'Buchholz relay', note: 'Gas / surge' },
        { name: 'Silica-gel breather', note: 'Dry breath' }
      ],
      machinery: [{ name: 'Small vessel fab', note: 'Conservator' }],
      manufacturers: [
        { name: 'Messko / Qualitrol + DT OEMs', role: 'Protection package', url: 'components.html#buchholz' }
      ],
      sourceHint: 'Only on free-breathing DTs — hermetic RFQs omit this BOM line.'
    }),
    entry({
      id: 'corrugated-tank', family: 'distribution',
      match: [
        'Corrugated fin walls', 'Corrugated fin', 'ONAN cooling',
        'corrugated walls', 'fin walls (ONAN'
      ],
      title: 'Corrugated fin walls (ONAN)',
      marketNote: 'Defining SGB-class distribution feature: deep corrugated fins are both radiator and expansion volume (ONAN). Hermetic designs use fin elasticity instead of a conservator. ≥1600 kVA often moves to detachable radiators.',
      components: [
        { name: 'Corrugated steel fin packs', note: 'Deep vertical fins' },
        { name: 'Top/bottom closing strips', note: 'Fin pack seal' },
        { name: 'C3–C5 paint', note: 'Fin corrosion protection' }
      ],
      machinery: [
        { name: 'Corrugation press line', note: 'Fin forming' },
        { name: 'Fin-to-tank weld / leak test', note: 'Vacuum integrity' }
      ],
      manufacturers: [
        { name: 'SGB-SMIT / Hitachi Energy / Siemens Energy', role: 'Corrugated DT OEMs', url: 'manufacturers.html' },
        { name: 'Tank fabricators', role: 'Local fin packs', url: 'components.html#tank' }
      ],
      detail3d: 'explorer.html?mode=oil',
      sourceHint: 'Corrugated tanks are a high-volume sourced fab line — RFQ by kVA, BIL and paint class.'
    }),
    entry({
      id: 'dist-oltc', family: 'distribution',
      match: [
        'On-load tap-changer (OLTC)', 'distribution OLTC', 'ECOTAP',
        'compact OLTC'
      ],
      title: 'Distribution OLTC',
      marketNote: 'When LV must track load, SGB/Hitachi/Siemens specify compact OLTCs (often MR ECOTAP or vacuum) — same OEM ecosystem as power, smaller frame. Most padmounts still ship DETC-only.',
      components: [
        { name: 'Compact OLTC', note: 'Vacuum or oil diverter' },
        { name: 'Motor drive / AVR interface', note: 'SCADA ready' },
        { name: 'Tap leads', note: 'From HV winding' }
      ],
      machinery: [
        { name: 'OLTC test stand', note: 'Timing / operations' }
      ],
      manufacturers: [
        { name: 'Maschinenfabrik Reinhausen', role: 'ECOTAP & compact OLTCs', url: 'oltc.html' },
        { name: 'Distribution OEMs', role: 'Integrate', url: 'manufacturers.html' }
      ],
      detail3d: 'oltc.html',
      sourceHint: 'Named bought-in product when specified — changes the entire DT BOM vs DETC.'
    }),
    entry({
      id: 'dist-detc', family: 'distribution',
      match: [
        'Off-circuit tap-changer', 'DETC', 'de-energised tap',
        'Off-circuit taps (distribution)', 'tap board (DETC)'
      ],
      title: 'Distribution DETC (off-circuit taps)',
      marketNote: 'Default on most SGB/Hitachi/Siemens distribution units: bolted or rotary off-circuit taps (±2×2.5% typical). Must be changed de-energised — cheap, reliable, high volume.',
      components: [
        { name: 'DETC / tap board', note: 'Bolted links or rotary' },
        { name: 'Tap leads from HV', note: 'Crepe or board' },
        { name: 'External operating handle (option)', note: 'Padmount access' }
      ],
      machinery: [{ name: 'Tap-board assembly', note: 'Lead dress' }],
      manufacturers: [
        { name: 'DT OEMs + tap-switch specialists', role: 'DETC kits', url: 'manufacturers.html' }
      ],
      sourceHint: 'Integral to most DT active parts — specify tap range and steps in the RFQ.'
    }),
    entry({
      id: 'dist-fittings', family: 'distribution',
      match: [
        'Tank fittings — lugs, rating plate, drain valve, earth pad',
        'drain valve, earth pad', 'Distribution fittings',
        'oil sampling valve'
      ],
      title: 'Distribution tank fittings',
      marketNote: 'Lifting lugs, rating plate, drain/filter valve, sampling point and earthing pads are mandatory on SGB-class tanks — even hermetic units keep a sample valve for DGA programmes.',
      components: [
        { name: 'Lifting lugs', note: 'Oil-filled mass rating' },
        { name: 'Rating plate', note: 'Contract data' },
        { name: 'Drain / filter / sample valves', note: 'Service points' },
        { name: 'Earthing pads', note: 'Tank bonding' }
      ],
      machinery: [{ name: 'Fitting weld / install', note: 'Leak check' }],
      manufacturers: [
        { name: 'Valve & fitting specialists + OEMs', role: 'Tank accessories', url: 'components.html' }
      ],
      sourceHint: 'High-volume sourced accessories — strong supplier feature slots.'
    }),

    /* ───────── CAST-RESIN (Siemens GEAFOL / Hitachi RESIBLOC / SGB CRT) ───────── */
    entry({
      id: 'crt-core', family: 'castresin',
      match: [
        'Core (CRGO, resin-coated)', 'Core (CRGO, CRT', 'CRT core',
        'Core (CRGO, resin', 'resin-coated)',
        'Top yoke + clamping frame', 'Top yoke + clamping frame (CRT'
      ],
      title: 'Cast-resin magnetic core',
      marketNote: 'Siemens GEAFOL, Hitachi RESIBLOC and SGB cast-resin lines use step-lap CRGO with resin/varnish coating (no oil protection) and slightly lower Bm for noise in buildings — same architecture shown here.',
      components: [
        { name: 'Step-lap CRGO / Hi-B core', note: 'Resin- or varnish-coated' },
        { name: 'Clamping frames & insulated tie-rods', note: 'Single-point earthing' },
        { name: 'Lifting eyes on top frame', note: 'Never sling coils' }
      ],
      machinery: [
        { name: 'Cut-to-length / mitre line', note: 'Step-lap packets' },
        { name: 'Stacking table', note: 'Limb + yoke build' },
        { name: 'Core coating / varnish station', note: 'Corrosion seal' }
      ],
      manufacturers: [
        { name: 'Siemens Energy (GEAFOL)', role: 'CRT OEM', url: 'manufacturers.html' },
        { name: 'Hitachi Energy (RESIBLOC)', role: 'CRT OEM', url: 'manufacturers.html' },
        { name: 'SGB-SMIT', role: 'Cast-resin OEM', url: 'manufacturers.html' }
      ],
      detail3d: 'castresin3d.html',
      sourceHint: 'Source CRGO + coating, or buy the wound active part from CRT OEMs.'
    }),
    entry({
      id: 'crt-lv-foil', family: 'castresin',
      match: [
        'LV foil windings', 'LV foil', 'LV foil winding (CRT',
        'Aluminium foil LV', 'foil windings'
      ],
      title: 'CRT LV foil winding',
      marketNote: 'Full-height Al or Cu foil with class-F prepreg is the GEAFOL/RESIBLOC/SGB standard LV — each turn spans winding height so axial SC forces self-balance.',
      components: [
        { name: 'Al / Cu foil conductor', note: 'Full-height turns' },
        { name: 'Class-F / H prepreg interlayer', note: 'Oven-cured tube' },
        { name: 'Cooling duct spacers', note: 'Axial air channels' },
        { name: 'LV busbar stubs', note: 'Upward or side exit' }
      ],
      machinery: [
        { name: 'Foil winding machine', note: 'Constant tension' },
        { name: 'Curing oven', note: 'Prepreg set' },
        { name: 'Coil press', note: 'Final build' }
      ],
      manufacturers: [
        { name: 'CRT OEMs (Siemens / Hitachi / SGB)', role: 'Wind in-house', url: 'manufacturers.html' },
        { name: 'Foil & prepreg mills', role: 'Materials', url: 'components.html' }
      ],
      detail3d: 'castresin3d.html',
      sourceHint: 'RFQ foil alloy, width, prepreg class — or finished LV coils from the OEM tier.'
    }),
    entry({
      id: 'crt-hv-coil', family: 'castresin',
      match: [
        'HV cast-resin coils', 'HV cast-resin', 'cast-resin coils',
        'epoxy HV', 'vacuum-cast', 'delta links'
      ],
      title: 'Vacuum-cast HV epoxy coils',
      marketNote: 'Defining CRT feature: HV winding vacuum-cast in silica-filled glass-epoxy (Siemens GEAFOL / Hitachi RESIBLOC / SGB). Every coil PD-tested (<10 pC). E2/E3 humidity + F1 fire classes are the European market ask.',
      components: [
        { name: 'Vacuum-cast epoxy HV coil', note: 'Silica-filled, glass-reinforced' },
        { name: 'HV delta / star links', note: 'Top copper bars' },
        { name: 'Static end rings (as required)', note: 'Impulse grading' },
        { name: 'HV porcelain / epoxy terminals', note: 'Cable or bus' }
      ],
      machinery: [
        { name: 'Epoxy vacuum casting plant', note: 'Mould fill under vacuum' },
        { name: 'Curing oven / autoclave', note: 'Cross-link cycle' },
        { name: 'PD / impulse test bay', note: 'IEC 60076-11' }
      ],
      manufacturers: [
        { name: 'Siemens Energy GEAFOL', role: 'CRT OEM', url: 'manufacturers.html' },
        { name: 'Hitachi Energy RESIBLOC', role: 'CRT OEM', url: 'manufacturers.html' },
        { name: 'SGB-SMIT / TMC / others', role: 'Cast-resin OEMs', url: 'manufacturers.html' },
        { name: 'Epoxy & filler suppliers', role: 'Resin systems', url: 'components.html' }
      ],
      detail3d: 'castresin3d.html',
      sourceHint: 'HV cast coils are the premium sourced CRT BOM line — RFQ by kV, BIL, E/C/F class string.'
    }),
    entry({
      id: 'crt-air-ducts', family: 'castresin',
      match: [
        'Cooling air ducts', 'LV–HV air duct', 'air ducts (CRT',
        'axial cooling ducts'
      ],
      title: 'CRT cooling air ducts',
      marketNote: 'Axial ducts between LV foil and HV cast coil set AN rating; AF fans boost 40–50%. Same duct philosophy across GEAFOL / RESIBLOC / SGB.',
      components: [
        { name: 'Glass / polyester duct spacers', note: 'Define air channels' },
        { name: 'Air baffles / guides', note: 'Directed flow on AF' }
      ],
      machinery: [
        { name: 'Spacer cutting / moulding', note: 'Duct geometry' }
      ],
      manufacturers: [
        { name: 'CRT OEMs & insulation specialists', role: 'Duct kits', url: 'manufacturers.html' }
      ],
      sourceHint: 'Duct kit is part of the active-part insulation package.'
    }),
    entry({
      id: 'crt-fans', family: 'castresin',
      match: [
        'Cross-flow fans', 'Cross-flow fans (AN', 'AF fans',
        'fan trays', 'AN → AF'
      ],
      title: 'AF cooling fans',
      marketNote: 'Fan trays under coils add AF rating — staged by PT100/PT1000 relay. Standard option on Siemens/Hitachi/SGB indoor CRTs for peak or emergency load.',
      components: [
        { name: 'Cross-flow / axial fans', note: 'Low-noise building duty' },
        { name: 'Fan trays & guards', note: 'Under-coil mount' },
        { name: 'Fan contactor / staging', note: 'From temp relay' }
      ],
      machinery: [
        { name: 'Fan balance & airflow test', note: 'Noise + CFM' }
      ],
      manufacturers: [
        { name: 'Fan OEMs + CRT makers', role: 'AF option', url: 'components.html' }
      ],
      sourceHint: 'High-volume accessory — source by airflow, IP, and noise class.'
    }),
    entry({
      id: 'crt-sensors', family: 'castresin',
      match: [
        'PT100 marshalling', 'PT100', 'temperature relay',
        'LV terminals + PT100', 'thermal sensors'
      ],
      title: 'CRT thermal sensors & relay',
      marketNote: 'PT100s in LV ducts (3+spare) + temperature relay for alarm/trip/fan control is mandatory practice on GEAFOL/RESIBLOC/SGB indoor units.',
      components: [
        { name: 'PT100 / PT1000 sensors', note: 'Embedded in LV ducts' },
        { name: 'Temperature relay', note: 'Alarm, trip, AF stages' },
        { name: 'Marshalling box', note: 'Sensor terminations' }
      ],
      machinery: [
        { name: 'Sensor calibration bench', note: 'Resistance check' }
      ],
      manufacturers: [
        { name: 'Trafag / Qualitrol / OEM kits', role: 'Sensors & relays', url: 'components.html' },
        { name: 'CRT OEMs', role: 'Package wiring', url: 'manufacturers.html' }
      ],
      sourceHint: 'Bought-in protection package — specify sensor count and relay make in the datasheet.'
    }),
    entry({
      id: 'crt-taps', family: 'castresin',
      match: [
        'Off-circuit tap links', 'DETC links', 'tap links (CRT',
        'HV tap board'
      ],
      title: 'CRT off-circuit taps',
      marketNote: 'Most cast-resin units use bolted off-circuit tap links on the HV coil (±2×2.5% typical). OLTC is rare indoors; Hitachi/Siemens/SGB quote DETC as default.',
      components: [
        { name: 'Bolted tap links / board', note: 'De-energised change' },
        { name: 'Tap leads from HV cast coil', note: 'Epoxy exits' }
      ],
      machinery: [
        { name: 'Tap-board assembly', note: 'Labelled links' }
      ],
      manufacturers: [
        { name: 'CRT OEMs', role: 'Tap map with coil', url: 'manufacturers.html' }
      ],
      sourceHint: 'Usually integral to the HV cast coil — source as part of the winding package.'
    }),
    entry({
      id: 'enclosure-dry', family: 'castresin',
      match: [
        'Ventilated enclosure', 'Ventilated enclosure (IP', 'enclosure (VPI',
        'Lifting eyes & rating plate', 'IP21/23/31', 'IP21/23'
      ],
      title: 'CRT / dry-type enclosure',
      marketNote: 'IP21–IP33 ventilated housings as used on Siemens GEAFOL, Hitachi RESIBLOC and SGB indoor CRTs; IP54 needs derating or forced air.',
      components: [
        { name: 'Sheet-steel enclosure', note: 'Louvre / mesh panels' },
        { name: 'Door interlocks & earthing', note: 'Safety' },
        { name: 'Cable entry plates', note: 'Bottom/side gland plates' },
        { name: 'Anti-condensation heaters (option)', note: 'Humid sites' }
      ],
      machinery: [
        { name: 'Sheet-metal CNC & paint', note: 'Enclosure fab' }
      ],
      manufacturers: [
        { name: 'Dry-type OEMs (Siemens, SGB, Hitachi…)', role: 'Package', url: 'manufacturers.html' },
        { name: 'Local sheet-metal shops', role: 'Local content', url: 'manufacturers.html' }
      ],
      detail3d: 'castresin3d.html',
      sourceHint: 'Enclosures are often local-content fabrication — strong supplier opportunity.'
    }),
    entry({
      id: 'resilient-pads', family: 'castresin',
      match: [
        'Resilient coil-support pads', 'Resilient coil-support', 'coil-support pads',
        'Resilient coil-support pads', 'silicone-rubber'
      ],
      title: 'CRT coil support pads',
      marketNote: 'Allow thermal expansion of cast-resin coils — standard on Hitachi RESIBLOC / Siemens GEAFOL / SGB CRT designs. Missing pads → coil cracking years later.',
      components: [
        { name: 'Silicone-rubber / elastomer pads', note: 'Coil feet' },
        { name: 'Pad retainers', note: 'Keep position under SC force' }
      ],
      machinery: [{ name: 'Pad moulding / cut', note: 'Elastomer parts' }],
      manufacturers: [
        { name: 'Dry-type OEMs & pad specialists', role: 'Mounting kits', url: 'manufacturers.html' }
      ],
      sourceHint: 'Small sourced part, high volume on CRT fleets — easy supplier feature slot.'
    }),
    entry({
      id: 'crt-terminals', family: 'castresin',
      match: [
        'HV terminals (CRT', 'LV terminals (CRT', 'cable box (CRT',
        'busduct flanges', 'LV bus stubs'
      ],
      title: 'CRT HV/LV terminations',
      marketNote: 'Top or side HV epoxy terminals and LV bus stubs for busduct/cable — Siemens/Hitachi/SGB package options for indoor switchrooms.',
      components: [
        { name: 'HV epoxy / porcelain terminals', note: 'Cable or bus' },
        { name: 'LV busbar stubs / flanges', note: 'Busduct ready' },
        { name: 'Cable box / shrouds', note: 'IP upgrade option' }
      ],
      machinery: [
        { name: 'Terminal casting / assembly', note: 'Epoxy bushings' }
      ],
      manufacturers: [
        { name: 'CRT OEMs + bushing specialists', role: 'Terminations', url: 'bushing.html' }
      ],
      sourceHint: 'Specify connection style (cable/busduct) early — it drives the enclosure and terminal BOM.'
    }),
    entry({
      id: 'crt-lv-terminals', family: 'castresin',
      match: [
        'LV terminals + PT100', 'LV terminals + PT100 marshalling'
      ],
      title: 'CRT LV terminals & sensor box',
      marketNote: 'LV bus stubs exit upward or sideways; the PT100 marshalling box sits beside them on GEAFOL/RESIBLOC/SGB indoor packages.',
      components: [
        { name: 'LV busbar stubs', note: 'Phase palms' },
        { name: 'PT100 marshalling box', note: 'Sensor terminations' }
      ],
      machinery: [{ name: 'Terminal & box assembly', note: 'Wiring' }],
      manufacturers: [
        { name: 'CRT OEMs', role: 'LV interface package', url: 'manufacturers.html' }
      ],
      sourceHint: 'Part of the CRT termination package — RFQ with busduct/cable style.'
    }),

    entry({
      id: 'crt-base', family: 'castresin',
      match: [
        'Base channels + rollers', 'Base channels + rollers (VPI',
        'CRT base', 'anti-vibration pads'
      ],
      title: 'CRT / dry-type base & rollers',
      marketNote: 'Rolled-steel base channels with bi-directional rollers and anti-vibration pads — Siemens GEAFOL / Hitachi RESIBLOC / SGB indoor practice to keep 100 Hz hum out of the building structure.',
      components: [
        { name: 'Base channels', note: 'Rolled steel' },
        { name: 'Bi-directional rollers', note: 'Haulage' },
        { name: 'Anti-vibration pads', note: 'Floor isolation' }
      ],
      machinery: [{ name: 'Base fab & paint', note: 'Channel weld' }],
      manufacturers: [
        { name: 'CRT OEMs + local fabricators', role: 'Base package', url: 'manufacturers.html' }
      ],
      sourceHint: 'Often local-content steelwork — easy supplier opportunity beside the CRT OEM.'
    }),
    entry({
      id: 'vpi-core', family: 'castresin',
      match: [
        'Core (CRGO, VPI unit)', 'VPI core', 'Core (CRGO, VPI'
      ],
      title: 'VPI dry-type magnetic core',
      marketNote: 'VPI (vacuum-pressure impregnated) dry-types use the same step-lap CRGO architecture as CRT but with open-wound coils impregnated as a set — an alternative to cast-resin on some Hitachi/Siemens/SGB quotes.',
      components: [
        { name: 'Step-lap CRGO core', note: 'Resin/varnish coated' },
        { name: 'Clamping frames', note: 'Single-point earth' }
      ],
      machinery: [
        { name: 'Core stacking', note: 'Step-lap' },
        { name: 'VPI tank', note: 'Impregnation of wound set' }
      ],
      manufacturers: [
        { name: 'Dry-type OEMs', role: 'VPI lines', url: 'manufacturers.html' }
      ],
      sourceHint: 'Source CRGO + VPI process capacity, or buy the complete dry-type active part.'
    }),
    entry({
      id: 'vpi-lv', family: 'castresin',
      match: ['LV winding (VPI)', 'VPI LV'],
      title: 'VPI LV winding',
      marketNote: 'Open-wound LV impregnated with the HV set in a VPI cycle — alternative to CRT foil on some dry-type specs.',
      components: [
        { name: 'LV conductor', note: 'Foil or layer' },
        { name: 'VPI resin impregnation', note: 'Class F/H' }
      ],
      machinery: [
        { name: 'Winding machine', note: 'LV build' },
        { name: 'VPI autoclave', note: 'Impregnation' }
      ],
      manufacturers: [
        { name: 'Dry-type OEMs', role: 'VPI wind', url: 'manufacturers.html' }
      ],
      sourceHint: 'Usually sold as part of the VPI active-part package.'
    }),
    entry({
      id: 'vpi-hv', family: 'castresin',
      match: ['HV winding (VPI open-wound)', 'HV winding (VPI', 'VPI HV', 'open-wound'],
      title: 'VPI HV open-wound coil',
      marketNote: 'Open-wound HV with Nomex/glass insulation, vacuum-pressure impregnated — the dry-type alternative to vacuum-cast epoxy. Different BOM and machinery from CRT.',
      components: [
        { name: 'Open-wound HV coil', note: 'Disc or layer' },
        { name: 'Nomex / glass insulation', note: 'Pre-VPI' },
        { name: 'VPI resin system', note: 'Class F/H' }
      ],
      machinery: [
        { name: 'Disc/layer winder', note: 'HV build' },
        { name: 'VPI autoclave', note: 'Impregnation + cure' }
      ],
      manufacturers: [
        { name: 'Dry-type OEMs (VPI lines)', role: 'Design & wind', url: 'manufacturers.html' }
      ],
      sourceHint: 'RFQ as VPI dry-type — do not confuse with cast-resin epoxy coils.'
    }),

    /* ───────── CURRENT TRANSFORMERS ───────── */
    entry({
      id: 'ct-core', family: 'ct',
      match: ['CT magnetic core', 'Toroidal CT core'],
      title: 'CT magnetic core',
      marketNote: 'Ring-type bushing CTs and wound CTs use CRGO or nanocrystalline cores — same supply chain Hitachi/Siemens instrument-transformer plants use.',
      components: [
        { name: 'Toroidal CRGO / nanocrystalline core', note: 'Gapless ring for bushing CTs' },
        { name: 'Core impregnation varnish', note: 'Noise & corrosion control' }
      ],
      machinery: [
        { name: 'Toroidal core winder', note: 'Strip-wound rings' },
        { name: 'Annealing furnace', note: 'Magnetic property set' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy / Siemens Energy', role: 'IT & bushing CT OEMs', url: 'manufacturers.html' },
        { name: 'Specialist IT makers', role: 'MV/HV CTs', url: 'manufacturers.html' }
      ],
      sourceHint: 'Core is the magnetic heart — source by ratio accuracy class (0.2s, 5P20…).'
    }),
    entry({
      id: 'ct-secondary', family: 'ct',
      match: ['CT secondary winding'],
      title: 'CT secondary winding',
      marketNote: 'Multi-ratio secondaries (1A/5A) with accuracy classes per IEC 61869 — standard utility ask.',
      components: [
        { name: 'Secondary copper winding', note: 'Enamel wire on toroid' },
        { name: 'Inter-layer insulation', note: 'Tape / film' },
        { name: 'Secondary terminals', note: 'Shorting links required' }
      ],
      machinery: [
        { name: 'Toroidal winding machine', note: 'Secondary turns' },
        { name: 'Ratio / burden test set', note: 'IEC 61869 verification' }
      ],
      manufacturers: [
        { name: 'Instrument transformer OEMs', role: 'Wind & test', url: 'manufacturers.html' }
      ],
      sourceHint: 'Specify ratios, burden (VA) and accuracy class when sourcing.'
    }),
    entry({
      id: 'ct-primary', family: 'ct',
      match: ['CT primary', 'Primary bar / wound primary'],
      title: 'CT primary',
      marketNote: 'Bushing CTs use the bushing stem as primary; wound CTs have an insulated primary winding for MV outdoor tanks.',
      components: [
        { name: 'Primary bar or wound primary', note: 'Bus / line current path' },
        { name: 'Primary insulation', note: 'Paper/oil or resin' }
      ],
      machinery: [
        { name: 'Primary winding / bar prep', note: 'Current path assembly' }
      ],
      manufacturers: [
        { name: 'IT OEMs (Hitachi, Siemens, Arteche…)', role: 'Complete CTs', url: 'manufacturers.html' }
      ],
      sourceHint: 'For bushing CTs, primary is the bushing — source CT rings by ID/OD and ratio.'
    }),
    entry({
      id: 'ct-insulation', family: 'ct',
      match: ['CT insulation', 'CT oil / resin insulation'],
      title: 'CT insulation system',
      marketNote: 'Oil-paper for outdoor HV CTs; cast resin for indoor MV — mirrors dry-type vs oil split in transformers.',
      components: [
        { name: 'Oil-paper or epoxy insulation', note: 'Dielectric system' },
        { name: 'Screen / grading layers', note: 'Field control on HV CTs' }
      ],
      machinery: [
        { name: 'Vacuum impregnation / casting', note: 'Dry or resin fill' },
        { name: 'PD test bay', note: 'Insulation integrity' }
      ],
      manufacturers: [
        { name: 'IT OEMs', role: 'Insulation process', url: 'manufacturers.html' }
      ],
      sourceHint: 'Insulation process defines outdoor vs indoor CT product lines.'
    }),
    entry({
      id: 'ct-housing', family: 'ct',
      match: ['CT housing', 'CT tank / porcelain', 'CT tank', 'porcelain'],
      title: 'CT housing & tank',
      marketNote: 'Porcelain or composite housings on outdoor CTs; metal enclosures on indoor bushing-CT junction boxes.',
      components: [
        { name: 'Porcelain / composite housing', note: 'Outdoor creepage' },
        { name: 'Steel tank / base', note: 'Oil volume & mounting' },
        { name: 'Primary terminals', note: 'P1–P2' }
      ],
      machinery: [
        { name: 'Porcelain assembly', note: 'Cementing' },
        { name: 'Tank fab & paint', note: 'Outdoor finish' }
      ],
      manufacturers: [
        { name: 'IT OEMs + porcelain suppliers', role: 'Housing', url: 'manufacturers.html' }
      ],
      sourceHint: 'Housing and creepage are climate/pollution-driven sourced specs.'
    }),
    entry({
      id: 'ct-terminal-box', family: 'ct',
      match: ['CT secondary box', 'CT terminal box', 'CT secondary terminal', 'terminal box'],
      title: 'CT secondary terminal box',
      marketNote: 'Must include shorting links — utility safety requirement worldwide.',
      components: [
        { name: 'Secondary terminal board', note: 'S1–S2, multi-ratio taps' },
        { name: 'Shorting links', note: 'Mandatory before open-circuit' },
        { name: 'Gland plate', note: 'Cable entry' }
      ],
      machinery: [
        { name: 'Terminal board assembly', note: 'Wiring & labelling' }
      ],
      manufacturers: [
        { name: 'IT OEMs', role: 'Complete secondary interface', url: 'manufacturers.html' }
      ],
      sourceHint: 'Small but critical sourced accessory — shorting provision is non-negotiable.'
    }),

    entry({
      id: 'cooling-fans', family: 'power',
      match: ['Cooling fans', 'ONAF fans', 'cooling fan'],
      title: 'Cooling fans (ONAF)',
      marketNote: 'Fan groups are bought-in cooling plant — staged by WTI. Spec by airflow, IP, noise and voltage.',
      components: [
        { name: 'Axial fans & guards', note: 'ONAF stage groups' },
        { name: 'Fan contactors / VFDs', note: 'Marshalling / cooler control' }
      ],
      machinery: [
        { name: 'Cooler assembly line', note: 'Fan + radiator skid build' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Cooling package', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Cooling package', url: 'manufacturers.html' },
        { name: 'SGB-SMIT Group', role: 'Cooling package', url: 'manufacturers.html' }
      ],
      sourceHint: 'Fans are a high-velocity sourced accessory — feature your brand on the 3D hotspot.'
    }),
    entry({
      id: 'radiator-valves', family: 'power',
      match: ['Radiator butterfly valves', 'radiator valves', 'butterfly valves'],
      title: 'Radiator butterfly valves',
      marketNote: 'Tank-wall valves isolate radiator banks for transport and change-out without a full drain.',
      components: [
        { name: 'Butterfly valves', note: 'DN matching collector flanges' },
        { name: 'Gaskets & fasteners', note: 'Oil-resistant' }
      ],
      machinery: [{ name: 'Valve assembly / hydro test', note: 'Leak test' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Cooling BOM', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Cooling BOM', url: 'manufacturers.html' }
      ],
      sourceHint: 'Valves ship with radiator packages or as spares — directory-linked OEMs and valve specialists.'
    }),
    entry({
      id: 'mog', family: 'power',
      match: ['Magnetic oil-level gauges', 'MOG', 'oil-level gauge'],
      title: 'Magnetic oil-level gauges (MOG)',
      marketNote: 'One MOG per conservator compartment with alarm contacts to SCADA.',
      components: [
        { name: 'Magnetic level gauge', note: 'Alarm / trip contacts' },
        { name: 'Float & dial assembly', note: 'Conservator end' }
      ],
      machinery: [{ name: 'Gauge calibration', note: 'Contact set points' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Protection accessories', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Protection accessories', url: 'manufacturers.html' }
      ],
      sourceHint: 'Classic bought-in accessory — Qualitrol/Messko-class ecosystem.'
    }),
    entry({
      id: 'air-cell', family: 'power',
      match: ['Air-cell / bladder indicator', 'air cell', 'rubber bag indicator'],
      title: 'Air-cell / bladder indicator',
      marketNote: 'Signals rubber-bag integrity in the conservator — a collapsed bag is a moisture path.',
      components: [
        { name: 'Air cell / rubber bag', note: 'Conservator bladder' },
        { name: 'Bag-collapse indicator', note: 'End-of-bag sensor' }
      ],
      machinery: [{ name: 'Conservator bag fitment', note: 'Leak / pressure test' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Conservator system', url: 'manufacturers.html' },
        { name: 'SGB-SMIT Group', role: 'Conservator system', url: 'manufacturers.html' }
      ],
      sourceHint: 'Bag and indicator are sourced with the conservator package.'
    }),
    entry({
      id: 'rs-relay', family: 'power',
      match: ['OLTC oil-surge (RS) relay', 'RS relay', 'oil-surge relay'],
      title: 'OLTC oil-surge (RS) relay',
      marketNote: 'Instant trip on diverter oil surge — separate pipe from main Buchholz.',
      components: [
        { name: 'Oil-surge relay', note: 'OLTC pipe' },
        { name: 'Isolating valves', note: 'In-service test' }
      ],
      machinery: [{ name: 'Relay test bench', note: 'Trip calibration' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'OLTC protection', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'OLTC protection', url: 'manufacturers.html' }
      ],
      sourceHint: 'Messko/Qualitrol-class bought-in device on virtually every power datasheet.'
    }),
    entry({
      id: 'sudden-pressure', family: 'power',
      match: ['Sudden pressure / rapid-rise relay', 'sudden pressure', 'SPR', 'rapid-rise'],
      title: 'Sudden pressure relay',
      marketNote: 'Detects fast tank pressure rise from internal arcing — complements Buchholz.',
      components: [
        { name: 'Sudden pressure relay', note: 'Tank-wall mount' },
        { name: 'Pressure sensing element', note: 'Rapid-rise' }
      ],
      machinery: [{ name: 'Protection panel wiring', note: 'Trip circuits' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Tank protection', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Tank protection', url: 'manufacturers.html' }
      ],
      sourceHint: 'Specify alongside PRDs and Buchholz in the protection schedule.'
    }),
    entry({
      id: 'bushing-cts', family: 'power',
      match: ['Bushing CT rings', 'bushing CT', 'turret CT'],
      title: 'Bushing CT rings',
      marketNote: 'Multi-ratio ring CTs inside HV turrets for differential, REF and backup.',
      components: [
        { name: 'Ring-type bushing CTs', note: 'Ratio / class / ID-OD' },
        { name: 'Secondary shorting terminals', note: 'Safety-critical' }
      ],
      machinery: [{ name: 'CT winding / casting', note: 'Ring CT manufacture' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Instrument transformers', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Instrument transformers', url: 'manufacturers.html' }
      ],
      sourceHint: 'Often a separate RFQ line from the bushing itself — open the CT 3D explorer for detail.',
      detail3d: 'ct3d.html'
    }),
    entry({
      id: 'oltc-drive', family: 'power',
      match: ['OLTC motor-drive cabinet', 'motor-drive', 'OLTC drive'],
      title: 'OLTC motor-drive cabinet',
      marketNote: 'Motor drive with hand-crank — steps the tap range under AVR / parallel control.',
      components: [
        { name: 'Motor-drive mechanism', note: 'With hand crank' },
        { name: 'Position contacts', note: 'SCADA / AVR' }
      ],
      machinery: [{ name: 'Drive FAT / timing test', note: 'Operations counter' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'OLTC drives', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'OLTC drives', url: 'manufacturers.html' }
      ],
      sourceHint: 'Drive cabinet is a distinct sourced accessory from the diverter body.'
    }),
    entry({
      id: 'oltc-filter', family: 'power',
      match: ['OLTC oil filter unit', 'OLTC filter', 'tap-changer filter'],
      title: 'OLTC oil filter unit',
      marketNote: 'Keeps diverter oil clean — extends vacuum-bottle and contact life.',
      components: [
        { name: 'OLTC oil filter', note: 'Online or offline' },
        { name: 'Filter cartridges', note: 'Consumable' }
      ],
      machinery: [{ name: 'Oil processing skid', note: 'Filter / degas' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'OLTC accessories', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'OLTC accessories', url: 'manufacturers.html' }
      ],
      sourceHint: 'Popular aftermarket / upgrade accessory for ageing fleets.'
    }),
    entry({
      id: 'online-dga', family: 'power',
      match: ['Online DGA monitor', 'online DGA', 'DGA monitor'],
      title: 'Online DGA monitor',
      marketNote: 'Multi-gas online DGA — early-warning analytics on oil health.',
      components: [
        { name: 'Multi-gas DGA monitor', note: 'H₂, C₂H₂, CO, moisture' },
        { name: 'Oil sampling loop', note: 'Tank connection' }
      ],
      machinery: [{ name: 'Monitor commissioning', note: 'Baseline DGA' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Monitoring package', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Monitoring package', url: 'manufacturers.html' }
      ],
      sourceHint: 'High-value monitoring accessory — strong sponsor slot on the 3D model.'
    }),
    entry({
      id: 'oti-wti', family: 'power',
      match: ['OTI / WTI temperature devices', 'OTI', 'WTI', 'winding temperature'],
      title: 'OTI / WTI temperature devices',
      marketNote: 'Oil and winding temperature indicators with alarm/trip and cooler stage outputs.',
      components: [
        { name: 'OTI / WTI instruments', note: 'Pockets + capillaries or digital' },
        { name: 'Cooler stage relays', note: 'Fan / pump control' }
      ],
      machinery: [{ name: 'Instrument calibration', note: 'Trip set-points' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Temperature devices', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Temperature devices', url: 'manufacturers.html' }
      ],
      sourceHint: 'Split from marshalling so buyers can source gauges independently.'
    }),
    entry({
      id: 'fibre-probes', family: 'power',
      match: ['Fibre-optic winding temperature probes', 'fibre-optic', 'hotspot probes'],
      title: 'Fibre-optic winding temperature probes',
      marketNote: 'Direct hotspot probes in the winding — complements thermal-image WTI.',
      components: [
        { name: 'Fibre-optic probes', note: 'Winding hotspot' },
        { name: 'Interrogator / monitor', note: 'Control cabinet' }
      ],
      machinery: [{ name: 'Probe installation during wind', note: 'Coil shop' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Monitoring', url: 'manufacturers.html' },
        { name: 'Siemens Energy', role: 'Monitoring', url: 'manufacturers.html' }
      ],
      sourceHint: 'Specify at winding stage — hard to retrofit deep in the coil.'
    }),
    entry({
      id: 'haulage-wheels', family: 'power',
      match: ['Haulage wheels', 'skid rollers', 'haulage'],
      title: 'Haulage wheels / skid rollers',
      marketNote: 'Flanged wheels or rollers for rail / trailer moves — often removed after install.',
      components: [
        { name: 'Flanged haulage wheels', note: 'Rail gauge options' },
        { name: 'Skid rollers', note: 'Site moves' }
      ],
      machinery: [{ name: 'Undercarriage fitment', note: 'Tank shop' }],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'Tank accessories', url: 'manufacturers.html' },
        { name: 'SGB-SMIT Group', role: 'Tank accessories', url: 'manufacturers.html' }
      ],
      sourceHint: 'Mechanical accessory line — often rented or project-supplied.'
    }),
  ];

  function inferFamily(partName) {
    var s = String(partName || '');
    if (/\bCT\b|current transformer|toroidal CT/i.test(s) && !/bushing CTs/i.test(s)) return 'ct';
    if (/cast.?resin|CRT\b|GEAFOL|RESIBLOC|foil winding|VPI|epoxy coil|PT100|resilient coil|air ducts \(CRT|tap links \(CRT|HV terminals \(CRT/i.test(s)) return 'castresin';
    if (/corrugat|hermetic|distribution|DETC|ECOTAP|fin walls|pad.?mount|oil distribution/i.test(s)) return 'distribution';
    return null;
  }

  function matchPartName(partName, preferredFamily) {
    if (!partName) return null;
    var lower = String(partName).toLowerCase();
    var preferred =
      preferredFamily ||
      (typeof root.TP_EXPLORER_FAMILY === 'string' ? root.TP_EXPLORER_FAMILY : null) ||
      inferFamily(partName);
    var best = null;
    var bestScore = -1;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      for (var j = 0; j < p.match.length; j++) {
        var m = String(p.match[j]).toLowerCase();
        if (!m || lower.indexOf(m) === -1) continue;
        var score = m.length * 10;
        if (preferred && p.family === preferred) score += 1000;
        /* Prefer more specific (longer) matches within the same family band */
        if (score > bestScore) {
          best = p;
          bestScore = score;
        }
      }
    }
    return best;
  }

  function byId(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  function byFamily(family) {
    return PARTS.filter(function (p) { return p.family === family; });
  }

  /** Coverage helper for smoke tests: { total, matched, wrongFamily, misses[] } */
  function coverageForNames(names, preferredFamily) {
    var matched = 0;
    var wrongFamily = 0;
    var misses = [];
    for (var i = 0; i < names.length; i++) {
      var eco = matchPartName(names[i], preferredFamily);
      if (!eco) misses.push(names[i]);
      else {
        matched++;
        if (preferredFamily && eco.family !== preferredFamily) wrongFamily++;
      }
    }
    return {
      total: names.length,
      matched: matched,
      wrongFamily: wrongFamily,
      misses: misses
    };
  }

  root.TP_PART_ECOSYSTEM = {
    parts: PARTS,
    matchPartName: matchPartName,
    byId: byId,
    byFamily: byFamily,
    inferFamily: inferFamily,
    coverageForNames: coverageForNames
  };
})(typeof window !== 'undefined' ? window : globalThis);
