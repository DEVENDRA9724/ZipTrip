const lum = hex => {
  const h = hex.replace('#','');
  const [r,g,b] = [0,2,4].map(i => parseInt(h.slice(i,i+2),16)/255)
    .map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
  return 0.2126*r + 0.7152*g + 0.0722*b;
};
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)); };
console.log('--- dark text ON the existing bright orange #E87722 ---');
for (const fg of ['#FFFFFF','#1A1A1A','#18121B','#240733','#3D2000','#2B1500','#000000'])
  console.log(`  ${fg}  ${ratio(fg,'#E87722').toFixed(2)}`);
console.log('--- white on darker orange candidates ---');
for (const bg of ['#C25E0C','#BB5C0D','#B45309','#A85410','#A34E08','#9C4A06'])
  console.log(`  ${bg}  ${ratio('#FFFFFF',bg).toFixed(2)}`);
console.log('--- hover shades (white text) ---');
for (const bg of ['#9C4A06','#8F4305','#A85410','#B45309'])
  console.log(`  ${bg}  ${ratio('#FFFFFF',bg).toFixed(2)}`);
console.log('--- orange on white (icon/border use, needs 3:1 for UI) ---');
for (const fg of ['#E87722','#B45309','#A85410'])
  console.log(`  ${fg} on white  ${ratio(fg,'#FFFFFF').toFixed(2)}`);
