import { normalized } from './context.mjs';
import { el, button, field, modal } from './ui.mjs';

export function paragraphPosition(blocks, selected, onSelect) {
    const root=el('section','ap2-anchor'),heading=el('div','ap2-anchor-heading'),label=el('strong'),excerpt=el('blockquote','ap2-excerpt');
    const show=()=>{label.textContent=`삽입 위치 · ${selected}번 문단 뒤`;excerpt.textContent=blocks.find(b=>b.index===selected)?.content??'';};
    heading.append(label,button('변경',()=>{
        const {dialog,body}=modal('삽입 위치');dialog.classList.add('ap2-paragraph-picker');
        const search=field('본문 검색','',{type:'search',placeholder:'단어나 문장을 입력하세요'}),count=el('p','ap2-muted'),list=el('div','ap2-paragraph-list'),pages=el('div','ap2-actions');
        search.wrap.classList.add('ap2-field-wide');count.setAttribute('role','status');list.setAttribute('aria-label','본문 문단');
        body.append(search.wrap,count,list,pages);let page=0;
        function render(){
            const query=normalized(search.read()).toLocaleLowerCase(),matches=blocks.filter(b=>!query||normalized(b.content).toLocaleLowerCase().includes(query)),size=20;
            count.textContent=`전체 ${blocks.length}문단 · ${matches.length}개 일치`;list.replaceChildren();pages.replaceChildren();
            if(!matches.length)list.append(el('p','ap2-empty','일치하는 문단이 없습니다.'));
            for(const b of matches.slice(page*size,(page+1)*size)){
                const choice=el('button','ap2-paragraph-choice');choice.type='button';choice.setAttribute('aria-pressed',String(selected===b.index));
                choice.append(el('strong','',`${b.index}번 문단${b.index===selected?' · 현재 위치':''}`),el('span','',b.content));
                choice.addEventListener('click',()=>{selected=b.index;onSelect(b.index);show();dialog.close();});list.append(choice);
            }
            if(matches.length>size){
                const prev=button('이전',()=>{page--;render();}),next=button('다음',()=>{page++;render();});prev.disabled=page===0;next.disabled=(page+1)*size>=matches.length;
                pages.append(prev,el('span','ap2-muted',`${page+1} / ${Math.ceil(matches.length/size)}`),next);
            }
            list.scrollTop=0;
        }
        search.input.addEventListener('input',()=>{page=0;render();});render();search.input.focus();
    }));
    root.append(heading,excerpt);show();return root;
}
