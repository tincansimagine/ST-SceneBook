export async function prepareReference(file) {
    if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)throw new Error('10MB 이하 PNG·JPEG·WebP 이미지를 선택하세요.');
    const image=await createImageBitmap(file);
    try{
        const ratio=image.width/image.height;
        const [width,height]=ratio>1.2?[1536,1024]:ratio<0.83?[1024,1536]:[1472,1472];
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);
        const scale=Math.min(width/image.width,height/image.height);
        ctx.drawImage(image,(width-image.width*scale)/2,(height-image.height*scale)/2,image.width*scale,image.height*scale);
        return canvas.toDataURL('image/png').split(',')[1];
    }finally{image.close();}
}
