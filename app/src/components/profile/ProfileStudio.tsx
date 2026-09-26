import { useMemo, useRef, useState } from "react";
import type { ProfileGame } from "@contracts/types";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Eye,
  Gamepad2,
  Gift,
  Heart,
  ImagePlus,
  MessageSquare,
  Palette,
  Plus,
  Save,
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
import { BannerCropper } from "./BannerCropper";
import { DisplayNameStyleModal } from "./DisplayNameStyleModal";
import { AvatarDecorationModal } from "./AvatarDecorationModal";
import { AvatarPickerModal } from "./AvatarPickerModal";
import { getAvatarDecoration, normalizeAvatarDecorationId } from "@/lib/avatarDecorations";
import { rememberAvatar } from "@/lib/recentAvatars";
import {
  getNameFont,
  normalizeNameColor,
  normalizeNameEffectId,
  normalizeNameFontId,
  type NameStyle,
} from "@/lib/nameStyle";

/**
 * Estúdio de perfil.
 *
 * O layout reproduz o do Discord: uma coluna estreita à esquerda com os
 * controles de aparência (avatar e decorações, estilo do nome, tema e caixa,
 * efeitos de perfil), o cartão do perfil ao centro com edição direta no lugar,
 * e à direita as abas Mural, Atividade e Lista de desejos com os widgets.
 *
 * Nada é gravado a cada clique: os controles mexem em estado local e o botão
 * "Salvar" é o único ponto de envio, para o usuário poder experimentar sem
 * sujar o perfil público.
 */

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

const PROFILE_EFFECTS = [
  { id: "none", label: "Nenhum" },
  { id: "aurora", label: "Aurora" },
  { id: "stardust", label: "Poeira estelar" },
  { id: "bubbles", label: "Bolhas" },
] as const;

const WIDGETS = [
  { id: "games", label: "Jogos que eu gosto" },
  { id: "favorite", label: "Jogo favorito" },
  { id: "connections", label: "Conexões" },
  { id: "activity", label: "Atividade" },
] as const;

const WIDGET_LABEL: Record<string, string> = Object.fromEntries(
  WIDGETS.map(widget => [widget.id, widget.label]),
);

const MAX_GAMES = 20;

type StudioTab = "mural" | "activity" | "wishlist";
type EditingField = "displayName" | "username" | "customStatus" | "bio" | null;

