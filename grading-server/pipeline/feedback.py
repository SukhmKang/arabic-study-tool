import base64
import json
import re
from typing import Any

import httpx

from pipeline.dots import EXPECTED_DOTS

ENDPOINT = "https://api.anthropic.com/v1/messages"
OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses"

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

RAW_GRADE_PROMPT = """You are grading a handwritten Arabic letter attempt against a known target letter.

Return ONLY valid JSON with this exact schema:
{
  "correct": boolean,
  "score": "excellent" | "good" | "close" | "incorrect",
  "feedback": string
}

Rules:
- Judge only whether the drawing matches the target letter.
- "correct" should be true only for score excellent or good.
- feedback must be 1-3 short sentences, plain English, beginner-friendly.
- Do not include markdown or any text outside JSON.
- Be tolerant of natural handwriting variation (slant, curvature, stroke style).
- If letter identity is clearly correct, prefer "good" over "close".
- Do not downgrade to "close" for minor stylistic differences alone."""


def build_evidence(
    dot_result: dict[str, Any], ds: float, template: dict[str, Any], score: dict[str, Any], letter: dict[str, Any]
) -> dict[str, Any]:
    expected = EXPECTED_DOTS.get(letter["arabic"], {"count": 0, "positions": []})
    expected_count = int(expected.get("count", 0))
    expected_positions = list(expected.get("positions", []))

    detected_count = int(dot_result.get("dot_count", 0))
    detected_positions = [str(d.get("relative_position", "")) for d in dot_result.get("dots", [])]
    unique_detected = sorted({p for p in detected_positions if p})

    dot_count_match = detected_count == expected_count
    dot_position_match = all(p in unique_detected for p in expected_positions) if expected_count > 0 else True

    if ds == 1.0:
        dot_status = "correct"
    elif ds == 0.5:
        dot_status = "count_ok_position_off"
    else:
        dot_status = "incorrect"

    similarity = float(template.get("similarity_score", 0.0))
    if similarity >= 0.85:
        shape_band = "strong"
    elif similarity >= 0.70:
        shape_band = "fair"
    else:
        shape_band = "weak"

    baseline_angle = float(template.get("baseline_angle", 0.0))
    abs_angle = abs(baseline_angle)
    if abs_angle <= 15:
        slant_band = "stable"
    elif abs_angle <= 30:
        slant_band = "tilted"
    else:
        slant_band = "steep"

    if ds < 1.0:
        primary_issue = "dots"
    elif shape_band == "weak":
        primary_issue = "shape"
    elif slant_band == "steep":
        primary_issue = "slant"
    else:
        primary_issue = "minor_refinement"

    return {
        "target_letter": {
            "arabic": letter["arabic"],
            "name": letter["name"],
            "roman": letter["roman"],
            "pos": letter["pos"],
        },
        "dot_analysis": {
            "expected_count": expected_count,
            "expected_positions": expected_positions,
            "detected_count": detected_count,
            "detected_positions": unique_detected,
            "count_match": dot_count_match,
            "position_match": dot_position_match,
            "dot_score": float(ds),
            "status": dot_status,
        },
        "shape_analysis": {
            "template_score": similarity,
            "shape_band": shape_band,
            "baseline_angle": baseline_angle,
            "slant_band": slant_band,
        },
        "overall": {
            "final_score": float(score.get("final_score", 0.0)),
            "verdict": str(score.get("verdict", "incorrect")),
            "correct": bool(score.get("correct", False)),
            "primary_issue": primary_issue,
        },
    }


