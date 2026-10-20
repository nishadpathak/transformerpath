# Daily Intel refresh

Each new item carries two separate attributes. Do not fold one into the other.

## Event evidence grade

`cls` and `evidence_grade` grade the event: `CONFIRMED`, `SUPPORTED`, `INFERRED`, `PIPELINE`, or `WATCH`. `CONFIRMED` means the event is confirmed. It does not mean the item is about a transformer.

## Equipment scope

Set `equipment_scope` from the source text only (the notice, release, or filing). Use `unclear` when the source does not say.

| `equipment_scope` | When the source says this |
| --- | --- |
| `transformer` | The source names a transformer, an ICT, a GSU, or an OLTC, or it states an MVA or kVA rating that is not a reactor. |
| `switchgear-only` | The source names switchgear, a switchboard, GIS, or a circuit breaker, and does not name a transformer. |
| `general-substation` | The source is a substation, interconnection, or grid project, and does not name a transformer or switchgear. |
| `unclear` | The source does not establish one of the three, or it mixes switchgear with reactors or other power equipment and never names a transformer. Do not guess from the company name. A reactor MVA rating is not a transformer. |

Set `transformer_scope_confirmed` to `true` only when `equipment_scope` is `transformer`. Otherwise `false`. A confirmed switchgear event stays `evidence_grade: CONFIRMED` (or `cls: CONFIRMED`) with `transformer_scope_confirmed: false`.

Headlines for `switchgear-only`, `general-substation`, and `unclear` must say that the item is not transformer-specific. The build prefixes those headlines when the stored title does not already say it.

If `equipment_scope` is missing, `lib/intel-equipment-scope.js` tags the item from its stored title and snippet at build time and uses `unclear` when that text is ambiguous.
