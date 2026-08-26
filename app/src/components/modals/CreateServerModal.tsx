import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Hash, Users, Gamepad2, GraduationCap, FolderKanban, PenTool, Users2, Music } from "lucide-react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  channels: { name: string; type: "TEXT" | "VOICE" | "ANNOUNCEMENT" | "STAGE" }[];
  roles: { name: string; color: string; permissions: string[] }[];
};

const TEMPLATES: Template[] = [
  {
    id: "community",
    name: "Comunidade",
    description: "Para comunidades abertas com moderação e boas-vindas",
    icon: <Users className="h-8 w-8" />,
    channels: [
      { name: "regras", type: "TEXT" },
      { name: "anúncios", type: "TEXT" },
      { name: "geral", type: "TEXT" },
      { name: "apresentações", type: "TEXT" },
      { name: "voz-comunidade", type: "VOICE" },
    ],
    roles: [
      { name: "Moderador", color: "#34d399", permissions: ["MANAGE_CHANNELS", "MANAGE_MESSAGES", "KICK_MEMBERS"] },
      { name: "Membro", color: "#94a3b8", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK"] },
    ],
  },
  {
    id: "friends",
    name: "Amigos",
    description: "Grupo pequeno para conversas casuais",
    icon: <Users2 className="h-8 w-8" />,
    channels: [
      { name: "geral", type: "TEXT" },
      { name: "memes", type: "TEXT" },
      { name: "voz", type: "VOICE" },
    ],
    roles: [
      { name: "Amigo", color: "#f472b6", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK"] },
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    description: "Para clans, squads e comunidades de jogos",
    icon: <Gamepad2 className="h-8 w-8" />,
    channels: [
      { name: "geral", type: "TEXT" },
      { name: "procurando-time", type: "TEXT" },
      { name: "clips", type: "TEXT" },
      { name: "voz-squad", type: "VOICE" },
      { name: "voz-competitivo", type: "VOICE" },
    ],
    roles: [
      { name: "Líder", color: "#fbbf24", permissions: ["ADMINISTRATOR"] },
      { name: "Oficial", color: "#f97316", permissions: ["MANAGE_CHANNELS", "MANAGE_MESSAGES", "KICK_MEMBERS", "MOVE_MEMBERS"] },
      { name: "Membro", color: "#22d3ee", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK", "STREAM"] },
    ],
  },
  {
    id: "study",
    name: "Estudo",
    description: "Grupos de estudo, escolas e cursos",
    icon: <GraduationCap className="h-8 w-8" />,
    channels: [
      { name: "avisos", type: "ANNOUNCEMENT" },
      { name: "geral", type: "TEXT" },
      { name: "dúvidas", type: "TEXT" },
      { name: "materiais", type: "TEXT" },
      { name: "voz-estudo", type: "VOICE" },
      { name: "voz-foco", type: "VOICE" },
    ],
    roles: [
      { name: "Professor", color: "#a855f7", permissions: ["ADMINISTRATOR"] },
      { name: "Monitor", color: "#ec4899", permissions: ["MANAGE_CHANNELS", "MANAGE_MESSAGES", "KICK_MEMBERS"] },
      { name: "Aluno", color: "#3b82f6", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK"] },
    ],
  },
  {
    id: "project",
    name: "Projeto",
    description: "Equipes de trabalho, open source e colaboração",
    icon: <FolderKanban className="h-8 w-8" />,
    channels: [
      { name: "anúncios", type: "ANNOUNCEMENT" },
      { name: "geral", type: "TEXT" },
      { name: "dev", type: "TEXT" },
      { name: "design", type: "TEXT" },
      { name: "voz-reunião", type: "VOICE" },
      { name: "voz-pair", type: "VOICE" },
    ],
    roles: [
      { name: "Owner", color: "#ef4444", permissions: ["ADMINISTRATOR"] },
      { name: "Admin", color: "#f97316", permissions: ["MANAGE_CHANNELS", "MANAGE_ROLES", "MANAGE_MESSAGES", "KICK_MEMBERS", "BAN_MEMBERS"] },
      { name: "Colaborador", color: "#22c55e", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK", "STREAM", "ATTACH_FILES"] },
    ],
  },
  {
    id: "creators",
    name: "Criadores",
    description: "Para streamers, youtubers e artistas",
    icon: <PenTool className="h-8 w-8" />,
    channels: [
      { name: "anúncios", type: "ANNOUNCEMENT" },
      { name: "geral", type: "TEXT" },
      { name: "conteúdo", type: "TEXT" },
      { name: "feedback", type: "TEXT" },
      { name: "voz-live", type: "STAGE" },
      { name: "voz-comunidade", type: "VOICE" },
    ],
    roles: [
      { name: "Criador", color: "#a855f7", permissions: ["ADMINISTRATOR"] },
      { name: "Mod", color: "#ec4899", permissions: ["MANAGE_CHANNELS", "MANAGE_MESSAGES", "KICK_MEMBERS", "MANAGE_THREADS"] },
      { name: "Fã", color: "#f472b6", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK"] },
    ],
  },
  {
    id: "team",
    name: "Equipe",
    description: "Times internos, departamentos e squads",
    icon: <Users className="h-8 w-8" />,
    channels: [
      { name: "geral", type: "TEXT" },
      { name: "standup", type: "TEXT" },
      { name: "aleatório", type: "TEXT" },
      { name: "voz-equipe", type: "VOICE" },
    ],
    roles: [
      { name: "Líder", color: "#0ea5e9", permissions: ["ADMINISTRATOR"] },
      { name: "Membro", color: "#64748b", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK", "STREAM"] },
    ],
  },
  {
    id: "club",
    name: "Clube",
    description: "Hobbies, interesses e grupos de fãs",
    icon: <Music className="h-8 w-8" />,
    channels: [
      { name: "geral", type: "TEXT" },
      { name: "eventos", type: "TEXT" },
      { name: "fotos", type: "TEXT" },
      { name: "voz-clube", type: "VOICE" },
    ],
    roles: [
      { name: "Organizador", color: "#84cc16", permissions: ["ADMINISTRATOR"] },
      { name: "Membro", color: "#eab308", permissions: ["SEND_MESSAGES", "READ_MESSAGES", "VIEW_CHANNEL", "CONNECT", "SPEAK"] },
    ],
  },
];

export function CreateServerModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [step, setStep] = useState<"template" | "details">("template");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const create = trpc.server.create.useMutation({
    onSuccess: async data => {
      await utils.server.list.invalidate();
      onOpenChange(false);
      setStep("template");
      setSelectedTemplate(null);
      setName("");
      setDescription("");
      setIconUrl(null);
      navigate(`/channels/${data.server.id}/first`);
    },
    onError: e => toast.error(e.message),
  });

  const uploadIcon = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no upload");
      setIconUrl(data.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
    }
  };

  const selectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setStep("details");
    setName("");
    setDescription("");
    setIconUrl(null);
  };

  const goBack = () => {
    setStep("template");
    setSelectedTemplate(null);
  };

  if (step === "template") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              Criar servidor
            </DialogTitle>
            <DialogDescription className="text-center">
              Escolha um modelo ou comece do zero
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-20 flex-col gap-2 py-4"
              onClick={() => selectTemplate({ id: "blank", name: "Criar do zero", description: "Configure tudo manualmente", icon: <Hash className="h-8 w-8" />, channels: [], roles: [] })}
            >
              <Hash className="h-8 w-8 mx-auto" />
              <span className="font-semibold">Criar do zero</span>
              <span className="text-xs text-muted-foreground">Configure canais, cargos e permissões manualmente</span>
            </Button>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={cn(
                    "relative p-4 rounded-xl border-2 transition-all hover:border-primary hover:bg-accent",
                    "flex flex-col items-center gap-3 text-center"
                  )}
                >
                  <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    {template.icon}
                  </div>
                  <span className="font-semibold">{template.name}</span>
                  <span className="text-xs text-muted-foreground">{template.description}</span>
                  <span className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                    {template.channels.length} canais · {template.roles.length} cargos
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <Button variant="ghost" size="icon" className="absolute left-4 top-4" onClick={goBack}>
            <span className="sr-only">Voltar</span>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Button>
          <DialogTitle className="text-center text-xl">
            {selectedTemplate?.name ?? "Criar servidor"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {selectedTemplate?.description ?? "Seu servidor é o lugar onde você e seus amigos conversam."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={e => {
            e.preventDefault();
            if (name.trim())
              create.mutate({
                name: name.trim(),
                description: description.trim() || undefined,
                iconUrl: iconUrl ?? undefined,
              });
          }}
        >
          <div className="flex justify-center">
            <button
              type="button"
              className="relative h-20 w-20 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary transition-colors"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="Ícone" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Camera className="h-6 w-6" />
                  <span className="text-[10px] font-semibold mt-1">
                    {uploading ? "ENVIANDO..." : "ENVIAR"}
                  </span>
                </div>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && uploadIcon(e.target.files[0])}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-name">Nome do servidor</Label>
            <Input
              id="server-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Servidor incrível"
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="server-desc">Descrição (opcional)</Label>
            <Textarea
              id="server-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Sobre o que é este servidor?"
              maxLength={500}
              rows={2}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={create.isPending || uploading}
          >
            {create.isPending ? "Criando..." : "Criar servidor"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}