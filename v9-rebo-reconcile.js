(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num,fmt=M.fmt,safe=M.safe;
  const includedRows=(cur='JPY',month=M.selectedMonth)=>M.state.ledger.filter(x=>x.month===month&&x.reflect!=='미반영'&&x.currency===cur&&x.category==='상환·지원금'&&x.cashMode==='카드청구포함');
  const reconKey=(m,c)=>`RECON:${m}:${c}`;
  const reconRows=(m,c)=>M.state.ledger.filter(x=>x.month===m&&x.currency===c&&x.category==='잔고보정'&&x.linkId===reconKey(m,c)&&x.reflect!=='미반영');
  const reconBase=(m,c)=>M.flow(c,m).end-reconRows(m,c).reduce((a,b)=>a+n(b.amount),0);
  const monthEndDate=m=>{const [y,mo]=m.split('-').map(Number),d=new Date(y,mo,0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
  const pendingRows=(m,c)=>M.state.ledger.filter(x=>x.month===m&&x.currency===c&&x.reflect!=='미반영'&&x.status==='예정'&&x.linkId!==reconKey(m,c));

  function enhanceSummary(){
    $$('#screen-flow .card').forEach(card=>{
      const eye=$('.eyebrow',card)?.textContent.trim()||'';if(!eye.endsWith('FLOW'))return;const cur=eye.split(' ')[0],inc=includedRows(cur,M.selectedMonth);if(!inc.length)return;
      const cardLine=[...card.querySelectorAll('.line')].find(r=>$('span',r)?.textContent.trim()==='- 카드청구');if(!cardLine||$('.included-settlement-block',card))return;
      const total=inc.reduce((a,b)=>a+n(b.amount),0),bill=M.flow(cur).card,residual=bill-total;
      const box=document.createElement('div');box.className='included-settlement-block';
      box.innerHTML=`<div class="included-title">카드청구 안에 포함된 상환 · 정보표시</div>${inc.map(x=>`<div class="included-line"><span>↳ ${safe(x.item||x.settlementTarget||'상환')}</span><strong>포함 ${fmt(x.amount,cur)}</strong></div>`).join('')}${bill>=total?`<div class="included-line residual"><span>↳ 그 외 카드청구(역산)</span><strong>${fmt(residual,cur)}</strong></div>`:`<div class="included-warning">포함 상환액 ${fmt(total,cur)}이 카드청구 ${fmt(bill,cur)}보다 큽니다. 카드서비스 최종 청구액을 업데이트하세요.</div>`}<div class="included-foot">FLOW 현금차감은 카드청구 ${fmt(bill,cur)} 한 번만. 위 상환액은 내역 확인용입니다.</div>`;
      cardLine.insertAdjacentElement('afterend',box);
      const settleLine=[...card.querySelectorAll('.line')].find(r=>$('span',r)?.textContent.trim()==='- 상환·지원금');if(settleLine)$('span',settleLine).textContent='- 상환·지원금 (별도차감만)';
    });
  }

  function enhanceBig(){
    const inc=M.state.ledger.map((x,i)=>({x,i})).filter(({x})=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&x.category==='상환·지원금'&&x.cashMode==='카드청구포함');
    $$('[data-big-row]').forEach(r=>{const i=Number(r.dataset.ledgerIndex),hit=inc.find(v=>v.i===i);if(!hit||$('.included-chip',r))return;const chip=document.createElement('span');chip.className='included-chip';chip.textContent='카드청구 포함 · 추가차감 0';r.insertBefore(chip,r.lastElementChild)});
    if(!inc.length)return;
    const metric=$('#screen-flow .metric-strip');if(metric&&!$('.included-metric',metric)){const sum=inc.reduce((a,b)=>a+n(b.x.amount),0),box=document.createElement('div');box.className='metric-box included-metric';box.innerHTML=`<small>카드 안 상환 · 표시</small><strong>${fmt(sum,inc[0].x.currency)}</strong>`;metric.appendChild(box)}
    const firstMetric=[...$('#screen-flow').querySelectorAll('.metric-box')].find(x=>$('small',x)?.textContent.includes('JPY 큰 지출'));if(firstMetric){const cash=M.bigOutRows().filter(x=>x.currency==='JPY'&&!(x.category==='상환·지원금'&&x.cashMode==='카드청구포함')).reduce((a,b)=>a+n(b.amount),0);$('strong',firstMetric).textContent=fmt(cash,'JPY')}
    const editor=[...$('#screen-flow').querySelectorAll('.section-head')].find(x=>x.textContent.includes('이번 달 큰돈 편집'));if(editor&&!$('.included-rule-note'))editor.insertAdjacentHTML('beforebegin','<div class="notice-box included-rule-note"><b>카드청구포함</b> 상환은 금액을 수기로 계속 보관합니다. 카드서비스 총청구에서 현금은 한 번만 빠지고, 상환행은 “얼마를 갚았는지” 확인하는 표시용으로 남습니다.</div>');
  }

  function enhanceReconcile(){
    const screen=$('#screen-flow');if(!screen||$('[data-month-end-reconcile]',screen))return;
    const head=[...screen.querySelectorAll('.section-head')].find(x=>x.textContent.includes('예외 · 현금'));if(head){const p=$('p',head);if(p)p.textContent='큰 현금/이체만 필요할 때 기록. 스이카 충전 같은 자잘한 차이는 모아서 월말 잔액맞춤 1회.';const b=document.createElement('button');b.className='btn lime small';b.dataset.monthEndReconcile='';b.textContent='월말 잔액맞춤';head.appendChild(b)}
    const note=[...screen.querySelectorAll('.notice-box')].find(x=>x.textContent.includes('실제잔고는'));if(note)note.insertAdjacentHTML('afterend','<div class="notice-box month-end-note">자잘한 현금성 지출을 건건이 입력하지 않아도 됩니다. 그 달 주요 입출금이 끝난 뒤 통장 실제잔고를 넣으면 차이만 <b>잔고보정</b>으로 자동 계산합니다.</div>');
  }

  const flowBefore=M.renderFlow;
  M.renderFlow=()=>{flowBefore();if(M.flowTab==='summary')enhanceSummary();if(M.flowTab==='big')enhanceBig();if(M.flowTab==='reconcile')enhanceReconcile()};

  const homeBefore=M.renderHome;
  M.renderHome=()=>{homeBefore();const inc=includedRows('JPY',M.selectedMonth);if(!inc.length)return;const card=[...$('#screen-home').querySelectorAll('.card')].find(x=>$('h3',x)?.textContent==='이번 달 큰 지출');if(!card)return;inc.forEach(x=>{[...card.querySelectorAll('.line')].filter(r=>$('span',r)?.textContent.includes(x.item)).forEach(r=>{r.classList.add('included-home-row');const s=$('span',r);if(s&&!s.textContent.includes('추가차감 없음'))s.insertAdjacentHTML('beforeend','<br><span class="muted">카드청구에 포함 · 추가차감 없음</span>')})})};

  const quickBefore=M.openQuickHub;
  M.openQuickHub=()=>{quickBefore();const direct=$('[data-q="direct"]');if(direct)direct.innerHTML='<b>− 큰 현금/이체 지출</b><small>필요한 것만 · 자잘한 건 월말 보정</small>';const grid=$('#sheetContent .quick-grid');if(grid&&!$('.tiny-spend-note'))grid.insertAdjacentHTML('beforebegin','<div class="notice-box tiny-spend-note">스이카 충전·소액 현금까지 적는 가계부로 만들지 않습니다. 기억할 만한 큰 건만 입력하고, 나머지는 월말 통장잔액으로 한 번 맞춥니다.</div>')};

  M.openMonthEndReconcile=(currency='JPY')=>{
    const defaultDate=M.selectedMonth===M.thisMonth()?M.today():monthEndDate(M.selectedMonth);
    M.openSheet(`<h2 class="sheet-title">${safe(M.selectedMonth)} 월말 잔액맞춤</h2><div class="notice-box">주요 입출금이 끝난 뒤 한 번 사용합니다. 기존 FLOW를 덮어쓰지 않고, 실제잔고와의 차이만 ‘잔고보정’으로 기록합니다.</div><div class="field-grid" style="margin-top:10px"><div class="field"><label>통화</label><select id="reconCur" class="select">${['JPY','KRW','USD'].map(c=>`<option ${c===currency?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>통장 확인일</label><input id="reconDate" class="input" type="date" value="${defaultDate}"></div></div><div class="field" style="margin-top:8px"><label>실제 통장/보유 잔고</label><input id="reconActual" class="input num" type="number" placeholder="실제 확인값"></div><div id="reconPending"></div><div id="reconPreview" class="recon-preview"></div><button id="reconSave" class="btn lime block" style="margin-top:12px">차이만 잔고보정으로 저장</button>`);
    const draw=()=>{const c=$('#reconCur').value,base=reconBase(M.selectedMonth,c),raw=$('#reconActual').value,has=raw!=='';const pending=pendingRows(M.selectedMonth,c);$('#reconPending').innerHTML=pending.length?`<div class="notice-box included-warning" style="margin-top:10px"><b>아직 ‘예정’ ${pending.length}건이 남아 있습니다.</b><br>${pending.slice(0,4).map(x=>`${safe(x.item)} ${fmt(x.amount,c)}`).join(' · ')}${pending.length>4?' 외':''}<br><span class="muted">이미 실제잔고에 반영된 항목인데 상태만 예정인 경우라면 그대로 잔액맞춤해도 됩니다. 아직 실제로 안 빠진/안 들어온 돈이라면 먼저 확인하세요.</span></div>`:'';$('#reconPreview').innerHTML=`<div class="line"><span>보정 전 계산잔고</span><strong>${fmt(base,c)}</strong></div><div class="line"><span>실제잔고</span><strong>${has?fmt(n(raw),c):'—'}</strong></div><div class="line reconcile-delta"><span>자동 잔고보정</span><strong>${has?`${n(raw)-base>=0?'+':'−'}${fmt(Math.abs(n(raw)-base),c)}`:'—'}</strong></div>`};
    $('#reconCur').onchange=draw;$('#reconActual').oninput=draw;draw();
    $('#reconSave').onclick=()=>{const c=$('#reconCur').value,raw=$('#reconActual').value,date=$('#reconDate').value;if(raw==='')return M.toast('실제잔고를 입력');if(!date||date.slice(0,7)!==M.selectedMonth)return M.toast(`확인일을 ${M.selectedMonth}로 맞춰줘`);const actual=n(raw),base=reconBase(M.selectedMonth,c),delta=actual-base,key=reconKey(M.selectedMonth,c);let row=M.state.ledger.find(x=>x.linkId===key);if(!row){row={month:M.selectedMonth,date,currency:c,category:'잔고보정',item:'월말 잔액맞춤',amount:delta,reflect:'반영',status:'확정',workMonth:'',payMonth:M.selectedMonth,linkId:key,memo:'자잘한 현금성 차이 월말 일괄보정',cashMode:'',settlementTarget:''};M.state.ledger.push(row)}else Object.assign(row,{month:M.selectedMonth,date,currency:c,amount:delta,reflect:'반영',status:'확정'});M.state.actualBalances||={};M.state.actualBalances[c]={amount:actual,asOf:date,note:`${M.selectedMonth} 월말 잔액맞춤`};M.recalcMonth();M.closeSheet();M.flowTab='reconcile';M.renderAll();M.toast(`잔고보정 ${delta>=0?'+':'−'}${fmt(Math.abs(delta),c)}`)};
  };

  const saveBigBefore=M.saveBig;
  M.saveBig=()=>{const plans={};$$('[data-big-row]').forEach(r=>{if($('[data-big-cat]',r)?.value!=='상환·지원금')return;const t=$('[data-big-target]',r)?.value;if(t)plans[t]=(plans[t]||0)+n($('[data-big-amount]',r)?.value)});saveBigBefore();Object.entries(plans).forEach(([t,v])=>{const s=M.state.settlements.find(x=>(t==='일본리보'&&x.id==='japan-revo')||(t==='한국지원'&&x.id==='korea-support')||x.title===t);if(s)s.planned=v});if(Object.keys(plans).length){M.save();M.renderAll()}};

  const bindBefore=M.bind;
  M.bind=()=>{bindBefore();$('[data-month-end-reconcile]')?.addEventListener('click',()=>M.openMonthEndReconcile('JPY'))};
  M.renderAll();
})();