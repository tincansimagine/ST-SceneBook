// Illustrated frames drawn as SVG around a picture of any aspect ratio.
// Everything is generated here; no image files are bundled.
export const ORNAMENTS=[['wreath','꽃 화환'],['sakura','벚꽃 가지'],['greenery','초록 잎'],['night','별밤'],['winter','겨울 눈꽃'],['lace','리본 레이스'],['deco','아르데코'],['seaside','바다 조개']];
export const ORNAMENT_PAD=.1;

function random(seed){let a=seed>>>0;return()=>{a=a+0x6d2b79f5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const n=v=>Number(v.toFixed(1));
const pick=(r,list)=>list[Math.floor(r()*list.length)];
const between=(r,a,b)=>a+r()*(b-a);
// Point and outward normal on the window outline, t in [0,1) clockwise from top-left.
function outline(box,t){
    const w=box.x1-box.x0,h=box.y1-box.y0,length=2*(w+h);let d=((t%1)+1)%1*length;
    if(d<w)return{x:box.x0+d,y:box.y0,nx:0,ny:-1,a:0};d-=w;
    if(d<h)return{x:box.x1,y:box.y0+d,nx:1,ny:0,a:90};d-=h;
    if(d<w)return{x:box.x1-d,y:box.y1,nx:0,ny:1,a:180};d-=w;
    return{x:box.x0,y:box.y1-d,nx:-1,ny:0,a:270};
}
const corner=(box,i)=>[[box.x0,box.y0],[box.x1,box.y0],[box.x1,box.y1],[box.x0,box.y1]][i];
const leaf=(x,y,size,angle,fill,opacity=.85)=>`<path transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(size/40)})" d="M0 0C10-14 30-16 44 0 30 16 10 14 0 0Z" fill="${fill}" opacity="${opacity}"/><path transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(size/40)})" d="M3 0H40" stroke="#0002" stroke-width="1.2" fill="none"/>`;
function flower(r,x,y,size,colors,centre='#f1c453',petals=5){
    const [light,deep]=colors,turn=r()*360;let out=`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(turn)})">`;
    for(let i=0;i<petals;i++)out+=`<g transform="rotate(${n(i*360/petals)})"><path d="M0 0C${n(-size*.42)} ${n(-size*.35)} ${n(-size*.36)} ${n(-size)} 0 ${n(-size)}C${n(size*.36)} ${n(-size)} ${n(size*.42)} ${n(-size*.35)} 0 0Z" fill="${light}" opacity=".92"/><path d="M0 ${n(-size*.12)}V${n(-size*.62)}" stroke="${deep}" stroke-width="${n(size*.07)}" stroke-linecap="round" opacity=".55"/></g>`;
    out+=`<circle r="${n(size*.2)}" fill="${centre}"/>`;
    for(let i=0;i<6;i++)out+=`<circle cx="${n(Math.cos(i)*size*.13)}" cy="${n(Math.sin(i*1.7)*size*.13)}" r="${n(size*.045)}" fill="#b9791f" opacity=".7"/>`;
    return out+'</g>';
}
const sparkle=(x,y,size,fill,opacity=1)=>`<path transform="translate(${n(x)} ${n(y)})" d="M0 ${n(-size)}C${n(size*.14)} ${n(-size*.14)} ${n(size*.14)} ${n(-size*.14)} ${n(size)} 0C${n(size*.14)} ${n(size*.14)} ${n(size*.14)} ${n(size*.14)} 0 ${n(size)}C${n(-size*.14)} ${n(size*.14)} ${n(-size*.14)} ${n(size*.14)} ${n(-size)} 0C${n(-size*.14)} ${n(-size*.14)} ${n(-size*.14)} ${n(-size*.14)} 0 ${n(-size)}Z" fill="${fill}" opacity="${opacity}"/>`;
function snowflake(x,y,size,stroke,width=2.4){
    let out=`<g transform="translate(${n(x)} ${n(y)})" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" fill="none">`;
    for(let i=0;i<6;i++)out+=`<g transform="rotate(${i*60})"><path d="M0 0V${n(-size)}M0 ${n(-size*.55)}L${n(size*.22)} ${n(-size*.78)}M0 ${n(-size*.55)}L${n(-size*.22)} ${n(-size*.78)}M0 ${n(-size*.28)}L${n(size*.14)} ${n(-size*.42)}M0 ${n(-size*.28)}L${n(-size*.14)} ${n(-size*.42)}"/></g>`;
    return out+'</g>';
}
// Soft uneven edges, as if painted.
const paint=id=>`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>`;

const DESIGNS={
    wreath(r,box,W,H,id){
        const pinks=[['#f7c4b6','#e58d8d'],['#fbe0d2','#eaa48f'],['#f2a9b4','#d86f86'],['#fdeee4','#e8b59a'],['#ecb2cf','#c9779f']],greens=['#8fae84','#a9c39a','#6f9470','#b9cfa6'];
        let vine='',leaves='',blooms='';
        for(let i=0;i<90;i++){const p=outline(box,i/90+between(r,-.004,.004)),side=i%2?1:-1,off=between(r,2,16)*side;leaves+=leaf(p.x+p.nx*off,p.y+p.ny*off,between(r,34,56),p.a+(side>0?-55:55)+between(r,-25,25)+(side>0?0:180),pick(r,greens),between(r,.7,.9));}
        vine=`<rect x="${box.x0}" y="${box.y0}" width="${box.x1-box.x0}" height="${box.y1-box.y0}" rx="10" fill="none" stroke="#7d9a72" stroke-width="5" opacity=".85"/>`;
        const cluster=(cx,cy,count,scale)=>{for(let i=0;i<count;i++){const a=r()*6.283,d=Math.sqrt(r())*84*scale;blooms+=flower(r,cx+Math.cos(a)*d,cy+Math.sin(a)*d,between(r,34,62)*scale,pick(r,pinks));}
            for(let i=0;i<count+3;i++){const a=r()*6.283,d=between(r,60,135)*scale;blooms+=flower(r,cx+Math.cos(a)*d,cy+Math.sin(a)*d,between(r,11,18),['#a9cbe9','#6f9fd0'],'#fff6c9');}
            for(let i=0;i<count+2;i++){const a=r()*6.283,d=between(r,55,110)*scale;leaves+=leaf(cx+Math.cos(a)*d*.6,cy+Math.sin(a)*d*.6,between(r,56,84)*scale,a*57.3,pick(r,greens),.85);}};
        cluster(...corner(box,0),9,1);cluster(...corner(box,2),9,1);cluster(...corner(box,1),4,.75);cluster(...corner(box,3),4,.75);
        for(const t of [.13,.37,.63,.87]){const p=outline(box,t+between(r,-.03,.03));cluster(p.x,p.y,2,.55);}
        return `<defs>${paint(id)}</defs><g filter="url(#${id})">${vine}${leaves}${blooms}</g>`;
    },
    sakura(r,box,W,H,id){
        let out='',petals='';const blossom=(x,y,s)=>{let g=`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(r()*360)})">`;for(let i=0;i<5;i++)g+=`<path transform="rotate(${i*72})" d="M0 0C${n(-s*.5)} ${n(-s*.3)} ${n(-s*.45)} ${n(-s*.95)} ${n(-s*.12)} ${n(-s)}L0 ${n(-s*.84)}L${n(s*.12)} ${n(-s)}C${n(s*.45)} ${n(-s*.95)} ${n(s*.5)} ${n(-s*.3)} 0 0Z" fill="${pick(r,['#fbd3de','#f9c1d1','#fde4ea'])}" opacity=".95"/>`;
            for(let i=0;i<5;i++)g+=`<path transform="rotate(${i*72+36})" d="M0 0V${n(-s*.34)}" stroke="#d6537c" stroke-width="1.6" stroke-linecap="round"/>`;return g+`<circle r="${n(s*.1)}" fill="#e8799a"/></g>`;};
        const branch=(sx,sy,dx,dy,length)=>{let x=sx,y=sy,d=`M${n(x)} ${n(y)}`;const steps=7;for(let i=1;i<=steps;i++){const bend=between(r,-26,26);x=sx+dx*length*i/steps+dy*bend;y=sy+dy*length*i/steps+dx*bend;d+=`L${n(x)} ${n(y)}`;
                if(i>1){const s=between(r,28,48);out+=blossom(x+between(r,-34,34),y+between(r,-34,34),s);if(r()<.7)out+=blossom(x+between(r,-60,60),y+between(r,-60,60),s*.7);out+=`<circle cx="${n(x+between(r,-44,44))}" cy="${n(y+between(r,-44,44))}" r="${n(between(r,6,10))}" fill="#f29bb5"/>`;}}
            return `<path d="${d}" fill="none" stroke="#6b4a3a" stroke-width="${n(length/70)}" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;};
        const [x0,y0]=corner(box,0),[x2,y2]=corner(box,2),w=box.x1-box.x0,h=box.y1-box.y0;
        const wood=branch(x0-30,y0+10,1,0,w*.62)+branch(x0+6,y0-30,0,1,h*.5)+branch(x2+30,y2-10,-1,0,w*.55)+branch(x2-6,y2+30,0,-1,h*.42);
        for(let i=0;i<34;i++){const p=outline(box,r()),o=between(r,-40,30);petals+=`<path transform="translate(${n(p.x+p.nx*o)} ${n(p.y+p.ny*o)}) rotate(${n(r()*360)})" d="M0 0C-7-5-6-15 0-18 6-15 7-5 0 0Z" fill="#f8c4d3" opacity="${n(between(r,.5,.9))}"/>`;}
        return `<defs>${paint(id)}</defs><rect x="${box.x0}" y="${box.y0}" width="${w}" height="${h}" fill="none" stroke="#f3c7d3" stroke-width="4" opacity=".9"/><g filter="url(#${id})">${wood}${out}${petals}</g>`;
    },
    greenery(r,box,W,H,id){
        const greens=['#7f9f8a','#a6bfa9','#5f8570','#93b39c'];let out='';const w=box.x1-box.x0,h=box.y1-box.y0;
        const sprig=(sx,sy,angle,length)=>{const rad=angle*Math.PI/180;let g='',d=`M${n(sx)} ${n(sy)}`;const steps=9;
            for(let i=1;i<=steps;i++){const curve=Math.sin(i/steps*1.6)*length*.12,x=sx+Math.cos(rad)*length*i/steps-Math.sin(rad)*curve,y=sy+Math.sin(rad)*length*i/steps+Math.cos(rad)*curve;d+=`L${n(x)} ${n(y)}`;const s=between(r,40,60)*(1-i/steps*.45);
                for(const side of [-1,1])g+=`<ellipse transform="translate(${n(x)} ${n(y)}) rotate(${n(angle+side*62)}) translate(${n(s*.55)} 0)" rx="${n(s*.55)}" ry="${n(s*.36)}" fill="${pick(r,greens)}" opacity=".88"/>`;}
            return `<path d="${d}" fill="none" stroke="#5d7a66" stroke-width="3.2" stroke-linecap="round"/>${g}`;};
        const [x0,y0]=corner(box,0),[x2,y2]=corner(box,2);
        out+=sprig(x0-8,y0-8,8,w*.58)+sprig(x0-8,y0-8,82,h*.44)+sprig(x0+4,y0+4,45,150)+sprig(x2+8,y2+8,188,w*.58)+sprig(x2+8,y2+8,262,h*.44)+sprig(x2-4,y2-4,225,150);
        for(let i=0;i<26;i++){const end=r()<.5?[x0,y0,1]:[x2,y2,-1];out+=`<circle cx="${n(end[0]+end[2]*between(r,-30,170))}" cy="${n(end[1]+end[2]*between(r,-30,170))}" r="${n(between(r,4,7))}" fill="#f6f1e4" stroke="#c9b98a" stroke-width="1"/>`;}
        return `<defs>${paint(id)}</defs><rect x="${box.x0-9}" y="${box.y0-9}" width="${w+18}" height="${h+18}" fill="none" stroke="#c8a96a" stroke-width="2.5"/><rect x="${box.x0}" y="${box.y0}" width="${w}" height="${h}" fill="none" stroke="#c8a96a" stroke-width="1.2"/><g filter="url(#${id})">${out}</g>`;
    },
    night(r,box,W,H,id){
        const w=box.x1-box.x0,h=box.y1-box.y0,band=34;let out='';
        out+=`<path fill-rule="evenodd" d="M${box.x0-band} ${box.y0-band}h${w+band*2}v${h+band*2}h${-(w+band*2)}ZM${box.x0} ${box.y0}v${h}h${w}v${-h}Z" fill="url(#${id}g)"/>`;
        out+=`<rect x="${box.x0}" y="${box.y0}" width="${w}" height="${h}" fill="none" stroke="#e9cf8f" stroke-width="2.5"/><rect x="${box.x0-band}" y="${box.y0-band}" width="${w+band*2}" height="${h+band*2}" rx="6" fill="none" stroke="#e9cf8f" stroke-width="1.5" opacity=".7"/>`;
        for(let i=0;i<70;i++){const p=outline(box,r()),o=between(r,4,band-4);out+=`<circle cx="${n(p.x+p.nx*o)}" cy="${n(p.y+p.ny*o)}" r="${n(between(r,.8,2.2))}" fill="#fff8dc" opacity="${n(between(r,.4,1))}"/>`;}
        for(let i=0;i<16;i++){const p=outline(box,i/16+between(r,-.02,.02)),o=between(r,8,band+10);out+=sparkle(p.x+p.nx*o,p.y+p.ny*o,between(r,7,17),'#f3d98b',between(r,.75,1));}
        const [mx,my]=corner(box,1);out+=`<g transform="translate(${mx+4} ${my-4})"><circle r="64" fill="#f6dfa0"/><circle cx="24" cy="-18" r="56" fill="url(#${id}g)"/><circle r="64" fill="none" stroke="#fff3c4" stroke-width="1.2" opacity=".5"/></g>`+sparkle(mx-72,my+44,20,'#fff0b8')+sparkle(mx+40,my+84,12,'#fff0b8');
        const [cx,cy]=corner(box,3),stars=[[-6,-70],[38,-40],[30,8],[78,24],[110,-10]];
        out+=`<path d="M${stars.map(([a,b])=>`${cx+a} ${cy+b}`).join('L')}" fill="none" stroke="#e9cf8f" stroke-width="1.2" opacity=".7"/>`+stars.map(([a,b])=>sparkle(cx+a,cy+b,9,'#fff0b8')).join('');
        return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2550"/><stop offset=".55" stop-color="#28306b"/><stop offset="1" stop-color="#3a2f6e"/></linearGradient></defs>${out}`;
    },
    winter(r,box,W,H,id){
        const w=box.x1-box.x0,h=box.y1-box.y0;let out=`<rect x="${box.x0-7}" y="${box.y0-7}" width="${w+14}" height="${h+14}" rx="4" fill="none" stroke="#cfe3f3" stroke-width="12" opacity=".95"/><rect x="${box.x0-7}" y="${box.y0-7}" width="${w+14}" height="${h+14}" rx="4" fill="none" stroke="#fff" stroke-width="3"/>`;
        const flakes=(cx,cy,count,spread)=>{for(let i=0;i<count;i++){const a=r()*6.283,d=Math.sqrt(r())*spread,s=between(r,22,58);out+=snowflake(cx+Math.cos(a)*d,cy+Math.sin(a)*d,s,pick(r,['#ffffff','#e6f2fb','#bcd8ee']),s>30?3:2.2);}};
        flakes(...corner(box,0),9,110);flakes(...corner(box,2),9,110);flakes(...corner(box,1),4,70);flakes(...corner(box,3),4,70);
        for(let i=0;i<60;i++){const p=outline(box,r()),o=between(r,-34,34);out+=`<circle cx="${n(p.x+p.nx*o)}" cy="${n(p.y+p.ny*o)}" r="${n(between(r,1.5,4.5))}" fill="#fff" opacity="${n(between(r,.6,1))}"/>`;}
        const pine=(sx,sy,angle)=>{const rad=angle*Math.PI/180;let g=`<path d="M${n(sx)} ${n(sy)}L${n(sx+Math.cos(rad)*150)} ${n(sy+Math.sin(rad)*150)}" stroke="#6b4a3a" stroke-width="4" stroke-linecap="round"/>`;
            for(let i=1;i<16;i++){const x=sx+Math.cos(rad)*i*9.5,y=sy+Math.sin(rad)*i*9.5;for(const side of [-1,1]){const a=rad+side*(.85-i*.01),len=34-i*1.2;g+=`<path d="M${n(x)} ${n(y)}L${n(x+Math.cos(a)*len)} ${n(y+Math.sin(a)*len)}" stroke="${pick(r,['#3f7a5a','#2f6449','#5b9273'])}" stroke-width="3" stroke-linecap="round"/>`;}}return g;};
        const [bx,by]=corner(box,3),[tx,ty]=corner(box,1);out+=pine(bx-20,by+20,-28)+pine(bx-20,by+20,-64)+pine(tx+20,ty-20,152)+pine(tx+20,ty-20,116);
        for(const [x,y]of [[bx-14,by+14],[bx+6,by+2],[bx-6,by-10],[tx+14,ty-14],[tx-6,ty-2],[tx+6,ty+10]])out+=`<circle cx="${x}" cy="${y}" r="10" fill="#c93a3a"/><circle cx="${x-3}" cy="${y-3}" r="3" fill="#f08a8a"/>`;
        return out;
    },
    lace(r,box,W,H,id){
        const w=box.x1-box.x0,h=box.y1-box.y0,length=2*(w+h),count=Math.round(length/36);let scallops='',holes='';
        for(let i=0;i<count;i++){const p=outline(box,i/count),x=p.x+p.nx*10,y=p.y+p.ny*10;scallops+=`<circle cx="${n(x)}" cy="${n(y)}" r="21" fill="#fffaf3"/>`;holes+=`<circle cx="${n(x+p.nx*7)}" cy="${n(y+p.ny*7)}" r="4.2" fill="#e7b9c2"/><circle cx="${n(x-p.ny*11+p.nx*-1)}" cy="${n(y+p.nx*11+p.ny*-1)}" r="2" fill="#e7b9c2"/>`;}
        const band=`<rect x="${box.x0-10}" y="${box.y0-10}" width="${w+20}" height="${h+20}" fill="none" stroke="#fffaf3" stroke-width="20"/><rect x="${box.x0-3}" y="${box.y0-3}" width="${w+6}" height="${h+6}" fill="none" stroke="#dc8fa1" stroke-width="4"/><rect x="${box.x0-13}" y="${box.y0-13}" width="${w+26}" height="${h+26}" fill="none" stroke="#e7b9c2" stroke-width="1.5" stroke-dasharray="2 7" stroke-linecap="round"/>`;
        const cx=(box.x0+box.x1)/2,cy=box.y0-12,bow=`<g transform="translate(${cx} ${cy})"><path d="M-8 6C-30 44-58 78-74 104L-46 96-36 122C-24 92-8 54 4 12Z" fill="#d97b92"/><path d="M8 6C30 44 58 78 74 104L46 96 36 122C24 92 8 54-4 12Z" fill="#e391a5"/><path d="M0 0C-34-50-104-52-112-12-116 20-56 26 0 0Z" fill="#e9a0b2"/><path d="M0 0C34-50 104-52 112-12 116 20 56 26 0 0Z" fill="#e391a5"/><path d="M-10-2C-44-22-86-22-98-6M10-2C44-22 86-22 98-6" fill="none" stroke="#c9657e" stroke-width="2.5" stroke-linecap="round" opacity=".7"/><rect x="-17" y="-17" width="34" height="34" rx="10" fill="#d97b92"/><path d="M-9-8C-3-3 3-3 9-8M-9 8C-3 3 3 3 9 8" fill="none" stroke="#b9516b" stroke-width="2" stroke-linecap="round"/></g>`;
        return `<g filter="drop-shadow(0 2px 3px #0003)">${scallops}${band}${holes}</g><g filter="drop-shadow(0 3px 3px #0004)">${bow}</g>`;
    },
    deco(r,box,W,H,id){
        const w=box.x1-box.x0,h=box.y1-box.y0,gold=`url(#${id}g)`;let out=`<rect x="${box.x0-26}" y="${box.y0-26}" width="${w+52}" height="${h+52}" fill="none" stroke="#14110d" stroke-width="30"/><rect x="${box.x0-11}" y="${box.y0-11}" width="${w+22}" height="${h+22}" fill="none" stroke="${gold}" stroke-width="2.5"/><rect x="${box.x0-41}" y="${box.y0-41}" width="${w+82}" height="${h+82}" fill="none" stroke="${gold}" stroke-width="2.5"/><rect x="${box.x0-33}" y="${box.y0-33}" width="${w+66}" height="${h+66}" fill="none" stroke="${gold}" stroke-width="1"/>`;
        const fan=(x,y,turn)=>{let g=`<g transform="translate(${x} ${y}) rotate(${turn})"><path d="M-42-42H78A120 120 0 0 1-42 78Z" fill="#14110d"/>`;for(let i=0;i<=8;i++){const a=i/8*Math.PI/2;g+=`<path d="M-42-42L${n(-42+Math.cos(a)*118)} ${n(-42+Math.sin(a)*118)}" stroke="${gold}" stroke-width="2"/>`;}
            for(const radius of [44,82,120])g+=`<path d="M${-42+radius}-42A${radius} ${radius} 0 0 1-42 ${-42+radius}" fill="none" stroke="${gold}" stroke-width="2.5"/>`;return g+'</g>';};
        out+=fan(box.x0,box.y0,0)+fan(box.x1,box.y0,90)+fan(box.x1,box.y1,180)+fan(box.x0,box.y1,270);
        for(const t of [.5*w/(2*(w+h)),(w+h/2)/(2*(w+h)),(w+h+w/2)/(2*(w+h)),(2*w+h+h/2)/(2*(w+h))]){const p=outline(box,t),x=p.x+p.nx*26,y=p.y+p.ny*26;out+=`<path transform="translate(${n(x)} ${n(y)}) rotate(${p.a})" d="M0-13L26 0 0 13-26 0Z" fill="${gold}"/><path transform="translate(${n(x)} ${n(y)}) rotate(${p.a})" d="M0-6L12 0 0 6-12 0Z" fill="#14110d"/><path transform="translate(${n(x)} ${n(y)}) rotate(${p.a})" d="M-70 0H-34M34 0H70" stroke="${gold}" stroke-width="2.5"/>`;}
        return `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1d58a"/><stop offset=".5" stop-color="#b98a3a"/><stop offset="1" stop-color="#ecd08a"/></linearGradient></defs>${out}`;
    },
    seaside(r,box,W,H,id){
        const w=box.x1-box.x0,h=box.y1-box.y0;let out='';const length=2*(w+h),count=Math.round(length/64);let wave=`M${box.x0-6} ${box.y0-6}`;
        for(let i=1;i<=count;i++){const a=outline(box,(i-.5)/count),b=outline(box,i/count);wave+=`Q${n(a.x+a.nx*26)} ${n(a.y+a.ny*26)} ${n(b.x+b.nx*6)} ${n(b.y+b.ny*6)}`;}
        out+=`<path d="${wave}Z" fill="none" stroke="#8fd0d6" stroke-width="16" stroke-linejoin="round" opacity=".9"/><path d="${wave}Z" fill="none" stroke="#e8f8f7" stroke-width="5" stroke-linejoin="round"/><rect x="${box.x0}" y="${box.y0}" width="${w}" height="${h}" fill="none" stroke="#f3e2c4" stroke-width="6"/>`;
        const shell=(x,y,s,turn,fill)=>{let g=`<g transform="translate(${n(x)} ${n(y)}) rotate(${n(turn)})"><path d="M0 ${n(s*.5)}C${n(-s)} ${n(s*.1)} ${n(-s*.9)} ${n(-s*.9)} 0 ${n(-s)}C${n(s*.9)} ${n(-s*.9)} ${n(s)} ${n(s*.1)} 0 ${n(s*.5)}Z" fill="${fill}"/>`;for(let i=-3;i<=3;i++)g+=`<path d="M0 ${n(s*.45)}L${n(i*s*.24)} ${n(-s*(.92-Math.abs(i)*.06))}" stroke="#0000001f" stroke-width="1.6"/>`;return g+`<path d="M${n(-s*.3)} ${n(s*.42)}H${n(s*.3)}L${n(s*.2)} ${n(s*.66)}H${n(-s*.2)}Z" fill="${fill}"/></g>`;};
        const star=(x,y,s,turn)=>{let d='';for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,q=i%2?s*.42:s;d+=`${i?'L':'M'}${n(Math.cos(a)*q)} ${n(Math.sin(a)*q)}`;}return `<path transform="translate(${n(x)} ${n(y)}) rotate(${n(turn)})" d="${d}Z" fill="#f2a27c" stroke="#e58260" stroke-width="2" stroke-linejoin="round"/>`;};
        const group=(cx,cy,scale)=>{out+=shell(cx-20*scale,cy+8*scale,46*scale,between(r,-30,30),'#fbe6d4')+shell(cx+46*scale,cy-30*scale,30*scale,between(r,-60,60),'#f7c9c4')+star(cx+30*scale,cy+48*scale,34*scale,r()*72)+shell(cx-58*scale,cy-44*scale,22*scale,between(r,-80,80),'#fdf3e7');
            for(let i=0;i<7;i++)out+=`<circle cx="${n(cx+between(r,-100,100)*scale)}" cy="${n(cy+between(r,-100,100)*scale)}" r="${n(between(r,4,9))}" fill="#fffdf8" stroke="#cfe9ea" stroke-width="1.5"/>`;};
        group(...corner(box,3),1.35);group(...corner(box,1),1.1);group(...corner(box,0),.7);group(...corner(box,2),.7);
        return `<g filter="drop-shadow(0 2px 2px #0003)">${out}</g>`;
    },
};
// Returns the SVG for a picture of the given pixel size. The picture occupies
// the centre; ORNAMENT_PAD of the width is left on every side for decoration.
export function ornamentSvg(style,width,height,key=''){
    if(!Object.hasOwn(DESIGNS,style))return'';
    const W=1000,pad=W*ORNAMENT_PAD,inner=W-pad*2,H=Math.round(inner*height/width+pad*2),box={x0:pad,y0:pad,x1:W-pad,y1:H-pad};
    let seed=7;for(const ch of `${style}${key}`)seed=Math.imul(seed^ch.charCodeAt(0),16777619);
    const id=`ap2o${(seed>>>0).toString(36)}${Math.round(H)}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="ap2-ornament" aria-hidden="true" focusable="false">${DESIGNS[style](random(seed),box,W,H,id)}</svg>`;
}
