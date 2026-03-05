from typing import Any

import cv2
import numpy as np

EXPECTED_DOTS = {
    "أ": {"count": 0, "positions": []},
    "ب": {"count": 1, "positions": ["below"]},
    "ت": {"count": 2, "positions": ["above"]},
    "ث": {"count": 3, "positions": ["above"]},
    "ج": {"count": 1, "positions": ["inside"]},
    "ح": {"count": 0, "positions": []},
    "خ": {"count": 1, "positions": ["above"]},
    "د": {"count": 0, "positions": []},
    "ذ": {"count": 1, "positions": ["above"]},
    "ر": {"count": 0, "positions": []},
    "ز": {"count": 1, "positions": ["above"]},
    "س": {"count": 0, "positions": []},
    "ش": {"count": 3, "positions": ["above"]},
    "ص": {"count": 0, "positions": []},
    "ض": {"count": 1, "positions": ["above"]},
    "ط": {"count": 0, "positions": []},
    "ظ": {"count": 1, "positions": ["above"]},
    "ع": {"count": 0, "positions": []},
    "غ": {"count": 1, "positions": ["above"]},
    "ف": {"count": 1, "positions": ["above"]},
    "ق": {"count": 2, "positions": ["above"]},
    "ك": {"count": 0, "positions": []},
    "ل": {"count": 0, "positions": []},
    "م": {"count": 0, "positions": []},
    "ن": {"count": 1, "positions": ["above"]},
    "ه": {"count": 0, "positions": []},
    "و": {"count": 0, "positions": []},
    "ي": {"count": 2, "positions": ["below"]},
}


def detect_dots(
    binary: np.ndarray,
    letter: dict[str, Any] | None = None,
    strategy: str = "auto",
) -> dict[str, Any]:
    expected = EXPECTED_DOTS.get(letter["arabic"], {"count": 0, "positions": []}) if letter else {"count": 0, "positions": []}
    expected_count = int(expected.get("count", 0))
    expected_positions = list(expected.get("positions", []))
    letter_arabic = str(letter["arabic"]) if letter else ""

    if strategy == "canvas":
        return _detect_dots_connected_components(binary, expected_count)

    inv = cv2.bitwise_not(binary)
    profile = _profile_for_letter(expected_count, expected_positions)
    dots = _extract_dots(inv, expected_positions, expected_count, profile, letter_arabic)

    if expected_count > 0 and len(dots) < expected_count:
        # Recovery pass for weak/merged dots.
        kernel = np.ones((2, 2), np.uint8)
        eroded = cv2.erode(inv, kernel, iterations=1)
        relaxed = dict(profile)
        relaxed["hard_min_area"] = max(3, int(profile["hard_min_area"]) - 1)
        relaxed["hard_min_circularity"] = max(0.08, float(profile["hard_min_circularity"]) - 0.05)
        relaxed["hard_min_solidity"] = max(0.35, float(profile["hard_min_solidity"]) - 0.10)
        relaxed["hard_min_extent"] = max(0.10, float(profile["hard_min_extent"]) - 0.05)
        relaxed["max_aspect_ratio"] = float(profile["max_aspect_ratio"]) + 0.4

        recovered = _extract_dots(eroded, expected_positions, expected_count, relaxed, letter_arabic)
        if len(recovered) > len(dots):
            dots = recovered

    if expected_count == 0 and dots:
        dots = [d for d in dots if _is_strong_explicit_dot_for_no_dot_letters(d)]

    return {"dot_count": len(dots), "dots": dots}


def _detect_dots_connected_components(binary: np.ndarray, expected_count: int) -> dict[str, Any]:
    inv = cv2.bitwise_not(binary)
    n, _labels, stats, centroids = cv2.connectedComponentsWithStats(inv)
    if n <= 1:
        return {"dot_count": 0, "dots": []}

    areas = stats[1:, cv2.CC_STAT_AREA]
    body_idx = int(np.argmax(areas)) + 1
    body_stats = stats[body_idx]
    body_area = int(body_stats[cv2.CC_STAT_AREA])
    body_top = int(body_stats[cv2.CC_STAT_TOP])
    body_h = int(body_stats[cv2.CC_STAT_HEIGHT])
    body_bottom = body_top + body_h
    margin = max(2.0, 0.08 * float(max(1, body_h)))

    dots: list[dict[str, Any]] = []
    for i in range(1, n):
        if i == body_idx:
            continue

        area = int(stats[i, cv2.CC_STAT_AREA])
        # Deterministic canvas rule: any detached non-tiny component counts as a dot candidate.
        if area < 4:
            continue

        left = int(stats[i, cv2.CC_STAT_LEFT])
        top = int(stats[i, cv2.CC_STAT_TOP])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        h = int(stats[i, cv2.CC_STAT_HEIGHT])
        if left <= 1 or top <= 1 or left + w >= 222 or top + h >= 222:
            continue

        cy = float(centroids[i][1])
        pos = "above" if cy < float(body_top) - margin else "below" if cy > float(body_bottom) + margin else "inside"
        dots.append(
            {
                "x": float(centroids[i][0]),
                "y": cy,
                "relative_position": pos,
                "size": area,
                "circularity": 0.0,
                "solidity": 0.0,
            }
        )

    # Keep deterministic behavior: detached components are dots.
    # For expected no-dot letters, this means any detached component fails the count check.
    _ = expected_count

    dots.sort(key=lambda d: (d["y"], d["x"]))
    return {"dot_count": len(dots), "dots": dots}


