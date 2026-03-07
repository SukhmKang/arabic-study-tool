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
    reference_image_bytes: bytes | None = None,
) -> dict[str, Any]:
    target_text = (
        f"Target letter: {letter['arabic']} ({letter['name']}, \"{letter['roman']}\", pos {letter['pos']}). "
        "Grade this handwriting attempt for that target letter only."
    )
    if deterministic_dot_count is not None:
        target_text += (
            f"\nExtra connected-component count (blobs beyond the main stroke): {deterministic_dot_count}."
            "\nNote: this detector counts separate ink blobs beyond the main letter body, NOT only dots."
            " It will flag hamza marks, diacritics, or any small stroke drawn as a separate component."
            " Do NOT treat a non-zero count as evidence of a wrongly-drawn dot unless the visual clearly shows one."
        )
    if expected_dot_count is not None:
        target_text += f"\nExpected true dot count for target letter: {expected_dot_count}."
    if deterministic_dot_count is not None and expected_dot_count is not None:
        target_text += (
            "\nRule: use the connected-component count only as a weak signal."
            " If the visual image shows the correct letter form (even with a hamza or small mark that is part of the letter),"
            " do not penalize based on the component count alone."
        )
    if letter.get("arabic") == "أ":
        target_text += (
            "\n\nLetter-specific rubric for أ:"
            "\n- أ is an alif (vertical stroke) with a hamza (ء) written above it."
            "\n- The hamza is a small curved mark — it is part of the correct letter form, NOT an extra dot."
            "\n- The connected-component detector will report count=1 for the hamza. This is expected and correct."
            "\n- HARD RULE: do NOT penalize for a detected component count of 1; that is the hamza, not a dot error."
            "\n- Grade purely on whether the attempt shows a clear vertical alif stroke with a small hamza mark above."
            "\n- Output score='good' or 'excellent' when the alif shape is clear and a hamza-like mark is present above."
            "\n- Output score='close' only if the stroke shape is ambiguous or the hamza is missing entirely."
        )

    if letter.get("arabic") == "ح":
        target_text += (
            "\n\nLetter-specific rubric for ح:"
            "\n- ح has NO dots and is one connected stroke."
            "\n- HARD RULE: if there are no extra ink components beyond the main stroke (detector count = 0)"
            " and the attempt is a single connected shape, score it 'good'. Full stop."
            "\n- Do not penalize for zigzag shape, poor bowl curvature, slant, or stylistic variation."
            "\n- The only reasons to go below 'good' are: extra dots present, or the stroke is clearly"
            " a completely different letter (e.g. looks like ج or خ with a dot)."
            "\n- Beginner handwriting of ح often looks like a rough Z, hook, or squiggle — that is fine. Mark it good."
        )

    if letter.get("arabic") == "م":
        target_text += (
            "\n\nLetter-specific rubric for م:"
            "\n- م has NO dots and is one connected stroke with a small loop or bowl."
            "\n- Be lenient: only mark below 'good' if the attempt is clearly a different letter entirely."
            "\n- Do not penalize for imperfect loop shape, unclear tail, slant, or stylistic variation."
            "\n- If it looks even roughly like م — a looping or circular shape — that is good enough."
            "\n- Beginner handwriting of م varies a lot in style; give benefit of the doubt."
        )

    if letter.get("arabic") == "ذ":
        target_text += (
            "\n\nLetter-specific rubric for ذ:"
            "\n- ذ is a daal (د) shape with 1 dot above. The dot is what distinguishes it from daal."
            "\n- HARD RULE: if the component detector finds 1 extra blob and it is positioned above the main stroke, score 'good'."
            "\n- Be lenient on the shape of the main stroke — daal/thaal strokes vary a lot in beginner handwriting."
            "\n- Only go below 'good' if the dot is clearly missing, or the attempt is clearly a completely different letter."
        )

    if letter.get("arabic") == "ز":
        target_text += (
            "\n\nLetter-specific rubric for ز:"
            "\n- ز is a raa (ر) shape with 1 dot above. The dot is what distinguishes it from raa."
            "\n- HARD RULE: if the component detector finds 1 extra blob and it is positioned above the main stroke, score 'good'."
            "\n- Be lenient on the shape of the main stroke — raa/zay strokes vary a lot in beginner handwriting."
            "\n- Only go below 'good' if the dot is clearly missing, or the attempt is clearly a completely different letter."
        )

    if provider == "openai":
        raw_text = await _generate_grade_raw_openai(
            image_bytes=image_bytes,
            media_type=media_type,
            api_key=api_key,
            model=model,
            target_text=target_text,
            reference_image_bytes=reference_image_bytes,
        )
    else:
        raw_text = await _generate_grade_raw_anthropic(
            image_bytes=image_bytes,
            media_type=media_type,
            api_key=api_key,
            model=model,
            target_text=target_text,
            reference_image_bytes=reference_image_bytes,
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
    reference_image_bytes: bytes | None = None,
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
    if reference_image_bytes:
        content.append({"type": "text", "text": "Reference example of the correct letter:"})
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(reference_image_bytes).decode(),
                },
            }
        )

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
    reference_image_bytes: bytes | None = None,
) -> str:
    image_data_url = f"data:{media_type};base64,{base64.b64encode(image_bytes).decode()}"
    user_content: list[dict[str, Any]] = [
        {"type": "input_text", "text": target_text},
        {"type": "input_image", "image_url": image_data_url},
    ]
    if reference_image_bytes:
        ref_data_url = f"data:image/png;base64,{base64.b64encode(reference_image_bytes).decode()}"
        user_content.append({"type": "input_text", "text": "Reference example of the correct letter:"})
        user_content.append({"type": "input_image", "image_url": ref_data_url})
    payload = {
        "model": model,
        "instructions": RAW_GRADE_PROMPT,
        "input": [
            {
                "role": "user",
                "content": user_content,
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
