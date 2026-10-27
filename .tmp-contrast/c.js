const lum = hex => {
  const h = hex.replace('#','');
  const [r,g,b] = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255)
    .map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)); };
const pairs = [
  ['white on current orange',        '#FFFFFF', '#E87722'],
  ['white on orange-hover',          '#FFFFFF', '#D06A18'],
  ['white on orange-dark #B85E14',   '#FFFFFF', '#B85E14'],
  ['white on #B45309',               '#FFFFFF', '#B45309'],
  ['white on #A85410',               '#FFFFFF', '#A85410'],
  ['text-muted #888 on white',       '#888888', '#FFFFFF'],
  ['text-muted #6B6B6B on white',    '#6B6B6B', '#FFFFFF'],
  ['text-muted #6B6B6B on #F8F8F8',  '#6B6B6B', '#F8F8F8'],
  ['text-muted #666666 on white',    '#666666', '#FFFFFF'],
  ['text-subtle #767676 on white',   '#767676', '#FFFFFF'],
  ['text-subtle #BBBBBB on white',   '#BBBBBB', '#FFFFFF'],
  ['ink-2 #57505C on #FAF8FA',       '#57505C', '#FAF8FA'],
  ['cta #F58220 white text',         '#FFFFFF', '#F58220'],
];
for (const [name,fg,bg] of pairs) {
  const r = ratio(fg,bg);
  console.log(`${r.toFixed(2).padStart(6)}  ${r>=4.5?'PASS AA':(r>=3?'large-only':'FAIL   ')}  ${name}`);
}
