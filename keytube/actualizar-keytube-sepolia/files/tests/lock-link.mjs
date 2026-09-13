import assert from 'node:assert/strict';
import {encodeAbiParameters,toFunctionSelector} from 'viem';
import {parseLockReference} from '../lib/lock-reference.ts';
import {verifyRealLock,chainConfig} from '../lib/unlock.ts';
import {failure} from '../lib/keytube-server.ts';
import {api} from '../lib/keytube-client.ts';

const lock='0x1111111111111111111111111111111111111111',network=11155111;
const url=`https://app.unlock-protocol.com/locks/lock?address=${lock}&network=${network}`;
assert.deepEqual(parseLockReference(url),{lock,network});
for(const invalid of [url.replace('app.unlock-protocol.com','evil.test'),url.replace('11155111','999'),url.replace(lock,'invalid'),lock])assert.equal(parseLockReference(invalid),null);
console.log('PASS Unlock links select their declared, supported network; other URLs are rejected');

const realFetch=globalThis.fetch,requests=[];
let mode='fallback';
globalThis.fetch=async(url,init)=>{
  requests.push(String(url));
  if(mode==='offline'||(mode==='fallback'&&String(url).includes('publicnode.com')))return new Response('Unavailable',{status:503});
  const q=JSON.parse(init.body);assert.equal(q.method,'eth_call');
  let result='0x';
  if(mode!=='missing')result=q.params[0].data===toFunctionSelector('unlockProtocol()')
    ?encodeAbiParameters([{type:'address'}],[chainConfig(network).factory])
    :encodeAbiParameters([{type:'bool'},{type:'uint256'},{type:'uint256'}],[mode!=='unregistered',0n,0n]);
  return Response.json({jsonrpc:'2.0',id:q.id,result});
};
try{
  await verifyRealLock(lock,network);
  assert.ok(requests.some(url=>url.includes('publicnode.com')));
  assert.ok(requests.some(url=>url.includes('sepolia.drpc.org')));
  console.log('PASS Sepolia contract verification survives one RPC provider being unavailable');
  mode='unregistered';await assert.rejects(()=>verifyRealLock(lock,network),e=>e.code==='LOCK_UNREGISTERED');
  console.log('PASS RPC failover still rejects a Lock not registered by the official factory');
  mode='missing';
  try{await verifyRealLock(lock,network);assert.fail('Expected missing contract');}catch(e){const r=failure(e);assert.equal(r.status,400);assert.equal((await r.json()).code,'LOCK_NOT_FOUND');}
  console.log('PASS Missing contracts produce a specific network/address error');
  mode='offline';
  try{await verifyRealLock(lock,network);assert.fail('Expected RPC failure');}catch(e){const r=failure(new Error('wrapped',{cause:e}));assert.equal(r.status,503);assert.equal((await r.json()).code,'RPC_UNAVAILABLE');}
  console.log('PASS Total RPC outage remains a failure and produces an actionable error');
  globalThis.fetch=async()=>new Response('Your worker restarted',{status:503});
  await assert.rejects(()=>api('/api/plans',{}),e=>e.code==='INVALID_SERVER_RESPONSE'&&e.message.includes('HTTP 503'));
  console.log('PASS Plain-text server failures do not leak a JSON parsing exception into the form');
}finally{globalThis.fetch=realFetch;}
console.log('6 Lock-link checks passed with simulated RPC replies; no transaction was sent.');
