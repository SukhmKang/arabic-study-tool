# Arabic Handwriting Grading Server

FastAPI backend for grading handwritten Arabic letters used by the React PWA.

## Setup

```bash
cd grading-server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

## Generate templates

Place `NotoNaskhArabic-Regular.ttf` in `scripts/` and run:

```bash
python scripts/generate_templates.py
```

## Run server

```bash
uvicorn main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `POST /grade`

`POST /grade` body:

```json
{
  "image": "<base64 string>",
  "media_type": "image/png",
  "letter_pos": 2,
  "api_key": "sk-ant-..."
}
```
