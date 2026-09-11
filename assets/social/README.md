# RLE-Bench X launch video

- `rle-bench-x-launch.mp4`: 11.5 seconds, 1080 × 1080, 30 fps, H.264 / yuv420p, silent, streaming-ready MP4.
- `rle-bench-x-cover.jpg`: final four-task grid, suitable as a cover.
- `rle-bench-x-storyboard.jpg`: six-frame review sheet.
- `preview.html`: local video player and download links.
- `rle-bench-x-banner.png` / `.jpg`: matching 1600 × 900 (16:9) still image for attaching to an X post. Rebuild with `python3 scripts/render_launch_banner.py`; uses selected frames from the same four demos, the existing logo, and the video typography and palette.

The existing `assets/icon.png` llama-and-robot logo appears in a rounded white tile next to the brand name throughout the montage, enlarged on the end card.

The montage uses homepage-derived red (`#e34948`), yellow (`#eda100`), blue (`#3987e5`), and green (`#1baf7a`) accents for Interactive Control, Learning Recipe, Perception, and Mechanical Design, respectively. The end card has no arrow.

## Edit timeline

Segment headings omit sequence numbers. Their subtitles follow the requested terminology: Interactive Control — `3 workflow / 35 tasks` (15 + 15 + 5); Learning Recipe — `2 workflow / 9 tasks` (5 + 4); Perception — `2 workflow / 5 tasks` (4 + 1); Mechanical Design — `2 workflow / 6 tasks` (the user-requested count, covering three arm variants for each design workflow).

| Time | Content | Existing source |
| --- | --- | --- |
| 0–2 s | “A Qualifying Exam for Coding Agents as Robot Learning Engineers” above a single fast-forward cube-solving video | Entire `assets/social/evaluation_ep0000.mp4` (412.7 s) compressed into 1.7 s, approximately 243× speed, followed by a 0.3 s hold on its actual final frame; center crop to the wide panel |
| 2–3.5 s | Interactive control, bimanual cube manipulation | `assets/social/evaluation_ep0000.mp4`, from 120 s, full square view, accelerated 6× |
| 3.5–5 s | PPO development curve alongside a closer sprint rollout | `assets/blog/demos/t04-final-sprint.mp4`, 3.4–5.5 s at 1.4× playback, cropped to 360 × 320 at (140, 35) to emphasize arm swing and leg motion; `assets/blog/t04-hillclimb.json` |
| 5–6.5 s | Perception, contact-rich bin clearing | `assets/social/task09-1080p50-10x.mp4`, from 2 s, full view, existing 10× speed |
| 6.5–8.5 s | Mechanical design, GELLO mechanism | `assets/blog/demos/section_3/gello-design-showcase-1080p-4x.mp4`, from 1.5 s, existing 4× speed |
| 8.5–11.5 s | Four moving task panels, benchmark thesis, URL | Same sources |

The PPO curve uses only the 3-seed development reports, retaining their reported values and elapsed times; it is not an aggregate benchmark score. The curve reveals existing reports over the segment. The 6,144-world training detail comes from the existing sprint `training_summary.md`. The intro uses only the supplied cube recording, with no code panel or additional demo panels. The GELLO motion is guided visualization of a submitted design, not autonomous control. Demos are illustrative examples, not claims that all agents solve these tasks.

Typography uses Avenir Next Demi Bold for headings, Avenir Next Regular for body text, and Menlo for technical annotations.

Rebuild from the repository root with `python3 scripts/render_launch_video.py`. Requires Pillow, ffmpeg, ffprobe for verification, and macOS Avenir Next/Menlo fonts. Original assets and website files are unchanged.

Creative follows the supplied short-video brief, including immediate motion, text overlays, and early branding. Reference: [X creative best practices](https://business.x.com/en/advertising/creative-best-practices).

Suggested post:

> Can coding agents really do robotics engineering?
>
> RLE-Bench evaluates them across interactive control, learning recipe, perception, and mechanical design.
>
> Beyond “Can agents control robots?”
>
> https://rle-bench.github.io/
