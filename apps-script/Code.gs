const SHEETS = {
  FLOW: '02 월간흐름',
  LEDGER: '03 입력원장',
  SETTLEMENT: '05 정산·잔액',
  PROJECTS: '06 부업프로젝트',
  SESSIONS: '07 부업세션',
  PAYOUTS: '08 부업정산',
  FX: '09 환율',
  SEED: '10 SEED',
  SALARY: '11 본업명세',
  TEMPLATES: '12 템플릿'
};

/**
 * One-time setup in Apps Script editor:
 * setupMyMoney('YOUR_SPREADSHEET_ID', 'A_LONG_RANDOM_TOKEN');
 * Then deploy as Web app: Execute as Me / Anyone with the link.
 * The token is checked on every request and is never stored in GitHub.
 */
function setupMyMoney(spreadsheetId, apiToken) {
  if (!spreadsheetId || !apiToken) throw new Error('spreadsheetId와 apiToken이 필요합니다.');
  PropertiesService.getScriptProperties().setProperties({ SPREADSHEET_ID: spreadsheetId, API_TOKEN: apiToken });
  return 'OK';
}

function doGet() {
  return json_({ ok: true, data: { service: 'MY MONEY V2 API', status: 'ready' } });
}

function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    auth_(req.token);
    const action = req.action;
    const payload = req.payload || {};
    let data;
    switch (action) {
      case 'bootstrap': data = bootstrap_(); break;
      case 'saveSalary': data = saveSalary_(payload.salary); break;
      case 'deleteSalary': data = deleteSalary_(payload.id); break;
      case 'upsertProject': data = upsertProject_(payload.project); break;
      case 'appendSideSession': data = appendSideSession_(payload.session); break;
      case 'appendPayout': data = appendPayout_(payload.payout, payload.mirrorLedger !== false); break;
      case 'saveFx': data = saveFx_(payload.fx); break;
      case 'saveSeedConfig': data = saveSeedConfig_(payload.seed); break;
      case 'saveSeedMonth': data = saveSeedMonth_(payload.row); break;
      default: throw new Error('지원하지 않는 action: ' + action);
    }
    return json_({ ok: true, data });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function auth_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected || !token || token !== expected) throw new Error('Unauthorized');
}
function ss_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('SPREADSHEET_ID가 설정되지 않았습니다.');
  return SpreadsheetApp.openById(id);
}
function sh_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('시트를 찾을 수 없습니다: ' + name);
  return s;
}
function vals_(name) { return sh_(name).getDataRange().getValues(); }
function n_(v) { return typeof v === 'number' ? v : Number(String(v || '').replace(/,/g,'')) || 0; }
function s_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
  return v == null ? '' : String(v);
}
function month_(v) { const x=s_(v); return x.length >= 7 ? x.slice(0,7) : x; }
function id_(prefix) { return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,7); }

function bootstrap_() {
  return {
    settings: { startMonth: '2026-09' },
    flow: readFlow_(),
    ledger: readLedger_(),
    salaries: readSalaries_(),
    templates: readTemplates_(),
    projects: readProjects_(),
    sessions: readSessions_(),
    payouts: readPayouts_(),
    fx: readFx_(),
    settlements: readSettlements_(),
    seed: readSeed_()
  };
}

