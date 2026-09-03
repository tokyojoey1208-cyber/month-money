(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num,fmt=M.fmt,safe=M.safe;
  const DIRECT_CHANNELS=['계좌이체','현금','송금','기타'];
  const BIG_CATS=['카드청구','고정비','기타지출','상환·지원금'];

  // Local calendar date: toISOString() is UTC and can be one day behind in Japan before 09:00.
  M.localDateString=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  M.today=()=>M.localDateString();
  M.thisMonth=()=>M.today().slice(0,7);

  M.isDirectOut=x=>x?.category==='기타지출'&&DIRECT_CHANNELS.includes(x?.cashMode);
  M.isBigOut=x=>['카드청구','고정비','상환·지원금'].includes(x?.category)||(x?.category==='기타지출'&&!M.isDirectOut(x));
  M.bigOutRows=(m=M.selectedMonth)=>M.ledgerRows(m).filter(M.isBigOut);

  const rowTemplate=({category='기타지출',currency='JPY',item='미입력',amount=0,status='예정',date='',cashMode='',settlementTarget=''})=>({month:M.selectedMonth,date,currency,category,item,amount,reflect:'반영',status,workMonth:'',payMonth:M.selectedMonth,linkId:'',memo:'',cashMode,settlementTarget});

  // --- HOME: consolidated value without destroying original currencies ---
  const homeBefore=M.renderHome;
  M.renderHome=()=>{
    homeBefore();
    const grid=$('#screen-home .currency-grid');
    if(!grid||$('#portfolioTotal'))return;
    let flowTotal=0,actualTotal=0;const missing=[];
    ['JPY','KRW','USD'].forEach(c=>{
      const f=M.flow(c).end,fa=M.toJpy(f,c),a=M.state.actualBalances?.[c]?.amount??M.state.settings.startBalances[c],aa=M.toJpy(a,c);
      if(fa==null||aa==null){if(c!=='JPY')missing.push(c)} else {flowTotal+=fa;actualTotal+=aa}
    });
    const card=document.createElement('article');
    card.id='portfolioTotal';card.className='card portfolio-total';
    card.innerHTML=`<div class="card-title"><div><p class="eyebrow">ALL CURRENCY</p><h3>${missing.length?'환산 가능한 총 운용가치':'총 운용가치'}</h3></div><span class="tag">JPY VIEW</span></div><div class="amount">${fmt(flowTotal,'JPY')}</div><div class="line"><span>월말 FLOW 환산</span><strong>${fmt(flowTotal,'JPY')}</strong></div><div class="line"><span>마지막 실제잔고 환산</span><strong>${fmt(actualTotal,'JPY')}</strong></div><div class="muted">원통화 잔액은 위 카드가 기준${missing.length?` · ${missing.join('/')} 환율 미등록분 제외`:''}</div>`;
    grid.insertAdjacentElement('afterend',card);
  };

  // --- BIG MONEY: preserve irregular cash/transfer rows and settlement metadata ---
  const flowBefore=M.renderFlow;
  function bigLedgerIndices(){return M.state.ledger.map((x,i)=>({x,i})).filter(({x})=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&M.isBigOut(x)).map(x=>x.i)}
  function configureBigRow(r,x){
    const cat=$('[data-big-cat]',r)?.value||x?.category||'고정비';
    let mode=$('[data-big-channel]',r);
    if(!mode){mode=document.createElement('select');mode.className='select';mode.dataset.bigChannel='';r.insertBefore(mode,r.lastElementChild)}
    mode.hidden=false;mode.disabled=false;
    const oldTarget=$('[data-big-target]',r);if(oldTarget)oldTarget.remove();
    if(cat==='상환·지원금'){
      const cm=x?.cashMode||'예약차감';
      mode.innerHTML=`<option value="예약차감" ${cm==='예약차감'?'selected':''}>예약차감</option><option value="카드청구포함" ${cm==='카드청구포함'?'selected':''}>카드청구포함</option>`;
      const target=document.createElement('select');target.className='select';target.dataset.bigTarget='';
      const tv=x?.settlementTarget||'';target.innerHTML=`<option value="">대상 선택</option><option ${tv==='일본리보'?'selected':''}>일본리보</option><option ${tv==='한국지원'?'selected':''}>한국지원</option><option ${tv==='기타'?'selected':''}>기타</option>`;
      r.insertBefore(target,r.lastElementChild);
    }else if(cat==='기타지출'){
      mode.innerHTML='<option value="큰지출">큰 지출</option>';
    }else{
      mode.innerHTML='<option value="">FLOW</option>';mode.hidden=true;mode.disabled=true;
    }
  }
  function enhanceBig(){
    const rows=M.bigOutRows();
    $$('[data-big-row]').forEach((r,i)=>{
      const x=rows[i]||null,idx=x?M.state.ledger.indexOf(x):-1;r.dataset.ledgerIndex=String(idx);
      configureBigRow(r,x);
      const cat=$('[data-big-cat]',r);if(cat)cat.onchange=()=>configureBigRow(r,{...x,category:cat.value,cashMode:'',settlementTarget:x?.settlementTarget||''});
    });
    const card=$('[data-save-card-detail]')?.closest('.card');
    if(card&&!$('.multi-card-summary',card)){
      const box=document.createElement('div');box.className='multi-card-summary';
      const parts=['JPY','KRW','USD'].map(cur=>{const cards=M.state.cardAccounts.filter(c=>c.active!==false&&c.currency===cur),vals=cards.map(c=>c.monthlyBills?.[M.selectedMonth]).filter(v=>v!==null&&v!==undefined&&v!=='');if(!vals.length)return'';const total=vals.reduce((a,b)=>a+n(b),0);return`<div class="line"><span>${cur} 카드 상세합계</span><strong>${fmt(total,cur)}</strong><button class="mini-link" data-apply-card-currency="${cur}">FLOW 적용</button></div>`}).join('');
      box.innerHTML=parts||'<div class="muted">카드사별 청구액을 입력하면 통화별 합계를 FLOW에 적용할 수 있습니다.</div>';
      card.appendChild(box);
    }
  }
  function enhanceLinkedFx(){
    $$('[data-irregular-row]').forEach(r=>{
      const x=M.state.ledger[n(r.dataset.irregularRow)];if(!x?.linkId?.startsWith('FX:'))return;
      r.classList.add('linked-fx-row');
      const cat=$('[data-ir-cat]',r),cur=$('[data-ir-cur]',r),method=$('[data-ir-method]',r);if(cat)cat.disabled=true;if(cur)cur.disabled=true;if(method)method.hidden=true;
      if(!$('.linked-fx-badge',r)){const b=document.createElement('span');b.className='linked-fx-badge';b.textContent='연결 환전';r.insertBefore(b,r.lastElementChild)}
    })
  }
  M.renderFlow=()=>{flowBefore();if(M.flowTab==='big')enhanceBig();if(M.flowTab==='reconcile')enhanceLinkedFx()};

  M.saveBig=()=>{
    const oldBig=new Set(bigLedgerIndices()),keep=M.state.ledger.filter((_,i)=>!oldBig.has(i));
    const rows=$$('[data-big-row]').map(r=>{
      const idx=n(r.dataset.ledgerIndex),old=idx>=0?M.state.ledger[idx]:null,cat=$('[data-big-cat]',r).value;
      const out=old?M.clone(old):rowTemplate({category:cat});
      Object.assign(out,{month:M.selectedMonth,payMonth:M.selectedMonth,currency:$('[data-big-currency]',r).value,category:cat,item:$('[data-big-item]',r).value.trim()||'미입력',amount:n($('[data-big-amount]',r).value),reflect:'반영',status:$('[data-big-status]',r).value});
      if(cat==='상환·지원금'){out.cashMode=$('[data-big-channel]',r)?.value||old?.cashMode||'예약차감';out.settlementTarget=$('[data-big-target]',r)?.value||old?.settlementTarget||''}
      else if(cat==='기타지출'){out.cashMode='큰지출';out.settlementTarget=''}
      else{out.cashMode='';out.settlementTarget=''}
      return out;
    });
    M.state.ledger=[...keep,...rows];M.recalcMonth();M.flowTab='big';M.renderAll();M.toast('이번 달 큰돈 저장');
  };
  M.copyPrevBig=()=>{
    const prev=M.monthOffset(M.selectedMonth,-1),src=M.bigOutRows(prev);if(!src.length)return M.toast('전월 큰 지출 없음');
    const oldBig=new Set(bigLedgerIndices());M.state.ledger=M.state.ledger.filter((_,i)=>!oldBig.has(i));
    M.state.ledger.push(...src.map(x=>({...M.clone(x),month:M.selectedMonth,payMonth:M.selectedMonth,date:'',status:'예정',linkId:'',memo:'전월 큰돈 복사'})));
    M.recalcMonth();M.flowTab='big';M.renderAll();M.toast('전월 큰 지출 복사');
  };
  M.applyFixed=()=>{
    const oldFixed=new Set(M.state.ledger.map((x,i)=>({x,i})).filter(({x})=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&x.category==='고정비').map(v=>v.i));
    M.state.ledger=M.state.ledger.filter((_,i)=>!oldFixed.has(i));
    M.state.ledger.push(...M.state.fixedTemplates.filter(x=>x.active!==false&&n(x.amount)>0).map(x=>rowTemplate({category:'고정비',currency:x.currency,item:x.name,amount:n(x.amount),status:'예정'})));
    M.recalcMonth();M.flowTab='big';M.renderAll();M.toast('고정비 템플릿 적용');
  };
  M.applyCardCurrency=cur=>{
    const vals=M.state.cardAccounts.filter(x=>x.active!==false&&x.currency===cur).map(x=>x.monthlyBills?.[M.selectedMonth]).filter(v=>v!==null&&v!==undefined&&v!=='');if(!vals.length)return M.toast(`${cur} 카드값 미입력`);
    const total=vals.reduce((a,b)=>a+n(b),0),rows=M.state.ledger.filter(x=>x.month===M.selectedMonth&&x.currency===cur&&x.category==='카드청구');
    if(rows.length){rows[0].amount=total;rows[0].reflect='반영';rows.slice(1).forEach(x=>x.reflect='미반영')}else M.state.ledger.push(rowTemplate({category:'카드청구',currency:cur,item:'카드사별 청구 합계',amount:total,status:'예정'}));
    M.recalcMonth();M.flowTab='big';M.renderAll();M.toast(`${cur} 카드 상세합계 적용`);
  };

  // FX rows are one transfer. Never leave an orphan side by deleting just one row.
  M.deleteIrregular=i=>{
    const x=M.state.ledger[n(i)];if(!x)return;
    if(x.linkId?.startsWith('FX:')){const id=x.linkId;M.state.ledger=M.state.ledger.filter(r=>r.linkId!==id);M.toast('환전 양쪽 삭제')}
    else{M.state.ledger.splice(n(i),1);M.toast('삭제')}
    M.recalcMonth();M.flowTab='reconcile';M.renderAll();
  };
  M.saveIrregular=()=>{
    const sharedFx=new Map();
    $$('[data-irregular-row]').forEach(r=>{
      const x=M.state.ledger[n(r.dataset.irregularRow)];if(!x)return;
      const linked=x.linkId?.startsWith('FX:');
      if(!linked){x.category=$('[data-ir-cat]',r).value;x.currency=$('[data-ir-cur]',r).value;x.cashMode=$('[data-ir-method]',r)?.value||''}
      x.item=$('[data-ir-item]',r).value.trim()||x.item;x.amount=n($('[data-ir-amt]',r).value);x.status=$('[data-ir-status]',r).value;
      if(linked&&!sharedFx.has(x.linkId))sharedFx.set(x.linkId,{item:x.item,status:x.status});
    });
    sharedFx.forEach((v,id)=>M.state.ledger.filter(x=>x.linkId===id).forEach(x=>{x.item=v.item;x.status=v.status}));
    M.recalcMonth();M.flowTab='reconcile';M.renderAll();M.toast('예외 입력 저장');
  };

  // --- MAIN: copy should advance work month, status must be editable, templates must be maintainable ---
  const incomeBefore=M.renderIncome;
  function enhanceMain(){
    $$('[data-salary]').forEach(box=>{
      const id=box.dataset.salary,s=M.state.salaries.find(x=>x.id===id),details=$('.details',box);if(!s||!details)return;
      const grid=$('.field-grid.three',details);if(grid&&!$('[data-salary-status]',grid))grid.insertAdjacentHTML('beforeend',`<div class="field"><label>상태</label><select class="select" data-salary-status><option ${s.status==='예정'?'selected':''}>예정</option><option ${s.status==='확정'?'selected':''}>확정</option></select></div>`);
      const actions=[...details.querySelectorAll('.btn-row')].at(-1);if(actions&&!$('[data-save-main-template]',actions))actions.insertAdjacentHTML('beforeend',`<button class="btn ghost" data-save-main-template="${safe(id)}">기본 템플릿으로 저장</button>`);
    })
  }
  M.renderIncome=()=>{incomeBefore();if(M.incomeTab==='main')enhanceMain()};
  M.newSalary=(mode,id)=>{
    let s;
    if(id){s=M.clone(M.state.salaries.find(x=>x.id===id)||{});if(!s.id)return M.toast('복사할 명세 없음')}
    else if(mode==='copy'){
      const candidates=[...M.state.salaries].filter(x=>x.payMonth<M.selectedMonth).sort((a,b)=>String(b.payDate).localeCompare(String(a.payDate)));
      s=M.clone(candidates[0]||[...M.state.salaries].sort((a,b)=>String(b.payDate).localeCompare(String(a.payDate)))[0]||{});if(!s.id)return M.toast('복사할 명세 없음');
    }else if(mode==='template'){
      const t=M.state.templates.find(x=>x.area==='MAIN'&&x.active!==false)||M.state.templates.find(x=>x.area==='MAIN');if(!t)return M.toast('템플릿 없음');
      s={id:M.uid('salary'),payMonth:M.selectedMonth,workMonth:M.monthOffset(M.selectedMonth,-1),payDate:`${M.selectedMonth}-25`,type:t.type||'급여',status:'예정',templateId:t.id,items:M.clone(t.items||[])};M.state.salaries.unshift(s);M.save();M.renderIncome();M.bind();return M.toast('템플릿 명세 생성');
    }else s={id:M.uid('salary'),payMonth:M.selectedMonth,workMonth:M.monthOffset(M.selectedMonth,-1),payDate:`${M.selectedMonth}-25`,type:'급여',status:'예정',templateId:'',items:[{kind:'지급',name:'기본급',amount:0,order:1}]};
    if(mode==='copy'||id){s.id=M.uid('salary');s.payMonth=M.selectedMonth;s.workMonth=M.monthOffset(M.selectedMonth,-1);s.payDate=`${M.selectedMonth}-25`;s.status='예정'}
    M.state.salaries.unshift(s);M.save();M.renderIncome();M.bind();M.toast('명세 생성');
  };
  const saveSalaryBefore=M.saveSalary;
  M.saveSalary=id=>{const box=$(`[data-salary="${CSS.escape(id)}"]`),s=M.state.salaries.find(x=>x.id===id);if(s&&box){const st=$('[data-salary-status]',box);if(st)s.status=st.value}saveSalaryBefore(id)};
  M.saveMainTemplate=id=>{
    const s=M.state.salaries.find(x=>x.id===id);if(!s)return;
    let t=M.state.templates.find(x=>x.area==='MAIN');
    if(!t){t={id:'salary-default',area:'MAIN',name:'기본 급여',currency:'JPY',type:s.type,active:true,items:[]};M.state.templates.push(t)}
    t.type=s.type;t.active=true;t.items=M.clone(s.items||[]);M.save();M.toast('현재 명세를 기본 템플릿으로 저장');
  };

  // --- SEED: annual target belongs to a year; add/copy years instead of hard-coding 2027 only ---
  M.state.seed.annualGoals||={};
  if(M.state.seed.annualGoal&&!Object.keys(M.state.seed.annualGoals).length){const y=(M.state.seed.planStart||M.selectedMonth).slice(0,4);M.state.seed.annualGoals[y]=n(M.state.seed.annualGoal)}
  const seedBefore=M.renderSeed;
  M.renderSeed=()=>{
    const year=M.seedYear||(M.state.seed.planStart||M.selectedMonth).slice(0,4);M.state.seed.annualGoal=n(M.state.seed.annualGoals[year]);
    seedBefore();
    const head=$('#screen-seed .section-head');if(head&&!$('[data-seed-add-year]'))head.insertAdjacentHTML('beforebegin',`<div class="btn-row seed-year-actions"><button class="btn ghost" data-seed-add-year>＋ 다음 연도 추가</button><button class="btn ghost" data-seed-copy-year>⧉ 다음 연도 목표 복사</button></div>`);
  };
  M.addSeedYear=copy=>{
    const cur=Number(M.seedYear||(M.state.seed.planStart||M.selectedMonth).slice(0,4)),next=String(cur+1),exists=M.state.seed.rows.some(r=>r.month.startsWith(next));
    if(!exists){for(let mo=1;mo<=12;mo++){const mm=String(mo).padStart(2,'0'),prev=M.state.seed.rows.find(r=>r.month===`${cur}-${mm}`);M.state.seed.rows.push({month:`${next}-${mm}`,active:`${next}-${mm}`>=M.state.seed.planStart,currency:M.state.seed.targetCurrency,target:copy?n(prev?.target):0,actual:0})}}
    if(copy)M.state.seed.annualGoals[next]=n(M.state.seed.annualGoals[String(cur)]);else M.state.seed.annualGoals[next]??=0;
    M.state.seed.rows.sort((a,b)=>a.month.localeCompare(b.month));M.seedYear=next;M.state.seed.annualGoal=n(M.state.seed.annualGoals[next]);M.save();M.renderSeed();M.bind();M.toast(copy?'다음 연도 목표 복사':'다음 연도 추가');
  };

  // Bind after all previous layers so our safety handlers win.
  const bindBefore=M.bind;
  M.bind=()=>{
    bindBefore();
    $$('[data-big-cat]').forEach(x=>x.onchange=()=>configureBigRow(x.closest('[data-big-row]'),M.state.ledger[n(x.closest('[data-big-row]').dataset.ledgerIndex)]));
    $$('[data-apply-card-currency]').forEach(b=>b.onclick=()=>M.applyCardCurrency(b.dataset.applyCardCurrency));
    $$('[data-save-main-template]').forEach(b=>b.onclick=()=>M.saveMainTemplate(b.dataset.saveMainTemplate));
    const annual=$('[data-seed-annual]');if(annual)annual.onchange=e=>{const y=M.seedYear||(M.state.seed.planStart||M.selectedMonth).slice(0,4);M.state.seed.annualGoals[y]=n(e.target.value);M.state.seed.annualGoal=n(e.target.value);M.save();M.renderSeed();M.bind()};
    $('[data-seed-add-year]')?.addEventListener('click',()=>M.addSeedYear(false));$('[data-seed-copy-year]')?.addEventListener('click',()=>M.addSeedYear(true));
  };

  M.save();M.renderAll();
})();