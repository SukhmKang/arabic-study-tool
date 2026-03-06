#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Union

from PIL import Image

# Allow running as: python scripts/eval_connected_components.py
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pipeline.dots import EXPECTED_DOTS


FILENAME_RE = re.compile(r"^id_(?P<id>\d+)_label_(?P<label>\d+)\.png$")


@dataclass(frozen=True)
class CCOptions:
    # Pixels with brightness >= background_threshold are background.
    background_threshold: int = 245
    # True = 8-neighbor, False = 4-neighbor connectivity.
    eight_connectivity: bool = True
    # Ignore tiny components below this size.
    min_component_size: int = 1
    # If True, treat bright pixels as ink (for white-on-black images).
    invert: bool = False


def count_connected_components_png(
    png: Union[bytes, bytearray, BinaryIO, str, Path],
    opts: CCOptions = CCOptions(),
) -> int:
    img = Image.open(png).convert("L")
    w, h = img.size
    pix = img.load()

    if opts.invert:
        ink = [[pix[x, y] >= opts.background_threshold for x in range(w)] for y in range(h)]
    else:
        ink = [[pix[x, y] < opts.background_threshold for x in range(w)] for y in range(h)]
    visited = [[False] * w for _ in range(h)]

    if opts.eight_connectivity:
        neighbors = [
            (-1, -1),
            (0, -1),
            (1, -1),
            (-1, 0),
            (1, 0),
            (-1, 1),
            (0, 1),
            (1, 1),
        ]
    else:
        neighbors = [(0, -1), (-1, 0), (1, 0), (0, 1)]

    components = 0
    for y in range(h):
        for x in range(w):
            if not ink[y][x] or visited[y][x]:
                continue

            q = deque([(x, y)])
            visited[y][x] = True
            size = 0

            while q:
                cx, cy = q.popleft()
                size += 1
                for dx, dy in neighbors:
                    nx, ny = cx + dx, cy + dy
                    if nx < 0 or nx >= w or ny < 0 or ny >= h:
                        continue
                    if visited[ny][nx] or not ink[ny][nx]:
                        continue
                    visited[ny][nx] = True
                    q.append((nx, ny))

            if size >= opts.min_component_size:
                components += 1

    return components


def parse_args() -> argparse.Namespace:
    default_train = PROJECT_ROOT.parent / "train"
    default_letters = PROJECT_ROOT / "data" / "letters.json"

    p = argparse.ArgumentParser(
        description=(
            "Evaluate connected-component counting on train/id_<n>_label_<label>.png "
            "against expected component counts (body + expected dots)."
        )
    )
    p.add_argument("--train-dir", type=Path, default=default_train, help="Directory with train PNG files.")
    p.add_argument(
        "--letters-json",
        type=Path,
        default=default_letters,
        help="Path to letters.json containing pos->arabic mapping.",
    )
    p.add_argument(
        "--label-offset",
        type=int,
        default=0,
        help="Applied as letter_pos = label + offset. Use 0 when labels already match pos 1..28.",
    )
    p.add_argument("--limit", type=int, default=0, help="Max number of PNGs to test (0=all).")
    p.add_argument("--background-threshold", type=int, default=245, help="Grayscale threshold for background.")
    p.add_argument(
        "--four-connectivity",
        action="store_true",
        help="Use 4-connectivity instead of default 8-connectivity.",
    )
    p.add_argument("--min-component-size", type=int, default=1, help="Ignore components smaller than this size.")
    p.add_argument(
        "--invert",
        action="store_true",
        help="Treat bright pixels as ink (for white-on-black images).",
    )
    p.add_argument("--output-csv", type=Path, default=None, help="Optional output CSV path.")
    return p.parse_args()


def discover_files(train_dir: Path) -> list[tuple[Path, int, int]]:
    out: list[tuple[Path, int, int]] = []
    for path in sorted(train_dir.glob("*.png")):
        m = FILENAME_RE.match(path.name)
        if not m:
            continue
        out.append((path, int(m.group("id")), int(m.group("label"))))
    return out


def load_letters_by_pos(path: Path) -> dict[int, dict]:
    with path.open("r", encoding="utf-8") as f:
        letters = json.load(f)
    return {int(item["pos"]): item for item in letters}


