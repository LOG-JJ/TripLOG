(function(root,factory){const api=factory();root.TripLogSettlement=api;if(typeof module==='object'&&module.exports)module.exports=api;})(typeof window==='undefined'?globalThis:window,function(){
  'use strict';
  const MAX=BigInt(Number.MAX_SAFE_INTEGER);
  function money(value){if(!Number.isSafeInteger(value)||value<0)throw new Error('INVALID_SETTLEMENT_AMOUNT');return BigInt(value);}
  function number(value){if(value>MAX||value< -MAX)throw new Error('INVALID_SETTLEMENT_TOTAL');return Number(value);}
  function calculate(snapshot){
    const members=[{key:'leader',name:snapshot.settlement?.leaderName||'여행 대표',outside:0},...(snapshot.companions||[]).map(p=>({key:`companion:${p.id||p.name}`,name:p.name,outside:p.individualSpent||0}))];
    if(members.length>100||new Set(members.map(m=>m.key)).size!==members.length)throw new Error('INVALID_SETTLEMENT_MEMBERS');
    const paid=new Map(members.map(m=>[m.key,money(m.outside)])),owed=new Map(members.map(m=>[m.key,0n]));
    const rows=[];
    function equal(amount){const n=BigInt(members.length),base=amount/n,remainder=amount%n;return members.map((m,i)=>[m.key,base+(BigInt(i)<remainder?1n:0n)]);}
    for(const entry of [...(snapshot.entries||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){
      const amount=money(entry.amount),payer=entry.payerKey||'leader';
      if(!paid.has(payer))throw new Error('INVALID_SETTLEMENT_PAYER');
      const setting=snapshot.settlement?.itemSplits?.[`current:${entry.id}`];
      let shares;
      if(setting?.mode==='custom'){
        if(Object.keys(setting.shares||{}).some(key=>!paid.has(key)))throw new Error('INVALID_SETTLEMENT_MEMBER');
        shares=members.map(m=>[m.key,money(setting.shares?.[m.key]||0)]);
        if(shares.reduce((sum,pair)=>sum+pair[1],0n)!==amount)throw new Error('INVALID_SETTLEMENT_SHARES');
      }else shares=equal(amount);
      paid.set(payer,paid.get(payer)+amount);
      for(const [key,value]of shares)owed.set(key,owed.get(key)+value);
      rows.push({id:entry.id,amount:number(amount),payer,shares:Object.fromEntries(shares.map(([key,value])=>[key,number(value)]))});
    }
    for(const member of members)for(const [key,value]of equal(money(member.outside)))owed.set(key,owed.get(key)+value);
    const balances=members.map(m=>({key:m.key,name:m.name,paid:number(paid.get(m.key)),owed:number(owed.get(m.key)),balance:number(paid.get(m.key)-owed.get(m.key))}));
    if(balances.reduce((sum,m)=>sum+BigInt(m.balance),0n)!==0n)throw new Error('INVALID_SETTLEMENT_BALANCE');
    const creditors=balances.filter(m=>m.balance>0).map(m=>({key:m.key,remaining:BigInt(m.balance)}));
    const debtors=balances.filter(m=>m.balance<0).map(m=>({key:m.key,remaining:-BigInt(m.balance)}));
    const transfers=[];let i=0,j=0;
    while(i<debtors.length&&j<creditors.length){const d=debtors[i],c=creditors[j],amount=d.remaining<c.remaining?d.remaining:c.remaining;transfers.push({from:d.key,to:c.key,amount:number(amount)});d.remaining-=amount;c.remaining-=amount;if(d.remaining===0n)i++;if(c.remaining===0n)j++;}
    return {currency:'KRW',total:number([...paid.values()].reduce((sum,value)=>sum+value,0n)),members:balances,transfers,source:{members,entries:rows}};
  }
  return {calculate};
});
