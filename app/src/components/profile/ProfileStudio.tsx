import { useMemo, useRef, useState } from "react";
import type { ProfileGame } from "@contracts/types";
import {
  ArrowLeft,
  Camera,
  Check,
  Gamepad2,
  Heart,
  ImagePlus,
  LayoutGrid,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { apiUrl } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProfileAvatar } from "./ProfileAvatar";
import { StyledDisplayName } from "./StyledDisplayName";

const THEMES = [
  { id: "cobalt", label: "Cobalto", surface: "from-[#20275a] to-[#11131a]" },
  { id: "rose", label: "Rosa", surface: "from-[#7c2d5b] to-[#281425]" },
  { id: "mint", label: "Menta", surface: "from-[#155e75] to-[#102424]" },
  { id: "sunset", label: "Pôr do sol", surface: "from-[#9a3412] to-[#3b1732]" },
  {
    id: "midnight",
    label: "Meia-noite",
    surface: "from-[#312e81] to-[#09090b]",
  },
] as const;

const FONTS = [
  ["sans", "Nexora"],
  ["serif", "Editorial"],
  ["rounded", "Amigável"],
  ["mono", "Código"],
  ["display", "Impacto"],
  ["handwritten", "Assinatura"],
] as const;

const EFFECTS = [
  ["solid", "Sólido"],
  ["gradient", "Gradiente"],
  ["neon", "Neon"],
  ["outline", "Contorno"],
  ["pop", "Pop"],
  ["prism", "Prisma"],
] as const;

const DECORATIONS = [
  ["none", "Sem decoração"],
  ["sparkles", "Faíscas"],
  ["crown", "Coroa"],
  ["orbit", "Órbita"],
] as const;

type StudioTab = "identity" | "widgets" | "wishlist";

