"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  Home,
  Compass,
  Bookmark,
  KeyRound,
  Plus,
  Search,
  Wallet,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Video,
  Image as ImageIcon,
  Headphones,
  FileText,
  Music,
  Dumbbell,
  Monitor,
  Palette,
  BookOpen,
  GraduationCap,
  Clapperboard,
  Sparkles,
  UploadCloud,
  Check,
  ShieldCheck,
  LockKeyhole,
  LoaderCircle,
  RefreshCw,
  LogOut,
  Settings,
  Trash2,
  BarChart3,
  MessageCircle,
  Share2,
  UserRound,
  X,
  Play,
} from "lucide-react";
import { isAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Brand,
  CreatorAvatar,
  ContentCard,
  ContentMedia,
} from "@/components/keytube-content";
import {
  api,
  ApiError,
  connectWallet,
  signProof,
  checkoutUrl,
  shortAddress,
  errorText,
  mediaLabels,
} from "@/lib/keytube-client";
import {
  SAMPLE_POSTS,
  CATEGORIES,
  NETWORK_OPTIONS,
  type PublicPost,
  type Draft,
  type FullContent,
  type Membership,
  type Asset,
  type ContentType,
} from "@/lib/keytube-types";

type View =
  | "home"
  | "explore"
  | "members"
  | "saved"
  | "studio"
  | "upload"
  | "profile"
  | "creator"
  | "content"
  | "stats";
type Route = { view: View; id?: string };
type Account = {
  profile: { name: string; bio: string; avatar: string } | null;
  saved: string[];
  following: string[];
  postCount: number;
};
type Comment = { id: string; name: string; body: string; created_at: number };
const initialAccount: Account = {
  profile: null,
  saved: [],
  following: [],
  postCount: 0,
};
const emptyDraft: Draft = {
  creator: "",
  title: "",
  intro: "",
  body: "",
  lock: "",
  network: 84532,
  type: "text",
  category: "Educación",
  thumbnailId: null,
  previewId: null,
  assetId: null,
};
const categoryIcons: Record<string, typeof Video> = {
  Todos: Compass,
  Videos: Video,
  Imágenes: ImageIcon,
  Audio: Headphones,
  Documentos: FileText,
  Tutoriales: BookOpen,
  Cursos: GraduationCap,
  Música: Music,
  Deportes: Dumbbell,
  Tecnología: Monitor,
  Arte: Palette,
  Lifestyle: Sparkles,
  Viajes: Compass,
  Educación: BookOpen,
};
const viewPaths: Partial<Record<View, string>> = {
  home: "/",
  explore: "/explore",
  members: "/memberships",
  saved: "/saved",
  studio: "/studio",
  upload: "/studio/upload",
  profile: "/profile",
  stats: "/studio/stats",
};
function readRoute(): Route {
  const p = window.location.pathname.split("/").filter(Boolean);
  if (p[0] === "content")
    return { view: "content", id: decodeURIComponent(p[1] || "") };
  if (p[0] === "creator")
    return { view: "creator", id: decodeURIComponent(p[1] || "") };
  const entry = Object.entries(viewPaths).find(
    ([, v]) => v === window.location.pathname,
  );
  if (entry) return { view: entry[0] as View };
  const query = new URLSearchParams(window.location.search);
  return query.has("post")
    ? { view: "content", id: query.get("post")! }
    : query.has("studio")
      ? { view: "studio" }
      : { view: "home" };
}
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n\s*\n/)
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </>
  );
}

