const TPFEM=require('../fem-leakage.js');
const MU0=4e-7*Math.PI;
const Rc=0.150,gclv=0.010,b1=0.040,g=0.030,b2=0.045,gend=0.100;
const R1=Rc+gclv,R2=R1+b1,R3=R2+g,R4=R3+b2;
const N=200,I=500,NI=N*I;

// Exact tall-limit inductance, integrated properly in cylindrical coords
// (not the thin-winding mean-diameter approximation).
function exactTall(h){
  const S = b1*b1/4 + R1*b1/3 + (R3*R3-R2*R2)/2 + R4*b2/3 - b2*b2/4;
  return MU0*N*N*(2*Math.PI/h)*S;
}

console.log('Far-field boundary sensitivity  (h = 8 m, tall limit)');
console.log('  exact tall-limit L = '+(exactTall(8)*1e3).toFixed(4)+' mH');
console.log('');
console.log('   Rmax factor   Rmax (m)    L (mH)     ratio    W_JA vs W_B2');
for(const fac of [2,4,6,10,16,24]){
  const h=8.0,Hw=h+2*gend;
  const G={Rc,R1,R2,R3,R4,zb:gend,zt:gend+h,Hw,NI_in:NI,NI_out:-NI,I_in:I,
           f:50,density:150,Rmax:Rc+fac*(R4-Rc),tol:1e-13,maxIter:80000};
  const r=TPFEM.solve(G);
  console.log('  '+String(fac).padStart(10)+'  '+G.Rmax.toFixed(3).padStart(9)+
    '  '+(r.L*1e3).toFixed(4).padStart(9)+'  '+(r.L/exactTall(8)).toFixed(4).padStart(8)+
    '  '+(r.energyCheck*100).toFixed(2).padStart(9)+' %');
}

console.log('');
console.log('Window height sensitivity (end clearance to yoke), h = 8 m');
console.log('   gend (m)     Hw (m)     L (mH)     ratio');
for(const ge of [0.02,0.05,0.10,0.30,0.80,2.0]){
  const h=8.0,Hw=h+2*ge;
  const G={Rc,R1,R2,R3,R4,zb:ge,zt:ge+h,Hw,NI_in:NI,NI_out:-NI,I_in:I,
           f:50,density:150,Rmax:Rc+6*(R4-Rc),tol:1e-13,maxIter:80000};
  const r=TPFEM.solve(G);
  console.log('  '+ge.toFixed(2).padStart(9)+'  '+Hw.toFixed(2).padStart(9)+
    '  '+(r.L*1e3).toFixed(4).padStart(9)+'  '+(r.L/exactTall(8)).toFixed(4).padStart(8));
}
