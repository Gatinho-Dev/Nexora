# Nexora Desktop

Cliente Electron independente para a plataforma Nexora. A interface React é empacotada localmente; o processo principal se comunica com a API tRPC e o WebSocket oficiais em `https://nexorachat.cloud` e nunca acessa o TiDB diretamente. Não é uma janela que carrega o site remoto.

## Estado atual — ainda não pronto para publicação

Esta é uma implementação parcial, **não um produto completo**. O código integra os contratos existentes `account.login` (incluindo TOTP), `auth.me`, `auth.logout`, `server.list`, `server.get`, `dm.list`, `message.list`, `message.send`, `message.edit`, `message.delete`, `message.addReaction`, `message.removeReaction`, `message.markRead` e `/ws`. Possui navegação de servidores e canais textuais, mensagens diretas, histórico paginado, respostas, reações, edição/exclusão das próprias mensagens, indicadores de digitação, reconexão e busca local de conversas/servidores. Há configurações locais para notificações de DMs e menções e para minimizar à bandeja; as notificações são desativadas por padrão, não exibem conteúdo e verificam o status e preferências de silenciamento. A recuperação de senha e o cadastro abrem o site oficial no navegador. A busca não é global na API.

Chamadas de voz em canais de voz/palco e em DMs usam WebRTC ponto a ponto (áudio, mudo e saída), com sinalização pelo WebSocket oficial via processo principal e ICE de `/api/rtc-config`. Não foram verificadas com conta real nesta máquina. **Ainda faltam**, entre outros: vídeo, captura de tela e portal Linux; fóruns e eventos; download de anexos (os envios usam `POST /api/upload` pelo processo principal, com limite de 8 MB e até 10 anexos por mensagem, mas ainda não foram testados com conta real e os anexos recebidos aparecem apenas como nomes); menções assistidas, escolha livre de emoji e pré-visualizações; notificações para convites, chamadas e demais eventos; menu completo da bandeja; configurações de conta, aparência, voz e vídeo; virtualização; descoberta; atualizações automáticas assinadas; publicação de releases e testes completos. Não há implementação alternativa de chamadas nem dados fictícios. Não publicar esta versão como produto final.

A sessão é salva somente quando `safeStorage` encontra um armazenamento criptográfico seguro; no Linux, o backend `basic_text` é recusado e a sessão fica apenas na memória. Não armazene senhas ou segredos no projeto.

## Requisitos e desenvolvimento

Node.js 22 ou superior, npm e um ambiente gráfico Linux com as dependências do Electron (bibliotecas GTK/Chromium). Para persistência segura no Linux, configure um chaveiro Secret Service ou KWallet. O backend é o oficial; não há nenhuma configuração de banco no cliente.

```sh
cd nexora-desktop
npm ci
npm run dev
```

`npm run dev` inicia o Vite em loopback e o Electron. O renderer não possui Node.js, usa isolamento de contexto, sandbox, CSP e um preload com operações explícitas; a API é chamada pelo processo principal. Login e mensagens requerem uma conta real e disponibilidade dos serviços oficiais. Não passe `--no-sandbox`.

## Build e testes

```sh
npm run build
npx tsc -p tsconfig.json
npm test
npm run package:linux
```

O último comando tenta produzir `.deb`, `.rpm` e `.AppImage` em `release/`. As ferramentas/arquitetura necessárias dependem do sistema de build. Os pacotes gerados são experimentais e não comprovam funcionamento nas distribuições nem em X11/Wayland. Flatpak não está configurado.

## Publicação e atualização

Ainda não existe fluxo de publicação ou atualização automática seguro. Releases oficiais do repositório são em <https://github.com/Gatinho-Dev/Nexora/releases>. Antes de publicar o Desktop, criar um pipeline próprio que não colida com as releases do CLI, gerar e proteger chaves de assinatura, configurar e testar verificação de manifesto e artefatos em cada plataforma. Checksums isolados não autenticam um release. Não configurar download automático até que uma âncora de confiança tenha sido distribuída e validada.

## Solução de problemas

- **Não mantém a sessão:** confira se Secret Service/KWallet está ativo; se não estiver, o cliente deliberadamente não grava o token.
- **Falha de rede/login:** confira acesso a `nexorachat.cloud`, credenciais e segundo fator. Nenhuma senha é gravada.
- **Voz:** exige permissão de microfone e conectividade com os servidores ICE; sem TURN, algumas redes NAT não conectam. **Tela/vídeo:** ainda não implementados. Em Wayland será necessário testar PipeWire, xdg-desktop-portal e o backend do compositor em uma sessão gráfica real.
- **Empacotamento:** verifique ferramentas e dependências da distribuição e a saída do electron-builder. O ambiente de CI precisa validar os três formatos instalados.

## Segurança e pendências de verificação

A janela usa `contextIsolation`, `sandbox` e `nodeIntegration: false`; navegação externa é bloqueada e os handlers IPC validam remetente e argumentos. Testes locais cobrem as regras de validação e a reconciliação das mensagens durante carregamento e reconexão. As dependências de desenvolvimento apresentaram alertas moderados na auditoria inicial; reveja `npm audit` antes de distribuir. A implementação ainda precisa de testes de autenticação real, mensagens, WS, notificações, navegação, empacotamento, revisão de segurança e testes em Linux gráfico, Wayland e X11. A validação de segurança atual não substitui auditoria independente.
