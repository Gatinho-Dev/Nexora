import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Play, Save, Scissors, Square, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { apiUrl } from "@/lib/endpoints";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

type PreparedAudio = { file: File; url: string; durationMs: number; waveform: number[] };

async function inspectAudio(file: File): Promise<PreparedAudio> {
  const bytes = await file.arrayBuffer();
  const context = new AudioContext();
  try {
    const buffer = await context.decodeAudioData(bytes.slice(0));
    const channel = buffer.getChannelData(0);
    const bars = 64;
    const block = Math.max(1, Math.floor(channel.length / bars));
    const waveform = Array.from({ length: bars }, (_, index) => {
      let peak = 0;
      const end = Math.min(channel.length, (index + 1) * block);
      for (let cursor = index * block; cursor < end; cursor += 1) peak = Math.max(peak, Math.abs(channel[cursor]));
      return Number(Math.min(1, peak).toFixed(4));
    });
    return { file, url: URL.createObjectURL(file), durationMs: Math.round(buffer.duration * 1000), waveform };
  } finally {
    await context.close();
  }
}

async function renderWav(file: File, startMs: number, endMs: number, volume: number) {
  const context = new AudioContext();
  try {
    const source = await context.decodeAudioData(await file.arrayBuffer());
    const startFrame = Math.floor(startMs / 1000 * source.sampleRate);
    const endFrame = Math.min(source.length, Math.ceil(endMs / 1000 * source.sampleRate));
    const frames = Math.max(1, endFrame - startFrame);
    const channels = Math.min(2, source.numberOfChannels);
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + frames * channels * bytesPerSample);
    const view = new DataView(buffer);
    const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
    write(0, "RIFF"); view.setUint32(4, buffer.byteLength - 8, true); write(8, "WAVE"); write(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true); view.setUint32(24, source.sampleRate, true);
    view.setUint32(28, source.sampleRate * channels * bytesPerSample, true); view.setUint16(32, channels * bytesPerSample, true); view.setUint16(34, 16, true);
    write(36, "data"); view.setUint32(40, frames * channels * bytesPerSample, true);
    let offset = 44;
    const gain = volume / 100;
    const channelData = Array.from({ length: channels }, (_, channel) => source.getChannelData(channel));
    for (let frame = 0; frame < frames; frame += 1) for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][startFrame + frame] * gain));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
    return new File([buffer], `${file.name.replace(/\.[^.]+$/, "")}-clip.wav`, { type: "audio/wav" });
  } finally { await context.close(); }
}

