// Picture frames supplied as images: a PNG or WebP whose middle is transparent.
// The transparent opening is located once at import time.
export const safeFramePath=url=>typeof url==='string'&&/^\/?user\/images\/scenebook-frames\/[\w.-]+\.(png|webp)$/i.test(url);
export async function readFrameImage(file){
    if(!file||!['image/png','image/webp'].includes(file.type)||file.size>6*1024*1024)throw new Error('6MB 이하 PNG·WebP 액자 그림을 선택하세요.');
    const bitmap=await createImageBitmap(file);
    try{
        const scale=Math.min(1,320/Math.max(bitmap.width,bitmap.height)),w=Math.max(8,Math.round(bitmap.width*scale)),h=Math.max(8,Math.round(bitmap.height*scale));
        const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
        const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(bitmap,0,0,w,h);
        const alpha=context.getImageData(0,0,w,h).data,clear=i=>alpha[i*4+3]<110;
        // Start from the centre; if artwork covers it, take the nearest clear pixel.
        let start=-1,best=Infinity;const cx=w>>1,cy=h>>1;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const d=(x-cx)**2+(y-cy)**2;if(d<best&&clear(y*w+x)){best=d;start=y*w+x;}}
        if(start<0)throw new Error('투명한 창이 없는 그림입니다. 가운데가 뚫린 액자 PNG·WebP를 선택하세요.');
        const inside=new Uint8Array(w*h),stack=[start];inside[start]=1;let x0=w,y0=h,x1=0,y1=0,area=0,edge=false;
        while(stack.length){
            const i=stack.pop(),x=i%w,y=(i-x)/w;area++;
            if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;if(!x||!y||x===w-1||y===h-1)edge=true;
            for(const j of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1])if(j>=0&&!inside[j]&&clear(j)){inside[j]=1;stack.push(j);}
        }
        if(edge||area<w*h*.08)throw new Error('액자 안쪽 창을 찾지 못했습니다. 테두리가 끊기지 않고 가운데가 투명한 그림을 선택하세요.');
        // Opening shape, cropped to its bounds, so the picture never shows outside the artwork.
        const mw=x1-x0+1,mh=y1-y0+1,mask=document.createElement('canvas');mask.width=mw;mask.height=mh;
        const mc=mask.getContext('2d'),pixels=mc.createImageData(mw,mh);
        for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){
            const i=(y+y0)*w+x+x0;let on=inside[i];
            // Grow by one pixel so the picture tucks under the artwork's soft edge.
            if(!on)for(const j of [i-1,i+1,i-w,i+w])if(j>=0&&j<w*h&&inside[j]){on=1;break;}
            pixels.data[(y*mw+x)*4+3]=on?255:0;
        }
        mc.putImageData(pixels,0,0);
        const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('그림을 읽지 못했습니다.'));reader.readAsDataURL(file);});
        return{data,format:file.type==='image/webp'?'webp':'png',width:bitmap.width,height:bitmap.height,window:[x0/w,y0/h,mw/w,mh/h].map(v=>Number(v.toFixed(4))),mask:mask.toDataURL('image/png'),name:String(file.name??'액자').replace(/\.[^.]+$/,'').slice(0,40)||'액자'};
    }finally{bitmap.close();}
}