export default function KeyTube({
  user,
  signInUrl,
}: {
  user: { id: string; name: string } | null;
  signInUrl: string;
}) {
  const [route, setRoute] = useState<Route>({ view: "home" }),
    [posts, setPosts] = useState<PublicPost[]>([]),
    [mine, setMine] = useState<PublicPost[]>([]),
    [remote, setRemote] = useState<PublicPost | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("Todos"),
    [account, setAccount] = useState<Account>(initialAccount),
    [loginOpen, setLoginOpen] = useState(false);
  const [address, setAddress] = useState<Address | null>(null),
    [full, setFull] = useState<FullContent | null>(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [quote, setQuote] = useState<Membership | null>(null),
    [quoteError, setQuoteError] = useState("");
  const [memberStates, setMemberStates] = useState<Record<string, Membership>>(
      {},
    ),
    [checkingMembers, setCheckingMembers] = useState(false),
    [comments, setComments] = useState<Comment[]>([]),
    [comment, setComment] = useState(""),
    [commentBusy, setCommentBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft),
    [assets, setAssets] = useState<Record<string, Asset>>({}),
    [uploading, setUploading] = useState(""),
    [publishing, setPublishing] = useState(false),
    [publishError, setPublishError] = useState(""),
    [previewOpen, setPreviewOpen] = useState(false),
    [deleting, setDeleting] = useState<PublicPost | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
      name: user?.name || "",
      bio: "",
      avatar: "nico",
    }),
    [savingProfile, setSavingProfile] = useState(false);
  const epoch = useRef(0),
    walletRef = useRef<Address | null>(null),
    selectedRef = useRef<string | null>(null),
    fullInput = useRef<HTMLInputElement>(null);
  const knownPosts = Array.from(
    new Map(
      [...posts, ...mine, ...SAMPLE_POSTS].map((p) => [p.id, p]),
    ).values(),
  );
  const selected =
    knownPosts.find((p) => p.id === route.id) ||
    (remote?.id === route.id ? remote : null);
  const actual = posts.filter((p) => !p.sample);
  const creators = Array.from(
    new Map(posts.map((p) => [p.creator_id || p.creator, p])).values(),
  );
  const membershipPosts = Array.from(
    new Map(actual.map((p) => [p.network + ":" + p.lock, p])).values(),
  );
  const profile = account.profile || {
    name: user?.name || "Tu espacio",
    bio: "",
    avatar: "nico",
  };
  const own = !!selected && mine.some((p) => p.id === selected.id);
  const creatorPosts = knownPosts.filter(
    (p) => (p.creator_id || p.creator) === route.id,
  );
  const creator = creatorPosts[0];
  const refreshAccount = useCallback(async () => {
    const a = await api<Account>("/api/account");
    setAccount(a);
    if (a.profile) {
      setProfileDraft(a.profile);
      setDraft((prev) => ({
        ...prev,
        creator: prev.creator || a.profile!.name,
      }));
    }
  }, []);
  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api<{ posts: PublicPost[] }>("/api/posts");
      setPosts(result.posts);
    } catch (e) {
      setLoadError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  const reloadMine = useCallback(async () => {
    if (!user) return;
    const r = await api<{ posts: PublicPost[] }>("/api/posts?mine=1");
    setMine(r.posts);
  }, [user]);
  const navigate = useCallback((view: View, id?: string) => {
    epoch.current++;
    setFull(null);
    setStatus("");
    setBusy(false);
    setRoute({ view, id });
    const path =
      view === "content"
        ? `/content/${encodeURIComponent(id || "")}`
        : view === "creator"
          ? `/creator/${encodeURIComponent(id || "")}`
          : viewPaths[view] || "/";
    window.history.pushState(null, "", path);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  function requireLogin() {
    if (user) return true;
    setLoginOpen(true);
    return false;
  }
  const assignWallet = useCallback((next: Address | null) => {
    epoch.current++;
    walletRef.current = next;
    setAddress(next);
    setFull(null);
    setStatus("");
    setBusy(false);
    setMemberStates({});
  }, []);
  async function connect() {
    const wallet = await connectWallet();
    assignWallet(wallet);
    return wallet;
  }
  async function walletAction() {
    try {
      if (address) {
        assignWallet(null);
        toast("Wallet desconectada de KeyTube.");
      } else {
        await connect();
        toast.success("Wallet conectada.");
      }
    } catch (e) {
      toast.error(errorText(e));
    }
  }
  async function verify(post: PublicPost) {
    if (post.sample) return;
    let generation = epoch.current;
    try {
      setBusy(true);
      setStatus("Conecta tu wallet para verificar el acceso.");
      const wallet = walletRef.current || (await connect());
      generation = epoch.current;
      setBusy(true);
      setFull(null);
      setStatus("Firma el mensaje de acceso. Esta firma no realiza pagos.");
      const signed = await signProof("read", wallet, post.network, {
        postId: post.id,
      });
      if (generation !== epoch.current) return;
      setStatus("Comprobando tu membresía en Unlock…");
      const result = await api<FullContent>("/api/access", {
        ...signed,
        postId: post.id,
      });
      if (generation !== epoch.current || selectedRef.current !== post.id)
        return;
      setFull(result);
      setStatus("Membresía válida. Disfruta el contenido completo.");
      toast.success("Contenido desbloqueado.");
    } catch (e) {
      if (generation !== epoch.current) return;
      setFull(null);
      setStatus(
        e instanceof ApiError && e.code === "MEMBERSHIP_REQUIRED"
          ? "Tu wallet no tiene una membresía vigente. Puedes obtenerla en Unlock y volver a verificar."
          : errorText(e),
      );
    } finally {
      if (generation === epoch.current) setBusy(false);
    }
  }
  async function ownerPreview() {
    if (!selected) return;
    const generation = epoch.current;
    try {
      setBusy(true);
      const result = await api<FullContent>(`/api/studio?post=${selected.id}`);
      if (generation !== epoch.current) return;
      setFull(result);
      setStatus("Vista del creador: este contenido te pertenece.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      if (generation === epoch.current) setBusy(false);
    }
  }
  async function social(kind: "save" | "follow", target: string) {
    if (!requireLogin()) return;
    const field = kind === "save" ? "saved" : "following";
    const active = !account[field].includes(target);
    try {
      await api("/api/social", { kind, target, active });
      setAccount((a) => ({
        ...a,
        [field]: active
          ? [...a[field], target]
          : a[field].filter((x) => x !== target),
      }));
      toast.success(
        kind === "save"
          ? active
            ? "Guardado en tu colección."
            : "Publicación retirada de guardados."
          : active
            ? "Ahora sigues a este creador."
            : "Dejaste de seguir al creador.",
      );
    } catch (e) {
      toast.error(errorText(e));
    }
  }
  async function checkMemberships() {
    let generation = epoch.current;
    try {
      setCheckingMembers(true);
      const wallet = walletRef.current || (await connect());
      generation = epoch.current;
      const results = await Promise.all(
        membershipPosts.map(
          async (p) =>
            [
              p.id,
              await api<Membership>(
                `/api/membership?post=${p.id}&wallet=${wallet}`,
              ),
            ] as const,
        ),
      );
      if (generation === epoch.current)
        setMemberStates(Object.fromEntries(results));
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setCheckingMembers(false);
    }
  }
  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!selected || !requireLogin()) return;
    const postId = selected.id;
    setCommentBusy(true);
    try {
      const result = await api<{ comment: Comment }>("/api/comments", {
        postId,
        body: comment,
      });
      if (selectedRef.current !== postId) return;
      setComments((prev) => [result.comment, ...prev]);
      setComment("");
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setCommentBusy(false);
    }
  }
  async function upload(file: File, role: "full" | "preview" | "thumbnail") {
    if (!requireLogin()) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("El límite es 20 MB por archivo.");
      return;
    }
    setUploading(role);
    setPublishError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      const fallback: Record<string, string> = {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        mp4: "video/mp4",
        webm: "video/webm",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        pdf: "application/pdf",
        txt: "text/plain",
      };
      const r = await fetch(`/api/uploads?role=${role}`, {
        method: "POST",
        headers: {
          "Content-Type":
            file.type || fallback[ext || ""] || "application/octet-stream",
          "X-File-Name": encodeURIComponent(file.name),
        },
        body: file,
      });
      const result = (await r.json()) as { asset: Asset; error?: string };
      if (!r.ok)
        throw new Error(result.error || "No se pudo subir el archivo.");
      setAssets((prev) => ({ ...prev, [role]: result.asset }));
      setDraft((prev) => ({
        ...prev,
        [role === "full"
          ? "assetId"
          : role === "preview"
            ? "previewId"
            : "thumbnailId"]: result.asset.id,
      }));
      toast.success(
        role === "full"
          ? "Archivo completo guardado en privado."
          : "Archivo de muestra guardado.",
      );
    } catch (e) {
      setPublishError(errorText(e));
    } finally {
      setUploading("");
    }
  }
  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!requireLogin()) return;
    setPublishError("");
    setPublishing(true);
    try {
      if (!isAddress(draft.lock, { strict: false }))
        throw new Error("Copia la dirección completa de tu Lock de Unlock.");
      const wallet = walletRef.current || (await connect());
      const signed = await signProof("publish", wallet, draft.network, {
        draft,
      });
      const result = await api<{ post: PublicPost }>("/api/posts", {
        ...signed,
        draft,
      });
      setMine((prev) => [result.post, ...prev]);
      setPosts((prev) => [result.post, ...prev.filter((p) => !p.sample)]);
      setDraft((prev) => ({
        ...emptyDraft,
        creator: prev.creator,
        lock: prev.lock,
        network: prev.network,
      }));
      setAssets({});
      void refreshAccount();
      toast.success("Publicación protegida con Unlock.");
      navigate("content", result.post.id);
    } catch (e) {
      setPublishError(errorText(e));
    } finally {
      setPublishing(false);
    }
  }
  async function removePost() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/studio?post=${deleting.id}`, undefined, "DELETE");
      setMine((prev) => prev.filter((p) => p.id !== deleting.id));
      await reload();
      void refreshAccount();
      setDeleting(null);
      toast.success("Publicación eliminada.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setDeleteBusy(false);
    }
  }
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const result = await api<{ profile: Account["profile"] }>(
        "/api/account",
        profileDraft,
      );
      setAccount((a) => ({ ...a, profile: result.profile }));
      toast.success("Perfil actualizado.");
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setSavingProfile(false);
    }
  }
  function changeType(value: string) {
    setDraft((prev) => ({
      ...prev,
      type: value as ContentType,
      assetId: null,
      previewId: null,
    }));
    setAssets((prev) => {
      const next: Record<string, Asset> = {};
      if (prev.thumbnail) next.thumbnail = prev.thumbnail;
      return next;
    });
  }
  function chooseCategory(value: string) {
    setCategory(value);
    if (!["home", "explore"].includes(route.view)) navigate("explore");
  }
  function card(p: PublicPost) {
    return (
      <ContentCard
        key={p.id}
        post={p}
        saved={account.saved.includes(p.id)}
        onOpen={() => navigate("content", p.id)}
        onSave={() => void social("save", p.id)}
        onCreator={() => navigate("creator", p.creator_id || p.creator)}
      />
    );
  }
  useEffect(() => {
    setRoute(readRoute());
    void reload();
    void refreshAccount().catch((e) => toast.error(errorText(e)));
    void reloadMine().catch((e) => toast.error(errorText(e)));
    const back = () => {
      epoch.current++;
      setFull(null);
      setRoute(readRoute());
    };
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [reload, refreshAccount, reloadMine]);
  useEffect(() => {
    selectedRef.current = selected?.id || null;
    epoch.current++;
    setFull(null);
    setStatus("");
    setBusy(false);
    setQuote(null);
    setQuoteError("");
    setComments([]);
    if (!selected || route.view !== "content") return;
    let cancelled = false;
    if (!selected.sample)
      api<Membership>(`/api/membership?post=${selected.id}`)
        .then((q) => {
          if (!cancelled) setQuote(q);
        })
        .catch((e) => {
          if (!cancelled) setQuoteError(errorText(e));
        });
    api<{ comments: Comment[] }>(`/api/comments?post=${selected.id}`)
      .then((r) => {
        if (!cancelled) setComments(r.comments);
      })
      .catch((e) => {
        if (!cancelled) toast.error(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.id, route.view]);
  useEffect(() => {
    if (
      route.view !== "content" ||
      !route.id ||
      selected ||
      loading ||
      route.id.startsWith("sample-")
    )
      return;
    let cancelled = false;
    api<{ post: PublicPost }>(`/api/posts?id=${encodeURIComponent(route.id)}`)
      .then((r) => {
        if (!cancelled) setRemote(r.post);
      })
      .catch((e) => {
        if (!cancelled) setStatus(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [route.id, route.view, selected, loading]);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const changed = (data: unknown) => {
      const a = (data as string[])[0];
      assignWallet(a && isAddress(a) ? (a as Address) : null);
    };
    const disconnected = () => assignWallet(null);
    const chainChanged = () => {
      epoch.current++;
      setFull(null);
      setBusy(false);
      setStatus("La red cambió. Verifica nuevamente tu membresía.");
    };
    provider.on?.("accountsChanged", changed);
    provider.on?.("chainChanged", chainChanged);
    provider.on?.("disconnect", disconnected);
    return () => {
      provider.removeListener?.("accountsChanged", changed);
      provider.removeListener?.("chainChanged", chainChanged);
      provider.removeListener?.("disconnect", disconnected);
    };
  }, [assignWallet]);
  useEffect(() => {
    if (!full || !selected || !address || own) return;
    const generation = epoch.current;
    const check = () =>
      api<Membership>(`/api/membership?post=${selected.id}&wallet=${address}`)
        .then((q) => {
          if (generation === epoch.current && !q.valid) {
            setFull(null);
            setStatus("La membresía ya no está vigente.");
          }
        })
        .catch(() => {
          if (generation === epoch.current) {
            setFull(null);
            setStatus("No pudimos confirmar el acceso. Verifica de nuevo.");
          }
        });
    const timer = setInterval(() => void check(), 60000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [full, selected, address, own]);
  useEffect(() => {
    const ctx = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const controller = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: "explore_keytube",
            description:
              "Filtra contenido público de KeyTube. No compra membresías ni entrega contenido privado.",
            inputSchema: {
              type: "object",
              properties: { search: { type: "string" } },
              required: ["search"],
            },
            execute(input: { search: string }) {
              setQuery(String(input.search || "").slice(0, 100));
              navigate("explore");
              return { view: "explore" };
            },
          },
          { signal: controller.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => controller.abort();
  }, [navigate]);
  const normalized = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const typeFilter: Record<string, string> = {
    Videos: "video",
    Imágenes: "image",
    Audio: "audio",
    Documentos: "document",
  };
  const visible = posts.filter(
    (p) =>
      (category === "Todos" ||
        typeFilter[category] === p.type ||
        p.category === category) &&
      normalized(p.title + " " + p.creator + " " + p.category).includes(
        normalized(query),
      ),
  );
  const lockedPanel = (post: PublicPost) => (
    <div className="kt-content-gate">
      <div className="kt-gate-symbol">
        <LockKeyhole size={27} />
      </div>
      <div>
        <h3>
          {post.sample
            ? "Tu próximo contenido puede verse así"
            : "Continúa con la membresía del creador"}
        </h3>
        <p>
          {post.sample
            ? "Esta es una publicación de ejemplo. Crea la tuya y vincula tu Lock de Unlock."
            : "Desbloquea el archivo completo y apoya a quien lo hizo posible."}
        </p>
        {post.sample ? (
          <Button className="kt-button" onClick={() => navigate("upload")}>
            Publicar mi contenido <ArrowRight size={16} />
          </Button>
        ) : (
          <div className="kt-button-row">
            <Button
              className="kt-button"
              disabled={busy}
              onClick={() => void verify(post)}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ShieldCheck size={17} />
              )}{" "}
              {address ? "Verificar membresía" : "Conectar y verificar"}
            </Button>
            <Button variant="outline" className="kt-outline" asChild>
              <a
                href={
                  typeof window !== "undefined"
                    ? checkoutUrl(post, address)
                    : "#"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Obtener membresía <ExternalLink size={15} />
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <SidebarProvider
      className="kt-app"
      style={{ "--sidebar-width": "218px" } as CSSProperties}
    >
      <Sidebar className="kt-sidebar" collapsible="offcanvas">
        <SidebarHeader>
          <button className="kt-logo-button" onClick={() => navigate("home")}>
            <Brand />
          </button>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {(
                [
                  { v: "home", label: "Inicio", Icon: Home },
                  { v: "explore", label: "Explorar", Icon: Compass },
                  { v: "saved", label: "Mis favoritos", Icon: Bookmark },
                  { v: "members", label: "Mis membresías", Icon: KeyRound },
                ] as const
              ).map(({ v, label, Icon }) => (
                <SidebarMenuItem key={v}>
                  <SidebarMenuButton
                    isActive={route.view === v}
                    onClick={() => navigate(v)}
                    className="kt-nav-button"
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Categorías</SidebarGroupLabel>
            <SidebarMenu>
              {CATEGORIES.filter((x) => x !== "Todos").map((c) => {
                const Icon = categoryIcons[c] || Compass;
                return (
                  <SidebarMenuItem key={c}>
                    <SidebarMenuButton
                      className="kt-nav-button"
                      isActive={
                        ["home", "explore"].includes(route.view) &&
                        category === c
                      }
                      onClick={() => chooseCategory(c)}
                    >
                      <Icon />
                      <span>{c}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Tu espacio de creador</SidebarGroupLabel>
            <SidebarMenu>
              {(
                [
                  { v: "studio", label: "Mi contenido", Icon: Clapperboard },
                  { v: "upload", label: "Subir contenido", Icon: UploadCloud },
                  { v: "stats", label: "Estadísticas", Icon: BarChart3 },
                ] as const
              ).map(({ v, label, Icon }) => (
                <SidebarMenuItem key={v}>
                  <SidebarMenuButton
                    isActive={route.view === v}
                    className="kt-nav-button"
                    onClick={() => navigate(v)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="kt-support">
            <KeyRound size={26} />
            <strong>Apoya a tus creadores</strong>
            <p>Una membresía abre nuevas historias.</p>
            <Button className="kt-button" onClick={() => navigate("members")}>
              Ver membresías
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="kt-main">
        <header className="kt-topbar">
          <SidebarTrigger className="kt-mobile-trigger" />
          <div className="kt-search">
            <Search size={18} />
            <Input
              aria-label="Buscar creadores o contenido"
              placeholder="Busca creadores, contenido o categorías…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!["home", "explore"].includes(route.view))
                  navigate("explore");
              }}
            />
            {query && (
              <button aria-label="Borrar búsqueda" onClick={() => setQuery("")}>
                <X size={15} />
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            className="kt-wallet"
            onClick={() => void walletAction()}
          >
            <Wallet size={18} />
            <span>{address ? shortAddress(address) : "Conectar wallet"}</span>
          </Button>
          <button
            className="kt-account"
            onClick={() => (user ? navigate("profile") : setLoginOpen(true))}
          >
            <CreatorAvatar
              name={profile.name}
              avatar={user ? profile.avatar : undefined}
              size={33}
            />
            <span>{user ? profile.name.split(" ")[0] : "Ingresar"}</span>
            <ChevronRight size={14} />
          </button>
        </header>
        <main className="kt-body">
          {["home", "explore"].includes(route.view) && (
            <div className="kt-home-layout">
              <div className="kt-feed-column">
                {route.view === "home" && !query && category === "Todos" && (
                  <section className="kt-hero">
                    <div className="kt-hero-content">
                      <span className="kt-eyebrow">
                        TU COMUNIDAD, MÁS CERCA
                      </span>
                      <Brand large />
                      <h1>
                        Contenido exclusivo,
                        <br />
                        para quienes tienen la{" "}
                        <span className="kt-gradient-text">llave.</span>
                      </h1>
                      <p>
                        Descubre, disfruta y apoya a tus creadores favoritos.
                        <br />
                        Tu membresía de Unlock abre el resto.
                      </p>
                      <Button
                        className="kt-button"
                        onClick={() => navigate("explore")}
                      >
                        Explorar creadores <ArrowRight size={16} />
                      </Button>
                    </div>
                    <span className="kt-powered">
                      <KeyRound size={21} />
                      <span>
                        Powered by<strong>Unlock</strong>
                      </span>
                    </span>
                  </section>
                )}
                <div className="kt-chips" aria-label="Filtrar contenido">
                  {CATEGORIES.slice(0, 11).map((c) => {
                    const Icon = categoryIcons[c] || Compass;
                    return (
                      <button
                        key={c}
                        aria-pressed={category === c}
                        className={category === c ? "active" : ""}
                        onClick={() => chooseCategory(c)}
                      >
                        <Icon size={15} />
                        {c}
                      </button>
                    );
                  })}
                </div>
                <div className="kt-section-title">
                  <h2>
                    {query
                      ? `Resultados para “${query}”`
                      : category !== "Todos"
                        ? category
                        : route.view === "explore"
                          ? "Explora lo que te inspira"
                          : "Contenido destacado"}
                  </h2>
                  <span>{visible.length} publicaciones</span>
                </div>
                {loading ? (
                  <div className="kt-grid">
                    {[1, 2, 3, 4].map((n) => (
                      <Skeleton key={n} className="h-64 rounded-xl" />
                    ))}
                  </div>
                ) : loadError ? (
                  <div className="kt-empty" role="alert">
                    <p>{loadError}</p>
                    <Button variant="outline" onClick={() => void reload()}>
                      <RefreshCw size={16} />
                      Reintentar
                    </Button>
                  </div>
                ) : visible.length ? (
                  <div className="kt-grid">{visible.map(card)}</div>
                ) : (
                  <div className="kt-empty">
                    <Search size={32} />
                    <h2>No encontramos publicaciones.</h2>
                    <p>Prueba otra búsqueda o categoría.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setCategory("Todos");
                      }}
                    >
                      Ver todo
                    </Button>
                  </div>
                )}
                {posts.some((p) => p.sample) && (
                  <p className="kt-sample-note">
                    Catálogo de ejemplo · los creadores y publicaciones son
                    ficticios. Las membresías se habilitan al publicar con un
                    Lock real.
                  </p>
                )}
                <div className="kt-section-title kt-next-section">
                  <h2>Encuentra tu próxima inspiración</h2>
                  <button
                    className="kt-text-button"
                    onClick={() => navigate("upload")}
                  >
                    Crear una publicación <Plus size={15} />
                  </button>
                </div>
                <div className="kt-category-tiles">
                  {[
                    {
                      name: "Videos",
                      Icon: Video,
                      copy: "Historias en movimiento",
                    },
                    {
                      name: "Imágenes",
                      Icon: ImageIcon,
                      copy: "Una mirada diferente",
                    },
                    {
                      name: "Audio",
                      Icon: Headphones,
                      copy: "Dale play a tu curiosidad",
                    },
                    {
                      name: "Documentos",
                      Icon: FileText,
                      copy: "Ideas que se quedan",
                    },
                  ].map(({ name, Icon, copy }) => (
                    <button key={name} onClick={() => chooseCategory(name)}>
                      <Icon size={25} />
                      <strong>{name}</strong>
                      <span>{copy}</span>
                      <ArrowRight size={17} />
                    </button>
                  ))}
                </div>
              </div>
              <aside className="kt-right-rail">
                <div className="kt-profile-widget">
                  <div className="kt-person">
                    <CreatorAvatar
                      name={profile.name}
                      avatar={user ? profile.avatar : undefined}
                      size={46}
                    />
                    <div>
                      <strong>
                        {user ? profile.name : "Bienvenido a KeyTube"}
                      </strong>
                      <span className="kt-access-badge">
                        {address ? "Wallet conectada" : "Tu próxima comunidad"}
                      </span>
                    </div>
                  </div>
                  <div className="kt-profile-counts">
                    <span>
                      <strong>{account.postCount}</strong>Publicaciones
                    </span>
                    <span>
                      <strong>{account.saved.length}</strong>Guardados
                    </span>
                    <span>
                      <strong>{account.following.length}</strong>Siguiendo
                    </span>
                  </div>
                </div>
                <div className="kt-membership-promo">
                  <LockKeyhole size={33} />
                  <h3>Más contenido, más cerca</h3>
                  <p>
                    Abre el contenido completo con la membresía de cada creador.
                  </p>
                  <Button onClick={() => navigate("members")}>
                    Ver membresías
                  </Button>
                </div>
                <div className="kt-recommendations">
                  <div className="kt-section-title">
                    <h3>Creadores recomendados</h3>
                  </div>
                  {creators.slice(0, 4).map((p) => (
                    <div
                      className="kt-recommendation"
                      key={p.creator_id || p.creator}
                    >
                      <button
                        className="kt-creator-link"
                        onClick={() =>
                          navigate("creator", p.creator_id || p.creator)
                        }
                      >
                        <CreatorAvatar name={p.creator} avatar={p.avatar} />
                        <span>
                          <strong>{p.creator}</strong>
                          <small>{p.category}</small>
                        </span>
                      </button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void social("follow", p.creator_id || p.creator)
                        }
                      >
                        {account.following.includes(p.creator_id || p.creator)
                          ? "Siguiendo"
                          : "Seguir"}
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="kt-rail-footer">
                  Hecho para compartir lo que te apasiona.
                  <br />
                  <span>KeyTube + Unlock</span>
                </p>
              </aside>
            </div>
          )}
          {route.view === "content" &&
            (selected ? (
              <>
                <button className="kt-back" onClick={() => navigate("home")}>
                  <ArrowLeft size={17} />
                  Volver al contenido
                </button>
                <div className="kt-detail-layout">
                  <div>
                    <ContentMedia
                      post={selected}
                      full={full}
                      onError={() =>
                        setStatus(
                          "El archivo no pudo cargarse o el enlace expiró. Verifica nuevamente el acceso.",
                        )
                      }
                    />
                    <div className="kt-detail-title">
                      <div>
                        <span className="kt-eyebrow">
                          {mediaLabels[selected.type || "text"]} ·{" "}
                          {selected.category}
                        </span>
                        <h1>{selected.title}</h1>
                      </div>
                      <Button
                        variant="ghost"
                        aria-label="Guardar"
                        onClick={() => void social("save", selected.id)}
                      >
                        <Bookmark
                          fill={
                            account.saved.includes(selected.id)
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </Button>
                    </div>
                    <div className="kt-detail-author">
                      <button
                        className="kt-creator-link"
                        onClick={() =>
                          navigate(
                            "creator",
                            selected.creator_id || selected.creator,
                          )
                        }
                      >
                        <CreatorAvatar
                          name={selected.creator}
                          avatar={selected.avatar}
                          size={43}
                        />
                        <span>
                          <strong>{selected.creator}</strong>
                          <small>
                            {selected.sample
                              ? "Creador de ejemplo"
                              : "Creador en KeyTube"}
                          </small>
                        </span>
                      </button>
                      <Button
                        className="kt-button"
                        onClick={() =>
                          void social(
                            "follow",
                            selected.creator_id || selected.creator,
                          )
                        }
                      >
                        {account.following.includes(
                          selected.creator_id || selected.creator,
                        )
                          ? "Siguiendo"
                          : "Seguir"}
                      </Button>
                    </div>
                    <article className="kt-reading">
                      <Paragraphs text={selected.intro} />
                      {full && (
                        <div className="kt-full-content">
                          <span className="kt-valid">
                            <ShieldCheck size={17} />
                            {own ? "Vista del creador" : "Membresía verificada"}
                          </span>
                          <Paragraphs text={full.body} />
                        </div>
                      )}
                    </article>
                    {!full && lockedPanel(selected)}
                    {status && (
                      <div
                        className={`kt-status ${full ? "success" : ""}`}
                        role="status"
                        aria-live="polite"
                      >
                        {busy && <LoaderCircle size={17} className="spin" />}
                        {status}
                      </div>
                    )}
                    {own && !full && (
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => void ownerPreview()}
                        disabled={busy}
                      >
                        <Play size={16} />
                        Abrir vista del creador
                      </Button>
                    )}
                    <div className="kt-detail-actions">
                      <span>
                        <MessageCircle size={16} />
                        {comments.length} comentarios
                      </span>
                      <button
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(
                              window.location.origin +
                                `/content/${selected.id}`,
                            )
                            .then(() => toast.success("Enlace copiado."))
                            .catch(() =>
                              toast.error("No se pudo copiar el enlace."),
                            )
                        }
                      >
                        <Share2 size={16} />
                        Compartir
                      </button>
                    </div>
                    <section className="kt-comments">
                      <h2>Conversación</h2>
                      <form onSubmit={addComment}>
                        <Textarea
                          aria-label="Escribe un comentario"
                          placeholder="Comparte lo que te inspiró…"
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          maxLength={1000}
                          minLength={2}
                          required
                        />
                        <Button
                          className="kt-button"
                          disabled={commentBusy || comment.trim().length < 2}
                        >
                          {commentBusy ? "Publicando…" : "Comentar"}
                        </Button>
                      </form>
                      {comments.length ? (
                        comments.map((c) => (
                          <article className="kt-comment" key={c.id}>
                            <CreatorAvatar name={c.name} />
                            <div>
                              <strong>{c.name}</strong>
                              <small>
                                {new Date(c.created_at).toLocaleDateString(
                                  "es-BO",
                                )}
                              </small>
                              <p>{c.body}</p>
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="kt-muted">
                          Sé la primera persona en comentar.
                        </p>
                      )}
                    </section>
                  </div>
                  <aside className="kt-detail-aside">
                    {!selected.sample && (
                      <div className="kt-plan">
                        <KeyRound size={30} />
                        <span className="kt-eyebrow">
                          MEMBRESÍA DEL CREADOR
                        </span>
                        <h2>{quote?.name || selected.creator}</h2>
                        {quote ? (
                          <>
                            <div className="kt-price">
                              {quote.price}
                              <span>{quote.currency}</span>
                            </div>
                            <p>Acceso por {quote.duration.toLowerCase()}</p>
                            <span className="kt-access-badge">
                              {quote.networkName}
                              {quote.testnet ? " · Pruebas" : ""}
                            </span>
                          </>
                        ) : quoteError ? (
                          <p className="kt-error">{quoteError}</p>
                        ) : (
                          <p>Consultando el contrato…</p>
                        )}
                        <Button
                          className="kt-button"
                          disabled={busy}
                          onClick={() => void verify(selected)}
                        >
                          Verificar mi acceso
                        </Button>
                        <Button variant="outline" asChild>
                          <a
                            href={
                              typeof window !== "undefined"
                                ? checkoutUrl(selected, address)
                                : "#"
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Comprar en Unlock
                            <ExternalLink size={14} />
                          </a>
                        </Button>
                        <small>
                          Después de comprar, vuelve y verifica tu membresía.
                        </small>
                        {quote && (
                          <a
                            className="kt-text-button"
                            href={quote.explorer}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ver contrato <ExternalLink size={13} />
                          </a>
                        )}
                      </div>
                    )}
                    <h3>Más para descubrir</h3>
                    {posts
                      .filter((p) => p.id !== selected.id)
                      .slice(0, 4)
                      .map((p) => (
                        <button
                          className="kt-related"
                          key={p.id}
                          onClick={() => navigate("content", p.id)}
                        >
                          {p.thumbnail_url ? (
                            <img src={p.thumbnail_url} alt="" />
                          ) : (
                            <FileText size={34} />
                          )}
                          <span>
                            <strong>{p.title}</strong>
                            <small>{p.creator}</small>
                          </span>
                        </button>
                      ))}
                  </aside>
                </div>
              </>
            ) : (
              <div className="kt-empty">
                <h2>
                  {loading
                    ? "Cargando publicación…"
                    : "Publicación no disponible"}
                </h2>
                <p>{status}</p>
                <Button onClick={() => navigate("home")}>
                  Volver al inicio
                </Button>
              </div>
            ))}
          {route.view === "creator" &&
            (creator ? (
              <>
                <div className="kt-creator-profile">
                  <div
                    className="kt-creator-cover"
                    style={{
                      backgroundImage: `linear-gradient(0deg,#06101dee,#06101d11),url(${creator.thumbnail_url || "/images/hero.jpg"})`,
                    }}
                  />
                  <div className="kt-creator-info">
                    <CreatorAvatar
                      name={creator.creator}
                      avatar={creator.avatar}
                      size={85}
                    />
                    <div>
                      <h1>{creator.creator}</h1>
                      <p>
                        {creator.category} · {creatorPosts.length} publicaciones
                      </p>
                    </div>
                    <Button
                      className="kt-button"
                      onClick={() =>
                        void social(
                          "follow",
                          creator.creator_id || creator.creator,
                        )
                      }
                    >
                      {account.following.includes(
                        creator.creator_id || creator.creator,
                      )
                        ? "Siguiendo"
                        : "Seguir creador"}
                    </Button>
                  </div>
                </div>
                <div className="kt-section-title">
                  <h2>Publicaciones</h2>
                  <span>
                    {creator.sample
                      ? "Perfil de ejemplo"
                      : "Contenido del creador"}
                  </span>
                </div>
                <div className="kt-grid">{creatorPosts.map(card)}</div>
              </>
            ) : (
              <div className="kt-empty">
                <h2>Este creador todavía no tiene publicaciones.</h2>
                <Button onClick={() => navigate("explore")}>Explorar</Button>
              </div>
            ))}
          {route.view === "saved" && (
            <>
              <div className="kt-page-heading">
                <span className="kt-eyebrow">TU COLECCIÓN</span>
                <h1>Contenido guardado</h1>
                <p>Vuelve a las historias que te inspiraron.</p>
              </div>
              {account.saved.length ? (
                <div className="kt-grid">
                  {knownPosts
                    .filter((p) => account.saved.includes(p.id))
                    .map(card)}
                </div>
              ) : (
                <div className="kt-empty">
                  <Bookmark size={38} />
                  <h2>Tu colección empieza con un clic.</h2>
                  <p>Guarda una publicación para encontrarla aquí.</p>
                  <Button
                    className="kt-button"
                    onClick={() => navigate("explore")}
                  >
                    Explorar contenido
                  </Button>
                </div>
              )}
            </>
          )}
          {route.view === "members" && (
            <>
              <div className="kt-page-heading">
                <span className="kt-eyebrow">TU LLAVE AL CONTENIDO</span>
                <h1>Membresías</h1>
                <p>Accede al contenido exclusivo de tus creadores favoritos.</p>
              </div>
              {membershipPosts.length ? (
                <>
                  <Button
                    className="kt-button"
                    onClick={() => void checkMemberships()}
                    disabled={checkingMembers}
                  >
                    {checkingMembers ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ShieldCheck size={17} />
                    )}
                    Verificar mis membresías
                  </Button>
                  <div className="kt-plans">
                    {membershipPosts.map((p) => {
                      const m = memberStates[p.id];
                      return (
                        <div className="kt-plan" key={p.id}>
                          <CreatorAvatar
                            name={p.creator}
                            avatar={p.avatar}
                            size={46}
                          />
                          <h2>{p.creator}</h2>
                          {m ? (
                            <>
                              <div className="kt-price">
                                {m.price}
                                <span>{m.currency}</span>
                              </div>
                              <p>
                                {m.duration} · {m.networkName}
                              </p>
                              <span
                                className={m.valid ? "kt-valid" : "kt-muted"}
                              >
                                {m.valid
                                  ? "Membresía vigente"
                                  : "Sin membresía vigente"}
                              </span>
                            </>
                          ) : (
                            <p className="kt-muted">
                              Verifica para consultar tu acceso y el precio
                              actual.
                            </p>
                          )}
                          <ul>
                            <li>
                              <Check size={16} />
                              Contenido completo de este creador
                            </li>
                            <li>
                              <Check size={16} />
                              Acceso mientras tu Key sea válida
                            </li>
                          </ul>
                          <Button
                            className="kt-button"
                            onClick={() => navigate("content", p.id)}
                          >
                            Ver contenido
                          </Button>
                          <Button variant="outline" asChild>
                            <a
                              href={
                                typeof window !== "undefined"
                                  ? checkoutUrl(p, address)
                                  : "#"
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Obtener membresía
                              <ExternalLink size={14} />
                            </a>
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="kt-empty">
                  <KeyRound size={42} />
                  <h2>Las membresías de tus creadores estarán aquí.</h2>
                  <p>
                    Publica el primer contenido con un Lock real para habilitar
                    su compra y verificación.
                  </p>
                  <Button
                    className="kt-button"
                    onClick={() => navigate("upload")}
                  >
                    Publicar contenido
                  </Button>
                  <a
                    className="kt-text-button"
                    href="https://app.unlock-protocol.com/locks"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Crear mi Lock en Unlock
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
              <div className="kt-how">
                <div>
                  <span>1</span>
                  <strong>Elige tu creador</strong>
                  <p>Descubre una muestra de su contenido.</p>
                </div>
                <div>
                  <span>2</span>
                  <strong>Obtén la membresía</strong>
                  <p>Completa la compra en Unlock.</p>
                </div>
                <div>
                  <span>3</span>
                  <strong>Abre el contenido</strong>
                  <p>Verifica tu Key y disfruta el acceso.</p>
                </div>
              </div>
            </>
          )}
          {["studio", "upload", "stats", "profile"].includes(route.view) &&
            !user && (
              <div className="kt-signin-page">
                <div className="kt-signin-art">
                  <Brand large />
                  <h1>
                    Tu contenido.
                    <br />
                    Tu comunidad.
                    <br />
                    Tu próxima historia.
                  </h1>
                </div>
                <div className="kt-signin-copy">
                  <h1>Bienvenido de nuevo</h1>
                  <p>
                    Inicia sesión para publicar, guardar contenido y administrar
                    tu perfil.
                  </p>
                  <Button className="kt-button" asChild>
                    <a href={signInUrl} target="_top">
                      Continuar con ChatGPT <ArrowRight size={17} />
                    </a>
                  </Button>
                  <p className="kt-muted">
                    Para acceder al contenido exclusivo también verificaremos tu
                    membresía de Unlock.
                  </p>
                </div>
              </div>
            )}
          {route.view === "studio" && user && (
            <>
              <div className="kt-page-heading row">
                <div>
                  <span className="kt-eyebrow">ESTUDIO DEL CREADOR</span>
                  <h1>Mi contenido</h1>
                  <p>Una nueva historia empieza contigo.</p>
                </div>
                <Button
                  className="kt-button"
                  onClick={() => navigate("upload")}
                >
                  <Plus size={17} />
                  Subir contenido
                </Button>
              </div>
              {mine.length ? (
                <div className="kt-studio-list">
                  {mine.map((p) => (
                    <article key={p.id}>
                      <div className="kt-studio-thumbnail">
                        {p.thumbnail_url ? (
                          <img src={p.thumbnail_url} alt="" />
                        ) : (
                          <FileText size={30} />
                        )}
                      </div>
                      <div>
                        <h3>{p.title}</h3>
                        <p>
                          {mediaLabels[p.type || "text"]} · {p.category}
                        </p>
                        <span className="kt-access-badge">
                          <ShieldCheck size={12} />
                          Protegido con Unlock
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigate("content", p.id)}
                      >
                        Ver publicación
                      </Button>
                      <Button
                        variant="ghost"
                        aria-label={`Eliminar ${p.title}`}
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={17} />
                      </Button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="kt-empty">
                  <UploadCloud size={42} />
                  <h2>Publica tu primera historia.</h2>
                  <p>
                    Sube un archivo o escribe un artículo, añade un adelanto y
                    vincula tu membresía.
                  </p>
                  <Button
                    className="kt-button"
                    onClick={() => navigate("upload")}
                  >
                    Crear publicación
                  </Button>
                </div>
              )}
            </>
          )}
          {route.view === "upload" && user && (
            <>
              <div className="kt-page-heading row">
                <div>
                  <span className="kt-eyebrow">ESTUDIO DEL CREADOR</span>
                  <h1>Subir contenido</h1>
                  <p>Comparte algo exclusivo con tu comunidad.</p>
                </div>
                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  Vista previa
                </Button>
              </div>
              <div className="kt-upload-layout">
                <form className="kt-upload-form" onSubmit={publish}>
                  <Tabs value={draft.type} onValueChange={changeType}>
                    <label>Tipo de contenido</label>
                    <TabsList className="kt-format-tabs">
                      {(
                        [
                          { value: "video", label: "Video", Icon: Video },
                          { value: "image", label: "Imagen", Icon: ImageIcon },
                          { value: "audio", label: "Audio", Icon: Headphones },
                          {
                            value: "document",
                            label: "Documento",
                            Icon: FileText,
                          },
                          { value: "text", label: "Artículo", Icon: BookOpen },
                        ] as const
                      ).map(({ value, label, Icon }) => (
                        <TabsTrigger key={value} value={value}>
                          <Icon size={20} />
                          {label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  {draft.type !== "text" && (
                    <>
                      <input
                        ref={fullInput}
                        type="file"
                        className="sr-only"
                        aria-label="Archivo completo"
                        accept={
                          draft.type === "video"
                            ? "video/mp4,video/webm"
                            : draft.type === "audio"
                              ? "audio/*"
                              : draft.type === "image"
                                ? "image/jpeg,image/png,image/webp"
                                : ".pdf,.txt"
                        }
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            void upload(e.target.files[0], "full");
                        }}
                      />
                      <button
                        type="button"
                        disabled={!!uploading}
                        className="kt-dropzone"
                        onClick={() => fullInput.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!uploading && e.dataTransfer.files[0])
                            void upload(e.dataTransfer.files[0], "full");
                        }}
                      >
                        {uploading === "full" ? (
                          <LoaderCircle className="spin" size={35} />
                        ) : assets.full ? (
                          <Check size={35} />
                        ) : (
                          <UploadCloud size={35} />
                        )}
                        <strong>
                          {assets.full
                            ? assets.full.name
                            : "Arrastra aquí tu archivo completo"}
                        </strong>
                        <span>
                          {assets.full
                            ? "Guardado en privado"
                            : "o selecciona un archivo de tu dispositivo"}
                        </span>
                        <span className="kt-upload-select">
                          {assets.full
                            ? "Cambiar archivo"
                            : "Seleccionar archivo"}
                        </span>
                        <small>
                          Hasta 20 MB por archivo · el original queda protegido
                        </small>
                      </button>
                      <label>
                        Adelanto público{" "}
                        {draft.type === "document" ? "(opcional)" : ""}
                        <span>
                          Sube un archivo separado que cualquier visitante pueda
                          ver.
                        </span>
                        <Input
                          type="file"
                          disabled={!!uploading}
                          accept={
                            draft.type === "image"
                              ? "image/jpeg,image/png,image/webp"
                              : draft.type === "video"
                                ? "video/mp4,video/webm"
                                : draft.type === "audio"
                                  ? "audio/*"
                                  : ".pdf,.txt"
                          }
                          onChange={(e) => {
                            if (e.target.files?.[0])
                              void upload(e.target.files[0], "preview");
                          }}
                        />
                        {assets.preview && (
                          <small className="kt-valid">
                            <Check size={14} />
                            {assets.preview.name}
                          </small>
                        )}
                      </label>
                    </>
                  )}
                  <label>
                    Portada (opcional)
                    <Input
                      type="file"
                      disabled={!!uploading}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        if (e.target.files?.[0])
                          void upload(e.target.files[0], "thumbnail");
                      }}
                    />
                    {assets.thumbnail && (
                      <small className="kt-valid">
                        <Check size={14} />
                        {assets.thumbnail.name}
                      </small>
                    )}
                  </label>
                  <div className="kt-field-grid">
                    <label>
                      Nombre del creador
                      <Input
                        required
                        minLength={2}
                        maxLength={65}
                        value={draft.creator}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, creator: e.target.value }))
                        }
                        placeholder="Tu nombre o el de tu estudio"
                      />
                    </label>
                    <label>
                      Categoría
                      <Select
                        value={draft.category}
                        onValueChange={(value) =>
                          setDraft((d) => ({
                            ...d,
                            category: value || "Educación",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.filter(
                            (c) =>
                              ![
                                "Todos",
                                "Videos",
                                "Imágenes",
                                "Audio",
                                "Documentos",
                              ].includes(c),
                          ).map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <label>
                    Título
                    <Input
                      required
                      minLength={3}
                      maxLength={110}
                      value={draft.title}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      placeholder="Escribe un título que invite a descubrir"
                    />
                  </label>
                  <label>
                    Descripción y adelanto escrito
                    <Textarea
                      required
                      minLength={30}
                      maxLength={2500}
                      rows={4}
                      value={draft.intro}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, intro: e.target.value }))
                      }
                      placeholder="Esta parte será visible para todos…"
                    />
                    <span>Entre 30 y 2.500 caracteres.</span>
                  </label>
                  <label>
                    {draft.type === "text"
                      ? "Artículo completo para miembros"
                      : "Notas exclusivas para miembros (opcional)"}
                    <Textarea
                      required={draft.type === "text"}
                      minLength={draft.type === "text" ? 60 : undefined}
                      maxLength={60000}
                      rows={7}
                      value={draft.body}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, body: e.target.value }))
                      }
                      placeholder="Aquí empieza el contenido exclusivo…"
                    />
                  </label>
                  <div className="kt-form-divider">
                    <KeyRound size={20} />
                    <h2>Membresía requerida</h2>
                  </div>
                  <div className="kt-field-grid">
                    <label>
                      Red del Lock
                      <Select
                        value={String(draft.network)}
                        onValueChange={(value) =>
                          setDraft((d) => ({ ...d, network: Number(value) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NETWORK_OPTIONS.map((n) => (
                            <SelectItem key={n.id} value={String(n.id)}>
                              {n.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <label>
                      Dirección del Lock
                      <Input
                        required
                        placeholder="0x…"
                        spellCheck={false}
                        value={draft.lock}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            lock: e.target.value.trim(),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <p className="kt-info">
                    <ShieldCheck size={18} />
                    Tu wallet debe administrar este Lock para publicar.
                  </p>
                  {publishError && (
                    <div className="kt-error" role="alert">
                      {publishError}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="kt-button kt-publish"
                    disabled={publishing || !!uploading}
                  >
                    {publishing || uploading ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <LockKeyhole size={18} />
                    )}{" "}
                    {uploading
                      ? "Subiendo archivo…"
                      : publishing
                        ? "Verificando y publicando…"
                        : "Firmar y publicar contenido"}
                  </Button>
                </form>
                <aside className="kt-upload-guide">
                  <div className="kt-plan">
                    <KeyRound size={31} />
                    <h2>Tu contenido ya tiene llave.</h2>
                    <p>
                      Crea una membresía en Unlock y copia la dirección de su
                      Lock aquí.
                    </p>
                    <Button variant="outline" asChild>
                      <a
                        href="https://app.unlock-protocol.com/locks"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Crear o ver mi Lock
                        <ExternalLink size={15} />
                      </a>
                    </Button>
                    <small>
                      Para ensayar, utiliza Base Sepolia o Sepolia y moneda de
                      prueba.
                    </small>
                  </div>
                  <div className="kt-upload-tips">
                    <h3>Un buen adelanto invita a seguir.</h3>
                    <p>
                      <Video size={18} />
                      Video: un clip breve.
                    </p>
                    <p>
                      <Headphones size={18} />
                      Audio: un fragmento de tu sesión.
                    </p>
                    <p>
                      <ImageIcon size={18} />
                      Imagen: una versión de muestra.
                    </p>
                    <p>
                      <BookOpen size={18} />
                      Artículo: la introducción.
                    </p>
                  </div>
                </aside>
              </div>
            </>
          )}
          {route.view === "stats" && user && (
            <>
              <div className="kt-page-heading">
                <span className="kt-eyebrow">MI ESTUDIO</span>
                <h1>Estadísticas de contenido</h1>
                <p>La actividad de tus publicaciones en KeyTube.</p>
              </div>
              <div className="kt-stats">
                <div>
                  <Clapperboard size={25} />
                  <strong>{mine.length}</strong>
                  <span>Publicaciones</span>
                </div>
                <div>
                  <KeyRound size={25} />
                  <strong>
                    {new Set(mine.map((p) => p.network + ":" + p.lock)).size}
                  </strong>
                  <span>Membresías vinculadas</span>
                </div>
                <div>
                  <Bookmark size={25} />
                  <strong>{account.saved.length}</strong>
                  <span>Contenido que guardaste</span>
                </div>
              </div>
              <div className="kt-panel">
                <h2>Tu contenido por formato</h2>
                {(["video", "image", "audio", "text", "document"] as const).map(
                  (type) => (
                    <div className="kt-stat-row" key={type}>
                      <span>{mediaLabels[type]}</span>
                      <div>
                        <span
                          style={{
                            width: `${mine.length ? (mine.filter((p) => (p.type || "text") === type).length / mine.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <strong>
                        {mine.filter((p) => (p.type || "text") === type).length}
                      </strong>
                    </div>
                  ),
                )}
              </div>
            </>
          )}
          {route.view === "profile" && user && (
            <>
              <div className="kt-page-heading">
                <span className="kt-eyebrow">TU ESPACIO</span>
                <h1>Mi perfil</h1>
                <p>Así te conoce tu comunidad.</p>
              </div>
              <div className="kt-profile-layout">
                <form
                  className="kt-panel kt-profile-form"
                  onSubmit={saveProfile}
                >
                  <CreatorAvatar
                    name={profileDraft.name}
                    avatar={profileDraft.avatar}
                    size={82}
                  />
                  <label>
                    Nombre visible
                    <Input
                      required
                      minLength={2}
                      maxLength={65}
                      value={profileDraft.name}
                      onChange={(e) =>
                        setProfileDraft((d) => ({ ...d, name: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Sobre ti
                    <Textarea
                      rows={4}
                      maxLength={500}
                      value={profileDraft.bio}
                      onChange={(e) =>
                        setProfileDraft((d) => ({ ...d, bio: e.target.value }))
                      }
                      placeholder="Cuéntale algo a tu comunidad…"
                    />
                  </label>
                  <label>
                    Avatar de muestra
                    <Select
                      value={profileDraft.avatar}
                      onValueChange={(value) =>
                        setProfileDraft((d) => ({
                          ...d,
                          avatar: value || "nico",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nico">Avatar 1</SelectItem>
                        <SelectItem value="valeria">Avatar 2</SelectItem>
                        <SelectItem value="alma">Avatar 3</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <Button className="kt-button" disabled={savingProfile}>
                    {savingProfile ? "Guardando…" : "Guardar cambios"}
                  </Button>
                </form>
                <div className="kt-profile-links">
                  <Button variant="outline" onClick={() => navigate("studio")}>
                    <Clapperboard />
                    Mi contenido
                    <ChevronRight />
                  </Button>
                  <Button variant="outline" onClick={() => navigate("members")}>
                    <KeyRound />
                    Mis membresías
                    <ChevronRight />
                  </Button>
                  <Button variant="outline" onClick={() => void walletAction()}>
                    <Wallet />
                    {address ? shortAddress(address) : "Conectar wallet"}
                    <ChevronRight />
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/signout-with-chatgpt?return_to=/" target="_top">
                      <LogOut />
                      Cerrar sesión
                      <ChevronRight />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </main>
        <footer className="kt-footer">
          <span>© 2026 KeyTube</span>
          <span>Descubre. Previsualiza. Desbloquea.</span>
          <a
            href="https://unlock-protocol.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <KeyRound size={14} />
            Unlock Protocol
            <ExternalLink size={13} />
          </a>
        </footer>
      </SidebarInset>
      <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
        <DialogContent className="kt-login-dialog">
          <div className="kt-login-art">
            <Brand large />
            <h2>
              Tu próxima historia
              <br />
              te está esperando.
            </h2>
          </div>
          <div className="kt-login-form">
            <DialogTitle>Bienvenido de nuevo</DialogTitle>
            <DialogDescription>
              Inicia sesión para publicar, seguir creadores y guardar tus
              favoritos.
            </DialogDescription>
            <Button className="kt-button" asChild>
              <a href={signInUrl} target="_top">
                Continuar con ChatGPT
                <ArrowRight size={17} />
              </a>
            </Button>
            <span className="kt-login-separator">Tu acceso exclusivo</span>
            <Button
              variant="outline"
              onClick={() => {
                setLoginOpen(false);
                void walletAction();
              }}
            >
              <Wallet size={18} />
              Conectar wallet
            </Button>
            <p>
              La membresía de Unlock se comprueba al abrir el contenido
              completo.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="kt-preview-dialog">
          <DialogTitle>Vista previa de tu publicación</DialogTitle>
          <DialogDescription>
            Esto es lo que podrán descubrir tus visitantes.
          </DialogDescription>
          <div className="kt-preview-content">
            {assets.thumbnail && (
              <img
                src={`/api/media/${assets.thumbnail.id}?owner=1`}
                alt="Portada de tu publicación"
              />
            )}
            <span className="kt-eyebrow">
              {mediaLabels[draft.type || "text"]} · {draft.category}
            </span>
            <h2>{draft.title || "Título de tu publicación"}</h2>
            <p>{draft.intro || "Tu adelanto aparecerá aquí."}</p>
            <span className="kt-access-badge">
              <LockKeyhole size={13} />
              Contenido completo para miembros
            </span>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta publicación?</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleting?.title}» dejará de estar disponible. Esta acción
              elimina también sus comentarios y enlaces de acceso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void removePost();
              }}
            >
              {deleteBusy ? "Eliminando…" : "Eliminar publicación"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster richColors theme="dark" />
    </SidebarProvider>
  );
}
