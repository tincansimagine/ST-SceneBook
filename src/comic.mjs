import { MODELS } from '../plugin/core.mjs';
import { withoutConflicts } from './prompt-order.mjs';

// Multi-panel pages: one NovelAI picture laid out as a manga or comic page.
// Only V5 reads the sentences that describe a page and its panels well enough,
// so the mode is offered and applied on V5 alone.
export const PAGE_FORMATS=[
    ['single','삽화','보통 삽화입니다. 그릴 만한 순간마다 한 장씩, 최대 장 수 안에서 AI가 골라 그립니다. 액자와 그림 위치는 표시 탭 설정을 따릅니다.'],
    ['cuts','웹툰 컷','그릴 만한 장면마다 여러 칸이 든 세로 웹툰 한 장을 그려, 문단마다 또는 답변 아래에 이어 보여 줍니다. 장 수는 최대 장 수 안에서 AI가 정합니다.'],
    ['manga','흑백 만화','먹선과 검은 그림자의 흑백 만화 페이지로 그립니다.'],
    ['comic','컬러 만화','칸이 나뉜 컬러 만화 페이지로 그립니다.'],
    ['webtoon','세로 웹툰','위에서 아래로 이어지는 세로 웹툰 칸으로 그립니다.'],
];
export const PANEL_COUNTS=[[0,'자동'],[2,'2칸'],[3,'3칸'],[4,'4칸']];
// Pictures per reply, for ordinary pictures and cuts alike: a ceiling, under which the AI draws only what is worth showing.
export const SCENE_COUNTS=[1,2,3,4,5,6];
// Where cuts go: each after the paragraph it shows, like a film cut into the story, or all below the reply as one strip.
export const CUT_LAYOUTS=[['story','문단마다'],['stack','답변 아래 이어서']];
const PAGE_KINDS=['manga','comic','webtoon'];
const WORDS=['','one','two','three','four','five','six'],ORDER=['First','Second','Third','Fourth','Fifth','Sixth'];
export const pagesAllowed=config=>MODELS[config.model]?.family===5;
// Webtoon cuts are drawn as webtoon strips, so they are a page format too.
export const pageFormat=config=>!pagesAllowed(config)?'single':config.pageFormat==='cuts'?'webtoon':PAGE_KINDS.includes(config.pageFormat)?config.pageFormat:'single';
const pagePanels=config=>config.panelCount>=2?Math.min(4,config.panelCount):0;

// Webtoon cuts: one reply drawn as a few webtoon strips, each holding several
// panels, shown after their paragraphs or one under another. Strips need V5.
export const cutMode=config=>config?.pageFormat==='cuts'&&pagesAllowed(config);
export const cutLimit=config=>Math.max(1,Math.min(6,Number(config.maxScenes)||1));
// While cuts are chosen placement follows the cut layout; otherwise it returns to the saved setting.
export function withCuts(config){
    const placement=config.basePlacement??config.placement;
    if(!cutMode(config))return config.basePlacement===undefined?config:{...config,placement};
    return{...config,basePlacement:placement,placement:config.cutLayout==='stack'?'end':'auto'};
}
// How many strips and which stretches of the reply they cover. The page rules for
// a vertical webtoon strip follow and decide the panels inside each strip.
function cutRules(config){
    const max=cutLimit(config);
    return `EPISODE MODE: draw this reply as a short run of vertical webtoon strips, read from top to bottom like a webtoon episode; each scene is one strip of several panels. This replaces any earlier advice on how many scenes to write.
How many: as many strips as the reply needs and no more, between 1 and ${max}. Give a strip only to a stretch worth seeing: a new place or arrival, a decisive action, a strong reaction, a turn in the story. Leave out paragraphs of talk, thought, explanation or repetition that add nothing new to see. A short or quiet reply needs one strip; never pad to reach ${max}.
Order: strips follow the story; the panels of a strip follow its stretch moment by moment. Never draw an instant twice.
Continuity: keep outfit, hair, light, weather and place the same from strip to strip unless the story changes them, and keep each person on the same side of the frame.`;
}