def generate_template_feedback(evidence: dict[str, Any]) -> str:
    overall = evidence["overall"]
    dots = evidence["dot_analysis"]
    shape = evidence["shape_analysis"]

    verdict = overall["verdict"]
    primary_issue = overall["primary_issue"]
    target = evidence["target_letter"]["arabic"]

    if verdict in ("excellent", "good"):
        if shape["slant_band"] != "stable":
            return (
                f"Nice work on {target}; the overall form is clear and readable. "
                f"Try leveling the baseline slightly to make the letter look more balanced."
            )
        return (
            f"Nice work on {target}; your shape and dot placement are on target. "
            f"For an even cleaner result, keep the main stroke a bit more consistent in thickness."
        )

    if primary_issue == "dots":
        expected_count = dots["expected_count"]
        detected_count = dots["detected_count"]
        expected_positions = dots["expected_positions"] or ["none"]
        pos_text = ", ".join(expected_positions)
        return (
            f"Your overall shape is heading in the right direction for {target}. "
            f"The main issue is dots: expected {expected_count} ({pos_text}) but detected {detected_count}."
        )

    if primary_issue == "shape":
        return (
            f"Good effort on {target}; your dots are closer than the main stroke shape right now. "
            f"Focus on matching the reference curve and proportions of the body."
        )

    if primary_issue == "slant":
        return (
            f"Your letter form is close for {target}. "
            f"The biggest improvement is reducing slant so the baseline stays steadier."
        )

    return (
        f"Good effort on {target}; this attempt is close. "
        f"Focus on small refinements in stroke smoothness and spacing."
    )


def _build_report(
    dot_result: dict[str, Any],
    ds: float,
    template: dict[str, Any],
    score: dict[str, Any],
    letter: dict[str, Any],
    evidence: dict[str, Any],
) -> str:
    expected = EXPECTED_DOTS.get(letter["arabic"], {})
    positions = ", ".join(expected.get("positions", [])) or "none"
    return (
        f"Target letter: {letter['arabic']} ({letter['name']}, \"{letter['roman']}\")\n\n"
        f"Dot analysis:\n"
        f"- Expected: {expected.get('count', 0)} dot(s) {positions}\n"
        f"- Detected: {dot_result['dot_count']} dot(s)\n"
        f"- Dot score: {'correct' if ds == 1.0 else 'count right, position wrong' if ds == 0.5 else 'incorrect'}\n\n"
        f"Shape analysis:\n"
        f"- Template similarity: {template['similarity_score']:.0%}\n"
        f"- Baseline angle: {template['baseline_angle']:.1f}°\n\n"
        f"Overall: {score['final_score']:.0%} - {score['verdict']}\n"
        f"Primary issue: {evidence['overall']['primary_issue']}"
    ).strip()


async def generate_feedback(
    image_bytes: bytes,
    media_type: str,
    reference_png: bytes,
    dot_result: dict[str, Any],
    ds: float,
    template: dict[str, Any],
    score: dict[str, Any],
    letter: dict[str, Any],
    api_key: str | None,
) -> tuple[str, dict[str, Any], str]:
    evidence = build_evidence(dot_result, ds, template, score, letter)
    deterministic_feedback = generate_template_feedback(evidence)

    if not api_key:
        return deterministic_feedback, evidence, "deterministic"

    report = _build_report(dot_result, ds, template, score, letter, evidence)

    content: list[dict[str, Any]] = [
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(image_bytes).decode(),
            },
        }
    ]

    if reference_png:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(reference_png).decode(),
                },
            }
        )

    content.append({"type": "text", "text": report})

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
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
            response.raise_for_status()
            llm_feedback = response.json()["content"][0]["text"].strip()
            return llm_feedback, evidence, "llm"
    except Exception:
        return deterministic_feedback, evidence, "deterministic_fallback"


def _extract_json_object(text: str) -> dict[str, Any]:
    # Try direct parse first.
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    # Fallback: extract first {...} block.
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("No JSON object in model output")
    parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("Model output JSON is not an object")
    return parsed


