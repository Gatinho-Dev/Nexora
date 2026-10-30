/** Tempo que uma queda inesperada do socket mantém a vaga na chamada de voz. */
export const VOICE_DROP_GRACE_MS = 15_000;

/**
 * Agenda a remoção de um participante de voz depois de uma queda do socket.
 * Um rejoin (ou a saída do próprio usuário) chama `cancel` antes do prazo.
 */
export function createVoiceDropGrace(graceMs = VOICE_DROP_GRACE_MS) {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  return {
    schedule(userId: number, onExpire: () => void) {
      this.cancel(userId);
      const timer = setTimeout(() => {
        timers.delete(userId);
        onExpire();
      }, graceMs);
      timer.unref?.();
      timers.set(userId, timer);
    },
    cancel(userId: number) {
      const timer = timers.get(userId);
      if (!timer) return;
      clearTimeout(timer);
      timers.delete(userId);
    },
    isPending(userId: number) {
      return timers.has(userId);
    },
  };
}
