import { env } from "./env";

export function publicFileUrl(fileId: number, requestUrl?: string): string {
  const origin =
    env.publicApiUrl || (requestUrl ? new URL(requestUrl).origin : "");
  return `${origin}/api/files/${fileId}`;
}
