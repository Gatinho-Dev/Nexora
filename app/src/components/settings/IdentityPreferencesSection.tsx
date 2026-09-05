import { useDeferredValue, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Visibility = "everyone" | "friends" | "mutual_servers" | "nobody";
type FieldDraft = { label: string; value: string; visibility: Visibility };
const VISIBILITY: Array<[Visibility, string]> = [["everyone", "Todos"], ["friends", "Amigos"], ["mutual_servers", "Servidores em comum"], ["nobody", "Ninguém"]];

function PrivacySelect({ value, onChange, label }: { value: Visibility; onChange: (value: Visibility) => void; label: string }) {
  return <Select value={value} onValueChange={next => onChange(next as Visibility)}><SelectTrigger className="w-full sm:w-44" aria-label={`Privacidade de ${label}`}><SelectValue /></SelectTrigger><SelectContent>{VISIBILITY.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select>;
}

export function IdentityPreferencesSection() {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const profile = trpc.advanced.profile.myProfile.useQuery();
  const status = trpc.advanced.profile.status.useQuery();
  const [username, setUsername] = useState(user?.username ?? "");
  const deferredUsername = useDeferredValue(username.trim().toLowerCase());
  const validUsername = /^[a-zA-Z0-9_.]{2,32}$/.test(deferredUsername);
  const usernameCheck = trpc.account.checkUsername.useQuery({ username: deferredUsername }, { enabled: validUsername && deferredUsername !== user?.username, staleTime: 5_000 });
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [about, setAbout] = useState("");
  const [privacy, setPrivacy] = useState<Record<string, Visibility>>({});
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [statusText, setStatusText] = useState("");
  const [statusEmoji, setStatusEmoji] = useState("");
  const [presence, setPresence] = useState<"online" | "idle" | "dnd" | "invisible">("online");
  const [duration, setDuration] = useState("never");

  useEffect(() => {
    if (!profile.isFetched) return;
    const details = profile.data?.details;
    setDisplayName(details?.displayName ?? user?.name ?? "");
    setPronouns(details?.pronouns ?? "");
    setLocation(details?.location ?? "");
    setWebsite(details?.website ?? "");
    setAbout(details?.about ?? user?.bio ?? "");
    setPrivacy((details?.privacy as Record<string, Visibility> | null) ?? {});
    setFields((profile.data?.fields ?? []).map(field => ({ label: field.label, value: field.value, visibility: field.visibility })));
  }, [profile.data, profile.isFetched, user?.bio, user?.name]);
  useEffect(() => {
    if (!status.isFetched) return;
    setStatusText(status.data?.text ?? "");
    setStatusEmoji(status.data?.emoji ?? "");
    setPresence(status.data?.presence ?? "online");
  }, [status.data, status.isFetched]);

  const setUsernameMutation = trpc.account.setUsername.useMutation();
  const updateProfile = trpc.advanced.profile.updateProfile.useMutation();
  const setStatus = trpc.advanced.profile.setStatus.useMutation();
  const save = async () => {
    try {
      if (deferredUsername !== user?.username) await setUsernameMutation.mutateAsync({ username: deferredUsername });
      await updateProfile.mutateAsync({ displayName: displayName.trim() || null, pronouns: pronouns.trim() || null, location: location.trim() || null, website: website.trim() || null, about: about.trim() || null, privacy, fields: fields.filter(field => field.label.trim() && field.value.trim()).map(field => ({ ...field, label: field.label.trim(), value: field.value.trim() })) });
      const durationMs = duration === "30m" ? 30 * 60_000 : duration === "1h" ? 60 * 60_000 : duration === "4h" ? 4 * 60 * 60_000 : duration === "today" ? new Date().setHours(23, 59, 59, 999) - Date.now() : 0;
      await setStatus.mutateAsync({ text: statusText.trim() || null, emoji: statusEmoji.trim() || null, presence, expiresAt: durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : null });
      await Promise.all([refresh(), utils.advanced.profile.myProfile.invalidate(), utils.advanced.profile.status.invalidate()]);
      toast.success("Identidade e status atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as alterações.");
    }
  };
  const pending = setUsernameMutation.isPending || updateProfile.isPending || setStatus.isPending;
  const fieldPrivacy = (key: string) => privacy[key] ?? "everyone";
  const setFieldPrivacy = (key: string, value: Visibility) => setPrivacy(current => ({ ...current, [key]: value }));

  return <div className="space-y-6"><div><h2 className="text-xl font-bold text-white">Identidade e status</h2><p className="mt-1 text-xs text-muted2">Separe seu @username único do nome de exibição e controle cada detalhe do perfil.</p></div>
    <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-sidebar p-5"><h3 className="flex items-center gap-2 text-sm font-bold"><UserRound className="size-4 text-[#8290ff]" /> Identidade</h3><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>@username global</Label><Input value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "").slice(0, 32))} minLength={2} maxLength={32} /><p className={`text-[10px] ${deferredUsername === user?.username ? "text-muted2" : usernameCheck.data?.available ? "text-emerald-400" : "text-amber-300"}`}>{deferredUsername === user?.username ? "Seu identificador atual" : usernameCheck.isFetching ? "Verificando disponibilidade…" : usernameCheck.data?.available ? "Disponível" : usernameCheck.data?.reason ?? "Use de 2 a 32 letras, números, _ ou ."}</p></div><div className="space-y-2"><Label>Nome de exibição</Label><Input value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={64} /></div></div>
      {[["pronouns", "Pronomes", pronouns, setPronouns], ["location", "Localização", location, setLocation], ["website", "Website", website, setWebsite]] .map(([key, label, value, setter]) => <div key={key as string} className="grid items-end gap-2 sm:grid-cols-[1fr_176px]"><div className="space-y-2"><Label>{label as string}</Label><Input value={value as string} onChange={event => (setter as (value: string) => void)(event.target.value)} maxLength={key === "website" ? 500 : 120} placeholder={key === "website" ? "https://" : undefined} /></div><PrivacySelect value={fieldPrivacy(key as string)} onChange={next => setFieldPrivacy(key as string, next)} label={label as string} /></div>)}
      <div className="grid items-end gap-2 sm:grid-cols-[1fr_176px]"><div className="space-y-2"><Label>Sobre mim</Label><Textarea value={about} onChange={event => setAbout(event.target.value)} rows={5} maxLength={1000} /></div><PrivacySelect value={fieldPrivacy("about")} onChange={next => setFieldPrivacy("about", next)} label="Sobre mim" /></div>
    </section>
    <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-sidebar p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold">Campos personalizados</h3><p className="mt-1 text-[11px] text-muted2">Até 12 campos, cada um com privacidade própria.</p></div><Button size="sm" variant="secondary" disabled={fields.length >= 12} onClick={() => setFields(list => [...list, { label: "", value: "", visibility: "everyone" }])}><Plus className="size-4" />Adicionar</Button></div>{fields.map((field, index) => <div key={index} className="grid gap-2 rounded-xl bg-black/15 p-3 sm:grid-cols-[150px_1fr_160px_36px]"><Input value={field.label} onChange={event => setFields(list => list.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} maxLength={40} placeholder="Rótulo" /><Input value={field.value} onChange={event => setFields(list => list.map((item, i) => i === index ? { ...item, value: event.target.value } : item))} maxLength={300} placeholder="Valor" /><PrivacySelect value={field.visibility} onChange={visibility => setFields(list => list.map((item, i) => i === index ? { ...item, visibility } : item))} label={field.label || "campo"} /><Button size="icon" variant="ghost" onClick={() => setFields(list => list.filter((_, i) => i !== index))} aria-label="Remover campo"><Trash2 className="size-4 text-red-400" /></Button></div>)}</section>
    <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-sidebar p-5"><h3 className="text-sm font-bold">Status personalizado</h3><div className="grid gap-3 sm:grid-cols-[80px_1fr]"><Input value={statusEmoji} onChange={event => setStatusEmoji(event.target.value)} maxLength={64} placeholder="✨" aria-label="Emoji do status" /><Input value={statusText} onChange={event => setStatusText(event.target.value)} maxLength={128} placeholder="No modo foco" /></div><div className="grid gap-3 sm:grid-cols-2"><Select value={presence} onValueChange={value => setPresence(value as typeof presence)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="online">Online</SelectItem><SelectItem value="idle">Ausente</SelectItem><SelectItem value="dnd">Não Perturbe</SelectItem><SelectItem value="invisible">Invisível</SelectItem></SelectContent></Select><Select value={duration} onValueChange={setDuration}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30m">Limpar em 30 minutos</SelectItem><SelectItem value="1h">Limpar em 1 hora</SelectItem><SelectItem value="4h">Limpar em 4 horas</SelectItem><SelectItem value="today">Limpar hoje</SelectItem><SelectItem value="never">Não limpar</SelectItem></SelectContent></Select></div></section>
    <div className="flex justify-end"><Button disabled={pending || !validUsername || (deferredUsername !== user?.username && usernameCheck.data?.available !== true)} onClick={() => void save()}>{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Salvar alterações</Button></div>
  </div>;
}
