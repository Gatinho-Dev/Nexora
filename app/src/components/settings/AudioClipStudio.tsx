import { Loader2, AlertCircle, Mic, MicOff, Play, Square, Volume2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

const CATEGORIES = [
  ["join", "Entrada no canal"],
  ["leave", "Saída do canal"],
  ["mute", "Mutar"],
  ["unmute", "Desmutar"],
  ["deafen", "Ensurdecer"],
  ["undeafen", "Desensurdecer"],
] as const;

export function AudioClipStudio() {
  const [clips, setClips] = useState<
    Array<{ id: string; category: string; name: string; url: string; volume: number }>
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    category: "join",
    name: "",
    url: "",
    volume: 0.5,
  });
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("audio-clips");
      if (stored) setClips(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("audio-clips", JSON.stringify(clips));
  }, [clips]);

  const saveClip = () => {
    if (!formData.name.trim() || !formData.url.trim()) return;
    if (editingId) {
      setClips((c) =>
        c.map((clip) =>
          clip.id === editingId ? { ...formData, id: editingId } : clip
        )
      );
      toast.success("Clipe atualizado.");
    } else {
      setClips((c) => [...c, { ...formData, id: crypto.randomUUID() }]);
      toast.success("Clipe adicionado.");
    }
    setShowForm(false);
    setEditingId(null);
    setFormData({ category: "join", name: "", url: "", volume: 0.5 });
  };

  const deleteClip = (id: string) => {
    setClips((c) => c.filter((clip) => clip.id !== id));
    toast.success("Clipe removido.");
  };

  const playClip = (clip: typeof clips[0]) => {
    if (playingId === clip.id) {
      audioRefs.current[clip.id]?.pause();
      setPlayingId(null);
      return;
    }
    if (playingId) audioRefs.current[playingId]?.pause();
    const audio = new Audio(clip.url);
    audio.volume = clip.volume;
    audioRefs.current[clip.id] = audio;
    audio.play();
    setPlayingId(clip.id);
    audio.onended = () => setPlayingId(null);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setFormData((f) => ({ ...f, category: e.target.value }));
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((f) => ({ ...f, name: e.target.value }));
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((f) => ({ ...f, url: e.target.value }));
  const handleVolumeChange = (v: number[]) =>
    setFormData((f) => ({ ...f, volume: v[0] }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Audio Clip Studio</h2>
          <p className="mt-1 text-xs text-muted2">
            Crie sons personalizados para eventos de voz.
          </p>
        </div>
        <Button
          variant={showForm ? "secondary" : "default"}
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              setEditingId(null);
              setFormData({ category: "join", name: "", url: "", volume: 0.5 });
            }
          }}
        >
          {showForm ? "Cancelar" : "Novo clipe"}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-white/[0.08] bg-sidebar p-5 space-y-4">
          <h3 className="font-bold">{editingId ? "Editar" : "Novo"} clipe</h3>
          <div className="space-y-2">
            <label className="text-xs font-medium">Categoria</label>
            <select value={formData.category} onChange={handleCategoryChange} className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white">
              {CATEGORIES.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={handleNameChange}
              placeholder="Ex: Meu som de entrada"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
              maxLength={40}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">URL do áudio (MP3/OGG)</label>
            <input
              type="url"
              value={formData.url}
              onChange={handleUrlChange}
              placeholder="https://exemplo.com/som.mp3"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Volume: {Math.round(formData.volume * 100)}%</label>
            <Slider
              value={[formData.volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={1}
              step={0.05}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveClip} disabled={!formData.name.trim() || !formData.url.trim()}>
              {editingId ? "Salvar alterações" : "Adicionar clipe"}
            </Button>
            {editingId && (
              <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); setFormData({ category: "join", name: "", url: "", volume: 0.5 }); }}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {clips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
          <Mic className="mx-auto h-10 w-10 text-muted2" />
          <p className="mt-2 text-xs text-muted2">Nenhum clipe criado ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clips.map((clip) => (
            <div key={clip.id} className="rounded-xl border border-white/10 bg-sidebar/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#7383FF]/20 text-[#7383FF]">
                    {CATEGORIES.find(([k]) => k === clip.category)?.[1] ?? clip.category}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{clip.name}</p>
                    <p className="text-[10px] text-muted2 truncate max-w-xs">{clip.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => playClip(clip)}
                    aria-label={playingId === clip.id ? "Parar" : "Reproduzir"}
                  >
                    {playingId === clip.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { setFormData(clip); setEditingId(clip.id); setShowForm(true); }}
                    aria-label="Editar"
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteClip(clip.id)}
                    className="text-red-400 hover:text-red-300"
                    aria-label="Excluir"
                  >
                    <MicOff className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}