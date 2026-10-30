import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Monitor, Play, Square, X, Keyboard } from "lucide-react";
import { Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_DEVICE_PREFS, getDevicePrefs, setDevicePrefs, type DevicePrefs } from "@/lib/devices";
import { liveRtc } from "@/lib/live/rtc";

/**
 * Configurações da chamada do Nexora Live — mesmo layout, controles e
 * comportamento do modal oficial "Voz e Vídeo" (UserSettingsModal):
 * supressão de ruído (Desligado/Padrão/ClearVoice), dispositivos, teste de
 * microfone com medidor, sensibilidade, push-to-talk e qualidade de share.
 */

type MicTestState = {
  session: Awaited<ReturnType<typeof import("@/lib/voice/audioProcessing").createAudioProcessingSession>>;
  context: AudioContext;
  analyser: AnalyserNode;
  raf: number;
};

const NOISE_MODES = [
  ["off", "Desligado", "Áudio sem redução"],
  ["standard", "Padrão", "Processamento do navegador"],
  ["clearvoice", "ClearVoice", "Pipeline de áudio Nexora"],
] as const;

const NATIVE_TOGGLES = [
  ["noiseSuppression", "Redução de ruído"],
  ["echoCancellation", "Supressão de eco"],
  ["autoGainControl", "Ganho automático"],
] as const;

const QUALITIES = [
  ["720p30", "720p 30 fps", "Menor uso de banda"],
  ["1080p30", "1080p 30 fps", "Nitidez equilibrada"],
  ["1080p60", "1080p 60 fps", "Movimento mais fluido"],
] as const;

