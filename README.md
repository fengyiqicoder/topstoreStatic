# TopStore (static build)

A fully static, single-page replica of TopStore that runs entirely in the
browser — no server, no database. Deployable on GitHub Pages or any static
host.

## What's in the folder

```
topstoreStatic/
├── index.html          # Entry point, Tailwind via CDN
├── styles.css          # Custom keyframes
├── aso-reference.txt   # ASO methodology reference (fed into the prompt)
└── js/
    ├── app.js          # UI state + rendering
    ├── chain.js        # Two-step pipeline + OpenRouter streaming
    ├── scraper.js      # iTunes Lookup + App Store HTML parse
    ├── prompts.js      # Bilingual ASO prompt templates
    ├── i18n.js         # zh/en translations
    └── config.js       # localStorage-backed settings
```

## How it maps to the original stack

| Original backend         | Static equivalent                                |
| ------------------------ | ------------------------------------------------- |
| FastAPI `/api/advice/start` SSE | `chain.js` — calls OpenRouter directly from the browser with `stream:true` and the same reasoning + field-marker events |
| `scraper.get_app_metadata` | `scraper.getAppMetadata` — iTunes Lookup (CORS-enabled) plus App Store HTML parsed through `DOMParser` |
| ASO prompt + reference   | `prompts.js` + `aso-reference.txt`               |
| SQLite session storage   | Dropped — the static version is stateless        |
| `/api/advice/email`      | Dropped                                          |
| Share page               | Client-side share buttons share the current URL  |

## Setup (first run)

1. Open `index.html` locally or deploy the folder.
2. Click **Settings** in the top right and paste your OpenRouter API key.
   Optionally change the model (default `openai/gpt-oss-120b`) and the CORS
   proxy prefix (default `https://corsproxy.io/?`). Values are kept in
   `localStorage`.
3. Paste an `apps.apple.com/<cc>/app/...` URL and submit.

> Output language follows the App Store region in the URL (`/cn/` → Chinese,
> everything else → English), identical to the original behaviour.

## Deploying to GitHub Pages

1. Push this folder to a repo (e.g. copy it to the root or a `docs/` folder).
2. In **Settings → Pages**, pick the branch and root/`docs/` path.
3. Visit the published URL; the app runs as-is. Each visitor supplies their
   own OpenRouter key on first use.

Because there's no backend, the OpenRouter key never leaves the user's
browser. If you embed a shared key for convenience (edit `js/config.js`
`DEFAULTS.apiKey`) note that it will be publicly visible in the deployed JS.

## CORS proxy note

The App Store product page is only needed to pull the on-page subtitle that
iTunes Lookup doesn't return. If the proxy is unreachable, iTunes metadata
alone is still enough to generate an ASO package — you just lose the
authoritative subtitle.
