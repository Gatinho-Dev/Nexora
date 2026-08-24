const NEW_SITE_URL = "https://nexorachat.cloud";
const NEW_SITE_HOST = "nexorachat.cloud";

/**
 * Banner global de migração de domínio: aparece para TODOS os usuários do
 * domínio antigo, sem botão de fechar (o aviso some sozinho quando o
 * acesso já é pelo domínio novo).
 */
export function MigrationBanner({ fixed = false }: { fixed?: boolean }) {
  // Já está no domínio novo (ou subdomínio dele)? Não há nada a avisar.
  if (
    typeof window !== "undefined" &&
    window.location.hostname === NEW_SITE_HOST
  ) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={
        fixed
          ? "fixed inset-x-0 top-0 z-[65]"
          : "shrink-0"
      }
    >
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-3 py-2 text-center text-[#1a1300] shadow-lg sm:px-5"
        style={fixed ? { paddingTop: "max(8px, env(safe-area-inset-top))" } : undefined}
      >
        <p className="min-w-0 text-xs font-semibold sm:text-sm">
          ⚠️ <strong>Aviso importante:</strong> No dia <strong>30 de agosto</strong>, os servidores do domínio antigo do Nexora serão desligados. Depois disso, o Nexora ficará disponível somente em{" "}
          <strong>nexorachat.cloud</strong>.
        </p>
        <a
          href={NEW_SITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg bg-[#1a1300] px-3.5 py-1.5 text-xs font-bold text-amber-300 shadow transition-transform hover:bg-black active:scale-[0.98] sm:text-sm"
        >
          Abrir novo site
          <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
