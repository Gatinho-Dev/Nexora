import { env } from "./env";

/**
 * URL pública de um arquivo. SEMPRE relativa (`/api/files/:id`): o app é
 * servido pela mesma origem do backend, então URLs relativas funcionam em
 * qualquer domínio (onrender.com, domínio personalizado etc.). URLs absolutas
 * quebram em domínios alternativos porque o cookie de sessão (SameSite=Lax)
 * não é enviado em requests cross-origin — e /api/files exige autenticação.
 */
export function publicFileUrl(fileId: number, _requestUrl?: string): string {
  void env;
  void _requestUrl;
  return `/api/files/${fileId}`;
}