def expected_components_for_letter(letter: dict) -> int:
    arabic = str(letter.get("arabic", ""))
    expected_dot_count = int(EXPECTED_DOTS.get(arabic, {}).get("count", 0))
    # Baseline assumption for isolated letters: one body component + dot components.
    return 1 + expected_dot_count


def main() -> int:
    args = parse_args()
    train_dir = args.train_dir.resolve()
    letters_json = args.letters_json.resolve()

    if not train_dir.exists():
        print(f"ERROR: train directory not found: {train_dir}")
        return 1
    if not letters_json.exists():
        print(f"ERROR: letters.json not found: {letters_json}")
        return 1

    letters_by_pos = load_letters_by_pos(letters_json)
    files = discover_files(train_dir)
    if args.limit > 0:
        files = files[: args.limit]
    if not files:
        print(f"No matching PNG files found in: {train_dir}")
        return 1

    opts = CCOptions(
        background_threshold=args.background_threshold,
        eight_connectivity=not args.four_connectivity,
        min_component_size=args.min_component_size,
        invert=args.invert,
    )

    total = 0
    evaluated = 0
    skipped_bad_label = 0
    exact_match = 0
    abs_error_sum = 0.0
    rows: list[dict] = []
    per_label: dict[int, dict[str, float]] = {}

    for path, sample_id, label in files:
        total += 1
        letter_pos = label + args.label_offset
        letter = letters_by_pos.get(letter_pos)
        if not letter:
            skipped_bad_label += 1
            rows.append(
                {
                    "id": sample_id,
                    "label": label,
                    "letter_pos": letter_pos,
                    "status": "skipped_bad_label",
                    "expected_components": "",
                    "observed_components": "",
                    "abs_error": "",
                    "path": str(path),
                }
            )
            continue

        expected = expected_components_for_letter(letter)
        observed = count_connected_components_png(path, opts=opts)
        err = abs(observed - expected)
        ok = observed == expected

        evaluated += 1
        exact_match += 1 if ok else 0
        abs_error_sum += float(err)

        bucket = per_label.setdefault(
            letter_pos,
            {
                "count": 0.0,
                "ok": 0.0,
                "abs_err_sum": 0.0,
            },
        )
        bucket["count"] += 1.0
        bucket["ok"] += 1.0 if ok else 0.0
        bucket["abs_err_sum"] += float(err)

        rows.append(
            {
                "id": sample_id,
                "label": label,
                "letter_pos": letter_pos,
                "status": "ok",
                "expected_components": expected,
                "observed_components": observed,
                "abs_error": err,
                "path": str(path),
            }
        )

    match_rate = (exact_match / evaluated * 100.0) if evaluated else 0.0
    mae = (abs_error_sum / evaluated) if evaluated else 0.0

    print("\n=== Connected Components Evaluation ===")
    print(f"Train dir:         {train_dir}")
    print(f"letters.json:      {letters_json}")
    print(f"Files seen:        {total}")
    print(f"Evaluated:         {evaluated}")
    print(f"Skipped bad label: {skipped_bad_label}")
    print(f"Exact match rate:  {match_rate:.2f}% ({exact_match}/{evaluated})")
    print(f"Mean abs error:    {mae:.4f}")
    print(
        "Options:           "
        f"threshold={opts.background_threshold}, "
        f"connectivity={'8' if opts.eight_connectivity else '4'}, "
        f"min_component_size={opts.min_component_size}, "
        f"invert={opts.invert}"
    )

    if per_label:
        print("\nPer-label breakdown:")
        print("pos count exact% mean_abs_err")
        for pos in sorted(per_label):
            stats = per_label[pos]
            count = int(stats["count"])
            exact_pct = (stats["ok"] / stats["count"] * 100.0) if stats["count"] else 0.0
            label_mae = (stats["abs_err_sum"] / stats["count"]) if stats["count"] else 0.0
            print(f"{pos:>3d} {count:>5d} {exact_pct:>6.2f} {label_mae:>12.4f}")

    if args.output_csv:
        args.output_csv.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "id",
            "label",
            "letter_pos",
            "status",
            "expected_components",
            "observed_components",
            "abs_error",
            "path",
        ]
        with args.output_csv.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"\nCSV written:       {args.output_csv.resolve()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
