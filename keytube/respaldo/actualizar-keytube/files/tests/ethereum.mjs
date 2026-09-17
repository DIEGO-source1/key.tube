import assert from 'node:assert/strict';
import {encodeAbiParameters,decodeFunctionData,parseAbi,toFunctionSelector} from 'viem';
import {chainConfig,verifyRealLock} from '../lib/unlock.ts';
import {networkSchema} from '../lib/keytube-server.ts';
import {NETWORK_OPTIONS} from '../lib/keytube-types.ts';
import {checkoutUrl} from '../lib/keytube-client.ts';
import {deployPlanLock} from '../lib/lock-client.ts';
import {startWalletDiscovery,openWalletConnection,chooseWallet,disconnectWallet} from '../lib/wallet-connection.ts';
const factory='0xe79B93f8E22676774F2A8dAd469175ebd00029FA',account='0x1111111111111111111111111111111111111111';
assert.equal(networkSchema.parse(1),1);
assert.equal(NETWORK_OPTIONS[0].id,1);
assert.equal(chainConfig(1).factory,factory);
assert.equal(chainConfig(1).chain.nativeCurrency.symbol,'ETH');
assert.ok(!chainConfig(1).chain.testnet);
assert.throws(()=>chainConfig(99999));
const requests=[],realFetch=globalThis.fetch;
let registered=true;
globalThis.fetch=async(_url,init)=>{
  const q=JSON.parse(init.body);assert.equal(q.method,'eth_call');
  const call=q.params[0];requests.push(call);
  let result;
  if(call.data===toFunctionSelector('publicLockLatestVersion()')){assert.equal(call.to.toLowerCase(),factory.toLowerCase());result=encodeAbiParameters([{type:'uint16'}],[14]);}
  else if(call.data===toFunctionSelector('unlockProtocol()'))result=encodeAbiParameters([{type:'address'}],[factory]);
  else{assert.equal(call.to.toLowerCase(),factory.toLowerCase());result=encodeAbiParameters([{type:'bool'},{type:'uint256'},{type:'uint256'}],[registered,0n,0n]);}
  return Response.json({jsonrpc:'2.0',id:q.id,result});
};
try{
  await verifyRealLock(account,1);registered=false;
  await assert.rejects(()=>verifyRealLock(account,1),/Lock registrado/);
  console.log('PASS Ethereum uses the official factory and rejects unregistered locks');
  globalThis.window=new EventTarget();window.location={origin:'https://keytube.test'};
  const switches=[],transactions=[];
  window.ethereum={request:async q=>{
    if(q.method==='eth_accounts'||q.method==='eth_requestAccounts')return [account];
    if(q.method==='wallet_switchEthereumChain'){switches.push(q.params[0].chainId);return null;}
    if(q.method==='eth_chainId')return '0x1';
    if(q.method==='eth_sendTransaction'){transactions.push(q.params[0]);throw new Error('STOP_TEST_TRANSACTION');}
    throw new Error('Unexpected wallet request '+q.method);
  }};
  const stop=startWalletDiscovery();
  const connected=openWalletConnection();
  // Legacy injected provider remains available when no EIP-6963 wallet announces.
  const {getWalletState}=await import('../lib/wallet-connection.ts');
  await chooseWallet(getWalletState().wallets[0].id);await connected;
  await assert.rejects(()=>deployPlanLock({network:1,name:'Ethereum plan',price:'0.001',durationDays:30},account,()=>{}),/STOP_TEST_TRANSACTION/);
  assert.deepEqual(switches,['0x1']);assert.equal(transactions.length,1);
  const tx=transactions[0];assert.equal(tx.to.toLowerCase(),factory.toLowerCase());
  const decoded=decodeFunctionData({abi:parseAbi(['function createUpgradeableLockAtVersion(bytes data,uint16 version) returns (address)']),data:tx.data});
  assert.equal(decoded.args[1],14);
  const checkout=new URL(checkoutUrl({id:account,creator:'Test',lock:account,network:1},account));
  assert.equal(JSON.parse(checkout.searchParams.get('paywallConfig')).locks[account].network,1);
  disconnectWallet();stop();
  console.log('PASS wallet selects Ethereum, uses its available Lock version, and checkout retains chain 1');
}finally{globalThis.fetch=realFetch;}
console.log('Ethereum checks use simulated RPC and wallet responses; no transaction is sent.');