function readFlow_() {
  const v = vals_(SHEETS.FLOW), out = {};
  for (let r = 6; r < v.length; r++) {
    const row=v[r], m=month_(row[0]), cur=s_(row[1]); if(!m || !cur) continue;
    out[m] ||= {};
    out[m][cur] = {
      start:n_(row[2]), main:n_(row[3]), side:n_(row[4]), otherIn:n_(row[5]), card:n_(row[6]), fixed:n_(row[7]), otherOut:n_(row[8]), settlement:n_(row[9]), fxIn:n_(row[10]), fxOut:n_(row[11]), adjust:n_(row[12]), end:n_(row[13])
    };
  }
  return out;
}
function readLedger_() {
  const v=vals_(SHEETS.LEDGER), out=[];
  for(let r=4;r<v.length;r++){const x=v[r]; if(!x[0]&&!x[4])continue; out.push({month:month_(x[0]),date:s_(x[1]),currency:s_(x[2]),category:s_(x[3]),item:s_(x[4]),amount:n_(x[5]),reflect:s_(x[6]),status:s_(x[7]),workMonth:month_(x[8]),payMonth:month_(x[9]),linkId:s_(x[10]),memo:s_(x[11]),cashMode:s_(x[12]),settlementTarget:s_(x[13])});}
  return out;
}
function readProjects_(){const v=vals_(SHEETS.PROJECTS),out=[];for(let r=1;r<v.length;r++){const x=v[r];if(!x[0])continue;out.push({id:s_(x[0]),name:s_(x[1]),platform:s_(x[2]),model:s_(x[3]),currency:s_(x[4]),unitPay:n_(x[5]),failPay:n_(x[6]),hourlyPay:n_(x[7]),deductionRate:n_(x[8]),active:s_(x[9])!=='종료',delayDays:n_(x[10]),note:s_(x[11])});}return out;}
function readSessions_(){const v=vals_(SHEETS.SESSIONS),out=[];for(let r=1;r<v.length;r++){const x=v[r];if(!x[0])continue;out.push({id:s_(x[0]),date:s_(x[1]),projectId:s_(x[2]),start:s_(x[3]),end:s_(x[4]),minutes:Math.round(n_(x[5])*60),pass:n_(x[6]),fail:n_(x[7]),hold:n_(x[8]),excluded:n_(x[9]),gross:n_(x[11]),deduction:n_(x[12]),net:n_(x[13]),currency:s_(x[14]),jpy:n_(x[15]),rateId:s_(x[16]),note:s_(x[17])});}return out;}
function readPayouts_(){const v=vals_(SHEETS.PAYOUTS),out=[];for(let r=1;r<v.length;r++){const x=v[r];if(!x[0])continue;out.push({id:s_(x[0]),projectId:s_(x[1]),workMonth:month_(x[2]),payDate:s_(x[3]),payMonth:month_(x[4]),currency:s_(x[5]),expected:n_(x[6]),actual:n_(x[7]),status:s_(x[8]),ledgerId:s_(x[9]),jpy:n_(x[10]),memo:s_(x[11])});}return out;}
function readFx_(){const v=vals_(SHEETS.FX),map={};for(let r=1;r<v.length;r++){const x=v[r];if(!x[0]&&!x[1])continue;const m=month_(x[1]);map[m]||={id:'fx-'+m,month:m,krwPer100Jpy:0,jpyPerUsd:0,note:''};const from=s_(x[2]),to=s_(x[3]),base=n_(x[4]),rate=n_(x[5]);if(from==='JPY'&&to==='KRW'&&base===100)map[m].krwPer100Jpy=rate;if(from==='USD'&&to==='JPY'&&base===1)map[m].jpyPerUsd=rate;map[m].note=s_(x[8]);}return Object.keys(map).sort().map(k=>map[k]);}
function readSettlements_(){const s=sh_(SHEETS.SETTLEMENT),v=s.getRange('A6:H11').getValues();return [{id:'japan-revo',title:'일본 리보',currency:'JPY',current:n_(v[1][1]),planned:n_(v[2][1]),active:n_(v[1][1])>0},{id:'korea-support',title:'한국 지원 잔액',currency:'KRW',current:n_(v[1][7]),planned:n_(v[2][7]),active:n_(v[1][7])>0}];}

function readSalaries_(){const v=vals_(SHEETS.SALARY),map={};for(let r=1;r<v.length;r++){const x=v[r];if(!x[0])continue;const id=s_(x[0]);map[id]||={id,payMonth:month_(x[1]),workMonth:month_(x[2]),payDate:s_(x[3]),type:s_(x[4]),status:s_(x[10]),templateId:s_(x[9]),ledgerId:s_(x[11]),items:[]};map[id].items.push({kind:s_(x[5]),name:s_(x[6]),amount:n_(x[7]),order:n_(x[8])});}return Object.values(map);}
function readTemplates_(){const v=vals_(SHEETS.TEMPLATES),map={};for(let r=1;r<v.length;r++){const x=v[r];if(!x[0]||s_(x[9])==='종료')continue;const id=s_(x[0]);map[id]||={id,area:s_(x[1]),name:s_(x[2]),currency:s_(x[3]),type:s_(x[4]),items:[]};map[id].items.push({kind:s_(x[5]),name:s_(x[6]),amount:n_(x[7]),order:n_(x[10])});}return Object.values(map);}
function readSeed_(){const v=vals_(SHEETS.SEED);const planStart=month_(v[1]?.[1])||'2027-01',targetCurrency=s_(v[2]?.[1])||'KRW',longGoal=n_(v[3]?.[1]),annualGoal=n_(v[4]?.[1]);const rows=[];for(let r=7;r<v.length;r++){const x=v[r];if(!x[0])continue;rows.push({month:month_(x[0]),target:n_(x[3]),actual:n_(x[4]),note:s_(x[11])});}return{planStart,targetCurrency,longGoal,annualGoal,rows};}

