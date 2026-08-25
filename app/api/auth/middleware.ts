import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import { verifySessionToken } from "./token";
import { resolveActiveSession } from "./sessions";
import { findUserByUnionId } from "../queries/users";

/**
 * Autenticação do Nexora — cookie HttpOnly com JWT de sessão.
 *
 * O JWT precisa conter `sid` e a sessão correspondente deve estar ativa
 * em banco. Sessão revogada (logout remoto) => 403 imediato.
 */

export async function authenticateRequest(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies[Session.cookieName];
  if (!token) {
    throw Errors.forbidden("Invalid authentication token.");
  }
  const claim = await verifySessionToken(token);
  if (!claim) {
    throw Errors.forbidden("Invalid authentication token.");
  }
  const session = await resolveActiveSession(claim.sid);
  if (!session) {
    throw Errors.forbidden("Sessão encerrada. Faça login novamente.");
  }
  const user = await findUserByUnionId(claim.unionId);
  if (!user) {
    throw Errors.forbidden("User not found. Please re-login.");
  }
  return { user, sessionId: session.id };
}
