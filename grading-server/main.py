import base64
import json
import os
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pipeline.feedback import generate_grade_raw

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
LETTERS_PATH = BASE_DIR / "data" / "letters.json"

with LETTERS_PATH.open("r", encoding="utf-8") as f:
    LETTERS = json.load(f)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class GradeRequest(BaseModel):
    image: str
    media_type: str = Field(pattern=r"^image/(png|jpeg|jpg)$")
    letter_pos: int = Field(ge=1, le=28)
    llm_provider: Optional[Literal["openai", "anthropic"]] = None


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/grade")
async def grade(req: GradeRequest) -> dict:
    letter = next((l for l in LETTERS if l["pos"] == req.letter_pos), None)
    if not letter:
        raise HTTPException(status_code=400, detail=f"Unknown letter_pos: {req.letter_pos}")

    try:
        image_bytes = base64.b64decode(req.image, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 image")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image payload")

    try:
        llm_provider = (req.llm_provider or os.getenv("RAW_LLM_PROVIDER", "openai")).lower()
        if llm_provider not in ("openai", "anthropic"):
            raise HTTPException(status_code=400, detail=f"Unsupported llm_provider: {llm_provider}")

        if llm_provider == "openai":
            raw_api_key = os.getenv("OPENAI_API_KEY")
            raw_model = os.getenv("OPENAI_MODEL", "gpt-5-mini")
            if not raw_api_key:
                raise HTTPException(status_code=400, detail="OPENAI_API_KEY is required for openai provider")
        else:
            raw_api_key = os.getenv("ANTHROPIC_API_KEY")
            raw_model = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-5")
            if not raw_api_key:
                raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is required for anthropic provider")

        raw = await generate_grade_raw(
            image_bytes=image_bytes,
            media_type=req.media_type,
            letter=letter,
            api_key=raw_api_key,
            provider=llm_provider,
            model=raw_model,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {
        "correct": raw["correct"],
        "score": raw["score"],
        "feedback": raw["feedback"],
        "reference_image": None,
        "debug": {
            "mode": "llm_raw",
            "feedback_source": "llm_raw",
            "llm_provider": llm_provider,
            "llm_model": raw_model,
            "raw_model_output": raw.get("raw_model_output", ""),
        },
    }