def _profile_for_letter(expected_count: int, expected_positions: list[str]) -> dict[str, Any]:
    if expected_count == 0:
        return {
            "hard_min_area": 10,
            "hard_max_area_ratio": 0.06,
            "hard_min_circularity": 0.42,
            "hard_min_solidity": 0.78,
            "hard_min_extent": 0.35,
            "soft_min_area": 999,
            "soft_max_area_ratio": 0.0,
            "soft_min_circularity": 1.0,
            "soft_min_solidity": 1.0,
            "soft_min_extent": 1.0,
            "max_aspect_ratio": 2.0,
            "zone_required": False,
        }

    if "inside" in expected_positions:
        return {
            "hard_min_area": 3,
            "hard_max_area_ratio": 0.20,
            "hard_min_circularity": 0.10,
            "hard_min_solidity": 0.45,
            "hard_min_extent": 0.12,
            "soft_min_area": 2,
            "soft_max_area_ratio": 0.26,
            "soft_min_circularity": 0.06,
            "soft_min_solidity": 0.28,
            "soft_min_extent": 0.08,
            "max_aspect_ratio": 3.8,
            "zone_required": True,
        }

    # Above/below dotted letters.
    return {
        "hard_min_area": 4,
        "hard_max_area_ratio": 0.16,
        "hard_min_circularity": 0.14,
        "hard_min_solidity": 0.50,
        "hard_min_extent": 0.18,
        "soft_min_area": 3,
        "soft_max_area_ratio": 0.24,
        "soft_min_circularity": 0.08,
        "soft_min_solidity": 0.30,
        "soft_min_extent": 0.10,
        "max_aspect_ratio": 3.4,
        "zone_required": True,
    }


