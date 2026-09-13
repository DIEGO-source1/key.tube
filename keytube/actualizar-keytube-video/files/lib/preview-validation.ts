// Inspect media structure on the server; do not trust a duration request header.
export function timedPreviewIsShort(bytes:Uint8Array,mime:string) {
  if(mime==='audio/wav') {
    if(bytes.length<44)return false;
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const text=(start:number,n:number)=>new TextDecoder().decode(bytes.slice(start,start+n));
    if(text(0,4)!=='RIFF'||text(8,4)!=='WAVE')return false;
    let rate=0,data=0;
    for(let pos=12;pos+8<=bytes.length;) {
      const size=view.getUint32(pos+4,true),end=pos+8+size;
      if(end>bytes.length)return false;
      if(text(pos,4)==='fmt '&&size>=16){if(view.getUint16(pos+8,true)!==1)return false;rate=view.getUint32(pos+16,true);}
      if(text(pos,4)==='data')data+=size;
      pos=end+(size%2);
    }
    return rate>0&&data>0&&data/rate<=10;
  }
  if(mime!=='video/webm')return false;
  let scale=1000000,blocks=0,maximum=0,operations=0;
  function vint(pos:number,keepMarker=false):{value:number;length:number;unknown:boolean}|null {
    if(pos>=bytes.length)return null;
    let mask=128,len=1;while(len<=8&&!(bytes[pos]&mask)){mask>>=1;len++;}
    if(len>8||pos+len>bytes.length)return null;
    let value=keepMarker?bytes[pos]:bytes[pos]&(mask-1),unknown=!keepMarker&&(bytes[pos]&(mask-1))===mask-1;
    for(let i=1;i<len;i++){value=value*256+bytes[pos+i];unknown=unknown&&bytes[pos+i]===255;}
    return {value,length:len,unknown};
  }
  function integer(start:number,end:number){let n=0;for(let p=start;p<end;p++)n=n*256+bytes[p];return n;}
  function walk(start:number,end:number,cluster=0,depth=0):boolean {
    if(depth>8)return false;
    for(let pos=start;pos<end;) {
      if(++operations>100000)return false;
      const id=vint(pos,true);if(!id)return false;pos+=id.length;
      const size=vint(pos);if(!size)return false;pos+=size.length;
      const stop=size.unknown?end:pos+size.value;
      if(stop>end||stop<pos)return false;
      if(id.value===0x2ad7b1)scale=integer(pos,stop);
      else if(id.value===0xe7)cluster=integer(pos,stop);
      else if(id.value===0xa3||id.value===0xa1) {
        const track=vint(pos);if(!track||pos+track.length+3>stop)return false;
        const offset=pos+track.length;let time=bytes[offset]*256+bytes[offset+1];if(time>=32768)time-=65536;
        // Generated previews use unlaced WebM blocks. Reject ambiguous containers.
        if(bytes[offset+2]&6)return false;
        maximum=Math.max(maximum,(cluster+time)*scale/1e9);blocks++;
      } else if([0x18538067,0x1549a966,0x1f43b675,0xa0].includes(id.value)) {
        if(!walk(pos,stop,id.value===0x1f43b675?0:cluster,depth+1))return false;
      }
      pos=stop;
    }
    return true;
  }
  return walk(0,bytes.length)&&blocks>0&&scale>0&&maximum<=10;
}
