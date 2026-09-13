// Runs only in the creator's browser. Only the generated short file is public.
function blobFromCanvas(canvas:HTMLCanvasElement) {
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo preparar la imagen.')),'image/jpeg',.78));
}
export async function imagePreview(file:File) {
  const bitmap=await createImageBitmap(file);
  const canvas=document.createElement('canvas'),scale=Math.min(1,640/bitmap.width);
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d')!;
  ctx.filter='blur(5px)';ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);ctx.filter='none';
  ctx.fillStyle='#050916c9';ctx.fillRect(0,canvas.height-44,canvas.width,44);
  ctx.fillStyle='#fff';ctx.font='bold 16px sans-serif';ctx.fillText('KEYTUBE · VISTA PREVIA',16,canvas.height-16);
  bitmap.close();return new File([await blobFromCanvas(canvas)],'vista-previa.jpg',{type:'image/jpeg'});
}
export async function audioPreview(file:File) {
  const ctx=new AudioContext();
  try {
    const audio=await ctx.decodeAudioData(await file.arrayBuffer());
    const rate=22050,seconds=Math.min(10,audio.duration*.9),length=Math.max(1,Math.floor(rate*seconds));
    const offline=new OfflineAudioContext(1,length,rate),source=offline.createBufferSource();
    source.buffer=audio;source.connect(offline.destination);source.start();
    const result=await offline.startRendering(),samples=result.getChannelData(0);
    const bytes=new ArrayBuffer(44+length*2),v=new DataView(bytes);
    const word=(offset:number,s:string)=>[...s].forEach((c,i)=>v.setUint8(offset+i,c.charCodeAt(0)));
    word(0,'RIFF');v.setUint32(4,36+length*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,length*2,true);
    for(let i=0;i<length;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,samples[i]))*32767,true);
    return new File([bytes],'adelanto-10s.wav',{type:'audio/wav'});
  }finally{await ctx.close();}
}
export async function videoPreview(file:File,onProgress:(seconds:number)=>void) {
  if(typeof MediaRecorder==='undefined')throw new Error('Usa Chrome o Edge para preparar el adelanto del video.');
  const video=document.createElement('video') as HTMLVideoElement&{captureStream?:()=>MediaStream};
  const url=URL.createObjectURL(file);video.src=url;video.muted=true;video.playsInline=true;video.preload='auto';
  video.style.cssText='position:fixed;left:-10000px;width:1px;height:1px;';document.body.appendChild(video);
  let sourceStream:MediaStream|undefined,stream:MediaStream|undefined,frame=0,timer:ReturnType<typeof setInterval>|undefined;
  let recorder:MediaRecorder|undefined;
  try {
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('El video tardó demasiado en abrirse. Prueba un MP4 con H.264.')),15000);video.onloadeddata=()=>{clearTimeout(timeout);resolve();};video.onerror=()=>{clearTimeout(timeout);reject(new Error('El navegador no puede abrir este video. Prueba un MP4 con H.264.'));};video.load();});
    const cap=Math.min(9.5,Number.isFinite(video.duration)?video.duration*.9:9.5);
    const canvas=document.createElement('canvas'),scale=Math.min(1,854/video.videoWidth);
    canvas.width=Math.max(2,Math.round(video.videoWidth*scale));canvas.height=Math.max(2,Math.round(video.videoHeight*scale));
    const ctx=canvas.getContext('2d')!;ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const cover=new File([await blobFromCanvas(canvas)],'portada.jpg',{type:'image/jpeg'});
    const canvasStream=canvas.captureStream(24);
    await video.play();sourceStream=video.captureStream?.();
    stream=new MediaStream([...canvasStream.getVideoTracks(),...(sourceStream?.getAudioTracks()||[])]);
    const mime=['video/webm;codecs=vp8,opus','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!mime)throw new Error('Este navegador no puede generar el adelanto. Usa Chrome o Edge.');
    recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:900000,audioBitsPerSecond:64000});
    const chunks:Blob[]=[];
    const result=new Promise<Blob>((resolve,reject)=>{
      recorder!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder!.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));
      recorder!.onerror=()=>reject(new Error('No se pudo preparar el adelanto del video.'));
    });
    const finish=()=>{video.pause();if(recorder?.state==='recording')recorder.stop();};
    const draw=()=>{ctx.drawImage(video,0,0,canvas.width,canvas.height);frame=requestAnimationFrame(draw);};
    recorder.start(200);draw();
    const started=performance.now();
    timer=setInterval(()=>{onProgress(Math.min(10,video.currentTime));if(video.currentTime>=cap||video.ended||performance.now()-started>10000)finish();},30);
    video.onended=finish;
    const blob=await result;
    return {preview:new File([blob],'adelanto-10s.webm',{type:'video/webm'}),cover};
  }finally {
    if(timer)clearInterval(timer);cancelAnimationFrame(frame);
    if(recorder?.state==='recording')recorder.stop();
    stream?.getTracks().forEach(t=>t.stop());sourceStream?.getTracks().forEach(t=>t.stop());
    video.pause();video.remove();video.removeAttribute('src');video.load();URL.revokeObjectURL(url);
  }
}
