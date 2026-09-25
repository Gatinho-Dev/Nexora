import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Globe2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ADSENSE_ADS_TXT_CONTENT,
  ADSENSE_PUBLISHER_ID,
  ADSENSE_PUBLISHER_NUMBER,
  ADSENSE_SCRIPT_SRC,
  ADSENSE_SITE_URL,
} from "@/lib/adsense";

type CheckTone = "ok" | "warning" | "error";
type Check = {
  label: string;
  tone: CheckTone;
  detail: string;
};

const toneLabel: Record<CheckTone, string> = {
  ok: "Configurado",
  warning: "Atenção",
  error: "Problema encontrado",
};

function CheckIcon({ tone }: { tone: CheckTone }) {
  if (tone === "ok") return <CheckCircle2 className="size-4" aria-hidden />;
  if (tone === "warning") return <AlertTriangle className="size-4" aria-hidden />;
  return <XCircle className="size-4" aria-hidden />;
}

function toneClasses(tone: CheckTone) {
  if (tone === "ok") return "text-[#43b581]";
  if (tone === "warning") return "text-[#f5c452]";
  return "text-[#ff8588]";
}

function ConfigStatus({
  label,
  value,
  detail,
  tone = "ok",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: CheckTone;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.025] p-3">
      <span className={`mt-0.5 shrink-0 ${toneClasses(tone)}`}>
        <CheckIcon tone={tone} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-white">{label}</p>
        <p className="mt-0.5 text-[11px] font-medium text-[#b9c0ca]">{value}</p>
        <p className="mt-1 text-[10px] leading-4 text-[#747d89]">{detail}</p>
      </div>
    </div>
  );
}

async function readPublicFile(path: string) {
  try {
    const response = await fetch(path, {
      cache: "no-store",
      credentials: "omit",
    });
    const body = response.ok ? await response.text() : "";
    return { response, body };
  } catch {
    return null;
  }
}

