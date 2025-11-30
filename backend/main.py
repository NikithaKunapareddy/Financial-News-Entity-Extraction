from typing import List, Dict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import spacy
import logging

app = FastAPI(
    title="Financial NER API",
    description="Serve the spaCy financial NER model for inference",
)

# Allow cross-origin requests (useful for a frontend during development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("financial_ner_api")


class TextRequest(BaseModel):
    text: str


class Entity(BaseModel):
    text: str
    label: str
    start: int
    end: int


nlp = None


@app.on_event("startup")
def load_model_on_startup():
    global nlp
    model_path = "../financial_ner_model"
    try:
        logger.info(f"Loading spaCy model from: {model_path}")
        nlp = spacy.load(model_path)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.exception(f"Failed to load model at '{model_path}': {e}")
        # keep nlp as None and raise errors at request time


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/labels")
def get_labels():
    if nlp is None:
        raise HTTPException(status_code=500, detail="Model not loaded")
    labels = []
    # Try to get NER pipe labels if available
    if "ner" in nlp.pipe_names:
        ner_pipe = nlp.get_pipe("ner")
        labels = list(ner_pipe.labels)
    else:
        labels = list(nlp.pipe_names)
    return {"labels": labels}


@app.post("/predict")
def predict(request: TextRequest):
    if nlp is None:
        raise HTTPException(status_code=500, detail="Model not loaded; check server logs")

    text = request.text
    if not text:
        raise HTTPException(status_code=400, detail="Empty text provided")

    doc = nlp(text)
    entities: List[Entity] = []
    for ent in doc.ents:
        entities.append(Entity(text=ent.text, label=ent.label_, start=ent.start_char, end=ent.end_char))

    return {"text": text, "entities": [e.dict() for e in entities]}


@app.post("/reload")
def reload_model():
    """Reload the model from disk. Useful during development after retraining.

    WARNING: In production you should handle reloads carefully.
    """
    global nlp
    model_path = "../financial_ner_model"
    try:
        nlp = spacy.load(model_path)
        return {"status": "reloaded"}
    except Exception as e:
        logger.exception("Failed to reload model")
        raise HTTPException(status_code=500, detail=str(e))
