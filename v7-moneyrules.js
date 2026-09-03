(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num,fmt=M.fmt,safe=M.safe;

  // Fixed-cost rule: a recurring item can either hit FLOW separately or already live inside a card statement.
  M.state.fixedTemplates.forEach(x=>{x.flowMode ||= '별도차감';});
  M.state.cardAccounts.forEach(x=>{if(x.balance===undefined)x.balance=null;x.dueDay||='';});

  const moreBefore=M.renderMore;
  M.renderMore=()=>{
    moreBefore();
    const screen=$('#screen-more');if(!screen)return;

    // Card rows: add current debt/balance and due date without fabricating values.
    $$('[data-card-name]',screen).forEach(name=>{
      const i=n(name.dataset.cardName),card=M.state.cardAccounts[i],row=name.closest('.settings-row');if(!card||!row||$('[data-card-balance]',row))return;
      const bal=document.createElement('input');bal.className='input num';bal.type='number';bal.placeholder='잔액/채무 (선택)';bal.value=card.balance==null?'':n(card.balance);bal.dataset.cardBalance=String(i);
      const due=document.createElement('input');due.className='input';due.placeholder='납부일 (선택)';due.value=card.dueDay||'';due.dataset.cardDue=String(i);
      row.insertBefore(bal,row.lastElementChild);row.insertBefore(due,row.lastElementChild);
    });

    // Fixed rows: make double-counting semantics explicit.
    $$('[data-fix-name]',screen).forEach(name=>{
      const i=n(name.dataset.fixName),x=M.state.fixedTemplates[i],row=name.closest('.fixed-edit-row');if(!x||!row||$('[data-fix-mode]',row))return;
      const mode=document.createElement('select');mode.className='select';mode.dataset.fixMode=String(i);
      mode.innerHTML=`<option value="별도차감" ${x.flowMode!=='카드청구포함'?'selected':''}>별도차감</option><option value="카드청구포함" ${x.flowMode==='카드청구포함'?'selected':''}>카드청구포함</option>`;
      mode.title='카드명세에 이미 들어가면 카드청구포함';row.insertBefore(mode,row.lastElementChild);
    });

    const fixedHead=[...screen.querySelectorAll('.section-head')].find(h=>h.textContent.includes('고정비 템플릿'));
    if(fixedHead&&!$('.double-count-note',screen))fixedHead.insertAdjacentHTML('afterend','<div class="notice-box double-count-note">카드 자동결제 구독은 <b>카드청구포함</b>으로 두면 카드값에만 반영되고 고정비로 다시 빠지지 않습니다.</div>');
  };

  // Only separately deducted recurring costs become ledger fixed outflows.
  M.applyFixed=()=>{
    const oldFixed=new Set(M.state.ledger.map((x,i)=>({x,i})).filter(({x})=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&x.category==='고정비').map(v=>v.i));
    M.state.ledger=M.state.ledger.filter((_,i)=>!oldFixed.has(i));
    M.state.ledger.push(...M.state.fixedTemplates.filter(x=>x.active!==false&&n(x.amount)>0&&x.flowMode!=='카드청구포함').map(x=>({month:M.selectedMonth,date:'',currency:x.currency,category:'고정비',item:x.name,amount:n(x.amount),reflect:'반영',status:'예정',workMonth:'',payMonth:M.selectedMonth,linkId:'',memo:'템플릿 적용',cashMode:'',settlementTarget:''})));
    M.recalcMonth();M.flowTab='big';M.renderAll();M.toast('별도차감 고정비만 FLOW 적용');
  };

  const bindBefore=M.bind;
  M.bind=()=>{
    bindBefore();
    const saveCards=$('[data-save-cards]');if(saveCards)saveCards.onclick=()=>{
      $$('[data-card-name]').forEach(x=>M.state.cardAccounts[n(x.dataset.cardName)].name=x.value);
      $$('[data-card-cur]').forEach(x=>M.state.cardAccounts[n(x.dataset.cardCur)].currency=x.value);
      $$('[data-card-balance]').forEach(x=>{const v=x.value.trim();M.state.cardAccounts[n(x.dataset.cardBalance)].balance=v===''?null:n(v)});
      $$('[data-card-due]').forEach(x=>M.state.cardAccounts[n(x.dataset.cardDue)].dueDay=x.value.trim());
      M.save();M.renderMore();M.bind();M.toast('카드 설정 저장');
    };
    const saveFixed=$('[data-save-fixed]');if(saveFixed)saveFixed.onclick=()=>{
      $$('[data-fix-name]').forEach(x=>M.state.fixedTemplates[n(x.dataset.fixName)].name=x.value);
      $$('[data-fix-cur]').forEach(x=>M.state.fixedTemplates[n(x.dataset.fixCur)].currency=x.value);
      $$('[data-fix-amt]').forEach(x=>M.state.fixedTemplates[n(x.dataset.fixAmt)].amount=n(x.value));
      $$('[data-fix-mode]').forEach(x=>M.state.fixedTemplates[n(x.dataset.fixMode)].flowMode=x.value);
      M.save();M.renderMore();M.bind();M.toast('고정비 템플릿 저장');
    };
  };

  M.save();M.renderAll();
})();