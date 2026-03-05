# Arabic Handwriting Grading — Server Spec (HANDWRITING-SERVER.md)

## Overview

FastAPI server that accepts a handwritten Arabic letter image, runs the grading pipeline, and returns structured feedback. Called by the React PWA during Draw and Camera quiz modes.

Since the quiz always tells the student which letter to draw, the classifier is unnecessary — we already know the target. The pipeline uses dot detection and template matching to produce structured evidence, then passes it to Claude for feedback.

---

## Tech stack

| | |
|---|---|
| Runtime | Python 3.11+ |
| Framework | FastAPI |
| Server | Uvicorn |
| CV | opencv-python, scikit-image |
| HTTP client | httpx (for Anthropic API) |
| Image handling | Pillow |

---

## Project structure

```
grading-server/
├── main.py                  # FastAPI app, /grade endpoint
├── pipeline/
│   ├── preprocess.py        # image normalisation
│   ├── dots.py              # dot detection
│   ├── template.py          # template matching + skeletonization
│   ├── score.py             # scoring engine
│   └── feedback.py          # Anthropic API call
├── data/
│   ├── templates/
│   │   └── isolated/
│   │       ├── alif/        # 01.png … 08.png
│   │       ├── ba/
│   │       └── ... (28 folders)
│   └── letters.json         # letter data (arabic, name, roman, slug, dots)
├── scripts/
│   └── generate_templates.py
├── requirements.txt
└── .env                     # ANTHROPIC_API_KEY (optional — see auth section)
```

---

## Setup

### Generate templates

```python
# scripts/generate_templates.py
# For each letter, render isolated form using Pillow + Arabic font
# Save 8 variants per letter (base + size/rotation variants) to data/templates/isolated/{slug}/
# Requires: NotoNaskhArabic-Regular.ttf in scripts/
# Output: data/templates/isolated/{slug}/01.png … 08.png
# Apply same preprocessing as grading pipeline (grayscale, threshold, centre)
```

### Install dependencies

```
# requirements.txt
fastapi
uvicorn[standard]
opencv-python-headless
scikit-image
scipy
Pillow
httpx
python-dotenv
python-multipart
```

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

---

## API

### POST /grade

**Request body:**
```json
{
  "image": "<base64 string, no data URL prefix>",
  "media_type": "image/png",
  "letter_pos": 2,
  "api_key": "sk-ant-..."
}
```

`letter_pos` is the letter's position (1–28) in abjad order. Server looks up full letter data from `data/letters.json`.

**Response:**
```json
{
  "correct": true,
  "score": "good",
  "feedback": "The stroke shape is right and your dot is in the correct position below the letter. Try to make the baseline a little more horizontal next time.",
  "debug": {
    "dot_count": 1,
    "dot_score": 1.0,
    "template_score": 0.74,
    "baseline_angle": 2.1,
    "final_score": 0.79
  }
}
```

`debug` is always returned but not shown in UI — useful during development.

**Errors:**
```json
{ "detail": "error message" }
```

HTTP 400 for bad input, 500 for pipeline failures.

### GET /health

Returns `{"status": "ok"}`.

---

## main.py

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64, json
from pipeline.preprocess import preprocess
from pipeline.dots import detect_dots, dot_score, EXPECTED_DOTS
from pipeline.template import match_template
from pipeline.score import compute_score
from pipeline.feedback import generate_feedback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

LETTERS = json.load(open("data/letters.json"))

class GradeRequest(BaseModel):
    image: str
    media_type: str
    letter_pos: int
    api_key: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/grade")
async def grade(req: GradeRequest):
    letter = next((l for l in LETTERS if l["pos"] == req.letter_pos), None)
    if not letter:
        raise HTTPException(400, f"Unknown letter_pos: {req.letter_pos}")

    try:
        image_bytes = base64.b64decode(req.image)
    except Exception:
        raise HTTPException(400, "Invalid base64 image")

    try:
        binary = preprocess(image_bytes)
        dot_result = detect_dots(binary)
        ds = dot_score(dot_result, letter)
        template_result, reference_png = match_template(binary, letter)
        score = compute_score(ds, template_result)
        feedback = await generate_feedback(
            image_bytes, req.media_type,
            reference_png,
            dot_result, ds,
            template_result, score, letter,
            req.api_key
        )
    except Exception as e:
        raise HTTPException(500, str(e))

    return {
        "correct": score["correct"],
        "score": score["verdict"],
        "feedback": feedback,
        "reference_image": base64.b64encode(reference_png).decode() if reference_png else None,
        "debug": {
            "dot_count": dot_result["dot_count"],
            "dot_score": ds,
            "template_score": template_result["similarity_score"],
            "baseline_angle": template_result["baseline_angle"],
            "final_score": score["final_score"],
        }
    }
