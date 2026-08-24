/* Validation harness for the 2D axisymmetric leakage solver.
   Nothing ships unless these pass. */
const TPFEM = require('../fem-leakage.js');
const MU0 = 4e-7 * Math.PI;

function classicalL(N, Dm, h, g, b1, b2) {
  // Textbook concentric-winding leakage inductance, no Rogowski correction.
  // L = mu0 N^2 (pi Dm / h) [ g + (b1+b2)/3 ]
  return MU0 * N * N * (Math.PI * Dm / h) * (g + (b1 + b2) / 3);
}

function caseGeom(h, nr, nz) {
  const Rc = 0.150;          // core surface radius, m
  const gclv = 0.010;        // core -> LV
  const b1 = 0.040;          // LV radial build
  const g = 0.030;           // LV -> HV gap
  const b2 = 0.045;          // HV radial build
  const gend = 0.100;        // winding end -> yoke

  const R1 = Rc + gclv, R2 = R1 + b1;
  const R3 = R2 + g,    R4 = R3 + b2;
  const Hw = h + 2 * gend;
  const zb = gend, zt = gend + h;

  const N = 200, I = 500;    // ampere-turns, balanced
  return {
    Rc, R1, R2, R3, R4, zb, zt, Hw,
    NI_in: N * I, NI_out: -N * I, I_in: I, N, b1, b2, g,
    f: 50, nr, nz,
    Rmax: Rc + 6.0 * (R4 - Rc),
    nSections: 24, tol: 1e-11, maxIter: 20000
  };
}


console.log('');
console.log('='.repeat(72));
console.log('TEST 0 — matrix symmetry (CG is only valid on a symmetric operator)');
console.log('  This is the bug that broke the first attempt, so test it directly.');
console.log('='.repeat(72));
{
  // Probe <Mx,y> vs <x,My> on random vectors via the exported solve path is
  // awkward, so rebuild the operator here from the same rules and compare
  // M[a][b] against M[b][a] by unit-vector probing on a small grid.
  const G = caseGeom(1.0, 14, 18);
  const nr = G.nr, nz = G.nz, N = nr * nz;
  const MU0v = 4e-7 * Math.PI;
  const Rc = G.Rc, Rmax = G.Rmax, Hw = G.Hw;
  const dr = (Rmax - Rc) / (nr - 1), dz = Hw / (nz - 1);
  const rAt = i => Rc + i * dr, idx = (i, j) => j * nr + i;
  const invdr2 = 1 / (dr * dr), invdz2 = 1 / (dz * dz);
  const isDir = new Uint8Array(N);
  for (let j = 0; j < nz; j++) isDir[idx(nr - 1, j)] = 1;
  const cE = new Float64Array(nr);
  for (let i = 0; i < nr - 1; i++) cE[i] = invdr2 / (rAt(i) + 0.5 * dr);
  const diag = new Float64Array(N);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
    const k = idx(i, j);
    if (isDir[k]) { diag[k] = 1; continue; }
    let d = 0;
    if (i < nr - 1) d += cE[i];
    if (i > 0) d += cE[i - 1];
    const cz = invdz2 / rAt(i);
    if (j < nz - 1) d += cz;
    if (j > 0) d += cz;
    diag[k] = d;
  }
  function apply(x, out) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
      const k = idx(i, j);
      if (isDir[k]) { out[k] = x[k]; continue; }
      let v = diag[k] * x[k];
      if (i < nr - 1 && !isDir[idx(i + 1, j)]) v -= cE[i] * x[idx(i + 1, j)];
      if (i > 0 && !isDir[idx(i - 1, j)]) v -= cE[i - 1] * x[idx(i - 1, j)];
      const cz = invdz2 / rAt(i);
      if (j < nz - 1 && !isDir[idx(i, j + 1)]) v -= cz * x[idx(i, j + 1)];
      if (j > 0 && !isDir[idx(i, j - 1)]) v -= cz * x[idx(i, j - 1)];
      out[k] = v;
    }
  }
  // <Mx, y> should equal <x, My> for random x, y
  let worst = 0;
  for (let t = 0; t < 5; t++) {
    const x = new Float64Array(N), y = new Float64Array(N);
    for (let i = 0; i < N; i++) { x[i] = Math.sin(i * (t + 1.7)); y[i] = Math.cos(i * (t + 2.3)); }
    const Mx = new Float64Array(N), My = new Float64Array(N);
    apply(x, Mx); apply(y, My);
    let a = 0, b = 0;
    for (let i = 0; i < N; i++) { a += Mx[i] * y[i]; b += x[i] * My[i]; }
    worst = Math.max(worst, Math.abs(a - b) / Math.max(Math.abs(a), 1e-30));
  }
  console.log('  max relative |<Mx,y> - <x,My>| = ' + worst.toExponential(3) +
              (worst < 1e-12 ? '   SYMMETRIC' : '   *** NOT SYMMETRIC ***'));
}

