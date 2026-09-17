/**
 * TransformerPath Grid Lab — 3D Power System Simulation Engine
 * Generation → GSU → EHV Transmission → Autotransformer → Distribution → Consumer
 */

(function () {
  'use strict';

  // Engineering calculation functions (fallback to inline if tp-grid-calc not loaded)
  const SQRT3 = Math.sqrt(3);
  const calc = window.TPGridCalc || {
    threePhaseCurrent: (mva, kv) => (mva && kv) ? (mva * 1000) / (SQRT3 * kv) : 0,
    activePower: (mva, pf = 0.9) => mva * pf,
    apparentPower: (mw, pf = 0.9) => mw / pf,
    lineLossMW: (currentA, rOhm) => (3 * Math.pow(currentA, 2) * rOhm) / 1e6,
    transformerLosses: (noLoadKW, fullLoadKW, loadFrac, ratedMVA, pf = 0.9) => {
      const loadKW = fullLoadKW * Math.pow(loadFrac, 2);
      const totalKW = noLoadKW + loadKW;
      const outKW = ratedMVA * 1000 * loadFrac * pf;
      return {
        noLoadKW: Math.round(noLoadKW * 10) / 10,
        loadKW: Math.round(loadKW * 10) / 10,
        totalKW: Math.round(totalKW * 10) / 10,
        efficiencyPercent: Math.min(99.95, Math.round((outKW / (outKW + totalKW)) * 10000) / 100)
      };
    },
    oltcRegulatedVoltage: (nomKV, tap, stepPct = 1.25, sagKV = 0, nomTap = 7) => {
      const delta = tap - nomTap;
      return Math.round((nomKV * (1 + (delta * stepPct) / 100) - sagKV) * 100) / 100;
    },
    parallelLoadShare: (totalMVA, t1Rated, t1Z, t2Rated, t2Z, t1On, t2On) => {
      if (!t1On && !t2On) return { t1MVA: 0, t1LoadPercent: 0, t2MVA: 0, t2LoadPercent: 0, overloaded: false };
      if (t1On && !t2On) {
        const pct = (totalMVA / t1Rated) * 100;
        return { t1MVA: totalMVA, t1LoadPercent: Math.round(pct * 10) / 10, t2MVA: 0, t2LoadPercent: 0, overloaded: pct > 100 };
      }
      if (!t1On && t2On) {
        const pct = (totalMVA / t2Rated) * 100;
        return { t1MVA: 0, t1LoadPercent: 0, t2MVA: totalMVA, t2LoadPercent: Math.round(pct * 10) / 10, overloaded: pct > 100 };
      }
      const y1 = t1Rated / t1Z, y2 = t2Rated / t2Z, yTot = y1 + y2;
      const s1 = totalMVA * (y1 / yTot), s2 = totalMVA * (y2 / yTot);
      const p1 = (s1 / t1Rated) * 100, p2 = (s2 / t2Rated) * 100;
      return { t1MVA: Math.round(s1 * 10) / 10, t1LoadPercent: Math.round(p1 * 10) / 10, t2MVA: Math.round(s2 * 10) / 10, t2LoadPercent: Math.round(p2 * 10) / 10, overloaded: p1 > 100 || p2 > 100 };
    }
  };

  // Grid Stage Metadata — Canonical 10-Stage Electrical Power System Topology
  const STAGES = [
    {
      id: 'gen',
      name: 'Power Generation',
      shortName: 'Generator',
      pos: { x: -160, y: 16, z: 45 },
      target: { x: -160, y: 6, z: 0 },
      type: 'Synchronous Generator (Turbine Driven)',
      vIn: '—',
      vOut: '21.0 kV',
      ratedMVA: 1200,
      baseMW: 1000,
      cooling: 'Hydrogen / Water Stator Cooling',
      vectorGroup: 'Solidly Earthed Neutral (via NGR)',
      earthing: 'Low-resistance neutral grounding resistor',
      tapInfo: 'Excitation / AVR Terminal Control',
      lossesBaseKW: { noLoad: 350, load: 1200 },
      exploreUrl: null,
      directoryCat: 'machinery.html',
      directoryLabel: 'Explore Power Plant Machinery',
      physics: 'Generates bulk electrical power at medium voltage (21 kV) constrained by generator stator winding dielectric insulation limits.'
    },
    {
      id: 'gsu',
      name: 'GSU Step-Up Substation',
      shortName: 'GSU 21/400kV',
      pos: { x: -125, y: 18, z: 45 },
      target: { x: -125, y: 8, z: 0 },
      type: 'Generator Step-Up (GSU) Transformer',
      vIn: '21.0 kV',
      vOut: '400.0 kV',
      ratedMVA: 1200,
      baseMW: 1000,
      cooling: 'ODAF / OFAF (Directed Oil Forced Air)',
      vectorGroup: 'YNd11 (HV Star-neutral, LV Delta)',
      earthing: 'HV solidly grounded; LV connected via IPB',
      tapInfo: 'De-Energised Tap Changer (DETC) ±2×2.5%',
      lossesBaseKW: { noLoad: 280, load: 1850 },
      exploreUrl: 'gsu.html',
      directoryCat: 'manufacturers/power-transformers/',
      directoryLabel: 'Explore GSU Manufacturers',
      physics: 'Steps voltage up from 21 kV to 400 kV (19.05x increase). At equal transmitted apparent power and equal circuit resistance, line current falls from ~27,493 A to ~1,443 A, reducing conductor I²R losses by ~362.8x! (Illustrative comparison at equal transmitted apparent power and equal assumed circuit resistance. Actual line losses depend on conductor configuration, resistance, length, loading and network design).'
    },
    {
      id: 'ehv-line',
      name: '400 kV EHV Transmission Grid',
      shortName: '400 kV Grid',
      pos: { x: -85, y: 25, z: 60 },
      target: { x: -85, y: 12, z: 0 },
      type: 'Quad-Bundle 400 kV Overhead Transmission Line',
      vIn: '400.0 kV',
      vOut: '400.0 kV',
      ratedMVA: 1500,
      baseMW: 1000,
      cooling: 'Natural Ambient Convection',
      vectorGroup: '3-Phase AC Transposed Line',
      earthing: 'OPGW Optical Ground Shield Wires',
      tapInfo: 'Series Compensation / Shunt Reactors',
      lossesBaseKW: { noLoad: 40, load: 15600 },
      exploreUrl: null,
      directoryCat: 'grids.html',
      directoryLabel: 'View Global Grid Standards',
      physics: 'Bulk power transmission superhighway. Quad-bundle conductors reduce surface electrical gradient, suppressing corona discharge and audible noise.'
    },
    {
      id: 'autotx',
      name: '400/220 kV Interconnecting Substation',
      shortName: 'AutoTx 400/220kV',
      pos: { x: -45, y: 18, z: 45 },
      target: { x: -45, y: 8, z: 0 },
      type: 'Interconnecting Autotransformer',
      vIn: '400.0 kV',
      vOut: '220.0 kV',
      ratedMVA: 750,
      baseMW: 600,
      cooling: 'ONAF / ODAF',
      vectorGroup: 'YNauto0 + d (Common/Series + Tertiary Delta)',
      earthing: 'Directly grounded neutral common point',
      tapInfo: 'Neutral-end On-Load Tap Changer (OLTC)',
      lossesBaseKW: { noLoad: 180, load: 950 },
      exploreUrl: 'autotransformer.html',
      directoryCat: 'components/transformer-bushings.html',
      directoryLabel: 'Explore 400 kV Bushings & Components',
      physics: 'Autotransformers share common winding turns between 400 kV and 220 kV systems, lowering internal impedance, copper mass, and core losses.'
    },
    {
      id: 'subtrans-220',
      name: '220 kV Regional Subtransmission',
      shortName: '220 kV Line',
      pos: { x: -10, y: 22, z: 55 },
      target: { x: -10, y: 10, z: 0 },
      type: 'Twin-Bundle 220 kV Subtransmission Network',
      vIn: '220.0 kV',
      vOut: '220.0 kV',
      ratedMVA: 500,
      baseMW: 400,
      cooling: 'Ambient Air',
      vectorGroup: '3-Phase AC Subtransmission',
      earthing: 'Shield wire grounded at each tower',
      tapInfo: 'Grid Regional Dispatch',
      lossesBaseKW: { noLoad: 25, load: 6200 },
      exploreUrl: null,
      directoryCat: 'grids.html',
      directoryLabel: 'Explore Regional Grid Maps',
      physics: 'Transfers bulk power from national grid interconnectors toward regional transmission substations.'
    },
    {
      id: 'main-sub-220-132',
      name: '220/132 kV Step-Down Power Substation',
      shortName: 'Substation 220/132kV',
      pos: { x: 30, y: 18, z: 45 },
      target: { x: 30, y: 8, z: 0 },
      type: 'Main Grid Step-Down Power Transformer',
      vIn: '220.0 kV',
      vOut: '132.0 kV',
      ratedMVA: 400,
      baseMW: 320,
      cooling: 'ONAF (Oil Natural Air Forced)',
      vectorGroup: 'YNyn0 + d (Star HV / Star LV + Buried Delta)',
      earthing: 'Directly grounded neutral on HV and LV',
      tapInfo: 'HV Neutral Tap Changer (±10% in 16 steps)',
      lossesBaseKW: { noLoad: 160, load: 880 },
      exploreUrl: 'power3d.html',
      directoryCat: 'manufacturers/power-transformers/',
      directoryLabel: 'Explore Power Transformer Manufacturers',
      physics: 'Steps transmission down from 220 kV regional grid to 132 kV subtransmission level, matching regional utility grid voltage levels.'
    },
    {
      id: 'reg-sub-132-33',
      name: '132/33 kV Primary Substation (Dual T1 & T2)',
      shortName: 'Substation 132/33kV',
      pos: { x: 75, y: 16, z: 40 },
      target: { x: 75, y: 6, z: 0 },
      type: 'Dual Parallel Power Transformers (T1 & T2 with OLTC)',
      vIn: '132.0 kV',
      vOut: '33.0 kV',
      ratedMVA: 200, // 2 x 100 MVA
      baseMW: 150,
      cooling: 'ONAN / ONAF',
      vectorGroup: 'Dyn11 (HV Delta, LV Star with Neutral)',
      earthing: 'LV Neutral grounded via neutral earthing transformer',
      tapInfo: 'High-speed Vacuum OLTC (±10% in 16 steps)',
      lossesBaseKW: { noLoad: 120, load: 640 },
      exploreUrl: 'oltc.html',
      directoryCat: 'components/on-load-tap-changers.html',
      directoryLabel: 'Explore On-Load Tap Changers',
      physics: 'N-1 redundant primary substation. OLTC actively compensates for line voltage drop as consumer loading changes during peak demand.'
    },
    {
      id: 'dist-sub-33-11',
      name: '33/11 kV Distribution Substation',
      shortName: '33/11 kV Substation',
      pos: { x: 120, y: 14, z: 35 },
      target: { x: 120, y: 5, z: 0 },
      type: 'Medium Voltage Distribution Substation Transformer',
      vIn: '33.0 kV',
      vOut: '11.0 kV',
      ratedMVA: 40,
      baseMW: 30,
      cooling: 'ONAN',
      vectorGroup: 'Dyn11',
      earthing: 'Substation earthing grid',
      tapInfo: 'De-Energised Tap Changer (DETC) ±2×2.5%',
      lossesBaseKW: { noLoad: 45, load: 190 },
      exploreUrl: 'power3d.html',
      directoryCat: 'manufacturers/distribution-transformers/',
      directoryLabel: 'Explore Distribution Transformers',
      physics: 'Steps 33 kV primary distribution down to 11 kV municipal feeders, supplying city ring mains, commercial parks, and light industry.'
    },
    {
      id: 'dist-tx',
      name: '11/0.415 kV Local Distribution Transformer',
      shortName: 'Local Tx 415V',
      pos: { x: 160, y: 12, z: 30 },
      target: { x: 160, y: 4, z: 0 },
      type: 'Cast-Resin / Mineral-Oil Distribution Transformer',
      vIn: '11.0 kV',
      vOut: '0.415 kV / 240 V',
      ratedMVA: 2.0, // 2000 kVA
      baseMW: 1.6,
      cooling: 'AN (Air Natural) / ONAN',
      vectorGroup: 'Dyn11 (Delta HV / Star LV with accessible Neutral)',
      earthing: 'Solidly grounded neutral providing 240 V line-to-neutral',
      tapInfo: 'Off-Circuit Tap Switch (5-position)',
      lossesBaseKW: { noLoad: 3.2, load: 18.5 },
      exploreUrl: 'explorer.html',
      directoryCat: 'components/insulation-materials.html',
      directoryLabel: 'Explore Transformer Insulation',
      physics: 'Final step-down conversion from 11 kV to usable 415 V three-phase / 240 V single-phase domestic and commercial power.'
    },
    {
      id: 'consumer',
      name: 'Consumer Load Center',
      shortName: 'End Consumer',
      pos: { x: 195, y: 14, z: 35 },
      target: { x: 195, y: 5, z: 0 },
      type: 'Industrial, Commercial & Residential Grid Loads',
      vIn: '0.415 kV / 240 V',
      vOut: 'Usable Electricity (415V/240V)',
      ratedMVA: 2.0,
      baseMW: 1.6,
      cooling: 'HVAC / Fan Forced',
      vectorGroup: '4-Wire TN-C-S / TN-S Consumer Earthing',
      earthing: 'Multiple Earthed Neutral (MEN / PME)',
      tapInfo: 'Consumer Load Management',
      lossesBaseKW: { noLoad: 0.5, load: 12 },
      exploreUrl: null,
      directoryCat: 'buyers-guide.html',
      directoryLabel: 'Transformer Buyer\'s Guide',
      physics: 'Final destination of the power journey. Electric power safely consumed across factories, data centers, hospitals, and homes.'
    }
  ];

  // Simulation State
  const state = {
    currentStageIndex: 0,
    cameraMode: 'follow', // 'overview', 'follow', 'substation', 'transformer', 'free'
    loadPercent: 100, // 25, 50, 75, 100, 110, 120
    powerFlowActive: true,
    avrActive: true,
    oltcTap: 9, // Tap 7 is nominal, 9 is +2.5% boost
    parallelT1InService: true,
    parallelT2InService: true,
    faultMode: 'normal', // 'normal', 'tx-fault', 'internal-fault', 'feeder-fault'
    followProgress: 0, // 0 to 1 along the journey
    isDragging: false
  };

  let scene, camera, renderer, animationFrameId;
  let particlesMesh, particlePositions, particleVelocities;
  let stageObjects = [];
  let faultMarkerMesh;
  const numParticles = 450;

  // Track analytics event safely
  function trackLabEvent(eventName, params = {}) {
    if (window.gtag) {
      window.gtag('event', eventName, params);
    } else if (window.dataLayer) {
      window.dataLayer.push({ event: eventName, ...params });
    }
  }

  // Initialize 3D Engine
  function init3D() {
    const container = document.getElementById('gl-canvas-container');
    if (!container) return;

    // Check WebGL Support
    if (!window.WebGLRenderingContext) {
      showAccessibleFallback('WebGL is not supported on this device/browser.');
      return;
    }

    try {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x070e17);
      scene.fog = new THREE.FogExp2(0x070e17, 0.007);

      const width = container.clientWidth || window.innerWidth;
      const height = container.clientHeight || window.innerHeight;

      camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
      camera.position.set(-130, 20, 55);
      camera.lookAt(-130, 6, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);

      setupLighting();
      buildTerrainAndEnvironment();
      buildGridSystem();
      setupPowerFlowParticles();
      setupEventListeners();
      setupHUD();

      animate();
      trackLabEvent('grid_lab_started', { mode: state.cameraMode });
    } catch (err) {
      console.warn('WebGL initialization error:', err);
      showAccessibleFallback('Could not initialize 3D graphics hardware.');
    }
  }

  function setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x070e17, 0.65);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 1.2);
    sunLight.position.set(-50, 100, 70);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    sunLight.shadow.camera.left = -180;
    sunLight.shadow.camera.right = 180;
    sunLight.shadow.camera.top = 100;
    sunLight.shadow.camera.bottom = -100;
    scene.add(sunLight);

    // Subtle blue fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    fillLight.position.set(50, 40, -50);
    scene.add(fillLight);
  }

  function buildTerrainAndEnvironment() {
    // Ground plane with industrial grid texture
    const groundGeo = new THREE.PlaneGeometry(600, 300, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0b1726,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle grid lines for high-tech CAD aesthetic
    const gridHelper = new THREE.GridHelper(500, 50, 0x1e3a5c, 0x112233);
    gridHelper.position.y = 0.05;
    scene.add(gridHelper);
  }

  // Build the complete physical 3D power grid (10 Canonical Stages)
  function buildGridSystem() {
    // 1. Generation Station (X: -160)
    buildPowerPlant(-160, 0);

    // 2. GSU Substation (X: -125)
    buildSubstationYard(-125, 0, 'GSU 21/400kV', 0xf5a623);

    // 3. 400 kV Transmission Line (X: -125 to -45)
    buildTransmissionLine(-125, -45, 400, 3);

    // 4. 400/220 kV Interconnecting Substation (X: -45)
    buildSubstationYard(-45, 0, 'AutoTx 400/220kV', 0x38bdf8);

    // 5. 220 kV Transmission Line (X: -45 to 30)
    buildTransmissionLine(-45, 30, 220, 2);

    // 6. 220/132 kV Step-Down Substation (X: 30)
    buildSubstationYard(30, 0, 'Substation 220/132kV', 0x60a5fa);

    // 7. 132/33 kV Regional Substation (X: 75, Dual Parallel T1 & T2)
    buildSubstationYard(75, 0, 'Substation 132/33kV', 0x22c55e, true);

    // 8. 33 kV Distribution Line (X: 75 to 120)
    buildDistributionPoles(75, 120, 0);

    // 9. 33/11 kV Distribution Substation (X: 120)
    buildDistributionSubstation(120, 0);

    // 10. 11 kV Feeder Line & 11/0.415 kV Local Transformer (X: 160)
    buildDistributionPoles(120, 160, 0);
    buildLocalTransformer(160, 0);

    // 11. Consumer Load Zone (X: 195)
    buildConsumerLoadZone(195, 0);

    // Fault indicator mesh (hidden by default)
    const faultGeo = new THREE.SphereGeometry(2.5, 16, 16);
    const faultMat = new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true });
    faultMarkerMesh = new THREE.Mesh(faultGeo, faultMat);
    faultMarkerMesh.visible = false;
    scene.add(faultMarkerMesh);
  }

  // Builder Helper: Power Plant
  function buildPowerPlant(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Turbine Hall Main Building
    const bldgGeo = new THREE.BoxGeometry(24, 14, 18);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.y = 7;
    bldg.castShadow = true;
    bldg.receiveShadow = true;
    group.add(bldg);

    // Cooling Towers
    for (let i = -1; i <= 1; i += 2) {
      const towerGeo = new THREE.CylinderGeometry(4, 6, 16, 24);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.set(i * 18, 8, -14);
      tower.castShadow = true;
      group.add(tower);
    }

    // Generator Rotor / Housing Output Box
    const genGeo = new THREE.CylinderGeometry(3.5, 3.5, 10, 16);
    const genMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.6, roughness: 0.3 });
    const gen = new THREE.Mesh(genGeo, genMat);
    gen.rotation.z = Math.PI / 2;
    gen.position.set(0, 4, 10);
    gen.castShadow = true;
    group.add(gen);

    // Isolated Phase Bus (IPB) ducting towards GSU
    const ipbGeo = new THREE.CylinderGeometry(0.8, 0.8, 20, 12);
    const ipbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
    const ipb = new THREE.Mesh(ipbGeo, ipbMat);
    ipb.rotation.z = Math.PI / 2;
    ipb.position.set(16, 4, 10);
    group.add(ipb);

    scene.add(group);
  }

  // Builder Helper: Substation Yard (Transformers, Switchgear, Gantries)
  function buildSubstationYard(x, z, label, accentColor, isParallel = false) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Substation gravel boundary
    const yardGeo = new THREE.BoxGeometry(32, 0.4, 28);
    const yardMat = new THREE.MeshStandardMaterial({ color: 0x142334, roughness: 0.9 });
    const yard = new THREE.Mesh(yardGeo, yardMat);
    yard.position.y = 0.2;
    yard.receiveShadow = true;
    group.add(yard);

    // Primary Transformer(s)
    if (isParallel) {
      // Dual parallel units T1 and T2
      const t1 = createTransformerModel(accentColor, 'T1');
      t1.position.set(-6, 0, 0);
      group.add(t1);

      const t2 = createTransformerModel(accentColor, 'T2');
      t2.position.set(6, 0, 0);
      group.add(t2);
    } else {
      const tx = createTransformerModel(accentColor);
      group.add(tx);
    }

    // Busbar Gantries & Steel Structures
    for (let i = -1; i <= 1; i += 2) {
      const gantryGeo = new THREE.BoxGeometry(0.6, 12, 0.6);
      const gantryMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 });
      const g1 = new THREE.Mesh(gantryGeo, gantryMat);
      g1.position.set(i * 12, 6, -10);
      group.add(g1);

      const beamGeo = new THREE.BoxGeometry(24, 0.6, 0.6);
      const beam = new THREE.Mesh(beamGeo, gantryMat);
      beam.position.set(0, 11.5, -10);
      group.add(beam);
    }

    // SF6 Circuit Breakers & Instrument CT/VTs
    for (let j = -8; j <= 8; j += 8) {
      const cbGeo = new THREE.CylinderGeometry(0.5, 0.6, 4, 12);
      const cbMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4 });
      const cb = new THREE.Mesh(cbGeo, cbMat);
      cb.position.set(j, 2, -6);
      group.add(cb);
    }

    scene.add(group);
  }

  // Builder Helper: Transformer Detailed Mesh
  function createTransformerModel(accentColor, labelText) {
    const txGroup = new THREE.Group();

    // Main Tank
    const tankGeo = new THREE.BoxGeometry(6, 5, 4.5);
    const tankMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      metalness: 0.4,
      roughness: 0.5
    });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.y = 2.5;
    tank.castShadow = true;
    tank.receiveShadow = true;
    txGroup.add(tank);

    // Conservator Tank on top
    const consGeo = new THREE.CylinderGeometry(0.9, 0.9, 5, 16);
    const consMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.3 });
    const cons = new THREE.Mesh(consGeo, consMat);
    cons.rotation.z = Math.PI / 2;
    cons.position.set(0, 5.8, -1.2);
    txGroup.add(cons);

    // Radiator Cooling Banks
    for (let side = -1; side <= 1; side += 2) {
      const radGeo = new THREE.BoxGeometry(0.4, 3.8, 3.8);
      const radMat = new THREE.MeshStandardMaterial({ color: 0x0f233a, roughness: 0.6 });
      const rad = new THREE.Mesh(radGeo, radMat);
      rad.position.set(side * 3.4, 2.4, 0);
      txGroup.add(rad);
    }

    // High Voltage Bushings (3-Phase)
    for (let b = -1.6; b <= 1.6; b += 1.6) {
      const bushGeo = new THREE.CylinderGeometry(0.18, 0.35, 3.2, 12);
      const bushMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.3 }); // Brown glazed porcelain
      const bush = new THREE.Mesh(bushGeo, bushMat);
      bush.position.set(b, 6.2, 0.8);
      bush.rotation.x = 0.2;
      txGroup.add(bush);
    }

    return txGroup;
  }

  // Builder Helper: Transmission Towers & Conductors
  function buildTransmissionLine(startX, endX, kv, bundles) {
    const step = (endX - startX) / 3;
    for (let i = 1; i <= 2; i++) {
      const x = startX + step * i;
      buildLatticeTower(x, 0, kv);
    }
  }

  function buildLatticeTower(x, z, kv) {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(x, 0, z);

    const height = kv >= 400 ? 22 : 16;
    const bodyGeo = new THREE.CylinderGeometry(0.8, 2.5, height, 4);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.4, wireframe: false });
    const body = new THREE.Mesh(bodyGeo, towerMat);
    body.position.y = height / 2;
    body.castShadow = true;
    towerGroup.add(body);

    // Cross-arms for phase conductors
    const armGeo = new THREE.BoxGeometry(10, 0.5, 0.8);
    const arm = new THREE.Mesh(armGeo, towerMat);
    arm.position.y = height - 3;
    towerGroup.add(arm);

    // Insulator strings hanging from arms
    for (let a = -4; a <= 4; a += 4) {
      const insGeo = new THREE.CylinderGeometry(0.15, 0.25, 2.2, 8);
      const insMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.2 });
      const ins = new THREE.Mesh(insGeo, insMat);
      ins.position.set(a, height - 4.4, 0);
      towerGroup.add(ins);
    }

    scene.add(towerGroup);
  }

  // Builder Helper: Distribution Wood/Concrete Poles
  function buildDistributionPoles(startX, endX, z) {
    const count = 3;
    const step = (endX - startX) / count;
    for (let i = 1; i <= count; i++) {
      const x = startX + step * i;
      const poleGroup = new THREE.Group();
      poleGroup.position.set(x, 0, z);

      const poleGeo = new THREE.CylinderGeometry(0.2, 0.3, 9, 8);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.5;
      poleGroup.add(pole);

      const armGeo = new THREE.BoxGeometry(2.4, 0.2, 0.2);
      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.y = 8.5;
      poleGroup.add(arm);

      scene.add(poleGroup);
    }
  }

  // Builder Helper: 33/11 kV Substation
  function buildDistributionSubstation(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    const bldgGeo = new THREE.BoxGeometry(10, 5, 8);
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const bldg = new THREE.Mesh(bldgGeo, bldgMat);
    bldg.position.y = 2.5;
    group.add(bldg);

    const tx = createTransformerModel(0x38bdf8);
    tx.scale.set(0.65, 0.65, 0.65);
    tx.position.set(6, 0, 0);
    group.add(tx);

    scene.add(group);
  }

  // Builder Helper: 11/0.415 kV Local Transformer
  function buildLocalTransformer(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Pad-mount enclosure
    const padGeo = new THREE.BoxGeometry(2.2, 2.2, 1.8);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x15803d, metalness: 0.3 }); // Utility green
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 1.1;
    group.add(pad);

    scene.add(group);
  }

  // Builder Helper: Consumer Load Zone
  function buildConsumerLoadZone(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Industrial Factory with Sawtooth Roof
    const factoryGeo = new THREE.BoxGeometry(14, 8, 12);
    const factoryMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const factory = new THREE.Mesh(factoryGeo, factoryMat);
    factory.position.set(0, 4, -8);
    group.add(factory);

    // Commercial Office Tower
    const towerGeo = new THREE.BoxGeometry(8, 18, 8);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.2 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(-6, 9, 8);
    group.add(tower);

    // Residential Houses
    for (let r = 2; r <= 8; r += 4) {
      const houseGeo = new THREE.BoxGeometry(3, 2.5, 3);
      const houseMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const house = new THREE.Mesh(houseGeo, houseMat);
      house.position.set(r, 1.25, 8);
      group.add(house);
    }

    scene.add(group);
  }

  // Setup Flowing Energy Particles
  function setupPowerFlowParticles() {
    const particleGeo = new THREE.BufferGeometry();
    particlePositions = new Float32Array(numParticles * 3);
    particleVelocities = new Float32Array(numParticles);

    // Spread particles along the entire X-axis journey (-160 to +195)
    for (let i = 0; i < numParticles; i++) {
      const progress = i / numParticles;
      const x = -160 + progress * 355;
      let y = 14;
      if (x < -125) y = 4.5; // Generator to GSU IPB
      else if (x >= -125 && x <= -45) y = 18; // 400 kV EHV
      else if (x > -45 && x <= 30) y = 14; // 220 kV Subtransmission
      else if (x > 30 && x <= 75) y = 11; // 132 kV Substation line
      else if (x > 75 && x <= 120) y = 8.5; // 33 kV Distribution
      else if (x > 120 && x <= 160) y = 6.0; // 11 kV Feeders
      else y = 2.5; // 415 V Consumer drops

      const z = (Math.sin(i * 0.5) * 1.5);

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;
      particleVelocities[i] = 0.4 + Math.random() * 0.3;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xf5a623,
      size: 0.9,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    particlesMesh = new THREE.Points(particleGeo, particleMat);
    scene.add(particlesMesh);
  }

  // UI Setup & Stage Switching
  function setupHUD() {
    const journeyBar = document.getElementById('gl-journey-bar');
    if (journeyBar) {
      journeyBar.innerHTML = STAGES.map((s, idx) => `
        <button class="gl-stage-pill ${idx === 0 ? 'active' : ''}" data-index="${idx}">
          <span class="dot"></span>
          <span>${s.shortName}</span>
        </button>
      `).join('');

      journeyBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.gl-stage-pill');
        if (btn) {
          const idx = parseInt(btn.dataset.index, 10);
          setStage(idx);
        }
      });
    }

    // Camera Mode Switcher
    const camGroup = document.getElementById('gl-cam-group');
    if (camGroup) {
      camGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.dataset.mode) {
          camGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.cameraMode = btn.dataset.mode;
          trackLabEvent('camera_mode_changed', { mode: state.cameraMode });
        }
      });
    }

    // Load Buttons
    const loadGroup = document.getElementById('gl-load-group');
    if (loadGroup) {
      loadGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && btn.dataset.load) {
          loadGroup.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          state.loadPercent = parseInt(btn.dataset.load, 10);
          updateCalculationsHUD();
          trackLabEvent('load_changed', { loadPercent: state.loadPercent });
        }
      });
    }

    // Fault Selector
    const faultSelect = document.getElementById('gl-fault-select');
    if (faultSelect) {
      faultSelect.addEventListener('change', (e) => {
        state.faultMode = e.target.value;
        applyFaultSimulation();
        trackLabEvent('fault_triggered', { faultType: state.faultMode });
      });
    }

    // OLTC & Parallel Controls
    const oltcToggle = document.getElementById('gl-avr-toggle');
    if (oltcToggle) {
      oltcToggle.addEventListener('change', (e) => {
        state.avrActive = e.target.checked;
        updateCalculationsHUD();
        trackLabEvent('oltc_simulated', { avr: state.avrActive, tap: state.oltcTap });
      });
    }

    const tripT1Btn = document.getElementById('gl-trip-t1-btn');
    if (tripT1Btn) {
      tripT1Btn.addEventListener('click', () => {
        state.parallelT1InService = !state.parallelT1InService;
        tripT1Btn.textContent = state.parallelT1InService ? 'Trip T1 (Simulate Outage)' : 'Restore T1 to Service';
        tripT1Btn.classList.toggle('gl-status-trip', !state.parallelT1InService);
        updateCalculationsHUD();
        trackLabEvent('parallel_trip_simulated', { t1InService: state.parallelT1InService });
      });
    }

    // Accessible Non-WebGL view toggle
    const toggleA11yBtn = document.getElementById('gl-toggle-accessible');
    if (toggleA11yBtn) {
      toggleA11yBtn.addEventListener('click', () => {
        const a11yView = document.getElementById('gl-accessible-view');
        if (a11yView) {
          a11yView.classList.toggle('visible');
        }
      });
    }

    updateCalculationsHUD();
  }

  function setStage(index) {
    if (index < 0 || index >= STAGES.length) return;
    state.currentStageIndex = index;

    // Update Journey Bar active states
    document.querySelectorAll('.gl-stage-pill').forEach((pill, i) => {
      pill.classList.toggle('active', i === index);
    });

    updateCalculationsHUD();
    trackLabEvent('grid_stage_viewed', { stageId: STAGES[index].id, stageName: STAGES[index].name });
  }

  function updateCalculationsHUD() {
    const stage = STAGES[state.currentStageIndex];
    if (!stage) return;

    const loadFrac = state.loadPercent / 100;
    const currentMW = stage.baseMW * loadFrac;
    const currentMVA = currentMW / 0.9;

    // Voltage parsing
    let vInVal = parseFloat(stage.vIn) || 0;
    let vOutVal = parseFloat(stage.vOut) || 0;

    // OLTC Regulation Effect at 132/33 kV Substation
    if (stage.id === 'reg-sub') {
      const sag = (loadFrac - 1.0) * 2.2; // Voltage sags under heavy load
      if (state.avrActive) {
        // Automatic tap stepping to maintain ~33.0 kV
        if (loadFrac > 1.0) state.oltcTap = 10;
        else if (loadFrac >= 0.75) state.oltcTap = 9;
        else state.oltcTap = 7;
      }
      vOutVal = calc.oltcRegulatedVoltage(33.0, state.oltcTap, 1.25, Math.max(0, sag));
    }

    // Three-phase current calculations
    const iHV = vInVal > 0 ? Math.round(calc.threePhaseCurrent(currentMVA, vInVal)) : '—';
    const iLV = vOutVal > 0 ? Math.round(calc.threePhaseCurrent(currentMVA, vOutVal)) : '—';

    // Losses
    const losses = calc.transformerLosses(
      stage.lossesBaseKW.noLoad,
      stage.lossesBaseKW.load,
      loadFrac,
      stage.ratedMVA
    );

    // Parallel load sharing for 132/33kV
    let parallelInfo = '';
    if (stage.id === 'reg-sub') {
      const pShare = calc.parallelLoadShare(
        currentMVA,
        100, 12.5,
        100, 12.5,
        state.parallelT1InService,
        state.parallelT2InService
      );
      parallelInfo = `
        <div class="gl-metric-box" style="grid-column: span 2; margin-top: 4px; border-color: ${pShare.overloaded ? 'var(--gl-red)' : 'var(--gl-panel-border)'}">
          <div class="gl-metric-lbl">Parallel Loading (T1 / T2)</div>
          <div class="gl-metric-val" style="font-size: 0.85rem">
            T1: ${state.parallelT1InService ? pShare.t1MVA + ' MVA (' + pShare.t1LoadPercent + '%)' : '🔴 TRIPPED'} &nbsp;|&nbsp;
            T2: ${state.parallelT2InService ? pShare.t2MVA + ' MVA (' + pShare.t2LoadPercent + '%)' : '🔴 TRIPPED'}
          </div>
          ${pShare.overloaded ? '<div style="color:var(--gl-red);font-size:0.75rem;font-weight:700;margin-top:2px">⚠️ N-1 CONTINGENCY OVERLOAD DETECTED</div>' : ''}
        </div>
      `;
    }

    // Render Live Engineering HUD
    const hudContainer = document.getElementById('gl-eng-panel-content');
    if (hudContainer) {
      hudContainer.innerHTML = `
        <div class="gl-eng-header">
          <div class="gl-eng-stage-badge">Stage ${state.currentStageIndex + 1} of ${STAGES.length}</div>
          <div class="gl-eng-title">${stage.name}</div>
        </div>

        <div class="gl-physics-callout">
          <b>Engineering Physics:</b> ${stage.physics}
        </div>

        <div class="gl-metric-grid">
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Primary Voltage</div>
            <div class="gl-metric-val">${stage.vIn}</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Secondary Voltage</div>
            <div class="gl-metric-val highlight">${vOutVal ? vOutVal + ' kV' : stage.vOut}</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Active Power</div>
            <div class="gl-metric-val">${Math.round(currentMW)} MW</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Apparent Power</div>
            <div class="gl-metric-val">${Math.round(currentMVA)} MVA</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Primary Current (I₁)</div>
            <div class="gl-metric-val">${iHV !== '—' ? iHV.toLocaleString() + ' A' : '—'}</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Secondary Current (I₂)</div>
            <div class="gl-metric-val highlight">${iLV !== '—' ? iLV.toLocaleString() + ' A' : '—'}</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Total Losses</div>
            <div class="gl-metric-val">${losses.totalKW.toLocaleString()} kW</div>
          </div>
          <div class="gl-metric-box">
            <div class="gl-metric-lbl">Est. Efficiency</div>
            <div class="gl-metric-val">${losses.efficiencyPercent}%</div>
          </div>
          ${parallelInfo}
        </div>

        <div style="background:rgba(7,14,23,0.7);border:1px solid var(--gl-panel-border);border-radius:6px;padding:10px;font-size:0.78rem;line-height:1.6;margin-bottom:12px">
          <div><b style="color:var(--gl-muted)">Transformer Type:</b> ${stage.type}</div>
          <div><b style="color:var(--gl-muted)">Vector Group:</b> ${stage.vectorGroup}</div>
          <div><b style="color:var(--gl-muted)">Cooling Mode:</b> ${stage.cooling}</div>
          <div><b style="color:var(--gl-muted)">Earthing:</b> ${stage.earthing}</div>
          <div><b style="color:var(--gl-muted)">Tap Regulation:</b> ${stage.tapInfo} ${stage.id === 'reg-sub' ? '(Tap ' + state.oltcTap + ')' : ''}</div>
          <div style="margin-top:6px">
            <span class="gl-status-pill ${state.faultMode !== 'normal' ? 'gl-status-trip' : (state.loadPercent > 100 ? 'gl-status-warn' : 'gl-status-ok')}">
              ● ${state.faultMode !== 'normal' ? 'FAULT TRIPPED' : (state.loadPercent > 100 ? 'OVERLOAD ' + state.loadPercent + '%' : 'IN SERVICE')}
            </span>
          </div>
        </div>

        ${stage.exploreUrl ? `
          <a class="gl-action-btn" href="/${stage.exploreUrl}" target="_blank" data-track="grid_explore_inside">
            🔍 Explore Inside 3D Model →
          </a>
        ` : ''}

        <div class="gl-sub-links">
          <a class="gl-sub-link" href="/${stage.directoryCat}">🏢 ${stage.directoryLabel}</a>
          <a class="gl-sub-link" href="/rfq.html?spec=${encodeURIComponent(stage.name)}">📋 Submit Technical RFQ</a>
        </div>
      `;
    }
  }

  function applyFaultSimulation() {
    if (!faultMarkerMesh) return;

    if (state.faultMode === 'normal') {
      faultMarkerMesh.visible = false;
      state.powerFlowActive = true;
    } else if (state.faultMode === 'tx-fault') {
      // 400 kV Transmission Fault
      faultMarkerMesh.position.set(-85, 14, 0);
      faultMarkerMesh.visible = true;
      state.powerFlowActive = false;
    } else if (state.faultMode === 'internal-fault') {
      // Transformer Internal Fault at GSU (87T Differential / Buchholz / REF)
      faultMarkerMesh.position.set(-125, 6, 0);
      faultMarkerMesh.visible = true;
      state.powerFlowActive = false;
    } else if (state.faultMode === 'feeder-fault') {
      // 11 kV Feeder Overcurrent Fault
      faultMarkerMesh.position.set(140, 6, 0);
      faultMarkerMesh.visible = true;
      state.powerFlowActive = false;
    }
    updateCalculationsHUD();
  }

  function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= STAGES.length) {
        setStage(num - 1);
      } else if (e.code === 'Space') {
        state.powerFlowActive = !state.powerFlowActive;
      }
    });

    // Simple drag-to-orbit for Free mode
    const container = document.getElementById('gl-canvas-container');
    let isMouseDown = false;
    let prevMouseX = 0, prevMouseY = 0;

    container.addEventListener('mousedown', (e) => {
      if (state.cameraMode !== 'free') return;
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      container.classList.add('dragging');
    });

    window.addEventListener('mouseup', () => {
      isMouseDown = false;
      if (container) container.classList.remove('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isMouseDown || state.cameraMode !== 'free') return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      camera.position.x -= deltaX * 0.2;
      camera.position.y += deltaY * 0.2;
    });
  }

  function onWindowResize() {
    const container = document.getElementById('gl-canvas-container');
    if (!container || !renderer || !camera) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  // Fallback Accessible Screen
  function showAccessibleFallback(reason) {
    const a11yView = document.getElementById('gl-accessible-view');
    if (a11yView) {
      a11yView.classList.add('visible');
    }
  }

  // Main Render Loop
  function animate() {
    animationFrameId = requestAnimationFrame(animate);

    // 1. Smooth Camera Motion
    const targetStage = STAGES[state.currentStageIndex];
    if (targetStage) {
      if (state.cameraMode === 'overview') {
        camera.position.lerp(new THREE.Vector3(30, 80, 160), 0.03);
        camera.lookAt(30, 5, 0);
      } else if (state.cameraMode === 'follow') {
        state.followProgress += 0.0008;
        if (state.followProgress > 1.0) state.followProgress = 0;
        const currentStageFloat = state.followProgress * (STAGES.length - 1);
        const lowIdx = Math.floor(currentStageFloat);
        const highIdx = Math.min(lowIdx + 1, STAGES.length - 1);
        const frac = currentStageFloat - lowIdx;

        const sLow = STAGES[lowIdx];
        const sHigh = STAGES[highIdx];

        const camX = sLow.pos.x + (sHigh.pos.x - sLow.pos.x) * frac;
        const camY = sLow.pos.y + (sHigh.pos.y - sLow.pos.y) * frac;
        const camZ = sLow.pos.z + (sHigh.pos.z - sLow.pos.z) * frac;

        const lookX = sLow.target.x + (sHigh.target.x - sLow.target.x) * frac;
        const lookY = sLow.target.y + (sHigh.target.y - sLow.target.y) * frac;
        const lookZ = sLow.target.z + (sHigh.target.z - sLow.target.z) * frac;

        camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.05);
        camera.lookAt(lookX, lookY, lookZ);

        if (lowIdx !== state.currentStageIndex && frac < 0.2) {
          setStage(lowIdx);
        }
      } else {
        camera.position.lerp(new THREE.Vector3(targetStage.pos.x, targetStage.pos.y, targetStage.pos.z), 0.04);
        camera.lookAt(targetStage.target.x, targetStage.target.y, targetStage.target.z);
      }
    }

    // 2. Animate Power Flow Particles
    if (particlesMesh && state.powerFlowActive) {
      const positions = particlesMesh.geometry.attributes.position.array;
      const speedMult = (state.loadPercent / 100) * 0.7;

      for (let i = 0; i < numParticles; i++) {
        positions[i * 3] += particleVelocities[i] * speedMult;
        if (positions[i * 3] > 195) {
          positions[i * 3] = -160;
        }
      }
      particlesMesh.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Fault Marker Pulsing
    if (faultMarkerMesh && faultMarkerMesh.visible) {
      const scale = 1 + Math.sin(Date.now() * 0.01) * 0.3;
      faultMarkerMesh.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
  }

  // Expose API and Boot
  window.TPGridLab = {
    init: init3D,
    setStage,
    setLoad: (pct) => { state.loadPercent = pct; updateCalculationsHUD(); },
    setFault: (f) => { state.faultMode = f; applyFaultSimulation(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init3D);
  } else {
    init3D();
  }
})();
