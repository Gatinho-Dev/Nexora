import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}

type QrInspection = {
  id: string;
  token: string;
  deviceSummary: string | null;
  browser: string | null;
  approximateLocation: string | null;
  partialIp: string | null;
  expiresAt: Date | string;
};

function parseQrPayload(payload: string) {
  try {
    const url = new URL(payload.trim());
    if (url.protocol !== "nexora:" || url.hostname !== "login") return null;
    const id = url.searchParams.get("session");
    const token = url.searchParams.get("token");
    return id && token ? { id, token } : null;
  } catch {
    return null;
  }
}

function QrLoginAuthorizer() {
  const utils = trpc.useUtils();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [payload, setPayload] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [inspection, setInspection] = useState<QrInspection | null>(null);
  const [checking, setChecking] = useState(false);
  const approve = trpc.advanced.security.approveQrLogin.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(variables.approve ? "Login autorizado." : "Login recusado.");
      setInspection(null);
      setPayload("");
    },
    onError: error => toast.error(error.message),
  });

  const inspect = useCallback(async (value: string) => {
    const parsed = parseQrPayload(value);
    if (!parsed) {
      toast.error("Este não é um QR de login válido da Nexora.");
      return;
    }
    setChecking(true);
    try {
      const result = await utils.client.advanced.security.inspectQrLogin.query(parsed);
      setInspection({ ...result, ...parsed });
      setCameraOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChecking(false);
    }
  }, [utils]);

  useEffect(() => {
    if (!cameraOpen) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const begin = async () => {
      const Detector = (window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;
      if (!Detector) {
        toast.error("A leitura pela câmera não é suportada neste navegador. Cole o conteúdo do QR abaixo.");
        setCameraOpen(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const result = await detector.detect(videoRef.current);
            if (result[0]?.rawValue) {
              setPayload(result[0].rawValue);
              await inspect(result[0].rawValue);
              return;
            }
          } catch {
            // A câmera pode entregar um frame incompleto; o próximo tenta novamente.
          }
          frame = requestAnimationFrame(() => void scan());
        };
        frame = requestAnimationFrame(() => void scan());
      } catch {
        toast.error("Não foi possível acessar a câmera.");
        setCameraOpen(false);
      }
    };
    void begin();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [cameraOpen, inspect]);

  return (
    <Section
      icon={QrCode}
      title="Autorizar login por QR"
      description="Escaneie somente códigos exibidos por você. Confira o dispositivo antes de aprovar."
    >
      {cameraOpen && (
        <div className="mb-3 overflow-hidden rounded-xl border border-[#7383ff]/30 bg-black">
          <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" aria-label="Câmera para escanear QR" />
          <p className="border-t border-white/10 px-3 py-2 text-center text-[11px] text-muted2">Aponte para o QR exibido na tela de login.</p>
        </div>
      )}
      {!inspection ? (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setCameraOpen(value => !value)} className="min-h-11 sm:min-h-9">
              <Camera className="size-4" /> {cameraOpen ? "Fechar câmera" : "Escanear QR"}
            </Button>
            <Input value={payload} onChange={event => setPayload(event.target.value)} placeholder="Ou cole o conteúdo do QR" aria-label="Conteúdo do QR de login" />
            <Button disabled={!payload.trim() || checking} onClick={() => void inspect(payload)}>
              {checking ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
            </Button>
          </div>
          <p className="text-[10px] leading-4 text-faint">O QR expira, funciona uma única vez e nunca contém sua senha.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <p className="text-xs font-bold text-white">Novo login detectado</p>
          <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-[11px]">
            <dt className="text-muted2">Dispositivo</dt><dd className="text-white">{inspection.deviceSummary ?? "Desconhecido"}</dd>
            <dt className="text-muted2">Navegador</dt><dd className="text-white">{inspection.browser ?? "Desconhecido"}</dd>
            <dt className="text-muted2">Localização</dt><dd className="text-white">{inspection.approximateLocation ?? "Não disponível"}</dd>
            <dt className="text-muted2">Rede</dt><dd className="text-white">{inspection.partialIp ?? "Não disponível"}</dd>
          </dl>
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={approve.isPending} onClick={() => approve.mutate({ id: inspection.id, token: inspection.token, approve: false })}>Recusar</Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate({ id: inspection.id, token: inspection.token, approve: true })}>Autorizar login</Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-sidebar">
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#4654d8]/15 text-[#8290ff]">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted2">{description}</p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  const content = `Códigos de backup da Nexora\n\n${codes.join("\n")}\n`;
  const copy = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Códigos copiados.");
  };
  const download = () => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
    link.download = "nexora-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return (
    <div className="space-y-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
      <div className="flex gap-2 text-amber-200">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-xs leading-5">
          Salve estes códigos agora. Cada código funciona uma única vez e a Nexora armazena apenas o hash.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-black/20 p-3 font-mono text-xs tracking-wide text-white sm:grid-cols-3">
        {codes.map(code => <span key={code}>{code}</span>)}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          <Copy className="size-3.5" /> Copiar
        </Button>
        <Button size="sm" variant="secondary" onClick={download}>
          <Download className="size-3.5" /> Baixar
        </Button>
      </div>
    </div>
  );
}

