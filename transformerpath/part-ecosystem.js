/**
 * Part ecosystem for power3d.html — each selectable assembly maps to:
 *   - components / materials (what buyers source)
 *   - machinery / process equipment (how factories build it)
 *   - manufacturers & specialist suppliers (who makes / integrates it)
 *
 * Keys match substrings of power3d part names (case-insensitive).
 */
(function (root) {
  var PARTS = [
    {
      id: 'core',
      match: ['Core — limbs', 'Top yoke, clamping'],
      title: 'Magnetic core & clamping',
      components: [
        { name: 'CRGO / Hi-B electrical steel', note: '0.23–0.27 mm laser domain-refined grades' },
        { name: 'Core banding tape', note: 'Resin-impregnated glass, no through-bolts' },
        { name: 'Clamping frames & tie rods', note: 'Insulated steel frames, single-point earth' },
        { name: 'Step-lap joint kits', note: 'Mitred 6-step packets with cooling ducts' }
      ],
      machinery: [
        { name: 'Slitting line', note: 'Coil → strip width for limb/yoke packets' },
        { name: 'Cut-to-length / mitre shear', note: 'Step-lap cut geometry' },
        { name: 'Core stacking table', note: 'Limb build + yoke re-lay' },
        { name: 'Annealing / stress-relief furnace', note: 'Optional for Hi-B processing' },
        { name: 'Banding / hoop station', note: 'Glass-tape banding of limbs' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy', role: 'OEM (core design & build)', url: 'https://www.hitachienergy.com/' },
        { name: 'Siemens Energy', role: 'OEM', url: 'https://www.siemens-energy.com/' },
        { name: 'GE Vernova / Prolec', role: 'OEM', url: 'https://www.prolec.energy/' },
        { name: 'CRGO mills (Nippon, POSCO, TKES…)', role: 'Core steel suppliers', url: 'manufacturers.html' }
      ],
      detail3d: 'coretopology.html'
    },
    {
      id: 'lv-winding',
      match: ['LV winding (33 kV'],
      title: 'LV winding (helical / CTC)',
      components: [
        { name: 'CTC (continuously transposed conductor)', note: 'Multi-strand copper, enamel + paper' },
        { name: 'End rings & pressure rings', note: 'Axial clamping of the coil' },
        { name: 'Layer insulation / DDP', note: 'Diamond-dotted paper bonding' },
        { name: 'Cooling duct spacers', note: 'Pressboard sticks & wedges' }
      ],
      machinery: [
        { name: 'CTC winding machine', note: 'Helical / layer wind with tension control' },
        { name: 'Conductor pay-off & tensioner', note: 'Constant tension on CTC cable' },
        { name: 'Vapour-phase / oven dry-out', note: 'Moisture removal before tanking' },
        { name: 'Coil sizing / pressing press', note: 'Sets final axial build' }
      ],
      manufacturers: [
        { name: 'Essex / CTC cable specialists', role: 'Conductor suppliers', url: 'components.html#ctc' },
        { name: 'Transformer OEMs', role: 'Wind & assemble in-house', url: 'manufacturers.html' }
      ],
      detail3d: 'windings.html'
    },
    {
      id: 'hv-winding',
      match: ['HV winding (132 kV'],
      title: 'HV winding (continuous disc)',
      components: [
        { name: 'Paper-covered copper strip', note: 'Disc turns, transposed where required' },
        { name: 'Inter-disc spacers', note: 'Pressboard duct sticks' },
        { name: 'Static end rings', note: 'Impulse grading at line end' },
        { name: 'Lead exits & shielding', note: 'Crepe-paper wrapped leads' }
      ],
      machinery: [
        { name: 'Disc winding machine', note: 'Horizontal/vertical disc winders' },
        { name: 'Shielding / grading station', note: 'Static rings & electrostatic shields' },
        { name: 'Impulse test tap prep', note: 'Lead dressing for type tests' }
      ],
      manufacturers: [
        { name: 'Power transformer OEMs', role: 'Design & wind HV coils', url: 'manufacturers.html' },
        { name: 'Conductor mills', role: 'Paper-covered strip', url: 'components.html#hv-winding' }
      ],
      detail3d: 'windings.html'
    },
    {
      id: 'tap-winding',
      match: ['Tapping / regulating winding'],
      title: 'Tapping / regulating winding',
      components: [
        { name: 'Tap conductor', note: 'Often separate regulating winding' },
        { name: 'Tap leads to OLTC', note: 'Crepe-wrapped flexible leads' },
        { name: 'Barrier cylinders', note: 'HV–tap insulation barriers' }
      ],
      machinery: [
        { name: 'Regulating-winding winder', note: 'Fine pitch, many taps' },
        { name: 'Lead forming bench', note: 'Dress leads into OLTC turret' }
      ],
      manufacturers: [
        { name: 'OEM winding shops', role: 'Integrated with OLTC design', url: 'manufacturers.html' },
        { name: 'MR / ABB / Huaming…', role: 'Coordinate tap layout with OLTC', url: 'components.html#oltc' }
      ],
      detail3d: 'windings.html'
    },
    {
      id: 'pressboard',
      match: ['pressboard', 'barrier cylinders', 'HV–tap barrier'],
      title: 'Main insulation barriers',
      components: [
        { name: 'Transformerboard / pressboard', note: 'Cylinders, angle rings, washers' },
        { name: 'Machined spacers & wedges', note: 'Cooling ducts + coil support' },
        { name: 'Laminated wood beams', note: 'Clamping & lead supports' }
      ],
      machinery: [
        { name: 'CNC pressboard machining', note: 'Cylinders, rings, custom shapes' },
        { name: 'Hot press / densification', note: 'High-density board production' },
        { name: 'Vacuum dry-out', note: 'Insulation moisture <0.5%' }
      ],
      manufacturers: [
        { name: 'Weidmann / Munksjö / specialist mills', role: 'Insulation materials', url: 'components.html#pressboard' },
        { name: 'Transformer OEMs', role: 'Design barrier system', url: 'manufacturers.html' }
      ]
    },
    {
      id: 'tank',
      match: ['Tank, skid base', 'Cover bolting', 'Tank fittings'],
      title: 'Tank, cover & fittings',
      components: [
        { name: 'Fabricated steel tank', note: 'Bell or cover-joint construction' },
        { name: 'Gaskets & O-rings', note: 'Nitrile/cork or Viton systems' },
        { name: 'Valves (drain, filter, sample)', note: 'Butterfly & sampling valves' },
        { name: 'Rating plate & ladder', note: 'Contract data in stainless' }
      ],
      machinery: [
        { name: 'Plate cutting & rolling', note: 'Tank shell fabrication' },
        { name: 'Welding bay / robots', note: 'Seam & nozzle welding' },
        { name: 'Shot-blast & paint line', note: 'Corrosion protection system' },
        { name: 'Leak / pressure test rig', note: 'Tank integrity before active-part drop' }
      ],
      manufacturers: [
        { name: 'Transformer OEMs', role: 'Tank design & fab (or outsourced)', url: 'manufacturers.html' },
        { name: 'Tank fabricators', role: 'Specialist steelwork', url: 'components.html#tank' }
      ]
    },
    {
      id: 'oil',
      match: ['cooling oil', 'Insulating & cooling oil'],
      title: 'Insulating & cooling oil',
      components: [
        { name: 'Mineral transformer oil', note: 'IEC 60296 naphthenic' },
        { name: 'Natural / synthetic esters', note: 'K-class fire-safe options' },
        { name: 'Oil sampling bottles & valves', note: 'DGA programme feed' }
      ],
      machinery: [
        { name: 'Oil filtration / degassing plant', note: 'Mobile or fixed processing rigs' },
        { name: 'Vacuum filling system', note: 'Dry oil fill under vacuum' },
        { name: 'Oil storage tanks', note: 'Clean & used oil segregation' }
      ],
      manufacturers: [
        { name: 'Nynas / Ergon / Shell…', role: 'Oil producers', url: 'components.html#transformer-oil' },
        { name: 'Ester suppliers (MIDEL…)', role: 'Alternative fluids', url: 'components.html#transformer-oil' }
      ]
    },
    {
      id: 'hv-bushings',
      match: ['132 kV condenser bushings', 'Bushing mounting flanges'],
      title: 'HV condenser bushings',
      components: [
        { name: 'OIP / RIP condenser bushings', note: '36–550 kV line entries' },
        { name: 'Bushing turrets', note: 'Tank nozzles + CT housings' },
        { name: 'Bushing CTs', note: 'Ring-type metering/protection' },
        { name: 'Test taps & flanges', note: 'tan δ / capacitance checks' }
      ],
      machinery: [
        { name: 'Condenser-core winder', note: 'Capacitive grading layers' },
        { name: 'Impregnation / curing autoclave', note: 'OIP oil or RIP resin' },
        { name: 'Bushing test bay', note: 'AC withstand, PD, capacitance' }
      ],
      manufacturers: [
        { name: 'HSP / RHM / ABB / Siemens Energy', role: 'Bushing specialists', url: 'bushing.html' },
        { name: 'Transformer OEMs', role: 'Specify & integrate', url: 'manufacturers.html' }
      ],
      detail3d: 'bushing.html'
    },
    {
      id: 'lv-bushings',
      match: ['33 kV bushings'],
      title: 'LV & neutral bushings',
      components: [
        { name: 'DIN / epoxy LV bushings', note: '1–36 kV, high current' },
        { name: 'Neutral bushing', note: 'HV neutral bring-out' },
        { name: 'Cable boxes / glands', note: 'Optional MV/LV terminations' }
      ],
      machinery: [
        { name: 'Epoxy casting line', note: 'For cast-resin bushings' },
        { name: 'Porcelain assembly', note: 'Cementing & sealing' }
      ],
      manufacturers: [
        { name: 'Bushing & epoxy specialists', role: 'LV terminations', url: 'bushing.html' },
        { name: 'Transformer OEMs', role: 'Integration', url: 'manufacturers.html' }
      ],
      detail3d: 'bushing.html'
    },
    {
      id: 'conservator',
      match: ['Buchholz', 'Conservator'],
      title: 'Conservator, Buchholz & breathers',
      components: [
        { name: 'Conservator tank', note: 'Main + OLTC compartments' },
        { name: 'Buchholz / RS relays', note: 'Gas & surge protection' },
        { name: 'Silica-gel breathers', note: 'Standard or self-regenerating' },
        { name: 'Air cell / rubber bag', note: 'Oil–air separation' }
      ],
      machinery: [
        { name: 'Conservator fabrication', note: 'Small tank shop' },
        { name: 'Relay calibration bench', note: 'Buchholz trip settings' }
      ],
      manufacturers: [
        { name: 'Messko / Qualitrol / relay makers', role: 'Protection devices', url: 'components.html#buchholz' },
        { name: 'Transformer OEMs', role: 'System packaging', url: 'manufacturers.html' }
      ]
    },
    {
      id: 'prd',
      match: ['Tank cover', 'PRVs'],
      title: 'Cover devices (PRV, hatches)',
      components: [
        { name: 'Pressure relief device', note: 'Spring valve + trip contact' },
        { name: 'Inspection hatches', note: 'Cover access' },
        { name: 'Core earth test link', note: 'Single-point core earth' }
      ],
      machinery: [
        { name: 'PRV test bench', note: 'Set point verification' }
      ],
      manufacturers: [
        { name: 'Qualitrol / Emco / specialists', role: 'PRD suppliers', url: 'components.html#prd' }
      ]
    },
    {
      id: 'radiators',
      match: ['Radiator banks'],
      title: 'Cooling plant',
      components: [
        { name: 'Pressed-steel radiators', note: 'Bolt-on or welded banks' },
        { name: 'Cooling fans', note: 'ONAF / OFAF stages' },
        { name: 'Oil pumps', note: 'OF / OD circulation' },
        { name: 'Radiator valves', note: 'Butterfly isolation valves' }
      ],
      machinery: [
        { name: 'Radiator panel press', note: 'Formed cooling panels' },
        { name: 'Header welding line', note: 'Bank assembly' },
        { name: 'Fan / pump test stand', note: 'Airflow & flow rate checks' }
      ],
      manufacturers: [
        { name: 'Radiator specialists (e.g. local fab + OEM)', role: 'Cooling hardware', url: 'components.html#radiators' },
        { name: 'Transformer OEMs', role: 'Thermal design', url: 'manufacturers.html' }
      ]
    },
    {
      id: 'oltc',
      match: ['On-load tap-changer', 'OLTC position indicator'],
      title: 'On-load tap-changer',
      components: [
        { name: 'OLTC diverter (vacuum/oil)', note: 'Changes ratio under load' },
        { name: 'Motor-drive mechanism', note: 'Position transmitters & controllers' },
        { name: 'OLTC oil / filter unit', note: 'Diverter oil maintenance' },
        { name: 'Drive conduit & indicator', note: 'Deck to conservator route' }
      ],
      machinery: [
        { name: 'Precision machining cells', note: 'Contacts, shafts, housings' },
        { name: 'Vacuum interrupter assembly', note: 'For vacuum OLTCs' },
        { name: 'Type-test / life-test rigs', note: 'Switching endurance' }
      ],
      manufacturers: [
        { name: 'Maschinenfabrik Reinhausen (MR)', role: 'OLTC specialist', url: 'oltc.html' },
        { name: 'Hitachi Energy / Huaming…', role: 'OLTC suppliers', url: 'components.html#oltc' },
        { name: 'Transformer OEMs', role: 'Specify & mount', url: 'manufacturers.html' }
      ],
      detail3d: 'oltc.html'
    },
    {
      id: 'monitoring',
      match: ['online DGA', 'Marshalling cabinet', 'Control cabling'],
      title: 'Monitoring & marshalling',
      components: [
        { name: 'Online DGA monitor', note: 'Continuous gas-in-oil' },
        { name: 'OTI / WTI gauges', note: 'Alarm & trip contacts' },
        { name: 'Marshalling box', note: 'All secondary wiring' },
        { name: 'Fibre-optic hot-spot sensors', note: 'Optional winding sensors' }
      ],
      machinery: [
        { name: 'Panel wiring benches', note: 'Marshalling build' },
        { name: 'Sensor calibration', note: 'Temperature & gas sensors' }
      ],
      manufacturers: [
        { name: 'Qualitrol / Serveron / GE…', role: 'DGA & monitoring', url: 'components.html#dga' },
        { name: 'Transformer OEMs', role: 'Package & commission', url: 'manufacturers.html' }
      ]
    },
    {
      id: 'arresters',
      match: ['surge arresters'],
      title: 'Surge arresters',
      components: [
        { name: 'ZnO metal-oxide arresters', note: 'Close to HV bushings' },
        { name: 'Leakage-current monitors', note: 'Substation inspection' }
      ],
      machinery: [
        { name: 'Arrester assembly & test', note: 'IEC 60099 routines' }
      ],
      manufacturers: [
        { name: 'Hitachi Energy / Siemens / ABB…', role: 'Arrester makers', url: 'components.html#surge-arresters' },
        { name: 'EPCs & OEMs', role: 'Insulation coordination', url: 'manufacturers.html' }
      ]
    }
  ];

  function matchPartName(partName) {
    if (!partName) return null;
    var lower = String(partName).toLowerCase();
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      for (var j = 0; j < p.match.length; j++) {
        if (lower.indexOf(String(p.match[j]).toLowerCase()) !== -1) return p;
      }
    }
    return null;
  }

  function byId(id) {
    for (var i = 0; i < PARTS.length; i++) if (PARTS[i].id === id) return PARTS[i];
    return null;
  }

  root.TP_PART_ECOSYSTEM = {
    parts: PARTS,
    matchPartName: matchPartName,
    byId: byId
  };
})(typeof window !== 'undefined' ? window : globalThis);
