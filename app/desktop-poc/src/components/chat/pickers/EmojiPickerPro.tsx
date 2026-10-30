import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type EmojiEntry = { e: string; k: string };

const CATEGORIES: { label: string; items: EmojiEntry[] }[] = [
  {
    label: "Pessoas",
    items: [
      { e: "😀", k: "feliz sorriso smile happy" }, { e: "😄", k: "feliz sorriso happy" },
      { e: "😁", k: "sorriso beam" }, { e: "🤣", k: "rindo rolando laugh" },
      { e: "😂", k: "chorando de rir joy laugh" }, { e: "🙂", k: "leve sorriso slight" },
      { e: "😉", k: "piscada wink" }, { e: "😊", k: "vergonha feliz blush" },
      { e: "😍", k: "amor olhos heart eyes love" }, { e: "😘", k: "beijo kiss" },
      { e: "😜", k: "lingua piscada zany" }, { e: "🤪", k: "loucura zany crazy" },
      { e: "🤔", k: "pensando thinking" }, { e: "🤨", k: "sobrancelha cética" },
      { e: "😐", k: "neutro neutral" }, { e: "😑", k: "sem expressão" },
      { e: "😶", k: "sem boca silent" }, { e: "🙄", k: "olhando roll eyes" },
      { e: "😏", k: "malícia smirk" }, { e: "😮", k: "boca aberta wow" },
      { e: "😲", k: "surpreso astonished" }, { e: "😳", k: "corado flushed" },
      { e: "🥺", k: "implorando pleading" }, { e: "😢", k: "chorando crying" },
      { e: "😭", k: "chorando alto sob" }, { e: "😤", k: "vitorioso determinado" },
      { e: "😠", k: "raiva angry" }, { e: "🥳", k: "festa party comemorar" },
      { e: "😎", k: "óculos cool" }, { e: "🤓", k: "nerd óculos" },
      { e: "🧐", k: "monóculo inspecionar" }, { e: "😴", k: "dormindo sleep" },
      { e: "🤤", k: "babando drool" }, { e: "🫡", k: "saudação militar salute" },
      { e: "😱", k: "grito medo scream" }, { e: "🤯", k: "explodindo mente mind blown" },
    ],
  },
  {
    label: "Gestos",
    items: [
      { e: "👍", k: "joia positivo thumbs up like" }, { e: "👎", k: "negativo thumbs down" },
      { e: "👌", k: "ok perfeito" }, { e: "✌️", k: "paz victory peace" },
      { e: "🤞", k: "dedos cruzados sorte" }, { e: "🤟", k: "amor você love you" },
      { e: "🤘", k: "rock" }, { e: "👏", k: "palmas clap" },
      { e: "🙌", k: "comemoração levantar raise" }, { e: "🙏", k: "oração obrigado thanks" },
      { e: "💪", k: "força músculo muscle" }, { e: "🫶", k: "coração mãos heart hands" },
      { e: "🤝", k: "aperto de mão handshake" }, { e: "✍️", k: "escrevendo write" },
      { e: "👋", k: "tchau olá wave hello" }, { e: "🖐️", k: "mão aberta hand" },
      { e: "✋", k: "parar stop mão" }, { e: "👊", k: "soco fist bump" },
      { e: "🤛", k: "soco esquerda" }, { e: "🤜", k: "soco direita" },
      { e: "☝️", k: "indicador cima" }, { e: "👇", k: "baixo down" },
      { e: "👈", k: "esquerda left" }, { e: "👉", k: "direita right" },
    ],
  },
  {
    label: "Corações e símbolos",
    items: [
      { e: "❤️", k: "coração vermelho heart love" }, { e: "🧡", k: "coração laranja" },
      { e: "💛", k: "coração amarelo" }, { e: "💚", k: "coração verde" },
      { e: "💙", k: "coração azul" }, { e: "💜", k: "coração roxo" },
      { e: "🖤", k: "coração preto" }, { e: "🤍", k: "coração branco" },
      { e: "💔", k: "coração partido broken" }, { e: "💯", k: "cem pontos 100" },
      { e: "💥", k: "explosão boom" }, { e: "✨", k: "brilho sparkles" },
      { e: "🔥", k: "fogo fire lit" }, { e: "⭐", k: "estrela star" },
      { e: "🌟", k: "estrela brilho glow" }, { e: "🎉", k: "festa confete party" },
      { e: "🎊", k: "confete ball" }, { e: "🎁", k: "presente gift" },
      { e: "🎈", k: "balão balloon" },
    ],
  },
  {
    label: "Animais",
    items: [
      { e: "🐶", k: "cachorro dog" }, { e: "🐱", k: "gato cat" },
      { e: "🐭", k: "rato mouse" }, { e: "🐹", k: "hamster" },
      { e: "🐰", k: "coelho rabbit" }, { e: "🦊", k: "raposa fox" },
      { e: "🐻", k: "urso bear" }, { e: "🐼", k: "panda" },
      { e: "🐨", k: "koala" }, { e: "🐯", k: "tigre tiger" },
      { e: "🦁", k: "leão lion" }, { e: "🐮", k: "vaca cow" },
      { e: "🐷", k: "porco pig" }, { e: "🐸", k: "sapo frog" },
      { e: "🐵", k: "macaco monkey" }, { e: "🐔", k: "galinha chicken" },
      { e: "🐧", k: "pinguim penguin" }, { e: "🐦", k: "pássaro bird" },
      { e: "🦉", k: "coruja owl" }, { e: "🦄", k: "unicórnio unicorn" },
      { e: "🐝", k: "abelha bee" }, { e: "🦋", k: "borboleta butterfly" },
      { e: "🐢", k: "tartaruga turtle" }, { e: "🐙", k: "polvo octopus" },
      { e: "🦀", k: "caranguejo crab" }, { e: "🐠", k: "peixe tropical fish" },
      { e: "🐬", k: "golfinho dolphin" }, { e: "🐳", k: "baleia whale" },
    ],
  },
  {
    label: "Comida",
    items: [
      { e: "🍕", k: "pizza" }, { e: "🍔", k: "hambúrguer burger" },
      { e: "🍟", k: "fritas fries" }, { e: "🌭", k: "cachorro quente hotdog" },
      { e: "🍿", k: "pipoca popcorn" }, { e: "🧂", k: "sal salt" },
      { e: "🥓", k: "bacon" }, { e: "🥚", k: "ovo egg" },
      { e: "🧇", k: "waffle" }, { e: "🥞", k: "panqueca pancakes" },
      { e: "🍞", k: "pão bread" }, { e: "🥐", k: "croissant" },
      { e: "🍰", k: "bolo fatia cake" }, { e: "🎂", k: "bolo aniversário birthday" },
      { e: "🍪", k: "cookie biscoito" }, { e: "🍫", k: "chocolate" },
      { e: "🍬", k: "bala doce candy" }, { e: "🍭", k: "pirulito lollipop" },
      { e: "☕", k: "café coffee" }, { e: "🍵", k: "chá tea" },
      { e: "🧃", k: "suco juice" }, { e: "🥤", k: "refrigerante soda" },
    ],
  },
  {
    label: "Atividades",
    items: [
      { e: "⚽", k: "futebol soccer football" }, { e: "🏀", k: "basquete basketball" },
      { e: "🏈", k: "futebol americano" }, { e: "⚾", k: "beisebol baseball" },
      { e: "🎾", k: "tênis tennis" }, { e: "🏐", k: "vôlei volleyball" },
      { e: "🎳", k: "boliche bowling" }, { e: "🎮", k: "game videogame controle" },
      { e: "🎲", k: "dado dice" }, { e: "🎯", k: "alvo dart target" },
      { e: "🎸", k: "guitarra guitar" }, { e: "🎵", k: "nota musical music" },
      { e: "🎶", k: "notas musicais" }, { e: "🎤", k: "microfone karaoke" },
      { e: "🎧", k: "fone headphones" }, { e: "🎨", k: "arte pintura art" },
      { e: "🚀", k: "foguete rocket lançar" },
    ],
  },
  {
    label: "Objetos e viagem",
    items: [
      { e: "💡", k: "ideia luz light bulb" }, { e: "📱", k: "celular phone" },
      { e: "💻", k: "notebook computador laptop" }, { e: "⌨️", k: "teclado keyboard" },
      { e: "🖥️", k: "computador desktop" }, { e: "📷", k: "câmera camera foto" },
      { e: "🔋", k: "bateria battery" }, { e: "🔑", k: "chave key" },
      { e: "🔒", k: "cadeado lock" }, { e: "📚", k: "livros books" },
      { e: "✏️", k: "lápis pencil" }, { e: "📌", k: "pin pinar" },
      { e: "📎", k: "clipe paperclip anexo" }, { e: "✂️", k: "tesoura scissors" },
      { e: "🔧", k: "chave inglesa wrench" }, { e: "🚗", k: "carro car" },
      { e: "✈️", k: "avião plane viagem" }, { e: "🚢", k: "navio ship" },
      { e: "🏠", k: "casa house home" },
    ],
  },
  {
    label: "Bandeiras",
    items: [
      { e: "🏁", k: "chegada racing" }, { e: "🚩", k: "bandeira vermelha" },
      { e: "🇧🇷", k: "brasil brazil" }, { e: "🇺🇸", k: "estados unidos usa" },
      { e: "🇬🇧", k: "reinado Unido uk" }, { e: "🇯🇵", k: "japão japan" },
      { e: "🇩🇪", k: "alemanha germany" }, { e: "🇫🇷", k: "frança france" },
      { e: "🇮🇹", k: "itália italy" }, { e: "🇪🇸", k: "espanha spain" },
      { e: "🇲🇽", k: "mexico" }, { e: "🇦🇷", k: "argentina" },
      { e: "🇵🇹", k: "portugal" },
    ],
  },
];

