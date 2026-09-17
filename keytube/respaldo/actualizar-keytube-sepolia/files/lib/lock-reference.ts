import { NETWORK_OPTIONS } from './keytube-types';

// Parse only Unlock dashboard links. A pasted URL never becomes a fetch target.
export function parseLockReference(value: string): {lock: string; network: number} | null {
  try {
    const url = new URL(value.trim());
    if (url.origin !== 'https://app.unlock-protocol.com' || url.pathname !== '/locks/lock') return null;
    const lock = url.searchParams.get('address') || '';
    const network = Number(url.searchParams.get('network'));
    if (!/^0x[0-9a-fA-F]{40}$/.test(lock) || !NETWORK_OPTIONS.some(n => n.id === network)) return null;
    return {lock, network};
  } catch { return null; }
}
