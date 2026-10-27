const lum = hex => { const h=hex.replace('#','');
  const [r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));
  return 0.2126*r+0.7152*g+0.0722*b; };
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
// ACTUAL resolved values after design-system.css remaps
const R = [
  ['btn-orange fill: #fff on --cta #F58220',        '#FFFFFF','#F58220'],
  ['btn-orange hover: #fff on #D9680D',             '#FFFFFF','#D9680D'],
  ['--text-muted -> --ink-2 #57505C on #FFF',       '#57505C','#FFFFFF'],
  ['--text-muted -> --ink-2 on --bg-alt #FAF8FA',   '#57505C','#FAF8FA'],
  ['--text-subtle -> --ink-3 #857E8A on #FFF',      '#857E8A','#FFFFFF'],
  ['--text-subtle -> --ink-3 on --bg-alt',          '#857E8A','#FAF8FA'],
  ['hardcoded #888 inline on #FFF',                 '#888888','#FFFFFF'],
  ['hardcoded #68616B inline on #FFF',              '#68616B','#FFFFFF'],
  ['vcard .sub --ink-2 on #FFF',                    '#57505C','#FFFFFF'],
  ['vcard-tag --ok #16804A on #FFF',                '#16804A','#FFFFFF'],
  ['--text-muted --ink-2 on --cta-soft #FFF4EA',    '#57505C','#FFF4EA'],
];
for(const[n,f,b]of R){const r=ratio(f,b);console.log(`${r.toFixed(2).padStart(6)}  ${r>=4.5?'PASS':(r>=3?'LARGE':'FAIL ')}  ${n}`);}
console.log('\ncandidate dark-btn fills, white text:');
for(const bg of ['#A85410','#9C4A06','#B45309','#C25E0C']) console.log(`  ${bg}  ${ratio('#FFFFFF',bg).toFixed(2)}`);
