const lum=hex=>{const h=hex.replace('#','');const[r,g,b]=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return .2126*r+.7152*g+.0722*b;};
const ratio=(a,b)=>{const[x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
console.log('--ink-3 candidates on #FFF and #FAF8FA (need >=4.5 both):');
for(const c of ['#857E8A','#7A7380','#6F6875','#6B6472','#68616B','#5F5966'])
  console.log(`  ${c}  white ${ratio(c,'#FFFFFF').toFixed(2)}   bg-alt ${ratio(c,'#FAF8FA').toFixed(2)}`);
console.log('\n--warn #A15C07 on #FEF6E7:', ratio('#A15C07','#FEF6E7').toFixed(2));
console.log('--err #B3261E-ish on #FDF0EF:', ratio('#B3261E','#FDF0EF').toFixed(2));
console.log('\nfinal button pick: white on #A85410 =', ratio('#FFFFFF','#A85410').toFixed(2), ' hover white on #9C4A06 =', ratio('#FFFFFF','#9C4A06').toFixed(2));
console.log('focus ring #E87722 vs white =', ratio('#E87722','#FFFFFF').toFixed(2), '(UI component, needs 3:1)');
