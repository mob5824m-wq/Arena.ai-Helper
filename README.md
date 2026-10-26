# Arena.ai Helper (v2)

A Chrome extension (Manifest V3) that turns [Arena.ai](https://arena.ai) Agent Mode into a hands-free, queueable assistant driver.

## Features

**Core**
- **Auto-scroll to bottom** — keeps the latest streamed token in view; pauses when you scroll up to read earlier messages and resumes when you scroll back to the bottom.
- **Auto-send** — submits the prompt in the compose box as soon as the assistant finishes. Includes a small delay and a cooldown to prevent accidental double-sends mid-typing.
- **Multi-prompt queue** — separate prompts with a configurable delimiter (default `---` on a line by itself) and the extension sends them one-by-one, waiting for each response to finish.
- **Auto-continue** — automatically clicks "Continue generating" / "Read more" buttons when a response is cut off (capped per-response for safety).
- **Stop-after-this-response** (`Alt+Shift+X`) — arms a one-shot flag: finish the current response, then don't send anything queued after it.

**Feedback**
- **Desktop notification** when a chain finishes (or when "stop after this" halts).
- **Subtle chime sound** when the chain finishes (toggleable).

**Input & UI ergonomics**
- **Auto-focus input** after each response (caret at end of textarea).
- **Char/token counter** in the composer corner (rough `chars / 4` estimate) that turns indigo past 4k chars and red past 12k.
- **Floating status pill** in the page corner showing state: Idle / Generating / Queued:N / Stopping, plus feature flags and clickable ■ Stop / ✕ Clear buttons.
- **Copy-code buttons** on every code block (theme-aware).
- **HH:MM timestamps** on messages (optional, theme-aware).
- **Close-protection** — warns before you close or reload while a response is streaming, there's queued work, or there's unsent text.
- **Quick-paste snippets** — a small ✦ button next to the input opens a theme-aware popover of saved prompts; edit/add in popup. Or type `/name` and press `Tab` in the chat input.
- **Export to Markdown** — one click downloads the current conversation (with fenced code blocks) as a `.md` file.
- **Full dark/light theme awareness** — all injected UI (status pill, copy buttons, timestamps, snippets popover, ✦ button, counter) samples Arena's background color and adapts.
- **Three one-click profiles** in the popup:
  - 🤖 **Hands-free** — all automation on (auto-scroll, auto-send, queue, auto-continue, notifications, focus, close-protect).
  - 💬 **Chat** — auto-scroll + copy-code + focus + close-protect only; you drive each turn.
  - ⭕ **Off** — everything off; vanilla Arena.
- **Arena-native auto-scroll** — when Arena's own "Scroll to bottom" floating button is visible, the helper treats it as the authoritative "user is away from bottom" signal, and clicking it (or returning to the bottom) resumes auto-scroll.

**Keyboard shortcuts** (configurable at `chrome://extensions/shortcuts`)
- `Alt+Shift+S` toggle auto-send
- `Alt+Shift+A` toggle auto-scroll
- `Alt+Shift+C` clear input & queue
- `Alt+Shift+X` stop after this response

All toggles live in the toolbar popup and are synced via `chrome.storage.sync`.

## Install (unpacked)

1. Open Chrome (or any Chromium-based browser: Edge, Brave, Arc, etc.) and navigate to `chrome://extensions`.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked** and select this folder (`Arena.ai-Helper`).
4. Pin the extension for quick access.
5. Open or refresh `https://arena.ai` (or any Arena agent-mode / E2B-hosted preview page).

## Usage tips

- **Queueing prompts**: type several prompts separated by `---` (each on its own line) and press Enter once. The first sends immediately; each subsequent prompt is sent right after the previous response finishes.
  ```
  Summarize the codebase.
  ---
  List the three biggest risks.
  ---
  Suggest a refactor for the worst one.
  ```
- **Walking away**: type the next prompt (or queue several) while the model is answering, then switch tabs; when the chain completes you get a notification + chime.
- **Aborting in flight**: press `Alt+Shift+X` — the model finishes what it's saying, then nothing more is sent.
- **Snippets**: add your own in the popup. Each has a short id (auto-derived from the label) that you can type as `/id` and hit `Tab` to insert.

## File layout

```
manifest.json           MV3 manifest (permissions, commands, content scripts)
background.js           Service worker: routes commands + desktop notifications
content.js              Bootstraps features and runs the responding-state watcher
popup.html / popup.js   Settings popup (all toggles, snippet editor, export)
lib/state.js            Shared settings + runtime state + event bus
lib/ui.js               DOM helpers (find input, find chat, detect "responding", submit, etc.)
features/*.js           One file per feature (see below)
icons/                  Toolbar icons
```

Feature modules under `features/`: `scroll.js`, `send.js`, `queue.js`, `continue.js`, `notifications.js`, `autofocus.js`, `export.js`, `copycode.js`, `timestamps.js`, `closeprotect.js`, `snippets.js`, `floatingstatus.js`. Each exposes an `attach()` function called by `content.js`.

## Notes & caveats

- Arena's DOM can change; selectors are intentionally heuristic (looking for overflow scroll containers, visible textareas/contenteditables, and buttons whose labels/accessible names contain "send" / "continue" / "stop") rather than hard-coded class names. If the send button isn't found, the extension falls back to dispatching an `Enter` key event on the input.
- Host permissions include `arena.ai`, `*.arena.ai`, and `*.e2b.app`/`*.e2b.dev` so the helper also works inside Arena-hosted preview sandboxes.
- Auto-send has a per-attempt cooldown and debounces typing to avoid firing while you're still composing.
- Auto-continue is capped at 3 clicks per response by default (configurable via the `autoContinueMaxClicks` setting, exposed in code) to prevent infinite loops if a UI element is misidentified.
- Conversation export uses a best-effort role detector (looks at `data-role`, class names, presence of code blocks, and falls back to alternating user/assistant). For critical records, double-check the resulting Markdown.
- Auto-scroll prefers clicking Arena's native **"Scroll to bottom"** floating button (`aria-label="Scroll to bottom"`) when it's visible — that uses Arena's own scroll target and is the smoothest behavior. The manual scroll fallback only kicks in when that button isn't on screen.

## Releases (GitHub zip)

Every pushed `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which:

1. Checks out the repo.
2. Zips the extension files (excluding `.git`, `.github`, `dist`, `node_modules`, OS metadata) into `dist/arena-ai-helper-<version>.zip`.
3. Creates a GitHub Release named **Arena.ai Helper vX.Y.Z** with the zip attached as a release asset.

To cut a release:

```bash
# Bump version in manifest.json first, then:
git tag -a v2.0.1 -m "v2.0.1"
git push origin v2.0.1
```

The workflow runs on `ubuntu-latest` and uses [`softprops/action-gh-release@v2`](https://github.com/softprops/action-gh-release) to publish. Users can download the zip directly from the Releases page, unzip it, and Load unpacked — no need to clone the repo.

You can also run the workflow manually from the **Actions** tab via **Run workflow** (it will build a zip for whatever commit you run it on; you'll still want a tag for a proper numbered release).
