/**
 * Aplicativo do Cider dentro da Nexora.
 *
 * Monta a casca (barra lateral, topbar, conteúdo, playbar), as rotas internas de
 * `/cider/*` e os atalhos de teclado. É o equivalente do `App.tsx` do desktop,
 * com uma diferença deliberada: **a navegação é do `react-router`**. Endereço,
 * botão voltar do navegador e link compartilhável fazem parte de ser um site, e
 * a versão desktop não tinha isso porque era uma janela única.
 */

import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router";

import { useTrackCiderPath } from "./history";
import { useCiderSettings } from "./settings/store";
import { useCider } from "./useCider";
import { useCiderUi } from "./ui";
import { CiderSidebar, CiderTopbar, CiderPlaybar, CiderAmbient } from "./components/Shell";
import { CiderSidePanel } from "./components/SidePanel";
import { CiderToasts } from "./components/Toasts";
import { CiderCommandPalette } from "./components/CommandPalette";
import { CiderImmersive } from "./components/Immersive";
import { CiderOnboarding } from "./components/Onboarding";
import { CiderHomePage } from "./pages/HomePage";
import { CiderNowPlayingPage } from "./pages/NowPlayingPage";
import { CiderSearchPage } from "./pages/SearchPage";
import { CiderBrowsePage } from "./pages/BrowsePage";
import { CiderRadioPage } from "./pages/RadioPage";
import { CiderSettingsPage } from "./pages/SettingsPage";
import { CiderDiagnosticsPage } from "./pages/DiagnosticsPage";
import { CiderStatsPage } from "./pages/StatsPage";
import {
  CiderAlbumPage,
  CiderAlbumsPage,
  CiderArtistPage,
  CiderArtistsPage,
  CiderFavoritesPage,
  CiderHistoryPage,
  CiderLibraryPage,
  CiderPlaylistPage,
  CiderPlaylistsPage,
  CiderSongsPage,
} from "./pages/LibraryPages";

export function CiderApp() {
  const location = useLocation();
  const { engine } = useCider();
  const settings = useCiderSettings((store) => store.settings);
  const sidebarOpen = useCiderUi((store) => store.sidebarOpen);

  // O histórico interno alimenta os botões voltar/avançar da topbar.
  useTrackCiderPath(location.pathname);

  // Primeira visita: o guia aparece uma vez, para a escolha do tema acontecer
  // antes de qualquer ajuste manual.
  useEffect(() => {
    if (!settings.onboardingSeen) useCiderUi.getState().setOnboarding(true);
  }, [settings.onboardingSeen]);

  // Atalhos locais — os mesmos caminhos de teclado do desktop onde fazem
  // sentido no navegador.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const ui = useCiderUi.getState();

      // A paleta responde mesmo durante a digitação: é o atalho de fuga.
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        ui.setPalette(true);
        return;
      }
      if (typing) {
        if (event.key === "Escape") target?.blur();
        return;
      }

      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        ui.togglePanel("lyrics");
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "q") {
        event.preventDefault();
        ui.togglePanel("queue");
        return;
      }
      if (event.ctrlKey && event.key === "ArrowRight") {
        event.preventDefault();
        engine.next();
        return;
      }
      if (event.ctrlKey && event.key === "ArrowLeft") {
        event.preventDefault();
        engine.previous();
        return;
      }
      if (event.key === " " || event.key === "Spacebar") {
        // Sem faixa carregada, o espaço não tem o que alternar — e tocar
        // "resume" num player vazio só marcaria bloqueio de autoplay sem razão.
        if (!engine.snapshot().track) return;
        event.preventDefault();
        engine.toggle();
        return;
      }
      if (event.key === "Escape") {
        if (ui.palette) ui.setPalette(false);
        else if (ui.immersive) ui.setImmersive(false);
        else if (ui.panel) ui.setPanel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engine]);

  const sidebarState = !settings.sidebarVisible
    ? "hidden"
    : settings.sidebarCollapsed || !settings.sidebarShowLabels
      ? "collapsed"
      : settings.sidebarPosition === "right"
        ? "right"
        : "normal";

  return (
    <div className="cider-root app">
      <CiderAmbient />
      <div className="app-body" data-sidebar={sidebarState}>
        {sidebarOpen || settings.sidebarVisible ? <CiderSidebar /> : null}
        <div className="main-column">
          <CiderTopbar />
          <main className="content" id="cider-content">
            <Routes>
              <Route index element={<CiderHomePage />} />
              <Route path="explorar" element={<CiderBrowsePage />} />
              <Route path="pesquisa" element={<CiderSearchPage />} />
              <Route path="radio" element={<CiderRadioPage />} />
              <Route path="biblioteca" element={<CiderLibraryPage />} />
              <Route path="albuns" element={<CiderAlbumsPage />} />
              <Route path="albuns/:key" element={<CiderAlbumPage />} />
              <Route path="artistas" element={<CiderArtistsPage />} />
              <Route path="artistas/:key" element={<CiderArtistPage />} />
              <Route path="musicas" element={<CiderSongsPage />} />
              <Route path="playlists" element={<CiderPlaylistsPage />} />
              <Route path="playlists/:id" element={<CiderPlaylistPage />} />
              <Route path="historico" element={<CiderHistoryPage />} />
              <Route path="favoritos" element={<CiderFavoritesPage />} />
              <Route path="tocando-agora" element={<CiderNowPlayingPage />} />
              <Route path="configuracoes" element={<CiderSettingsPage />} />
              <Route path="configuracoes/:section" element={<CiderSettingsPage />} />
              <Route path="diagnostico" element={<CiderDiagnosticsPage />} />
              <Route path="estatisticas" element={<CiderStatsPage />} />
              <Route path="*" element={<CiderHomePage />} />
            </Routes>
          </main>
        </div>
      </div>

      {/*
        * O painel lateral vive **fora** do `app-body` de propósito: assim ele vai
        * até o fim da janela, e não até o topo da playbar. Com a playbar em
        * pílula (flutuante, acima de tudo), a letra ganha a altura toda — é o
        * que faz o painel parecer o do Apple Music em vez de uma caixa que
        * termina no meio da tela.
        */}
      <CiderSidePanel />
      <CiderPlaybar />
      <CiderToasts />
      <CiderCommandPalette />
      <CiderImmersive />
      <CiderOnboarding />
    </div>
  );
}
