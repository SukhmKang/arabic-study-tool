from pathlib import Path
from typing import Any

import cv2
import numpy as np
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize

TEMPLATE_DIR = Path(__file__).resolve().parents[1] / "data" / "templates" / "isolated"


def _load_templates(slug: str) -> list[np.ndarray]:
    folder = TEMPLATE_DIR / slug
    templates: list[np.ndarray] = []
    for path in sorted(folder.glob("*.png")):
        img = cv2.imread(str(path), cv2.IMREAD_GRAYSCALE)
        if img is None:
            continue
        if img.shape != (224, 224):
            img = cv2.resize(img, (224, 224), interpolation=cv2.INTER_CUBIC)
        templates.append(img)
    return templates


def _skeleton_points(binary: np.ndarray) -> np.ndarray:
    inv = cv2.bitwise_not(binary).astype(bool)
    skel = skeletonize(inv)
    return np.column_stack(np.where(skel))


def _hausdorff(pts_a: np.ndarray, pts_b: np.ndarray) -> float:
    if len(pts_a) == 0 or len(pts_b) == 0:
        return float("inf")

    tree = cKDTree(pts_b)
    dists, _ = tree.query(pts_a)
    return float(np.max(dists))


def _baseline_angle(binary: np.ndarray) -> float:
    inv = cv2.bitwise_not(binary)
    coords = cv2.findNonZero(inv)
    if coords is None or len(coords) < 5:
        return 0.0

    vx, vy, _x0, _y0 = cv2.fitLine(coords, cv2.DIST_L2, 0, 0.01, 0.01)
    # OpenCV may return 1-element vectors; coerce to Python scalars.
    vx_val = float(np.ravel(vx)[0])
    vy_val = float(np.ravel(vy)[0])
    return float(np.degrees(np.arctan2(vy_val, vx_val)))


def match_template(binary: np.ndarray, letter: dict[str, Any]) -> tuple[dict[str, Any], bytes]:
    templates = _load_templates(letter["slug"])
    if not templates:
        return {"similarity_score": 0.5, "baseline_angle": 0.0}, b""

    input_skel = _skeleton_points(binary)
    max_dist = float(np.sqrt(224**2 + 224**2))

    best_score = 0.0
    best_template_img = templates[0]

    for tmpl in templates:
        tmpl_skel = _skeleton_points(tmpl)
        h = max(_hausdorff(input_skel, tmpl_skel), _hausdorff(tmpl_skel, input_skel))
        score = float(max(0.0, 1.0 - h / max_dist))

        if score > best_score:
            best_score = score
            best_template_img = tmpl

    angle = _baseline_angle(binary)
    ok, buf = cv2.imencode(".png", best_template_img)
    template_bytes = buf.tobytes() if ok else b""

    return {"similarity_score": float(best_score), "baseline_angle": float(angle)}, template_bytes
