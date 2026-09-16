const TPFEM=require('../fem-leakage.js');
// A realistic 1000 kVA distribution unit, roughly what calculator.html produces
const Rc=0.0875,R1=0.0975,R2=0.1155,R3=0.1355,R4=0.1655;
const h=0.42,gend=0.055,Hw=h+2*gend,N=1200,I=52.5;
console.log('  density   grid        nodes    iters      ms    L (mH)');
for(const d of [200,400,800,1400,2200]){
  const G={Rc,R1,R2,R3,R4,zb:gend,zt:gend+h,Hw,NI_in:N*I,NI_out:-N*I,I_in:I,
           f:50,density:d,tol:1e-11,maxIter:40000,nSections:24};
  const t0=Date.now(); const r=TPFEM.solve(G); const ms=Date.now()-t0;
  console.log('  '+String(d).padStart(7)+'   '+(r.grid.nr+'x'+r.grid.nz).padStart(9)+
    ' '+String(r.grid.nodes).padStart(8)+' '+String(r.solver.iters).padStart(8)+
    ' '+String(ms).padStart(7)+'  '+(r.L*1e3).toFixed(5));
}
