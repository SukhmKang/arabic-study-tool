from typing import Any


def compute_score(ds: float, template: dict[str, Any]) -> dict[str, Any]:
    """
    Two signals only and no classifier.
    Weights are initial estimates and can be tuned with real data.
    """
    dot_weight = 0.55
    shape_weight = 0.45

    final = (ds * dot_weight) + (template["similarity_score"] * shape_weight)

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
