import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import { initTheme } from "@/lib/theme";
import { TRPCProvider } from "@/providers/trpc";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import App from "./App.tsx";

try {
  initTheme();
} catch (e) {
  console.error("Failed to initialize theme:", e);
}

try {
  const root = createRoot(document.getElementById("root")!);
  root.render(
    <StrictMode>
      <BrowserRouter>
        <TRPCProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </TRPCProvider>
      </BrowserRouter>
    </StrictMode>
  );
} catch (e) {
  console.error("Failed to render app:", e);
  document.getElementById("root")!.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#313338;color:white;font-family:system-ui;padding:20px;text-align:center;">
      <div>
        <img src="/icon.svg" alt="Nexora" width="56" height="56" style="width:56px;height:56px;margin:0 auto 16px;" />
        <h1 style="font-size:1.5rem;font-weight:bold;margin-bottom:8px;">Erro ao carregar a aplicação</h1>
        <p style="color:#B5BAC1;margin-bottom:16px;">${e instanceof Error ? e.message : "Erro desconhecido"}</p>
        <button onclick="window.location.reload()" style="padding:12px 24px;background:#5865F2;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Recarregar</button>
      </div>
    </div>
  `;
}
