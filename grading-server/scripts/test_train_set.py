#!/usr/bin/env python3
import argparse
import base64
import csv
import os
import re
import time
from pathlib import Path
from typing import Any

import httpx


FILENAME_RE = re.compile(r"^id_(?P<id>\d+)_label_(?P<label>\d+)\.png$")


def parse_args() -> argparse.Namespace:
    script_dir = Path(__file__).resolve().parent
    default_train = script_dir.parents[1] / "train"

    parser = argparse.ArgumentParser(
        description="Batch test handwriting grading server against train/id_<n>_label_<label>.png files."
    )
    parser.add_argument("--server-url", default="http://127.0.0.1:8000", help="Base URL for grading server.")
    parser.add_argument("--train-dir", type=Path, default=default_train, help="Directory containing train PNGs.")
    parser.add_argument(
        "--label-offset",
        type=int,
        default=0,
        help="Applied as letter_pos = label + offset. Use 0 if labels are already 1..28.",
    )
    parser.add_argument(
        "--api-key",
        default=os.getenv("ANTHROPIC_API_KEY", ""),
        help="Anthropic API key passed through to /grade. Defaults to ANTHROPIC_API_KEY env var.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max files to test (0 = all matching files).",
    )
    parser.add_argument(
        "--output-csv",
        type=Path,
        default=None,
        help="Optional path to write per-file results CSV.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=float,
        default=30.0,
        help="HTTP timeout per request.",
    )
    return parser.parse_args()


def discover_files(train_dir: Path) -> list[tuple[Path, int, int]]:
    matches: list[tuple[Path, int, int]] = []
    for path in sorted(train_dir.glob("*.png")):
        m = FILENAME_RE.match(path.name)
        if not m:
            continue
        sample_id = int(m.group("id"))
        label = int(m.group("label"))
        matches.append((path, sample_id, label))
    return matches


def encode_base64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def safe_num(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def main() -> int:
    args = parse_args()
    train_dir = args.train_dir.resolve()

    if not train_dir.exists():
        print(f"ERROR: train directory not found: {train_dir}")
        return 1

    files = discover_files(train_dir)
    if args.limit > 0:
        files = files[: args.limit]

    if not files:
        print(f"No matching files found in {train_dir}")
        return 1

    grade_url = f"{args.server_url.rstrip('/')}/grade"

    total = 0
    http_errors = 0
    bad_label = 0
    correct = 0
    sum_final_score = 0.0
    verdict_counts: dict[str, int] = {}
    rows: list[dict[str, Any]] = []

    started = time.time()
    with httpx.Client(timeout=args.timeout_seconds) as client:
        for img_path, sample_id, label in files:
            total += 1
            letter_pos = label + args.label_offset

            if letter_pos < 1 or letter_pos > 28:
                bad_label += 1
                rows.append(
                    {
                        "id": sample_id,
                        "label": label,
                        "letter_pos": letter_pos,
                        "status": "skipped_bad_label",
                        "correct": "",
                        "score": "",
                        "final_score": "",
                        "dot_count": "",
                        "dot_score": "",
                        "template_score": "",
                        "baseline_angle": "",
                        "detail": "letter_pos out of 1..28",
                        "path": str(img_path),
                    }
                )
                continue

            payload = {
                "image": encode_base64(img_path),
                "media_type": "image/png",
                "letter_pos": letter_pos,
                "api_key": args.api_key,
            }

            try:
                res = client.post(grade_url, json=payload)
                body = res.json()
            except Exception as exc:
                http_errors += 1
                rows.append(
                    {
                        "id": sample_id,
                        "label": label,
                        "letter_pos": letter_pos,
                        "status": "http_error",
                        "correct": "",
                        "score": "",
                        "final_score": "",
                        "dot_count": "",
                        "dot_score": "",
                        "template_score": "",
                        "baseline_angle": "",
                        "detail": str(exc),
                        "path": str(img_path),
                    }
                )
                continue

            if res.status_code != 200:
                http_errors += 1
                rows.append(
                    {
                        "id": sample_id,
                        "label": label,
                        "letter_pos": letter_pos,
                        "status": "server_error",
                        "correct": "",
                        "score": "",
                        "final_score": "",
                        "dot_count": "",
                        "dot_score": "",
                        "template_score": "",
                        "baseline_angle": "",
                        "detail": body.get("detail", f"HTTP {res.status_code}"),
                        "path": str(img_path),
                    }
                )
                continue

            is_correct = bool(body.get("correct", False))
            verdict = str(body.get("score", "unknown"))
            dbg = body.get("debug", {}) or {}

            if is_correct:
                correct += 1
            verdict_counts[verdict] = verdict_counts.get(verdict, 0) + 1
            sum_final_score += safe_num(dbg.get("final_score"))

            rows.append(
                {
                    "id": sample_id,
                    "label": label,
                    "letter_pos": letter_pos,
                    "status": "ok",
                    "correct": is_correct,
                    "score": verdict,
                    "final_score": safe_num(dbg.get("final_score")),
                    "dot_count": dbg.get("dot_count", ""),
                    "dot_score": safe_num(dbg.get("dot_score")),
                    "template_score": safe_num(dbg.get("template_score")),
                    "baseline_angle": safe_num(dbg.get("baseline_angle")),
                    "detail": "",
                    "path": str(img_path),
                }
            )

    elapsed = time.time() - started
    ok_rows = [r for r in rows if r["status"] == "ok"]
    ok_n = len(ok_rows)
    accuracy = (correct / ok_n * 100.0) if ok_n else 0.0
    avg_final = (sum_final_score / ok_n) if ok_n else 0.0

    print("\n=== Handwriting Server Batch Test ===")
    print(f"Train dir:      {train_dir}")
    print(f"Server URL:     {args.server_url}")
    print(f"Files seen:     {total}")
    print(f"OK responses:   {ok_n}")
    print(f"HTTP errors:    {http_errors}")
    print(f"Bad labels:     {bad_label}")
    print(f"Accuracy:       {accuracy:.2f}% ({correct}/{ok_n})")
    print(f"Avg final score:{avg_final:.4f}")
    print(f"Elapsed:        {elapsed:.2f}s")

    if verdict_counts:
        print("Verdicts:")
        for verdict in sorted(verdict_counts):
            print(f"  {verdict:10s} {verdict_counts[verdict]}")

    if args.output_csv:
        args.output_csv.parent.mkdir(parents=True, exist_ok=True)
        fieldnames = [
            "id",
            "label",
            "letter_pos",
            "status",
            "correct",
            "score",
            "final_score",
            "dot_count",
            "dot_score",
            "template_score",
            "baseline_angle",
            "detail",
            "path",
        ]
        with args.output_csv.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        print(f"CSV written:    {args.output_csv.resolve()}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
