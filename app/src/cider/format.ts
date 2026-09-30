/**
 * Formatação de valores para a interface.
 *
 * Fica fora dos módulos de componente de propósito: um arquivo que exporta
 * `timecode` **e** componentes quebra a atualização rápida do React (o recarregamento
 * precisa saber recarregar só componentes), então este utilitário tem casa própria.
 */

/** Duração em `mm:ss` — ou `h:mm:ss` quando passa de uma hora. */
export function timecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
