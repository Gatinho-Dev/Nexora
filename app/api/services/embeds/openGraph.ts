import { contentTypeIsHtml, safeFetchText } from "./safeFetch";

/** Parser OG mínimo e seguro: regex sobre HTML limitado a MAX_BYTES. */
function metaContent(html: string, property: string): string | undefined {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      return m[1]
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim()
        .slice(0, 590) || undefined;
    }
  }
  return undefined;
}

export type OpenGraphData = {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

export async function fetchOpenGraph(url: string): Promise<OpenGraphData> {
  const res = await safeFetchText(url);
  if (!contentTypeIsHtml(res.contentType)) {
    throw new Error("Conteúdo não é uma página HTML.");
  }
  const title =
    metaContent(res.body, "og:title") ??
    res.body.match(/<title[^>]*>([^<]{1,290})<\/title>/i)?.[1]?.trim();
  return {
    title: title || undefined,
    description:
      metaContent(res.body, "og:description") ??
      metaContent(res.body, "description"),
    image:
      metaContent(res.body, "og:image") ??
      metaContent(res.body, "twitter:image"),
    siteName: metaContent(res.body, "og:site_name"),
  };
}
