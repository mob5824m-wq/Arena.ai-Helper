# Arena.ai Helper (v2.3)

A Chrome extension (Manifest V3) that turns [Arena.ai](https://arena.ai) Agent Mode into a hands-free, queueable assistant driver — with a built-in safety stop for captchas/rate-limit challenges.

## Logo
Indigo rounded-square icon with a white down-arrow (auto-scroll metaphor), shipped at 16/32/48/128px for toolbar, Chrome Web Store, and notifications.

## Features

**Safety**
- **Captcha / challenge auto-pause** — detects Cloudflare Turnstile/interstitials, reCAPTCHA/hCaptcha/Arkose, "verify you are human", "just a moment", "too many requests / rate limit", captcha iframes and captcha-styled inputs. When triggered:
  - Auto-send and auto-continue are immediately disabled **in memory only** (your stored prefs are preserved).
  - The queue and any queued text are held; nothing is sent while the challenge is up.
  - A prominent fixed banner appears with a "Resume now" button, and a desktop notification fires so you know to solve it.
  - After the captcha disappears for ≥2 seconds, automation resumes automatically.

**Core**
- **Auto-scroll to bottom** — prefers clicking Arena's native `aria-label="Scroll to bottom"` button when visible; otherwise falls back to its own scroll-container logic. Pauses only after a real manual scroll away from the latest message, so newly appearing native controls do not block automation.
- **Auto-send** — submits text in the compose box as soon as the assistant finishes, keyed off `button[data-perf-target="send"]` and `aria-label="Send message"` (the exact Arena markup).
- **Multi-prompt queue** — prompts separated by a configurable delimiter (default `---`) are sent one-by-one as each response finishes. The popup includes a live queue editor for reordering, editing, and removing pending work.
- **Send delay / rate control** — choose the idle-to-send delay (0–30 seconds) for controlled hands-free runs.
- **Auto-continue** — clicks "Continue generating" / "Read more" buttons, with a configurable per-response safety cap (including zero to disable clicks).
- **Configurable guardrails** — set a maximum pending-queue length (1–50). When a pasted queue exceeds it, automation does not send or discard the composer; you can edit it safely first.
- **Stop-after-this-response** (`Alt+Shift+X`).

**Feedback**
- Desktop notification + chime when a chain finishes; distinct notification when a captcha is hit.

**Input & UI ergonomics**
- **Quick Prompts** ✦ — one-click preset prompts grouped by **General / Code / Writing / Agent**. Each prompt can be configured to auto-send or just insert (⏎ indicator). Ships with 24 useful defaults (Continue, TL;DR, Fix bugs, Code review, Write tests, Refactor, Formalize, Proofread, Next step, Commands, Verify mods, Status, Mark done, …).
- **Slash commands** — type `/continue`, `/tldr`, `/fixcode`, etc. and press `Tab` to insert. Custom prompts you add get their own slash id.
- **Prompt template variables** — quick prompts can insert `{date}`, `{time}`, `{selectedText}`, and `{clipboard}` at send time.
- Auto-focus input after responses, char/token counter, floating status pill (with clickable ■ Stop / ✕ Clear buttons), copy-code buttons, optional timestamps, close-protection.
- **Live popup status** — see generating/idle/captcha state, queue count, safety notices, and recent activity for the active tab.
- **Settings controls** — choose dark, light, or system popup appearance; optionally scope feature settings to the current Arena conversation; import/export settings and prompt templates as JSON.
- **Activity history** — a recent, local-only log of sent prompts, response state, queue actions, guardrails, and captcha pauses.
- Three one-click profiles: **Hands-free**, **Chat**, **Off**.
- Export conversation to Markdown.

**Keyboard shortcuts** (configurable at `chrome://extensions/shortcuts`): `Alt+Shift+S` toggle auto-send · `Alt+Shift+A` toggle auto-scroll · `Alt+Shift+C` clear input · `Alt+Shift+X` stop after this.

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

Feature modules under `features/`: `scroll.js`, `send.js`, `queue.js`, `continue.js`, `notifications.js`, `autofocus.js`, `export.js`, `copycode.js`, `timestamps.js`, `closeprotect.js`, `quickprompts.js`, `floatingstatus.js`, and `history.js`. Each exposes an `attach()` function called by `content.js`.

## Notes & caveats

- Arena's DOM can change; selectors are intentionally heuristic (looking for overflow scroll containers, visible textareas/contenteditables, and buttons whose labels/accessible names contain "send" / "continue" / "stop") rather than hard-coded class names. If the send button isn't found, the extension falls back to dispatching an `Enter` key event on the input.
- Host permissions include `arena.ai`, `*.arena.ai`, and `*.e2b.app`/`*.e2b.dev` so the helper also works inside Arena-hosted preview sandboxes.
- Auto-send has a per-attempt cooldown and debounces typing to avoid firing while you're still composing.
- Auto-continue is capped at 3 clicks per response by default (configurable via the `autoContinueMaxClicks` setting, exposed in code) to prevent infinite loops if a UI element is misidentified.
- Conversation export uses a best-effort role detector (looks at `data-role`, class names, presence of code blocks, and falls back to alternating user/assistant). For critical records, double-check the resulting Markdown.
- Auto-scroll prefers clicking Arena's native **"Scroll to bottom"** floating button (`aria-label="Scroll to bottom"`) when it's visible — that uses Arena's own scroll target and is the smoothest behavior. The manual scroll fallback only kicks in when that button isn't on screen.

## Releases (GitHub zip)

Every merge to `main` triggers `.github/workflows/release.yml`, which:

1. Reads the semantic version from `manifest.json`.
2. Adds the GitHub Actions run number to create a unique release version such as `2.3.0-build.42`.
3. Zips the extension files (excluding `.git`, `.github`, `dist`, `node_modules`, and OS metadata) into `arena-ai-helper-<release-version>.zip`.
4. Creates a GitHub Release and matching `v<release-version>` tag pointing at that merge commit.

The workflow runs on `ubuntu-latest` and uses [`softprops/action-gh-release@v2`](https://github.com/softprops/action-gh-release) to publish. Users can download the zip directly from the Releases page, unzip it, and Load unpacked — no need to clone the repo.

You can also run the workflow manually from the **Actions** tab via **Run workflow**. Bump `manifest.json` when the user-facing semantic version changes; otherwise each merge still receives its own build-numbered release.