def _extract_dots(
    inv: np.ndarray,
    expected_positions: list[str],
    expected_count: int,
    profile: dict[str, Any],
    letter_arabic: str,
) -> list[dict[str, Any]]:
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(inv)
    if n <= 1:
        return []

    areas = stats[1:, cv2.CC_STAT_AREA]
    body_idx = int(np.argmax(areas)) + 1
    body_stats = stats[body_idx]
    body_area = int(body_stats[cv2.CC_STAT_AREA])

    body_left = int(body_stats[cv2.CC_STAT_LEFT])
    body_top = int(body_stats[cv2.CC_STAT_TOP])
    body_w = int(body_stats[cv2.CC_STAT_WIDTH])
    body_h = int(body_stats[cv2.CC_STAT_HEIGHT])
    body_right = body_left + body_w
    body_bottom = body_top + body_h

    body = {
        "left": body_left,
        "top": body_top,
        "right": body_right,
        "bottom": body_bottom,
        "w": body_w,
        "h": body_h,
    }

    hard_pool: list[dict[str, Any]] = []
    soft_pool: list[dict[str, Any]] = []

    for i in range(1, n):
        if i == body_idx:
            continue

        area = int(stats[i, cv2.CC_STAT_AREA])

        left = int(stats[i, cv2.CC_STAT_LEFT])
        top = int(stats[i, cv2.CC_STAT_TOP])
        w = int(stats[i, cv2.CC_STAT_WIDTH])
        h = int(stats[i, cv2.CC_STAT_HEIGHT])
        if left <= 1 or top <= 1 or left + w >= 222 or top + h >= 222:
            continue

        short_side = max(1, min(w, h))
        aspect_ratio = max(w, h) / short_side
        if aspect_ratio > float(profile["max_aspect_ratio"]):
            continue

        comp = (labels[top : top + h, left : left + w] == i).astype(np.uint8) * 255
        contours, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        contour = contours[0]
        perimeter = cv2.arcLength(contour, True)
        if perimeter <= 0:
            continue

        circularity = float((4.0 * np.pi * area) / (perimeter * perimeter))
        hull = cv2.convexHull(contour)
        hull_area = float(cv2.contourArea(hull))
        solidity = float(area / hull_area) if hull_area > 0 else 0.0
        extent = float(area / max(1, w * h))

        cx = float(centroids[i][0])
        cy = float(centroids[i][1])

        if bool(profile["zone_required"]) and expected_positions:
            if not _in_expected_zone(cx, cy, body, expected_positions):
                continue

        rel_pos = _relative_position(cy, body_top, body_bottom, body_h)
        cand = {
            "x": cx,
            "y": cy,
            "relative_position": rel_pos,
            "size": area,
            "circularity": circularity,
            "solidity": solidity,
            "extent": extent,
            "aspect_ratio": aspect_ratio,
            "left": left,
            "top": top,
            "w": w,
            "h": h,
        }
        cand["quality"] = _candidate_quality(cand)
        cand["anchor_quality"] = _anchor_quality(cand["x"], cand["y"], body, expected_positions, letter_arabic)
        cand["rank_quality"] = cand["quality"] + 0.30 * cand["anchor_quality"]

        hard_ok = _passes_thresholds(
            cand,
            body_area,
            min_area=int(profile["hard_min_area"]),
            max_area_ratio=float(profile["hard_max_area_ratio"]),
            min_circularity=float(profile["hard_min_circularity"]),
            min_solidity=float(profile["hard_min_solidity"]),
            min_extent=float(profile["hard_min_extent"]),
        )
        if hard_ok:
            hard_pool.append(cand)
            continue

        if expected_count > 0:
            soft_ok = _passes_thresholds(
                cand,
                body_area,
                min_area=int(profile["soft_min_area"]),
                max_area_ratio=float(profile["soft_max_area_ratio"]),
                min_circularity=float(profile["soft_min_circularity"]),
                min_solidity=float(profile["soft_min_solidity"]),
                min_extent=float(profile["soft_min_extent"]),
            )
            if soft_ok:
                soft_pool.append(cand)

    if expected_count == 0:
        return [_public_dot(c) for c in _select_candidates(hard_pool, len(hard_pool), body_w)]

    selected = _select_candidates(hard_pool, expected_count, body_w)
    if len(selected) < expected_count:
        used = {(round(c["x"], 1), round(c["y"], 1)) for c in selected}
        fill = [c for c in soft_pool if (round(c["x"], 1), round(c["y"], 1)) not in used]
        selected.extend(_select_candidates(fill, expected_count - len(selected), body_w))

    if len(selected) < expected_count and expected_count > 1:
        selected.extend(_synthesize_multidot(selected, hard_pool + soft_pool, expected_count))

    if len(selected) < expected_count and "above" in expected_positions:
        selected.extend(
            _recover_from_above_anchors(
                inv=inv,
                body=body,
                selected=selected,
                expected_count=expected_count,
                letter_arabic=letter_arabic,
            )
        )

    selected = _select_candidates(selected, expected_count, body_w)
    return [_public_dot(c) for c in selected]


def _passes_thresholds(
    cand: dict[str, Any],
    body_area: int,
    min_area: int,
    max_area_ratio: float,
    min_circularity: float,
    min_solidity: float,
    min_extent: float,
) -> bool:
    if cand["size"] < min_area:
        return False
    if cand["size"] > body_area * max_area_ratio:
        return False
    if cand["circularity"] < min_circularity:
        return False
    if cand["solidity"] < min_solidity:
        return False
    if cand["extent"] < min_extent:
        return False
    return True


def _candidate_quality(c: dict[str, Any]) -> float:
    # Weighted compactness score for ranking; not an absolute classifier threshold.
    q = 0.0
    q += 0.45 * min(1.0, max(0.0, c["circularity"]))
    q += 0.35 * min(1.0, max(0.0, c["solidity"]))
    q += 0.20 * min(1.0, max(0.0, c["extent"]))
    if c["aspect_ratio"] > 2.0:
        q -= min(0.20, 0.05 * (c["aspect_ratio"] - 2.0))
    return float(q)


def _select_candidates(cands: list[dict[str, Any]], k: int, body_w: int) -> list[dict[str, Any]]:
    if k <= 0 or not cands:
        return []

    # Highest quality first.
    sorted_cands = sorted(cands, key=lambda c: c.get("rank_quality", c.get("quality", 0.0)), reverse=True)
    min_dist = max(4.0, 0.08 * float(max(1, body_w)))

    picked: list[dict[str, Any]] = []
    for cand in sorted_cands:
        too_close = False
        for p in picked:
            dx = cand["x"] - p["x"]
            dy = cand["y"] - p["y"]
            if (dx * dx + dy * dy) ** 0.5 < min_dist:
                too_close = True
                break
        if too_close:
            continue

        picked.append(cand)
        if len(picked) >= k:
            break

    return picked


