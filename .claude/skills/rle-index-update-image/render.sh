#!/usr/bin/env bash
# Render the homepage RLE Index panel as a PNG, highlighting new models in red.
# Usage: render.sh "Model A,Model B" [out.png] [port]
# Model names must match the leaderboard's display names exactly.
set -euo pipefail
NEW="${1:?comma-separated model names}"
OUT="${2:-tmp/rle-index-new-models.png}"
PORT="${3:-8765}"
ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PAGE="zz-rle-index-preview.html"
cd "$ROOT"

python3 - "$NEW" "$PAGE" <<'EOF'
import json, sys
new, page = sys.argv[1], sys.argv[2]
names = json.dumps([n.strip() for n in new.split(",") if n.strip()])
inject = """<style>
.site-header,.hero,#tasks,#cost,#team,.contribution-callout,.site-footer,noscript,.skip-link,.news{display:none!important}
html,body{background:var(--page)!important;margin:0!important;padding:0!important}
main,#main{padding:0!important;margin:0!important}
#index{padding:20px 0 0!important;margin:0!important}
#index .wrap{width:auto!important;max-width:none!important;margin:0 20px!important}
#index .family-comparison{margin-bottom:0!important}
#index .section-head{flex-wrap:nowrap!important}
#index .section-title{font-size:46px!important}
#index .section-sub{font-size:21px!important;max-width:none!important}
#index .metric-switch{flex-shrink:0!important}
#index .access-switch{display:none!important}
#index .metric-switch button{font-size:19px!important;padding:10px 16px!important}
#index .family-matrix .col-rank{width:46px!important}
#index .family-matrix .col-model{width:262px!important}
#index .family-matrix .col-index{width:120px!important}
#index .family-matrix thead th{font-size:17px!important}
#index .family-bar-legend{font-size:17px!important;gap:6px 18px!important;flex-wrap:nowrap!important;white-space:nowrap}
#index .family-bar-legend i{width:11px!important;height:11px!important;flex-basis:11px!important}
#index .family-matrix .model-label{font-size:21px!important;overflow:visible!important}
#index .family-matrix .model-meta{font-size:14px!important;margin-top:4px!important}
#index .family-matrix .place-cell{font-size:24px!important}
#index .family-matrix .index-td{font-size:22px!important}
#index .family-scale-note{font-size:17px!important}
tr.is-new th .model-label{color:#d4524a!important;font-weight:600}
tr.is-new td,tr.is-new th{background:color-mix(in srgb,#d4524a 7%,transparent)!important}
tr.is-new th .model-label::after{content:"NEW";margin-left:10px;padding:2px 7px 3px;border-radius:5px;background:#d4524a;color:#fff;font:700 13px/1.4 var(--ui);letter-spacing:.06em;vertical-align:3px}
</style>
<script>
(function(){const NEW=__NAMES__;
function mark(){document.querySelectorAll('#familyIndexGrid tr').forEach(tr=>{const l=tr.querySelector('.model-label');if(l&&NEW.includes(l.textContent.trim()))tr.classList.add('is-new');});}
try{localStorage.setItem('rlebench-theme','light');document.documentElement.dataset.theme='light';}catch(e){}
new MutationObserver(mark).observe(document.documentElement,{subtree:true,childList:true});
addEventListener('load',()=>setTimeout(()=>{mark();scrollTo(0,0);const r=document.querySelector('#index .family-comparison').getBoundingClientRect();document.title='B'+Math.ceil(r.bottom);},300));})();
</script>""".replace("__NAMES__", names)
s = open("index.html").read()
open(page, "w").write(s.replace("</body>", inject + "</body>", 1))
EOF

python3 -m http.server "$PORT" >/dev/null 2>&1 & SRV=$!; disown $SRV
trap 'kill $SRV 2>/dev/null; rm -f "$ROOT/$PAGE"' EXIT
sleep 1
URL="http://localhost:$PORT/$PAGE?v=$RANDOM"
W=1280
# Measure the panel bottom first, then shoot at exact height (no cropping: sips crops from the center).
B=$("$CHROME" --headless=new --disable-gpu --window-size=$W,1400 --virtual-time-budget=9000 --dump-dom "$URL" 2>/dev/null | grep -o '<title>B[0-9]*' | grep -o '[0-9]*$')
mkdir -p "$(dirname "$OUT")"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=$W,$((B + 20)) --virtual-time-budget=9000 --screenshot="$OUT" "$URL" 2>/dev/null
echo "wrote $OUT"