const RECENT_KEY = "nexora-recent-emojis";

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string): string[] {
  const next = [emoji, ...loadRecent().filter(e => e !== emoji)].slice(0, 24);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
  return next;
}

/**
 * Emoji picker completo: busca por keywords (pt/en), recentes e categorias.
 */
export function EmojiPickerPro({
  onPick,
  children,
}: {
  onPick: (emoji: string) => void;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return CATEGORIES.flatMap(c => c.items)
      .filter(item => item.k.includes(q))
      .map(item => item.e);
  }, [query]);

  const pick = (emoji: string) => {
    setRecent(saveRecent(emoji));
    onPick(emoji);
  };

  const renderSection = (label: string, emojis: string[]) =>
    emojis.length === 0 ? null : (
      <div key={label} className="mb-2">
        <p className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#8e959f]">
          {label}
        </p>
        <div className="grid grid-cols-8 gap-0.5">
          {emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => pick(emoji)}
              className="rounded p-1 text-xl transition-transform hover:bg-white/10 active:scale-90"
              aria-label={`Inserir ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-80 bg-[#24262c] border-white/10 p-0"
      >
        <div className="border-b border-white/[0.06] p-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Pesquisar emoji…"
            aria-label="Pesquisar emoji"
            className="h-9 w-full rounded-lg bg-[#1a1c21] px-3 text-sm text-white outline-none placeholder:text-[#68707b]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {results ? (
            renderSection("Resultados", results)
          ) : (
            <>
              {renderSection("Recentes", recent)}
              {CATEGORIES.map(cat =>
                renderSection(cat.label, cat.items.map(i => i.e)),
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