// How each format opens the prompt. The page format comes first: NovelAI
// weighs the opening of a prompt most.
function header(format,count){
    const n=WORDS[count]??'several';
    if(format==='manga')return `a ${n}-panel black and white manga page, monochrome, greyscale, inked linework, high contrast, solid black shadows, clean panel borders with thin white gutters`;
    if(format==='webtoon')return `a vertical webtoon strip of ${n} panels stacked from top to bottom, full color, clean digital coloring, soft shading, wide white gutters between panels`;
    return `a ${n}-panel full color comic page, clean lineart, cel shading, clean panel borders with thin white gutters`;
}
// Tags that fight a page: a heavy UC removes multiple views, screentone and halftone.
const CONFLICTS={all:['multiple views','split screen','comic','4koma','panel','panels','manga'],manga:['monochrome','greyscale','grayscale','screentone','halftone','limited palette']};
function pageNegative(format,negative,bubbles){
    const drop=new Set([...CONFLICTS.all,...(format==='manga'?CONFLICTS.manga:[])]);
    const kept=String(negative??'').split(',').map(t=>t.trim()).filter(t=>t&&!drop.has(t.toLowerCase()));
    const extra=['panel numbers','page number','watermark',...(bubbles?[]:['speech bubble','text','sound effects']),...(format==='manga'?[]:['monochrome','greyscale'])];
    return [...new Set([...kept,...extra])].join(', ');
}

// Page grids: panel cells in reading order, as fractions of the page, with white
// gutters between them. The plan picks a grid; the prompt names each panel by its
// place, and each person is placed inside the cell of their panel. The model never
// has to work out page coordinates, so people land in the panel they belong to.
const cell=(x0,y0,x1,y1,name)=>({x0,y0,x1,y1,name});
export const PAGE_GRIDS={
    2:[
        ['2-stack','위아래 두 칸','two full-width panels, one above the other',[cell(0,0,1,.46,'top, full width'),cell(0,.5,1,1,'bottom, full width')]],
        ['2-split','좌우 두 칸','two tall panels side by side, read left to right',[cell(0,0,.49,1,'tall left'),cell(.51,0,1,1,'tall right')],'landscape'],
    ],
    3:[
        ['3-top','위 넓게 · 아래 두 칸','a wide panel across the top, two panels side by side below',[cell(0,0,1,.47,'wide top'),cell(0,.51,.49,1,'lower left'),cell(.51,.51,1,1,'lower right')]],
        ['3-bottom','위 두 칸 · 아래 넓게','two panels side by side on top, a wide panel across the bottom',[cell(0,0,.49,.45,'upper left'),cell(.51,0,1,.45,'upper right'),cell(0,.49,1,1,'wide bottom')]],
        ['3-rows','가로 세 줄 · 가운데 크게','three full-width panels stacked, the middle one tallest',[cell(0,0,1,.28,'top strip'),cell(0,.32,1,.7,'tall middle'),cell(0,.74,1,1,'bottom strip')]],
        ['3-left','왼쪽 길게 · 오른쪽 두 칸','a tall panel on the left, two panels stacked on the right',[cell(0,0,.55,1,'tall left'),cell(.57,0,1,.49,'upper right'),cell(.57,.51,1,1,'lower right')]],
    ],
    4:[
        ['4-grid','네 칸 격자','four equal panels in a two by two grid',[cell(0,0,.49,.49,'upper left'),cell(.51,0,1,.49,'upper right'),cell(0,.51,.49,1,'lower left'),cell(.51,.51,1,1,'lower right')]],
        ['4-ends','위아래 넓게 · 가운데 두 칸','a wide panel across the top, two side by side in the middle, a wide panel across the bottom',[cell(0,0,1,.3,'wide top'),cell(0,.34,.49,.66,'middle left'),cell(.51,.34,1,.66,'middle right'),cell(0,.7,1,1,'wide bottom')]],
        ['4-rows','가로 네 줄','four full-width strips stacked',[cell(0,0,1,.23,'first strip'),cell(0,.257,1,.487,'second strip'),cell(0,.513,1,.743,'third strip'),cell(0,.77,1,1,'bottom strip')]],
    ],
};
export const STRIP_HEIGHTS=[['short','짧게'],['medium','보통'],['tall','길게']];
const STRIP={short:1,medium:1.6,tall:2.5},GAP=.4;
export const gridFor=page=>{const grids=PAGE_GRIDS[page?.panels?.length]??[];return grids.find(([id])=>id===page?.grid)??grids[0]??null;};
// Where each panel sits, or null for a page planned before grids (its people carry page coordinates).
export function pageCells(page,format){
    const n=page?.panels?.length;if(!n||!page.local)return null;
    if(format==='webtoon'){
        const units=page.panels.map(panel=>STRIP[panel.height]??STRIP.medium),total=units.reduce((a,b)=>a+b,0)+GAP*(n-1);let y=0;
        return units.map((u,i)=>{const c=cell(0,y/total,1,(y+u)/total,`${page.panels[i].height??'medium'} strip`.replace('medium strip','full-width strip'));y+=u+GAP;return c;});
    }
    return gridFor(page)?.[3]??Array.from({length:n},(_,i)=>cell(0,i/n+(i?.01:0),1,(i+1)/n-(i<n-1?.01:0),`strip ${i+1}`));
}
function layoutSentence(page,format,cells){
    if(page.layout?.trim())return page.layout.trim();
    if(!cells)return'';
    if(format==='webtoon'){const tall=page.panels.map((p,i)=>p.height==='tall'?ORDER[i].toLowerCase():'').filter(Boolean);return`panels of different heights${tall.length?`, the ${tall.join(' and ')} panel tallest`:''}`;}
    return gridFor(page)?.[2]??'';
}
const toPage=(c,box)=>({x:+Math.min(.98,Math.max(.02,box.x0+(c.x??.5)*(box.x1-box.x0))).toFixed(3),y:+Math.min(.98,Math.max(.02,box.y0+(c.y??.5)*(box.y1-box.y0))).toFixed(3)});