function saveSalary_(salary){if(!salary||!salary.id)throw new Error('salary.id 필요');const sheet=sh_(SHEETS.SALARY);deleteRowsByValue_(sheet,1,salary.id);const rows=(salary.items||[]).map(i=>[salary.id,salary.payMonth,salary.workMonth,salary.payDate,salary.type,i.kind,i.name,n_(i.amount),n_(i.order),salary.templateId||'',salary.status||'예정',salary.ledgerId||'',salary.memo||'',new Date()]);if(rows.length)sheet.getRange(sheet.getLastRow()+1,1,rows.length,14).setValues(rows);const earn=rows.filter(r=>r[5]==='지급').reduce((a,r)=>a+n_(r[7]),0),ded=rows.filter(r=>r[5]==='공제').reduce((a,r)=>a+n_(r[7]),0),net=earn-ded;upsertLedgerMain_(salary,net);return{net};}
function deleteSalary_(id){if(!id)throw new Error('id 필요');deleteRowsByValue_(sh_(SHEETS.SALARY),1,id);deleteLedgerByLink_('MAIN:'+id);return{id};}
function upsertLedgerMain_(salary,net){const sheet=sh_(SHEETS.LEDGER),data=sheet.getDataRange().getValues(),key='MAIN:'+salary.id;let row=-1;for(let r=4;r<data.length;r++){if(s_(data[r][10])===key){row=r+1;break;}}if(row<0){for(let r=4;r<data.length;r++){if(s_(data[r][3])==='본업수입'&&s_(data[r][1])===salary.payDate){row=r+1;break;}}}const values=[[salary.payMonth,salary.payDate,'JPY','본업수입',`${salary.workMonth} ${salary.type}`,net,'반영',salary.status||'예정',salary.workMonth,salary.payMonth,key,'11 본업명세 연동','','']];if(row>0)sheet.getRange(row,1,1,14).setValues(values);else sheet.getRange(sheet.getLastRow()+1,1,1,14).setValues(values);}
function deleteLedgerByLink_(key){const sheet=sh_(SHEETS.LEDGER),v=sheet.getDataRange().getValues();for(let r=v.length-1;r>=4;r--)if(s_(v[r][10])===key)sheet.deleteRow(r+1);}

function upsertProject_(p){if(!p||!p.id)throw new Error('project.id 필요');const sheet=sh_(SHEETS.PROJECTS),v=sheet.getDataRange().getValues();let row=0;for(let r=1;r<v.length;r++)if(s_(v[r][0])===p.id){row=r+1;break;}const values=[[p.id,p.name,p.platform,p.model,p.currency,n_(p.unitPay),n_(p.failPay),n_(p.hourlyPay),n_(p.deductionRate),p.active===false?'종료':'활성',n_(p.delayDays),p.note||'']];if(row)sheet.getRange(row,1,1,12).setValues(values);else sheet.getRange(sheet.getLastRow()+1,1,1,12).setValues(values);return p;}
function projectById_(id){return readProjects_().find(p=>p.id===id);}
function rateForMonth_(month){const list=readFx_().filter(x=>x.month<=month).sort((a,b)=>a.month.localeCompare(b.month));return list[list.length-1]||{id:'',krwPer100Jpy:0,jpyPerUsd:0};}
function toJpy_(value,currency,month){const r=rateForMonth_(month);if(currency==='JPY')return value;if(currency==='KRW'&&r.krwPer100Jpy)return value/r.krwPer100Jpy*100;if(currency==='USD'&&r.jpyPerUsd)return value*r.jpyPerUsd;return 0;}
function appendSideSession_(s){const p=projectById_(s.projectId);if(!p)throw new Error('프로젝트를 찾을 수 없습니다.');const hours=n_(s.minutes)/60;const gross=p.model==='시급'?hours*n_(p.hourlyPay):n_(s.pass)*n_(p.unitPay)+n_(s.fail)*n_(p.failPay);const deduction=gross*n_(p.deductionRate),net=gross-deduction,month=month_(s.date),rate=rateForMonth_(month);const row=[s.id||id_('session'),s.date,p.id,s.start,s.end,hours,n_(s.pass),n_(s.fail),n_(s.hold),n_(s.excluded),n_(s.pass)+n_(s.fail)+n_(s.hold)+n_(s.excluded),gross,deduction,net,p.currency,toJpy_(net,p.currency,month),rate.id||'',s.note||''];const sheet=sh_(SHEETS.SESSIONS);sheet.getRange(sheet.getLastRow()+1,1,1,18).setValues([row]);return{gross,deduction,net};}

