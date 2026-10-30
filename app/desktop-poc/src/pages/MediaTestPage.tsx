import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import { X, Mic, Video, Monitor, CheckCircle, AlertCircle, Loader2, Cpu, MemoryStick, Wifi, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestResult {
  name: string;
  status: "passed" | "failed" | "partial" | "not_tested" | "blocked";
  details: string;
  timestamp: string;
  error?: string;
}

interface MediaCapabilities {
  getUserMedia: boolean;
  getDisplayMedia: boolean;
  rtcPeerConnection: boolean;
  audioContext: boolean;
  webAudio: boolean;
  mediaStream: boolean;
}

interface DeviceInfo {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
}

function MediaTestPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<TestResult[]>([]);
  const [capabilities, setCapabilities] = useState<MediaCapabilities>({
    getUserMedia: false,
    getDisplayMedia: false,
    rtcPeerConnection: false,
    audioContext: false,
    webAudio: false,
    mediaStream: false,
  });
  const [devices, setDevices] = useState<DeviceInfo>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
  });
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("");
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [iceCandidates, setIceCandidates] = useState<RTCIceCandidate[]>([]);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [displayServer, setDisplayServer] = useState<string>("Unknown");
  const [webkitVersion, setWebkitVersion] = useState<string>("Unknown");
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [animationFrame, setAnimationFrame] = useState<number | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    detectEnvironment();
    checkCapabilities();
    enumerateDevices();
    return () => {
      stopAllStreams();
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, []);

  const detectEnvironment = () => {
    const ua = navigator.userAgent;
    const webkitMatch = ua.match(/AppleWebKit\/(\d+\.\d+)/);
    if (webkitMatch) {
      setWebkitVersion(`WebKit/${webkitMatch[1]}`);
    }
    if (typeof window !== "undefined" && (window as any).__TAURI__) {
      setDisplayServer("Tauri (Linux)");
    } else if (window.navigator.userAgent.includes("Wayland")) {
      setDisplayServer("Wayland");
    } else if (window.navigator.userAgent.includes("X11")) {
      setDisplayServer("X11");
    } else {
      setDisplayServer(`${navigator.platform} / ${navigator.userAgent.includes("Linux") ? "Linux" : "Unknown"}`);
    }
  };

  const checkCapabilities = () => {
    setCapabilities({
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      getDisplayMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
      rtcPeerConnection: !!window.RTCPeerConnection,
      audioContext: !!window.AudioContext,
      webAudio: !!window.AudioContext,
      mediaStream: !!window.MediaStream,
    });
  };

  const enumerateDevices = async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        audioInputs: allDevices.filter(d => d.kind === "audioinput"),
        videoInputs: allDevices.filter(d => d.kind === "videoinput"),
        audioOutputs: allDevices.filter(d => d.kind === "audiooutput"),
      });
      addResult("Device Enumeration", "passed", `Found ${allDevices.length} devices`);
    } catch (error) {
      addResult("Device Enumeration", "failed", `Error: ${error instanceof Error ? error.message : "Unknown"}`);
    }
  };

  const addResult = (name: string, status: TestResult["status"], details: string, error?: string) => {
    const result: TestResult = {
      name,
      status,
      details,
      timestamp: new Date().toISOString(),
      error,
    };
    setResults(prev => [...prev, result]);
    console.log(`[MediaTest] ${name}: ${status.toUpperCase()} - ${details}`, error ? `- ${error}` : "");
  };

  const updateResult = (name: string, status: TestResult["status"], details: string, error?: string) => {
    setResults(prev => prev.map(r => r.name === name ? { ...r, status, details, error, timestamp: new Date().toISOString() } : r));
  };

  const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
    if (!audioContext) {
      const ctx = new AudioContext();
      setAudioContext(ctx);
    }
    const ctx = audioContext!;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    audioAnalyserRef.current = analyser;
    audioDataArrayRef.current = dataArray;

    const animate = () => {
      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average / 255);
      }
      const frame = requestAnimationFrame(animate);
      setAnimationFrame(frame);
    };
    animate();
  }, [audioContext]);

  const stopAudioLevelMonitoring = () => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    setAnimationFrame(null);
    setAudioLevel(0);
    audioAnalyserRef.current?.disconnect();
    audioAnalyserRef.current = null;
    audioDataArrayRef.current = null;
  };

  const testMicrophone = async () => {
    setIsTesting("microphone");
    updateResult("Microphone Access", "partial", "Requesting permission...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
        video: false,
      });
      const track = stream.getAudioTracks()[0];
      if (track && track.readyState === "live") {
        setLocalStream(stream);
        startAudioLevelMonitoring(stream);
        addResult("Microphone Access", "passed", `Track: ${track.label || "default"} (${track.readyState})`);
      } else {
        stream.getTracks().forEach(t => t.stop());
        addResult("Microphone Access", "failed", "No live audio track received");
      }
    } catch (error) {
      addResult("Microphone Access", "failed", `Error: ${error instanceof Error ? error.message : "Unknown"}`, error instanceof Error ? error.name : undefined);
    }
    setIsTesting(null);
  };

  const testCamera = async () => {
    setIsTesting("camera");
    updateResult("Camera Access", "partial", "Requesting permission...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (track && track.readyState === "live") {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        addResult("Camera Access", "passed", `Track: ${track.label || "default"} (${track.readyState})`);
      } else {
        stream.getTracks().forEach(t => t.stop());
        addResult("Camera Access", "failed", "No live video track received");
      }
    } catch (error) {
      addResult("Camera Access", "failed", `Error: ${error instanceof Error ? error.message : "Unknown"}`, error instanceof Error ? error.name : undefined);
    }
    setIsTesting(null);
  };

  const testScreenShare = async () => {
    setIsTesting("screenShare");
    updateResult("Screen Share", "partial", "Opening picker...");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      if (videoTrack && videoTrack.readyState === "live") {
        setScreenStream(stream);
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream;
        }
        videoTrack.onended = () => {
          addResult("Screen Share", "partial", "Stopped by user/system");
          setScreenStream(null);
        };
        addResult("Screen Share", "passed", `Video: ${videoTrack.label || "default"} ${audioTrack ? `+ Audio: ${audioTrack.label || "default"}` : "(no audio)"}`);
      } else {
        stream.getTracks().forEach(t => t.stop());
        addResult("Screen Share", "failed", "No live screen track received");
      }
    } catch (error) {
      addResult("Screen Share", "failed", `Error: ${error instanceof Error ? error.message : "Unknown"}`, error instanceof Error ? error.name : undefined);
    }
    setIsTesting(null);
  };

  const testWebRTCLoopback = async () => {
    setIsTesting("webrtc");
    updateResult("WebRTC Loopback", "partial", "Creating peer connection...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
      });
      setPeerConnection(pc);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setRemoteStream(event.streams[0]);
        addResult("WebRTC Loopback", "passed", `Remote track received: ${event.track.kind}`);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          setIceCandidates(prev => [...prev, event.candidate!]);
          addResult("ICE Candidate", "passed", `Type: ${event.candidate.type}, Protocol: ${event.candidate.protocol}`);
        }
      };

      pc.onconnectionstatechange = () => {
        setConnectionState(pc.connectionState);
        addResult("Connection State", pc.connectionState === "connected" ? "passed" : "partial", `State: ${pc.connectionState}`);
      };

      pc.oniceconnectionstatechange = () => {
        addResult("ICE Connection State", "passed", `State: ${pc.iceConnectionState}`);
      };

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      addResult("WebRTC Loopback", "passed", "Offer/Answer exchange successful");
    } catch (error) {
      addResult("WebRTC Loopback", "failed", `Error: ${error instanceof Error ? error.message : "Unknown"}`, error instanceof Error ? error.name : undefined);
    }
    setIsTesting(null);
  };

  const stopAllStreams = () => {
    [localStream, remoteStream, screenStream].forEach(stream => {
      stream?.getTracks().forEach(track => track.stop());
    });
    setLocalStream(null);
    setRemoteStream(null);
    setScreenStream(null);
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    peerConnection?.close();
    setPeerConnection(null);
    stopAudioLevelMonitoring();
    setIceCandidates([]);
    setConnectionState("new");
  };

  const clearResults = () => setResults([]);

  const exportResults = () => {
    const data = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      displayServer,
      webkitVersion,
      capabilities,
      devices: {
        audioInputs: devices.audioInputs.map(d => ({ label: d.label, deviceId: d.deviceId })),
        videoInputs: devices.videoInputs.map(d => ({ label: d.label, deviceId: d.deviceId })),
        audioOutputs: devices.audioOutputs.map(d => ({ label: d.label, deviceId: d.deviceId })),
      },
      results,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexora-media-test-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: TestResult["status"]) => {
    switch (status) {
      case "passed": return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed": return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "partial": return <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />;
      case "blocked": return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default: return <span className="w-5 h-5 text-gray-400">⏸</span>;
    }
  };

  const getStatusColor = (status: TestResult["status"]) => {
    switch (status) {
      case "passed": return "bg-green-500/20 border-green-500/30 text-green-400";
      case "failed": return "bg-red-500/20 border-red-500/30 text-red-400";
      case "partial": return "bg-yellow-500/20 border-yellow-500/30 text-yellow-400";
      case "blocked": return "bg-orange-500/20 border-orange-500/30 text-orange-400";
      default: return "bg-gray-500/20 border-gray-500/30 text-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">🧪 Nexora Media Diagnostics</h1>
            <p className="text-muted-foreground mt-1">Test microphone, camera, screen share, and WebRTC on Linux</p>
          </div>
          <div className="flex gap-2">
            <button onClick={clearResults} className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm">Clear Results</button>
            <button onClick={exportResults} className="px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg text-sm text-primary-foreground">Export JSON</button>
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg text-sm">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card border p-4 rounded-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Cpu className="w-4 h-4" /> Environment</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Display Server</dt><dd className="font-mono">{displayServer}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">WebKit</dt><dd className="font-mono">{webkitVersion}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Platform</dt><dd className="font-mono">{navigator.platform}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">User Agent</dt><dd className="font-mono truncate max-w-[200px]">{navigator.userAgent.slice(0, 60)}...</dd></div>
            </dl>
          </div>

          <div className="bg-card border p-4 rounded-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Wifi className="w-4 h-4" /> API Support</h3>
            <dl className="space-y-2 text-sm">
              {Object.entries(capabilities).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}</dt>
                  <dd className={cn("font-mono", value ? "text-green-400" : "text-red-400")}>
                    {value ? "✓ Available" : "✗ Missing"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-card border p-4 rounded-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><MemoryStick className="w-4 h-4" /> Devices</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Audio Inputs</dt><dd className="font-mono">{devices.audioInputs.length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Video Inputs</dt><dd className="font-mono">{devices.videoInputs.length}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Audio Outputs</dt><dd className="font-mono">{devices.audioOutputs.length}</dd></div>
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border p-4 rounded-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Mic className="w-4 h-4" /> Microphone Test</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Audio Input Device</label>
                  <select
                    value={selectedAudioInput}
                    onChange={e => setSelectedAudioInput(e.target.value)}
                    className="w-full px-3 py-2 bg-input border rounded-lg text-sm"
                  >
                    <option value="">Default</option>
                    {devices.audioInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 8)}...`}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={testMicrophone}
                  disabled={isTesting === "microphone" || !capabilities.getUserMedia}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg text-primary-foreground font-medium"
                >
                  {isTesting === "microphone" ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Testing...</span>
                  ) : (
                    "Test Microphone"
                  )}
                </button>
                {localStream && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div
                          className="bg-green-500 h-full transition-all duration-100"
                          style={{ width: `${audioLevel * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono text-green-400 w-12 text-right">
                        {Math.round(audioLevel * 100)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Speak to test microphone input level</p>
                    <button
                      onClick={() => {
                        localStream?.getTracks().forEach(t => t.stop());
                        stopAudioLevelMonitoring();
                        setLocalStream(null);
                      }}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Stop Microphone Test
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card border p-4 rounded-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Video className="w-4 h-4" /> Camera Test</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Video Input Device</label>
                  <select
                    value={selectedVideoInput}
                    onChange={e => setSelectedVideoInput(e.target.value)}
                    className="w-full px-3 py-2 bg-input border rounded-lg text-sm"
                  >
                    <option value="">Default</option>
                    {devices.videoInputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 8)}...`}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={testCamera}
                  disabled={isTesting === "camera" || !capabilities.getUserMedia}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg text-primary-foreground font-medium"
                >
                  {isTesting === "camera" ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Testing...</span>
                  ) : (
                    "Test Camera"
                  )}
                </button>
                {localVideoRef.current && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full aspect-video bg-muted rounded border"
                  />
                )}
              </div>
            </div>

            <div className="bg-card border p-4 rounded-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Monitor className="w-4 h-4" /> Screen Share Test</h3>
              <div className="space-y-3">
                <button
                  onClick={testScreenShare}
                  disabled={isTesting === "screenShare" || !capabilities.getDisplayMedia}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg text-primary-foreground font-medium"
                >
                  {isTesting === "screenShare" ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Opening picker...</span>
                  ) : (
                    "Test Screen Share"
                  )}
                </button>
                {screenStream && (
                  <div className="space-y-2">
                    <video
                      ref={screenVideoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-video bg-muted rounded border"
                    />
                    <p className="text-xs text-muted-foreground">Click "Stop sharing" in system picker or use button below</p>
                    <button
                      onClick={() => {
                        screenStream?.getTracks().forEach(t => t.stop());
                        setScreenStream(null);
                      }}
                      className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 font-medium"
                    >
                      Stop Screen Share
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3 bg-card border p-4 rounded-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2"><Maximize2 className="w-4 h-4" /> WebRTC Loopback Test</h3>
              <div className="space-y-4">
                <button
                  onClick={testWebRTCLoopback}
                  disabled={isTesting === "webrtc" || !capabilities.rtcPeerConnection}
                  className="w-full px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 rounded-lg text-primary-foreground font-medium"
                >
                  {isTesting === "webrtc" ? (
                    <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Testing WebRTC...</span>
                  ) : (
                    "Run WebRTC Loopback Test"
                  )}
                </button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Local Video</h4>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full aspect-video bg-muted rounded border"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Remote Video (Loopback)</h4>
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-video bg-muted rounded border"
                    />
                  </div>
                </div>

                {iceCandidates.length > 0 && (
                  <div className="bg-muted p-3 rounded text-sm">
                    <strong>ICE Candidates:</strong>
                    <ul className="mt-1 space-y-1 font-mono text-xs">
                      {iceCandidates.slice(-5).map((c, i) => (
                        <li key={i}>{c.type} | {c.protocol} | {c.address}:{c.port}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Connection State:</span>
                  <span className={cn("font-mono px-2 py-1 rounded",
                    connectionState === "connected" ? "bg-green-500/20 text-green-400" :
                    connectionState === "connecting" ? "bg-yellow-500/20 text-yellow-400" :
                    connectionState === "failed" || connectionState === "disconnected" || connectionState === "closed" ? "bg-red-500/20 text-red-400" :
                    "bg-gray-500/20 text-gray-400"
                  )}>
                    {connectionState}
                  </span>
                </div>
              </div>
            </div>
          </div>

        <div className="bg-card border p-4 rounded-lg">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Minimize2 className="w-4 h-4" /> Test Results</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {results.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No tests run yet. Click a test button above to start.</p>
            ) : (
              results.map((result, index) => (
                <div key={index} className={cn("flex items-start gap-3 p-3 rounded border", getStatusColor(result.status))}>
                  <div className="flex-shrink-0 mt-0.5">{getStatusIcon(result.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{result.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{new Date(result.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm text-foreground/80 mt-1">{result.details}</p>
                    {result.error && <p className="text-xs text-red-400 mt-1 font-mono">{result.error}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default MediaTestPage;