async def generate_grade_raw(
    image_bytes: bytes,
    media_type: str,
    letter: dict[str, Any],
    api_key: str,
    provider: str = "openai",
    model: str = "gpt-5-mini",
    deterministic_dot_count: int | None = None,
    expected_dot_count: int | None = None,
) -> dict[str, Any]:
    target_text = (
        f"Target letter: {letter['arabic']} ({letter['name']}, \"{letter['roman']}\", pos {letter['pos']}). "
        "Grade this handwriting attempt for that target letter only."
    )
    if deterministic_dot_count is not None:
        target_text += f"\nDeterministic dot detector count: {deterministic_dot_count}."
    if expected_dot_count is not None:
        target_text += f"\nExpected dot count for target letter: {expected_dot_count}."
    if deterministic_dot_count is not None and expected_dot_count is not None:
        target_text += (
            "\nRule: if your visual dot impression conflicts with deterministic_dot_count, "
            "trust deterministic_dot_count for dot-count judgment."
        )
    if letter.get("arabic") == "ح":
        target_text += (
            "\n\nLetter-specific rubric for ح:"
            "\n- ح has NO dots."
            "\n- The main body should be one connected bowl/stroke shape."
            "\n- Allow natural handwriting variation in slant and curvature."
            "\n- Do not over-penalize style differences if identity as ح is clear."
            "\n- HARD RULE: if the attempt is clearly ح and has no dots, do NOT return 'close' due only to style/slant."
            "\n- Output score='good' when identity is clearly ح (no dots, coherent connected bowl),"
            " even if slant/curvature differ from a textbook form."
            "\n- Output score='close' when it resembles ح but identity is still somewhat ambiguous"
            " (e.g., disconnected/unclear body, shape confusion with other letters, or uncertain structure)."
        )

    if provider == "openai":
        raw_text = await _generate_grade_raw_openai(
            image_bytes=image_bytes,
            media_type=media_type,
            api_key=api_key,
            model=model,
            target_text=target_text,
        )
    else:
        raw_text = await _generate_grade_raw_anthropic(
            image_bytes=image_bytes,
            media_type=media_type,
            api_key=api_key,
            model=model,
            target_text=target_text,
        )

    parsed = _extract_json_object(raw_text)
    score = str(parsed.get("score", "incorrect")).lower()
    if score not in ("excellent", "good", "close", "incorrect"):
        score = "incorrect"
    correct = bool(parsed.get("correct", score in ("excellent", "good")))
    if score in ("excellent", "good") and not correct:
        correct = True
    if score in ("close", "incorrect") and correct:
        correct = False

    feedback = str(parsed.get("feedback", "")).strip()
    if not feedback:
        feedback = "Good effort. Keep practicing the letter shape and dot placement."

    return {
        "correct": correct,
        "score": score,
        "feedback": feedback,
        "raw_model_output": raw_text,
    }


async def _generate_grade_raw_anthropic(
    image_bytes: bytes,
    media_type: str,
    api_key: str,
    model: str,
    target_text: str,
) -> str:
    content: list[dict[str, Any]] = [
        {"type": "text", "text": target_text},
        {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": base64.b64encode(image_bytes).decode(),
            },
        },
    ]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            ENDPOINT,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": model,
                "max_tokens": 220,
                "system": RAW_GRADE_PROMPT,
                "messages": [{"role": "user", "content": content}],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        return response.json()["content"][0]["text"].strip()


async def _generate_grade_raw_openai(
    image_bytes: bytes,
    media_type: str,
    api_key: str,
    model: str,
    target_text: str,
) -> str:
    image_data_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode()}"
    payload = {
        "model": model,
        "instructions": RAW_GRADE_PROMPT,
        "input": [
            {
                "role": "user",
                "content": [
                    {"type": "input_text", "text": target_text},
                    {"type": "input_image", "image_url": image_data_url},
                ],
            }
        ],
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            OPENAI_RESPONSES_ENDPOINT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "content-type": "application/json",
            },
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        body = response.json()

    output_text = body.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    for item in body.get("output", []):
        for part in item.get("content", []):
            text_val = part.get("text")
            if isinstance(text_val, str) and text_val.strip():
                return text_val.strip()

    raise ValueError("OpenAI response did not contain text output")