export function ProfileStudio({
  onBack,
  onClose,
}: {
  onBack: () => void;
  onClose: () => void;
}) {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const bannerRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<StudioTab>("mural");
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [decorationOpen, setDecorationOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<EditingField>(null);

  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [customStatus, setCustomStatus] = useState(user?.customStatus ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [banner, setBanner] = useState(user?.banner ?? "");
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [profileTheme, setProfileTheme] = useState(user?.profileTheme ?? "cobalt");
  const [profileAccent, setProfileAccent] = useState(user?.profileAccent ?? "#7383FF");
  const [nameFont, setNameFont] = useState(() => normalizeNameFontId(user?.nameFont));
  const [nameEffect, setNameEffect] = useState(() =>
    normalizeNameEffectId(user?.nameEffect),
  );
  const [nameColorA, setNameColorA] = useState(
    normalizeNameColor(user?.nameColorA, "#F4F7FB"),
  );
  const [nameColorB, setNameColorB] = useState(
    normalizeNameColor(user?.nameColorB, "#7383FF"),
  );
  const [avatarDecoration, setAvatarDecoration] = useState(() =>
    normalizeAvatarDecorationId(user?.avatarDecoration),
  );
  const [profileEffect, setProfileEffect] = useState(user?.profileEffect ?? "none");
  const [games, setGames] = useState<ProfileGame[]>(user?.profileGames ?? []);
  const [wishlist, setWishlist] = useState<ProfileGame[]>(user?.profileWishlist ?? []);
  const [widgets, setWidgets] = useState<string[]>(
    user?.profileWidgets ?? ["games", "favorite"],
  );
  const [favoriteGameId, setFavoriteGameId] = useState<string | null>(
    user?.favoriteGameId ?? null,
  );
  const [favoriteGameNote, setFavoriteGameNote] = useState(user?.favoriteGameNote ?? "");
  const [gameName, setGameName] = useState("");
  const [gameImage, setGameImage] = useState("");
  const [wishName, setWishName] = useState("");
  const [wishImage, setWishImage] = useState("");

  const selectedTheme = THEMES.find(theme => theme.id === profileTheme) ?? THEMES[0];
  const favorite = useMemo(
    () => games.find(game => game.id === favoriteGameId) ?? null,
    [favoriteGameId, games],
  );
  const badges = trpc.badge.mine.useQuery(undefined, { staleTime: 60_000 });
  const memberSince = user?.createdAt ?? null;

  const nameStyle: NameStyle = { font: nameFont, effect: nameEffect, colorA: nameColorA, colorB: nameColorB };

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

  const uploadTo = async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(apiUrl("/api/upload"), {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const payload = (await response.json()) as { url?: string; error?: string };
    if (!response.ok || !payload.url)
      throw new Error(payload.error || "Falha no upload.");
    return payload.url;
  };

  const uploadImage = async (file: File, target: "avatar" | "banner") => {
    if (target === "banner") {
      setCropperFile(file);
      return;
    }
    setUploading(target);
    try {
      const uploaded = await uploadTo(file);
      setAvatar(uploaded);
      // Vira "Avatares Recentes" no modal de seleção de imagem.
      rememberAvatar(uploaded);
      toast.success("Avatar pronto. Salve para publicar.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploading(null);
    }
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropperFile(null);
    setUploading("banner");
    try {
      setBanner(await uploadTo(croppedFile));
      toast.success("Banner recortado e enviado. Salve para publicar.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar o banner.",
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
      profileTheme: profileTheme as (typeof THEMES)[number]["id"],
      profileAccent,
      nameFont,
      nameEffect,
      nameColorA,
      nameColorB,
      avatarDecoration,
      profileEffect: profileEffect as (typeof PROFILE_EFFECTS)[number]["id"],
      profileGames: games,
      profileWishlist: wishlist,
      profileWidgets: widgets as Array<(typeof WIDGETS)[number]["id"]>,
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
      if (games.length >= MAX_GAMES) {
        toast.error(`Você pode adicionar até ${MAX_GAMES} jogos.`);
        return;
      }
      setGames(current => [...current, item]);
      setGameName("");
      setGameImage("");
    } else {
      setWishlist(current => [...current, item]);
      setWishName("");
      setWishImage("");
    }
  };

  const toggleWidget = (id: string) =>
    setWidgets(current =>
      current.includes(id) ? current.filter(widget => widget !== id) : [...current, id],
    );

  return (
    <div className="flex min-h-full flex-col bg-[#f4f5fb] text-[#171923]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-black/10 px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#4b505f] transition-colors hover:text-[#171923]"
        >
          <ArrowLeft className="h-4 w-4" />
          Configurações
        </button>
        <div className="mx-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold"
            aria-label="Trocar de perfil"
          >
            Perfil principal
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <ChevronDown className="h-4 w-4 rotate-90 text-[#8b8e9b]" aria-hidden />
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
            aria-label="Fechar configurações"
            className="grid size-8 place-items-center rounded-full border border-black/10 text-[#5c6270] transition-colors hover:bg-black/5 hover:text-[#171923]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[240px_380px_minmax(320px,1fr)]">
        {/* ───────────── Coluna de controle ───────────── */}
        <aside className="space-y-5 border-b border-black/10 bg-[#eceef7] p-4 xl:border-b-0 xl:border-r">
          <ControlGroup label="Avatar e decorações">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="group relative flex aspect-square items-center justify-center rounded-xl border border-black/10 bg-white transition-colors hover:border-black/25"
                aria-label="Selecione uma imagem"
              >
                <ProfileAvatar
                  userId={user?.id}
                  name={displayName}
                  src={avatar || null}
                  decoration={avatarDecoration}
                  size="xl"
                />
                <span className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1 text-[10px] font-bold text-[#4b505f] opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="size-3" aria-hidden />
                  {uploading === "avatar" ? "Enviando" : "Trocar foto"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDecorationOpen(true)}
                className="group relative flex aspect-square items-center justify-center rounded-xl border border-black/10 bg-white transition-colors hover:border-black/25"
                aria-label="Mudar decoração de avatar"
              >
                <ProfileAvatar
                  userId={undefined}
                  name={displayName}
                  src={avatar || null}
                  decoration={avatarDecoration}
                  size="xl"
                />
                <span className="absolute inset-x-0 bottom-2 rounded-md bg-black/60 py-1 text-[10px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Mudar
                </span>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-[#6b6f7d]">
              {getAvatarDecoration(avatarDecoration).label}
            </p>
          </ControlGroup>

          <ControlGroup label="Estilo do nome exibido">
            <button
              type="button"
              onClick={() => setStyleOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-4 transition-colors hover:border-black/25"
            >
              <StyledDisplayName
                font={nameFont}
                effect={nameEffect}
                colorA={nameColorA}
                colorB={nameColorB}
                className="text-lg"
              >
                {displayName || "Seu nome"}
              </StyledDisplayName>
            </button>
            <p className="mt-1.5 text-center text-[10px] text-[#6b6f7d]">
              {getNameFont(nameFont).label}
              {nameEffect !== "solid" ? ` · ${nameEffect}` : ""}
            </p>
          </ControlGroup>

          <ControlGroup label="Tema e caixa">
            <div className="grid grid-cols-2 gap-2">
              <label className="cursor-pointer">
                <span className="block overflow-hidden rounded-xl border border-black/10">
                  <span
                    className={cn("block h-16 bg-gradient-to-br", selectedTheme.surface)}
                  />
                </span>
                <input
                  type="color"
                  value={profileAccent}
                  onChange={event => setProfileAccent(event.target.value)}
                  className="sr-only"
                  aria-label="Cor de destaque"
                />
                <span className="mt-1 block text-center text-[10px] font-bold text-[#6b6f7d]">
                  {profileAccent.toUpperCase()}
                </span>
              </label>
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                className="overflow-hidden rounded-xl border border-black/10 bg-white transition-colors hover:border-black/25"
              >
                {banner ? (
                  <img src={banner} alt="Caixa atual" className="h-16 w-full object-cover" />
                ) : (
                  <span className={cn("block h-16 bg-gradient-to-br", selectedTheme.surface)} />
                )}
                <span className="block px-1 py-1 text-[10px] font-bold text-[#6b6f7d]">
                  Caixa
                </span>
              </button>
            </div>
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
            <div className="mt-2 grid grid-cols-5 gap-1.5">
              {THEMES.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  title={theme.label}
                  aria-label={`Tema ${theme.label}`}
                  aria-pressed={profileTheme === theme.id}
                  onClick={() => setProfileTheme(theme.id)}
                  className={cn(
                    "relative h-8 rounded-lg bg-gradient-to-br",
                    theme.surface,
                    profileTheme === theme.id && "ring-2 ring-[#5865F2] ring-offset-1",
                  )}
                >
                  {profileTheme === theme.id && <Check className="absolute inset-0 m-auto h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup label="Efeitos de perfil e molduras">
            <div className="grid grid-cols-4 gap-1.5">
              {PROFILE_EFFECTS.map(effect => (
                <button
                  key={effect.id}
                  type="button"
                  onClick={() => setProfileEffect(effect.id)}
                  aria-pressed={profileEffect === effect.id}
                  className={cn(
                    "aspect-square rounded-lg border p-1 transition-colors",
                    profileEffect === effect.id
                      ? "border-[#5865F2] bg-[#5865F2]/10"
                      : "border-black/10 bg-white hover:border-black/25",
                  )}
                  title={effect.label}
                >
                  <span
                    className={cn(
                      "block size-full rounded-md",
                      effect.id === "none" && "bg-white/60",
                      effect.id === "aurora" &&
                        "bg-[radial-gradient(circle_at_30%_20%,#7383ff,transparent_60%),radial-gradient(circle_at_70%_80%,#22d3ee,transparent_60%)]",
                      effect.id === "stardust" &&
                        "bg-[radial-gradient(circle_at_30%_30%,#fff_0_1px,transparent_2px)]",
                      effect.id === "bubbles" &&
                        "bg-[radial-gradient(circle_at_35%_35%,#fff6,transparent_35%),radial-gradient(circle_at_70%_70%,#fff4,transparent_40%)]",
                    )}
                  />
                </button>
              ))}
            </div>
          </ControlGroup>
        </aside>

        {/* ───────────── Cartão do perfil ───────────── */}
        <section
          className={cn(
            "relative overflow-hidden border-b border-black/10 p-5 xl:border-b-0 xl:border-r",
            selectedTheme.surface,
          )}
        >
          {profileEffect !== "none" && (
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-50",
                profileEffect === "aurora" &&
                  "bg-[radial-gradient(circle_at_20%_10%,rgba(115,131,255,.7),transparent_38%),radial-gradient(circle_at_80%_50%,rgba(34,211,238,.35),transparent_35%)]",
                profileEffect === "stardust" &&
                  "bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.7)_0_1px,transparent_2px)] bg-[length:34px_34px]",
                profileEffect === "bubbles" &&
                  "bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,.3),transparent_12%),radial-gradient(circle_at_70%_65%,rgba(255,255,255,.2),transparent_16%)]",
              )}
            />
          )}

          <div className="relative mx-auto max-w-sm overflow-hidden rounded-[22px] bg-white text-[#171923] shadow-2xl">
            <div className="relative h-36">
              {banner ? (
                <img src={banner} alt="Banner" className="size-full object-cover" />
              ) : (
                <div className={cn("size-full bg-gradient-to-br", selectedTheme.surface)} />
              )}
              <button
                type="button"
                onClick={() => bannerRef.current?.click()}
                className="absolute right-3 top-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-black/55 px-3 text-[10px] font-bold text-white backdrop-blur hover:bg-black/70"
              >
                <Camera className="h-3 w-3" /> Banner
              </button>
            </div>

            <div className="px-5 pb-5">
              <ProfileAvatar
                className="-mt-12 border-4 border-white"
                userId={user?.id}
                name={displayName}
                src={avatar || null}
                decoration={avatarDecoration}
                status="online"
                size="2xl"
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {editing === "displayName" ? (
                  <Input
                    autoFocus
                    value={displayName}
                    maxLength={64}
                    onChange={event => setDisplayName(event.target.value)}
                    onBlur={() => setEditing(null)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === "Escape") setEditing(null);
                    }}
                    className="h-8 w-48 border-black/15"
                    aria-label="Nome de exibição"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing("displayName")}
                    className="min-w-0 text-left"
                  >
                    <StyledDisplayName
                      font={nameFont}
                      effect={nameEffect}
                      colorA={nameColorA}
                      colorB={nameColorB}
                      className="text-2xl"
                    >
                      {displayName || "Seu nome"}
                    </StyledDisplayName>
                  </button>
                )}
              </div>

              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#5c6270]">
                {editing === "username" ? (
                  <Input
                    autoFocus
                    value={username}
                    onChange={event => setUsername(event.target.value.toLowerCase())}
                    onBlur={() => setEditing(null)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === "Escape") setEditing(null);
                    }}
                    className="h-7 w-44 border-black/15"
                    aria-label="Nome de usuário"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing("username")}
                    className="truncate hover:underline"
                    title="Alterar nome de usuário"
                  >
                    @{username || "usuario"}
                  </button>
                )}
                <span className="rounded-full bg-[#5865F2]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#4654d8]">
                  {customStatus.trim() || "cute"}
                </span>
              </p>

              {badges.data && badges.data.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badges.data.slice(0, 6).map(badge => (
                    <span
                      key={badge.id}
                      title={badge.description ?? badge.name}
                      className="rounded-full bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-bold text-[#4654d8]"
                    >
                      {badge.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toast.info("A mensagem direta já está no topo da sua lista.")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 text-[11px] font-bold text-white transition-colors hover:bg-[#4752C4]"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Mensagem
                </button>
                <button
                  type="button"
                  onClick={() => toast.info("Presentes de perfil chegam em breve.")}
                  aria-label="Enviar presente"
                  className="grid size-8 place-items-center rounded-lg bg-[#f0f1f5] text-[#4b505f] transition-colors hover:bg-black/10"
                >
                  <Gift className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-4">
                {editing === "customStatus" ? (
                  <Input
                    autoFocus
                    value={customStatus}
                    maxLength={128}
                    onChange={event => setCustomStatus(event.target.value)}
                    onBlur={() => setEditing(null)}
                    onKeyDown={event => {
                      if (event.key === "Enter" || event.key === "Escape") setEditing(null);
                    }}
                    placeholder="O que você está fazendo?"
                    className="h-8 border-black/15"
                    aria-label="Status personalizado"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing("customStatus")}
                    className="w-full rounded-lg bg-[#f0f1f5] px-2.5 py-1.5 text-left text-[11px] text-[#4b505f] hover:bg-black/5"
                  >
                    {customStatus || "Definir status"}
                  </button>
                )}
              </div>

              <div className="mt-4">
                {editing === "bio" ? (
                  <Textarea
                    autoFocus
                    value={bio}
                    maxLength={500}
                    rows={4}
                    onChange={event => setBio(event.target.value)}
                    onBlur={() => setEditing(null)}
                    className="border-black/15"
                    aria-label="Sobre mim"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing("bio")}
                    className="block w-full rounded-lg px-1 py-1 text-left text-[13px] leading-relaxed text-[#2b2f3a] hover:bg-black/[0.03]"
                  >
                    {bio || "Escreva algo sobre você"}
                  </button>
                )}
                <p className="mt-1 px-1 text-right text-[10px] text-[#8b8e9b]">
                  {bio.length}/500
                </p>
              </div>

              {memberSince && (
                <div className="mt-4 border-t border-black/10 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b8e9b]">
                    Membro desde
                  </p>
                  <p className="mt-0.5 text-[13px] text-[#2b2f3a]">
                    {new Date(memberSince).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}

              {widgets.includes("games") && games.length > 0 && (
                <div className="mt-4 rounded-xl border border-black/10 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8b8e9b]">
                    Jogos que eu gosto
                  </p>
                  <div className="mt-2 flex gap-2 overflow-x-auto">
                    {games.slice(0, 6).map(game => (
                      <GameTile key={game.id} game={game} />
                    ))}
                  </div>
                </div>
              )}

              {widgets.includes("favorite") && favorite && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-black/10 p-3">
                  <GameTile game={favorite} large />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase text-[#8b8e9b]">
                      Jogo favorito
                    </p>
                    <p className="truncate text-sm font-bold">{favorite.name}</p>
                    {favoriteGameNote && (
                      <p className="mt-1 line-clamp-2 text-[11px] text-[#5c6270]">
                        {favoriteGameNote}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ───────────── Coluna direita ───────────── */}
        <section className="min-w-0">
          <div className="flex gap-1 overflow-x-auto border-b border-black/10 px-4 pt-3 sm:px-6">
            <StudioTabButton active={tab === "mural"} onClick={() => setTab("mural")}>
              Mural
            </StudioTabButton>
            <StudioTabButton active={tab === "activity"} onClick={() => setTab("activity")}>
              Atividade
            </StudioTabButton>
            <StudioTabButton active={tab === "wishlist"} onClick={() => setTab("wishlist")}>
              Lista de desejos
            </StudioTabButton>
          </div>

          <div className="space-y-5 p-4 pb-24 sm:p-6">
            {tab === "mural" && (
              <>
                <section className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-black">Seus Widgets</h2>
                    <Button
                      size="sm"
                      onClick={() =>
                        setTab("activity")
                      }
                      className="h-8 bg-[#5865F2] px-2.5 text-[11px] hover:bg-[#4752C4]"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Adicionar widget
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {WIDGETS.map(widget => (
                      <button
                        key={widget.id}
                        type="button"
                        onClick={() => toggleWidget(widget.id)}
                        aria-pressed={widgets.includes(widget.id)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border p-3 text-left text-xs font-bold transition-colors",
                          widgets.includes(widget.id)
                            ? "border-[#5865F2] bg-[#5865F2]/10 text-[#4654d8]"
                            : "border-black/10 bg-[#f7f8fc] text-[#6b6f7d] hover:border-black/25",
                        )}
                      >
                        <span>{widget.label}</span>
                        {widgets.includes(widget.id) && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                  {widgets.length === 0 && (
                    <p className="mt-2 text-[11px] text-[#8b8e9b]">
                      Sem widgets, seu mural fica vazio na página de perfil.
                    </p>
                  )}
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-sm font-black">Jogos que eu gosto</h2>
                    <span className="text-[11px] text-[#8b8e9b]">
                      Adicionar até {MAX_GAMES} jogos
                    </span>
                  </div>
                  <GameComposer
                    title="Adicionar jogo"
                    name={gameName}
                    image={gameImage}
                    onName={setGameName}
                    onImage={setGameImage}
                    onAdd={() => addGame("games")}
                  />
                  <div className="mt-2">
                    <GameList
                      games={games}
                      favoriteId={favoriteGameId}
                      onFavorite={setFavoriteGameId}
                      onRemove={id => {
                        setGames(current => current.filter(game => game.id !== id));
                        if (favoriteGameId === id) setFavoriteGameId(null);
                      }}
                    />
                  </div>
                </section>

                {favorite && (
                  <Field label="Por que este é seu favorito?">
                    <Textarea
                      value={favoriteGameNote}
                      maxLength={240}
                      onChange={event => setFavoriteGameNote(event.target.value)}
                      rows={3}
                      className="border-black/10 bg-white"
                    />
                  </Field>
                )}
              </>
            )}

            {tab === "activity" && (
              <section>
                <h2 className="text-sm font-black">Widgets do perfil</h2>
                <p className="mt-1 text-xs text-[#666a7a]">
                  Escolha o que aparece no seu mural, na página de perfil e no
                  cartão que as outras pessoas veem.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {WIDGETS.map(widget => (
                    <button
                      key={widget.id}
                      type="button"
                      onClick={() => toggleWidget(widget.id)}
                      aria-pressed={widgets.includes(widget.id)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-colors",
                        widgets.includes(widget.id)
                          ? "border-[#5865F2] bg-[#5865F2]/10"
                          : "border-black/10 bg-white hover:border-black/25",
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs font-bold">
                        {widgets.includes(widget.id) ? (
                          <Check className="h-3.5 w-3.5 text-[#4654d8]" />
                        ) : (
                          <Palette className="h-3.5 w-3.5 text-[#8b8e9b]" />
                        )}
                        {WIDGET_LABEL[widget.id]}
                      </span>
                      <span className="mt-1 block text-[10px] text-[#8b8e9b]">
                        {widgets.includes(widget.id)
                          ? "Visível no seu perfil"
                          : "Oculto"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {tab === "wishlist" && (
              <section>
                <h2 className="text-sm font-black">Lista de desejos</h2>
                <p className="mt-1 text-xs text-[#666a7a]">
                  Jogos que você quer descobrir ou jogar depois. Eles não contam
                  para o mural enquanto não forem movidos para “Jogos que eu gosto”.
                </p>
                <GameComposer
                  title="Adicionar à lista"
                  name={wishName}
                  image={wishImage}
                  onName={setWishName}
                  onImage={setWishImage}
                  onAdd={() => addGame("wishlist")}
                />
                <div className="mt-2">
                  <GameList
                    games={wishlist}
                    onRemove={id =>
                      setWishlist(current => current.filter(game => game.id !== id))
                    }
                  />
                </div>
              </section>
            )}
          </div>
        </section>
      </div>

      <DisplayNameStyleModal
        open={styleOpen}
        onOpenChange={setStyleOpen}
        value={nameStyle}
        displayName={displayName}
        username={username}
        avatar={avatar}
        onApply={style => {
          setNameFont(style.font);
          setNameEffect(style.effect);
          setNameColorA(style.colorA);
          setNameColorB(style.colorB);
        }}
      />

      <AvatarDecorationModal
        open={decorationOpen}
        onOpenChange={setDecorationOpen}
        value={avatarDecoration}
        displayName={displayName}
        username={username}
        avatar={avatar}
        nameStyle={nameStyle}
        onApply={setAvatarDecoration}
      />

      <AvatarPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        current={avatar}
        onUpload={file => void uploadImage(file, "avatar")}
        onPick={setAvatar}
      />

      {cropperFile ? (
        <BannerCropper
          file={cropperFile}
          onComplete={handleCropComplete}
          onCancel={() => setCropperFile(null)}
          aspectRatio={16 / 9}
          minWidth={1280}
          minHeight={720}
        />
      ) : null}
    </div>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[#4b505f]">
        {label}
        <Eye className="size-3" aria-hidden />
      </h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-bold text-[#343746]">{label}</Label>
      {children}
    </div>
  );
}

function StudioTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex min-h-11 items-center whitespace-nowrap border-b-2 px-3 text-xs font-bold transition-colors",
        active
          ? "border-[#4654D8] text-[#343eb7]"
          : "border-transparent text-[#6b6f7d] hover:text-[#171923]",
      )}
    >
      {children}
    </button>
  );
}

function GameTile({ game, large = false }: { game: ProfileGame; large?: boolean }) {
  return game.imageUrl ? (
    <img
      src={game.imageUrl}
      alt={game.name}
      className={cn("h-16 w-12 shrink-0 rounded-lg object-cover", large && "h-20 w-16")}
    />
  ) : (
    <span
      className={cn(
        "flex h-16 w-12 shrink-0 items-center justify-center rounded-lg bg-[#e6e8f0] text-[#8b8e9b]",
        large && "h-20 w-16",
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
                  favoriteId === game.id ? "text-[#4654D8]" : "text-[#777b89]",
                )}
              >
                <Heart className={cn("h-3 w-3", favoriteId === game.id && "fill-current")} />
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
