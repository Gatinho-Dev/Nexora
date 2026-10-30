/**
 * Cores a partir da capa.
 *
 * O modo "cores da capa" precisa de duas cores legíveis derivadas da imagem que
 * está tocando. Isso é feito **no navegador**, com `<canvas>`: a imagem nunca é
 * enviada para um serviço de análise, e nada sai da máquina.
 *
 * O `i.ytimg.com` responde com `access-control-allow-origin: *` (verificado),
 * então a leitura de pixels funciona com `crossOrigin="anonymous"`. Se o host
 * não permitir, a função devolve `null` e o destaque configurado continua
 * valendo — nunca inventa cor.
 *
 * A parte pura (`paletteFromPixels`) é separada da parte de imagem para poder
 * ser testada sem rede nem DOM.
 */

export interface Palette {
  accent: string;
  secondary: string;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Converte RGB (0–255) em HSL (h 0–360, s/l 0–1). */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const l = (max + min) / 2;
  if (delta === 0) return { h: 0, s: 0, l };
  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === red) h = ((green - blue) / delta) % 6;
  else if (max === green) h = (blue - red) / delta + 2;
  else h = (red - green) / delta + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

const hsl = (h: number, s: number, l: number): string =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

const HUE_BUCKETS = 12;
const BUCKET_SIZE = 360 / HUE_BUCKETS;

/** Distância de matiz considerando o círculo. */
function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Duas cores a partir dos pixels: a matiz dominante vira o destaque, e a
 * segunda matiz **distante** (pelo menos 40°) vira o destaque secundário.
 *
 * Pixels quase acromáticos são ignorados: capa em preto e branco não tem cor
 * para extrair, e usar o cinza como destaque deixaria a interface apagada.
 */
export function paletteFromPixels(pixels: Rgba[], mode: "dark" | "light" = "dark"): Palette | null {
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({ weight: 0, hueSin: 0, hueCos: 0 }));

  for (const pixel of pixels) {
    if ((pixel.a ?? 255) < 200) continue;
    const { h, s, l } = rgbToHsl(pixel.r, pixel.g, pixel.b);
    if (s < 0.15 || l < 0.07 || l > 0.96) continue;
    // A saturação pondera: uma faixa muito colorida pesa mais que um detalhe.
    const weight = s * (1 - Math.abs(l - 0.5));
    const bucket = buckets[Math.min(HUE_BUCKETS - 1, Math.floor(h / BUCKET_SIZE))];
    if (!bucket) continue;
    const radians = (h * Math.PI) / 180;
    bucket.weight += weight;
    bucket.hueSin += Math.sin(radians) * weight;
    bucket.hueCos += Math.cos(radians) * weight;
  }

  const ranked = buckets
    .map((bucket, index) => ({
      index,
      weight: bucket.weight,
      hue:
        bucket.weight > 0
          ? (((Math.atan2(bucket.hueSin, bucket.hueCos) * 180) / Math.PI + 360) % 360)
          : index * BUCKET_SIZE,
    }))
    .filter((bucket) => bucket.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  const accent = ranked[0];
  if (!accent) return null;

  const secondary =
    ranked.slice(1).find((bucket) => hueDistance(bucket.hue, accent.hue) >= 40) ?? {
      hue: (accent.hue + 42) % 360,
    };

  // Legibilidade: no escuro o destaque sobe de luz; no claro, desce.
  const accentLight = mode === "light" ? 0.42 : 0.62;
  const secondaryLight = mode === "light" ? 0.4 : 0.58;

  return {
    accent: hsl(accent.hue, 0.72, accentLight),
    secondary: hsl(secondary.hue, 0.68, secondaryLight),
  };
}

/* ------------------------------------------------------------------ *
 * Imagem → pixels                                                    *
 * ------------------------------------------------------------------ */

const SAMPLE_SIZE = 28;
const cache = new Map<string, Palette | null>();

/** Lê a capa e devolve a paleta (ou `null` quando não há como ler). */
export async function extractPalette(
  url: string,
  mode: "dark" | "light" = "dark",
): Promise<Palette | null> {
  if (!url || typeof document === "undefined") return null;
  const key = `${mode}|${url}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const image = new Image();
  // Sem isso o canvas fica "sujo" e a leitura de pixels lança.
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "no-referrer";

  const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível carregar a capa"));
    image.src = url;
  });

  try {
    const picture = await loaded;
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(picture, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const data = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
    const pixels: Rgba[] = [];
    for (let index = 0; index < data.length; index += 4) {
      pixels.push({
        r: data[index] ?? 0,
        g: data[index + 1] ?? 0,
        b: data[index + 2] ?? 0,
        a: data[index + 3] ?? 255,
      });
    }
    const palette = paletteFromPixels(pixels, mode);
    cache.set(key, palette);
    return palette;
  } catch {
    // Host sem CORS, offline ou imagem quebrada: o destaque configurado segue.
    cache.set(key, null);
    return null;
  }
}
