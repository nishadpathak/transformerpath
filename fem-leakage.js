/* ═══════════════════════════════════════════════════════════════════════════
   TransformerPath — 2D axisymmetric leakage-field solver
   ---------------------------------------------------------------------------
   Solves the magnetostatic leakage field of two concentric windings in the
   core window, and derives from it the quantities closed-form methods
   approximate or cannot produce at all:

     · leakage reactance from stored energy   (replaces the Rogowski factor)
     · radial force density        J x Bz     (classical formulas give a total)
     · AXIAL force distribution    J x Br     (closed form is poor here, and
                                               axial collapse is a real failure
                                               mode under ampere-turn imbalance)

   Formulation
   -----------
   Axisymmetric magnetostatics, solved in the flux function u = r * A_theta
   rather than in A directly. Written this way the operator is in divergence
   form and is SELF-ADJOINT:

       d/dr[ (1/r) du/dr ] + d/dz[ (1/r) du/dz ] = -mu0 * J

   with  B_r = -(1/r) du/dz  and  B_z = (1/r) du/dr.

   This matters: discretising A directly leaves the (1/r)dA/dr term producing
   an unsymmetric matrix, and conjugate gradient then fails to converge — it
   returns a plausible-looking but wrong field. Conservative face-based
   differencing of the form above gives a symmetric positive-definite matrix,
   which CG solves reliably, and makes the Neumann conditions natural (a
   no-flux boundary is simply an omitted face) so symmetry is preserved.

   Domain is the core window: r from the core surface to a far boundary,
   z from lower yoke to upper yoke.

   Boundary conditions
   -------------------
   Core leg and both yokes are treated as infinitely permeable, so tangential
   B vanishes on them and flux enters normally. That gives:

     r = Rc   (core leg)  : B_z = 0  ->  du/dr = 0   (natural, omit face)
     z = 0, Hw (yokes)    : B_r = 0  ->  du/dz = 0   (natural, omit face)
     r = Rmax (far field) : u = 0                     (Dirichlet)

   This is the standard window model for transformer leakage. It is a LINEAR
   problem — the core is a boundary, not a nonlinear region — so no BH
   iteration is needed and the solve is fast and deterministic.

   Limitations (stated, not hidden)
   --------------------------------
   · 2D axisymmetric: captures concentric windings well, cannot represent
     3-limb asymmetry, leads, or anything genuinely 3D.
   · Core is an ideal flux boundary: no core saturation, no core loss.
   · Windings are smeared current sheets of uniform density unless sections
     are supplied; it does not resolve individual conductors or eddy effects.
   ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TPFEM = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MU0 = 4e-7 * Math.PI;

  /* ── Conjugate gradient on the 5-point stencil ─────────────────────────
     The operator is symmetric positive definite once the Neumann rows are
     folded in symmetrically, so CG is the right solver and needs no
     preconditioner beyond Jacobi at this size. */
  function cg(applyA, b, n, tol, maxIter, diag) {
    var x = new Float64Array(n),
        r = new Float64Array(n),
        z = new Float64Array(n),
        p = new Float64Array(n),
        Ap = new Float64Array(n);
    var i, rz, rzOld, alpha, beta, pAp, bnorm = 0;

    for (i = 0; i < n; i++) { r[i] = b[i]; bnorm += b[i] * b[i]; }
    bnorm = Math.sqrt(bnorm);
    if (bnorm === 0) return { x: x, iters: 0, resid: 0 };

    for (i = 0; i < n; i++) z[i] = r[i] / diag[i];
    p.set(z);
    rz = 0; for (i = 0; i < n; i++) rz += r[i] * z[i];

    var it = 0, resid = 1;
    for (it = 0; it < maxIter; it++) {
      applyA(p, Ap);
      pAp = 0; for (i = 0; i < n; i++) pAp += p[i] * Ap[i];
      if (pAp === 0) break;
      alpha = rz / pAp;

      var rn = 0;
      for (i = 0; i < n; i++) {
        x[i] += alpha * p[i];
        r[i] -= alpha * Ap[i];
        rn += r[i] * r[i];
      }
      resid = Math.sqrt(rn) / bnorm;
      if (resid < tol) { it++; break; }

      for (i = 0; i < n; i++) z[i] = r[i] / diag[i];
      rzOld = rz;
      rz = 0; for (i = 0; i < n; i++) rz += r[i] * z[i];
      beta = rz / rzOld;
      for (i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
    }
    return { x: x, iters: it, resid: resid };
  }

  /* ── Main solve ────────────────────────────────────────────────────────
     geom (all SI: metres, amperes):
       Rc          core surface radius
       R1,R2       inner winding inner/outer radius
       R3,R4       outer winding inner/outer radius
       zb,zt       winding bottom/top (inner winding)
       zb2,zt2     outer winding bottom/top (defaults to zb,zt)
       Hw          window height
       NI_in       inner winding ampere-turns (signed)
       NI_out      outer winding ampere-turns (signed, normally opposite)
       f           frequency (Hz)
       nr,nz       grid resolution
       Rmax        far-field radius (default: Rc + 3*(R4-Rc))
  */
  /* Build a node list that puts a grid line exactly on every breakpoint, with
     `dens` nodes per metre inside each segment (minimum 4). A uniform grid
     leaves the winding edges falling wherever they happen to land, so the
     discrete geometry shifts by up to one cell whenever the mesh changes and
     the solution refuses to converge under refinement. Fitting the grid to
     the geometry removes that entirely. */
  function buildAxis(breaks, dens, minPer) {
    minPer = minPer || 4;
    var pts = breaks.slice().sort(function (a, b) { return a - b; });
    var uniq = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      if (pts[i] - uniq[uniq.length - 1] > 1e-12) uniq.push(pts[i]);
    }
    var nodes = [uniq[0]];
    for (i = 0; i < uniq.length - 1; i++) {
      var a = uniq[i], b = uniq[i + 1];
      var n = Math.max(minPer, Math.round((b - a) * dens));
      for (var m = 1; m <= n; m++) nodes.push(a + (b - a) * m / n);
    }
    return nodes;
  }

  function solve(geom) {
    var Rc = geom.Rc, R1 = geom.R1, R2 = geom.R2, R3 = geom.R3, R4 = geom.R4;
    var zb = geom.zb, zt = geom.zt;
    var zb2 = (geom.zb2 != null) ? geom.zb2 : zb;
    var zt2 = (geom.zt2 != null) ? geom.zt2 : zt;
    var Hw = geom.Hw, f = geom.f || 50;
    var Rmax = geom.Rmax || (Rc + 3.0 * (R4 - Rc));

    /* `density` is nodes per metre; nr/nz are honoured as a rough overall
       target for callers that prefer to think in grid counts. */
    var dens = geom.density;
    if (!dens) {
      var wantR = geom.nr || 140;
      dens = wantR / (Rmax - Rc);
    }

    var rN = buildAxis([Rc, R1, R2, R3, R4, Rmax], dens);
    var zN = buildAxis([0, zb, zt, zb2, zt2, Hw], dens);
    var nr = rN.length, nz = zN.length, N = nr * nz;

    var idx = function (i, j) { return j * nr + i; };
    var rAt = function (i) { return rN[i]; };
    var zAt = function (j) { return zN[j]; };

    /* Control-volume extents (half a cell either side of each node). */
    var dR = new Float64Array(nr), dZ = new Float64Array(nz);
    for (var i = 0; i < nr; i++) {
      var lo = (i === 0) ? rN[0] : 0.5 * (rN[i - 1] + rN[i]);
      var hi = (i === nr - 1) ? rN[nr - 1] : 0.5 * (rN[i] + rN[i + 1]);
      dR[i] = hi - lo;
    }
    for (var j = 0; j < nz; j++) {
      var zlo = (j === 0) ? zN[0] : 0.5 * (zN[j - 1] + zN[j]);
      var zhi = (j === nz - 1) ? zN[nz - 1] : 0.5 * (zN[j] + zN[j + 1]);
      dZ[j] = zhi - zlo;
    }

    /* ── Winding regions and exact ampere-turns ──────────────────────────
       Each node owns a control volume, and at a winding edge only PART of
       that volume lies inside the winding. Marking whole nodes in or out
       therefore smears the conductor outward by half a cell on every face —
       on a 40 mm winding at a practical mesh density that is a ~17 % error in
       the current-carrying width, which showed up as a stable few-per-cent
       deficit in inductance that shrank only slowly under refinement.

       So weight each node by how much of its control volume actually overlaps
       the winding. The occupied area then equals the true cross-section at any
       mesh density, and the result converges properly. */
    var J = new Float64Array(N), mark = new Int8Array(N);
    var wIn = new Float64Array(N), wOut = new Float64Array(N);
    var k, r, z;

    var rLo = new Float64Array(nr), rHi = new Float64Array(nr);
    var zLo = new Float64Array(nz), zHi = new Float64Array(nz);
    for (i = 0; i < nr; i++) {
      rLo[i] = (i === 0) ? rN[0] : 0.5 * (rN[i - 1] + rN[i]);
      rHi[i] = (i === nr - 1) ? rN[nr - 1] : 0.5 * (rN[i] + rN[i + 1]);
    }
    for (j = 0; j < nz; j++) {
      zLo[j] = (j === 0) ? zN[0] : 0.5 * (zN[j - 1] + zN[j]);
      zHi[j] = (j === nz - 1) ? zN[nz - 1] : 0.5 * (zN[j] + zN[j + 1]);
    }
    function ov(a, b, c, d) { return Math.max(0, Math.min(b, d) - Math.max(a, c)); }

    var areaIn = 0, areaOut = 0;
    for (j = 0; j < nz; j++) {
      for (i = 0; i < nr; i++) {
        k = idx(i, j);
        var aIn  = ov(rLo[i], rHi[i], R1, R2) * ov(zLo[j], zHi[j], zb,  zt);
        var aOut = ov(rLo[i], rHi[i], R3, R4) * ov(zLo[j], zHi[j], zb2, zt2);
        if (aIn > 0)  { wIn[k]  = aIn;  areaIn  += aIn;  mark[k] = 1; }
        if (aOut > 0) { wOut[k] = aOut; areaOut += aOut; mark[k] = 2; }
      }
    }
    if (areaIn === 0 || areaOut === 0) {
      throw new Error('fem-leakage: a winding region captured no grid nodes — raise density');
    }
    /* Current density per unit area, applied over the overlapping fraction so
       that the integral of J over the cross-section is exactly the ampere-turns. */
    var Jin = geom.NI_in / areaIn, Jout = geom.NI_out / areaOut;
    for (j = 0; j < nz; j++) for (i = 0; i < nr; i++) {
      k = idx(i, j);
      var cell = dR[i] * dZ[j];
      J[k] = (Jin * wIn[k] + Jout * wOut[k]) / cell;
    }

    /* ── Symmetric conservative assembly in u = rA ─────────────────────────
       Each face carries one conductance shared by the two nodes it joins, so
       the matrix is symmetric by construction. */
    var isDir = new Uint8Array(N);
    for (j = 0; j < nz; j++) isDir[idx(nr - 1, j)] = 1;      // far field u = 0

    var cR = new Float64Array(nr * nz);   // face between (i,j) and (i+1,j)
    var cZ = new Float64Array(nr * nz);   // face between (i,j) and (i,j+1)
    for (j = 0; j < nz; j++) {
      for (i = 0; i < nr - 1; i++) {
        var rf = 0.5 * (rN[i] + rN[i + 1]);
        cR[idx(i, j)] = (1 / rf) * dZ[j] / (rN[i + 1] - rN[i]);
      }
    }
    for (j = 0; j < nz - 1; j++) {
      for (i = 0; i < nr; i++) {
        cZ[idx(i, j)] = (1 / rN[i]) * dR[i] / (zN[j + 1] - zN[j]);
      }
    }

    var diag = new Float64Array(N);
    for (j = 0; j < nz; j++) for (i = 0; i < nr; i++) {
      k = idx(i, j);
      if (isDir[k]) { diag[k] = 1; continue; }
      var d = 0;
      if (i < nr - 1) d += cR[k];
      if (i > 0)      d += cR[idx(i - 1, j)];
      if (j < nz - 1) d += cZ[k];
      if (j > 0)      d += cZ[idx(i, j - 1)];
      diag[k] = d;
    }

    function applyA(x, out) {
      var i, j, k, v;
      for (j = 0; j < nz; j++) {
        for (i = 0; i < nr; i++) {
          k = idx(i, j);
          if (isDir[k]) { out[k] = x[k]; continue; }
          v = diag[k] * x[k];
          /* Links into a Dirichlet node are omitted: the value there is zero
             so the term is nil, and dropping it preserves symmetry. The face
             conductance stays in the diagonal — standard Dirichlet elimination. */
          if (i < nr - 1 && !isDir[idx(i + 1, j)]) v -= cR[k] * x[idx(i + 1, j)];
          if (i > 0      && !isDir[idx(i - 1, j)]) v -= cR[idx(i - 1, j)] * x[idx(i - 1, j)];
          if (j < nz - 1 && !isDir[idx(i, j + 1)]) v -= cZ[k] * x[idx(i, j + 1)];
          if (j > 0      && !isDir[idx(i, j - 1)]) v -= cZ[idx(i, j - 1)] * x[idx(i, j - 1)];
          out[k] = v;
        }
      }
    }

    var b = new Float64Array(N);
    for (j = 0; j < nz; j++) for (i = 0; i < nr; i++) {
      k = idx(i, j);
      b[k] = isDir[k] ? 0 : MU0 * J[k] * dR[i] * dZ[j];
    }

    var sol = cg(applyA, b, N, geom.tol || 1e-12, geom.maxIter || 40000, diag);
    var u = sol.x;

    /* ── Fields:  B_r = -(1/r) du/dz ,  B_z = (1/r) du/dr ───────────────── */
    var A = new Float64Array(N), Br = new Float64Array(N), Bz = new Float64Array(N);
    for (j = 0; j < nz; j++) {
      for (i = 0; i < nr; i++) {
        k = idx(i, j);
        var ri = rN[i];
        A[k] = u[k] / ri;
        var jm = (j === 0) ? 0 : j - 1, jp = (j === nz - 1) ? nz - 1 : j + 1;
        var dzz = zN[jp] - zN[jm];
        Br[k] = dzz > 0 ? -(u[idx(i, jp)] - u[idx(i, jm)]) / (ri * dzz) : 0;
        var im = (i === 0) ? 0 : i - 1, ip = (i === nr - 1) ? nr - 1 : i + 1;
        var drr = rN[ip] - rN[im];
        Bz[k] = drr > 0 ? (u[idx(ip, j)] - u[idx(im, j)]) / (ri * drr) : 0;
      }
    }

    /* ── Stored energy ────────────────────────────────────────────────────
       Two ways to get it, and the choice matters:

         W = (1/2) ∫ J·A dV      uses the solved potential directly
         W = ∫ B²/(2 mu0) dV     needs B, which comes from differencing u

       B is only recovered by central differences, which smear the kink in the
       field at each winding edge and lose a few per cent of the energy — that
       showed up as the leakage inductance sitting ~5 % under the analytical
       value no matter how fine the mesh got. The J·A form needs no
       differentiation and is exact for the discrete solution, so it is the
       primary result; the B² integral is kept as an independent cross-check
       and the two are reported together. */
    var W = 0, Wb = 0;
    for (j = 0; j < nz; j++) for (i = 0; i < nr; i++) {
      k = idx(i, j);
      /* J·A dV with A = u/r and dV = 2 pi r dR dZ  ->  2 pi J u dR dZ */
      W += 0.5 * J[k] * u[k] * 2 * Math.PI * dR[i] * dZ[j];
      var B2 = Br[k] * Br[k] + Bz[k] * Bz[k];
      Wb += (B2 / (2 * MU0)) * 2 * Math.PI * rN[i] * dR[i] * dZ[j];
    }

    /* ── Forces.  f = J x B  ->  radial density J*Bz, axial density -J*Br ── */
    function windingForces(tag, zlo, zhi, Jd, nSec) {
      nSec = nSec || 20;
      var secH = (zhi - zlo) / nSec;
      var sections = [], totR = 0, totZ = 0;
      for (var s2 = 0; s2 < nSec; s2++) {
        var z0 = zlo + s2 * secH, z1 = z0 + secH;
        var fr = 0, fz = 0;
        for (var jj = 0; jj < nz; jj++) {
          var zz = zN[jj];
          if (zz < z0 - 1e-12 || zz > z1 + 1e-12) continue;
          for (var ii = 0; ii < nr; ii++) {
            var kk = idx(ii, jj);
            var wgt = (tag === 1) ? wIn[kk] : wOut[kk];
            if (wgt <= 0) continue;
            /* wgt is the true (r,z) area of this node inside the winding, so
               the force integral uses the real conductor extent, not the
               node's whole control volume. */
            var dV = 2 * Math.PI * rN[ii] * wgt;
            fr += Jd * Bz[kk] * dV;
            fz += (-Jd * Br[kk]) * dV;
          }
        }
        sections.push({ zMid: (z0 + z1) / 2, Fr: fr, Fz: fz });
        totR += fr; totZ += fz;
      }
      return { sections: sections, Fr: totR, Fz: totZ };
    }

    var nSec = geom.nSections || 20;
    var fIn = windingForces(1, zb, zt, Jin, nSec);
    var fOut = windingForces(2, zb2, zt2, Jout, nSec);

    var omega = 2 * Math.PI * f;
    var X = null, L = null;
    if (geom.I_in) { L = 2 * W / (geom.I_in * geom.I_in); X = omega * L; }

    return {
      grid: { nr: nr, nz: nz, Rc: Rc, Rmax: Rmax, Hw: Hw, nodes: N },
      rN: rN, zN: zN,
      A: A, Br: Br, Bz: Bz, J: J,
      energy: W, energyB: Wb, energyCheck: (Wb - W) / W, L: L, X: X,
      inner: fIn, outer: fOut,
      solver: { iters: sol.iters, resid: sol.resid },
      idx: idx, rAt: rAt, zAt: zAt
    };
  }

  return { solve: solve, MU0: MU0 };
});
