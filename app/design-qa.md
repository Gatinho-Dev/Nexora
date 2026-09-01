# Nexora notification and DM refresh — design QA

## Evidence

- Source visual truth:
  - `/tmp/codex-clipboard-1f3fecb4-dd22-48d1-abd0-409eafabfcb5.png` (Caixa de entrada, 777 × 1040 px)
  - `/tmp/codex-clipboard-634a7fe2-0303-4644-bf4f-bd7f50341717.png` (Nova mensagem, 1910 × 1011 px)
  - `/tmp/codex-clipboard-55f7b7ee-9128-478d-a91a-bb32f77a5bd5.png` (Busca rápida, 1920 × 983 px)
  - `/tmp/codex-clipboard-080e2160-148f-4970-9380-035c830933a2.png` (pop-up liquid glass, 469 × 111 px)
- Browser-rendered implementation:
  - `/tmp/nexora-qa-inbox-desktop.png`
  - `/tmp/nexora-qa-new-message-desktop.png`
  - `/tmp/nexora-qa-search-desktop.png`
  - `/tmp/nexora-qa-popup-desktop.png`
  - `/tmp/nexora-qa-inbox-mobile-v2.png`
- Combined side-by-side comparison: `/tmp/nexora-design-qa-comparison.png`
- Desktop viewport: 1440 × 1000 CSS px; screenshots 1440 × 1000 px; device scale factor 1.
- Mobile viewport: 390 × 844 CSS px; screenshot 390 × 844 px; device scale factor 1.
- State: authenticated dark-theme DM with unread messages, ended-call timeline event, inbox notifications, two pending friend requests, unified new-message selection, filtered quick switcher, and realtime popup.

## Full-view comparison

The implementation preserves Nexora's established dark surfaces and cobalt brand token while matching the reference hierarchy: compact DM search bar, centered selection/search dialogs, inbox title and two-tab structure, scroll-contained activity list, actionable request controls, and a translucent top notification. Desktop controls remain visible within the viewport and the mobile inbox becomes a full-height bottom sheet without horizontal page overflow.

## Focused-region comparison

Focused crops were required because the important controls are small. The combined board compares the inbox header/tabs/cards, friend selection rows and footer action, quick-search input/results/footer hints, and glass popup surface. Lucide icons remain optically consistent with the existing Nexora icon set. Dynamic avatars use real account data; no missing illustrative or raster asset was replaced by CSS art.

## Required fidelity surfaces

- Fonts and typography: the existing Nexora `gg sans`/`Noto Sans` stack, compact 10–16 px scale, weights, truncation, and line heights remain consistent. Dialog and inbox hierarchy is legible at both viewports.
- Spacing and layout rhythm: 8–16 px spacing, 8–22 px radii, contained scroll regions, and stable footer/header controls match the dense reference rhythm. No persistent control is clipped after the mobile header correction.
- Colors and visual tokens: established `--panel`, `--chat-bg`, `--primary`, presence, border, and text-tier tokens are used. Only the popup uses translucent blur/saturation as requested.
- Image quality and asset fidelity: provided/reference avatars are runtime data. UI icons come from the existing Lucide library. No placeholder illustration, custom SVG, gradient, or CSS-drawn replacement was added.
- Copy and content: Portuguese labels are coherent and task-specific: “Caixa de entrada”, “Não lidas”, “Menções”, “Nova mensagem”, “Criar mensagem”, “Aonde você gostaria de ir?” and private-nickname guidance.

## Findings and iteration history

- [P2, fixed] Mobile inbox header actions overlapped.
  - Earlier evidence: `/tmp/nexora-qa-inbox-mobile.png` showed the close button covering the compact mark-all-read control.
  - Fix: reserved right-side header space when `compact` is enabled in `InboxContent`.
  - Post-fix evidence: `/tmp/nexora-qa-inbox-mobile-v2.png` shows separate mark-read and close buttons with usable tap targets.
- No remaining P0, P1, or P2 visual findings.
- [P3] The reference inbox can display fully expanded rich message bodies; Nexora intentionally uses compact notification summaries so mixed DM, mention, system, and request activity stays scannable.

## Primary interactions tested

- Open/close desktop inbox; switch between Não lidas and Menções.
- See and act on pending friendship cards.
- Open unified Nova mensagem; one selection enables a DM, multiple selections expose the optional group name while keeping one “Criar mensagem” action.
- Open the sidebar search; filter conversations with `@`.
- Receive and dismiss a realtime in-app liquid-glass popup.
- Open the DM context menu; save a private nickname and verify it in the sidebar/header.
- Open/close the mobile inbox and unified new-message dialog at 390 × 844.
- Verified the rendered call-history row and enlarged presence indicators.
- Browser console checked on a fresh authenticated route: 0 errors and 0 warnings.

## Implementation checklist

- [x] Desktop and mobile inbox remain scroll-contained.
- [x] Core controls are keyboard/role labelled and have visible focus behavior.
- [x] Reference states are represented with real local QA data.
- [x] P2 mobile header overlap was fixed and recaptured.

final result: passed
