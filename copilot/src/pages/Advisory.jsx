import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const INDIAN_LANGUAGES = [
  { name: 'English', code: 'en-IN', native: 'English' },
  { name: 'Hindi', code: 'hi-IN', native: 'हिन्दी' },
  { name: 'Marathi', code: 'mr-IN', native: 'मराठी' },
  { name: 'Bengali', code: 'bn-IN', native: 'বাংলা' },
  { name: 'Telugu', code: 'te-IN', native: 'తెలుగు' },
  { name: 'Tamil', code: 'ta-IN', native: 'தமிழ்' },
  { name: 'Gujarati', code: 'gu-IN', native: 'ગુજરાતી' },
  { name: 'Kannada', code: 'kn-IN', native: 'ಕನ್ನಡ' },
  { name: 'Malayalam', code: 'ml-IN', native: 'മലയാളം' },
  { name: 'Punjabi', code: 'pa-IN', native: 'ਪੰਜਾਬੀ' },
  { name: 'Urdu', code: 'ur-IN', native: 'اردو' }
];

export default function Advisory({ user, onLogin }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');

  // Voice recognition & Language states
  const [isRecording, setIsRecording] = useState(false);
  const [inputLang, setInputLang] = useState('hi-IN');
  const [voiceError, setVoiceError] = useState('');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [showEnglish, setShowEnglish] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState(null);
  const [history, setHistory] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      stopCamera();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const loadHistory = () => {
    if (!user?.id) { setHistory([]); return; }
    axios.get(`${API_BASE_URL}/api/advisory/history?userId=${user.id}`)
      .then(res => { if (res.data.success) setHistory(res.data.data); })
      .catch(() => {});
  };

  useEffect(() => { loadHistory(); }, [user?.id]);

  const viewHistoryItem = (h) => {
    setResponse({ diagnosis: h.diagnosis, products: { recommendations: h.products || [] } });
    setShowEnglish(false);
    window.scrollTo({ top: document.querySelector('.advisory-results-wrap')?.offsetTop - 80 || 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = async (id) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    try { await axios.delete(`${API_BASE_URL}/api/advisory/history/${id}`); } catch (e) { /* ignore */ }
  };

  const currentLangObj = INDIAN_LANGUAGES.find(l => l.code === inputLang) || INDIAN_LANGUAGES[0];

  // Voice recognition handler
  const startRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      setVoiceError('');
      setLiveTranscript('');
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = inputLang;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event) => {
        let currentInterim = '';
        let finalConcat = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const trans = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalConcat += trans + ' ';
          } else {
            currentInterim += trans;
          }
        }

        if (finalConcat) {
          setQuery(prev => (prev ? prev + ' ' + finalConcat : finalConcat).trim());
        }
        setLiveTranscript(currentInterim || finalConcat);
      };

      recognition.onerror = (event) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error !== 'no-speech') {
          setVoiceError(`Voice error: ${event.error}. Please try again.`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setVoiceError('Could not start microphone. Please grant permission.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const startCamera = async () => {
    try {
      setCameraError('');
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      setIsCameraActive(false);
      setCameraError('Unable to access camera. Please allow permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      canvas.toBlob((blob) => {
        const file = new File([blob], 'camera_capture.jpg', { type: 'image/jpeg' });
        setImage(file);
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);
        stopCamera();
      }, 'image/jpeg', 0.8);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => { setImage(null); setImagePreview(null); setCameraError(''); };

  const handleSubmit = async () => {
    if (!query.trim() && !image) return;
    if (!user) {
      if (onLogin) onLogin();
      return;
    }
    setLoading(true);
    setResponse(null);
    setShowEnglish(false);

    try {
      const formData = new FormData();
      formData.append('query', query);
      formData.append('language', currentLangObj.name);
      formData.append('userId', user?.id || '');
      if (image) {
        formData.append('image', image);
      }

      const res = await axios.post(`${API_BASE_URL}/api/advisory`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = res.data?.data || null;
      setResponse(data);
      if (data?.diagnosis?.issue && data.diagnosis.issue !== 'AI System Notice') {
        localStorage.setItem('fc_last_disease', JSON.stringify({
          disease: data.diagnosis.issue,
          timestamp: Date.now()
        }));
        if (data?.products?.recommendations) {
          localStorage.setItem('fc_advisory_products', JSON.stringify(data.products.recommendations));
        }
      }
      loadHistory();
    } catch (err) {
      setResponse({ diagnosis: { issue: 'Connection Error', summary: '❌ Could not reach the AI service. Please check your connection and API key.', severity: 'critical', urgency: 'immediate' } });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBorder = (s) => ({ critical: 'border-red-500/15', high: 'border-orange-500/15', medium: 'border-yellow-500/15', low: 'border-emerald-500/15' }[s] || '');

  return (
    <div className="advisory-page">
      {/* Ambient glow orbs */}
      <div className="advisory-orb advisory-orb-1" />
      <div className="advisory-orb advisory-orb-2" />

      {/* ── Hero ────────────────────────────────── */}
      <div className="advisory-hero">
        <div className="advisory-hero-badge animate-fade-up">
          <span className="advisory-hero-badge-dot" />
          AI-Powered Multilingual Diagnosis
        </div>

        <h1 className="advisory-hero-title animate-fade-up" style={{ animationDelay: '60ms' }}>
          Diagnose Crop Diseases<br />
          <span className="advisory-hero-title-accent">in Any Language</span>
        </h1>

        <p className="advisory-hero-sub animate-fade-up" style={{ animationDelay: '120ms' }}>
          Speak or type in your regional Indian language or upload a leaf photo.
          <br className="hidden md:block" /> Our AI will identify the problem and guide you in your preferred language.
        </p>

        {/* ── Floating Glass Card ──────────────────── */}
        <div className="advisory-card animate-fade-up" style={{ animationDelay: '180ms' }}>
          <div className="advisory-card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="advisory-card-icon">🧠</div>
              <div>
                <h2 className="advisory-card-title">AI Diagnosis</h2>
                <p className="advisory-card-subtitle">Voice input supported in 11 Indian languages</p>
              </div>
            </div>
          </div>

          <div className="advisory-card-divider" />

          {/* Text & Voice Field */}
          <div className="advisory-field relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-1.5 sm:gap-0">
              <label className="advisory-label mb-0">Describe the Problem</label>
              
              {/* Voice Input Language Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-400 font-medium whitespace-nowrap">Speak in:</span>
                <select
                  value={inputLang}
                  onChange={(e) => setInputLang(e.target.value)}
                  className="advisory-select"
                >
                  {INDIAN_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.native} ({lang.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="relative group">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Type or tap microphone icon to speak in ${currentLangObj.native} (${currentLangObj.name})...`}
                rows={3}
                className="advisory-textarea pr-12 transition-all duration-200"
              />

              {/* Sleek Professional Claude/ChatGPT Style Mic Button */}
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`advisory-mic-btn ${isRecording ? 'recording' : ''}`}
                title={isRecording ? "Stop Recording" : `Voice Input (${currentLangObj.name})`}
              >
                {isRecording ? (
                  // Minimalist Claude/ChatGPT Style Stop Icon
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  // Minimalist Claude/ChatGPT Style Microphone SVG
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2 stroke-round stroke-linejoin" viewBox="0 0 24 24">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error notice if voice is not supported */}
            {voiceError && <p className="text-xs text-rose-400 mt-1.5">{voiceError}</p>}

            {/* Sleek Recording Screen Overlay (Half-size of describe section) */}
            {isRecording && (
              <div className="advisory-recording-card">
                <div className="advisory-recording-header">
                  <div className="advisory-recording-title">
                    <span className="advisory-recording-pulse-dot" />
                    <span>Listening in {currentLangObj.native} ({currentLangObj.name})...</span>
                  </div>

                  {/* Sleek Stop Recording Button */}
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="advisory-stop-btn"
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    Stop Recording
                  </button>
                </div>

                {/* Animated Audio Waveform Graphic */}
                <div className="advisory-waves-container">
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.1s' }} />
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.3s' }} />
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.5s' }} />
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.2s' }} />
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.4s' }} />
                  <div className="advisory-wave-bar" style={{ animationDelay: '0.6s' }} />
                </div>

                {/* Live Transcript Display */}
                <div className="advisory-transcript-box">
                  {liveTranscript || 'Speak your crop symptoms clearly...'}
                </div>
              </div>
            )}
          </div>

          {/* Image upload */}
          <div className="advisory-field mt-3">
            <label className="advisory-label">
              Upload Photo <span className="advisory-label-optional">(optional)</span>
            </label>

            {imagePreview ? (
              <div className="advisory-preview-wrap group relative">
                <img src={imagePreview} alt="Preview" className="advisory-preview-img" />
                <button onClick={removeImage} className="advisory-preview-remove md:opacity-0 md:group-hover:opacity-100" title="Remove photo">✕</button>
              </div>
            ) : isCameraActive ? (
              <div className="advisory-camera-wrap">
                <div className="advisory-camera-video-box">
                  <video ref={videoRef} autoPlay playsInline className="advisory-camera-video" />
                </div>
                <div className="advisory-camera-controls">
                  <button onClick={capturePhoto} className="btn-primary px-5 py-2.5" type="button">📸 Capture</button>
                  <button onClick={stopCamera} className="btn-secondary px-5 py-2.5" type="button">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="advisory-upload-area">
                <div className="advisory-upload-row">
                  <label className="advisory-upload-btn group">
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    <div className="advisory-upload-icon group-hover:scale-110">📁</div>
                    <span className="advisory-upload-text">Upload from Files</span>
                  </label>
                  <button type="button" onClick={startCamera} className="advisory-upload-btn group">
                    <div className="advisory-upload-icon group-hover:scale-110">📸</div>
                    <span className="advisory-upload-text">Take Photo</span>
                  </button>
                </div>
                {cameraError && <p className="advisory-camera-error">{cameraError}</p>}
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading || (!query.trim() && !image)}
            className="advisory-submit btn-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:transform-none disabled:hover:shadow-none mt-4"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Diagnosing in {currentLangObj.name}...</>
            ) : (
              <><span>🔬</span>Get AI Diagnosis<span className="advisory-submit-arrow">→</span></>
            )}
          </button>
        </div>
      </div>

      {/* Past Reports */}
      {user && history.length > 0 && (
        <div className="advisory-results-wrap">
          <div className="advisory-result-card animate-fade-up">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
              <span>🗂️</span> Past Reports
            </h3>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {history.map(h => (
                <div
                  key={h.id}
                  onClick={() => viewHistoryItem(h)}
                  className="flex items-center gap-3 p-2 rounded-lg border border-white/10 hover:border-purple-500/30 cursor-pointer transition-colors"
                >
                  {h.image ? (
                    <img src={h.image} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-lg flex-shrink-0">🌱</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">
                      {h.diagnosis?.issueEnglish || h.diagnosis?.issue || 'Diagnosis'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {h.createdAt ? new Date(h.createdAt).toLocaleString() : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); deleteHistoryItem(h.id); }}
                    className="text-zinc-500 hover:text-rose-400 text-xs px-1.5 py-0.5 flex-shrink-0"
                    title="Delete this report"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading shimmer */}
      {loading && (
        <div className="advisory-results-wrap">
          <div className="advisory-result-card animate-scale-in space-y-3">
            <div className="h-4 w-40 rounded shimmer" />
            <div className="h-3 w-full rounded shimmer" />
            <div className="h-3 w-3/4 rounded shimmer" />
            <div className="h-3 w-5/6 rounded shimmer" />
          </div>
        </div>
      )}

      {/* Result card */}
      {response && response.diagnosis && (
        <div className="advisory-results-wrap">
          <div className={`advisory-result-card animate-slide-up border ${getSeverityBorder(response.diagnosis.severity)}`}>
            <div className="advisory-result-header flex items-center justify-between">
              <div className="advisory-result-title-row">
                <span className="advisory-result-emoji">🌾</span>
                <div>
                  <h2 className="advisory-result-title">
                    {showEnglish 
                      ? (response.diagnosis.issueEnglish || response.diagnosis.issue || 'Diagnosis Result')
                      : (response.diagnosis.issue || 'Diagnosis Result')}
                  </h2>
                  {response.diagnosis.urgency && (
                    <p className="advisory-result-urgency">
                      Urgency: <span className="advisory-result-urgency-value">{response.diagnosis.urgency}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Language Switch Pill (If response is in a non-English Indian language) */}
              {response.diagnosis.languageName && response.diagnosis.languageName !== 'English' && (
                <button
                  type="button"
                  onClick={() => setShowEnglish(!showEnglish)}
                  className="advisory-lang-toggle"
                >
                  <svg className="w-3.5 h-3.5 fill-none stroke-current stroke-2 stroke-round stroke-linejoin" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  <span>{showEnglish ? `View in ${response.diagnosis.languageName}` : 'Switch to English'}</span>
                </button>
              )}
            </div>

            <div className="advisory-summary">
              <div className="advisory-summary-icon">🔍</div>
              <p className="advisory-summary-text">
                {showEnglish 
                  ? (response.diagnosis.summaryEnglish || response.diagnosis.summary)
                  : (response.diagnosis.summary)}
              </p>
            </div>

            {response.products?.recommendations?.length > 0 && (
              <div className="advisory-products-section">
                <h4 className="advisory-products-heading">
                  <span className="advisory-products-check">✓</span>
                  Recommended Products
                </h4>
                <div className="advisory-products-grid">
                  {response.products.recommendations.map((prod) => (
                    <div key={prod.id} className="advisory-prod-card">
                      <div className="advisory-prod-top">
                        <span className="advisory-prod-category">{prod.category}</span>
                        <span className="advisory-prod-price">₹{prod.price}</span>
                      </div>
                      <h5 className="advisory-prod-name">{prod.name}</h5>
                      <p className="advisory-prod-ingredient">{prod.activeIngredient}</p>
                      {prod.dosage && (
                        <div className="advisory-prod-dosage flex items-center justify-between">
                          <span className="advisory-prod-dosage-value">{prod.dosage}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedInstruction({
                          name: prod.name,
                          dosage: prod.dosage,
                          category: prod.category,
                          precautions: prod.whyThis,
                          application: `Apply ${prod.name} (${prod.activeIngredient}) as per crop dosage.`
                        })}
                        className="instruction-btn mt-2 w-full justify-center"
                      >
                        📖 Usage Instructions
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Get Treatment Button */}
            <button
              onClick={() => navigate(`/treatment?disease=${encodeURIComponent(response.diagnosis.issueEnglish || response.diagnosis.issue)}`)}
              className="advisory-submit btn-primary mt-4 w-full"
            >
              <span>💊</span>
              Get Treatment & Remedies
              <span className="advisory-submit-arrow">→</span>
            </button>
          </div>
        </div>
      )}
    {/* ═══ USAGE INSTRUCTIONS MODAL ═══ */}
      {selectedInstruction && (
        <div className="instruction-modal-backdrop" onClick={() => setSelectedInstruction(null)}>
          <div className="instruction-modal-card" onClick={e => e.stopPropagation()}>
            <div className="instruction-modal-header">
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <div>
                  <h3 className="text-base font-semibold text-white">{selectedInstruction.name}</h3>
                  <span className="text-xs text-purple-400 capitalize">{selectedInstruction.category}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInstruction(null)}
                className="instruction-close-icon-btn"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="instruction-step instruction-step-purple">
                <div className="step-title">🧪 Mixing Ratio & Dosage</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.dosage || '2g per litre of clean water'}. Mix thoroughly in a small container before adding to the main spray tank.
                </p>
              </div>

              <div className="instruction-step instruction-step-emerald">
                <div className="step-title">🚿 Application Method & Timing</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.application || 'Foliar spray at 10-15 day intervals'}. Apply evenly on upper and lower leaf surfaces during early morning (6-9 AM) or late evening (5-7 PM).
                </p>
              </div>

              <div className="instruction-step instruction-step-amber">
                <div className="step-title">🛡️ Safety & Protection</div>
                <p className="instruction-step-desc">
                  {selectedInstruction.precautions || 'Avoid spraying during high winds. Wear protective gloves and a face mask.'} Keep out of reach of children and domestic animals.
                </p>
              </div>

              <div className="instruction-step instruction-step-blue">
                <div className="step-title">⏰ Spray Frequency</div>
                <p className="instruction-step-desc">
                  Repeat application every 10–14 days if pest or disease symptoms persist. Stop application 7–10 days before crop harvest.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedInstruction(null)}
              className="btn-primary w-full py-2.5 mt-1"
            >
              Got it, Close Instructions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}