export function ProfileStudio({
  onBack,
  onClose,
}: {
  onBack: () => void;
  onClose: () => void;
}) {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<StudioTab>("identity");
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [banner, setBanner] = useState(user?.banner ?? "");
  const [profileTheme, setProfileTheme] = useState(
    user?.profileTheme ?? "cobalt"
  );
  const [profileAccent, setProfileAccent] = useState(
    user?.profileAccent ?? "#7383FF"
  );
  const [nameFont, setNameFont] = useState(user?.nameFont ?? "sans");
  const [nameEffect, setNameEffect] = useState(user?.nameEffect ?? "solid");
  const [nameColorA, setNameColorA] = useState(user?.nameColorA ?? "#F4F7FB");
  const [nameColorB, setNameColorB] = useState(user?.nameColorB ?? "#7383FF");
  const [avatarDecoration, setAvatarDecoration] = useState(
    user?.avatarDecoration ?? "none"
  );
  const [profileEffect, setProfileEffect] = useState(
    user?.profileEffect ?? "none"
  );
  const [games, setGames] = useState<ProfileGame[]>(user?.profileGames ?? []);
  const [wishlist, setWishlist] = useState<ProfileGame[]>(
    user?.profileWishlist ?? []
  );
  const [widgets, setWidgets] = useState<string[]>(
    user?.profileWidgets ?? ["games", "favorite"]
  );
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(
    user?.favoriteGameId ?? null
  );
  const [favoriteGameNote, setFavoriteGameNote] = useState(
    user?.favoriteGameNote ?? ""
  );
  const [gameName, setGameName] = useState("");
  const [gameImage, setGameImage] = useState("");
  const [wishName, setWishName] = useState("");
  const [wishImage, setWishImage] = useState("");

  const selectedTheme =
    THEMES.find(theme => theme.id === profileTheme) ?? THEMES[0];
  const favorite = useMemo(
    () => games.find(game => game.id === favoriteGameId) ?? null,
    [favoriteGameId, games]
  );

  const updateProfile = trpc.account.updateProfile.useMutation({
    onSuccess: async () => {
      toast.success("Seu perfil foi atualizado.");
      await refresh();
      await utils.account.getPublicUser.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setUsernameMutation = trpc.account.setUsername.useMutation({
    onError: error => toast.error(error.message),
  });

  const uploadImage = async (file: File, target: "avatar" | "banner") => {
    setUploading(target);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: string;
      };
      if (!response.ok || !payload.url)
        throw new Error(payload.error || "Falha no upload.");
      if (target === "avatar") setAvatar(payload.url);
      else setBanner(payload.url);
      toast.success("Imagem pronta. Salve para publicar.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a imagem."
      );
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (username.trim() && username.trim() !== user?.username) {
      try {
        await setUsernameMutation.mutateAsync({ username: username.trim() });
      } catch {
        return;
      }
    }
    updateProfile.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim(),
      customStatus: customStatus.trim(),
      avatar,
      banner,
      profileTheme: profileTheme as
        "cobalt" | "rose" | "mint" | "sunset" | "midnight",
      profileAccent,
      nameFont: nameFont as
        "sans" | "serif" | "rounded" | "mono" | "display" | "handwritten",
      nameEffect: nameEffect as
        "solid" | "gradient" | "neon" | "outline" | "pop" | "prism",
      nameColorA,
      nameColorB,
      avatarDecoration: avatarDecoration as
        "none" | "sparkles" | "crown" | "orbit",
      profileEffect: profileEffect as
        "none" | "aurora" | "stardust" | "bubbles",
      profileGames: games,
      profileWishlist: wishlist,
      profileWidgets: widgets as Array<
        "games" | "favorite" | "connections" | "activity"
      >,
      favoriteGameId,
      favoriteGameNote,
    });
  };

  const addGame = (kind: "games" | "wishlist") => {
    const name = kind === "games" ? gameName.trim() : wishName.trim();
    const imageUrl = kind === "games" ? gameImage.trim() : wishImage.trim();
    if (!name) return;
    const item = { id: crypto.randomUUID(), name, imageUrl: imageUrl || null };
    if (kind === "games") {
      setGames(current => [...current, item].slice(0, 20));
      setGameName("");
      setGameImage("");
    } else {
      setWishlist(current => [...current, item].slice(0, 20));
      setWishName("");
      setWishImage("");
    }
  };

  const toggleWidget = (id: string) => {
    setWidgets(current =>
      current.includes(id)
        ? current.filter(widget => widget !== id)
        : [...current, id]
    );
  };

  return (
    <div className="min-h-full bg-[#12141b] text-white">
      <header className="flex min-h-14 items-center justify-between border-b border-white/10 px-4 sm:px-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Configurações
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">Estúdio de perfil</p>
          <p className="hidden text-[10px] text-white/45 sm:block">
            As mudanças aparecem na prévia em tempo real
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={save}
            disabled={updateProfile.isPending || Boolean(uploading)}
            className="h-9 bg-[#5865F2] px-3 text-xs hover:bg-[#4752C4]"
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {updateProfile.isPending ? "Salvando" : "Salvar"}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar configurações"
            title="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-[calc(100dvh-7rem)] grid-cols-1 xl:grid-cols-[240px_360px_minmax(320px,1fr)]">
        <aside className="border-b border-white/10 bg-[#191b24] p-4 xl:border-b-0 xl:border-r">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Visual
          </p>
          <ControlLabel>Placa de identificação</ControlLabel>
          <div className="grid grid-cols-5 gap-2">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                type="button"
                title={theme.label}
                aria-label={`Tema ${theme.label}`}
                onClick={() => setProfileTheme(theme.id)}
                className={cn(
                  "relative h-10 rounded-lg bg-gradient-to-br",
                  theme.surface,
                  profileTheme === theme.id &&
                    "ring-2 ring-white ring-offset-2 ring-offset-[#191b24]"
                )}
              >
                {profileTheme === theme.id && (
                  <Check className="absolute inset-0 m-auto h-4 w-4" />
                )}
              </button>
            ))}
          </div>

          <ControlLabel>Cor de destaque</ControlLabel>
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
            <input
              type="color"
              value={profileAccent}
              onChange={event => setProfileAccent(event.target.value)}
              className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
            />
            <span className="text-xs font-semibold text-white/70">
              {profileAccent.toUpperCase()}
            </span>
          </label>

          <ControlLabel>Avatar e decoração</ControlLabel>
          <button
            type="button"
            onClick={() => avatarRef.current?.click()}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
          >
            <ProfileAvatar
              userId={user?.id}
              name={displayName}
              src={avatar || null}
              decoration={avatarDecoration}
              size="lg"
            />
            <span>
              <span className="block text-xs font-bold">Alterar avatar</span>
              <span className="text-[10px] text-white/45">
                PNG, JPG, WEBP ou GIF
              </span>
            </span>
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={event => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file, "avatar");
              event.target.value = "";
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            {DECORATIONS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setAvatarDecoration(id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-[11px] font-semibold",
                  avatarDecoration === id
                    ? "border-[#7383FF] bg-[#5865F2]/20 text-white"
                    : "border-white/10 bg-white/5 text-white/55"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <ControlLabel>Fonte do nome</ControlLabel>
          <div className="grid grid-cols-2 gap-2">
            {FONTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setNameFont(id)}
                className={cn(
                  "rounded-lg border p-2 text-left",
                  nameFont === id
                    ? "border-[#7383FF] bg-[#5865F2]/20"
                    : "border-white/10 bg-white/5"
                )}
              >
                <StyledDisplayName
                  font={id}
                  effect="solid"
                  colorA="#F4F7FB"
                  className="text-xs"
                >
                  {label}
                </StyledDisplayName>
              </button>
            ))}
          </div>

          <ControlLabel>Efeito do nome</ControlLabel>
          <div className="grid grid-cols-2 gap-2">
            {EFFECTS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setNameEffect(id)}
                className={cn(
                  "rounded-lg border p-2 text-xs font-bold",
                  nameEffect === id
                    ? "border-[#7383FF] bg-[#5865F2]/20"
                    : "border-white/10 bg-white/5"
                )}
              >
                <StyledDisplayName
                  font={nameFont}
                  effect={id}
                  colorA={nameColorA}
                  colorB={nameColorB}
                >
                  {label}
                </StyledDisplayName>
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              aria-label="Primeira cor do nome"
              type="color"
              value={nameColorA}
              onChange={event => setNameColorA(event.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 p-1"
            />
            <input
              aria-label="Segunda cor do nome"
              type="color"
              value={nameColorB}
              onChange={event => setNameColorB(event.target.value)}
              className="h-10 w-full rounded-lg border border-white/10 bg-white/5 p-1"
            />
          </div>
        </aside>

        <section
          className={cn(
            "relative min-h-[620px] overflow-hidden border-b border-white/10 bg-gradient-to-b p-5 xl:border-b-0 xl:border-r",
            selectedTheme.surface
          )}
        >
          {profileEffect !== "none" && (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-40",
                profileEffect === "aurora" &&
                  "bg-[radial-gradient(circle_at_20%_10%,rgba(115,131,255,.7),transparent_38%),radial-gradient(circle_at_80%_50%,rgba(34,211,238,.35),transparent_35%)]",
                profileEffect === "stardust" &&
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.7)_0_1px,transparent_2px)] bg-[length:34px_34px]",
                profileEffect === "bubbles" &&
                  "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.3),transparent_12%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,.2),transparent_16%)]"
              )}
            />
          )}
          <div className="relative mx-auto mt-4 max-w-sm overflow-hidden rounded-[22px] border border-white/15 bg-black/25 shadow-2xl backdrop-blur-xl">
            <div className="relative h-36 overflow-hidden bg-black/20">
              {banner ? (
                <img
                  src={banner}
                  alt="Prévia do banner"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "h-full w-full bg-gradient-to-br",
                    selectedTheme.surface
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-[10px] font-bold backdrop-blur hover:bg-black/70"
              >
                <Camera className="h-3 w-3" /> Banner
              </button>
              <input
                ref={bannerRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void uploadImage(file, "banner");
                  event.target.value = "";
                }}
              />
            </div>
            <div className="relative px-5 pb-5">
              <ProfileAvatar
                className="-mt-11"
                userId={user?.id}
                name={displayName}
                src={avatar || null}
                decoration={avatarDecoration}
                status="online"
                size="2xl"
              />
              <div className="mt-3 min-w-0">
                <StyledDisplayName
                  font={nameFont}
                  effect={nameEffect}
                  colorA={nameColorA}
                  colorB={nameColorB}
                  className="text-2xl"
                >
                  {displayName || "Seu nome"}
                </StyledDisplayName>
                <p className="mt-0.5 truncate text-xs text-white/65">
                  @{username || "usuario"}
                </p>
                {customStatus && (
                  <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/80">
                    {customStatus}
                  </p>
                )}
                {bio && (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/80">
                    {bio}
                  </p>
                )}
              </div>
              {widgets.includes("games") && games.length > 0 && (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Jogos que eu gosto
                  </p>
                  <div className="mt-2 flex gap-2 overflow-hidden">
                    {games.slice(0, 4).map(game => (
                      <GameTile key={game.id} game={game} />
                    ))}
                  </div>
                </div>
              )}
              {widgets.includes("favorite") && favorite && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.07] p-3">
                  <GameTile game={favorite} large />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-white/45">
                      Jogo favorito
                    </p>
                    <p className="truncate text-sm font-bold">
                      {favorite.name}
                    </p>
                    {favoriteGameNote && (
                      <p className="mt-1 line-clamp-2 text-xs text-white/60">
                        {favoriteGameNote}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="min-w-0 bg-[#f4f5fb] text-[#171923]">
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-4 pt-4 sm:px-6">
            <StudioTabButton
              active={tab === "identity"}
              onClick={() => setTab("identity")}
              icon={<Sparkles className="h-3.5 w-3.5" />}
            >
              Identidade
            </StudioTabButton>
            <StudioTabButton
              active={tab === "widgets"}
              onClick={() => setTab("widgets")}
              icon={<LayoutGrid className="h-3.5 w-3.5" />}
            >
              Mural
            </StudioTabButton>
            <StudioTabButton
              active={tab === "wishlist"}
              onClick={() => setTab("wishlist")}
              icon={<Heart className="h-3.5 w-3.5" />}
            >
              Desejos
            </StudioTabButton>
          </div>
          <div className="space-y-5 p-4 pb-24 sm:p-6">
            {tab === "identity" && (
              <>
                <SectionHeading
                  title="Informações do perfil"
                  description="Tudo abaixo aparece imediatamente na prévia."
                />
                <Field label="Nome de exibição">
                  <Input
                    value={displayName}
                    maxLength={64}
                    onChange={event => setDisplayName(event.target.value)}
                    className="border-black/10 bg-white"
                  />
                </Field>
                <Field label="Nome de usuário">
                  <Input
                    value={username}
                    onChange={event =>
                      setUsername(event.target.value.toLowerCase())
                    }
                    className="border-black/10 bg-white"
                  />
                </Field>
                <Field label="Status personalizado">
                  <Input
                    value={customStatus}
                    maxLength={128}
                    onChange={event => setCustomStatus(event.target.value)}
                    placeholder="O que você está fazendo?"
                    className="border-black/10 bg-white"
                  />
                </Field>
                <Field label="Sobre mim">
                  <Textarea
                    value={bio}
                    maxLength={500}
                    onChange={event => setBio(event.target.value)}
                    rows={5}
                    className="border-black/10 bg-white"
                  />
                </Field>
                <Field label="Efeito do perfil">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["none", "Nenhum"],
                      ["aurora", "Aurora"],
                      ["stardust", "Poeira estelar"],
                      ["bubbles", "Bolhas"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setProfileEffect(id)}
                        className={cn(
                          "rounded-xl border p-3 text-left text-xs font-bold",
                          profileEffect === id
                            ? "border-[#5865F2] bg-[#5865F2]/10 text-[#4654D8]"
                            : "border-black/10 bg-white"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            {tab === "widgets" && (
              <>
                <SectionHeading
                  title="Seu mural"
                  description="Escolha os blocos exibidos e monte sua coleção."
                />
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["games", "Jogos que eu gosto"],
                    ["favorite", "Jogo favorito"],
                    ["connections", "Conexões"],
                    ["activity", "Atividades"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleWidget(id)}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold",
                        widgets.includes(id)
                          ? "border-[#5865F2] bg-[#5865F2]/10 text-[#4654D8]"
                          : "border-black/10 bg-white"
                      )}
                    >
                      <span>{label}</span>
                      {widgets.includes(id) && <Check className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
                <GameComposer
                  title="Adicionar jogo"
                  name={gameName}
                  image={gameImage}
                  onName={setGameName}
                  onImage={setGameImage}
                  onAdd={() => addGame("games")}
                />
                <GameList
                  games={games}
                  favoriteId={favoriteGameId}
                  onFavorite={setFavoriteGameId}
                  onRemove={id => {
                    setGames(current => current.filter(game => game.id !== id));
                    if (favoriteGameId === id) setFavoriteGameId(null);
                  }}
                />
                {favorite && (
                  <Field label="Por que este é seu favorito?">
                    <Textarea
                      value={favoriteGameNote}
                      maxLength={240}
                      onChange={event =>
                        setFavoriteGameNote(event.target.value)
                      }
                      rows={3}
                      className="border-black/10 bg-white"
                    />
                  </Field>
                )}
              </>
            )}
            {tab === "wishlist" && (
              <>
                <SectionHeading
                  title="Lista de desejos"
                  description="Adicione jogos que você quer descobrir ou jogar depois."
                />
                <GameComposer
                  title="Adicionar à lista"
                  name={wishName}
                  image={wishImage}
                  onName={setWishName}
                  onImage={setWishImage}
                  onAdd={() => addGame("wishlist")}
                />
                <GameList
                  games={wishlist}
                  onRemove={id =>
                    setWishlist(current =>
                      current.filter(game => game.id !== id)
                    )
                  }
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ControlLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 mt-5 text-[11px] font-bold text-white/65">{children}</p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-[#343746]">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-xs text-[#666a7a]">{description}</p>
    </div>
  );
}

function StudioTabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-xs font-bold",
        active
          ? "border-[#4654D8] text-[#343eb7]"
          : "border-transparent text-[#6b6f7d] hover:text-[#171923]"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function GameTile({
  game,
  large = false,
}: {
  game: ProfileGame;
  large?: boolean;
}) {
  return game.imageUrl ? (
    <img
      src={game.imageUrl}
      alt={game.name}
      className={cn(
        "h-16 w-12 shrink-0 rounded-lg object-cover",
        large && "h-20 w-16"
      )}
    />
  ) : (
    <span
      className={cn(
        "flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10",
        large && "h-20 w-16"
      )}
    >
      <Gamepad2 className="h-5 w-5" />
    </span>
  );
}

function GameComposer({
  title,
  name,
  image,
  onName,
  onImage,
  onAdd,
}: {
  title: string;
  name: string;
  image: string;
  onName: (value: string) => void;
  onImage: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4">
      <p className="mb-3 text-sm font-black">{title}</p>
      <div className="space-y-2">
        <Input
          value={name}
          onChange={event => onName(event.target.value)}
          placeholder="Nome do jogo"
          className="border-black/10"
        />
        <Input
          value={image}
          onChange={event => onImage(event.target.value)}
          placeholder="URL da capa (opcional)"
          className="border-black/10"
        />
        <Button
          type="button"
          onClick={onAdd}
          disabled={!name.trim()}
          className="w-full bg-[#5865F2] hover:bg-[#4752C4]"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function GameList({
  games,
  favoriteId,
  onFavorite,
  onRemove,
}: {
  games: ProfileGame[];
  favoriteId?: string | null;
  onFavorite?: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  if (!games.length)
    return (
      <div className="rounded-2xl border border-dashed border-black/15 bg-white/50 p-8 text-center">
        <ImagePlus className="mx-auto h-6 w-6 text-[#8b8e9b]" />
        <p className="mt-2 text-xs font-semibold text-[#6b6f7d]">
          Nenhum jogo adicionado ainda.
        </p>
      </div>
    );
  return (
    <div className="space-y-2">
      {games.map(game => (
        <div
          key={game.id}
          className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-2.5"
        >
          <GameTile game={game} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{game.name}</p>
            {onFavorite && (
              <button
                type="button"
                onClick={() => onFavorite(game.id)}
                className={cn(
                  "mt-1 inline-flex items-center gap-1 text-[10px] font-bold",
                  favoriteId === game.id ? "text-[#4654D8]" : "text-[#777b89]"
                )}
              >
                <Heart
                  className={cn(
                    "h-3 w-3",
                    favoriteId === game.id && "fill-current"
                  )}
                />
                {favoriteId === game.id ? "Favorito" : "Definir favorito"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(game.id)}
            aria-label={`Remover ${game.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#8b3d49] hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
