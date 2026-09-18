import { isAddress, toHex, type Address } from "viem";
import type { Draft, PublicPost } from "./keytube-types";
type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (name: string, handler: (data: unknown) => void) => void;
  removeListener?: (name: string, handler: (data: unknown) => void) => void;
  providers?: Provider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
};
declare global {
  interface Window {
    ethereum?: Provider;
  }
}
type Eip6963Announcement = {
  info?: { uuid?: string; name?: string; rdns?: string };
  provider?: Provider;
};
let selectedProvider: Provider | null = null;

function providerLabel(provider: Provider) {
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isRabby) return "Rabby";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  return "Wallet del navegador";
}

function addUniqueProvider(list: Provider[], provider?: Provider) {
  if (!provider || typeof provider.request !== "function") return;
  if (!list.includes(provider)) list.push(provider);
}

async function discoverWalletProvider(): Promise<Provider | null> {
  if (typeof window === "undefined") return null;
  if (selectedProvider) return selectedProvider;

  const found: Provider[] = [];
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<Eip6963Announcement>).detail;
    addUniqueProvider(found, detail?.provider);
  };

  window.addEventListener("eip6963:announceProvider", onAnnounce as EventListener);
  try {
    // EIP-6963 is the modern way MetaMask and other wallets announce providers.
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    const injected = window.ethereum;
    if (Array.isArray(injected?.providers)) injected.providers.forEach((p) => addUniqueProvider(found, p));
    addUniqueProvider(found, injected);

    // Give extensions that inject asynchronously a short chance to announce themselves.
    for (let i = 0; i < 5 && found.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const late = window.ethereum;
      if (Array.isArray(late?.providers)) late.providers.forEach((p) => addUniqueProvider(found, p));
      addUniqueProvider(found, late);
      window.dispatchEvent(new Event("eip6963:requestProvider"));
    }
  } finally {
    window.removeEventListener("eip6963:announceProvider", onAnnounce as EventListener);
  }

  // Prefer MetaMask because the current KeyTube UI names it explicitly.
  selectedProvider = found.find((p) => p.isMetaMask) || found[0] || null;
  return selectedProvider;
}

async function requireWalletProvider() {
  const provider = await discoverWalletProvider();
  if (!provider) {
    throw new Error(
      "KeyTube no puede detectar MetaMask en esta pestaña. En Chrome abre Extensiones → MetaMask → Acceso al sitio y permite key-tube.vercel.app (o todos los sitios), recarga la página y vuelve a intentar.",
    );
  }
  return provider;
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
  const provider = await requireWalletProvider();

  // For a second KeyTube user on the same browser, ask MetaMask to show its
  // account chooser again instead of silently reusing the previous account.
  if (options.chooseAccount) {
    try {
      await provider.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch (error) {
      if (isUserRejected(error))
        throw new Error("Selecciona la cuenta de MetaMask que quieres usar con este perfil.");
      // Some wallets do not implement wallet_requestPermissions. Continue with
      // the standard account request in that case.
    }
  }

  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts[0] || !isAddress(accounts[0]))
    throw new Error(`No se conectó una cuenta desde ${providerLabel(provider)}.`);
  selectedProvider = provider;
  return accounts[0] as Address;
}
export async function connectedWallet() {
  const provider = await discoverWalletProvider();
  if (!provider) return null;
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  return accounts[0] && isAddress(accounts[0]) ? (accounts[0] as Address) : null;
}
export async function walletNetwork() {
  const provider = await requireWalletProvider();
  const value = (await provider.request({ method: "eth_chainId" })) as string;
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
  const provider = await requireWalletProvider();
  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts[0] || accounts[0].toLowerCase() !== wallet.toLowerCase())
    throw new Error("La cuenta activa de tu wallet cambió. Vuelve a elegir la wallet de este perfil.");
  const signature = await provider.request({
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
