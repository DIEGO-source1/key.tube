import {isAddress,toHex,type Address} from 'viem';
export type WalletProvider={
  request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;
  on?:(event:string,handler:(value:unknown)=>void)=>void;
  removeListener?:(event:string,handler:(value:unknown)=>void)=>void;
  providers?:WalletProvider[];
  isMetaMask?:boolean;
  isCoinbaseWallet?:boolean;
  isRabby?:boolean;
};
declare global {interface Window {ethereum?:WalletProvider}}
type WalletOption={id:string;name:string};
type State={open:boolean;wallets:WalletOption[];requestingId:string|null;error:string;address:Address|null;name:string;revision:number};
const initialState:State={open:false,wallets:[],requestingId:null,error:'',address:null,name:'',revision:0};
let state:State=initialState;
const listeners=new Set<()=>void>();
const providers=new Map<string,{name:string;provider:WalletProvider}>();
const outstanding=new Set<WalletProvider>();
let selected:WalletProvider|null=null,detach:(()=>void)|null=null,attempt=0;
let discoveryUsers=0;
let flow:{promise:Promise<Address>;resolve:(address:Address)=>void;reject:(error:Error)=>void}|null=null;
export class WalletError extends Error {
  constructor(message:string,public code:string|number){super(message);this.name='WalletError';}
}
export function walletError(error:unknown):Error {
  if(error instanceof WalletError)return error;
  const e=error as {code?:unknown;message?:unknown};
  const code=Number(e?.code);
  if(code===4001)return new WalletError('Cancelaste la conexión o la firma. Puedes intentarlo de nuevo cuando quieras.',code);
  if(code===-32002)return new WalletError('Ya hay una solicitud pendiente. Abre la extensión de tu wallet y apruébala o cancélala antes de volver a intentar.',code);
  if(code===4100)return new WalletError('Tu wallet no autorizó esta cuenta. Abre la extensión y permite el acceso de KeyTube.',code);
  if(code===4900||code===4901)return new WalletError('La wallet perdió la conexión con la red. Abre la extensión, comprueba su conexión y vuelve a intentar.',code);
  return new WalletError('No se pudo completar la solicitud. Abre y desbloquea tu wallet, comprueba los permisos de este sitio y vuelve a intentar.','WALLET_REQUEST_FAILED');
}
const emit=(next:Partial<State>)=>{state={...state,...next};for(const listener of listeners)listener();};
export const subscribeWallet=(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};};
export const getWalletState=()=>state;
export const getServerWalletState=()=>initialState;
const accountFrom=(value:unknown):Address|null=>Array.isArray(value)&&typeof value[0]==='string'&&isAddress(value[0])?value[0]:null;
function addProvider(id:string,name:string,provider:WalletProvider){
  if(!provider||typeof provider.request!=='function')return;
  // One extension may announce itself through both discovery APIs.
  const previous=[...providers].find(([,entry])=>entry.provider===provider);
  if(previous){if(!id.startsWith('legacy-')&&previous[0].startsWith('legacy-'))providers.delete(previous[0]);else return;}
  if(providers.has(id))return;
  providers.set(id,{name:name.slice(0,65),provider});
  emit({wallets:[...providers].map(([id,entry])=>({id,name:entry.name}))});
}
function announced(event:Event){
  const detail=(event as CustomEvent<{info?:{uuid?:string;name?:string};provider?:WalletProvider}>).detail;
  if(typeof detail?.info?.uuid!=='string'||typeof detail.info.name!=='string'||!detail.provider)return;
  if(detail.info.uuid.length>100||!detail.info.name.trim())return;
  addProvider('eip6963-'+detail.info.uuid,detail.info.name.trim(),detail.provider);
}
export function refreshWalletDiscovery(){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const injected=window.ethereum;
  const legacy=Array.isArray(injected?.providers)?injected.providers:injected?[injected]:[];
  legacy.forEach((provider,index)=>addProvider('legacy-'+index,provider.isRabby?'Rabby':provider.isCoinbaseWallet?'Coinbase Wallet':provider.isMetaMask?'MetaMask':'Wallet del navegador',provider));
}
export function startWalletDiscovery(){
  if(typeof window==='undefined')return()=>{};
  discoveryUsers++;
  if(discoveryUsers===1){window.addEventListener('eip6963:announceProvider',announced);window.addEventListener('ethereum#initialized',refreshWalletDiscovery);}
  refreshWalletDiscovery();
  let stopped=false;
  return()=>{if(stopped)return;stopped=true;discoveryUsers--;if(!discoveryUsers){window.removeEventListener('eip6963:announceProvider',announced);window.removeEventListener('ethereum#initialized',refreshWalletDiscovery);}};
}
function clearSelected(){detach?.();detach=null;selected=null;emit({address:null,name:'',revision:state.revision+1});}
function selectProvider(provider:WalletProvider,name:string,address:Address){
  detach?.();selected=provider;
  const accountsChanged=(value:unknown)=>{
    if(selected!==provider)return;
    const next=accountFrom(value);
    if(!next){clearSelected();return;}
    emit({address:next,revision:state.revision+1});
  };
  const chainChanged=()=>{if(selected===provider)emit({revision:state.revision+1});};
  const disconnected=()=>{if(selected===provider)clearSelected();};
  provider.on?.('accountsChanged',accountsChanged);provider.on?.('chainChanged',chainChanged);provider.on?.('disconnect',disconnected);
  detach=()=>{provider.removeListener?.('accountsChanged',accountsChanged);provider.removeListener?.('chainChanged',chainChanged);provider.removeListener?.('disconnect',disconnected);};
  emit({address,name,revision:state.revision+1});
}
async function bounded<T>(promise:Promise<T>,milliseconds:number,message:string){
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new WalletError(message,'WALLET_TIMEOUT')),milliseconds);})]);}
  finally{clearTimeout(timer);}
}
export function openWalletConnection():Promise<Address>{
  if(flow)return flow.promise;
  let resolve!:(address:Address)=>void,reject!:(error:Error)=>void;
  const promise=new Promise<Address>((yes,no)=>{resolve=yes;reject=no;});
  flow={promise,resolve,reject};emit({open:true,requestingId:null,error:''});refreshWalletDiscovery();return promise;
}
export async function connectWallet():Promise<Address>{
  if(flow)return flow.promise;
  if(selected&&state.address){
    const provider=selected;
    try{
      const address=accountFrom(await bounded(provider.request({method:'eth_accounts'}),8000,'La wallet no respondió. Abre su extensión para continuar.'));
      if(selected===provider&&address){if(address!==state.address)emit({address,revision:state.revision+1});return address;}
    }catch{/* Show the connection dialog when existing authorization cannot be read. */}
    clearSelected();
  }
  return openWalletConnection();
}
export function cancelWalletConnection(){
  attempt++;const current=flow;flow=null;emit({open:false,requestingId:null,error:''});current?.reject(new WalletError('Conexión cancelada.','WALLET_CANCELLED'));
}
export function disconnectWallet(){cancelWalletConnection();clearSelected();}
export async function chooseWallet(id:string,checkOnly=false){
  const entry=providers.get(id);
  if(!entry||!flow||state.requestingId)return;
  if(!checkOnly&&outstanding.has(entry.provider)){emit({error:'La solicitud sigue abierta en tu wallet. Apruébala y pulsa «Ya autoricé · comprobar».',requestingId:null});return;}
  const current=++attempt;
  clearSelected();emit({requestingId:id,error:''});
  try{
    const request=Promise.resolve().then(()=>entry.provider.request({method:checkOnly?'eth_accounts':'eth_requestAccounts'}));
    if(!checkOnly){outstanding.add(entry.provider);void request.then(()=>outstanding.delete(entry.provider),()=>outstanding.delete(entry.provider));}
    const accounts=await bounded(request,checkOnly?8000:45000,'La wallet está tardando en responder. Abre la extensión, aprueba la solicitud y pulsa «Ya autoricé · comprobar».');
    if(current!==attempt||!flow)return;
    const address=accountFrom(accounts);
    if(!address)throw new WalletError('No hay una cuenta autorizada. Desbloquea tu wallet, selecciona una cuenta y permite el acceso de KeyTube.','WALLET_NO_ACCOUNT');
    selectProvider(entry.provider,entry.name,address);
    const completed=flow;flow=null;emit({open:false,requestingId:null,error:''});completed.resolve(address);
  }catch(error){if(current===attempt&&flow)emit({requestingId:null,error:walletError(error).message});}
}
export async function requireWalletAccount(address:Address){
  const provider=selected;
  if(!provider)throw new WalletError('Conecta tu wallet para continuar.','WALLET_NOT_CONNECTED');
  const accounts=await bounded(provider.request({method:'eth_accounts'}),8000,'La wallet no respondió. Abre su extensión para continuar.');
  if(selected!==provider||accountFrom(accounts)?.toLowerCase()!==address.toLowerCase())throw new WalletError('La cuenta de tu wallet cambió. Vuelve a conectar la cuenta que quieres utilizar.','WALLET_ACCOUNT_CHANGED');
  return provider;
}
export async function signWalletMessage(address:Address,message:string){
  try{
    const provider=await requireWalletAccount(address);
    const signature=await provider.request({method:'personal_sign',params:[toHex(message),address]});
    if(await requireWalletAccount(address)!==provider)throw new WalletError('La wallet cambió durante la firma. Vuelve a verificar el acceso.','WALLET_ACCOUNT_CHANGED');
    if(typeof signature!=='string'||!/^0x[0-9a-fA-F]+$/.test(signature))throw new WalletError('La wallet no devolvió una firma válida.','WALLET_INVALID_SIGNATURE');
    return signature;
  }catch(error){throw walletError(error);}
}
