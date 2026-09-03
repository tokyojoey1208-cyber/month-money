(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num,safe=M.safe,fmt=M.fmt;

  // Link imported MAIN/SIDE records to their pre-existing ledger rows once, so edit/delete never duplicates cash.
  function migrateLinks(){
    let changed=false;
    (M.state.salaries||[]).forEach(s=>{
      const target=`MAIN:${s.id}`;if(M.state.ledger.some(x=>x.linkId===target))return;
      const net=M.salaryTotals(s).net;
      const candidates=M.state.ledger.filter(x=>x.category==='본업수입'&&x.month===s.payMonth&&!x.linkId&&Math.abs(n(x.amount)-net)<.01);
      const pick=candidates.find(x=>s.type==='상여'?String(x.item).includes('상여'):!String(x.item).includes('상여'))||candidates[0];
      if(pick){pick.linkId=target;s.ledgerId=target;changed=true}
    });
    (M.state.payouts||[]).forEach(p=>{
      const target=`SIDE:${p.id}`;if(M.state.ledger.some(x=>x.linkId===target))return;
      const amount=n(p.actual)||n(p.expected);
      const candidates=M.state.ledger.filter(x=>x.category==='부업수입'&&x.month===p.payMonth&&x.currency===p.currency&&!x.linkId&&Math.abs(n(x.amount)-amount)<.01);
      if(candidates.length){candidates[0].linkId=target;p.ledgerId=target;changed=true}
    });
    if(changed)M.save();
  }
  migrateLinks();

  // Project headline metrics are for the selected month. Lifetime remains visible as secondary context.
  M.workSummary=p=>{
    const ss=M.state.sessions.filter(x=>x.projectId===p.id&&String(x.date).startsWith(M.selectedMonth)),v=ss.map(s=>M.sessionValue(p,s)),mins=ss.reduce((a,b)=>a+n(b.minutes),0),net=v.reduce((a,b)=>a+n(b.net),0),count=ss.reduce((a,b)=>a+n(b.pass)+n(b.fail)+n(b.hold)+n(b.excluded),0);
    return{mins,net,count,hourly:mins?net/(mins/60):0};
  };
  M.lifeSummary=p=>{
    const ss=M.state.sessions.filter(x=>x.projectId===p.id),v=ss.map(s=>M.sessionValue(p,s)),mins=ss.reduce((a,b)=>a+n(b.minutes),0),net=v.reduce((a,b)=>a+n(b.net),0),count=ss.reduce((a,b)=>a+n(b.pass)+n(b.fail)+n(b.hold)+n(b.excluded),0);
    return{mins,net,count,hourly:mins?net/(mins/60):0};
  };

  const incomeBefore=M.renderIncome;
  M.renderIncome=()=>{
    incomeBefore();
    if(M.incomeTab==='side'&&M.sideTab==='work'){
      $$('[data-project]').forEach(box=>{
        const p=M.project(box.dataset.project);if(!p)return;const det=$('.details',box),life=M.lifeSummary(p);if(!det||$('.lifetime-strip',det))return;
        const strip=document.createElement('div');strip.className='lifetime-strip';
        strip.innerHTML=`<span>${M.selectedMonth} 수치는 위 카드</span><span>누적 ${life.count.toLocaleString()}건 · ${(life.mins/60).toFixed(2)}h · ${fmt(life.net,p.currency)}</span>`;
        const metrics=$('.project-metrics',det);metrics?.insertAdjacentElement('afterend',strip);
      });
    }
    if(M.incomeTab==='main'){
      $$('[data-salary]').forEach(box=>{
        const s=M.state.salaries.find(x=>x.id===box.dataset.salary);if(!s||!String(s.memo||'').includes('역사'))return;
        const summary=$('summary',box);if(summary&&!$('.history-badge',summary)){const b=document.createElement('span');b.className='history-badge';b.textContent='실수령 역사값 · 상세 미보유';summary.appendChild(b)}
      });
    }
  };

  // Reference FX has one row per month. Editing a month to collide merges it rather than leaving ambiguous duplicate rates.
  M.saveFxEdits=()=>{
    const map=new Map();$$('[data-fx-row]').forEach(r=>{const m=$('[data-fx-month]',r).value;if(!m)return;map.set(m,{id:`fx-${m}`,month:m,krwPer100Jpy:n($('[data-fx-krw]',r).value),jpyPerUsd:n($('[data-fx-usd]',r).value),note:''})});
    M.state.fx=[...map.values()].sort((a,b)=>a.month.localeCompare(b.month));M.save();M.renderAll();M.toast('환율 저장');
  };

  // Warn before moving the accounting origin; seed start is intentionally flexible, cash-engine start is not a monthly control.
  const editStartBefore=M.editStartPoint;
  M.editStartPoint=()=>{editStartBefore();const title=$('#sheetContent .sheet-title');if(title)title.insertAdjacentHTML('afterend','<div class="notice-box">여기는 최초 회계 기준점입니다. SEED 시작월과 다릅니다. 현재 운영 시작은 2026-09-03이고, 특별한 재구축이 아니면 월만 자주 바꾸지 않습니다.</div>')};

  const bindBefore=M.bind;
  M.bind=()=>{bindBefore();const fx=$('[data-save-fx]');if(fx)fx.onclick=M.saveFxEdits};

  M.save();M.renderAll();
})();