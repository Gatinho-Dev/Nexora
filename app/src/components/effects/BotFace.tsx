import {
  BotAvatar,
  type BotAvatarState,
  type BotAvatarType,
} from "bot-avatars";
import { usePrefersReducedMotion } from "./useNexoraTheme";

const TYPES: BotAvatarType[] = [
  "clover",
  "flower",
  "triangle",
  "square",
  "blob",
  "ghost",
  "circle",
  "drop",
  "star",
  "droid",
  "mech",
  "alien",
  "hexagon",
  "cat",
  "cloud",
  "pill",
  "pebble",
  "puddle",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Avatar generativo de bot (Libraries.dev `bot-avatars`): cada bot ganha um
 * corpo determinístico a partir do nome, em vez das iniciais coloridas.
 */
export function BotFace({
  botId,
  name,
  size = 48,
  state = "default",
}: {
  botId: string | number;
  name: string;
  size?: number;
  state?: BotAvatarState;
}) {
  const reduceMotion = usePrefersReducedMotion();
  const key = String(botId);
  const hash = hashString(key);
  return (
    <BotAvatar
      type={TYPES[hash % TYPES.length]}
      state={state}
      size={size}
      seed={(hash % 1000) / 1000}
      paused={reduceMotion}
      role="img"
      aria-label={`Avatar de ${name}`}
    />
  );
}
