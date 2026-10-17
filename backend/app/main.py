import os
import time
from collections import defaultdict, deque
from threading import Lock
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ConfigDict

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
APP_ENV = os.getenv("APP_ENV", "development")

app = FastAPI(title="Kaam Saathi API", version="0.2.0")
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:18030").split(",") if x.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

# Lightweight per-process guardrail for a small demo. Use a shared rate-limit store at scale.
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = Lock()
RATE_WINDOW_SECONDS = 60
RATE_MAX_REQUESTS = int(os.getenv("RATE_MAX_REQUESTS", "20"))

class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    message: str = Field(min_length=1, max_length=2000)
    language: str = Field(default="hi", pattern="^(hi|en)$")
    task: str = Field(default="general", pattern="^(general|earnings|safety|schemes|documents|complaint)$")

class EarningsRequest(BaseModel):
    language: str = Field(default="hi", pattern="^(hi|en)$")
    earned_rupees: float = Field(ge=0, le=10000000, allow_inf_nan=False)
    expenses_rupees: float = Field(ge=0, le=10000000, allow_inf_nan=False)

def rate_limit(request: Request) -> None:
    # Behind a reverse proxy, configure trusted proxy handling before relying on client IP.
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _hits_lock:
        bucket = _hits[client]
        while bucket and now - bucket[0] > RATE_WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= RATE_MAX_REQUESTS:
            raise HTTPException(status_code=429, detail="Too many requests. Please wait and try again.")
        bucket.append(now)

def fallback_reply(req: ChatRequest) -> str:
    hi = req.language == "hi"
    if req.task == "safety":
        return ("अगर अभी खतरा है, तो जहाँ संभव हो सुरक्षित जगह पर जाएँ और स्थानीय आपातकालीन सेवा या भरोसेमंद व्यक्ति से संपर्क करें। वाहन चलाते समय फोन का उपयोग न करें। स्थानीय आपातकालीन नंबर को आधिकारिक स्रोत से सत्यापित करें।" if hi else "If you are in immediate danger, move to a safer place if possible and contact verified local emergency services or a trusted person. Do not use your phone while driving. Verify local emergency numbers from an official source.")
    if req.task == "schemes":
        return ("सरकारी योजना की पात्रता राज्य और परिस्थिति के अनुसार बदल सकती है। बिना सत्यापित आधिकारिक स्रोत के मैं पात्रता की पुष्टि नहीं कर सकता। अपना राज्य और काम का प्रकार बताएं; संवेदनशील पहचान जानकारी साझा न करें।" if hi else "Scheme eligibility can depend on your state and circumstances. I can't confirm eligibility without a verified official source. Tell me your state and type of work; don't share sensitive identity details.")
    if req.task == "documents":
        return ("मैं दस्तावेज़ की भाषा या प्रक्रिया समझाने में मदद कर सकता हूँ। कृपया OTP, पासवर्ड, PIN, बैंक विवरण या पहचान संख्या साझा न करें।" if hi else "I can help explain a document or process. Please do not share OTPs, passwords, PINs, bank details, or identity numbers.")
    if req.task == "complaint":
        return ("मैं आपके बताए तथ्यों के आधार पर शिकायत का मसौदा बना सकता हूँ। बताएं क्या हुआ, कब हुआ, कितनी राशि शामिल है और आप क्या समाधान चाहते हैं। मैं कोई तथ्य नहीं गढ़ूँगा।" if hi else "I can draft a complaint using only facts you provide. Tell me what happened, when, the amount involved, and the resolution you want. I won't invent facts.")
    if req.task == "earnings":
        return ("कमाई का हिसाब करने के लिए कमाई और खर्च की राशि दर्ज करें। ऐप गणना करेगा।" if hi else "Enter your earnings and expenses in the earnings tool; the app will calculate the remaining amount.")
    return ("नमस्ते! मैं कमाई, सुरक्षा, सरकारी योजनाओं, दस्तावेज़ और शिकायत के मसौदे में मदद कर सकता हूँ। आप किस विषय पर बात करना चाहेंगे?" if hi else "Hello! I can help with earnings, safety, welfare schemes, documents, and complaint drafts. What would you like help with?")

def ai_reply(req: ChatRequest) -> str:
    if not OPENAI_API_KEY:
        return fallback_reply(req)
    try:
        from openai import OpenAI
        client = OpenAI(api_key=OPENAI_API_KEY, timeout=15.0, max_retries=1)
        language_name = "Hindi" if req.language == "hi" else "English"
        system = f"""You are Kaam Saathi, a careful assistant for gig and informal workers in India. Reply in simple {language_name}, short spoken-friendly sentences. Current task: {req.task}. Ask one necessary follow-up question at a time. Never invent scheme eligibility, laws, emergency numbers, sources, or facts. For rights/schemes, disclose when official verification is needed. For immediate danger, give brief safety-first guidance. For complaint drafts, use only user-provided facts and placeholders for missing details; never claim submission. For documents, do not claim official verification. Never ask for Aadhaar numbers, OTPs, passwords, bank PINs, or unnecessary sensitive information. Do not claim to be a lawyer, government agency, employer, or platform support."""
        result = client.chat.completions.create(model=OPENAI_MODEL, messages=[{"role":"system","content":system},{"role":"user","content":req.message}], temperature=0.2, max_tokens=500)
        text = (result.choices[0].message.content or "").strip()
        return text[:8000] if text else fallback_reply(req)
    except Exception:
        return fallback_reply(req)

@app.get("/api/health")
def health():
    return {"status": "ok", "ai_enabled": bool(OPENAI_API_KEY), "time": datetime.now(timezone.utc).isoformat()}

@app.post("/api/chat")
def chat(req: ChatRequest, request: Request):
    rate_limit(request)
    return {"reply": ai_reply(req), "language": req.language, "ai_enabled": bool(OPENAI_API_KEY)}

@app.post("/api/earnings/calculate")
def calculate_earnings(req: EarningsRequest, request: Request):
    rate_limit(request)
    # Convert to integer paise before arithmetic to avoid float arithmetic errors.
    earned_paise = round(req.earned_rupees * 100)
    expenses_paise = round(req.expenses_rupees * 100)
    remaining_paise = earned_paise - expenses_paise
    if req.language == "hi":
        reply = f"दर्ज कमाई ₹{earned_paise / 100:,.2f} और खर्च ₹{expenses_paise / 100:,.2f} हैं। खर्च घटाने के बाद ₹{remaining_paise / 100:,.2f} बचते हैं। यह केवल आपके दर्ज खर्चों के बाद की राशि है।"
    else:
        reply = f"Recorded earnings: ₹{earned_paise / 100:,.2f}; recorded expenses: ₹{expenses_paise / 100:,.2f}; remaining after recorded expenses: ₹{remaining_paise / 100:,.2f}. This only reflects the expenses entered."
    # Stateless by design: no earnings or conversation are stored on the server.
    return {"earned_rupees": earned_paise / 100, "expenses_rupees": expenses_paise / 100, "remaining_rupees": remaining_paise / 100, "reply": reply}
