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
        'LV winding (33 kV', 'LV windings (inner)', 'LV foil windings', 'LV winding (VPI)',
        'LV windings (inner)', 'LV foil', 'LV winding (VPI)', 'LV foil windings'
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
        'HV winding (132 kV', 'HV windings (outer)', 'HV cast-resin coils', 'HV winding (VPI',
        'HV windings (outer)', 'HV cast-resin', 'HV winding (VPI open',
        'HV cast coils', 'continuous disc', 'Active part (core + windings)'
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
        'jacking pads', 'Cover bolting & gasket joint', 'Tank fittings —'
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
        '400 kV HV bushings', 'condenser bushings', 'bushing turrets'
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
        '33 kV bushings', 'LV bushings', 'LV terminals', '220 kV LV bushings',
        'Neutral + tertiary', 'neutral bushing', 'HV neutral'
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
        'Buchholz', 'Conservator', 'Conservator tank', 'Silica-gel breather',
        'breather', 'Magnetic oil-level', 'MOG'
      ],
      title: 'Conservator & gas protection',
      marketNote: 'Rubber-bag conservators + Buchholz remain Hitachi/Siemens/SGB default on free-breathing power tanks; hermetic designs delete this on many distribution units.',
      components: [
        { name: 'Conservator (main + OLTC)', note: 'Oil expansion' },
        { name: 'Buchholz / RS relays', note: 'Messko, Qualitrol…' },
        { name: 'Silica-gel breathers', note: 'Standard or regenerating' },
        { name: 'Air cell / rubber bag', note: 'Oil–air separation' }
      ],
      machinery: [
        { name: 'Small tank fab', note: 'Conservator shells' },
        { name: 'Relay calibration bench', note: 'Trip settings' }
      ],
      manufacturers: [
        { name: 'Messko / Qualitrol', role: 'Relays & breathers', url: 'components.html#buchholz' },
        { name: 'OEMs', role: 'Package', url: 'manufacturers.html' }
      ],
      sourceHint: 'Protection devices are almost always bought-in — specify make/model in the datasheet.'
    }),
    entry({
      id: 'prd', family: 'power',
      match: [
        'PRVs', 'Tank cover (+', 'Pressure-relief', 'PRV',
        'Oil / winding temperature', 'OTI', 'WTI'
      ],
      title: 'Cover devices (PRD, OTI/WTI)',
      marketNote: 'Spring PRDs with trip contacts are mandatory on sealed/power tanks across Hitachi/Siemens/SGB specs.',
      components: [
        { name: 'Pressure relief device', note: 'Spring valve + contact' },
        { name: 'OTI / WTI pockets', note: 'Fan staging & trip' },
        { name: 'Inspection hatches', note: 'Cover access' }
      ],
      machinery: [{ name: 'PRD test bench', note: 'Set-point check' }],
      manufacturers: [
        { name: 'Qualitrol / Emco / specialists', role: 'PRD & gauges', url: 'components.html#prd' }
      ],
      sourceHint: 'Standard sourced accessories — easy upsell for suppliers.'
    }),
    entry({
      id: 'radiators', family: 'power',
      match: [
        'Radiator banks', 'Corrugated fin walls', 'Cross-flow fans',
        'Panel radiator', 'Oil pumps', 'ODAF', 'radiator banks'
      ],
      title: 'Cooling plant',
      marketNote: 'Detachable radiators + ONAF on power (Hitachi/Siemens); corrugated fins on SGB-style distribution; AF fans on dry-type.',
      components: [
        { name: 'Pressed-steel radiators or corrugated fins', note: 'ONAN base' },
        { name: 'Cooling fans', note: 'ONAF / AF stages' },
        { name: 'Oil pumps (OF/OD)', note: 'Forced oil on large units' },
        { name: 'Radiator valves', note: 'Butterfly isolation' }
      ],
      machinery: [
        { name: 'Radiator panel press', note: 'Formed panels' },
        { name: 'Header welding line', note: 'Bank assembly' },
        { name: 'Fan test stand', note: 'Airflow verification' }
      ],
      manufacturers: [
        { name: 'Radiator specialists + OEMs', role: 'Cooling hardware', url: 'components.html#radiators' },
        { name: 'SGB-SMIT / distribution OEMs', role: 'Corrugated tank cooling', url: 'manufacturers.html' }
      ],
      sourceHint: 'Radiators and fans are high-volume sourced parts — strong supplier marketplace fit.'
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
      match: ['online DGA', 'Marshalling cabinet', 'Control cabling', 'PT100'],
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
      id: 'corrugated-tank', family: 'distribution',
      match: [
        'Corrugated fin walls', 'Corrugated fin', 'ONAN cooling',
        'Tank', 'Hermetic tank', 'distribution tank'
      ],
      title: 'Corrugated distribution tank',
      marketNote: 'SGB-SMIT, Hitachi and Siemens distribution lines commonly use corrugated-wall hermetic tanks (ONAN) — fins are both radiator and expansion volume, deleting the conservator on sealed units.',
      components: [
        { name: 'Corrugated steel fin packs', note: 'Deep vertical fins, elastically expand' },
        { name: 'Hermetic cover weld or bolted gasket', note: 'Sealed vs free-breathing' },
        { name: 'Drain / sample / earth fittings', note: 'Utility service points' },
        { name: 'C3–C5 paint system', note: 'Coastal / industrial finish' }
      ],
      machinery: [
        { name: 'Corrugation press line', note: 'Fin forming' },
        { name: 'Tank welding / leak test', note: 'Vacuum integrity' },
        { name: 'Shot-blast & paint booth', note: 'Corrosion system' }
      ],
      manufacturers: [
        { name: 'SGB-SMIT / Hitachi Energy / Siemens Energy', role: 'Distribution OEMs', url: 'manufacturers.html' },
        { name: 'Tank fabricators', role: 'Local-content steelwork', url: 'components.html#tank' }
      ],
      sourceHint: 'Corrugated tanks are a high-volume sourced fab line — RFQ by kVA, BIL and paint class.'
    }),
    entry({
      id: 'dist-oltc', family: 'distribution',
      match: [
        'On-load tap-changer (OLTC)', 'On-load tap-changer', 'distribution OLTC'
      ],
      title: 'Distribution OLTC / DETC',
      marketNote: 'Many SGB/Hitachi/Siemens distribution units ship with off-circuit taps; OLTC (often MR ECOTAP or vacuum) is specified when LV voltage must track load — same OEM ecosystem as power, smaller frame.',
      components: [
        { name: 'DETC or compact OLTC', note: '±2×2.5% or ±10% typical' },
        { name: 'Tap leads & board', note: 'From HV winding' },
        { name: 'Motor drive (OLTC)', note: 'AVR / SCADA ready' }
      ],
      machinery: [
        { name: 'Tap-board assembly', note: 'Lead dress' },
        { name: 'OLTC test stand', note: 'Operation count / timing' }
      ],
      manufacturers: [
        { name: 'Maschinenfabrik Reinhausen', role: 'Compact OLTCs', url: 'oltc.html' },
        { name: 'Distribution OEMs', role: 'Integrate DETC/OLTC', url: 'manufacturers.html' }
      ],
      detail3d: 'oltc.html',
      sourceHint: 'Name the tap scheme in the RFQ — DETC vs OLTC changes the entire BOM.'
    }),

    /* ───────── CAST-RESIN (Siemens GEAFOL / Hitachi RESIBLOC / SGB CRT) ───────── */
    entry({
      id: 'crt-core', family: 'castresin',
      match: [
        'Core (CRGO, resin-coated)', 'Core (CRGO, CRT', 'CRT core',
        'Core (CRGO, resin', 'resin-coated)'
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
        'LV terminals + PT100', 'HV terminals (CRT', 'cable box (CRT',
        'busduct flanges'
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
    })
  ];

  function matchPartName(partName) {
    if (!partName) return null;
    var lower = String(partName).toLowerCase();
    var best = null;
    var bestLen = 0;
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      for (var j = 0; j < p.match.length; j++) {
        var m = String(p.match[j]).toLowerCase();
        if (m && lower.indexOf(m) !== -1 && m.length > bestLen) {
          best = p;
          bestLen = m.length;
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

  root.TP_PART_ECOSYSTEM = {
    parts: PARTS,
    matchPartName: matchPartName,
    byId: byId,
    byFamily: byFamily
  };
})(typeof window !== 'undefined' ? window : globalThis);
