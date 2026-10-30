import { useMemo, useState } from "react";
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  Terminal,
} from "lucide-react";
import type { CliRelease, CliReleaseAsset } from "@contracts/cliReleases";
import {
  formatAssetName,
  formatBytes,
  getRecommendedAsset,
  groupCliAssets,
  platformNames,
} from "@/services/cli/downloads";
import type { DetectedPlatform } from "@/services/cli/platform";

type CliInstallSectionProps = {
  release: CliRelease | null;
  detected: DetectedPlatform;
};

type InstallStep = {
  title: string;
  body: string;
  command?: string;
};

function stepsForAsset(asset: CliReleaseAsset): InstallStep[] {
  if (asset.platform === "linux" && asset.format === "deb") {
    return [
      {
        title: "Baixe o pacote",
        body: "Escolha o pacote .deb para a sua arquitetura.",
      },
      {
        title: "Instale pelo terminal",
        body: "Execute o comando na pasta onde o arquivo foi salvo.",
        command: `sudo apt install ./${asset.name}`,
      },
      {
        title: "Abra o Nexora",
        body: "Inicie o cliente quando terminar.",
        command: "nexora",
      },
    ];
  }
  if (asset.platform === "macos" && asset.format === "tar.gz") {
    return [
      { title: "Baixe o pacote", body: "Escolha o build do seu Mac." },
      {
        title: "Extraia o executável",
        body: "Abra um terminal na pasta do arquivo baixado.",
        command: `tar -xzf ${asset.name}`,
      },
      {
        title: "Execute o cliente",
        body: "Libere a execução e abra o Nexora CLI.",
        command: "chmod +x nexora && ./nexora",
      },
    ];
  }
  if (asset.platform === "windows") {
    return [
      {
        title: "Baixe o executável",
        body: "Salve o arquivo .exe em uma pasta do Windows.",
      },
      {
        title: "Abra o Nexora CLI",
        body: "Execute o arquivo baixado para iniciar o cliente.",
      },
      {
        title: "Entre na sua conta",
        body: "O navegador será aberto para autorizar o acesso.",
      },
    ];
  }
  if (asset.platform === "linux" && asset.format === "tar.gz") {
    return [
      {
        title: "Baixe o pacote",
        body: "Escolha o tarball para a sua arquitetura.",
      },
      {
        title: "Extraia o executável",
        body: "Abra um terminal na pasta do arquivo baixado.",
        command: `tar -xzf ${asset.name}`,
      },
      {
        title: "Execute o cliente",
        body: "Inicie o binário extraído.",
        command: "./nexora",
      },
    ];
  }
  return [
    {
      title: "Baixe o artefato",
      body: "Salve o arquivo oficial escolhido acima.",
    },
    {
      title: "Siga as instruções do sistema",
      body: "O formato selecionado determina os próximos passos.",
    },
    {
      title: "Execute o Nexora",
      body: "Inicie o cliente e conclua o login no navegador.",
      command: "nexora",
    },
  ];
}

export function CliInstallSection({
  release,
  detected,
}: CliInstallSectionProps) {
  const assets = useMemo(() => release?.assets ?? [], [release]);
  const groups = useMemo(() => groupCliAssets(assets), [assets]);
  const recommended = getRecommendedAsset(release, detected);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedAsset =
    assets.find(asset => asset.id === selectedId) ??
    recommended ??
    groups[0]?.assets[0] ??
    null;
  const steps = selectedAsset ? stepsForAsset(selectedAsset) : [];

  return (
    <section
      className="nexora-cli-section nexora-cli-install-section"
      id="instalacao"
    >
      <div className="nexora-cli-section-heading">
        <h2>Como instalar?</h2>
        <p>
          Baixe o artefato real da release estável. O comando abaixo usa o nome
          e a versão publicados no GitHub.
        </p>
      </div>

      {!selectedAsset ? (
        <div className="nexora-cli-install-empty">
          <FileArchive size={20} aria-hidden="true" />
          <strong>Nenhum instalador disponível.</strong>
          <span>
            Consulte as versões oficiais no GitHub para ver os arquivos
            publicados.
          </span>
        </div>
      ) : (
        <div className="nexora-cli-install-layout">
          <div
            className="nexora-cli-install-assets"
            role="tablist"
            aria-label="Plataformas disponíveis"
          >
            {groups.map(group => (
              <div className="nexora-cli-install-platform" key={group.platform}>
                <div className="nexora-cli-install-platform-title">
                  <span>{platformNames[group.platform]}</span>
                  {recommended?.platform === group.platform && (
                    <span className="nexora-cli-install-recommended">
                      <Check size={12} aria-hidden="true" /> recomendado
                    </span>
                  )}
                </div>
                {group.assets.map(asset => (
                  <button
                    className={`nexora-cli-install-asset${selectedAsset.id === asset.id ? " is-selected" : ""}`}
                    key={asset.id}
                    type="button"
                    role="tab"
                    aria-selected={selectedAsset.id === asset.id}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <span>
                      <strong>{formatAssetName(asset)}</strong>
                      <small>{formatBytes(asset.size)}</small>
                    </span>
                    <span className="nexora-cli-install-asset-check">
                      {selectedAsset.id === asset.id ? (
                        <Check size={15} />
                      ) : (
                        <Download size={15} />
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="nexora-cli-install-guide">
            <div className="nexora-cli-install-selected">
              <div>
                <span>Arquivo selecionado</span>
                <strong>{selectedAsset.name}</strong>
              </div>
              <a
                href={selectedAsset.downloadUrl}
                download
                aria-label={`Baixar ${selectedAsset.name}`}
              >
                <Download size={16} aria-hidden="true" />
                Baixar arquivo
              </a>
            </div>
            <ol className="nexora-cli-install-steps">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="nexora-cli-install-step-number">
                    {index + 1}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.body}</p>
                    {step.command && (
                      <code>
                        <Terminal size={14} aria-hidden="true" />
                        {step.command}
                      </code>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <div className="nexora-cli-install-note">
              <FolderOpen size={16} aria-hidden="true" />
              <span>
                Os arquivos são obtidos diretamente das GitHub Releases
                oficiais.
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
