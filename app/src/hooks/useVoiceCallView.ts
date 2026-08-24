import { useLocation } from "react-router";
import { useAppStore } from "@/store/useAppStore";

/** Estado compartilhado da chamada ativa x rota atual (barra x tela cheia). */
export function useVoiceCallView() {
  const location = useLocation();
  const voiceChannelId = useAppStore(s => s.voiceChannelId);
  const voiceConversationId = useAppStore(s => s.voiceConversationId);
  const voiceServerId = useAppStore(s => s.voiceServerId);

  const inCall = voiceChannelId !== null || voiceConversationId !== null;
  const callPath =
    voiceConversationId != null
      ? `/channels/@me/${voiceConversationId}`
      : `/channels/${voiceServerId}/${voiceChannelId}`;
  // true quando o usuário já está NA tela da chamada.
  const viewingCall =
    inCall &&
    (voiceConversationId != null
      ? location.pathname === callPath
      : location.pathname.startsWith(callPath));

  return { inCall, callPath, viewingCall };
}
