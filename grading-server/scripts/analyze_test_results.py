#!/usr/bin/env python3
import argparse
import csv
from collections import defaultdict
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analyze test_train_set.py CSV output with per-label and failure breakdowns."
    )
    parser.add_argument("csv_path", type=Path, help="Path to results CSV.")
    parser.add_argument(
        "--shape-threshold",
        type=float,
        default=0.65,
        help="Template score threshold below which shape is considered weak.",
    )
    parser.add_argument(
        "--dot-threshold",
        type=float,
        default=1.0,
        help="Dot score threshold below which dot quality is considered weak.",
    )
    parser.add_argument(
        "--sort-by",
        choices=["label", "acceptance", "count"],
        default="acceptance",
        help="How to sort per-label rows.",
    )
    return parser.parse_args()


def to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except Exception:
        return default


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


def to_bool(value: Any) -> bool:
    return str(value).strip().lower() in ("true", "1", "yes")


def classify_failure(dot_score: float, template_score: float, dot_t: float, shape_t: float) -> str:
    dot_bad = dot_score < dot_t
    shape_bad = template_score < shape_t
    if dot_bad and shape_bad:
        return "both"
    if dot_bad:
        return "dot"
    if shape_bad:
        return "shape"
    return "other"


def main() -> int:
    args = parse_args()
    csv_path = args.csv_path.resolve()
    if not csv_path.exists():
        print(f"ERROR: CSV not found: {csv_path}")
        return 1

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    ok_rows = [r for r in rows if r.get("status") == "ok"]
    if not ok_rows:
        print("No 'ok' rows found in CSV.")
        return 1

    global_failures = defaultdict(int)
    global_verdicts = defaultdict(int)
    per_label: dict[int, dict[str, Any]] = {}

    for row in ok_rows:
        label = to_int(row.get("label"))
        correct = to_bool(row.get("correct"))
        verdict = str(row.get("score", "")).strip().lower()
        final_score = to_float(row.get("final_score"))
        dot_score = to_float(row.get("dot_score"))
        template_score = to_float(row.get("template_score"))

        bucket = per_label.setdefault(
            label,
            {
                "count": 0,
                "correct": 0,
                "sum_final": 0.0,
                "sum_dot": 0.0,
                "sum_template": 0.0,
                "failures": defaultdict(int),
            },
        )
        bucket["count"] += 1
        bucket["correct"] += 1 if correct else 0
        bucket["sum_final"] += final_score
        bucket["sum_dot"] += dot_score
        bucket["sum_template"] += template_score

        global_verdicts[verdict] += 1
        if not correct:
            reason = classify_failure(dot_score, template_score, args.dot_threshold, args.shape_threshold)
            bucket["failures"][reason] += 1
            global_failures[reason] += 1

    total = len(ok_rows)
    total_correct = sum(1 for r in ok_rows if to_bool(r.get("correct")))
    acc = (total_correct / total * 100.0) if total else 0.0
    avg_final = sum(to_float(r.get("final_score")) for r in ok_rows) / total
    avg_dot = sum(to_float(r.get("dot_score")) for r in ok_rows) / total
    avg_template = sum(to_float(r.get("template_score")) for r in ok_rows) / total

    print("\n=== Test Results Analysis ===")
    print(f"CSV:               {csv_path}")
    print(f"Rows (ok):         {total}")
    print(f"Acceptance rate:   {acc:.2f}% ({total_correct}/{total})")
    print(f"Avg final score:   {avg_final:.4f}")
    print(f"Avg dot score:     {avg_dot:.4f}")
    print(f"Avg template score:{avg_template:.4f}")
    print(f"Thresholds:        dot<{args.dot_threshold:.2f}, shape<{args.shape_threshold:.2f}")

    if global_verdicts:
        print("Verdicts:")
        for k in sorted(global_verdicts):
            print(f"  {k:10s} {global_verdicts[k]}")

    failed_n = total - total_correct
    if failed_n > 0:
        print("Failure reasons:")
        for reason in ("dot", "shape", "both", "other"):
            n = global_failures[reason]
            pct = (n / failed_n * 100.0) if failed_n else 0.0
            print(f"  {reason:5s} {n:5d} ({pct:6.2f}%)")

    table = []
    for label, data in per_label.items():
        count = data["count"]
        c = data["correct"]
        accept = (c / count * 100.0) if count else 0.0
        table.append(
            {
                "label": label,
                "count": count,
                "accept": accept,
                "avg_final": data["sum_final"] / count,
                "avg_dot": data["sum_dot"] / count,
                "avg_template": data["sum_template"] / count,
                "dot_fail": data["failures"]["dot"],
                "shape_fail": data["failures"]["shape"],
                "both_fail": data["failures"]["both"],
                "other_fail": data["failures"]["other"],
            }
        )

    if args.sort_by == "label":
        table.sort(key=lambda x: x["label"])
    elif args.sort_by == "count":
        table.sort(key=lambda x: (-x["count"], x["label"]))
    else:
        table.sort(key=lambda x: (x["accept"], x["label"]))

    print("\nPer-label breakdown:")
    print(
        "label count accept% avg_final avg_dot avg_shape fail_dot fail_shape fail_both fail_other"
    )
    for r in table:
        print(
            f"{r['label']:>5d} {r['count']:>5d} {r['accept']:>7.2f} "
            f"{r['avg_final']:>9.4f} {r['avg_dot']:>7.4f} {r['avg_template']:>9.4f} "
            f"{r['dot_fail']:>8d} {r['shape_fail']:>10d} {r['both_fail']:>9d} {r['other_fail']:>10d}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
