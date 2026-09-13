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
  visibility?: "free" | "members";
  plan_id?: string | null;
  premium_lock?: string | null;
  sample?: boolean;
  type?: ContentType;
  category?: string;
  thumbnail_url?: string;
  preview_url?: string;
  avatar?: string;
  duration?: string;
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
export const SAMPLE_POSTS: PublicPost[] = [
  {
    id: "sample-andes",
    creator: "ViajeroLibre",
    creator_id: "viajerolibre",
    title: "Mi viaje a los Andes",
    intro:
      "El aire frío, los reflejos del lago y un camino entre montañas. Acompáñame a descubrir el paisaje con otra mirada.",
    lock: "",
    network: 84532,
    created_at: 0,
    sample: true,
    type: "video",
    category: "Viajes",
    thumbnail_url: "/images/mountain.jpg",
    preview_url: "/samples/andes-preview.mp4",
    avatar: "nico",
    duration: "0:08",
  },
  {
    id: "sample-fitness",
    creator: "FranFit",
    creator_id: "franfit",
    title: "Activa tu energía · Rutina en casa",
    intro:
      "Una pausa para moverte con intención. Esta publicación de ejemplo muestra cómo presentar un video a tu comunidad.",
    lock: "",
    network: 84532,
    created_at: 0,
    sample: true,
    type: "video",
    category: "Deportes",
    thumbnail_url: "/images/fitness.jpg",
    avatar: "nico",
  },
  {
    id: "sample-photo",
    creator: "LunaFoto",
    creator_id: "lunafoto",
    title: "Fotografía de paisajes: aprende a mirar",
    intro:
      "Antes de disparar, observa la dirección de la luz. Un paso a la izquierda puede transformar por completo el encuadre.",
    lock: "",
    network: 84532,
    created_at: 0,
    sample: true,
    type: "image",
    category: "Arte",
    thumbnail_url: "/images/photographer.jpg",
    preview_url: "/images/photographer.jpg",
    avatar: "valeria",
  },
  {
    id: "sample-music",
    creator: "DJNóva",
    creator_id: "djnova",
    title: "After hours · Ideas desde el estudio",
    intro:
      "Escucha una breve pieza instrumental de muestra. Tus miembros podrán descubrir las versiones completas de tus sesiones.",
    lock: "",
    network: 84532,
    created_at: 0,
    sample: true,
    type: "audio",
    category: "Música",
    thumbnail_url: "/images/studio.jpg",
    preview_url: "/samples/audio-preview.wav",
    avatar: "alma",
    duration: "0:08",
  },
  {
    id: "sample-notes",
    creator: "ProfeSanti",
    creator_id: "profesanti",
    title: "Guía de estudio · Sistemas que funcionan",
    intro:
      "Organiza tu próxima sesión en tres pasos: elige una pregunta, recuérdala sin mirar tus apuntes y comprueba qué necesitas reforzar.",
    lock: "",
    network: 84532,
    created_at: 0,
    sample: true,
    type: "text",
    category: "Educación",
    thumbnail_url: "/images/mountain.jpg",
    avatar: "nico",
  },
];
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

export type CreatorPlan = {id:string;ownerId:string;slot:"basic"|"premium";name:string;description:string;benefits:string[];coverage:ContentType[];price:string;durationDays:number;network:number;lock:string;wallet:string;quote?:Membership|null};
