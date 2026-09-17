"use client";
import {useEffect,useSyncExternalStore} from 'react';
import {Check,ExternalLink,LoaderCircle,RefreshCw,Wallet} from 'lucide-react';
import {Modal} from './keytube-forms';
import {cancelWalletConnection,chooseWallet,disconnectWallet,getServerWalletState,getWalletState,refreshWalletDiscovery,startWalletDiscovery,subscribeWallet} from '@/lib/wallet-connection';
export function WalletConnector(){
  const state=useSyncExternalStore(subscribeWallet,getWalletState,getServerWalletState);
  useEffect(startWalletDiscovery,[]);
  useEffect(()=>()=>cancelWalletConnection(),[]);
  if(!state.open)return null;
  return <Modal title="Conectar tu wallet" onClose={cancelWalletConnection}>
    <div className="k2-wallet-dialog"><span className="k2-large-lock"><Wallet size={28}/></span><h2>Conecta tu wallet</h2><p>Elige tu wallet y autoriza a KeyTube desde su extensión.</p>
      {state.address&&<div className="k2-wallet-connected"><strong><Check size={16}/>{state.name} conectada</strong><code>{state.address}</code><button className="k2-text-button" onClick={disconnectWallet}>Desconectar de KeyTube</button></div>}
      {state.wallets.length?<div className="k2-wallet-options">{state.wallets.map(wallet=><button key={wallet.id} disabled={!!state.requestingId} onClick={()=>void chooseWallet(wallet.id)}><Wallet size={21}/><span><strong>{wallet.name}</strong><small>{state.requestingId===wallet.id?'Esperando tu autorización…':'Conectar esta wallet'}</small></span>{state.requestingId===wallet.id?<LoaderCircle size={19} className="k2-spin"/>:<ExternalLink size={16}/>}</button>)}</div>:<div className="k2-wallet-help"><h3>No detectamos una wallet</h3><ol><li>Instala una wallet en el navegador donde abriste KeyTube.</li><li>Abre la extensión y desbloquea tu cuenta.</li><li>Recarga KeyTube y vuelve a conectar.</li></ol><a className="k2-primary" href="https://metamask.io/download" target="_blank" rel="noreferrer">Instalar MetaMask<ExternalLink size={16}/></a><small>Si ya la instalaste, comprueba que la extensión tenga acceso a esta página.</small></div>}
      {state.requestingId&&<p className="k2-notice" role="status"><LoaderCircle className="k2-spin" size={17}/>Abre la extensión de tu wallet en la barra del navegador y acepta la conexión. Si está bloqueada, desbloquéala allí.</p>}
      {state.error&&<p className="k2-error" role="alert">{state.error}</p>}
      {!!state.error&&state.wallets.map(wallet=><button key={wallet.id} className="k2-secondary" disabled={!!state.requestingId} onClick={()=>void chooseWallet(wallet.id,true)}><Check size={16}/>Ya autoricé · comprobar {wallet.name}</button>)}
      <button className="k2-secondary" disabled={!!state.requestingId} onClick={refreshWalletDiscovery}><RefreshCw size={16}/>Volver a buscar wallets</button>
      <small className="k2-wallet-note">Conectar tu wallet permite verificar tus membresías. Las compras y firmas se confirman por separado dentro de tu wallet.</small>
    </div>
  </Modal>;
}
