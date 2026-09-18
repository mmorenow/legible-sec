#!/usr/bin/env python3
"""Generate the 5 LEGIBLE audience persona images via gpt-image-1.

5 images, 1024x1024, quality high → presentation/web/public/img/register/.
Cohesive flat-vector persona set, style-locked to the site palette.
"""
import base64, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

REPO = "/Users/marcelomoreno/Downloads/legible-sec"
OUT = os.path.join(REPO, "presentation/web/public/img/register")
os.makedirs(OUT, exist_ok=True)

key = None
with open(os.path.join(REPO, ".env")) as f:
    for line in f:
        if line.strip().startswith("OPENAI_API_KEY"):
            key = line.split("=", 1)[1].strip().strip('"').strip("'"); break
if not key:
    sys.exit("OPENAI_API_KEY not found in .env")

STYLE = (
    " Style: clean modern flat vector character illustration, calm editorial"
    " Swiss-poster feel, confident even line weight. One centered subject on a"
    " plain very light cool off-white background (hex F6F8FB). All linework and"
    " outlines in graphite slate (hex 2A303C); fill clothing and objects in a few"
    " flat calm grays; use exactly ONE small vivid cobalt-blue accent (hex 2A5BFF)"
    " per image on a single meaningful object and keep everything else grayscale."
    " Generous negative space, airy and composed, subtle paper grain, crisp edges,"
    " consistent proportions and line weight suitable for a matching set. Strictly"
    " no text, no letters, no numbers, no words, no logos, no watermarks, no UI"
    " chrome. No dark backgrounds, no 3D, no photorealism, no gradients, no heavy"
    " drop shadows."
)

IMAGES = {
    "technical-leadership.png": (
        "A composed corporate executive in a well-tailored business suit and slim"
        " eyeglasses, shown from the chest up, calmly reading a single sheet of"
        " paper held in both hands, gaze lowered and thoughtful. The eyeglasses are"
        " the one cobalt-blue accent."
    ),
    "practitioner.png": (
        "A focused software engineer in a plain casual shirt, seated in profile at a"
        " desk, leaning slightly toward a desktop monitor with both hands resting on"
        " a keyboard. The monitor screen is the one cobalt-blue accent."
    ),
    "board.png": (
        "A calm boardroom scene: three directors in business attire seated together"
        " behind one long meeting table, facing the viewer, attentive. A simple"
        " standing panel with a few plain bars sits beside the table. The single"
        " tallest bar is the one cobalt-blue accent."
    ),
    "public.png": (
        "An ordinary everyday person in a simple crew-neck sweater, shown from the"
        " chest up, holding a smartphone in one hand and looking at it with a"
        " curious, engaged expression, a small rounded empty speech bubble near"
        " their head. The phone screen is the one cobalt-blue accent."
    ),
    "analogy.png": (
        "A friendly casual person shown from the chest up, smiling and gesturing"
        " with one open hand toward a large rounded thought bubble beside their"
        " head. Inside the bubble two simple flat icons sit side by side linked by a"
        " small equals sign: a padlock on the left and a little house on the right,"
        " visualizing one idea explained as an everyday analogy. The equals sign is"
        " the one cobalt-blue accent."
    ),
}


def gen(name, prompt):
    body = json.dumps({
        "model": "gpt-image-1", "prompt": prompt + STYLE,
        "size": "1024x1024", "quality": "high", "n": 1,
    }).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations", data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.load(r)
    png = base64.b64decode(data["data"][0]["b64_json"])
    with open(os.path.join(OUT, name), "wb") as f:
        f.write(png)
    return f"{name}: {len(png)/1e6:.2f} MB"


with ThreadPoolExecutor(max_workers=5) as ex:
    futs = {ex.submit(gen, n, p): n for n, p in IMAGES.items()}
    for fut in as_completed(futs):
        try:
            print(fut.result())
        except Exception as e:
            print(f"{futs[fut]}: ERROR {e}")
print("done ->", OUT)