export function LiveSettingsPanel({
  onClose,
  onError,
}: {
  onClose(): void;
  onError(message: string): void;
}) {
  const [prefs, setPrefs] = useState<DevicePrefs>(() => getDevicePrefs());
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingKey, setRecordingKey] = useState(false);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const supportsOutputSelection =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const testRef = useRef<MicTestState | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const updatePref = useCallback(
    async (patch: Partial<DevicePrefs>) => {
      const next = { ...getDevicePrefs(), ...patch };
      setPrefs(next);
      setDevicePrefs(patch);
      try {
        if ("audioInputId" in patch) {
          await liveRtc.switchAudioInput();
        } else if ("videoInputId" in patch) {
          await liveRtc.switchVideoInput(patch.videoInputId);
        } else if (
          "audioProcessing" in patch ||
          "echoCancellation" in patch ||
          "noiseSuppression" in patch ||
          "autoGainControl" in patch
        ) {
          await liveRtc.reconfigureAudio();
        }
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "Não foi possível trocar o dispositivo."
        );
      }
    },
    [onError]
  );

  // Dispositivos disponíveis (igual ao modal: probe + devicechange).
  useEffect(() => {
    let probe: MediaStream | null = null;
    const loadDevices = async () => {
      try {
        probe = await navigator.mediaDevices
          .getUserMedia({ audio: true, video: false })
          .catch(() => null);
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === "audioinput"));
        setAudioOutputs(devices.filter(d => d.kind === "audiooutput"));
        setVideoInputs(devices.filter(d => d.kind === "videoinput"));
      } catch {
        // sem permissão: listas vazias
      }
    };
    const timer = window.setTimeout(() => void loadDevices(), 0);
    navigator.mediaDevices?.addEventListener("devicechange", loadDevices);
    return () => {
      window.clearTimeout(timer);
      navigator.mediaDevices?.removeEventListener("devicechange", loadDevices);
      probe?.getTracks().forEach(t => t.stop());
      // Cleanup do teste/gravação ao desmontar.
      const t = testRef.current;
      if (t) {
        cancelAnimationFrame(t.raf);
        t.context.close().catch(() => {});
        t.session.close().catch(() => {});
        testRef.current = null;
      }
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recordingUrl só no unmount
  }, []);

  // Medidor de nível do teste (rAF, fora do React).
  useEffect(() => {
    if (!testing) return;
    const t = testRef.current;
    if (!t) return;
    const data = new Float32Array(t.analyser.fftSize) as Float32Array<ArrayBuffer>;
    const tick = () => {
      t.analyser.getFloatTimeDomainData(data);
      let energy = 0;
      for (let i = 0; i < data.length; i++) energy += data[i] * data[i];
      setLevel(Math.min(100, Math.round(Math.sqrt(energy / data.length) * 700)));
      t.raf = requestAnimationFrame(tick);
    };
    t.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(t.raf);
  }, [testing]);

  const startTest = async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        audio: (
          await import("@/lib/voice/audioProcessing")
        ).microphoneConstraints(getDevicePrefs()),
        video: false,
      });
      const { createAudioProcessingSession } = await import(
        "@/lib/voice/audioProcessing"
      );
      const session = await createAudioProcessingSession(
        rawStream,
        getDevicePrefs()
      );
      const context = new AudioContext({ latencyHint: "interactive" });
      const source = context.createMediaStreamSource(session.outputStream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      testRef.current = { session, context, analyser, raf: 0 };
      setTesting(true);
    } catch {
      onError("Não foi possível acessar o microfone.");
    }
  };

  const stopTest = async () => {
    const t = testRef.current;
    testRef.current = null;
    setTesting(false);
    setLevel(0);
    if (!t) return;
    cancelAnimationFrame(t.raf);
    t.context.close().catch(() => {});
    await t.session.close().catch(() => {});
  };

  const recordSample = async () => {
    if (!testRef.current) await startTest();
    const stream = testRef.current?.session.outputStream;
    if (!stream || typeof MediaRecorder === "undefined") {
      onError("A gravação de teste não é suportada neste navegador.");
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

  // Captura da combinação de push-to-talk.
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
      const keybind = [...modifiers, key].join("+");
      setPrefs(current => ({ ...current, pushToTalkKeybind: keybind }));
      setDevicePrefs({ pushToTalkKeybind: keybind });
      setRecordingKey(false);
    };
    window.addEventListener("keydown", captureKeybind);
    return () => window.removeEventListener("keydown", captureKeybind);
  }, [recordingKey]);

  return (
    <div
      className="live-settings-scrim"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
    <div className="live-settings" role="dialog" aria-modal="true" aria-label="Configurações da chamada">
      <header className="live-settings__header">
        <div>
          <h2>Voz e Vídeo</h2>
          <p>Configure seus dispositivos de áudio e pré-visualize sua câmera.</p>
        </div>
        <button
          type="button"
          className="live-icon-btn"
          onClick={onClose}
          aria-label="Fechar configurações"
          title="Fechar (Esc)"
        >
          <X size={18} />
        </button>
      </header>

      <div className="live-settings__body">
        {/* Supressão de ruído — blocos idênticos ao modal oficial */}
        <section className="live-setcard live-setcard--accent" aria-labelledby="live-noise-heading">
          <div className="live-setcard__head">
            <span className="live-setcard__icon" aria-hidden>
              <Sparkles size={16} />
            </span>
            <div>
              <p id="live-noise-heading" className="live-setcard__title">
                Supressão de ruído
              </p>
              <p className="live-setcard__desc">
                Escolha o áudio nativo do navegador ou o processamento Nexora
                ClearVoice. A chamada continua com fallback automático se o modo
                avançado não estiver disponível.
              </p>
            </div>
          </div>
          <div className="live-setmodes" role="radiogroup" aria-label="Modo de supressão de ruído">
            {NOISE_MODES.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={prefs.audioProcessing === value}
                onClick={() => void updatePref({ audioProcessing: value })}
                className={`live-setmode ${
                  (prefs.audioProcessing ?? "standard") === value
                    ? "live-setmode--on"
                    : ""
                }`}
              >
                <span className="live-setmode__label">{label}</span>
                <span className="live-setmode__desc">{description}</span>
              </button>
            ))}
          </div>
          <div className="live-settoggles">
            {NATIVE_TOGGLES.map(([key, label]) => (
              <label key={key} className="live-settoggle">
                <span>{label}</span>
                <Switch
                  disabled={(prefs.audioProcessing ?? "standard") !== "standard"}
                  checked={prefs[key] ?? true}
                  onCheckedChange={checked => void updatePref({ [key]: checked })}
                  aria-label={label}
                />
              </label>
            ))}
          </div>
          {prefs.audioProcessing !== "standard" && (
            <p className="live-setcard__note">
              Os controles nativos ficam disponíveis no modo Padrão; o ClearVoice
              usa seu próprio pipeline para evitar processamento duplicado.
            </p>
          )}
        </section>

        {/* Dispositivos */}
        <div className="live-setfield">
          <label id="live-mic-label">Dispositivo de Entrada (Microfone)</label>
          <Select
            value={prefs.audioInputId ?? "default"}
            onValueChange={v => void updatePref({ audioInputId: v === "default" ? undefined : v })}
          >
            <SelectTrigger aria-labelledby="live-mic-label" className="live-setselect">
              <SelectValue placeholder="Microfone Padrão" />
            </SelectTrigger>
            <SelectContent className="live-setselect-pop">
              <SelectItem value="default">Microfone Padrão</SelectItem>
              {audioInputs.filter(d => d.deviceId !== "default").map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone (${d.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="live-setfield">
          <label id="live-out-label">Dispositivo de saída</label>
          <Select
            disabled={!supportsOutputSelection}
            value={prefs.audioOutputId ?? "default"}
            onValueChange={v => void updatePref({ audioOutputId: v === "default" ? undefined : v })}
          >
            <SelectTrigger aria-labelledby="live-out-label" className="live-setselect">
              <SelectValue placeholder="Saída padrão" />
            </SelectTrigger>
            <SelectContent className="live-setselect-pop">
              <SelectItem value="default">Saída padrão</SelectItem>
              {audioOutputs.filter(d => d.deviceId !== "default").map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Saída (${d.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!supportsOutputSelection && (
            <p className="live-sethint">
              Este navegador usa a saída definida pelo sistema operacional.
            </p>
          )}
        </div>

        <div className="live-setfield">
          <label id="live-cam-label">Câmera</label>
          <Select
            value={prefs.videoInputId ?? "default"}
            onValueChange={v => void updatePref({ videoInputId: v === "default" ? undefined : v })}
          >
            <SelectTrigger aria-labelledby="live-cam-label" className="live-setselect">
              <SelectValue placeholder="Câmera Padrão" />
            </SelectTrigger>
            <SelectContent className="live-setselect-pop">
              <SelectItem value="default">Câmera Padrão</SelectItem>
              {videoInputs.filter(d => d.deviceId !== "default").map(d => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label || `Câmera (${d.deviceId.slice(0, 6)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Teste de microfone */}
        <section className="live-setcard" aria-label="Teste de microfone">
          <p className="live-setcard__title">Teste de Microfone</p>
          <div className="live-meter" role="img" aria-label={`Nível do microfone: ${level}%`}>
            <div
              className={`live-meter__fill ${level > 12 ? "live-meter__fill--voice" : ""}`}
              style={{ width: `${level}%` }}
            />
          </div>
          <div className="live-setrow">
            <button
              type="button"
              className="live-setbtn"
              onClick={() => void (testing ? stopTest() : startTest())}
            >
              <Mic size={14} aria-hidden />
              {testing ? "Parar teste" : "Testar microfone"}
            </button>
            <button
              type="button"
              className="live-setbtn"
              disabled={recording}
              onClick={() => void recordSample()}
            >
              {recording ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />}
              {recording ? "Gravando 4 s" : "Gravar amostra"}
            </button>
          </div>
          {recordingUrl && (
            <audio src={recordingUrl} controls className="live-setaudio" aria-label="Reproduzir amostra do microfone" />
          )}
        </section>

        {/* Sensibilidade */}
        <section className="live-setcard">
          <div className="live-setline">
            <div>
              <p className="live-setcard__title">Sensibilidade automática</p>
              <p className="live-setcard__desc">
                Adapta o indicador ao ruído do ambiente.
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
            <div className="live-setsens">
              <div className="live-setsens__labels">
                <span>Mais seletivo</span>
                <span>Mais sensível</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[prefs.inputSensitivity ?? DEFAULT_DEVICE_PREFS.inputSensitivity]}
                onValueChange={([value]) => {
                  setPrefs(current => ({ ...current, inputSensitivity: value }));
                  setDevicePrefs({ inputSensitivity: value });
                }}
                aria-label="Sensibilidade do microfone"
              />
            </div>
          )}
        </section>

        {/* Push-to-talk */}
        <section className="live-setcard" aria-label="Push-to-talk">
          <div className="live-setcard__head">
            <span className="live-setcard__icon" aria-hidden>
              <Keyboard size={16} />
            </span>
            <div>
              <p className="live-setcard__title">Push-to-talk</p>
              <p className="live-setcard__desc">
                Pressione e segure a combinação para falar; ao soltar, o
                microfone volta ao silêncio.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={`live-setkey ${recordingKey ? "live-setkey--listening" : ""}`}
            onClick={() => setRecordingKey(true)}
          >
            {recordingKey ? "Pressione a combinação…" : prefs.pushToTalkKeybind ?? "Não configurado"}
          </button>
        </section>

        {/* Qualidade do compartilhamento */}
        <section className="live-setcard" aria-label="Qualidade do compartilhamento">
          <div className="live-setcard__head">
            <span className="live-setcard__icon" aria-hidden>
              <Monitor size={16} />
            </span>
            <div>
              <p className="live-setcard__title">Qualidade do compartilhamento</p>
              <p className="live-setcard__desc">
                Escolha uma resolução compatível com sua banda disponível.
              </p>
            </div>
          </div>
          <div className="live-setmodes" role="radiogroup" aria-label="Qualidade do compartilhamento">
            {QUALITIES.map(([value, label, description]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={prefs.streamQuality === value}
                onClick={() => void updatePref({ streamQuality: value })}
                className={`live-setmode ${
                  (prefs.streamQuality ?? "720p30") === value ? "live-setmode--on" : ""
                }`}
              >
                <span className="live-setmode__label">{label}</span>
                <span className="live-setmode__desc">{description}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
    </div>
  );
}
