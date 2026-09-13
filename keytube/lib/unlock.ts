import {
  createPublicClient,
  http,
  parseAbi,
  formatUnits,
  type Address,
} from "viem";
import { base, baseSepolia, sepolia, polygon } from "viem/chains";
import type { Membership } from "./keytube-types";
const networks = {
  [baseSepolia.id]: {
    chain: baseSepolia,
    factory: "0x259813B665C8f6074391028ef782e27B65840d89",
  },
  [sepolia.id]: {
    chain: sepolia,
    factory: "0x36b34e10295cCE69B652eEB5a8046041074515Da",
  },
  [base.id]: {
    chain: base,
    factory: "0xd0b14797b9D08493392865647384974470202A78",
  },
  [polygon.id]: {
    chain: polygon,
    factory: "0xE8E5cd156f89F7bdB267EabD5C43Af3d5AF2A78f",
  },
};
export const lockAbi = parseAbi([
  "function getHasValidKey(address owner) view returns (bool)",
  "function isLockManager(address account) view returns (bool)",
  "function unlockProtocol() view returns (address)",
  "function name() view returns (string)",
  "function keyPrice() view returns (uint256)",
  "function tokenAddress() view returns (address)",
  "function expirationDuration() view returns (uint256)",
]);
const factoryAbi = parseAbi([
  "function locks(address) view returns (bool deployed, uint256 totalSales, uint256 yieldedDiscountTokens)",
]);
const tokenAbi = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);
export function chainConfig(network: number) {
  const n = networks[network as keyof typeof networks];
  if (!n) throw new Error("Red no admitida.");
  return n;
}
export function rpcClient(network: number) {
  const { chain } = chainConfig(network);
  return createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], {
      timeout: 12000,
      retryCount: 1,
    }),
  });
}
export async function verifyRealLock(lock: Address, network: number) {
  const config = chainConfig(network);
  const client = rpcClient(network);
  const [factory, registration] = await Promise.all([
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "unlockProtocol",
    }),
    client.readContract({
      address: config.factory as Address,
      abi: factoryAbi,
      functionName: "locks",
      args: [lock],
    }),
  ]);
  if (
    factory.toLowerCase() !== config.factory.toLowerCase() ||
    !registration[0]
  )
    throw new Error(
      "La dirección no corresponde a un Lock registrado en Unlock para esta red.",
    );
}
export async function getMembership(
  lock: Address,
  network: number,
  wallet?: Address,
): Promise<Membership> {
  const { chain } = chainConfig(network);
  const client = rpcClient(network);
  const [name, price, token, duration, valid] = await Promise.all([
    client.readContract({ address: lock, abi: lockAbi, functionName: "name" }),
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "keyPrice",
    }),
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "tokenAddress",
    }),
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "expirationDuration",
    }),
    wallet
      ? client.readContract({
          address: lock,
          abi: lockAbi,
          functionName: "getHasValidKey",
          args: [wallet],
        })
      : Promise.resolve(undefined),
  ]);
  let currency: string = chain.nativeCurrency.symbol,
    decimals: number = chain.nativeCurrency.decimals;
  if (token !== "0x0000000000000000000000000000000000000000") {
    [currency, decimals] = await Promise.all([
      client.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "symbol",
      }),
      client.readContract({
        address: token,
        abi: tokenAbi,
        functionName: "decimals",
      }),
    ]);
  }
  const seconds = Number(duration);
  return {
    name,
    price: formatUnits(price, decimals),
    currency,
    duration:
      seconds > 3153600000
        ? "Sin vencimiento"
        : seconds >= 86400
          ? `${Number((seconds / 86400).toFixed(2))} días`
          : seconds >= 3600
            ? `${Number((seconds / 3600).toFixed(2))} horas`
            : `${Math.ceil(seconds / 60)} minutos`,
    networkName: chain.name,
    testnet: "testnet" in chain && !!chain.testnet,
    explorer: `${chain.blockExplorers.default.url}/address/${lock}`,
    valid,
  };
}
