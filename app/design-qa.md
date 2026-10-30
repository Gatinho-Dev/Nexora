# Nexora profiles and Rich Presence — design QA

## Evidence

- Source visual truth:
  - `/tmp/codex-clipboard-915e3789-5077-4418-8c1d-0e60bd881bc0.png` (expanded profile/activity)
  - `/tmp/codex-clipboard-122d0bdc-cebc-438d-87f2-dddfe3277841.png` (personal profile card)
  - `/tmp/codex-clipboard-073e21dc-dc14-4c47-874d-84b24c4d933c.png` (three-column profile editor)
  - `/tmp/codex-clipboard-6a191a80-0f3b-40ec-aa89-887b7c135841.png` (display-name styling)
- Browser-rendered implementation:
  - `artifacts/profile-qa/profile-activity-desktop.png`
  - `artifacts/profile-qa/editor-desktop.png`
  - `artifacts/profile-qa/editor-mobile.png`
  - `artifacts/profile-qa/friends-dm-activity-desktop.png`
- Side-by-side reference/implementation board:
  - `artifacts/profile-qa/comparison.png`
- Desktop viewport: 1600 × 1000 CSS px.
- Mobile viewport: 390 × 844 CSS px.
- State: authenticated local QA profiles with themed identity, public games, favorite game, wishlist, connections and two normalized activities.

## Full-view comparison

The implementation follows the reference hierarchy: themed profile identity on the left, mural/activity/wishlist tabs on the right, a large three-column profile studio, a compact personal profile card and a dedicated display-name styling area. Nexora's cobalt/dark brand remains intact while each profile theme changes the banner, identity surface, accent and content canvas.

The editor becomes a single scrollable column on narrow screens. Controls stay within the 390 px viewport, the save and close actions do not overlap, and the mobile settings header is not duplicated.

## Focused-region comparison

- Display names support six font treatments and solid, gradient, neon, outline, pop and prism effects with two colors.
- Avatar decoration, banner, theme, accent, custom status and profile effect all update the live preview.
- Profile widgets include game collection, favorite game, connections and activity. Wishlist has its own tab.
- The expanded profile renders up to two Rich Presence cards and keeps public connections separate from activity privacy.
- Friend rows and direct-message rows use one compact primary activity loaded through a batched privacy-aware summary.
- The personal card mirrors the compact reference with themed banner, decorated avatar, styled name, biography, games, badges, presence menu, settings and copy-ID action.

## Findings and iteration history

- [P1, fixed] Expanded profile inherited the dialog component's `sm:max-w-lg`, compressing the two-column layout. Added an explicit 1080 px responsive max width.
- [P1, fixed] The settings close control overlapped the profile studio's Save action. The studio now owns separate Save and Close buttons while the shell close control is hidden on that tab.
- [P2, fixed] Mobile profile settings showed two back headers. The shell-level mobile header is hidden while the profile studio is active.
- [P2, fixed] The personal profile popover still used the legacy card. It now renders profile themes, styled names, decorations, custom status, games and a collapsible presence selector.
- No remaining P0, P1 or P2 visual findings.
- [P3] Game cards without user-supplied artwork intentionally show a neutral game icon instead of invented cover art.

## Primary interactions tested

- Open/close personal profile card and expanded friend profile.
- Open profile editor from the personal card.
- Select the Neon display-name effect, save it and verify database persistence.
- Switch expanded profile tabs between Mural, Atividade and Lista de desejos.
- Render Spotify and Twitch simultaneously, including Spotify progress and live Twitch state.
- Verify the primary Twitch activity in both the friends list and the existing DM with a private nickname.
- Open Connections and verify all five providers render; unconfigured providers are disabled instead of starting a broken OAuth flow.
- Open profile editor at 1600 × 1000 and 390 × 844.
- Browser console checked during the profile/editor flow: 0 errors and 0 warnings.

## Implementation checklist

- [x] Desktop profile and editor match the requested information architecture.
- [x] Compact personal profile card includes the requested identity and account actions.
- [x] Name styling, theme, decoration, effects, games, favorite and wishlist persist through the profile API.
- [x] Rich Presence is limited to two visible activities and respects visibility controls.
- [x] Friends and DMs receive compact summaries without per-row API queries.
- [x] Desktop and mobile controls remain usable without horizontal overflow.
- [x] Evidence was captured from the browser-rendered app.

final result: passed
