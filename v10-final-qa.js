(() => {
  const M=window.MM,$=M.$,$$=M.$$,n=M.num;

  const billPresent=v=>v!==null&&v!==undefined&&v!=='';
  const cardProgress=cur=>{
    const cards=M.state.cardAccounts.filter(x=>x.active!==false&&x.currency===cur);
    const entered=cards.filter(x=>billPresent(x.monthlyBills?.[M.selectedMonth]));
    return{cards,entered,complete:cards.length>0&&entered.length===cards.length};
  };

  // Safety: never replace the monthly card FLOW with a partial card-detail sum.
  // A legitimate zero bill must be entered as 0; blank means "unknown / not entered yet".
  const applyCardCurrencyBefore=M.applyCardCurrency;
  M.applyCardCurrency=cur=>{
    const p=cardProgress(cur);
    if(!p.cards.length)return M.toast(`${cur} 활성 카드 없음`);
    if(!p.complete)return M.toast(`${cur} 카드 상세 ${p.entered.length}/${p.cards.length}장 · 전부 입력 후 FLOW 적용`);
    return applyCardCurrencyBefore(cur);
  };
  M.applyCardTotal=()=>M.applyCardCurrency('JPY');

  function guardCardApplyButtons(){
    $$('[data-apply-card-currency]').forEach(b=>{
      const cur=b.dataset.applyCardCurrency,p=cardProgress(cur);
      b.disabled=!p.complete;
      b.title=p.complete?'카드 상세합계를 FLOW에 적용':`활성 카드 ${p.cards.length}장 중 ${p.entered.length}장 입력`;
      if(!p.complete)b.textContent=`FLOW 적용 ${p.entered.length}/${p.cards.length}`;
    });
    const legacy=$('[data-apply-card-total]');
    if(legacy){
      const p=cardProgress('JPY');
      legacy.disabled=!p.complete;
      legacy.title=p.complete?'JPY 카드 상세합계를 FLOW에 적용':`활성 JPY 카드 ${p.cards.length}장 중 ${p.entered.length}장 입력`;
      if(!p.complete)legacy.textContent=`전부 입력 후 FLOW 적용 (${p.entered.length}/${p.cards.length})`;
    }
  }

  // Settlement plan is a view of this month's ledger, not an independent stale value.
  function syncSettlementPlans(){
    const totals={일본리보:0,한국지원:0};
    M.state.ledger.filter(x=>x.month===M.selectedMonth&&x.reflect!=='미반영'&&x.category==='상환·지원금').forEach(x=>{
      if(Object.prototype.hasOwnProperty.call(totals,x.settlementTarget))totals[x.settlementTarget]+=n(x.amount);
    });
    const jp=M.state.settlements.find(x=>x.id==='japan-revo');if(jp)jp.planned=totals.일본리보;
    const kr=M.state.settlements.find(x=>x.id==='korea-support');if(kr)kr.planned=totals.한국지원;
  }

  const saveBigBefore=M.saveBig;
  M.saveBig=()=>{
    saveBigBefore();
    syncSettlementPlans();
    M.save();
    M.renderAll();
  };

  const renderFlowBefore=M.renderFlow;
  M.renderFlow=()=>{renderFlowBefore();if(M.flowTab==='big')guardCardApplyButtons()};

  M.renderAll();
})();