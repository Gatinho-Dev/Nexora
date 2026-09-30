/**
 * Adicionar a uma playlist (local).
 *
 * O desktop abria um modal com as playlists e um campo para criar uma nova; a
 * versão web faz o mesmo, com a verdade na frente: as playlists são deste
 * navegador, não de uma conta sincronizada.
 */

import { useState } from "react";
import { ListPlus, Plus } from "lucide-react";

import type { CiderTrack } from "../api/query";
import { useCiderLibrary } from "../library";
import { ciderToast } from "../ui";
import { Button, Field, Modal } from "./primitives";

export function AddToPlaylistButton({
  tracks,
  size = "sm",
  label = "Adicionar à playlist",
}: {
  tracks: CiderTrack[];
  size?: "sm" | "lg";
  label?: string;
}) {
  const playlists = useCiderLibrary((state) => state.playlists);
  const addToPlaylist = useCiderLibrary((state) => state.addToPlaylist);
  const createPlaylist = useCiderLibrary((state) => state.createPlaylist);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const add = (id: string, playlistName: string) => {
    const added = addToPlaylist(id, tracks);
    ciderToast(
      added > 0 ? "success" : "info",
      added > 0 ? `${added} faixa(s) adicionada(s)` : "Nada novo para adicionar",
      `Playlist “${playlistName}”${added === 0 ? ": as faixas já estavam lá." : "."}`,
    );
    setOpen(false);
  };

  return (
    <>
      <Button
        size={size}
        icon={<ListPlus size={15} />}
        disabled={tracks.length === 0}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      <Modal
        open={open}
        title="Adicionar à playlist"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon={<Plus size={15} />}
              disabled={!name.trim()}
              onClick={() => {
                const playlist = createPlaylist(name.trim());
                setName("");
                add(playlist.id, playlist.name);
              }}
            >
              Criar e adicionar
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Nova playlist" hint="A playlist fica neste navegador, no armazenamento local.">
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Viagem"
            />
          </Field>

          {playlists.length > 0 ? (
            <div className="stack tight">
              <span className="xsmall faint uppercase">Playlists existentes</span>
              {playlists.map((playlist) => (
                <button
                  key={playlist.id}
                  type="button"
                  className="option-card"
                  onClick={() => add(playlist.id, playlist.name)}
                >
                  <strong>{playlist.name}</strong>
                  <span>{playlist.tracks.length} faixa(s)</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="small muted">Nenhuma playlist ainda — dê um nome acima para criar a primeira.</p>
          )}
        </div>
      </Modal>
    </>
  );
}