// Rules for the model that writes the plan. `format` is the plan format: text, json or analysis.
export function pageRules(config,format='text'){
    const kind=pageFormat(config);if(kind==='single')return'';
    if(cutMode(config))return`${cutRules(config)}\n${pageRules({...config,pageFormat:'webtoon'},format)}`;
    const label={manga:'black and white manga page',comic:'full color comic page',webtoon:'vertical webtoon strip'}[kind];
    const fixed=pagePanels(config),counts=fixed?[fixed]:[2,3,4],count=fixed?`exactly ${fixed}`:'2 to 4';
    const bubbles=config.speechBubbles?'A speaker\'s bubble may carry one short line from the reply in its original language: end that character\'s action for that panel with "speech bubble, Text: <line>" (NovelAI reads text that comes last). Never add other text.':'No speech bubbles, captions, sound effects, numbers or other text anywhere.';
    const grids=counts.flatMap(n=>PAGE_GRIDS[n].map(([id,,desc])=>`${id} (${desc})`)).join('; ');
    const layout=kind==='webtoon'
        ?'Layout: panels stack in one column from top to bottom. Give each panel a height: short for a pause, a glance or a small reaction; medium; tall for the decisive beat, a full-body action or a wide view of the place. Never make every panel the same height.'
        :`Layout: pick the grid whose biggest panel holds the decisive beat: ${grids}. The number of panels must match the grid.`;
    const common=`PAGE MODE (${label}): every scene is one ${label} of ${count} panels telling this moment as a short sequence, such as approach, contact, reaction, or cause, action, result. Plan the beats first, then the panels.
${layout}
Shots: give neighbouring panels a different shot distance or angle (wide, medium, close-up, extreme close-up; eye level, high angle, low angle, over the shoulder); repeat a framing only on purpose, for a two-beat reveal. Keep each person on the same side of the frame from panel to panel, and keep outfit, light and place continuous. Frame every panel so heads, hands and the key detail sit inside its borders.
Panel text stands alone and never leans on another panel (no "again", "the same pose"): shot distance and angle, who is visible and where, the exact action and expression, the background seen in that panel, and the one detail that makes the panel, wrapped in {{ }}. Refer to people by role, build or side (the taller man, the woman on the left), never by name and never by hair, eye or clothing colour: the panel text is shared by the whole page, so a colour there spreads to everyone; say which hand touches what.
People: list only the people visible in that panel. Each person's action begins with how much of them the shot shows (face close-up, upper body, cowboy shot, full body), then pose, expression, gaze and contact. Their x and y place them inside that panel: 0,0 is the panel's top left corner and 1,1 its bottom right.
${bubbles}`;
    const height=kind==='webtoon';
    if(format==='text')return `${common}\nPage lines, in this order: "prompt:" what every panel shares (place, time, light, weather);${height?'':' "grid:" the grid id;'} then for each panel in reading order a "panel:" line,${height?' a "height:" line (short, medium or tall),':''} then char, action and pos lines for each person visible in that panel (pos is x, y inside that panel). Do not write camera or layout lines in page mode.`;
    return `${common}\nFor every scene add${height?'':' "grid" (the grid id) and'} "panels": an array in reading order of {"text":"shot distance and angle, who is visible and where, exact action and expression, background, key detail",${height?'"height":"short, medium or tall",':''}"characters":[{"name":"exact library name","action":"girl, boy or other, then how much the shot shows, pose, expression, gaze and contact","x":0.5,"y":0.5}]}, where x and y are inside that panel. "prompt" holds what every panel shares (place, time, light, weather); leave "camera" empty and the scene-level "characters" empty.`;
}

