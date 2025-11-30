# Backedn (FastAPI) for Financial NER

This folder contains a small FastAPI backend to serve the `financial_ner_model` spaCy model included in the repository.

Files:
- `main.py` — FastAPI application exposing endpoints:
  - `GET /health` — simple health check
  - `GET /labels` — returns NER labels available in the model
  - `POST /predict` — accepts JSON `{ "text": "..." }` and returns detected entities
  - `POST /reload` — reloads the model from disk (development use)

Run locally (from project root):

```bash
# install dependencies (preferably in a venv)
pip install -r requirements.txt

# start the server
uvicorn backedn.main:app --host 0.0.0.0 --port 8000 --reload
```

Example request:

```bash
curl -X POST "http://127.0.0.1:8000/predict" \
  -H "Content-Type: application/json" \
  -d '{"text": "Apple announced a $50 million acquisition."}'
```

Notes:
- The backend expects the trained model to be accessible at the `financial_ner_model` directory in the repository root.
- In production, remove `--reload` and consider process managers like systemd, Docker, or gunicorn with uvicorn workers.
