import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Keyboard, Mic, Monitor, Play, Sparkles, Square } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEFAULT_DEVICE_PREFS, getDevicePrefs, setDevicePrefs, type DevicePrefs } from "@/lib/devices";
import { voiceManager } from "@/lib/rtc";
import {
  createAudioProcessingSession,
  microphoneConstraints,
  type AudioProcessingSession,
} from "@/lib/voice/audioProcessing";
import { useSettingsStore } from "@/store/useSettingsStore";
import { AudioClipStudio } from "@/components/settings/AudioClipStudio";
import {
  DiscordCard,
  DiscordDangerButton,
  DiscordDivider,
  DiscordLevelMeter,
  DiscordPageHeader,
  DiscordRadioCards,
  DiscordSectionTitle,
  DiscordSlider,
  DiscordToggle,
  type DiscordOption,
} from "@/components/settings/DiscordSettings";
import type { VoiceInputMode } from "@/lib/clientSettings";

type AudioProcessingMode = NonNullable<DevicePrefs["audioProcessing"]>;
type StreamQuality = NonNullable<DevicePrefs["streamQuality"]>;

const AUDIO_PROCESSING_OPTIONS: DiscordOption<AudioProcessingMode>[] = [
  { value: "off", label: "Desligado", description: "Áudio sem redução" },
  { value: "standard", label: "Padrão", description: "Processamento do navegador" },
  { value: "clearvoice", label: "ClearVoice", description: "Pipeline de áudio Nexora" },
];

const STREAM_QUALITY_OPTIONS: DiscordOption<StreamQuality>[] = [
  { value: "720p30", label: "720p 30 fps", description: "Menor uso de banda" },
  { value: "1080p30", label: "1080p 30 fps", description: "Nitidez equilibrada" },
  { value: "1080p60", label: "1080p 60 fps", description: "Movimento mais fluido" },
];

const VOICE_INPUT_OPTIONS: DiscordOption<VoiceInputMode>[] = [
  {
    value: "activity",
    label: "Atividade de voz",
    description: "O microfone abre sozinho quando você fala.",
  },
  {
    value: "ptt",
    label: "Push-to-Talk",
    description: "Só transmite enquanto a tecla estiver pressionada.",
  },
];

/**
 * "Voz e vídeo" — dispositivos, ganhos, medidor de microfone e o pipeline de DSP.
 *
 * Os dois ganhos (entrada e saída) são nós de ganho reais no grafo de áudio do
 * teste: o que você move aqui é o que o medidor mostra e o que a amostra grava.
 * Todas as preferênciasDSP vivem na store global, então sair e voltar para a aba
 * não perde nada.
 */