// A page as the plan wrote it, in one shape: {grid, layout, local, panels:[{text, height, characters}]}.
// Pages read here are new plans, whose people are placed inside their panel (local).
export function readPage(raw,compile=character=>character){
    const panels=(Array.isArray(raw?.panels)?raw.panels:[]).map(panel=>typeof panel==='string'?{text:panel,characters:[]}:panel)
        .filter(panel=>panel&&typeof panel.text==='string'&&panel.text.trim())
        .slice(0,6).map(panel=>({text:panel.text.trim().slice(0,1500),...(STRIP[String(panel.height??'').toLowerCase()]?{height:String(panel.height).toLowerCase()}:{}),
            characters:(Array.isArray(panel.characters)?panel.characters:[]).map(compile).filter(Boolean)}));
    if(!panels.length)return null;
    const grid=typeof raw.grid==='string'?raw.grid.trim().toLowerCase():'';
    // The grid describes the layout; a layout sentence of the plan's own could contradict it.
    // The scene editor still takes one written by hand.
    return{layout:'',...(grid?{grid}:{}),local:true,panels};
}

// The scene and settings NovelAI receives for a page. The whole prompt is built
// here and sent as written; each character is drawn once per panel they are in.
export function compilePage(scene,config,{look=''}={}){
    const page=scene.page,format=pageFormat({...config,pageFormat:scene.pageFormat??config.pageFormat});
    if(!page?.panels?.length||format==='single')return{scene,config};
    const count=page.panels.length,limit=MODELS[config.model].characters,cells=pageCells(page,format);
    const occurrences=page.panels.flatMap((panel,i)=>panel.characters.map(c=>cells?{...c,...toPage(c,cells[i])}:{...c}));
    // Too many appearances for the model: one description per person, placed by the sentences.
    const perPanel=occurrences.length&&occurrences.length<=limit;
    const characters=perPanel?occurrences:[...new Map([...scene.characters??[],...occurrences].map(c=>[c.name||c.prompt,c])).values()].slice(0,limit);
    const panels=page.panels.map((panel,i)=>`${ORDER[i]} panel${cells?`, ${cells[i].name}`:''}: ${panel.text.replace(/[.,\s]+$/,'')}`).join('. ');
    const quality=config.quality?MODELS[config.model].quality.replace(/,?\s*no text/,config.speechBubbles?'':', no text').replace(/^,\s*/,''):'';
    const prompt=[header(format,count),config.style,scene.prompt,layoutSentence(page,format,cells),panels,quality].map(part=>String(part??'').trim()).filter(Boolean).join(', ');
    return{
        scene:{...scene,camera:'',prompt,negative:withoutConflicts(pageNegative(format,[config.negative,scene.negative].filter(Boolean).join(', '),config.speechBubbles),config.style),finalPrompt:true,characters},
        config:{...config,useCoords:perPanel,...pageSize(format,page,config)},
    };
}
// A tall strip for a webtoon; a page grid decides portrait or landscape and keeps the chosen size otherwise.
function pageSize(format,page,config){
    if(format==='webtoon')return page.panels.length>=3?{width:704,height:1472}:{width:768,height:1344};
    if(!page.local)return{};
    const wide=gridFor(page)?.[4]==='landscape',landscape=config.width>config.height;
    // A strip-shaped canvas left over from a webtoon becomes an ordinary page.
    if(Math.max(config.width,config.height)/Math.min(config.width,config.height)>1.6)return wide?{width:1216,height:832}:{width:832,height:1216};
    return wide!==landscape&&config.width!==config.height?{width:config.height,height:config.width}:{};
}