export function AdSenseSection() {
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const runChecks = async () => {
    setChecking(true);
    const next: Check[] = [];
    const scripts = Array.from(
      document.querySelectorAll<HTMLScriptElement>(
        'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]',
      ),
    );
    const exactScripts = scripts.filter(
      (script) =>
        script.getAttribute("src") === ADSENSE_SCRIPT_SRC &&
        script.async &&
        script.getAttribute("crossorigin") === "anonymous",
    );

    next.push({
      label: "Script do AdSense",
      tone: exactScripts.length === 1 ? "ok" : "error",
      detail:
        exactScripts.length === 1
          ? "Uma tag oficial foi encontrada no documento."
          : exactScripts.length === 0
            ? "A tag oficial não foi encontrada."
            : `${exactScripts.length} cópias exatas foram encontradas.`,
    });
    next.push({
      label: "Publisher ID",
      tone: scripts.some((script) =>
        script.src.includes(`client=ca-${ADSENSE_PUBLISHER_ID}`),
      )
        ? "ok"
        : "error",
      detail: `Esperado: ${ADSENSE_PUBLISHER_ID}`,
    });
    next.push({
      label: "Carregamento duplicado",
      tone: scripts.length <= 1 ? "ok" : "error",
      detail:
        scripts.length <= 1
          ? "Nenhuma segunda tag do AdSense foi encontrada."
          : `${scripts.length} tags do AdSense foram encontradas.`,
    });
    const fundingChoicesApi = (
      window as Window & {
        googlefc?: { showRevocationMessage?: unknown };
      }
    ).googlefc;
    const hasRevocationApi =
      typeof fundingChoicesApi?.showRevocationMessage === "function";
    next.push({
      label: "API de gerenciamento oficial",
      tone: hasRevocationApi ? "ok" : "warning",
      detail: hasRevocationApi
        ? "A API do Google está disponível; a mensagem publicada ainda precisa ser validada no painel."
        : "A API ainda está sendo carregada ou a mensagem oficial não foi disponibilizada para esta página.",
    });

    const [adsFile, robotsFile] = await Promise.all([
      readPublicFile("/ads.txt"),
      readPublicFile("/robots.txt"),
    ]);
    const adsContentType = adsFile?.response.headers.get("content-type") ?? "";
    const robotsContentType =
      robotsFile?.response.headers.get("content-type") ?? "";
    if (!adsFile?.response.ok) {
      next.push({
        label: "ads.txt",
        tone: "error",
        detail: "O arquivo não está disponível neste ambiente.",
      });
    } else if (adsFile.body.trim() !== ADSENSE_ADS_TXT_CONTENT) {
      next.push({
        label: "ads.txt",
        tone: "error",
        detail: "O arquivo está disponível, mas o conteúdo não corresponde ao esperado.",
      });
    } else if (!adsContentType.toLowerCase().includes("text/plain")) {
      next.push({
        label: "ads.txt",
        tone: "warning",
        detail: "O conteúdo está correto, mas o Content-Type precisa ser text/plain.",
      });
    } else {
      next.push({
        label: "ads.txt",
        tone: "ok",
        detail: "Disponível em text/plain com a linha oficial do Publisher ID.",
      });
    }
    const robotsBody = robotsFile?.body ?? "";
    const robotsAllowsPublicPages = /^Allow:\s*\/\s*$/im.test(robotsBody);
    const robotsBlocksWholeSite = /^Disallow:\s*\/\s*$/im.test(robotsBody);
    const robotsReferencesSitemap =
      /^Sitemap:\s*https:\/\/nexorachat\.cloud\/sitemap\.xml\s*$/im.test(
        robotsBody,
      );
    if (!robotsFile?.response.ok) {
      next.push({
        label: "robots.txt",
        tone: "error",
        detail: "O arquivo não está disponível neste ambiente.",
      });
    } else if (!robotsContentType.toLowerCase().includes("text/plain")) {
      next.push({
        label: "robots.txt",
        tone: "warning",
        detail: "O arquivo está acessível, mas o Content-Type precisa ser text/plain.",
      });
    } else if (
      !robotsAllowsPublicPages ||
      robotsBlocksWholeSite ||
      !robotsReferencesSitemap
    ) {
      next.push({
        label: "robots.txt",
        tone: "error",
        detail: "As regras públicas ou a referência do sitemap precisam de revisão.",
      });
    } else {
      next.push({
        label: "robots.txt",
        tone: "ok",
        detail: "O arquivo permite páginas públicas e aponta para o sitemap canônico.",
      });
    }

    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(
      window.location.hostname,
    );
    const isOfficialOrigin = window.location.origin === ADSENSE_SITE_URL;
    next.push({
      label: "Domínio oficial",
      tone: isOfficialOrigin ? "ok" : isLocal ? "warning" : "error",
      detail: isOfficialOrigin
        ? "A página está em nexorachat.cloud."
        : `Ambiente atual: ${window.location.host}. Produção deve usar nexorachat.cloud.`,
    });
    next.push({
      label: "HTTPS",
      tone: window.location.protocol === "https:" ? "ok" : isLocal ? "warning" : "error",
      detail:
        window.location.protocol === "https:"
          ? "A conexão segura está ativa."
          : isLocal
            ? "HTTPS será exigido no domínio oficial de produção."
            : "O domínio oficial deve responder por HTTPS.",
    });

    const hasErrors = next.some((check) => check.tone === "error");
    next.push({
      label: "Erros óbvios de configuração",
      tone: hasErrors ? "error" : "ok",
      detail: hasErrors
        ? "Corrija os itens com problema antes de solicitar a verificação."
        : "Nenhum erro local evidente foi encontrado.",
    });

    setChecks(next);
    setLastCheckedAt(new Date());
    setChecking(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-[#22252b] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#8e9aff]">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-bold text-white">Google AdSense</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8e96a2]">
              A instalação técnica está preparada. A aprovação e a verificação
              final continuam sendo decisões do Google AdSense.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => void runChecks()}
          disabled={checking}
          className="shrink-0 bg-[#5865F2] text-white hover:bg-[#4752C4]"
        >
          {checking ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {checking ? "Verificando..." : "Verificar configuração"}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ConfigStatus
          label="Publisher ID"
          value={`${ADSENSE_PUBLISHER_ID} (${ADSENSE_PUBLISHER_NUMBER})`}
          detail="Identificador fixo controlado pelo código, sem edição pelo painel."
        />
        <ConfigStatus
          label="Domínio"
          value="nexorachat.cloud"
          detail="O domínio de produção oficial está definido para a integração."
        />
        <ConfigStatus
          label="AdSense"
          value="Código instalado"
          detail="A tag oficial do Google AdSense está no head do documento."
        />
        <ConfigStatus
          label="ads.txt"
          value="Arquivo público configurado"
          detail="A linha oficial está disponível em /ads.txt e deve ser validada no domínio publicado."
        />
        <ConfigStatus
          label="CMP certificada"
          value="Verifique no Google AdSense"
          detail="A publicação da mensagem e a certificação precisam ser confirmadas em Privacy & messaging."
          tone="warning"
        />
        <ConfigStatus
          label="Consentimento EEE · Reino Unido · Suíça"
          value="Verifique no Google AdSense"
          detail="As regiões, os sinais TCF e as opções dependem da mensagem oficial publicada."
          tone="warning"
        />
        <ConfigStatus
          label="Gerenciamento de preferências"
          value="Gerenciador oficial preparado"
          detail="Configurações → Conteúdo e Privacidade chama googlefc.showRevocationMessage quando a API está disponível."
          tone="warning"
        />
        <ConfigStatus
          label="Integração com AdSense"
          value="Integração técnica preparada"
          detail="A Nexora não usa um banner próprio; a tag oficial continua carregando a mensagem e os sinais do Google."
          tone="warning"
        />
        <ConfigStatus
          label="Conteúdo público"
          value="SEO preservado"
          detail="Canonical, Open Graph, robots e páginas legais permanecem disponíveis."
        />
      </div>

      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#f5c452]" aria-hidden />
          <div>
            <p className="text-xs font-bold text-[#f5c452]">Aguardando confirmação do Google AdSense.</p>
            <p className="mt-1 text-[11px] leading-5 text-[#a99b73]">
              A instalação do código, a preparação do gerenciador e o ads.txt
              não representam aprovação. No painel oficial, publique a mensagem
              em Privacy &amp; messaging, confirme a CMP certificada e verifique
              as regras do EEE, Reino Unido e Suíça antes de solicitar a
              verificação.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#22252b] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">Diagnóstico local</h3>
            <p className="mt-1 text-[11px] leading-5 text-[#858c96]">
              Verifica somente o que é possível confirmar neste ambiente. Não simula a resposta do Google.
            </p>
          </div>
          {lastCheckedAt && (
            <span className="text-[10px] text-[#747d89]">
              Última verificação: {lastCheckedAt.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>
        {checks.length === 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-[#858c96]">
            <FileCheck2 className="size-4 text-[#8e9aff]" aria-hidden />
            Clique em “Verificar configuração” para consultar o documento, ads.txt, robots.txt, domínio e HTTPS.
          </div>
        ) : (
          <div className="mt-4 grid gap-2" aria-live="polite">
            {checks.map((check) => (
              <div
                key={check.label}
                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <span className={`mt-0.5 ${toneClasses(check.tone)}`}>
                  <CheckIcon tone={check.tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-xs font-semibold text-white">{check.label}</p>
                    <span className={`text-[10px] font-bold ${toneClasses(check.tone)}`}>
                      {toneLabel[check.tone]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-[#858c96]">{check.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-[11px]">
        <a
          href={`${ADSENSE_SITE_URL}/ads.txt`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[#aeb7c4] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <FileCheck2 className="size-3.5" aria-hidden />
          Abrir ads.txt
          <ExternalLink className="size-3" aria-hidden />
        </a>
        <a
          href={`${ADSENSE_SITE_URL}/robots.txt`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-[#aeb7c4] transition-colors hover:bg-white/[0.06] hover:text-white"
        >
          <Globe2 className="size-3.5" aria-hidden />
          Abrir robots.txt
          <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>

      <p className="text-[10px] leading-4 text-[#69717c]">
        O componente reutilizável de anúncios está preparado para uso futuro. Nenhum slot real foi inventado ou inserido automaticamente.
      </p>
    </div>
  );
}