export function VoiceVideoTab() {
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [prefs, setPrefs] = useState(getDevicePrefs());
  const [testing, setTesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState(false);
  const testSessionRef = useRef<AudioProcessingSession | null>(null);
  const testContextRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const inputGainRef = useRef<GainNode | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);

  const { inputVolume, outputVolume, voiceInputMode, attenuation, bypassProcessing } =
    useSettingsStore(state => state.settings);
  const patch = useSettingsStore(state => state.patch);

  const supportsOutputSelection =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  // Bypass manda o áudio bruto do microfone, sem nenhum processamento da Nexora.
  const effectivePrefs: DevicePrefs = bypassProcessing
    ? { ...prefs, audioProcessing: "off" }
    : prefs;

  const applyGains = (context: AudioContext, source: MediaStreamAudioSourceNode) => {
    const inputGain = context.createGain();
    inputGain.gain.value = inputVolume / 100;
    const outputGain = context.createGain();
    outputGain.gain.value = outputVolume / 100;
    source.connect(inputGain);
    inputGain.connect(outputGain);
    inputGainRef.current = inputGain;
    outputGainRef.current = outputGain;
    return outputGain;
  };

  const stopTest = async () => {
    cancelAnimationFrame(rafRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    recorderRef.current = null;
    await testSessionRef.current?.close();
    testSessionRef.current = null;
    if (testContextRef.current?.state !== "closed") {
      await testContextRef.current?.close().catch(() => {});
    }
    testContextRef.current = null;
    inputGainRef.current = null;
    outputGainRef.current = null;
    setTesting(false);
    setRecording(false);
    setLevel(0);
  };

  const loadDevices = async () => {
    try {
      const probe = await navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .catch(() => null);
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(devices.filter(d => d.kind === "audioinput"));
      setAudioOutputs(devices.filter(d => d.kind === "audiooutput"));
      setVideoInputs(devices.filter(d => d.kind === "videoinput"));
      probe?.getTracks().forEach(t => t.stop());
    } catch {
      // Enumeração negada pelo navegador: a lista fica só com o padrão.
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadDevices();
    }, 0);
    navigator.mediaDevices?.addEventListener("devicechange", loadDevices);
    return () => {
      window.clearTimeout(loadTimer);
      cancelAnimationFrame(rafRef.current);
      navigator.mediaDevices?.removeEventListener("devicechange", loadDevices);
      void stopTest();
    };
  }, []);

  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    },
    [recordingUrl]
  );

  // Ganhos movidos com o teste rodando são aplicados em tempo real.
  useEffect(() => {
    if (inputGainRef.current) inputGainRef.current.gain.value = inputVolume / 100;
  }, [inputVolume]);
  useEffect(() => {
    if (outputGainRef.current) outputGainRef.current.gain.value = outputVolume / 100;
  }, [outputVolume]);

  const startTest = async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: microphoneConstraints(effectivePrefs),
        video: false,
      });
      const session = await createAudioProcessingSession(rawStream, effectivePrefs);
      testSessionRef.current = session;
      const ctx = new AudioContext({ latencyHint: "interactive" });
      testContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(session.outputStream);
      const tail = applyGains(ctx, source);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      tail.connect(analyser);
      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        const energy = data.reduce((sum, sample) => sum + sample * sample, 0);
        setLevel(
          Math.min(100, Math.round(Math.sqrt(energy / data.length) * 700))
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setTesting(true);
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const updatePref = useCallback(async (next: Partial<DevicePrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    setDevicePrefs(next);
    try {
      if ("audioInputId" in next) {
        await voiceManager.switchAudioInput(next.audioInputId);
      } else if ("videoInputId" in next) {
        await voiceManager.switchVideoInput(next.videoInputId);
      } else if (
        "audioProcessing" in next ||
        "echoCancellation" in next ||
        "noiseSuppression" in next ||
        "autoGainControl" in next
      ) {
        await voiceManager.reconfigureAudioProcessing();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível trocar o dispositivo."
      );
    }
  }, [prefs]);

  useEffect(() => {
    if (!recordingKey) return;
    const captureKeybind = (event: KeyboardEvent) => {
      event.preventDefault();
      const key = event.key === " " ? "Space" : event.key;
      const modifiers: string[] = [];
      if (event.ctrlKey) modifiers.push("Ctrl");
      if (event.shiftKey) modifiers.push("Shift");
      if (event.altKey) modifiers.push("Alt");
      if (event.metaKey) modifiers.push("Meta");
      void updatePref({
        pushToTalkKeybind: [...modifiers, key].join("+"),
      });
      setRecordingKey(false);
    };
    window.addEventListener("keydown", captureKeybind);
    return () => window.removeEventListener("keydown", captureKeybind);
  }, [recordingKey, updatePref]);

  const recordSample = async () => {
    if (!testSessionRef.current) await startTest();
    const stream = testSessionRef.current?.outputStream;
    if (!stream || typeof MediaRecorder === "undefined") {
      toast.error("A gravação de teste não é suportada neste navegador.");
      return;
    }
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = event => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      setRecordingUrl(
        URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }))
      );
      setRecording(false);
    };
    recorder.start();
    setRecording(true);
    window.setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 4_000);
  };

  return (
    <div className="space-y-6">
      <DiscordPageHeader
        title="Voz e Vídeo"
        description="Dispositivos, níveis de áudio e o processamento de sinal que roda antes de cada chamada."
      />

      <DiscordCard
        tone={bypassProcessing ? "danger" : "accent"}
        title="Dispositivos"
        description="Roteamentos que o sistema não consegue adivinhar costumam ser resolvidos aqui."
      >
        <div className="space-y-1">
          <div className="space-y-2 px-4 py-3">
            <label className="block text-[13px] font-semibold text-white">
              Dispositivo de entrada (microfone)
            </label>
            <Select
              value={prefs.audioInputId ?? "default"}
              onValueChange={value =>
                void updatePref({
                  audioInputId: value === "default" ? undefined : value,
                })
              }
            >
              <SelectTrigger
                className="border-black/20 bg-[#1E1F22] text-white"
                aria-label="Dispositivo de entrada"
              >
                <SelectValue placeholder="Microfone padrão" />
              </SelectTrigger>
              <SelectContent className="border-black/20 bg-[#1E1F22] text-white">
                <SelectItem value="default">Microfone padrão</SelectItem>
                {audioInputs
                  .filter(device => device.deviceId !== "default")
                  .map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label ||
                        `Microfone (${device.deviceId.slice(0, 6)})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DiscordDivider />
          <div className="space-y-2 px-4 py-3">
            <label className="block text-[13px] font-semibold text-white">
              Dispositivo de saída
            </label>
            <Select
              disabled={!supportsOutputSelection}
              value={prefs.audioOutputId ?? "default"}
              onValueChange={value =>
                void updatePref({
                  audioOutputId: value === "default" ? undefined : value,
                })
              }
            >
              <SelectTrigger
                className="border-black/20 bg-[#1E1F22] text-white"
                aria-label="Dispositivo de saída"
              >
                <SelectValue placeholder="Saída padrão" />
              </SelectTrigger>
              <SelectContent className="border-black/20 bg-[#1E1F22] text-white">
                <SelectItem value="default">Saída padrão</SelectItem>
                {audioOutputs
                  .filter(device => device.deviceId !== "default")
                  .map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label ||
                        `Saída (${device.deviceId.slice(0, 6)})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {!supportsOutputSelection && (
              <p className="text-[10px] text-[#949BA4]">
                Este navegador usa a saída definida pelo sistema operacional.
              </p>
            )}
          </div>
          <DiscordDivider />
          <div className="space-y-2 px-4 py-3">
            <label className="block text-[13px] font-semibold text-white">
              Câmera
            </label>
            <Select
              value={prefs.videoInputId ?? "default"}
              onValueChange={value =>
                void updatePref({
                  videoInputId: value === "default" ? undefined : value,
                })
              }
            >
              <SelectTrigger
                className="border-black/20 bg-[#1E1F22] text-white"
                aria-label="Câmera"
              >
                <SelectValue placeholder="Câmera padrão" />
              </SelectTrigger>
              <SelectContent className="border-black/20 bg-[#1E1F22] text-white">
                <SelectItem value="default">Câmera padrão</SelectItem>
                {videoInputs
                  .filter(device => device.deviceId !== "default")
                  .map(device => (
                    <SelectItem key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera (${device.deviceId.slice(0, 6)})`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </DiscordCard>

      <DiscordCard
        title="Volumes"
        description="Ganho aplicado no grafo de áudio: acima de 100% há risco de distorção (clipping)."
      >
        <DiscordSlider
          label="Volume de entrada"
          value={inputVolume}
          min={0}
          max={200}
          step={5}
          formatValue={value => `${value}%`}
          hints={["Mudo", "100%", "+100%"]}
          onChange={value => patch({ inputVolume: value })}
        />
        <DiscordDivider />
        <DiscordSlider
          label="Volume de saída"
          value={outputVolume}
          min={0}
          max={200}
          step={5}
          formatValue={value => `${value}%`}
          hints={["Mudo", "100%", "+100%"]}
          onChange={value => patch({ outputVolume: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Teste de microfone"
        description="A barra mostra o sinal em tempo real e fica verde quando há voz detectada."
      >
        <div className="space-y-3 px-4 py-2">
          <DiscordLevelMeter level={level} />
          <div className="flex flex-wrap gap-2">
            <Button
              variant={testing ? "destructive" : "secondary"}
              size="sm"
              onClick={() => (testing ? void stopTest() : void startTest())}
              className="text-xs font-bold"
            >
              <Mic className="mr-1.5 h-3.5 w-3.5" />
              {testing ? "Parar teste" : "Testar microfone"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={recording}
              onClick={() => void recordSample()}
              className="text-xs font-bold"
            >
              {recording ? (
                <Square className="mr-1.5 h-3.5 w-3.5" />
              ) : (
                <Play className="mr-1.5 h-3.5 w-3.5" />
              )}
              {recording ? "Gravando 4 s" : "Gravar amostra"}
            </Button>
          </div>
          {recordingUrl && (
            <audio
              src={recordingUrl}
              controls
              className="h-9 w-full"
              aria-label="Reproduzir amostra do microfone"
            />
          )}
        </div>
      </DiscordCard>

      <DiscordCard
        title="Modo de entrada"
        description="Detecção automática de atividade de voz ou transmissão manual por tecla."
      >
        <div className="px-4 py-2">
          <DiscordRadioCards
            legend="Modo de entrada de voz"
            columns={2}
            value={voiceInputMode}
            onChange={value => patch({ voiceInputMode: value })}
            options={VOICE_INPUT_OPTIONS}
          />
        </div>

        <DiscordDivider />
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white">
              Sensibilidade automática
            </p>
            <p className="mt-0.5 text-[11px] text-[#B5BAC1]">
              Ajusta o indicador ao ruído do ambiente.
            </p>
          </div>
          <Switch
            checked={prefs.inputSensitivityMode !== "manual"}
            onCheckedChange={checked =>
              void updatePref({
                inputSensitivityMode: checked ? "automatic" : "manual",
              })
            }
            aria-label="Sensibilidade automática"
          />
        </div>
        {prefs.inputSensitivityMode === "manual" && (
          <>
            <DiscordDivider />
            <DiscordSlider
              label="Sensibilidade de entrada"
              value={prefs.inputSensitivity ?? 28}
              min={0}
              max={100}
              step={1}
              formatValue={value => `${value}%`}
              hints={["Mais seletivo", "Mais sensível"]}
              onChange={value => void updatePref({ inputSensitivity: value })}
            />
          </>
        )}

        {voiceInputMode === "ptt" && (
          <>
            <DiscordDivider />
            <div className="space-y-3 px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#5865F2] text-white">
                  <Keyboard className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white">
                    Tecla do push-to-talk
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[#B5BAC1]">
                    Segure a combinação para falar; ao soltar, o microfone volta ao
                    silêncio.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRecordingKey(true)}
                  className={cn(
                    "min-h-12 flex-1 rounded-lg border px-4 py-2 text-left font-mono text-sm transition-colors",
                    recordingKey
                      ? "border-[#7383FF] bg-[#5865F2]/20 text-[#9aa5ff]"
                      : "border-white/[0.08] bg-[#1E1F22] text-[#B5BAC1] hover:border-white/20 hover:text-white"
                  )}
                  aria-pressed={recordingKey}
                >
                  {recordingKey
                    ? "Pressione a combinação…"
                    : (prefs.pushToTalkKeybind ?? "Não configurado")}
                </button>
                {prefs.pushToTalkKeybind && (
                  <button
                    type="button"
                    onClick={() =>
                      void updatePref({ pushToTalkKeybind: undefined })
                    }
                    className="min-h-11 text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </DiscordCard>

      <DiscordCard
        tone="accent"
        icon={<Sparkles className="size-4" />}
        title="Processamento de sinal"
        description="Escolha o motor de áudio e ajuste os algoritmos que rodam antes de cada chamada."
      >
        <div className="px-4 py-2">
          <DiscordRadioCards
            legend="Modo de supressão de ruído"
            columns={3}
            value={prefs.audioProcessing ?? "standard"}
            onChange={value => void updatePref({ audioProcessing: value })}
            options={AUDIO_PROCESSING_OPTIONS}
          />
        </div>
        <DiscordDivider />
        <div className="px-4 py-2">
          <DiscordSectionTitle>Algoritmos</DiscordSectionTitle>
          <div className="mt-2 divide-y divide-black/20 rounded-lg bg-[#1E1F22] px-4">
            {(
              [
                ["noiseSuppression", "Supressão de ruído (Krisp)"],
                ["echoCancellation", "Cancelamento de eco (AEC)"],
                ["autoGainControl", "Controle automático de ganho (AGC)"],
              ] as const
            ).map(([key, label]) => (
              <DiscordToggle
                key={key}
                label={label}
                disabled={prefs.audioProcessing !== "standard"}
                checked={prefs[key] ?? true}
                onCheckedChange={checked => void updatePref({ [key]: checked })}
              />
            ))}
          </div>
        </div>
        <DiscordDivider />
        <DiscordSlider
          label="Atenuação dos demais participantes"
          value={attenuation}
          min={0}
          max={100}
          step={5}
          formatValue={value => `${value}%`}
          hints={["Sem atenuação", "Silenciar quase tudo"]}
          onChange={value => patch({ attenuation: value })}
        />
        <DiscordDivider />
        <DiscordToggle
          label="Ignorar todo o processamento"
          description="Envia o áudio cru do microfone, sem filtro, eco nem ganho — útil para depurar ruídos do próprio sistema."
          checked={bypassProcessing}
          onCheckedChange={value => patch({ bypassProcessing: value })}
        />
      </DiscordCard>

      <DiscordCard
        title="Qualidade do compartilhamento de tela"
        description="Escolha uma resolução compatível com a sua banda."
      >
        <div className="px-4 py-2">
          <DiscordRadioCards
            legend="Qualidade do compartilhamento de tela"
            columns={3}
            value={prefs.streamQuality ?? "720p30"}
            onChange={value => void updatePref({ streamQuality: value })}
            options={STREAM_QUALITY_OPTIONS}
          />
        </div>
      </DiscordCard>

      <DiscordCard tone="danger" icon={<Monitor className="size-4" />}>
        <DiscordDangerButton
          onClick={() => {
            setPrefs({ ...DEFAULT_DEVICE_PREFS });
            setDevicePrefs({ ...DEFAULT_DEVICE_PREFS });
            void voiceManager.reconfigureAudioProcessing().catch(() => {});
            void stopTest();
            toast.success("Configurações de voz e vídeo restauradas.");
          }}
        >
          Redefinir configurações de Voz e Vídeo
        </DiscordDangerButton>
        <p className="mt-2 flex items-start gap-2 text-[10px] leading-relaxed text-[#949BA4]">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
          Apaga apenas os valores locais de dispositivo e DSP. Os atalhos globais
          ficam na aba Atalhos.
        </p>
      </DiscordCard>

      <AudioClipStudio />
    </div>
  );
}
