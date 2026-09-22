(function () {
  'use strict';
  const R=window.TripLogSyncRepository,M=window.TripLogSyncModel,C=window.TripLog.sync.controller;
  let current;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;return node;};
  function unmount(){current?.unsubscribe?.();current=null;}
  async function mount(parent,tripId){
    if(current?.tripId===tripId&&parent.contains(current.form))return;
    unmount();parent.replaceChildren();
    const form=el('form');form.id='triplogCommentForm';form.className='sync-comment-form';
    const label=el('label','대상 일정');label.htmlFor='triplogCommentTarget';
    const target=el('select');target.id='triplogCommentTarget';
    const textLabel=el('label','동행에게 남길 댓글');textLabel.htmlFor='triplogCommentText';
    const input=el('textarea');input.id='triplogCommentText';input.maxLength=3000;input.rows=3;
    const submit=el('button','댓글 남기기');submit.type='submit';submit.className='rd-button';
    const ownerLabel=el('label','일정 담당자');ownerLabel.htmlFor='triplogAssignee';
    const assignee=el('select');assignee.id='triplogAssignee';
    const assign=el('button','담당자 지정');assign.type='button';assign.className='rd-button';
    const message=el('p');message.setAttribute('role','status');
    const list=el('div');list.setAttribute('aria-live','polite');
    form.append(label,target,textLabel,input,submit,ownerLabel,assignee,assign,message);parent.append(form,list);
    const ctx={tripId,form,members:[],busy:false};current=ctx;
    async function action(fn){if(ctx.busy)return;ctx.busy=true;try{await fn();message.textContent='기기에 보관했습니다. 자동으로 공유합니다.';}catch(error){message.textContent=error.message;}finally{ctx.busy=false;}}
    const option=(value,text)=>{const node=el('option',text);node.value=value;return node;};
    function updateAssignee(record){const item=record.snapshot.itineraryItems?.find(i=>i.id===target.value);if(!ctx.assignmentBase)assignee.value=item?.assigneeId||'';assign.disabled=!item||record.role==='viewer'||Boolean(record.archivedAt);}
    async function render(){
      const record=await R.read(tripId);if(current!==ctx||!record)return;
      const selected=target.value;
      target.replaceChildren(option('','여행 전체'),...(record.snapshot.itineraryItems||[]).map(i=>option(i.id,`${i.date||''} · ${i.place||'장소 미정'}`)));
      if([...target.options].some(o=>o.value===selected))target.value=selected;
      const disabled=record.role==='viewer'||Boolean(record.archivedAt)||record.snapshot.collaboration?.privacy?.shareItinerary===false;
      submit.disabled=input.disabled=disabled;updateAssignee(record);if(disabled)assign.disabled=true;
      const entities=M.apply(record.base||{},record.queue.flatMap(q=>q.patches)).entities;
      list.replaceChildren();
      const rows=Object.values(entities).filter(e=>e.kind==='comment'&&!e.deleted).sort((a,b)=>String(a.fields['p:createdAt']||'~').localeCompare(String(b.fields['p:createdAt']||'~'))||a.id.localeCompare(b.id));
      if(!rows.length)list.append(el('p','아직 댓글이 없습니다.'));
      for(const row of rows){
        const card=el('section');card.className='sync-conflict';
        const author=row.fields['p:authorId'];const member=ctx.members.find(m=>m.user_id===author);
        const item=record.snapshot.itineraryItems?.find(i=>i.id===row.fields['p:targetId']);
        card.append(el('strong',author===C.engine.status().accountId?'나':member?.display_name||'동행'),el('p',row.fields['p:createdAt']?new Date(row.fields['p:createdAt']).toLocaleString('ko-KR'):'서버 확인 대기'),el('p',item?.place||(row.fields['p:targetId']?'보관·삭제된 일정':'여행 전체')),el('p',row.fields['p:body']));
        if(!disabled&&(!author||author===C.engine.status().accountId||record.role==='owner')){
          const remove=el('button','댓글 삭제');remove.className='rd-button';remove.type='button';
          remove.addEventListener('click',()=>action(async()=>{
            const fresh=await R.read(tripId);const entity=M.apply(fresh.base||{},fresh.queue.flatMap(q=>q.patches)).entities[M.key('comment',row.id)];
            await R.enqueue(tripId,[{kind:'comment',id:row.id,action:'delete',before:entity.fields,expectedVersion:entity.version||0}]);
          }));card.append(remove);
        }
        list.append(card);
      }
    }
    form.addEventListener('submit',event=>{event.preventDefault();const body=input.value.trim();if(!body)return;action(async()=>{await R.enqueue(tripId,[{kind:'comment',id:M.uuid(),action:'create',before:null,expectedVersion:0,fields:{'p:body':body,'p:targetId':target.value}}]);if(current===ctx)input.value='';});});
    target.addEventListener('change',()=>{ctx.assignmentBase=null;const record=R.cached(tripId);if(record)updateAssignee(record);});
    assignee.addEventListener('focus',()=>{ctx.assignmentBase=R.cached(tripId)?.snapshot;});
    assign.addEventListener('click',()=>action(async()=>{
      const record=await R.read(tripId),before=ctx.assignmentBase||record.snapshot,next=M.clone(before),item=next.itineraryItems.find(i=>i.id===target.value);
      if(!item)throw new Error('담당자를 지정할 일정을 선택해 주세요.');
      item.assigneeId=assignee.value;await R.save(next,before);ctx.assignmentBase=null;
    }));
    ctx.unsubscribe=R.subscribe(id=>{if(id===tripId)render().catch(()=>{});});
    try{ctx.members=(await C.request('members',tripId)).members;}catch(_){/* Cached comments remain readable offline. */}
    if(current!==ctx)return;
    assignee.append(option('','미지정'),...ctx.members.map(m=>option(m.user_id,m.display_name||'동행')));
    await render();
  }
  window.TripLog.register('sync.comments',{mount,unmount});
})();
