import { useEffect } from "react";

/**
 * Domínio canônico oficial. Todas as URLs públicas (canonical, og:url,
 * sitemap, JSON-LD) apontam para cá — mesmo quando o app é acessado por
 * URLs de hospedagem (ex.: *.onrender.com) ou localhost.
 */
export const SITE_URL = "https://nexorachat.cloud";
export const SITE_NAME = "Nexora";
export const OG_IMAGE = `${SITE_URL}/og-nexora.png`;

type SeoProps = {
  /** Título da página sem o sufixo da marca (ele é adicionado aqui). */
  title?: string;
  description?: string;
  /** Caminho canônico, ex.: "/privacy". Omitir = usar a home. */
  canonicalPath?: string;
  /** Páginas privadas (app, login, convites) não competem em buscas. */
  noindex?: boolean;
  ogType?: "website" | "article";
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Gerenciamento central de <head> por rota — sem dependências externas.
 * Páginas públicas: index,follow + canonical próprio.
 * Páginas privadas: noindex,follow (autenticação continua no backend;
 * robots é só sinal para buscadores, nunca camada de segurança).
 */
export function Seo({
  title,
  description,
  canonicalPath = "/",
  noindex = false,
  ogType = "website",
}: SeoProps) {
  useEffect(() => {
    const defaultTitle = `${SITE_NAME} — Chat, Comunidades e Conversas Online`;
    const defaultDescription =
      "Conheça a Nexora, a plataforma para conversar online, criar comunidades e se conectar com pessoas por mensagens, voz e vídeo — direto no navegador.";
    const fullTitle = title ? `${title} | ${SITE_NAME}` : defaultTitle;
    const desc = description ?? defaultDescription;
    document.title = fullTitle;

    upsertMeta("name", "description", desc);
    upsertMeta("name", "robots", noindex ? "noindex,follow" : "index,follow");
    upsertMeta("name", "application-name", SITE_NAME);

    // Open Graph / Twitter — sempre URL e imagem absolutas.
    const url = `${SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`;
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:locale", "pt_BR");
    upsertMeta("property", "og:image", OG_IMAGE);
    upsertMeta("property", "og:description", desc);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", OG_IMAGE);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    // Verificações de webmaster (Search Console / Bing), só quando definidas no build.
    const google = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION as string | undefined;
    if (google) upsertMeta("name", "google-site-verification", google);
    const bing = import.meta.env.VITE_BING_SITE_VERIFICATION as string | undefined;
    if (bing) upsertMeta("name", "msvalidate.01", bing);

    return () => {
      // Limpa as tags de verificação se a rota mudar sem as envs (evita meta órfã).
      document.head
        .querySelectorAll(
          'meta[name="google-site-verification"], meta[name="msvalidate.01"]'
        )
        .forEach(el => el.remove());
    };
  }, [title, description, canonicalPath, noindex, ogType]);

  return null;
}
