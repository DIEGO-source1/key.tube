export type ContentType = "video" | "image" | "audio" | "text" | "document";

export type PublicPost = {
  id: string;
  creator: string;
  creator_id?: string;
  title: string;
  intro: string;
  lock: string;
  network: number;
  created_at: number;
  views?: number;
  visibility?: "free" | "members";
  plan_id?: string | null;
  premium_lock?: string | null;
  type?: ContentType;
  category?: string;
  thumbnail_url?: string;
  preview_url?: string;
  avatar?: string;
  duration?: string;
  likes?: number;
  comment_count?: number;
  liked?: boolean;
};

export type Draft = {
  visibility?: "free" | "members";
  planId?: string | null;
  creator: string;
  title: string;
  intro: string;
  body: string;
  lock: string;
  network: number;
  type?: ContentType;
  category?: string;
  thumbnailId?: string | null;
  previewId?: string | null;
  assetId?: string | null;
};

export type FullContent = {
  body: string;
  mediaUrl?: string;
  mime?: string;
  expiresAt?: number;
  verifiedAt: number;
};

export type Membership = {
  name: string;
  price: string;
  currency: string;
  duration: string;
  networkName: string;
  testnet: boolean;
  explorer: string;
  valid?: boolean;
};

export type Asset = {
  id: string;
  name: string;
  mime: string;
  size: number;
  role: string;
};

export const NETWORK_OPTIONS = [
  { id: 84532, name: "Base Sepolia · pruebas" },
  { id: 11155111, name: "Sepolia · pruebas" },
  { id: 8453, name: "Base" },
  { id: 137, name: "Polygon" },
];

export const CATEGORIES = [
  "Todos",
  "Videos",
  "Imágenes",
  "Audio",
  "Documentos",
  "Tutoriales",
  "Cursos",
  "Música",
  "Deportes",
  "Tecnología",
  "Arte",
  "Lifestyle",
  "Viajes",
  "Educación",
];

export type CreatorPlan = {
  id: string;
  ownerId: string;
  slot: "basic" | "premium";
  name: string;
  description: string;
  benefits: string[];
  coverage: ContentType[];
  price: string;
  durationDays: number;
  network: number;
  lock: string;
  wallet: string;
  quote?: Membership | null;
};
