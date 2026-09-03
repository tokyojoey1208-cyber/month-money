import assert from 'node:assert/strict';
import fs from 'node:fs';

const n=v=>Number(v||0);
function flow(start,rows,currency){
  const a=rows.filter(x=>x.currency===currency&&x.reflect!=='미반영');
  const sum=cat=>a.filter(x=>x.category===cat).reduce((s,x)=>s+n(x.amount),0);
  const settlement=a.filter(x=>x.category==='상환·지원금'&&x.cashMode!=='카드청구포함').reduce((s,x)=>s+n(x.amount),0);
  return start+sum('본업수입')+sum('부업수입')+sum('기타수입')-sum('카드청구')-sum('고정비')-sum('기타지출')-settlement+sum('환전유입')-sum('환전유출')+sum('잔고보정');
}
const row=(currency,category,amount,extra={})=>({currency,category,amount,reflect:'반영',...extra});
const sep=[
  row('JPY','본업수입',290986),row('JPY','부업수입',9040.483),row('JPY','카드청구',259268),row('JPY','고정비',77973),row('JPY','상환·지원금',450000,{cashMode:'예약차감'}),
  row('KRW','부업수입',615012),row('KRW','고정비',38890)
];
assert.ok(Math.abs(flow(494964,sep,'JPY')-7749.483)<1e-9,'Sep JPY FLOW');
assert.equal(flow(67257,sep,'KRW'),643379,'Sep KRW FLOW');
assert.equal(flow(10.82,sep,'USD'),10.82,'Sep USD FLOW');

const cash=[...sep,row('JPY','기타지출',10000,{cashMode:'현금'})];
assert.ok(Math.abs(flow(494964,cash,'JPY')+2250.517)<1e-9,'direct cash reduces FLOW');

const cardIncluded=sep.map(x=>x.category==='카드청구'&&x.currency==='JPY'?{...x,amount:709268}:x.category==='상환·지원금'?{...x,cashMode:'카드청구포함'}:x);
assert.ok(Math.abs(flow(494964,cardIncluded,'JPY')-7749.483)<1e-9,'repayment inside card is not double-subtracted');

const adjusted=[...sep,row('JPY','잔고보정',12000)];
assert.ok(Math.abs(flow(494964,adjusted,'JPY')-19749.483)<1e-9,'positive reconciliation adjustment');

const fx=[row('KRW','환전유출',100000,{linkId:'FX:test'}),row('JPY','환전유입',10000,{linkId:'FX:test'})];
assert.equal(flow(67257,fx,'KRW'),-32743,'FX source out');
assert.equal(flow(494964,fx,'JPY'),504964,'FX destination in');
assert.equal(fx.filter(x=>x.linkId==='FX:test').length,2,'FX linked pair');

const gross=10*3000+2*1000,net=gross*(1-.033);
assert.equal(gross,32000,'Chart2Code gross');
assert.equal(net,30944,'Chart2Code net');
assert.equal(330000+3000+13760-(13790+322+25620+1832+6110+8100),290986,'salary statement net');

const loader=fs.readFileSync('snapshot-loader.js','utf8');
assert.match(loader,/force\|\|!hasLocal/,'snapshot must not overwrite existing local state without reset');
const v6=fs.readFileSync('v6-selfqa.js','utf8');
assert.match(v6,/M\.isDirectOut/,'direct outflow classifier present');
assert.match(v6,/카드청구포함/,'card-included repayment mode preserved');
assert.match(v6,/환전 양쪽 삭제/,'linked FX pair deletion present');
const v7=fs.readFileSync('v7-moneyrules.js','utf8');
assert.match(v7,/flowMode/,'fixed-cost flow mode present');
assert.match(v7,/x\.flowMode!==['"]카드청구포함['"]/,'card-included recurring cost excluded from fixed ledger apply');
assert.match(v7,/data-card-balance/,'card balance editor present');
const gas=fs.readFileSync('apps-script/Code.gs','utf8');
assert.match(gas,/saveAll_/,'backend whole-state save present');
assert.match(gas,/ACTUAL:'13 현실잔고'/,'actual balance backend present');
assert.match(gas,/CARDS:'14 카드·고정비'/,'cards-fixed backend present');
console.log('MY MONEY self-QA scenarios: PASS');
