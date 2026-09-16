const TPFEM=require('../fem-leakage.js');
const Rc=0.0875,R1=0.0975,R2=0.1155,R3=0.1355,R4=0.1655;
const h=0.42,gend=0.055,Hw=h+2*gend,N=1200,I=52.5;
const res=TPFEM.solve({Rc,R1,R2,R3,R4,zb:gend,zt:gend+h,Hw,
  NI_in:N*I,NI_out:-N*I,I_in:I,f:50,density:600,tol:1e-12,maxIter:40000});
const {rN,zN,idx,Br,Bz}=res;
const near=(arr,v)=>{let b=0,d=1e9;arr.forEach((x,i)=>{const t=Math.abs(x-v);if(t<d){d=t;b=i}});return b;};
const rGap=near(rN,(R2+R3)/2);

console.log('Field direction down the GAP centreline (r = '+rN[rGap].toFixed(4)+' m)');
console.log('  If flux is axial in the gap, |Bz| >> |Br| at mid-height,');
console.log('  and Br grows toward the winding ends where flux fringes outward.');
console.log('');
console.log('   z (mm from foot)   position        Bz (T)      Br (T)    |Br/Bz|');
for(const frac of [0.02,0.1,0.25,0.5,0.75,0.9,0.98]){
  const z=gend+h*frac, j=near(zN,z), k=idx(rGap,j);
  const ratio=Math.abs(Br[k]/Bz[k]);
  let tag = frac<0.15||frac>0.85 ? 'near end' : (frac>0.4&&frac<0.6?'MID-HEIGHT':'');
  console.log('  '+((z-gend)*1000).toFixed(0).padStart(14)+'   '+tag.padEnd(12)+
    ' '+Bz[k].toFixed(5).padStart(10)+'  '+Br[k].toFixed(5).padStart(9)+'  '+ratio.toFixed(4).padStart(8));
}

// Peak |B| should sit in the gap, not in the windings or the outer air
console.log('');
console.log('Peak |B| across radius at mid-height:');
const jm=near(zN,gend+h/2);
let best=0,bi=0;
for(let i=0;i<rN.length;i++){const k=idx(i,jm);const m=Math.hypot(Br[k],Bz[k]);if(m>best){best=m;bi=i;}}
let where = rN[bi]<R1?'core-LV gap':rN[bi]<=R2?'inside LV':rN[bi]<R3?'GAP (expected)':rN[bi]<=R4?'inside HV':'outer air';
console.log('  max |B| = '+best.toFixed(5)+' T at r = '+rN[bi].toFixed(4)+' m  ->  '+where);

// Flux should be ~parallel to the yoke boundary (Br -> 0 there)
const jTop=zN.length-1, jBot=0;
let mTop=0,mBot=0;
for(let i=0;i<rN.length;i++){mTop=Math.max(mTop,Math.abs(Br[idx(i,jTop)]));mBot=Math.max(mBot,Math.abs(Br[idx(i,jBot)]));}
console.log('');
console.log('Boundary conditions actually satisfied by the solution:');
console.log('  max |Br| on top yoke    = '+mTop.toExponential(2)+' T  (imposed zero)');
console.log('  max |Br| on bottom yoke = '+mBot.toExponential(2)+' T  (imposed zero)');
let mCore=0;
for(let j=0;j<zN.length;j++) mCore=Math.max(mCore,Math.abs(Bz[idx(0,j)]));
console.log('  max |Bz| on core leg    = '+mCore.toExponential(2)+' T  (imposed zero)');