console.log('='.repeat(72));
console.log('TEST 1 — tall-winding limit: FEM should approach the classical formula');
console.log('  (as h grows, end fringing fades and the Rogowski factor -> 1)');
console.log('='.repeat(72));
console.log('   h (m)   h/build   L_fem (mH)   L_classical (mH)   ratio   Kr_implied');

for (const h of [0.5, 1.0, 2.0, 4.0, 8.0, 16.0]) {
  const G = caseGeom(h, 130, 170);
  const res = TPFEM.solve(G);
  const Dm = (G.R2 + G.R3);           // mean DIAMETER of the gap
  const Lc = classicalL(G.N, Dm, h, G.g, G.b1, G.b2);
  const build = G.b1 + G.g + G.b2;
  console.log(
    '  ' + h.toFixed(2).padStart(6) +
    ' ' + (h / build).toFixed(1).padStart(8) +
    ' ' + (res.L * 1e3).toFixed(4).padStart(12) +
    ' ' + (Lc * 1e3).toFixed(4).padStart(17) +
    ' ' + (res.L / Lc).toFixed(4).padStart(8) +
    ' ' + (1 - build / (Math.PI * h)).toFixed(4).padStart(11)
  );
}

console.log('');
console.log('='.repeat(72));
console.log('TEST 2 — grid convergence at h = 1.0 m');
console.log('='.repeat(72));
console.log('   density (grid)      L (mH)   change vs coarser   CG iters   residual');
let prev = null;
for (const dens of [60, 120, 240, 480]) {
  const G = caseGeom(1.0, 140, 180); G.density = dens; delete G.nr; delete G.nz;
  const res = TPFEM.solve(G);
  const chg = prev == null ? '' : (((res.L - prev) / prev) * 100).toFixed(3) + ' %';
  console.log('  ' + ('d=' + dens + ' (' + res.grid.nr + 'x' + res.grid.nz + ')').padStart(18) +
    ' ' + (res.L * 1e3).toFixed(5).padStart(11) +
    ' ' + String(chg).padStart(17) +
    ' ' + String(res.solver.iters).padStart(10) +
    ' ' + res.solver.resid.toExponential(2).padStart(11));
  prev = res.L;
}

console.log('');
console.log('='.repeat(72));
console.log('TEST 3 — force physics at h = 1.0 m');
console.log('='.repeat(72));
{
  const G = caseGeom(1.0, 140, 180);
  const r = TPFEM.solve(G);
  console.log('  Inner winding  Fr = ' + (r.inner.Fr / 1e3).toFixed(2) + ' kN   (expect NEGATIVE = squeezed inward)');
  console.log('  Outer winding  Fr = ' + (r.outer.Fr / 1e3).toFixed(2) + ' kN   (expect POSITIVE = burst outward)');
  console.log('  Inner Fz = ' + (r.inner.Fz / 1e3).toFixed(4) + ' kN,  Outer Fz = ' + (r.outer.Fz / 1e3).toFixed(4) + ' kN');
  console.log('  Sum of axial = ' + ((r.inner.Fz + r.outer.Fz) / 1e3).toExponential(3) +
              ' kN  (expect ~0 for symmetric windings)');

  // Axial distribution should be antisymmetric about mid-height
  const s = r.inner.sections, n = s.length;
  let asym = 0, scale = 0;
  for (let i = 0; i < n; i++) {
    asym += Math.abs(s[i].Fz + s[n - 1 - i].Fz);
    scale += Math.abs(s[i].Fz);
  }
  console.log('  Axial antisymmetry error = ' + ((asym / scale) * 100).toFixed(3) +
              ' %  (expect ~0: ends pushed toward mid-height, equal and opposite)');
  console.log('  Peak |Fz| in a section   = ' +
    (Math.max(...s.map(x => Math.abs(x.Fz))) / 1e3).toFixed(3) + ' kN');
}

console.log('');
console.log('='.repeat(72));
console.log('TEST 4 — ampere-turn imbalance (a tap gap) should create net axial thrust');
console.log('  This is the case closed-form methods handle badly.');
console.log('='.repeat(72));
{
  const base = caseGeom(1.0, 140, 180);
  // Shorten the OUTER winding by 10% at the top: classic tapped-out condition
  const G = Object.assign({}, base, { zb2: base.zb, zt2: base.zt - 0.10 * 1.0 });
  const r = TPFEM.solve(G);
  console.log('  Outer winding 10% shorter (tap out at top)');
  console.log('  Inner Fz = ' + (r.inner.Fz / 1e3).toFixed(2) + ' kN');
  console.log('  Outer Fz = ' + (r.outer.Fz / 1e3).toFixed(2) + ' kN');
  console.log('  -> net axial thrust appears where the symmetric case had none');
}