function appendPayout_(payout,mirrorLedger){if(!payout||!payout.id)throw new Error('payout.id 필요');const sheet=sh_(SHEETS.PAYOUTS),v=sheet.getDataRange().getValues();let row=0;for(let r=1;r<v.length;r++)if(s_(v[r][0])===payout.id){row=r+1;break;}const amount=n_(payout.actual)||n_(payout.expected),jpy=toJpy_(amount,payout.currency,payout.payMonth);const ledgerKey='PAYOUT:'+payout.id;const values=[[payout.id,payout.projectId||'',payout.workMonth,payout.payDate,payout.payMonth,payout.currency,n_(payout.expected),n_(payout.actual),payout.status||'입금예정',mirrorLedger?ledgerKey:'',jpy,payout.memo||'']];if(row)sheet.getRange(row,1,1,12).setValues(values);else sheet.getRange(sheet.getLastRow()+1,1,1,12).setValues(values);if(mirrorLedger)upsertLedgerPayout_(payout,ledgerKey);return payout;}
function upsertLedgerPayout_(p,key){const sheet=sh_(SHEETS.LEDGER),v=sheet.getDataRange().getValues();let row=0;for(let r=4;r<v.length;r++)if(s_(v[r][10])===key){row=r+1;break;}const amount=n_(p.actual)||n_(p.expected);const values=[[p.payMonth,p.payDate,p.currency,'부업수입',p.projectName||p.projectId||'부업수입',amount,'반영',n_(p.actual)>0?'확정':'예정',p.workMonth,p.payMonth,key,p.memo||'','','']];if(row)sheet.getRange(row,1,1,14).setValues(values);else sheet.getRange(sheet.getLastRow()+1,1,1,14).setValues(values);}

function saveFx_(fx){if(!fx||!fx.month)throw new Error('적용월 필요');const sheet=sh_(SHEETS.FX);deleteRowsByValue_(sheet,2,fx.month);const now=new Date(),rows=[];if(n_(fx.krwPer100Jpy))rows.push([`fx-${fx.month}-jpykrw`,fx.month,'JPY','KRW',100,n_(fx.krwPer100Jpy),'¥100 = ₩'+n_(fx.krwPer100Jpy),now,fx.note||'']);if(n_(fx.jpyPerUsd))rows.push([`fx-${fx.month}-usdjpy`,fx.month,'USD','JPY',1,n_(fx.jpyPerUsd),'$1 = ¥'+n_(fx.jpyPerUsd),now,fx.note||'']);if(rows.length)sheet.getRange(sheet.getLastRow()+1,1,rows.length,9).setValues(rows);return fx;}

function saveSeedConfig_(seed){const sheet=sh_(SHEETS.SEED);sheet.getRange('B2').setValue(seed.planStart||'');sheet.getRange('B3').setValue(seed.targetCurrency||'KRW');sheet.getRange('B4').setValue(n_(seed.longGoal));return seed;}
function saveSeedMonth_(row){if(!row||!row.month)throw new Error('월 필요');const sheet=sh_(SHEETS.SEED),v=sheet.getDataRange().getValues();let targetRow=0;for(let r=7;r<v.length;r++)if(month_(v[r][0])===row.month){targetRow=r+1;break;}if(!targetRow){targetRow=sheet.getLastRow()+1;sheet.getRange(targetRow,1).setValue(row.month);}sheet.getRange(targetRow,4).setValue(n_(row.target));sheet.getRange(targetRow,5).setValue(n_(row.actual));if(row.note!=null)sheet.getRange(targetRow,12).setValue(row.note);const actualStart=findActualSeedStart_();sheet.getRange('B6').setValue(actualStart||'');recalcSeedRows_();return row;}
function findActualSeedStart_(){const v=vals_(SHEETS.SEED);for(let r=7;r<v.length;r++)if(n_(v[r][4])>0)return month_(v[r][0]);return '';}
function recalcSeedRows_(){const sheet=sh_(SHEETS.SEED),v=sheet.getDataRange().getValues(),plan=month_(v[1][1]),cur=s_(v[2][1])||'KRW',long=n_(v[3][1]),actualStart=findActualSeedStart_();let ct=0,ca=0;for(let r=7;r<v.length;r++){if(!v[r][0])continue;const m=month_(v[r][0]);ct+=n_(v[r][3]);ca+=n_(v[r][4]);sheet.getRange(r+1,2,1,11).setValues([[m>=plan,cur,n_(v[r][3]),n_(v[r][4]),ct,ca,n_(v[r][7]),long,plan,actualStart,s_(v[r][11])]]);}}

function deleteRowsByValue_(sheet,column1Based,value){const v=sheet.getDataRange().getValues();for(let r=v.length-1;r>=1;r--)if(s_(v[r][column1Based-1])===String(value))sheet.deleteRow(r+1);}
