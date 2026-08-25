import * as jose from "jose";
import { env } from "../lib/env";

/**
 * Token de sessão do Nexora — JWT HS256 assinado com APP_SECRET.
 *
 * O payload inclui `sid`: o id da sessão em banco, que permite revogação
 * remota (Dispositivos conectados). Tokens sem `sid` são legados e não
 * são mais aceitos.
 */

const JWT_ALG = "HS256";

export type SessionPayload = {
  unionId: string;
  clientId: string;
  /** Id da sessão na tabela account_sessions. */
  sid: string;
};

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  const secret = new TextEncoder().encode(env.appSecret);
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime("1 year")
    .sign(secret);
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(env.appSecret);
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: [JWT_ALG],
    });
    const { unionId, clientId, sid } = payload;
    if (!unionId || !clientId || !sid) return null;
    return { unionId, clientId, sid } as SessionPayload;
  } catch {
    return null;
  }
}
