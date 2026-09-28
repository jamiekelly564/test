/* Whole-building display metadata. Source plan coverage stays explicit; unobserved floors are display estimates. */
(function(){
'use strict';
const assumptions={
  farnsworth:{storeys:1,note:'Single principal source level in this collection; terraces are included.'},
  radlett:{storeys:2,note:'Ground floor is source-backed; upper storey is an illustrative repeated envelope, not traced from a drawing.'},
  beverley:{storeys:4,note:'Only apartment 8/61 is source-backed. The surrounding multi-storey block is an illustrative stack for portfolio demonstration.'},
  simon:{storeys:1,note:'Principal floor is source-backed; no additional floor has been invented.'},
  walsh:{storeys:2,note:'First-floor source is used as the reference layout; the second level is an illustrative whole-building continuation.'},
  mccraith:{storeys:2,note:'The source sheet shows multiple levels; this demo stacks two levels but only the prepared reference-floor trace is source-backed.'},
  schmidt:{storeys:2,note:'Ground-floor trace is source-backed; the upper level is an illustrative continuation.'},
  cambridge:{storeys:2,note:'Historical ground floor is source-backed; the upper storey is an illustrative repeated envelope.'},
  belton:{storeys:2,note:'The source is an unscaled principal-layout sketch. The additional storey is illustrative only.'},
  lancaster:{storeys:3,note:'Principal-floor early scheme is source-backed; upper storeys are illustrative massing and not current/as-built plans.'}
};
for(const p of globalThis.PC_PROPERTIES||[]){
  const a=assumptions[p.id]||{storeys:1,note:'Only the prepared source level is shown.'};
  p.wholeBuilding={storeys:a.storeys,sourceBackedStoreys:1,estimatedStoreys:Math.max(0,a.storeys-1),note:a.note,sourceLevel:p.level};
}
})();