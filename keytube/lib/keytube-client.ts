import { isAddress, toHex, type Address } from "viem";
import type { Draft, PublicPost } from "./keytube-types";
type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (name: string, handler: (data: unknown) => void) => void;
  removeListener?: (name: string, handler: (data: unknown) => void) => void;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string,
): Promise<T> {
  const r = await fetch(path, {
    method: method || (body ? "POST" : "GET"),
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = (await r.json()) as T & { error?: string; code?: string };
  if (!r.ok)
    throw new ApiError(
      d.error || "No pudimos completar la operación.",
      d.code,
      r.status,
    );
  return d;
}
type ConnectWalletOptions = {
  /** Force the wallet extension to show its account chooser when supported. */
  chooseAccount?: boolean;
};

function isUserRejected(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      Number((error as { code?: unknown }).code) === 4001,
  );
}

export async function connectWallet(options: ConnectWalletOptions = {}) {
  if (!window.ethereum)
    throw new Error(
      "Abre KeyTube con una wallet como MetaMask. En el celular, usa el navegador de tu wallet.",
    );

  // eth_requestAccounts often reuses the account that was connected by the
  // previous KeyTube user in the same browser.  MetaMask's permission request
  // opens the account selector again, which lets a second KeyTube account pick
  // its own wallet instead of silently inheriting the first one.
  if (options.chooseAccount) {
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      if (isUserRejected(error))
        throw new Error("Selecciona la cuenta de MetaMask que quieres usar con este perfil.");
      // Other injected wallets may not implement wallet_requestPermissions.
      // Fall back to the standard connection flow below.
    }
  }

  const accounts = (await window.ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts[0] || !isAddress(accounts[0]))
    throw new Error("No se conectó una wallet.");
  return accounts[0] as Address;
}
export async function connectedWallet() {
  if (!window.ethereum) return null;
  const accounts = (await window.ethereum.request({ method: "eth_accounts" })) as string[];
  return accounts[0] && isAddress(accounts[0]) ? (accounts[0] as Address) : null;
}
export async function walletNetwork() {
  if (!window.ethereum) throw new Error("No hay una wallet disponible.");
  const value = (await window.ethereum.request({ method: "eth_chainId" })) as string;
  const id = Number.parseInt(value, 16);
  if (![84532, 11155111, 8453, 137].includes(id))
    throw new Error("Cambia tu wallet a Base Sepolia, Sepolia, Base o Polygon.");
  return id;
}
export async function signProof(
  purpose: "read" | "publish" | "plan" | "wallet",
  wallet: Address,
  network: number,
  data: { postId?: string; draft?: Draft; plan?: unknown },
) {
  const c = await api<{ challengeId: string; message: string }>(
    "/api/challenge",
    { purpose, wallet, network, ...data },
  );
  const signature = await window.ethereum!.request({
    method: "personal_sign",
    params: [toHex(c.message), wallet],
  });
  return { challengeId: c.challengeId, wallet, signature };
}
export function checkoutUrl(post: PublicPost, address?: string | null) {
  const redirect = new URL(
    `/content/${encodeURIComponent(post.id)}`,
    window.location.origin,
  );
  redirect.searchParams.set("checkout", "return");
  const cfg = {
    title: `Membresía · ${post.creator}`,
    locks: { [post.lock]: { network: post.network } },
    pessimistic: true,
    skipSelect: true,
    ...(address ? { expectedAddress: address } : {}),
  };
  const url = new URL("https://app.unlock-protocol.com/checkout");
  url.searchParams.set("paywallConfig", JSON.stringify(cfg));
  url.searchParams.set("redirectUri", redirect.toString());
  return url.toString();
}
export const shortAddress = (a: string) => a.slice(0, 6) + "…" + a.slice(-4);
export const mediaLabels = {
  video: "Video",
  image: "Imagen",
  audio: "Audio",
  text: "Artículo",
  document: "Documento",
};
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "No pudimos completar esta acción.";
