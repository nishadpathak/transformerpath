#!/usr/bin/env node
/* Equipment scope stays separate from the event evidence grade. */
'use strict';
const { classifyEquipmentScope, scopeHeadline, scopeBadgeText, SCOPES } = require('../lib/intel-equipment-scope');

let failed = 0;
function check(label, pass, detail) {
  if (pass) console.log('  ✓ ' + label);
  else { console.error('  ✗ ' + label + (detail ? ' :: ' + detail : '')); failed++; }
}

console.log('=== INTEL EQUIPMENT SCOPE ===');
check('four scopes', SCOPES.join(',') === 'transformer,switchgear-only,general-substation,unclear');

const tx = classifyEquipmentScope({
  title: 'DEER awards oil-immersed distribution transformers to Eximprod',
  snippet: 'The lots are 20/0.4 kV oil-immersed transformers.',
  evidence_grade: 'CONFIRMED',
  cls: 'CONFIRMED'
});
check('named transformer is transformer scope', tx.equipment_scope === 'transformer' && tx.transformer_scope_confirmed === true, tx.equipment_scope);
check('evidence grade is not copied onto the scope result', tx.evidence_grade == null && tx.cls == null);

const sw = classifyEquipmentScope({
  title: 'Hitachi Energy unveils SF6-free dead-tank breakers',
  snippet: 'EconiQ dead-tank circuit-breaker technology for 800 kV GIS.',
  cls: 'CONFIRMED',
  evidence_grade: 'CONFIRMED'
});
check('switchgear source is switchgear-only', sw.equipment_scope === 'switchgear-only', sw.equipment_scope);
check('confirmed switchgear is not transformer scope confirmed', sw.transformer_scope_confirmed === false);

const sub = classifyEquipmentScope({
  title: 'Two utilities sign an MoU on electricity interconnection',
  snippet: 'The report describes a 400 kV interconnection and a double-circuit line.'
});
check('interconnection without a transformer is general substation', sub.equipment_scope === 'general-substation' && sub.transformer_scope_confirmed === false, sub.equipment_scope);

const mixed = classifyEquipmentScope({
  title: 'HD Hyundai Electric transformers reported at Didcot, with Hitachi Energy switchgear',
  snippet: 'Transformers at the substation, and switchgear from Hitachi Energy.'
});
check('source that names a transformer stays transformer even beside switchgear', mixed.equipment_scope === 'transformer' && mixed.transformer_scope_confirmed === true);

const ict = classifyEquipmentScope({
  title: 'PGCIL commissions a 1,500 MVA 765/400 kV ICT at Padghe GIS',
  snippet: 'One new ICT energised at the GIS substation.'
});
check('an ICT rating is transformer scope even when GIS is named', ict.equipment_scope === 'transformer' && ict.transformer_scope_confirmed === true, ict.equipment_scope);

const kva = classifyEquipmentScope({
  title: '1,000 kVA mineral-oil-filled package substation',
  snippet: 'SUBSTATION KIOSK 11/0.415 kV, 1000 kVA, mineral oil filled.'
});
check('a stated kVA rating is transformer scope', kva.equipment_scope === 'transformer', kva.equipment_scope);

const denied = classifyEquipmentScope({
  title: 'LS Electric discloses a switchboard supply for a data-centre project',
  snippet: 'It does not name the data-centre customer or a transformer rating.'
});
check('a denial that the source names a transformer is not transformer scope', denied.equipment_scope === 'switchgear-only' && denied.transformer_scope_confirmed === false, denied.equipment_scope);

const unnamed = classifyEquipmentScope({
  title: 'Utility tenders renewal of a 110 kV substation',
  snippet: 'The notice does not name a transformer replacement.'
});
check('a substation notice that does not name a transformer is general substation', unnamed.equipment_scope === 'general-substation', unnamed.equipment_scope);

const reactor = classifyEquipmentScope({
  title: 'Utility orders a 500 MVA shunt reactor',
  snippet: 'The bank is a shunt reactor, not a transformer.'
});
check('a reactor MVA rating is not transformer scope', reactor.equipment_scope !== 'transformer' && reactor.transformer_scope_confirmed === false, reactor.equipment_scope);

const mixedGear = classifyEquipmentScope({
  title: 'Makers land hyperscaler orders',
  snippet: 'A switchgear win sits beside other power equipment and EHV slots.'
});
check('switchgear mentioned beside other equipment is unclear', mixedGear.equipment_scope === 'unclear' && mixedGear.transformer_scope_confirmed === false, mixedGear.equipment_scope);

const vague = classifyEquipmentScope({
  title: 'Copper cash settlement',
  snippet: 'LME official ring settlement. Not a plant announcement.'
});
check('source that names none of the three is unclear', vague.equipment_scope === 'unclear' && vague.transformer_scope_confirmed === false, vague.equipment_scope);

const explicit = classifyEquipmentScope({
  title: 'Grid package',
  snippet: 'Could be read either way.',
  equipment_scope: 'unclear'
});
check('explicit unclear on the item wins', explicit.equipment_scope === 'unclear' && explicit.scope_basis === 'explicit_on_item');

const headline = scopeHeadline('LS Electric discloses a switchboard supply', 'switchgear-only');
check('switchgear headline says it is not transformer work', headline.indexOf('Switchgear only: ') === 0, headline);
check('transformer headline is unchanged', scopeHeadline('PSE tenders transformer renewal', 'transformer') === 'PSE tenders transformer renewal');
check('unclear headline says scope is not established', scopeHeadline('Copper settlement', 'unclear').indexOf('Transformer scope not established: ') === 0);
check('badge for transformer is not the event grade', scopeBadgeText(tx) === 'transformer scope confirmed');
check('badge for switchgear is not CONFIRMED', scopeBadgeText(sw) === 'switchgear only');

if (failed) {
  console.error('INTEL EQUIPMENT SCOPE FAILED (' + failed + ')');
  process.exit(1);
}
console.log('INTEL EQUIPMENT SCOPE OK');
