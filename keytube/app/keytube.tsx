"use client";

// Compatibility bridge for repositories upgraded from older KeyTube versions.
// The active UI lives in keytube-v2.tsx. Keeping this tiny file prevents an
// obsolete app/keytube.tsx from older deployments from being type-checked.
export { default } from "./keytube-v2";