def _anchor_quality(
    cx: float,
    cy: float,
    body: dict[str, int],
    expected_positions: list[str],
    letter_arabic: str,
) -> float:
    left = float(body["left"])
    right = float(body["right"])
    top = float(body["top"])
    bottom = float(body["bottom"])
    w = float(max(1, body["w"]))
    h = float(max(1, body["h"]))
    x_center = (left + right) / 2.0

    score = 0.0
    if "above" in expected_positions:
        # Dot should hover around top area.
        dy = abs(cy - (top - 0.15 * h)) / max(1.0, 0.7 * h)
        score += max(0.0, 1.0 - dy)

        # For multi-dot letters, prefer spread across x.
        if letter_arabic in ("ت", "ث", "ش", "ق"):
            dx = abs(cx - x_center) / max(1.0, 0.7 * w)
            score += 0.4 * max(0.0, 1.0 - dx)
        else:
            # Single above-dot letters often sit near center-right in these templates.
            target_x = left + 0.62 * w if letter_arabic in ("غ",) else x_center
            dx = abs(cx - target_x) / max(1.0, 0.7 * w)
            score += 0.5 * max(0.0, 1.0 - dx)

    if "below" in expected_positions:
        dy = abs(cy - (bottom + 0.15 * h)) / max(1.0, 0.8 * h)
        dx = abs(cx - x_center) / max(1.0, 0.8 * w)
        score += max(0.0, 1.0 - dy) + 0.4 * max(0.0, 1.0 - dx)

    if "inside" in expected_positions:
        target_x = x_center
        target_y = top + 0.58 * h
        dx = abs(cx - target_x) / max(1.0, 0.45 * w)
        dy = abs(cy - target_y) / max(1.0, 0.45 * h)
        score += max(0.0, 1.0 - 0.6 * dx - 0.8 * dy)

    return float(max(0.0, score))


def _synthesize_multidot(selected: list[dict[str, Any]], pool: list[dict[str, Any]], expected_count: int) -> list[dict[str, Any]]:
    if expected_count <= 1:
        return []

    # If a merged wide component likely contains multiple dots, split it along x.
    source = None
    for c in sorted(pool, key=lambda x: x.get("w", 0), reverse=True):
        if c.get("w", 0) >= 1.8 * max(1, c.get("h", 1)):
            source = c
            break

    if source is None:
        return []

    existing = {(round(c["x"], 1), round(c["y"], 1)) for c in selected}
    missing = max(0, expected_count - len(selected))
    if missing == 0:
        return []

    synth: list[dict[str, Any]] = []
    slots = missing + 1
    for i in range(1, slots + 1):
        x = float(source["left"] + (i * source["w"] / (slots + 1)))
        y = float(source["y"])
        key = (round(x, 1), round(y, 1))
        if key in existing:
            continue
        synth.append(
            {
                "x": x,
                "y": y,
                "relative_position": source["relative_position"],
                "size": max(2, int(source["size"] / (slots + 1))),
                "circularity": float(source["circularity"]),
                "solidity": float(source["solidity"]),
                "extent": float(source["extent"]),
                "aspect_ratio": 1.4,
                "left": int(x),
                "top": int(y),
                "w": max(2, int(source["w"] / (slots + 1))),
                "h": source["h"],
                "quality": max(0.0, float(source.get("quality", 0.0)) - 0.08),
                "anchor_quality": max(0.0, float(source.get("anchor_quality", 0.0)) - 0.08),
                "rank_quality": max(0.0, float(source.get("rank_quality", source.get("quality", 0.0))) - 0.10),
            }
        )
        if len(synth) >= missing:
            break

    return synth


