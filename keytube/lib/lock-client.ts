"use client";
import {createWalletClient,custom,encodeFunctionData,parseAbi,parseEther,decodeEventLog,zeroAddress,type Address} from 'viem';
import {chainConfig,rpcClient} from './unlock';
const factoryAbi=parseAbi(['function createUpgradeableLock(bytes data) returns (address)','event NewLock(address indexed lockOwner,address indexed newLockAddress)']);
const manageAbi=parseAbi([
  'function initialize(address,uint256,address,uint256,uint256,string)',
  'function keyPrice() view returns (uint256)',
  'function expirationDuration() view returns (uint256)',
  'function maxNumberOfKeys() view returns (uint256)',
  'function maxKeysPerAddress() view returns (uint256)',
  'function tokenAddress() view returns (address)',
  'function updateKeyPricing(uint256,address)',
  'function updateLockConfig(uint256,uint256,uint256)',
]);
export async function prepareWallet(network:number,account:Address) {
  if(!window.ethereum)throw new Error('Conecta una wallet como MetaMask.');
  const {chain}=chainConfig(network);
  try {await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:`0x${network.toString(16)}`}]});}
  catch(e){
    if((e as {code?:number}).code!==4902)throw e;
    await window.ethereum.request({method:'wallet_addEthereumChain',params:[{chainId:`0x${network.toString(16)}`,chainName:chain.name,nativeCurrency:chain.nativeCurrency,rpcUrls:[...chain.rpcUrls.default.http],blockExplorerUrls:[chain.blockExplorers.default.url]}]});
  }
  return createWalletClient({account,chain,transport:custom(window.ethereum)});
}
export async function deployPlanLock(input:{name:string;price:string;durationDays:number;network:number},account:Address,onStatus:(s:string)=>void) {
  const wallet=await prepareWallet(input.network,account),client=rpcClient(input.network);
  const {factory}=chainConfig(input.network);
  const data=encodeFunctionData({abi:manageAbi,functionName:'initialize',args:[account,BigInt(input.durationDays*86400),zeroAddress,parseEther(input.price),BigInt(1000),input.name]});
  onStatus('Confirma la creación del Lock en tu wallet.');
  const hash=await wallet.writeContract({address:factory as Address,abi:factoryAbi,functionName:'createUpgradeableLock',args:[data]});
  onStatus('Esperando la confirmación de la red…');
  const receipt=await client.waitForTransactionReceipt({hash,timeout:180000});
  if(receipt.status!=='success')throw new Error('La creación del Lock no se completó.');
  for(const log of receipt.logs) {
    if(log.address.toLowerCase()!==factory.toLowerCase())continue;
    try {const event=decodeEventLog({abi:factoryAbi,data:log.data,topics:log.topics});if(event.eventName==='NewLock'&&event.args.lockOwner.toLowerCase()===account.toLowerCase())return event.args.newLockAddress;}catch{/* Other factory events. */}
  }
  throw new Error(`Transacción confirmada (${hash}). Copia la dirección del Lock desde Unlock y usa «Vincular Lock».`);
}
export async function updatePlanLock(input:{lock:string;price:string;durationDays:number;network:number;name?:string},account:Address,onStatus:(s:string)=>void) {
  const wallet=await prepareWallet(input.network,account),client=rpcClient(input.network),address=input.lock as Address;
  const [price,duration,currency]=await Promise.all([
    client.readContract({address,abi:manageAbi,functionName:'keyPrice'}),client.readContract({address,abi:manageAbi,functionName:'expirationDuration'}),client.readContract({address,abi:manageAbi,functionName:'tokenAddress'}),
  ]);
  if(currency!==zeroAddress)throw new Error('Este editor admite planes en ETH o POL, la moneda nativa de la red.');
  if(price!==parseEther(input.price)) {
    onStatus('Confirma el nuevo precio en tu wallet.');
    const hash=await wallet.writeContract({address,abi:manageAbi,functionName:'updateKeyPricing',args:[parseEther(input.price),zeroAddress]});
    if((await client.waitForTransactionReceipt({hash,timeout:180000})).status!=='success')throw new Error('No se pudo actualizar el precio.');
  }
  if(duration!==BigInt(input.durationDays*86400)) {
    const [max,perAddress]=await Promise.all([client.readContract({address,abi:manageAbi,functionName:'maxNumberOfKeys'}),client.readContract({address,abi:manageAbi,functionName:'maxKeysPerAddress'})]);
    onStatus('Confirma la nueva duración en tu wallet.');
    const hash=await wallet.writeContract({address,abi:manageAbi,functionName:'updateLockConfig',args:[BigInt(input.durationDays*86400),max,perAddress]});
    if((await client.waitForTransactionReceipt({hash,timeout:180000})).status!=='success')throw new Error('No se pudo actualizar la duración.');
  }
}
