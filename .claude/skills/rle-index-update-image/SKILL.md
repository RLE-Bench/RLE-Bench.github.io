---
name: rle-index-update-image
description: Render a shareable PNG of the homepage RLE Index with newly added models highlighted in red ("NEW" tag). Use when announcing new leaderboard results.
---

# RLE Index update image

Run from the repo after `leaderboard.json` is rebuilt:

```bash
.claude/skills/rle-index-update-image/render.sh "GPT-6.1 Sol,Claude Opus 5.5" tmp/rle-index-new-models.png
```

- Names must match the leaderboard display names exactly (e.g. `Claude Fable 5.1`, `Grok 4.6`, `GPT-6 Luna`).
- Renders the local site in headless Chrome at 2x, light theme, larger text, 20px margins; the panel is measured first so the image is never cropped.
- Uses a temporary `zz-rle-index-preview.html` and a local server on port 8765; both are cleaned up. Repo files are not changed.
- Open the PNG and check that the legend stays on one line and every highlighted row shows the tag.

## Homepage news

Also add a news item for the new models. Insert a new `<li>` at the top of `<ul class="news-list">` in `index.html`, matching the existing entries:

```html
<li><time datetime="2026-11-01">Nov 1, 2026</time><p>We added results for <strong>Gemini 4 Argon</strong>, which ranks #2 on the RLE Index and first on four tasks.</p></li>
```

- Use today's date unless the user gives another one.
- Bold each new model's display name; state its RLE Index rank and anything notable (e.g. tasks where it ranks first), using numbers from `leaderboard.json`.
- Keep older items as they are.

Then commit only `index.html` and push to `main`:

```bash
git pull --ff-only origin main
git add index.html
git commit -m "Mention <Model> in the homepage news"
git push origin main
```

Pushing `main` deploys the site via GitHub Pages. Do not commit the rendered PNGs in `tmp/`.