```

---

## pipeline/preprocess.py

```python
import cv2
import numpy as np
from PIL import Image
import io

def preprocess(image_bytes: bytes) -> np.ndarray:
    """
    Returns binary: uint8 (224, 224), white background, dark letter.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr = np.array(img)

    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    gray = cv2.resize(gray, (224, 224), interpolation=cv2.INTER_CUBIC)

    # Otsu threshold
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Ensure dark letter on white background
    if np.mean(binary) < 127:
        binary = cv2.bitwise_not(binary)

    # Noise removal
    kernel = np.ones((2, 2), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Centre letter in frame
    binary = _centre_letter(binary)

    return binary

def _centre_letter(binary: np.ndarray) -> np.ndarray:
    inv = cv2.bitwise_not(binary)
    coords = cv2.findNonZero(inv)
    if coords is None:
        return binary
    x, y, w, h = cv2.boundingRect(coords)
    letter = binary[y:y+h, x:x+w]
    size = max(w, h)
    padded = np.full((size, size), 255, dtype=np.uint8)
    ox, oy = (size - w) // 2, (size - h) // 2
    padded[oy:oy+h, ox:ox+w] = letter
    return cv2.resize(padded, (224, 224), interpolation=cv2.INTER_CUBIC)
```

---

## pipeline/dots.py

```python
import cv2
import numpy as np
from typing import Dict, Any

EXPECTED_DOTS = {
    'أ': {'count': 0, 'positions': []},
    'ب': {'count': 1, 'positions': ['below']},
    'ت': {'count': 2, 'positions': ['above']},
    'ث': {'count': 3, 'positions': ['above']},
    'ج': {'count': 1, 'positions': ['inside']},
    'ح': {'count': 0, 'positions': []},
    'خ': {'count': 1, 'positions': ['above']},
    'د': {'count': 0, 'positions': []},
    'ذ': {'count': 1, 'positions': ['above']},
    'ر': {'count': 0, 'positions': []},
    'ز': {'count': 1, 'positions': ['above']},
    'س': {'count': 0, 'positions': []},
    'ش': {'count': 3, 'positions': ['above']},
    'ص': {'count': 0, 'positions': []},
    'ض': {'count': 1, 'positions': ['above']},
    'ط': {'count': 0, 'positions': []},
    'ظ': {'count': 1, 'positions': ['above']},
    'ع': {'count': 0, 'positions': []},
    'غ': {'count': 1, 'positions': ['above']},
    'ف': {'count': 1, 'positions': ['above']},
    'ق': {'count': 2, 'positions': ['above']},
    'ك': {'count': 0, 'positions': []},
    'ل': {'count': 0, 'positions': []},
    'م': {'count': 0, 'positions': []},
    'ن': {'count': 1, 'positions': ['above']},
    'ه': {'count': 0, 'positions': []},
    'و': {'count': 0, 'positions': []},
    'ي': {'count': 2, 'positions': ['below']},
}

def detect_dots(binary: np.ndarray) -> Dict[str, Any]:
    inv = cv2.bitwise_not(binary)
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(inv)

    if n <= 1:
        return {"dot_count": 0, "dots": []}

    areas = stats[1:, cv2.CC_STAT_AREA]
    body_idx = int(np.argmax(areas)) + 1
    body_stats = stats[body_idx]
    body_area = body_stats[cv2.CC_STAT_AREA]
    body_top = body_stats[cv2.CC_STAT_TOP]
    body_bottom = body_top + body_stats[cv2.CC_STAT_HEIGHT]

    dots = []
    for i in range(1, n):
        if i == body_idx:
            continue
        area = stats[i, cv2.CC_STAT_AREA]
        if area < 8 or area > body_area * 0.15:
            continue
        left = stats[i, cv2.CC_STAT_LEFT]
        top = stats[i, cv2.CC_STAT_TOP]
        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]
        if left <= 1 or top <= 1 or left+w >= 222 or top+h >= 222:
            continue

        cy = float(centroids[i][1])
        pos = 'above' if cy < body_top else 'below' if cy > body_bottom else 'inside'
        dots.append({
            "x": float(centroids[i][0]),
            "y": cy,
            "relative_position": pos,
            "size": int(area),
        })

    return {"dot_count": len(dots), "dots": dots}

def dot_score(dot_result: Dict, letter: Dict) -> float:
    expected = EXPECTED_DOTS.get(letter["arabic"])
    if not expected:
        return 1.0
    if dot_result["dot_count"] != expected["count"]:
        return 0.0
    if expected["count"] == 0:
        return 1.0
    detected_positions = [d["relative_position"] for d in dot_result["dots"]]
    all_match = all(p in detected_positions for p in expected["positions"])
    return 1.0 if all_match else 0.5
```

---

## pipeline/template.py

```python
import cv2
import numpy as np
from skimage.morphology import skeletonize
from scipy.spatial import cKDTree
from pathlib import Path
from typing import Tuple, Dict, Any

TEMPLATE_DIR = Path("data/templates/isolated")

def _load_templates(slug: str) -> list:
    folder = TEMPLATE_DIR / slug
    templates = []
    for p in sorted(folder.glob("*.png")):
        img = cv2.imread(str(p), cv2.IMREAD_GRAYSCALE)
        if img is not None:
            templates.append(img)
    return templates

def _skeleton_points(binary: np.ndarray) -> np.ndarray:
    inv = cv2.bitwise_not(binary).astype(bool)
    skel = skeletonize(inv)
    return np.column_stack(np.where(skel))

def _hausdorff(pts_a: np.ndarray, pts_b: np.ndarray) -> float:
    if len(pts_a) == 0 or len(pts_b) == 0:
        return float('inf')
    tree = cKDTree(pts_b)
    dists, _ = tree.query(pts_a)
    return float(np.max(dists))

def _baseline_angle(binary: np.ndarray) -> float:
    inv = cv2.bitwise_not(binary)
    coords = cv2.findNonZero(inv)
    if coords is None or len(coords) < 5:
        return 0.0
    vx, vy, _, _ = cv2.fitLine(coords, cv2.DIST_L2, 0, 0.01, 0.01)
    return float(np.degrees(np.arctan2(float(vy), float(vx))))

def match_template(binary: np.ndarray, letter: Dict) -> Tuple[Dict[str, Any], bytes]:
    templates = _load_templates(letter["slug"])
    if not templates:
        return {"similarity_score": 0.5, "baseline_angle": 0.0}, b""

    input_skel = _skeleton_points(binary)
    best_score = 0.0
    best_template_img = templates[0]
    max_dist = np.sqrt(224**2 + 224**2)

    for tmpl in templates:
        tmpl_skel = _skeleton_points(tmpl)
        h = max(_hausdorff(input_skel, tmpl_skel), _hausdorff(tmpl_skel, input_skel))
        score = max(0.0, 1.0 - h / max_dist)
        if score > best_score:
            best_score = score
            best_template_img = tmpl

    angle = _baseline_angle(binary)
    _, buf = cv2.imencode(".png", best_template_img)

    return {"similarity_score": best_score, "baseline_angle": angle}, buf.tobytes()
```

---

## pipeline/score.py

```python
from typing import Dict, Any

def compute_score(ds: float, template: Dict) -> Dict[str, Any]:
    """
    Two signals only — no classifier.
    Weights are initial estimates; tune after testing with real handwriting.
    """
    dot_w = 0.55
    shape_w = 0.45

    final = (ds * dot_w) + (template["similarity_score"] * shape_w)

    if final >= 0.85:
        verdict = "excellent"
    elif final >= 0.65:
        verdict = "good"
    elif final >= 0.40:
        verdict = "close"
    else:
        verdict = "incorrect"

    return {
        "final_score": round(final, 3),
        "verdict": verdict,
        "correct": verdict in ("excellent", "good"),
        "dot_score": ds,
        "shape_score": round(template["similarity_score"], 3),
    }
```

---

## pipeline/feedback.py

```python
import httpx
import base64
from typing import Dict, Any
from pipeline.dots import EXPECTED_DOTS

ENDPOINT = "https://api.anthropic.com/v1/messages"

SYSTEM_PROMPT = """You are a warm, encouraging Arabic calligraphy tutor giving feedback to a beginner.

