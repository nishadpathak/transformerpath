/* Editorial U.S. pad-mount pilot. No checkout, stock validation, contact or RFQ submission. */
(function(root) {
  'use strict';

  const LV = Object.freeze({
    '480y277':{line:480,label:'480Y/277 V'}, '208y120':{line:208,label:'208Y/120 V'},
    '600y347':{line:600,label:'600Y/347 V'}, '480d':{line:480,label:'480 V delta'}
  });
  const HV = Object.freeze({delta:'Delta', 'grounded-wye':'Grounded wye'});
  const BASIS = {
    catalogue:'Public product reference', datasheet:'Manufacturer datasheet', listed:'Public seller listing'
  };
  const MATCH = {
    browse:'Not compared', exact:'Exact nominal fields', tap:'Possible tap check', incomplete:'Incomplete source'
  };
  const ORDER = {exact:0,tap:1,incomplete:2,browse:3};
  const CHECKED = '2026-11-26';
  const DAELIM = 'https://www.daelimtransformer.com/3-phase-pad-mounted-transformer-inventory.html';
  const ROWS = [
    {
      id:'giga-500-delta', reference:'500 kVA / 12470 D / 480 Y/277 product reference', brand:'Giga Energy', supplier:'Giga Energy',
      kva:500,hv:12470,connection:'delta',lv:'480y277',lvLine:480,frequency:null,
      arrangement:'Not stated for this configuration', taps:[],tapNote:'Tap changer described; exact tap voltages not stated.',
      condition:'Not verified', basis:'catalogue', checked:CHECKED,
      source:'https://www.gigaenergy.com/shop/500-kva-3-phase-padmount-transformer-12470-d-to-480-y-277'
    },
    {
      id:'green-gv0011',reference:'GV0011',brand:'Sunbelt-Solomon Solutions',supplier:'Green Industrial',
      kva:500,hv:12470,connection:'delta',lv:'480y277',lvLine:480,frequency:60,
      arrangement:'Not stated',taps:[11850,12160,12785,13095],tapNote:'Alternate primary tap voltages transcribed from the seller’s specifications. Verify on the actual nameplate.',
      condition:'Confirm condition: public listings disagree.',basis:'listed',checked:CHECKED,
      source:'https://surplusrecord.com/listing/500-kva-12470-delta-primary-480y-277-secondary-sunbelt-solomon-solutions-3ph-padmount-transformer-1105518/',
      crosspost:'https://www.machinio.com/listings/117621349-500-kva-sunbelt-three-phase-12470v-delta-to-480y-277-in-belgium-wi'
    },
    {
      id:'larson-311050',reference:'311050',brand:'Larson Electronics',supplier:'Larson Electronics',
      kva:500,hv:12470,connection:'grounded-wye',lv:'480y277',lvLine:480,frequency:60,
      arrangement:'Dead front / loop feed',taps:[],tapNote:'Five positions with 2.5% steps; no exact alternate tap voltages used here.',
      condition:'Not verified',basis:'datasheet',checked:CHECKED,
      source:'https://www.larsonelectronics.com/images/product/Specsheet/311050.PDF'
    },
    {
      id:'daelim-10014',reference:'10014',brand:'Daelim Transformer',supplier:'Daelim Transformer',
      kva:500,hv:12470,connection:'grounded-wye',lv:null,lvLine:480,frequency:60,
      arrangement:'Dead front / loop feed',taps:[],tapNote:'Five positions listed; voltages not stated.',
      condition:'Listed as new; condition not independently verified.',basis:'listed',checked:CHECKED,
      source:DAELIM
    },
    {
      id:'daelim-10016',reference:'10016',brand:'Daelim Transformer',supplier:'Daelim Transformer',
      kva:500,hv:13200,connection:'delta',lv:'480y277',lvLine:480,frequency:60,
      arrangement:'Live front; feed type not stated',taps:[],tapNote:'Exact alternate tap voltages not stated.',
      condition:'Listed as new; condition not independently verified.',basis:'listed',checked:CHECKED,
      source:DAELIM
    },
    {
      id:'daelim-10017',reference:'10017',brand:'Daelim Transformer',supplier:'Daelim Transformer',
      kva:500,hv:13200,connection:'delta',lv:'480y277',lvLine:480,frequency:60,
      arrangement:'Dead front / loop feed',taps:[],tapNote:'±2 × 2.5% printed; no exact alternate tap voltages used here.',
      condition:'Listed as new; condition not independently verified.',basis:'listed',checked:CHECKED,
      source:DAELIM
    }
  ];
  const LOOKUP = Object.create(null);
  ROWS.forEach(row => {
    const previous = LOOKUP[row.id];
    if (previous) throw new Error('Duplicate equipment source identity');
    Object.freeze(row.taps);
    LOOKUP[row.id] = Object.freeze(row);
  });
  Object.freeze(ROWS);
  const MAX = 3;

  function requirement(raw) {
    if (!raw || !/^\d{2,5}(?:\.\d)?$/.test(String(raw.kva)) || !/^\d{4,5}$/.test(String(raw.hv)) ||
        !Object.hasOwn(HV,raw.connection) || !Object.hasOwn(LV,raw.lv)) return null;
    const kva=Number(raw.kva), hv=Number(raw.hv);
    if (kva < 25 || kva > 10000 || hv < 1000 || hv > 46000) return null;
    return {kva,hv,connection:raw.connection,lv:raw.lv};
  }

  /* Exact fields are a technical screen, not endorsement or a fit statement.
     Tap checks require an explicitly published alternate voltage, not arithmetic. */
  function classify(row, req) {
    if (!req) return 'browse';
    if (row.kva !== req.kva || (row.connection && row.connection !== req.connection) ||
        (row.lv && row.lv !== req.lv) || (row.lvLine && row.lvLine !== LV[req.lv].line)) return null;
    if (row.hv === req.hv) return row.connection && row.lv ? 'exact' : 'incomplete';
    return row.connection && row.lv && row.taps.includes(req.hv) ? 'tap' : null;
  }

  function results(req) {
    return ROWS.map(row=>({row,state:classify(row,req)})).filter(result=>result.state)
      .sort((a,b)=>ORDER[a.state]-ORDER[b.state] || a.row.supplier.localeCompare(b.row.supplier) || a.row.reference.localeCompare(b.row.reference));
  }

  function selection(raw, req) {
    if (typeof raw !== 'string' || raw.length > 100 || (raw && !/^[a-z0-9-]+(?:,[a-z0-9-]+){0,2}$/.test(raw))) return null;
    const ids = raw ? raw.split(',') : [];
    if (new Set(ids).size !== ids.length || ids.some(id=>!LOOKUP[id] || !classify(LOOKUP[id],req))) return null;
    return ids;
  }

  function draftHref(req, ids) {
    const validated = requirement(req);
    if (!validated || !selection(ids.join(','),validated)) return null;
    const p=new URLSearchParams({equipment:'1',kva:validated.kva,hv:validated.hv,connection:validated.connection,lv:validated.lv});
    if (ids.length) p.set('refs',ids.join(','));
    return '/rfq.html?' + p.toString() + '#part-rfq-form';
  }

  function decodeDraft(p) {
    const allowed = new Set(['equipment','kva','hv','connection','lv','refs']), keys = Array.from(p.keys());
    if (keys.some(key=>!allowed.has(key)) || new Set(keys).size !== keys.length || p.get('equipment') !== '1') return null;
    const req = requirement({kva:p.get('kva'),hv:p.get('hv'),connection:p.get('connection'),lv:p.get('lv')});
    if (!req) return null;
    const ids=selection(p.has('refs') ? p.get('refs') : '',req);
    return ids ? {req,ids} : null;
  }

  function rfqPrefill(doc, params) {
    const decoded = decodeDraft(params);
    if (!decoded) return false;
    const category=doc.getElementById('fld_category'), rating=doc.getElementById('fld_rating');
    const voltage=doc.getElementById('fld_voltage'), details=doc.getElementById('fld_details');
    const shortlist=doc.getElementById('fld_supplier_shortlist'), note=doc.getElementById('shortlistContext');
    if (!category || !rating || !voltage || !details || category.value || rating.value || voltage.value || details.value || (shortlist && shortlist.value) ||
        !Array.from(category.options).some(o=>o.value === 'Distribution Transformer')) return false;
    const {req,ids}=decoded;
    const lines=[
      'U.S. pad-mount equipment requirement (three-phase)',
      req.kva + ' kVA; primary ' + req.hv + ' V ' + HV[req.connection] + '; secondary ' + LV[req.lv].label + '.',
      'Please confirm frequency, voltage and grounding, exact nameplate, BIL, impedance, front/feed arrangement, protection, tests, current availability and delivery. Add your quantity, delivery location and needed date.'
    ];
    if (ids.length) {
      lines.push('', 'Published references for review only (not nominated recipients, approved substitutes or stock):');
      ids.forEach(id=>{
        const row=LOOKUP[id];
        lines.push('• ' + row.supplier + ' · ' + row.reference + ' (' + MATCH[classify(row,req)] + ')');
      });
    }
    category.value='Distribution Transformer';
    rating.value=req.kva + ' kVA';
    voltage.value=(req.hv/1000) + ' / ' + (LV[req.lv].line/1000) + ' kV';
    details.value=lines.join('\n');
    if (note) {
      note.textContent='Equipment specification loaded as a draft. Check the details before submitting. No supplier is selected and nothing has been sent.';
      note.style.display='block';
    }
    return true;
  }

  function mount(doc, win) {
    const form=doc.getElementById('eq-form');
    if (!form) return;
    const find=id=>doc.getElementById(id);
    const cards=find('eq-results'), count=find('eq-count'), empty=find('eq-empty'), compare=find('eq-comparison');
    const compareStatus=find('eq-compare-status'), tableHelp=find('eq-table-help'), draft=find('eq-rfq');
    let active=null, picked=[], shown=[];
    const node=(tag,text,cls)=>{
      const el=doc.createElement(tag);
      if (text != null) el.textContent=text;
      if (cls) el.className=cls;
      return el;
    };
    const link=(href,text)=>{
      const el=node('a',text);
      el.href=href;
      return el;
    };
    const winding=row=>row.lv ? LV[row.lv].label : row.lvLine + ' V; connection not stated';
    const primary=row=>row.hv.toLocaleString('en-US') + ' V · ' + (HV[row.connection] || 'Connection not stated');
    const powers=row=>row.kva.toLocaleString('en-US') + ' kVA';
    const stocks='Stock and dispatch not confirmed.';
    function date(row) {
      const time=node('time',row.checked);
      time.dateTime=row.checked;
      return time;
    }
    function field(list,key,value) {
      const line=node('div'), body=node('dd');
      body.append(value);
      line.append(node('dt',key),body);
      list.append(line);
    }
    function card(item) {
      const {row,state}=item, el=node('article',null,'part-card eq-card');
      el.append(node('p',MATCH[state],'eq-state'),node('h3',row.supplier),node('p',row.brand + ' · ' + row.reference,'part-supplier'));
      const specs=node('dl',null,'part-specs');
      [['Power',powers(row)],['Primary',primary(row)],['Secondary',winding(row)],['Front / feed',row.arrangement],['Condition',row.condition]].forEach(pair=>field(specs,...pair));
      if (state === 'tap') field(specs,'Source tap value',active.hv + ' V (not nominal)');
      el.append(specs);
      const evidence=node('p',null,'part-evidence');
      evidence.append(BASIS[row.basis] + ' · checked ',date(row),' · ',link(row.source,'Open original source'));
      if (row.crosspost) evidence.append(' · ', link(row.crosspost,'Compare condition wording'));
      el.append(evidence,node('p',stocks,'eq-claim'));
      const choose=node('button','Compare','part-action');
      choose.type='button';
      choose.dataset.equipmentSelect=row.id;
      choose.setAttribute('aria-pressed','false');
      choose.setAttribute('aria-label','Compare ' + row.supplier + ' ' + row.reference);
      const jump=link('#eq-compare-title','View comparison');
      jump.className='part-action eq-card-jump';
      jump.dataset.equipmentJump='true';
      jump.hidden=true;
      el.append(choose, ' ', jump);
      return el;
    }
    function comparison() {
      compare.replaceChildren();
      compare.hidden=picked.length<2;
      tableHelp.hidden=compare.hidden;
      if (compare.hidden) return;
      const chosen=picked.map(id=>LOOKUP[id]);
      const table=node('table'), top=node('tr'), head=node('thead'), body=node('tbody');
      ['Published field'].concat(chosen.map(row=>row.supplier+' · '+row.reference)).forEach(name=>{
        const cell=node('th',name); cell.scope='col'; top.append(cell);
      });
      head.append(top);
      function tr(title,data) {
        const r=node('tr'), h=node('th',title); h.scope='row'; r.append(h);
        data.forEach(item=>{const cell=node('td');cell.append(item);r.append(cell);});
        body.append(r);
      }
      tr('Result',chosen.map(row=>MATCH[classify(row,active)]));
      tr('Rated power',chosen.map(powers));
      tr('Primary',chosen.map(primary));
      tr('Secondary',chosen.map(winding));
      tr('Frequency',chosen.map(row=>row.frequency ? row.frequency + ' Hz' : 'Not stated'));
      tr('Front / feed',chosen.map(row=>row.arrangement));
      tr('Tap evidence',chosen.map(row=>(row.taps.length ? row.taps.join(', ') + ' V. ' : '') + row.tapNote));
      tr('Condition',chosen.map(row=>row.condition));
      tr('Supply',chosen.map(()=>stocks));
      tr('Source',chosen.map(row=>{
        const evidence=node('span');
        evidence.append(link(row.source,BASIS[row.basis]),' · checked ',date(row));
        return evidence;
      }));
      table.append(node('caption','Published pad-mount references, not approved equivalents'),head,body);
      compare.append(table);
    }
    function refreshCompare() {
      cards.querySelectorAll('[data-equipment-select]').forEach(button=>{
        const on=picked.includes(button.dataset.equipmentSelect);
        button.setAttribute('aria-pressed',String(on));
        button.textContent=on ? 'Selected' : 'Compare';
      });
      cards.querySelectorAll('[data-equipment-jump]').forEach(jump=>{jump.hidden=picked.length<2;});
      compareStatus.textContent=picked.length ? picked.length + ' selected. Select up to ' + MAX + ' references.' : 'Select two or three records below.';
      comparison();
      draft.hidden=!active;
      if (active) draft.href=draftHref(active,picked);
      else draft.removeAttribute('href');
    }
    function render(req) {
      active=req;
      picked=[];
      shown=results(req);
      cards.replaceChildren(...shown.map(card));
      empty.hidden=shown.length>0;
      if (req) {
        const n=type=>shown.filter(item=>item.state===type).length;
        count.textContent=n('exact') + ' exact nominal · ' + n('tap') + ' possible tap · ' + n('incomplete') + ' incomplete';
      } else count.textContent=shown.length + ' documented references. Enter a requirement to see match states.';
      refreshCompare();
    }
    cards.addEventListener('click',event=>{
      const direct=event.target.closest('[data-equipment-jump]');
      if (direct) {find('eq-compare-title').focus();return;}
      const toggle=event.target.closest('[data-equipment-select]');
      if (!toggle) return;
      const id=toggle.dataset.equipmentSelect;
      if (!shown.some(item=>item.row.id===id)) return;
      if (picked.includes(id)) picked=picked.filter(existing=>existing!==id);
      else if (picked.length<MAX) picked.push(id);
      else {compareStatus.textContent='Three references selected. Deselect one before adding a fourth.';return;}
      refreshCompare();
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      const req=requirement({
        kva:find('eq-kva').value,hv:find('eq-hv').value,connection:find('eq-connection').value,lv:find('eq-lv').value
      });
      if (!req) {
        render(null);
        count.textContent='Enter a supported rated kVA, whole nominal volts, and both winding connections.';
        return;
      }
      render(req);
    });
    form.addEventListener('input',()=>{
      if (active) {
        render(null);
        count.textContent='Requirement changed. Find references again before opening an RFQ draft.';
      }
    });
    form.addEventListener('reset',()=>win.setTimeout(()=>render(null),0));
    find('eq-compare-title').tabIndex=-1;
    form.hidden=false;
    find('eq-results-section').hidden=false;
    render(null);
  }

  const api={requirement,classify,results,draftHref,decodeDraft,rfqPrefill};
  if(typeof module !== 'undefined' && module.exports)module.exports=api;
  if(root.document){
    root.TPPadMount=api;
    if(root.document.readyState === 'loading')root.document.addEventListener('DOMContentLoaded',()=>mount(root.document,root),{once:true});
    else mount(root.document,root);
  }
})(typeof globalThis === 'object' ? globalThis : this);
