#!/usr/bin/env python3
"""Generate the LEGIBLE v3 curated image set via gpt-image-1.

6 images, 1536x1024, quality high. Saved to presentation/web/public/img/v3/.
Style-locked to the site palette: off-white F6F8FB, graphite 2A303C,
rust CF6F4E (technical), cobalt 2A5BFF (executive), soft green 3FBF8F (verified).
"""
import base64
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = "/Users/marcelomoreno/Downloads/legible-sec"
OUT = os.path.join(REPO, "presentation/web/public/img/v3")
os.makedirs(OUT, exist_ok=True)

# --- key from repo .env ---
key = None
with open(os.path.join(REPO, ".env")) as f:
    for line in f:
        line = line.strip()
        if line.startswith("OPENAI_API_KEY"):
            key = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
if not key:
    sys.exit("OPENAI_API_KEY not found in .env")

STYLE = (
    " Style: minimal flat geometric vector illustration, Swiss research-poster"
    " aesthetic, printed-ink feel with very subtle paper grain. Palette locked:"
    " very light cool off-white background (hex F6F8FB), graphite slate gray ink"
    " (hex 2A303C), warm terracotta rust (hex CF6F4E), vivid cobalt blue"
    " (hex 2A5BFF), and one small soft green accent (hex 3FBF8F) only where the"
    " scene mentions it. Flat color, crisp edges, generous negative space, calm"
    " and airy composition. Strictly no text, no letters, no numbers, no words,"
    " no logos, no watermarks. No dark backgrounds, no 3D rendering, no"
    " photorealism, no heavy drop shadows."
)

IMAGES = {
    "og-card-light.png": (
        "A wide minimal composition: on the left third, a dense rectangular block"
        " made of many short graphite and terracotta-rust dashes of varying widths"
        " (an unreadable technical security document). From the block's right edge a"
        " single straight vivid cobalt beam crosses a wide field of empty off-white"
        " space toward the right, where it resolves into three clean long cobalt"
        " horizontal lines (one calm executive sentence), with one small soft green"
        " dot resting beside them."
    ),
    "embedding-space.png": (
        "A vast airy field of small graphite dots scattered like a star map across"
        " off-white paper, gathering in a few loose clusters and fading toward the"
        " edges. Left of center, one terracotta-rust dot is circled by two thin"
        " concentric cobalt rings. Four nearby dots are solid cobalt blue and"
        " slightly larger, each connected back to the rust dot by a cobalt hairline."
        " Everything else stays quiet, pale, and precise."
    ),
    "adapter-film.png": (
        "A large calm pale-gray rounded rectangular slab occupies the lower two"
        " thirds of the frame: a monolithic frozen block with a faint texture of"
        " horizontal rows. Hovering just above its top surface floats one thin vivid"
        " cobalt strip, small in area, parallel to the slab, with a visible airy gap."
        " Two cobalt hairline connectors bridge the strip and the slab. From the"
        " left, a small terracotta-rust square drifts toward the slab along a"
        " graphite hairline. Off-white space everywhere else."
    ),
    "corpus-shelf.png": (
        "Hundreds of tiny rectangular document shapes arranged in a loose irregular"
        " grid across the frame, like an archive photographed from above. Most are"
        " drawn as pale graphite outlines, fading to white at the frame edges. A"
        " scattered handful are filled terracotta rust, and each rust document is"
        " connected by one thin arcing cobalt hairline to a nearby cobalt-filled"
        " document, forming visible pairs across the archive. Calm, airy, precise."
    ),
    "benchmark-gauge.png": (
        "One large pentagon outline centered in vast airy off-white space, drawn as"
        " a thin dashed cobalt line. Five short graphite hairline axes radiate from"
        " the pentagon's center to its five corners, passing through faint"
        " concentric pentagon rings drawn in very pale graphite. One corner carries"
        " a small solid terracotta-rust dot; the opposite corner carries a small"
        " solid cobalt dot. Meditative, measured, precise."
    ),
    "local-instrument.png": (
        "A minimal flat side-view laptop drawn in graphite outline, sitting low and"
        " centered in the frame. A small terracotta-rust document shape approaches"
        " it from the left along a thin graphite hairline; a single clean cobalt"
        " sentence line exits to the right along another hairline, ending in one"
        " small soft green dot. Above the laptop, three short radio-wave arcs are"
        " struck through by a single thin graphite slash, meaning offline. Vast"
        " airy off-white space around everything."
    ),
}


def gen(name: str, prompt: str) -> str:
    body = json.dumps({
        "model": "gpt-image-1",
        "prompt": prompt + STYLE,
        "size": "1536x1024",
        "quality": "high",
        "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    png = base64.b64decode(data["data"][0]["b64_json"])
    path = os.path.join(OUT, name)
    with open(path, "wb") as f:
        f.write(png)
    return f"{name}: {len(png)/1e6:.2f} MB"


with ThreadPoolExecutor(max_workers=3) as ex:
    futs = {ex.submit(gen, n, p): n for n, p in IMAGES.items()}
    for fut in as_completed(futs):
        try:
            print("OK ", fut.result(), flush=True)
        except Exception as e:  # noqa: BLE001
            print("FAIL", futs[fut], repr(e), flush=True)
print("done")