You will receive:
1. The student's handwritten attempt
2. A reference example of the correct letter
3. A structured analysis report

Your response must be:
- 2–3 sentences maximum
- Specific (mention dots, stroke direction, or proportions where relevant)
- Encouraging but honest
- Plain English, no markdown

If the attempt is good: lead with praise, then give one small refinement tip.
If the attempt needs work: find one thing they got right, then explain the main issue clearly."""

def _build_report(dot_result: Dict, ds: float, template: Dict, score: Dict, letter: Dict) -> str:
    expected = EXPECTED_DOTS.get(letter["arabic"], {})
    return f"""Target letter: {letter['arabic']} ({letter['name']}, "{letter['roman']}")

Dot analysis:
- Expected: {expected.get('count', 0)} dot(s) {', '.join(expected.get('positions', []))}
- Detected: {dot_result['dot_count']} dot(s)
- Dot score: {'correct' if ds == 1.0 else 'count right, position wrong' if ds == 0.5 else 'incorrect'}

Shape analysis:
- Template similarity: {template['similarity_score']:.0%}
- Baseline angle: {template['baseline_angle']:.1f}°

Overall: {score['final_score']:.0%} — {score['verdict']}""".strip()

async def generate_feedback(
    image_bytes: bytes,
    media_type: str,
    reference_png: bytes,
    dot_result: Dict,
    ds: float,
    template: Dict,
    score: Dict,
    letter: Dict,
    api_key: str,
) -> str:
    report = _build_report(dot_result, ds, template, score, letter)

    content = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(image_bytes).decode(),
            }
        },
    ]

    if reference_png:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": base64.b64encode(reference_png).decode(),
            }
        })

    content.append({"type": "text", "text": report})

    async with httpx.AsyncClient() as client:
        res = await client.post(
            ENDPOINT,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-opus-4-5",
                "max_tokens": 150,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": content}],
            },
            timeout=30.0,
        )
        res.raise_for_status()
        return res.json()["content"][0]["text"].strip()
```

---

## data/letters.json

```json
[
  {"arabic": "أ", "name": "alif",  "roman": "a / ā",  "slug": "alif",  "pos": 1},
  {"arabic": "ب", "name": "ba",    "roman": "b",       "slug": "ba",    "pos": 2},
  {"arabic": "ت", "name": "ta",    "roman": "t",       "slug": "ta",    "pos": 3},
  {"arabic": "ث", "name": "tha",   "roman": "th",      "slug": "tha",   "pos": 4},
  {"arabic": "ج", "name": "jiim",  "roman": "j",       "slug": "jiim",  "pos": 5},
  {"arabic": "ح", "name": "hha",   "roman": "ḥ",       "slug": "hha",   "pos": 6},
  {"arabic": "خ", "name": "kha",   "roman": "kh",      "slug": "kha",   "pos": 7},
  {"arabic": "د", "name": "daal",  "roman": "d",       "slug": "daal",  "pos": 8},
  {"arabic": "ذ", "name": "thaal", "roman": "dh",      "slug": "thaal", "pos": 9},
  {"arabic": "ر", "name": "ra",    "roman": "r",       "slug": "ra",    "pos": 10},
  {"arabic": "ز", "name": "zay",   "roman": "z",       "slug": "zay",   "pos": 11},
  {"arabic": "س", "name": "siin",  "roman": "s",       "slug": "siin",  "pos": 12},
  {"arabic": "ش", "name": "shiin", "roman": "sh",      "slug": "shiin", "pos": 13},
  {"arabic": "ص", "name": "saad",  "roman": "ṣ",       "slug": "saad",  "pos": 14},
  {"arabic": "ض", "name": "daad",  "roman": "ḍ",       "slug": "daad",  "pos": 15},
  {"arabic": "ط", "name": "taa",   "roman": "ṭ",       "slug": "taa",   "pos": 16},
  {"arabic": "ظ", "name": "thaa",  "roman": "ẓ",       "slug": "thaa",  "pos": 17},
  {"arabic": "ع", "name": "ayn",   "roman": "ʿ",       "slug": "ayn",   "pos": 18},
  {"arabic": "غ", "name": "ghayn", "roman": "gh",      "slug": "ghayn", "pos": 19},
  {"arabic": "ف", "name": "fa",    "roman": "f",       "slug": "fa",    "pos": 20},
  {"arabic": "ق", "name": "qaf",   "roman": "q",       "slug": "qaf",   "pos": 21},
  {"arabic": "ك", "name": "kaf",   "roman": "k",       "slug": "kaf",   "pos": 22},
  {"arabic": "ل", "name": "lam",   "roman": "l",       "slug": "lam",   "pos": 23},
  {"arabic": "م", "name": "miim",  "roman": "m",       "slug": "miim",  "pos": 24},
  {"arabic": "ن", "name": "nuun",  "roman": "n",       "slug": "nuun",  "pos": 25},
  {"arabic": "ه", "name": "ha",    "roman": "h",       "slug": "ha",    "pos": 26},
  {"arabic": "و", "name": "waw",   "roman": "w / ū",   "slug": "waw",   "pos": 27},
  {"arabic": "ي", "name": "ya",    "roman": "y / ī",   "slug": "ya",    "pos": 28}
]
```

---

## Known uncertainties — flag during implementation

1. **ج dot position** — dot sits inside the letter body in isolated form, may be ambiguous with connected-components. May need letter-specific handling in `dots.py`
2. **Scoring weights** — (0.55 / 0.45) are estimates. Tune after testing with real handwriting
3. **Template quality** — pipeline quality is only as good as the reference templates. Run `generate_templates.py` and visually verify output before testing

---

## Implementation order

1. Run `generate_templates.py`, verify output PNGs look correct
2. Implement and test `preprocess.py` (save output to disk, check visually)
3. Implement and test `dots.py` — log dot count per letter on training images
4. Implement and test `template.py` — log similarity scores
5. Implement `score.py` and `feedback.py`
6. Wire up `main.py`, test `/grade` end-to-end with curl
7. Hand off to frontend (HANDWRITING-CLIENT.md)