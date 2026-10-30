import { useEffect, useMemo, useState } from "react";
import { BarChart3, BookOpenCheck, CheckCircle2, Loader2, Plus, Rocket, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import type { ServerDetailsDTO } from "@contracts/types";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

function Intro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#8290ff]">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p></div>;
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#181b23]"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-white">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}</div><div className="space-y-4 p-5">{children}</div></section>;
}

export function ServerCommunitySettings({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const utils = trpc.useUtils();
  const community = trpc.advanced.server.community.useQuery({ serverId });
  const [enabled, setEnabled] = useState(false);
  const [rulesChannelId, setRulesChannelId] = useState<number | null>(null);
  const [announcementChannelId, setAnnouncementChannelId] = useState<number | null>(null);
  const [spamProtectionEnabled, setSpamProtectionEnabled] = useState(true);
  const [minimumModerationEnabled, setMinimumModerationEnabled] = useState(true);
  useEffect(() => {
    if (!community.isFetched) return;
    setEnabled(Boolean(community.data?.enabledAt));
    setRulesChannelId(community.data?.rulesChannelId ?? null);
    setAnnouncementChannelId(community.data?.announcementChannelId ?? null);
    setSpamProtectionEnabled(community.data?.spamProtectionEnabled ?? true);
    setMinimumModerationEnabled(community.data?.minimumModerationEnabled ?? true);
  }, [community.data, community.isFetched]);
  const update = trpc.advanced.server.updateCommunity.useMutation({
    onSuccess: () => {
      toast.success(enabled ? "Comunidade ativada." : "Configuração de comunidade salva.");
      void Promise.all([utils.advanced.server.community.invalidate({ serverId }), utils.server.get.invalidate({ serverId })]);
    },
    onError: error => toast.error(error.message),
  });
  const textChannels = details.channels.filter(channel => ["TEXT", "ANNOUNCEMENT"].includes(channel.type));
  const announcements = details.channels.filter(channel => channel.type === "ANNOUNCEMENT");
  const requirements = [
    { label: "Canal de regras", met: rulesChannelId != null },
    { label: "Canal de anúncios", met: announcementChannelId != null },
    { label: "Moderação mínima", met: minimumModerationEnabled },
    { label: "Proteção contra spam", met: spamProtectionEnabled },
  ];
  return <div className="space-y-7"><Intro eyebrow="Comunidade" title="Recursos da comunidade" description="Prepare o servidor para onboarding, guia, eventos, anúncios e insights com requisitos explícitos de segurança." />
    <Panel title="Ativar Comunidade" description="Todos os requisitos abaixo são revalidados no servidor antes da ativação.">
      <div className="flex items-center justify-between gap-4 rounded-xl bg-black/15 p-4"><div><p className="text-sm font-semibold text-white">Modo Comunidade</p><p className="mt-1 text-xs text-slate-500">Libera os recursos avançados para membros e administradores.</p></div><Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Ativar Comunidade" /></div>
      <div className="grid gap-2 sm:grid-cols-2">{requirements.map(item => <div key={item.label} className="flex items-center gap-2 rounded-xl border border-white/[0.06] p-3 text-xs"><CheckCircle2 className={`size-4 ${item.met ? "text-emerald-400" : "text-slate-600"}`} /><span className={item.met ? "text-slate-200" : "text-slate-500"}>{item.label}</span></div>)}</div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2"><span className="text-xs font-semibold text-slate-300">Canal de regras</span><select value={rulesChannelId ?? ""} onChange={event => setRulesChannelId(Number(event.target.value) || null)} className="min-h-10 w-full rounded-lg border border-white/10 bg-[#11131a] px-3 text-sm"><option value="">Selecionar</option>{textChannels.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label><label className="space-y-2"><span className="text-xs font-semibold text-slate-300">Canal de anúncios</span><select value={announcementChannelId ?? ""} onChange={event => setAnnouncementChannelId(Number(event.target.value) || null)} className="min-h-10 w-full rounded-lg border border-white/10 bg-[#11131a] px-3 text-sm"><option value="">Selecionar</option>{announcements.map(channel => <option key={channel.id} value={channel.id}>#{channel.name}</option>)}</select></label></div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl bg-black/15 p-4 text-xs font-semibold text-slate-200">Moderação mínima<Switch checked={minimumModerationEnabled} onCheckedChange={setMinimumModerationEnabled} /></label><label className="flex items-center justify-between rounded-xl bg-black/15 p-4 text-xs font-semibold text-slate-200">Proteção contra spam<Switch checked={spamProtectionEnabled} onCheckedChange={setSpamProtectionEnabled} /></label></div>
      <div className="flex justify-end"><Button disabled={update.isPending} onClick={() => update.mutate({ serverId, enabled, rulesChannelId, announcementChannelId, spamProtectionEnabled, minimumModerationEnabled })}>{update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />} Salvar comunidade</Button></div>
    </Panel>
  </div>;
}

type DraftQuestion = { prompt: string; optionsText: string; required: boolean; multiple: boolean };
type OnboardingOptionRule = { roleIds: number[]; channelIds: number[]; interests: string };
const onboardingOptionRuleKey = (questionIndex: number, optionIndex: number) => `${questionIndex}:${optionIndex}`;

export function ServerOnboardingSettings({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const utils = trpc.useUtils();
  const onboarding = trpc.advanced.server.onboarding.useQuery({ serverId });
  const [enabled, setEnabled] = useState(false);
  const [requireRules, setRequireRules] = useState(true);
  const [welcomeTitle, setWelcomeTitle] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [optionRules, setOptionRules] = useState<Record<string, OnboardingOptionRule>>({});
  useEffect(() => {
    if (!onboarding.isFetched) return;
    setEnabled(onboarding.data?.config?.enabled ?? false);
    setRequireRules(onboarding.data?.config?.requireRules ?? true);
    setWelcomeTitle(onboarding.data?.config?.welcomeTitle ?? "");
    setWelcomeMessage(onboarding.data?.config?.welcomeMessage ?? "");
    setCoverImageUrl(onboarding.data?.config?.coverImageUrl ?? "");
    const loadedQuestions = onboarding.data?.questions ?? [];
    setQuestions(loadedQuestions.map(question => ({ prompt: question.prompt, optionsText: (question.options ?? []).map(option => option.label).join("\n"), required: question.required, multiple: question.multiple })));
    setOptionRules(Object.fromEntries(loadedQuestions.flatMap((question, questionIndex) => (question.options ?? []).map((option, optionIndex) => [
      onboardingOptionRuleKey(questionIndex, optionIndex),
      { roleIds: option.roleIds ?? [], channelIds: option.channelIds ?? [], interests: (option.interests ?? []).join(", ") },
    ]))));
  }, [onboarding.data, onboarding.isFetched]);
  const update = trpc.advanced.server.updateOnboarding.useMutation({ onSuccess: () => { toast.success("Onboarding publicado."); void utils.advanced.server.onboarding.invalidate({ serverId }); }, onError: error => toast.error(error.message) });
  const save = () => update.mutate({ serverId, enabled, requireRules, welcomeTitle: welcomeTitle.trim() || null, welcomeMessage: welcomeMessage.trim() || null, coverImageUrl: coverImageUrl.trim() || null, questions: questions.filter(item => item.prompt.trim()).map((question, questionIndex) => ({ prompt: question.prompt.trim(), required: question.required, multiple: question.multiple, options: question.optionsText.split("\n").map(value => value.trim()).filter(Boolean).map((label, optionIndex) => {
    const rule = optionRules[onboardingOptionRuleKey(questionIndex, optionIndex)];
    return { id: `q${questionIndex + 1}-o${optionIndex + 1}`, label, roleIds: rule?.roleIds ?? [], channelIds: rule?.channelIds ?? [], interests: (rule?.interests ?? "").split(",").map(value => value.trim()).filter(Boolean) };
  }) })) });
  return <div className="space-y-7"><Intro eyebrow="Entrada" title="Onboarding do servidor" description="Crie uma apresentação guiada com regras, perguntas, interesses e escolhas adequadas para telas pequenas." />
    {onboarding.isLoading ? <Skeleton className="h-96 w-full" /> : <>
      <Panel title="Apresentação"><div className="flex items-center justify-between rounded-xl bg-black/15 p-4"><div><p className="text-sm font-semibold">Onboarding ativo</p><p className="mt-1 text-xs text-slate-500">Novos membros concluem o fluxo antes de participar.</p></div><Switch checked={enabled} onCheckedChange={setEnabled} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Título</Label><Input value={welcomeTitle} onChange={event => setWelcomeTitle(event.target.value)} maxLength={120} /></div><div className="space-y-2"><Label>Imagem de capa (URL)</Label><Input value={coverImageUrl} onChange={event => setCoverImageUrl(event.target.value)} placeholder="https://" /></div></div><div className="space-y-2"><Label>Mensagem de boas-vindas</Label><Textarea value={welcomeMessage} onChange={event => setWelcomeMessage(event.target.value)} maxLength={2000} rows={5} /></div><label className="flex items-center justify-between rounded-xl bg-black/15 p-4 text-xs font-semibold">Exigir aceite das regras<Switch checked={requireRules} onCheckedChange={setRequireRules} /></label></Panel>
      <Panel title="Perguntas" description="Uma opção por linha. Respostas podem ser ampliadas com cargos, canais e interesses pela API.">{questions.map((question, index) => <div key={index} className="space-y-3 rounded-xl border border-white/[0.07] bg-black/10 p-4"><div className="flex gap-2"><Input value={question.prompt} onChange={event => setQuestions(list => list.map((item, i) => i === index ? { ...item, prompt: event.target.value } : item))} placeholder="O que você quer encontrar aqui?" maxLength={240} /><Button size="icon" variant="ghost" onClick={() => setQuestions(list => list.filter((_, i) => i !== index))} aria-label="Remover pergunta"><Trash2 className="size-4 text-red-400" /></Button></div><Textarea value={question.optionsText} onChange={event => setQuestions(list => list.map((item, i) => i === index ? { ...item, optionsText: event.target.value } : item))} placeholder={"Jogos\nEstudos\nNovas amizades"} rows={4} /><div className="flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs text-slate-300"><Switch checked={question.required} onCheckedChange={required => setQuestions(list => list.map((item, i) => i === index ? { ...item, required } : item))} />Obrigatória</label><label className="flex items-center gap-2 text-xs text-slate-300"><Switch checked={question.multiple} onCheckedChange={multiple => setQuestions(list => list.map((item, i) => i === index ? { ...item, multiple } : item))} />Múltipla escolha</label></div></div>)}<Button variant="secondary" onClick={() => setQuestions(list => [...list, { prompt: "", optionsText: "", required: true, multiple: false }])}><Plus className="size-4" />Adicionar pergunta</Button></Panel>
      {questions.some(question => question.optionsText.trim()) && <Panel title="Resultado de cada opção" description="Escolha os cargos e canais recomendados e informe interesses separados por vírgula. As referências são validadas no servidor antes de publicar.">
        <div className="space-y-5">{questions.map((question, questionIndex) => question.optionsText.split("\n").map(value => value.trim()).filter(Boolean).map((label, optionIndex) => {
          const key = onboardingOptionRuleKey(questionIndex, optionIndex);
          const rule = optionRules[key] ?? { roleIds: [], channelIds: [], interests: "" };
          const updateRule = (patch: Partial<OnboardingOptionRule>) => setOptionRules(current => ({ ...current, [key]: { ...rule, ...patch } }));
          return <fieldset key={key} className="rounded-xl border border-white/[0.07] bg-black/10 p-4"><legend className="px-1 text-sm font-semibold text-white">{question.prompt || `Pergunta ${questionIndex + 1}`} · <span className="text-[#aab2ff]">{label}</span></legend>
            <div className="mt-3 grid gap-4 lg:grid-cols-2"><div><p className="mb-2 text-xs font-semibold text-slate-300">Conceder cargos</p><div className="flex flex-wrap gap-2">{details.roles.filter(role => !role.isDefault).map(role => <button key={role.id} type="button" aria-pressed={rule.roleIds.includes(role.id)} onClick={() => updateRule({ roleIds: rule.roleIds.includes(role.id) ? rule.roleIds.filter(id => id !== role.id) : [...rule.roleIds, role.id] })} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${rule.roleIds.includes(role.id) ? "border-[#7383ff] bg-[#5865f2]/20 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>{role.name}</button>)}</div></div>
              <div><p className="mb-2 text-xs font-semibold text-slate-300">Recomendar canais</p><div className="flex flex-wrap gap-2">{details.channels.filter(channel => ["TEXT", "ANNOUNCEMENT", "FORUM", "MEDIA"].includes(channel.type)).map(channel => <button key={channel.id} type="button" aria-pressed={rule.channelIds.includes(channel.id)} onClick={() => updateRule({ channelIds: rule.channelIds.includes(channel.id) ? rule.channelIds.filter(id => id !== channel.id) : [...rule.channelIds, channel.id] })} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${rule.channelIds.includes(channel.id) ? "border-[#7383ff] bg-[#5865f2]/20 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>#{channel.name}</button>)}</div></div></div>
            <div className="mt-4 space-y-2"><Label>Interesses</Label><Input value={rule.interests} onChange={event => updateRule({ interests: event.target.value })} maxLength={500} placeholder="ex.: jogos, estudo, amizade" /></div>
          </fieldset>;
        }))}</div>
      </Panel>}
      <div className="flex justify-end"><Button disabled={update.isPending || questions.some(question => question.prompt.trim() && question.optionsText.split("\n").filter(Boolean).length === 0)} onClick={save}>{update.isPending && <Loader2 className="size-4 animate-spin" />}Publicar onboarding</Button></div>
    </>}
  </div>;
}

export function ServerGuideSettings({ details }: { details: ServerDetailsDTO }) {
  const serverId = details.server.id;
  const utils = trpc.useUtils();
  const guide = trpc.advanced.server.guide.useQuery({ serverId });
  const [welcome, setWelcome] = useState("");
  const [rules, setRules] = useState("");
  const [tasks, setTasks] = useState("");
  const [faq, setFaq] = useState("");
  const [resources, setResources] = useState("");
  const [recommendedChannelIds, setRecommendedChannelIds] = useState<number[]>([]);
  useEffect(() => {
    if (!guide.data) return;
    setWelcome(guide.data.welcomeMessage ?? "");
    setRules((guide.data.rules ?? []).join("\n"));
    setTasks((guide.data.tasks ?? []).map(task => task.label).join("\n"));
    setFaq((guide.data.faq ?? []).map(item => `${item.question} | ${item.answer}`).join("\n"));
    setResources((guide.data.resources ?? []).map(resource => `${resource.label} | ${resource.url}`).join("\n"));
    setRecommendedChannelIds(guide.data.recommendedChannelIds ?? []);
  }, [guide.data]);
  const update = trpc.advanced.server.updateGuide.useMutation({ onSuccess: () => { toast.success("Guia atualizado."); void utils.advanced.server.guide.invalidate({ serverId }); }, onError: error => toast.error(error.message) });
  const lines = (value: string) => value.split("\n").map(item => item.trim()).filter(Boolean);
  const parsedResources = () => lines(resources).map(line => {
    const [label, ...url] = line.split("|");
    return { label: label.trim(), url: url.join("|").trim() };
  }).filter(item => item.label && /^https?:\/\//i.test(item.url));
  return <div className="space-y-7">
    <Intro eyebrow="Primeiros passos" title="Guia do servidor" description="Reúna regras, tarefas iniciais, canais recomendados, recursos e respostas frequentes em um espaço permanente." />
    {guide.isLoading ? <Skeleton className="h-96 w-full" /> : <Panel title="Conteúdo do guia">
      <div className="space-y-2"><Label>Mensagem de boas-vindas</Label><Textarea value={welcome} onChange={event => setWelcome(event.target.value)} rows={4} maxLength={2000} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Regras (uma por linha)</Label><Textarea value={rules} onChange={event => setRules(event.target.value)} rows={8} /></div><div className="space-y-2"><Label>Tarefas iniciais (uma por linha)</Label><Textarea value={tasks} onChange={event => setTasks(event.target.value)} rows={8} placeholder={"Leia #regras\nEscolha seus cargos\nApresente-se"} /></div></div>
      <div className="space-y-2"><Label>FAQ (pergunta | resposta)</Label><Textarea value={faq} onChange={event => setFaq(event.target.value)} rows={6} placeholder="Como escolho cargos? | Abra o canal de cargos." /></div>
      <div className="space-y-2"><Label>Recursos (nome | URL)</Label><Textarea value={resources} onChange={event => setResources(event.target.value)} rows={5} placeholder={"Central de ajuda | https://ajuda.exemplo.com\nRegras completas | https://exemplo.com/regras"} /><p className="text-[11px] text-slate-500">Somente links HTTP(S) válidos aparecem para os membros.</p></div>
      <fieldset className="space-y-2"><legend className="text-xs font-semibold text-slate-300">Canais recomendados</legend><div className="flex flex-wrap gap-2">{details.channels.filter(channel => ["TEXT", "ANNOUNCEMENT", "FORUM", "MEDIA"].includes(channel.type)).map(channel => <button key={channel.id} type="button" aria-pressed={recommendedChannelIds.includes(channel.id)} onClick={() => setRecommendedChannelIds(current => current.includes(channel.id) ? current.filter(id => id !== channel.id) : [...current, channel.id])} className={`min-h-9 rounded-lg border px-3 text-xs font-semibold ${recommendedChannelIds.includes(channel.id) ? "border-[#7383ff] bg-[#5865f2]/20 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}>#{channel.name}</button>)}</div></fieldset>
      <div className="flex justify-end"><Button disabled={update.isPending} onClick={() => update.mutate({ serverId, welcomeMessage: welcome.trim() || null, rules: lines(rules), resources: parsedResources(), recommendedChannelIds, tasks: lines(tasks).map((label, index) => ({ id: `task-${index + 1}`, label })), faq: lines(faq).map(line => { const [question, ...answer] = line.split("|"); return { question: question.trim(), answer: answer.join("|").trim() }; }).filter(item => item.question && item.answer) })}><BookOpenCheck className="size-4" />Salvar guia</Button></div>
    </Panel>}
  </div>;
}

export function ServerInsightsSettings({ details }: { details: ServerDetailsDTO }) {
  const [days, setDays] = useState(30);
  const to = useMemo(() => new Date(), []);
  const from = useMemo(() => new Date(to.getTime() - days * 86_400_000), [days, to]);
  const insights = trpc.advanced.server.insights.useQuery({ serverId: details.server.id, from: from.toISOString(), to: to.toISOString() });
  const cards = insights.data ? [
    ["Membros totais", insights.data.summary.membersTotal, Users], ["Membros ativos", insights.data.summary.activeMembers, Users], ["Retenção", `${insights.data.summary.retention}%`, BarChart3], ["Novos membros", insights.data.summary.newMembers, Plus], ["Mensagens", insights.data.summary.messages, BarChart3], ["Canais ativos", insights.data.summary.activeChannels, BarChart3], ["Usuários retornando", insights.data.summary.returningMembers, Users], ["Eventos", insights.data.summary.events, CheckCircle2],
  ] as const : [];
  const maxMessages = Math.max(1, ...(insights.data?.daily ?? []).map(day => day.messages));
  return <div className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-4"><Intro eyebrow="Analytics" title="Server Insights" description="Métricas agregadas para entender crescimento, retenção e atividade sem expor conteúdo privado." /><div className="flex rounded-xl border border-white/[0.07] bg-[#181b23] p-1">{[7, 30, 90].map(value => <button key={value} onClick={() => setDays(value)} className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${days === value ? "bg-[#4654d8] text-white" : "text-slate-400 hover:text-white"}`}>{value} dias</button>)}</div></div>
    {insights.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-28" />)}</div> : insights.isError ? <Panel title="Não foi possível carregar"><Button onClick={() => insights.refetch()}>Tentar novamente</Button></Panel> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, Icon]) => <article key={label} className="rounded-2xl border border-white/[0.07] bg-[#181b23] p-5"><Icon className="size-4 text-[#8290ff]" /><p className="mt-4 text-2xl font-semibold tabular-nums text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></article>)}</div><Panel title="Atividade diária" description="Mensagens agregadas por dia."><div className="flex h-44 items-end gap-1 overflow-x-auto" aria-label="Gráfico de atividade">{insights.data?.daily.length ? insights.data.daily.map(day => <div key={String(day.day)} className="group flex h-full min-w-3 flex-1 items-end" title={`${new Date(day.day).toLocaleDateString("pt-BR")}: ${day.messages} mensagens`}><div className="w-full rounded-t bg-[#4654d8] transition-colors group-hover:bg-[#7383ff]" style={{ height: `${Math.max(4, day.messages / maxMessages * 100)}%` }} /></div>) : <p className="m-auto text-xs text-slate-500">Os agregados diários aparecerão após a coleta do primeiro período.</p>}</div></Panel></>}
  </div>;
}