export function AudioClipStudio() {
  const clips = trpc.advanced.server.audioClips.useQuery();
  const [prepared, setPrepared] = useState<PreparedAudio | null>(null);
  const [name, setName] = useState("");
  const [range, setRange] = useState<[number, number]>([0, 1]);
  const [volume, setVolume] = useState(100);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const save = trpc.advanced.server.saveAudioClip.useMutation({
    onSuccess: () => { toast.success("Clipe salvo."); void clips.refetch(); clearPrepared(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.advanced.server.deleteAudioClip.useMutation({
    onSuccess: () => { toast.success("Clipe removido."); void clips.refetch(); },
    onError: error => toast.error(error.message),
  });

  const clearPrepared = () => {
    setPrepared(current => { if (current) URL.revokeObjectURL(current.url); return null; });
    setName(""); setRange([0, 1]); setVolume(100);
  };
  useEffect(() => () => { if (prepared) URL.revokeObjectURL(prepared.url); }, [prepared]);

  const prepare = async (file: File) => {
    if (!file.type.startsWith("audio/")) return toast.error("Escolha um arquivo de áudio.");
    try {
      const result = await inspectAudio(file);
      if (result.durationMs > 60_000) throw new Error("O clipe deve ter no máximo 60 segundos.");
      setPrepared(current => { if (current) URL.revokeObjectURL(current.url); return result; });
      setName(file.name.replace(/\.[^.]+$/, "").slice(0, 64));
      setRange([0, result.durationMs]);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Áudio inválido."); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const current = new MediaRecorder(stream);
      recordedChunks.current = [];
      current.ondataavailable = event => { if (event.data.size) recordedChunks.current.push(event.data); };
      current.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(recordedChunks.current, { type: current.mimeType || "audio/webm" });
        void prepare(new File([blob], `clip-${Date.now()}.webm`, { type: blob.type }));
      };
      current.start(200);
      recorder.current = current;
      setRecording(true);
      window.setTimeout(() => { if (current.state === "recording") current.stop(); setRecording(false); }, 60_000);
    } catch { toast.error("Não foi possível acessar o microfone."); }
  };

  const uploadAndSave = async () => {
    if (!prepared || !name.trim()) return;
    try {
      const rendered = await renderWav(prepared.file, range[0], range[1], volume);
      const form = new FormData(); form.append("file", rendered);
      const response = await fetch(apiUrl("/api/upload"), { method: "POST", body: form, credentials: "include" });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok || !data.id) throw new Error(data.error || "Falha no upload.");
      await save.mutateAsync({ fileId: data.id, name: name.trim(), startMs: 0, endMs: Math.round(range[1] - range[0]), volume: 100, waveform: prepared.waveform });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o clipe."); }
  };

  return <section className="space-y-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-5">
    <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#4654d8] text-white"><Scissors className="size-4" /></span><div><p className="text-sm font-bold text-white">Clipes de áudio</p><p className="mt-1 text-[11px] text-muted2">Grave, corte e salve sons privados para usar nas mensagens.</p></div></div>
    {!prepared ? <div className="grid grid-cols-2 gap-2"><input ref={input} type="file" accept="audio/*" className="hidden" onChange={event => event.target.files?.[0] && void prepare(event.target.files[0])} /><Button variant="secondary" className="min-h-11" onClick={() => input.current?.click()}><Upload className="mr-2 size-4" />Enviar áudio</Button><Button variant={recording ? "destructive" : "secondary"} className="min-h-11" onClick={() => { if (recording) { recorder.current?.stop(); setRecording(false); } else void startRecording(); }}>{recording ? <Square className="mr-2 size-4" /> : <Mic className="mr-2 size-4" />}{recording ? "Parar" : "Gravar"}</Button></div> : <div className="space-y-4 rounded-xl border border-white/[0.07] bg-black/10 p-3">
      <div className="flex h-20 items-center gap-[2px] overflow-hidden rounded-lg bg-black/20 px-2" aria-label="Forma de onda do áudio">{prepared.waveform.map((bar, index) => <span key={index} className="min-w-[2px] flex-1 rounded-full bg-[#7383ff]" style={{ height: `${Math.max(6, bar * 64)}px` }} />)}</div>
      <audio src={prepared.url} controls className="h-9 w-full" />
      <Input value={name} onChange={event => setName(event.target.value)} maxLength={64} placeholder="Nome do clipe" />
      <div className="space-y-2"><div className="flex justify-between text-[10px] text-muted2"><span>Corte: {(range[0] / 1000).toFixed(1)}s</span><span>{(range[1] / 1000).toFixed(1)}s</span></div><Slider min={0} max={prepared.durationMs} step={100} minStepsBetweenThumbs={1} value={range} onValueChange={value => setRange(value as [number, number])} aria-label="Intervalo do clipe" /></div>
      <div className="space-y-2"><div className="flex justify-between text-[10px] text-muted2"><span>Volume</span><span>{volume}%</span></div><Slider min={0} max={100} value={[volume]} onValueChange={([value]) => setVolume(value)} /></div>
      <div className="flex justify-end gap-2"><Button variant="ghost" onClick={clearPrepared}>Cancelar</Button><Button disabled={save.isPending || !name.trim()} onClick={() => void uploadAndSave()}>{save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Salvar clipe</Button></div>
    </div>}
    {clips.data?.length ? <div className="grid gap-2 sm:grid-cols-2">{clips.data.map(clip => <div key={clip.id} className="flex items-center gap-2 rounded-lg bg-black/10 p-2"><button type="button" onClick={() => { const audio = new Audio(clip.url); audio.volume = clip.volume / 100; audio.currentTime = clip.startMs / 1000; audio.addEventListener("timeupdate", () => { if (audio.currentTime * 1000 >= clip.endMs) audio.pause(); }); void audio.play(); }} className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#4654d8]/20 text-[#aab2ff]" aria-label={`Ouvir ${clip.name}`}><Play className="size-4" /></button><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{clip.name}</p><p className="text-[9px] text-muted2">{((clip.endMs - clip.startMs) / 1000).toFixed(1)}s</p></div><Button size="icon-sm" variant="ghost" disabled={remove.isPending} onClick={() => remove.mutate({ id: clip.id })} aria-label={`Excluir ${clip.name}`}><Trash2 className="size-4 text-red-400" /></Button></div>)}</div> : null}
  </section>;
}
