/**
 * Component catalog — directory ↔ 3D explorer parts ↔ supplier sponsorship.
 *
 * match: substrings matched against power3d.html part names (case-insensitive)
 * detail3d: optional dedicated 3D page (public for supplier discovery)
 * featuredSupplier: set after a paid sponsorship clears (ops / CRM)
 */
(function (root) {
  var ITEMS = [
    {
      id: 'hv-bushings',
      name: 'HV Condenser Bushings',
      category: 'Bushings & Terminations',
      blurb: 'Condenser bushings, turrets and bushing CTs for HV line connections.',
      match: ['132 kV condenser bushings', 'Bushing mounting flanges'],
      detail3d: 'bushing.html'
    },
    {
      id: 'lv-bushings',
      name: 'LV & Neutral Bushings',
      category: 'Bushings & Terminations',
      blurb: 'LV bushings and HV neutral bushings.',
      match: ['33 kV bushings'],
      detail3d: 'bushing.html'
    },
    {
      id: 'surge-arresters',
      name: 'Surge Arresters',
      category: 'Bushings & Terminations',
      blurb: 'Metal-oxide arresters protecting windings from lightning and switching surges.',
      match: ['surge arresters'],
      detail3d: null
    },
    {
      id: 'oltc',
      name: 'On-Load Tap-Changer (OLTC)',
      category: 'Tap-Changers',
      blurb: 'Changes ratio under load; vacuum or oil diverter with motor drive.',
      match: ['On-load tap-changer', 'OLTC position indicator'],
      detail3d: 'oltc.html'
    },
    {
      id: 'buchholz',
      name: 'Buchholz Relay & Conservator',
      category: 'Protection & Monitoring',
      blurb: 'Conservator, Buchholz / RS relays and breathers.',
      match: ['Buchholz', 'Conservator'],
      detail3d: null
    },
    {
      id: 'prd',
      name: 'Pressure Relief Devices',
      category: 'Protection & Monitoring',
      blurb: 'PRVs and cover fittings that vent sudden tank overpressure.',
      match: ['Tank cover', 'PRVs'],
      detail3d: null
    },
    {
      id: 'dga',
      name: 'Online DGA & Temperature Devices',
      category: 'Protection & Monitoring',
      blurb: 'Continuous DGA monitors and winding/oil temperature devices.',
      match: ['online DGA', 'Marshalling cabinet'],
      detail3d: null
    },
    {
      id: 'marshalling',
      name: 'Marshalling & Control Cabling',
      category: 'Protection & Monitoring',
      blurb: 'Marshalling cabinets, conduits and control cabling.',
      match: ['Marshalling cabinet', 'Control cabling'],
      detail3d: null
    },
    {
      id: 'radiators',
      name: 'Radiators, Fans & Pumps',
      category: 'Cooling',
      blurb: 'Radiator banks, fans, pumps and valves (ONAN/ONAF/OFAF).',
      match: ['Radiator banks'],
      detail3d: null
    },
    {
      id: 'pressboard',
      name: 'Pressboard Barriers',
      category: 'Insulation Materials',
      blurb: 'Main HV–LV insulation barriers and tap barrier cylinders.',
      match: ['pressboard', 'HV–tap barrier', 'barrier cylinders'],
      detail3d: null
    },
    {
      id: 'ctc',
      name: 'LV Winding / CTC',
      category: 'Conductors & Core',
      blurb: 'Inner LV helical winding — typically CTC for large units.',
      match: ['LV winding (33 kV'],
      detail3d: 'windings.html'
    },
    {
      id: 'hv-winding',
      name: 'HV Disc Winding',
      category: 'Conductors & Core',
      blurb: 'Middle HV continuous-disc winding.',
      match: ['HV winding (132 kV'],
      detail3d: 'windings.html'
    },
    {
      id: 'tap-winding',
      name: 'Tapping / Regulating Winding',
      category: 'Conductors & Core',
      blurb: 'Outermost regulating winding feeding the OLTC.',
      match: ['Tapping / regulating winding'],
      detail3d: 'windings.html'
    },
    {
      id: 'core-steel',
      name: 'CRGO Core Steel',
      category: 'Conductors & Core',
      blurb: 'Three-limb core, yokes, clamping frames and tie rods.',
      match: ['Core — limbs', 'Top yoke, clamping'],
      detail3d: 'coretopology.html'
    },
    {
      id: 'transformer-oil',
      name: 'Insulating Oil',
      category: 'Fluids',
      blurb: 'Insulating and cooling oil fill.',
      match: ['cooling oil'],
      detail3d: null
    },
    {
      id: 'tank',
      name: 'Tank & Cover Fittings',
      category: 'Tank & Structure',
      blurb: 'Tank, skid, jacking pads, cover bolts, drain and sampling valves.',
      match: ['Tank, skid base', 'Cover bolting', 'Tank fittings'],
      detail3d: null
    }
  ];

  var featuredSuppliers = root.TP_FEATURED_SUPPLIERS || {};

  function byId(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }

  function matchPartName(partName) {
    if (!partName) return null;
    var lower = String(partName).toLowerCase();
    for (var i = 0; i < ITEMS.length; i++) {
      var item = ITEMS[i];
      for (var j = 0; j < item.match.length; j++) {
        if (lower.indexOf(String(item.match[j]).toLowerCase()) !== -1) return item;
      }
    }
    return null;
  }

  function explorerUrl(id) {
    return 'power3d.html?part=' + encodeURIComponent(id);
  }

  function supplierFor(id) {
    return featuredSuppliers[id] || null;
  }

  root.TP_COMPONENTS = {
    items: ITEMS,
    byId: byId,
    matchPartName: matchPartName,
    explorerUrl: explorerUrl,
    supplierFor: supplierFor,
    featuredSuppliers: featuredSuppliers
  };
})(typeof window !== 'undefined' ? window : globalThis);
