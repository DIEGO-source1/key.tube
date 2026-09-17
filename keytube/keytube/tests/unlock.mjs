// Unit/integration harness ONLY. Production imports lib/unlock.ts, never this file.
import { verifyMessage } from "viem";
export const state = {
  valid: false,
  manager: true,
  registered: true,
  rpcFailure: false,
  locks: {},
  price: BigInt(1000000000000000),
  duration: BigInt(2592000),
};
export const lockAbi = [];
export function chainConfig() {
  return {};
}
export function rpcClient() {
  return {
    verifyMessage,
    async readContract({ functionName, address }) {
      if (state.rpcFailure) throw new Error("RPC offline");
      if (functionName === "getHasValidKey") return state.locks[address?.toLowerCase()] ?? state.valid;
      if (functionName === "isLockManager") return state.manager;
      if(functionName === "keyPrice") return state.price;
      if(functionName === "expirationDuration") return state.duration;
      if(functionName === "tokenAddress") return "0x0000000000000000000000000000000000000000";
      throw new Error("Unexpected call: " + functionName);
    },
  };
}
export async function verifyRealLock() {
  if (!state.registered) throw new Error("Unregistered Lock");
}

export async function getMembership() {return {name:"Test Lock",price:"0.001",currency:"ETH",duration:"30 días",networkName:"Base Sepolia",testnet:true,explorer:"https://sepolia.basescan.org"};}
