import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Rostos",
    emojis: [
      "😀", "😄", "😁", "🤣", "😂", "🙂", "😉", "😊", "😍", "😘", "😜", "🤪",
      "🤔", "🤨", "😐", "😑", "😶", "🙄", "😏", "😮", "😲", "😳", "🥺", "😢",
      "😭", "😤", "😠", "🤯", "😱", "🥳", "😎", "🤓", "🧐", "😴", "🤤", "🫡",
    ],
  },
  {
    label: "Gestos",
    emojis: [
      "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🙏", "💪",
      "🫶", "🤝", "✍️", "👋", "🖐️", "✋", "👊",
    ],
  },
  {
    label: "Corações",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💯", "💥", "✨"],
  },
  {
    label: "Objetos",
    emojis: [
      "🔥", "🎉", "🎊", "🎈", "🎁", "🏆", "⚽", "🎮", "🎲", "🎵", "🎶", "🎧",
      "📌", "📎", "✂️", "🔒", "🔑", "💡", "📚", "💻", "📱", "🚀", "⭐", "🌙",
    ],
  },
];

export function EmojiPicker({
  onPick,
  children,
}: {
  onPick: (emoji: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-2" side="top" align="end">
        <div className="max-h-64 overflow-y-auto space-y-2">
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-[11px] font-semibold uppercase text-muted-foreground px-1 mb-1">
                {group.label}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="text-xl p-1 rounded hover:bg-hover transition-colors"
                    onClick={() => onPick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
