const TPFEM = require('../fem-leakage.js');
const MU0 = 4e-7 * Math.PI;

// Tall windings -> field in the gap should be almost purely axial, uniform,
// and equal to NI/h. That is a hand-checkable number.
const Rc=0.150, gclv=0.010, b1=0.040, g=0.030, b2=0.045, gend=0.100;
const R1=Rc+gclv, R2=R1+b1, R3=R2+g, R4=R3+b2;
const h=8.0, Hw=h+2*gend, zb=gend, zt=gend+h;
const N=200, I=500, NI=N*I;

const G={Rc,R1,R2,R3,R4,zb,zt,Hw,NI_in:NI,NI_out:-NI,I_in:I,f:50,
         density:200, Rmax:Rc+6*(R4-Rc), tol:1e-13, maxIter:60000};
const res=TPFEM.solve(G);

const {rN,zN,idx,Bz,Br}=res;
// mid-height row
let jm=0, best=1e9;
for(let j=0;j<zN.length;j++){const d=Math.abs(zN[j]-(zb+zt)/2); if(d<best){best=d;jm=j;}}

const Hexp = NI/h;                       // A/m
const Bexp = MU0*Hexp;
console.log('Expected axial B in the gap (tall limit) = mu0*NI/h = '+Bexp.toExponential(4)+' T');
console.log('');
console.log('  r (m)     region        Bz (T)        Bz/Bexp     Br (T)');
for(const rq of [R1+1e-6,(R1+R2)/2,R2,(R2+R3)/2,R3,(R3+R4)/2,R4-1e-6,R4+0.05,R4+0.2]){
  let ii=0,bd=1e9;
  for(let i2=0;i2<rN.length;i2++){const d=Math.abs(rN[i2]-rq); if(d<bd){bd=d;ii=i2;}}
  const k=idx(ii,jm);
  let reg='air';
  if(rN[ii]>=R1&&rN[ii]<=R2) reg='LV winding';
  else if(rN[ii]>=R2&&rN[ii]<=R3) reg='GAP';
  else if(rN[ii]>=R3&&rN[ii]<=R4) reg='HV winding';
  console.log('  '+rN[ii].toFixed(4).padStart(7)+'  '+reg.padEnd(12)+
    ' '+Bz[k].toExponential(4).padStart(13)+' '+(Bz[k]/Bexp).toFixed(4).padStart(11)+
    ' '+Br[k].toExponential(3).padStart(12));
}

// Ampere's law check: circulation of H around a loop should equal enclosed NI.
// Integrate Hz along r at mid-height from Rc to Rmax -> should give ~0 (balanced AT)
// Integrate from Rc to just inside the gap -> should give NI_enclosed.
let sum=0;
for(let i2=0;i2<rN.length-1;i2++){
  const dr=rN[i2+1]-rN[i2];
  const k1=idx(i2,jm),k2=idx(i2+1,jm);
  sum += 0.5*(Bz[k1]+Bz[k2])/MU0*dr;
  if(Math.abs(rN[i2+1]-R2)<1e-9){
    console.log('\n  Integral of Hz dr from core to gap start = '+sum.toFixed(1)+' A');
    console.log('  Expected (full inner winding AT)         = '+NI+' A');
    console.log('  ratio = '+(sum/NI).toFixed(4));
  }
}
console.log('\n  Integral of Hz dr across full radius = '+sum.toFixed(2)+' A (expect ~0, balanced)');
console.log('\n  solver: '+res.solver.iters+' iters, resid '+res.solver.resid.toExponential(2));
console.log('  grid: '+res.grid.nr+' x '+res.grid.nz+' = '+res.grid.nodes+' nodes');
