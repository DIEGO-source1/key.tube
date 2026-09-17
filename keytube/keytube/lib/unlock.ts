import {
  createPublicClient,
  http,
  fallback,
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
  "function publicLockVersion() view returns (uint16)",
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
const extraRpcUrls: Record<number, string[]> = {
  11155111: [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://rpc.sepolia.org",
    "https://sepolia.drpc.org",
  ],
  84532: [
    "https://base-sepolia-rpc.publicnode.com",
    "https://sepolia.base.org",
  ],
  8453: [
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
  ],
  137: [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon-rpc.com",
  ],
};

export function rpcClient(network: number) {
  const { chain } = chainConfig(network);
  const urls = Array.from(
    new Set([
      ...(extraRpcUrls[network] || []),
      ...chain.rpcUrls.default.http,
      ...((chain.rpcUrls as { public?: { http?: readonly string[] } }).public?.http || []),
    ]),
  );
  return createPublicClient({
    chain,
    transport: fallback(
      urls.map((url) =>
        http(url, {
          timeout: 10000,
          retryCount: 1,
        }),
      ),
      { rank: true },
    ),
  });
}

export async function verifyRealLock(lock: Address, network: number) {
  // A PublicLock is an upgradeable contract. Validating it by asking the
  // current Unlock factory's `locks` mapping is too strict for imported Locks:
  // older factories/upgrades can make a real Lock fail that registry check.
  // Instead, verify bytecode plus the PublicLock-specific interface directly.
  chainConfig(network);
  const client = rpcClient(network);
  const bytecode = await client.getBytecode({ address: lock });
  if (!bytecode || bytecode === "0x")
    throw new Error("No hay un contrato desplegado en esa dirección para esta red.");

  const [version, name, price, duration, token] = await Promise.all([
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "publicLockVersion",
    }),
    client.readContract({ address: lock, abi: lockAbi, functionName: "name" }),
    client.readContract({ address: lock, abi: lockAbi, functionName: "keyPrice" }),
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "expirationDuration",
    }),
    client.readContract({
      address: lock,
      abi: lockAbi,
      functionName: "tokenAddress",
    }),
  ]);

  if (Number(version) < 1 || Number(version) > 100)
    throw new Error("El contrato no parece ser un PublicLock válido.");
  if (typeof name !== "string" || typeof price !== "bigint" || typeof duration !== "bigint")
    throw new Error("El contrato no expone la interfaz esperada de Unlock.");

  return { version: Number(version), name, price, duration, token };
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
