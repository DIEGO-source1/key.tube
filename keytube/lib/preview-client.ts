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
  if(typeof MediaRecorder==='undefined')throw new Error('Usa Chrome o Edge para preparar el adelanto del audio.');
  const audio=document.createElement('audio');
  const url=URL.createObjectURL(file);audio.src=url;audio.preload='auto';audio.style.display='none';document.body.appendChild(audio);
  const ctx=new AudioContext();let recorder:MediaRecorder|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  try {
    await new Promise<void>((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('El audio tardó demasiado en abrirse.')),15000);audio.onloadeddata=()=>{clearTimeout(timeout);resolve();};audio.onerror=()=>{clearTimeout(timeout);reject(new Error('El navegador no puede abrir este audio.'));};audio.load();});
    await ctx.resume();
    const source=ctx.createMediaElementSource(audio),dest=ctx.createMediaStreamDestination();source.connect(dest);
    const mime=['audio/webm;codecs=opus','audio/webm'].find(x=>MediaRecorder.isTypeSupported(x));
    if(!mime)throw new Error('Este navegador no puede generar el adelanto de audio. Usa Chrome o Edge.');
    recorder=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:64000});
    const chunks:Blob[]=[];
    const result=new Promise<Blob>((resolve,reject)=>{recorder!.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder!.onstop=()=>resolve(new Blob(chunks,{type:'audio/webm'}));recorder!.onerror=()=>reject(new Error('No se pudo preparar el adelanto del audio.'));});
    recorder.start(200);await audio.play();
    const cap=Math.min(9800,Math.max(1000,(Number.isFinite(audio.duration)?Math.max(1000,audio.duration*1000-200):9800)));
    timer=setTimeout(()=>{audio.pause();if(recorder?.state==='recording')recorder.stop();},cap);
    audio.onended=()=>{if(recorder?.state==='recording')recorder.stop();};
    const blob=await result;
    return new File([blob],'adelanto-10s.webm',{type:'audio/webm'});
  } finally {
    if(timer)clearTimeout(timer);if(recorder?.state==='recording')recorder.stop();audio.pause();audio.remove();URL.revokeObjectURL(url);await ctx.close();
  }
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
    const cap=Math.min(9.8,Number.isFinite(video.duration)?Math.max(1,video.duration-.2):9.8);
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
    timer=setInterval(()=>{onProgress(Math.min(10,video.currentTime));if(video.currentTime>=cap||video.ended||performance.now()-started>10200)finish();},30);
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


// Compatibilidad con versiones anteriores
export const optimizeImage = imagePreview;
export const videoCover = async (file: File) => {
  const result = await videoPreview(file, ()=>{});
  return result.cover;
};