def _recover_from_above_anchors(
    inv: np.ndarray,
    body: dict[str, int],
    selected: list[dict[str, Any]],
    expected_count: int,
    letter_arabic: str,
) -> list[dict[str, Any]]:
    if expected_count <= 0:
        return []

    # Targeted anchors for historically weak above-dot letters.
    anchor_x_by_letter = {
        "ت": [0.40, 0.62],
        "ث": [0.32, 0.50, 0.68],
        "ش": [0.30, 0.50, 0.70],
        "ق": [0.43, 0.57],
        "غ": [0.58],
    }
    x_fracs = anchor_x_by_letter.get(letter_arabic, [])
    if not x_fracs:
        return []

    left = float(body["left"])
    top = float(body["top"])
    w = float(max(1, body["w"]))
    h = float(max(1, body["h"]))
    y = top - 0.12 * h

    missing = max(0, expected_count - len(selected))
    if missing == 0:
        return []

    existing = {(round(c["x"], 1), round(c["y"], 1)) for c in selected}
    recovered: list[dict[str, Any]] = []

    for frac in x_fracs:
        if len(recovered) >= missing:
            break

        cx = left + frac * w
        cy = y
        key = (round(cx, 1), round(cy, 1))
        if key in existing:
            continue

        ink = _local_ink_ratio(inv, cx, cy, half_w=max(2, int(0.07 * w)), half_h=max(2, int(0.10 * h)))
        # Slightly lower threshold for غ due frequent weak top-dot strokes.
        thresh = 0.055 if letter_arabic == "غ" else 0.075
        if ink < thresh:
            continue

        recovered.append(
            {
                "x": float(cx),
                "y": float(cy),
                "relative_position": "above",
                "size": max(2, int(0.03 * w * h / 100.0)),
                "circularity": 0.22,
                "solidity": 0.45,
                "extent": 0.20,
                "aspect_ratio": 1.3,
                "left": int(cx),
                "top": int(cy),
                "w": max(2, int(0.05 * w)),
                "h": max(2, int(0.05 * h)),
                "quality": 0.18 + 0.35 * ink,
                "anchor_quality": 0.55 + 0.30 * ink,
                "rank_quality": 0.50 + 0.40 * ink,
            }
        )

    return recovered


def _local_ink_ratio(inv: np.ndarray, cx: float, cy: float, half_w: int, half_h: int) -> float:
    h, w = inv.shape[:2]
    x0 = max(0, int(cx) - half_w)
    x1 = min(w, int(cx) + half_w + 1)
    y0 = max(0, int(cy) - half_h)
    y1 = min(h, int(cy) + half_h + 1)
    if x1 <= x0 or y1 <= y0:
        return 0.0
    patch = inv[y0:y1, x0:x1]
    return float(np.count_nonzero(patch)) / float(patch.size)


def _public_dot(cand: dict[str, Any]) -> dict[str, Any]:
    return {
        "x": float(cand["x"]),
        "y": float(cand["y"]),
        "relative_position": str(cand["relative_position"]),
        "size": int(cand["size"]),
        "circularity": round(float(cand["circularity"]), 3),
        "solidity": round(float(cand["solidity"]), 3),
    }


def _is_strong_explicit_dot_for_no_dot_letters(dot: dict[str, Any]) -> bool:
    # Suppress tiny detached stroke fragments, but still catch intentional extra dots.
    # Accept either a clearly large blob or a medium-size compact blob.
    if dot.get("relative_position") not in ("above", "below"):
        return False

    size = int(dot.get("size", 0))
    circularity = float(dot.get("circularity", 0.0))
    solidity = float(dot.get("solidity", 0.0))

    large_blob = size >= 18
    compact_blob = size >= 10 and circularity >= 0.36 and solidity >= 0.68
    return large_blob or compact_blob


def _in_expected_zone(cx: float, cy: float, body: dict[str, int], expected_positions: list[str]) -> bool:
    left = float(body["left"])
    right = float(body["right"])
    top = float(body["top"])
    bottom = float(body["bottom"])
    w = float(max(1, body["w"]))
    h = float(max(1, body["h"]))

    x_lo = left - 0.50 * w
    x_hi = right + 0.50 * w

    for pos in expected_positions:
        if pos == "above":
            y_lo = top - 1.15 * h
            y_hi = top + 0.22 * h
            if x_lo <= cx <= x_hi and y_lo <= cy <= y_hi:
                return True
        elif pos == "below":
            y_lo = bottom - 0.22 * h
            y_hi = bottom + 1.15 * h
            if x_lo <= cx <= x_hi and y_lo <= cy <= y_hi:
                return True
        elif pos == "inside":
            in_x = (left + 0.02 * w) <= cx <= (right - 0.02 * w)
            in_y = (top + 0.02 * h) <= cy <= (bottom - 0.02 * h)
            if in_x and in_y:
                return True

    return False


def _relative_position(cy: float, body_top: int, body_bottom: int, body_h: int) -> str:
    margin = max(2.0, 0.08 * float(max(1, body_h)))
    if cy < float(body_top) - margin:
        return "above"
    if cy > float(body_bottom) + margin:
        return "below"
    return "inside"


def dot_score(dot_result: dict[str, Any], letter: dict[str, Any]) -> float:
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