export function AccountSecurityFeatures() {
  const utils = trpc.useUtils();
  const passkeys = trpc.advanced.security.passkeys.useQuery();
  const totp = trpc.advanced.security.totp.useQuery();
  const events = trpc.advanced.security.events.useQuery();
  const [passkeyName, setPasskeyName] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [totpSetup, setTotpSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const beginPasskey = trpc.advanced.security.beginPasskeyRegistration.useMutation();
  const finishPasskey = trpc.advanced.security.finishPasskeyRegistration.useMutation();
  const deletePasskey = trpc.advanced.security.deletePasskey.useMutation({
    onSuccess: () => {
      toast.success("Passkey removida.");
      void utils.advanced.security.passkeys.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const beginTotp = trpc.advanced.security.beginTotp.useMutation({
    onSuccess: data => {
      setTotpSetup(data);
      setBackupCodes(null);
    },
    onError: error => toast.error(error.message),
  });
  const enableTotp = trpc.advanced.security.enableTotp.useMutation({
    onSuccess: data => {
      setBackupCodes(data.backupCodes);
      setTotpSetup(null);
      setVerificationCode("");
      toast.success("Autenticação em duas etapas ativada.");
      void utils.advanced.security.totp.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const regenerate = trpc.advanced.security.regenerateBackupCodes.useMutation({
    onSuccess: data => {
      setBackupCodes(data.backupCodes);
      setVerificationCode("");
      void utils.advanced.security.totp.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const disableTotp = trpc.advanced.security.disableTotp.useMutation({
    onSuccess: () => {
      setBackupCodes(null);
      setVerificationCode("");
      toast.success("Autenticação em duas etapas desativada.");
      void utils.advanced.security.totp.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const registerPasskey = async () => {
    try {
      const start = await beginPasskey.mutateAsync();
      const response = await startRegistration({ optionsJSON: start.options });
      await finishPasskey.mutateAsync({
        challengeId: start.challengeId,
        name: passkeyName.trim() || "Minha passkey",
        response,
      });
      setPasskeyName("");
      toast.success("Passkey cadastrada.");
      await utils.advanced.security.passkeys.invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const recentEvents = useMemo(() => (events.data ?? []).slice(0, 5), [events.data]);
  const loadingPasskey = beginPasskey.isPending || finishPasskey.isPending;

  return (
    <div className="space-y-4">
      <Section
        icon={Fingerprint}
        title="Passkeys"
        description="Entre com biometria, PIN do dispositivo ou chave de segurança. A chave privada nunca sai do seu aparelho."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={passkeyName}
            onChange={event => setPasskeyName(event.target.value)}
            maxLength={80}
            placeholder="Ex.: MacBook pessoal"
            aria-label="Nome da nova passkey"
          />
          <Button disabled={loadingPasskey} onClick={() => void registerPasskey()} className="min-h-11 sm:min-h-9">
            {loadingPasskey ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
            Cadastrar passkey
          </Button>
        </div>
        <div className="mt-4 space-y-2">
          {passkeys.isLoading ? (
            <><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></>
          ) : passkeys.data?.length ? passkeys.data.map(key => (
            <div key={key.id} className="flex items-center gap-3 rounded-xl bg-black/15 px-3 py-3">
              <KeyRound className="size-4 shrink-0 text-[#8290ff]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">{key.name}</p>
                <p className="text-[10px] text-muted2">
                  {key.backedUp ? "Sincronizada" : "Vinculada ao dispositivo"} · {new Date(key.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={deletePasskey.isPending}
                aria-label={`Remover passkey ${key.name}`}
                title="Remover passkey"
                onClick={() => deletePasskey.mutate({ id: key.id, verificationCode: verificationCode || undefined })}
              >
                <Trash2 className="size-4 text-red-400" />
              </Button>
            </div>
          )) : (
            <p className="rounded-xl bg-black/15 px-4 py-5 text-center text-xs text-muted2">Nenhuma passkey cadastrada.</p>
          )}
        </div>
      </Section>

      <Section
        icon={ShieldCheck}
        title="Autenticação em duas etapas"
        description="Compatível com aplicativos TOTP. Operações sensíveis também aceitam um código de backup."
      >
        {totp.isLoading ? <Skeleton className="h-24 w-full" /> : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs font-bold text-white">
                  {totp.data?.enabled && <Check className="size-4 text-emerald-400" />}
                  {totp.data?.enabled ? "2FA ativado" : "2FA ainda não configurado"}
                </p>
                {totp.data?.enabled && <p className="mt-1 text-[11px] text-muted2">{totp.data.backupCodesRemaining} códigos de backup disponíveis</p>}
              </div>
              {!totp.data?.enabled && !totpSetup && (
                <Button size="sm" disabled={beginTotp.isPending} onClick={() => beginTotp.mutate()}>
                  {beginTotp.isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                  Configurar
                </Button>
              )}
            </div>

            {totpSetup && (
              <div className="grid gap-4 rounded-xl border border-white/10 bg-black/15 p-4 sm:grid-cols-[148px_1fr]">
                <div className="grid place-items-center rounded-xl bg-white p-3">
                  <QRCodeSVG value={totpSetup.uri} size={124} aria-label="QR para configurar o autenticador" />
                </div>
                <div className="min-w-0 space-y-3">
                  <div>
                    <p className="text-xs font-bold text-white">Escaneie no aplicativo autenticador</p>
                    <p className="mt-1 text-[11px] leading-5 text-muted2">Se não puder escanear, digite esta chave:</p>
                    <code className="mt-1 block break-all rounded bg-white/[0.06] p-2 text-[11px] text-white">{totpSetup.secret}</code>
                  </div>
                  <div className="flex gap-2">
                    <Input inputMode="numeric" autoComplete="one-time-code" value={verificationCode} onChange={event => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de 6 dígitos" aria-label="Código do autenticador" />
                    <Button disabled={verificationCode.length !== 6 || enableTotp.isPending} onClick={() => enableTotp.mutate({ code: verificationCode })}>Ativar</Button>
                  </div>
                </div>
              </div>
            )}

            {totp.data?.enabled && (
              <div className="space-y-2">
                <Label htmlFor="security-verification" className="text-xs text-muted2">Código para confirmar uma ação sensível</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input id="security-verification" value={verificationCode} onChange={event => setVerificationCode(event.target.value.trim().slice(0, 32))} placeholder="TOTP ou código de backup" autoComplete="one-time-code" />
                  <Button variant="secondary" disabled={!verificationCode || regenerate.isPending} onClick={() => regenerate.mutate({ code: verificationCode })}>
                    <RotateCcw className="size-4" /> Regenerar códigos
                  </Button>
                  <Button variant="destructive" disabled={!verificationCode || disableTotp.isPending} onClick={() => disableTotp.mutate({ code: verificationCode })}>Desativar 2FA</Button>
                </div>
              </div>
            )}
            {backupCodes && <BackupCodes codes={backupCodes} />}
          </div>
        )}
      </Section>

      <QrLoginAuthorizer />

      <Section
        icon={MonitorSmartphone}
        title="Histórico de segurança"
        description="Novos dispositivos, logins por QR, alterações de autenticação e outras atividades importantes."
      >
        {events.isLoading ? <Skeleton className="h-32 w-full" /> : recentEvents.length ? (
          <div className="space-y-1">
            {recentEvents.map(event => (
              <div key={event.id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-white/[0.04]">
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", event.severity === "critical" ? "bg-red-400" : event.severity === "warning" ? "bg-amber-400" : "bg-emerald-400")} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">{event.type.replaceAll("_", " ")}</p>
                  <p className="mt-0.5 text-[10px] text-muted2">{[event.device, event.browser, event.approximateLocation].filter(Boolean).join(" · ") || "Atividade da conta"} · {new Date(event.createdAt).toLocaleString("pt-BR")}</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="py-4 text-center text-xs text-muted2">Nenhum alerta de segurança recente.</p>}
      </Section>
    </div>
  );
}
