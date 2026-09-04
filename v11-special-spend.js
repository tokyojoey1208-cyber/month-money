(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num,fmt=M.fmt,safe=M.safe;
  const CARD_INCLUDED='카드청구포함',SEPARATE='별도차감';
  const isSpecial=x=>x?.category==='기타지출'&&!M.isDirectOut?.(x);
  const specialRows=(m=M.selectedMonth,c=null)=>M.state.ledger.filter(x=>x.month===m&&x.reflect!=='미반영'&&isSpecial(x)&&(!c||x.currency===c));
  const includedSpecial=(m=M.selectedMonth,c=null)=>specialRows(m,c).filter(x=>x.cashMode===CARD_INCLUDED);

  // 기타지출 중 카드명세에 이미 포함된 특수지출은 분석에는 남기되 FLOW에서 다시 빼지 않는다.
  M.flow=(c,m=M.selectedMonth)=>{
    const startMonth=M.state.settings.startMonth||M.thisMonth(),stored=M.state.flow?.[m]?.[c]||{},rows=M.state.ledger.filter(x=>x.month===m&&x.reflect!=='미반영'&&x.currency===c),sum=cat=>rows.filter(x=>x.category===cat).reduce((a,b)=>a+n(b.amount),0);
    let start;if(m===startMonth)start=n(M.state.settings.startBalances[c]);else if(m>startMonth)start=M.flow(c,M.monthOffset(m,-1)).end;else start=('start'in stored)?n(stored.start):0;
    const otherOut=rows.filter(x=>x.category==='기타지출'&&x.cashMode!==CARD_INCLUDED).reduce((a,b)=>a+n(b.amount),0);
    const x={start,main:sum('본업수입'),side:sum('부업수입'),otherIn:sum('기타수입'),card:sum('카드청구'),fixed:sum('고정비'),otherOut,settlement:rows.filter(x=>x.category==='상환·지원금'&&x.cashMode!==CARD_INCLUDED).reduce((a,b)=>a+n(b.amount),0),fxIn:sum('환전유입'),fxOut:sum('환전유출'),adjust:sum('잔고보정')};
    x.end=x.start+x.main+x.side+x.otherIn-x.card-x.fixed-x.otherOut-x.settlement+x.fxIn-x.fxOut+x.adjust;return x;
  };

  function modeOf(x){return x?.cashMode===CARD_INCLUDED?CARD_INCLUDED:SEPARATE}
  function decorateSpecialRows(){
    $$('[data-big-row]').forEach(r=>{
      const cat=$('[data-big-cat]',r);if(!cat)return;
      [...cat.options].forEach(o=>{if(o.value==='기타지출'||o.textContent==='기타지출'){o.value='기타지출';o.textContent='특수지출'}});
      if(!cat.dataset.specialHook){const prev=cat.onchange;cat.onchange=e=>{prev?.call(cat,e);setTimeout(decorateSpecialRows,0)};cat.dataset.specialHook='1'}
      r.querySelector('.special-mode-chip')?.remove();
      if(cat.value!=='기타지출')return;
      const idx=Number(r.dataset.ledgerIndex),old=Number.isInteger(idx)&&idx>=0?M.state.ledger[idx]:null,mode=$('[data-big-channel]',r);if(!mode)return;
      const current=[CARD_INCLUDED,SEPARATE].includes(mode.value)?mode.value:modeOf(old);
      mode.hidden=false;mode.disabled=false;mode.innerHTML=`<option value="${SEPARATE}" ${current===SEPARATE?'selected':''}>별도차감</option><option value="${CARD_INCLUDED}" ${current===CARD_INCLUDED?'selected':''}>카드청구포함 · 분석만</option>`;
      const chip=document.createElement('span');chip.className='special-mode-chip included-chip';chip.textContent=current===CARD_INCLUDED?'카드포함 · 추가차감 0':'별도차감';r.insertBefore(chip,r.lastElementChild);
      mode.onchange=()=>{chip.textContent=mode.value===CARD_INCLUDED?'카드포함 · 추가차감 0':'별도차감'};
    });
  }

  function syncSettlementPlans(){
    const totals={일본리보:0,한국지원:0};M.state.ledger.filter(x=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&x.category==='상환·지원금').forEach(x=>{if(Object.prototype.hasOwnProperty.call(totals,x.settlementTarget))totals[x.settlementTarget]+=n(x.amount)});
    const jp=M.state.settlements.find(x=>x.id==='japan-revo');if(jp)jp.planned=totals.일본리보;const kr=M.state.settlements.find(x=>x.id==='korea-support');if(kr)kr.planned=totals.한국지원;
  }

  // 마지막 저장 레이어: 특수지출의 카드포함/별도차감 메타를 보존한다.
  M.saveBig=()=>{
    const oldBig=new Set(M.state.ledger.map((x,i)=>({x,i})).filter(({x})=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&M.isBigOut(x)).map(v=>v.i)),keep=M.state.ledger.filter((_,i)=>!oldBig.has(i));
    const rows=$$('[data-big-row]').map(r=>{const idx=Number(r.dataset.ledgerIndex),old=Number.isInteger(idx)&&idx>=0?M.state.ledger[idx]:null,cat=$('[data-big-cat]',r).value,out=old?M.clone(old):{month:M.selectedMonth,date:'',currency:'JPY',category:cat,item:'',amount:0,reflect:'반영',status:'예정',workMonth:'',payMonth:M.selectedMonth,linkId:'',memo:'',cashMode:'',settlementTarget:''};Object.assign(out,{month:M.selectedMonth,payMonth:M.selectedMonth,currency:$('[data-big-currency]',r).value,category:cat,item:$('[data-big-item]',r).value.trim()||'미입력',amount:n($('[data-big-amount]',r).value),reflect:'반영',status:$('[data-big-status]',r).value});if(cat==='상환·지원금'){out.cashMode=$('[data-big-channel]',r)?.value||old?.cashMode||'예약차감';out.settlementTarget=$('[data-big-target]',r)?.value||old?.settlementTarget||''}else if(cat==='기타지출'){out.cashMode=$('[data-big-channel]',r)?.value||modeOf(old);out.settlementTarget=''}else{out.cashMode='';out.settlementTarget=''}return out});
    M.state.ledger=[...keep,...rows];syncSettlementPlans();M.recalcMonth();M.flowTab='big';M.renderAll();M.toast('이번 달 큰돈 저장');
  };

  M.openSpecialSpend=(currency='JPY')=>{
    M.openSheet(`<h2 class="sheet-title">특수지출</h2><p class="sheet-copy">갱신비·보험·회비처럼 “이번 달 왜 비싸지?”를 설명하는 큰 일회성 지출. 카드에 이미 들어간 돈은 분석만 하고 다시 차감하지 않습니다.</p><div class="field-grid"><div class="field"><label>통화</label><select id="spCur" class="select">${['JPY','KRW','USD'].map(c=>`<option ${c===currency?'selected':''}>${c}</option>`).join('')}</select></div><div class="field"><label>날짜</label><input id="spDate" class="input" type="date" value="${M.today()}"></div></div><div class="field" style="margin-top:8px"><label>내용</label><input id="spItem" class="input" placeholder="예: 부동산 갱신비"></div><div class="field" style="margin-top:8px"><label>금액</label><input id="spAmt" class="input num" type="number" placeholder="0"></div><div class="field-grid" style="margin-top:8px"><div class="field"><label>FLOW 반영</label><select id="spMode" class="select"><option value="${SEPARATE}">별도차감 · 카드 밖에서 따로 지출</option><option value="${CARD_INCLUDED}">카드청구포함 · 분석만 / 추가차감 0</option></select></div><div class="field"><label>상태</label><select id="spStatus" class="select"><option>예정</option><option>확정</option></select></div></div><div class="field" style="margin-top:8px"><label>메모 (선택)</label><input id="spMemo" class="input" placeholder="자유 메모"></div><button id="spSave" class="btn lime block" style="margin-top:12px">특수지출 저장</button>`);
    $('#spSave').onclick=()=>{const date=$('#spDate').value,item=$('#spItem').value.trim(),amt=n($('#spAmt').value);if(!date)return M.toast('날짜를 입력');if(!item)return M.toast('내용을 입력');if(!amt)return M.toast('금액을 입력');const month=date.slice(0,7);M.state.ledger.push({month,date,currency:$('#spCur').value,category:'기타지출',item,amount:amt,reflect:'반영',status:$('#spStatus').value,workMonth:'',payMonth:month,linkId:'',memo:$('#spMemo').value.trim(),cashMode:$('#spMode').value,settlementTarget:''});M.selectedMonth=month;M.recalcMonth();M.closeSheet();M.flowTab='big';M.screen='flow';M.renderAll();M.toast($('#spMode').value===CARD_INCLUDED?'특수지출 저장 · 카드 안 분석용':'특수지출 저장 · 별도차감')};
  };

  function decorateQuick(){const grid=$('#sheetContent .quick-grid');if(!grid||$('[data-q-special]',grid))return;const b=document.createElement('button');b.className='quick-choice';b.dataset.qSpecial='';b.innerHTML='<b>◆ 특수지출</b><small>갱신비 · 보험 · 회비 · 카드포함 선택</small>';const wide=$('.quick-choice.wide',grid);wide?grid.insertBefore(b,wide):grid.appendChild(b);b.onclick=()=>M.openSpecialSpend('JPY')}
  const quickBefore=M.openQuickHub;M.openQuickHub=()=>{quickBefore();decorateQuick()};

  function specialAnalysis(){
    const rows=specialRows();if(!rows.length)return;
    const head=[...$('#screen-flow').querySelectorAll('.section-head')].find(x=>x.textContent.includes('이번 달 큰돈 편집'));if(!head||$('.special-analysis-card'))return;
    const totals=['JPY','KRW','USD'].map(c=>{const xs=rows.filter(x=>x.currency===c);return xs.length?`${c} ${fmt(xs.reduce((a,b)=>a+n(b.amount),0),c)}`:''}).filter(Boolean).join(' · ');
    const card=document.createElement('article');card.className='card special-analysis-card';card.innerHTML=`<div class="card-title"><div><p class="eyebrow">SPECIAL SPEND</p><h3>특수지출 · 이달 왜 비싸지?</h3></div><button class="btn ghost small" data-add-special>＋ 추가</button></div><div class="muted" style="margin-bottom:8px">${safe(totals)}</div>${rows.map(x=>`<div class="line"><span>${safe(x.item)}<br><span class="muted">${x.cashMode===CARD_INCLUDED?'카드청구포함 · 추가차감 없음':'별도차감'} · ${safe(x.status)}</span></span><strong>${fmt(x.amount,x.currency)}</strong></div>`).join('')}`;head.insertAdjacentElement('beforebegin',card);$('[data-add-special]',card).onclick=()=>M.openSpecialSpend('JPY');
  }

  function summaryInfo(){['JPY','KRW','USD'].forEach(c=>{const xs=includedSpecial(M.selectedMonth,c);if(!xs.length)return;const card=[...$('#screen-flow').querySelectorAll('.card')].find(x=>$('.eyebrow',x)?.textContent.trim()===`${c} FLOW`);if(!card||$('.special-in-card',card))return;const line=[...card.querySelectorAll('.line')].find(r=>$('span',r)?.textContent.trim()==='- 카드청구');if(!line)return;const box=document.createElement('div');box.className='included-settlement-block special-in-card';box.innerHTML=`<div class="included-title">카드청구 안 특수지출 · 분석표시</div>${xs.map(x=>`<div class="included-line"><span>↳ ${safe(x.item)}</span><strong>${fmt(x.amount,c)}</strong></div>`).join('')}<div class="included-foot">위 금액은 카드청구 총액 안에 포함 · FLOW 추가차감 0</div>`;line.insertAdjacentElement('afterend',box)})}

  const flowBefore=M.renderFlow;M.renderFlow=()=>{flowBefore();if(M.flowTab==='big'){decorateSpecialRows();specialAnalysis()}else if(M.flowTab==='summary')summaryInfo()};
  const homeBefore=M.renderHome;M.renderHome=()=>{homeBefore();specialRows().forEach(x=>{[...$('#screen-home').querySelectorAll('.line')].filter(r=>$('span',r)?.textContent.includes(x.item)).forEach(r=>{const s=$('span',r);if(s&&!s.textContent.includes('특수지출'))s.insertAdjacentHTML('beforeend',`<br><span class="muted">특수지출 · ${x.cashMode===CARD_INCLUDED?'카드포함 / 추가차감 없음':'별도차감'}</span>`)})})};

  const bindBefore=M.bind;M.bind=()=>{bindBefore();decorateSpecialRows()};
  M.recalcMonth();M.renderAll();
})();