import { useRef, useState } from 'react'
import { AudioLines, Mic, Wallet, ShieldCheck, Landmark, FileText, MessageSquareText, Languages, Send, ArrowLeft, Volume2, LoaderCircle, CheckCircle2, Sparkles } from 'lucide-react'

type Lang = 'hi' | 'en'
type Task = 'general' | 'earnings' | 'safety' | 'schemes' | 'documents' | 'complaint'
type SpeechRecognitionResult = { [index: number]: { transcript: string } }
type SpeechRecognitionEvent = { results: SpeechRecognitionResult[] }
type SpeechRecognitionLike = { lang: string; interimResults: boolean; onresult: ((event: SpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
declare global { interface Window { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike } }

const API = '/api'
const labels = {
  hi: {
    greeting: 'नमस्ते! मैं आपका काम साथी हूँ।',
    sub: 'आप हिंदी या English में बात कर सकते हैं। आज मैं आपकी किस तरह मदद करूँ?',
    earnings: 'कमाई का हिसाब', safety: 'सुरक्षा सहायता', schemes: 'सरकारी योजनाएँ',
    documents: 'दस्तावेज़ सहायता', complaint: 'शिकायत लिखवाएँ', general: 'मुझसे कुछ भी पूछें',
    speak: 'बोलने के लिए दबाएँ', listening: 'सुन रहा हूँ…', send: 'भेजें', placeholder: 'यहाँ लिखें या माइक दबाकर बोलें…',
    back: 'होम पर वापस', assistant: 'काम साथी AI', intro: 'आपका भरोसेमंद काम सहायक',
    earningsTitle: 'आज की कमाई दर्ज करें', earned: 'कुल कमाई (₹)', expenses: 'कुल खर्च (₹)', note: 'नोट (वैकल्पिक)',
    save: 'हिसाब निकालें', saved: 'हिसाब तैयार है।', error: 'अभी सेवा उपलब्ध नहीं है। कृपया दोबारा कोशिश करें।',
    history: 'हाल के हिसाब', noHistory: 'हिसाब इस सत्र में सेव नहीं किए जाते।', ai: 'AI सहायक', demo: 'AI API सेट होने पर AI जवाब चालू होंगे.',
    language: 'भाषा', listenAnswer: 'जवाब सुनें', taskPrompt: 'आप क्या जानना चाहते हैं?', privacy: 'कृपया OTP, पासवर्ड, PIN या पहचान संख्या साझा न करें।',
    examples: ['आज 900 रुपये कमाए और 180 रुपये पेट्रोल पर खर्च किए', 'मेरी पेमेंट तीन दिन से रुकी है', 'मुझे सरकारी योजना की जानकारी चाहिए']
  },
  en: {
    greeting: "Hello! I'm your Kaam Saathi.",
    sub: 'You can speak in Hindi or English. How can I help you today?',
    earnings: 'Track earnings', safety: 'Safety support', schemes: 'Welfare schemes',
    documents: 'Document help', complaint: 'Draft a complaint', general: 'Ask me anything',
    speak: 'Tap to speak', listening: 'Listening…', send: 'Send', placeholder: 'Type here or tap the mic to speak…',
    back: 'Back to home', assistant: 'Kaam Saathi AI', intro: 'Your practical work companion',
    earningsTitle: "Record today's earnings", earned: 'Total earnings (₹)', expenses: 'Total expenses (₹)', note: 'Note (optional)',
    save: 'Calculate earnings', saved: 'Calculation ready.', error: 'Service is unavailable right now. Please try again.',
    history: 'Recent records', noHistory: 'Records are not saved in this session.', ai: 'AI assistant', demo: 'AI replies turn on when an API key is configured.',
    language: 'Language', listenAnswer: 'Listen to answer', taskPrompt: 'What would you like to know?', privacy: 'Please do not share OTPs, passwords, PINs, or identity numbers.',
    examples: ["I earned ₹900 and spent ₹180 on fuel", 'My payment has been delayed for three days', 'I need help finding a welfare scheme']
  }
}
const taskMeta: { key: Task; icon: typeof Wallet; color: string }[] = [
  { key: 'earnings', icon: Wallet, color: 'mint' }, { key: 'safety', icon: ShieldCheck, color: 'blue' },
  { key: 'schemes', icon: Landmark, color: 'gold' }, { key: 'documents', icon: FileText, color: 'violet' },
  { key: 'complaint', icon: MessageSquareText, color: 'rose' }
]

async function jsonFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}
function speak(text: string, lang: Lang) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
  utterance.rate = 0.94
  window.speechSynthesis.speak(utterance)
}
export default function App() {
  const [lang, setLang] = useState<Lang>('hi')
  const [task, setTask] = useState<Task | null>(null)
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null)
  const [earned, setEarned] = useState('900')
  const [expenses, setExpenses] = useState('180')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const t = labels[lang]

  function chooseTask(key: Task) {
    setTask(key); setReply(''); setMessage('')
    if (key === 'earnings') setReply('')
  }
  function goHome() { setTask(null); setReply(''); setMessage(''); window.speechSynthesis?.cancel() }
  function startListening() {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Constructor) {
      setToast(lang === 'hi' ? 'इस ब्राउज़र में वॉइस इनपुट उपलब्ध नहीं है। कृपया लिखकर भेजें।' : 'Voice input is not supported in this browser. Please type instead.')
      return
    }
    const rec = new Constructor()
    rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'
    rec.interimResults = false
    rec.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript || ''; setMessage(transcript); setListening(false) }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognition.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }
  async function sendMessage(value = message) {
    if (!value.trim() || busy) return
    setBusy(true); setReply('')
    try {
      const data = await jsonFetch('/chat', { method: 'POST', body: JSON.stringify({ message: value.trim(), language: lang, task: task || 'general' }) })
      setReply(data.reply); setAiEnabled(data.ai_enabled); speak(data.reply, lang)
    } catch { setReply(t.error) } finally { setBusy(false) }
  }
  async function saveEarnings() {
    const e = Number(earned), x = Number(expenses)
    if (!Number.isFinite(e) || !Number.isFinite(x) || e < 0 || x < 0 || earned.trim() === '' || expenses.trim() === '') {
      setToast(lang === 'hi' ? 'कृपया सही कमाई और खर्च दर्ज करें।' : 'Please enter valid earnings and expenses.'); return
    }
    setBusy(true)
    try {
      const data = await jsonFetch('/earnings/calculate', { method: 'POST', body: JSON.stringify({ language: lang, earned_rupees: e, expenses_rupees: x }) })
      setReply(data.reply); speak(data.reply, lang); setToast(lang === 'hi' ? 'हिसाब तैयार है; सर्वर पर सेव नहीं किया गया।' : 'Calculation ready; nothing was saved on the server.')
    } catch { setToast(t.error) } finally { setBusy(false) }
  }
  const taskTitle = task ? (task === 'general' ? t.general : t[task]) : ''
  return <div className="app-shell">
    <header className="topbar">
      <button className="brand-button" onClick={goHome} aria-label="Kaam Saathi home">
        <span className="brand-mark"><AudioLines size={25} /></span>
        <span className="brand-copy"><strong>Kaam Saathi</strong><small>Gig Worker Companion</small></span>
      </button>
      <div className="header-actions">
        <span className="ai-pill"><Sparkles size={14} /> {t.ai}</span>
        <label className="language-select"><Languages size={17} /><span className="sr-only">{t.language}</span>
          <select value={lang} onChange={e => { setLang(e.target.value as Lang); setReply('') }} aria-label={t.language}>
            <option value="hi">हिंदी</option><option value="en">English</option>
          </select>
        </label>
      </div>
    </header>
    <main className="main-content">
      {!task ? <>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> {lang === 'hi' ? 'आपके साथ, हर कदम पर' : 'Here for you, at every step'}</div>
            <h1>{t.greeting}</h1><p>{t.sub}</p>
            <div className="hero-chips"><span><Mic size={15} /> {lang === 'hi' ? 'आवाज़ से बात करें' : 'Voice enabled'}</span><span><Languages size={15} /> Hindi + English</span></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-person"><span className="person-head" /><span className="person-body" /><span className="person-bag" /></div><span className="art-spark spark-a">✦</span><span className="art-spark spark-b">✳</span><div className="art-bubble"><AudioLines size={26} /><span>नमस्ते!</span></div></div>
        </section>
        <section className="task-section">
          <div className="section-heading"><div><span className="section-kicker">{lang === 'hi' ? 'आपका सहायक' : 'YOUR COMPANION'}</span><h2>{lang === 'hi' ? 'मैं आपकी क्या मदद करूँ?' : 'What can I help with?'}</h2></div><span className="privacy-note"><ShieldCheck size={14} /> {lang === 'hi' ? 'बिना लॉगिन · हिसाब सर्वर पर सेव नहीं होता' : 'No login · earnings are not saved on the server'}</span></div>
          <div className="task-grid">{taskMeta.map(({ key, icon: Icon, color }) => <button className="task-card" key={key} onClick={() => chooseTask(key)}><span className={`task-icon ${color}`}><Icon size={24} /></span><span className="task-card-title">{t[key]}</span><span className="task-card-arrow">↗</span></button>)}</div>
        </section>
        <section className="voice-panel">
          <div className="voice-copy"><span className="voice-label"><AudioLines size={17} /> {lang === 'hi' ? 'बोलकर पूछें' : 'ASK BY VOICE'}</span><h3>{lang === 'hi' ? 'बस बोलिए, मैं सुन रहा हूँ।' : 'Just speak. I’m listening.'}</h3><p>{lang === 'hi' ? 'आप अपनी भाषा में सवाल पूछ सकते हैं।' : 'Ask in your own words, in your preferred language.'}</p></div>
          <button className={`mic-button ${listening ? 'is-listening' : ''}`} onClick={startListening} aria-label={t.speak}><Mic size={27} /><span>{listening ? t.listening : t.speak}</span></button>
        </section>
        <section className="quick-ask">
          <p>{t.taskPrompt}</p><div className="quick-examples">{t.examples.map(ex => <button key={ex} onClick={() => { setTask('general'); setMessage(ex); sendMessage(ex) }}>{ex}<span>↗</span></button>)}</div>
        </section>
        {reply && <ReplyCard reply={reply} lang={lang} onSpeak={() => speak(reply, lang)} />}
      </> : <section className="inner-page">
        <button className="back-button" onClick={goHome}><ArrowLeft size={17} /> {t.back}</button>
        <div className="inner-title"><span className={`task-icon ${taskMeta.find(x => x.key === task)?.color || 'mint'}`}>{taskMeta.find(x => x.key === task) ? (() => { const Icon = taskMeta.find(x => x.key === task)!.icon; return <Icon size={24} /> })() : <AudioLines size={24} />}</span><div><span className="section-kicker">{t.assistant}</span><h1>{taskTitle}</h1></div></div>
        {task === 'earnings' ? <div className="earnings-form">
          <p>{lang === 'hi' ? 'आज की कमाई और खर्च दर्ज करें। हिसाब ऐप सही तरीके से करेगा।' : 'Enter your earnings and expenses. The app will calculate the total accurately.'}</p>
          <label>{t.earned}<input inputMode="decimal" type="number" min="0" step="0.01" value={earned} onChange={e => setEarned(e.target.value)} /></label>
          <label>{t.expenses}<input inputMode="decimal" type="number" min="0" step="0.01" value={expenses} onChange={e => setExpenses(e.target.value)} /></label>
          <label>{t.note}<input value={note} onChange={e => setNote(e.target.value)} placeholder={lang === 'hi' ? 'जैसे: शाम की डिलीवरी' : 'e.g. Evening deliveries'} /></label><p className="privacy-note">{lang === 'hi' ? 'यह नोट केवल स्क्रीन पर रहता है; हिसाब सर्वर पर सेव नहीं होता।' : 'This note stays on screen only; the calculation is not stored on the server.'}</p>
          <div className="calculation-preview"><span>{lang === 'hi' ? 'खर्च के बाद बची राशि' : 'Remaining after expenses'}</span><strong>₹{(Number(earned || 0) - Number(expenses || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}{Number(expenses) > Number(earned) ? (lang === 'hi' ? ' (अधिक खर्च)' : ' (expenses exceed earnings)') : ''}</strong></div>
          <button className="primary-button" onClick={saveEarnings} disabled={busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <CheckCircle2 size={18} />}{t.save}</button>
        </div> : <>
          <p className="helper-intro">{task === 'safety' ? (lang === 'hi' ? 'अगर अभी खतरा है, तो पहले सुरक्षित जगह जाएँ और स्थानीय आपातकालीन सहायता लें।' : 'If you are in immediate danger, move to safety and contact local emergency help first.') : task === 'schemes' ? (lang === 'hi' ? 'मैं आपकी परिस्थिति के अनुसार योजनाओं को समझाने में मदद करूँगा। पात्रता आधिकारिक स्रोत से सत्यापित करनी होगी।' : 'I can help explain schemes for your situation. Eligibility must be verified with official sources.') : task === 'documents' ? (lang === 'hi' ? 'बताएँ कि आप किस दस्तावेज़ या आवेदन में मदद चाहते हैं। कृपया पहचान संख्या या OTP साझा न करें।' : 'Tell me which document or application you need help with. Do not share identity numbers or OTPs.') : (lang === 'hi' ? 'बताएँ क्या हुआ। मैं आपके दिए तथ्यों के आधार पर शिकायत का मसौदा बनाऊँगा।' : 'Tell me what happened. I will draft a complaint based only on facts you provide.')}</p>
          <div className="chat-box">{reply ? <ReplyCard reply={reply} lang={lang} onSpeak={() => speak(reply, lang)} /> : <div className="empty-chat"><AudioLines size={28} /><p>{lang === 'hi' ? 'आपका सवाल सुनने के लिए तैयार हूँ।' : 'I’m ready for your question.'}</p></div>}
            <div className="chat-compose"><button className={`compose-mic ${listening ? 'is-listening' : ''}`} onClick={startListening} aria-label={t.speak}><Mic size={21} /></button><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} placeholder={t.placeholder} /><button className="send-button" onClick={() => sendMessage()} disabled={busy || !message.trim()} aria-label={t.send}>{busy ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button></div>
          </div>
          <p className="privacy-note"><ShieldCheck size={14} /> {t.privacy}</p>
        </>}
        {reply && task === 'earnings' && <ReplyCard reply={reply} lang={lang} onSpeak={() => speak(reply, lang)} />}
      </section>}
      {toast && <div className="toast" role="status" aria-live="polite">{toast} <button onClick={() => setToast('')} aria-label={lang === 'hi' ? 'संदेश बंद करें' : 'Dismiss message'}>×</button></div>}
    </main>
    <footer className="footer"><span>© Kaam Saathi · Gig Worker Companion</span><span>{lang === 'hi' ? 'AI सहायता · सरल भाषा · आपकी सुविधा' : 'AI assistance · Simple language · Built for you'}</span></footer>
  </div>
}
function ReplyCard({ reply, lang, onSpeak }: { reply: string; lang: Lang; onSpeak: () => void }) {
  return <div className="reply-card"><div className="reply-avatar"><AudioLines size={19} /></div><div className="reply-content"><div className="reply-heading">Kaam Saathi <span>AI</span></div><p aria-live="polite">{reply}</p><button className="listen-answer" onClick={onSpeak}><Volume2 size={15} /> {labels[lang].listenAnswer}</button></div></div>
}
