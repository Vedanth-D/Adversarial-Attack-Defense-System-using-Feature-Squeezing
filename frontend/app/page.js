"use client";
import { useState, useRef, useEffect } from "react";

// ── Reusable Components ────────────────────────────────────────────────────

function ConfidenceBar({ label, confidence, color = "#00ff88", rank = 0 }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(confidence), 100 + rank * 80);
    return () => clearTimeout(t);
  }, [confidence, rank]);

  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-300 font-mono truncate max-w-[70%]">{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{confidence.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

function ThreatMeter({ score }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = score / 40;
    const timer = setInterval(() => {
      start += step;
      if (start >= score) { setDisplay(score); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [score]);

  const color = score >= 60 ? "#ff3333" : score >= 30 ? "#ffaa00" : "#00ff88";
  const label = score >= 60 ? "CRITICAL" : score >= 30 ? "WARNING" : "SAFE";

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="80" viewBox="0 0 140 80">
        <path d="M 10 75 A 60 60 0 0 1 130 75" fill="none" stroke="#1a1a2e" strokeWidth="12" strokeLinecap="round"/>
        <path
          d="M 10 75 A 60 60 0 0 1 130 75"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(display / 100) * 188} 188`}
          style={{ transition: "stroke-dasharray 0.05s, stroke 0.3s", filter: `drop-shadow(0 0 6px ${color})` }}
        />
        <text x="70" y="68" textAnchor="middle" fill={color} fontSize="22" fontFamily="monospace" fontWeight="bold">{display}</text>
      </svg>
      <div className="text-xs font-mono font-bold mt-1" style={{ color }}>{label}</div>
    </div>
  );
}

function ImagePanel({ title, b64, accent, children }) {
  return (
    <div className="rounded-lg overflow-hidden border" style={{ borderColor: accent + "44" }}>
      <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: accent + "18" }}>
        <div className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
        <span className="text-xs font-mono font-bold" style={{ color: accent }}>{title}</span>
      </div>
      {b64 ? (
        <img src={`data:image/png;base64,${b64}`} alt={title} className="w-full h-36 object-cover" />
      ) : (
        <div className="w-full h-36 bg-gray-900 flex items-center justify-center text-gray-700 text-xs font-mono">NO IMAGE</div>
      )}
      <div className="p-3 bg-gray-950">{children}</div>
    </div>
  );
}

function MetricCard({ label, value, unit = "", color = "#888" }) {
  return (
    <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs font-mono text-gray-500 mb-1 uppercase tracking-widest">{label}</div>
      <div className="text-lg font-mono font-bold" style={{ color }}>{value}<span className="text-xs ml-1 text-gray-500">{unit}</span></div>
    </div>
  );
}

function HistoryEntry({ entry, index }) {
  const color = entry.threat_score >= 60 ? "#ff3333" : entry.threat_score >= 30 ? "#ffaa00" : "#00ff88";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
      <div className="text-xs font-mono text-gray-600 w-4">{index + 1}</div>
      <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 border border-gray-700">
        {entry.preview ? <img src={entry.preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gray-800" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-gray-300 truncate">{entry.original}</div>
        <div className="text-xs font-mono" style={{ color }}>{entry.status_short}</div>
      </div>
      <div className="text-xs font-mono font-bold" style={{ color }}>ε={entry.epsilon}</div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [attackStrength, setAttackStrength] = useState(0.05);
  const [defenseMethod, setDefenseMethod] = useState("squeeze");
  const [activeTab, setActiveTab] = useState("overview");
  const [history, setHistory] = useState([]);
  const [scanLine, setScanLine] = useState(0);
  const fileRef = useRef(null);

  // Animated scan line effect during loading
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setScanLine(s => (s + 2) % 100), 20);
    return () => clearInterval(t);
  }, [loading]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResults(null);
      setError(null);
      setActiveTab("overview");
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("image", image);
    formData.append("strength", attackStrength);
    formData.append("defense", defenseMethod);

    try {
      const res = await fetch("http://127.0.0.1:5000/analyze", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setResults(data);
      // Add to history
      setHistory(prev => [{
        preview,
        original: data.original.top5[0]?.label || "Unknown",
        status_short: data.threat_score >= 60 ? "ATTACK DETECTED" : data.threat_score >= 30 ? "SUSPICIOUS" : "CLEAN",
        threat_score: data.threat_score,
        epsilon: attackStrength,
        timestamp: new Date().toLocaleTimeString()
      }, ...prev].slice(0, 6));
      setActiveTab("overview");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statusColor = results
    ? results.threat_score >= 60 ? "#ff3333"
    : results.threat_score >= 30 ? "#ffaa00"
    : "#00ff88"
    : "#444";

  const tabs = ["overview", "predictions", "images", "metrics"];

  return (
    <main style={{ background: "#050508", minHeight: "100vh", fontFamily: "'Courier New', monospace", color: "#e0e0e0" }}>
      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px"
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 12px #00ff88", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, color: "#00ff88", letterSpacing: "0.3em", textTransform: "uppercase" }}>System Online</span>
          </div>
          <h1 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, letterSpacing: "-0.02em", margin: "0 0 6px", background: "linear-gradient(135deg, #00ff88, #00aaff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            ADVERSARIAL DEFENSE SYSTEM
          </h1>
          <p style={{ color: "#555", fontSize: 12, letterSpacing: "0.2em" }}>FGSM ATTACK SIMULATION · FEATURE SQUEEZING DEFENSE · RESNET50V2</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, alignItems: "start" }}>

          {/* ── Left Panel: Controls ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Upload */}
            <div style={{ background: "#0c0c14", border: "1px solid #1a1a2e", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: "#00aaff", letterSpacing: "0.2em", marginBottom: 12 }}>► INPUT / CONFIGURATION</div>

              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  border: "2px dashed #1a2a3a", borderRadius: 8, padding: "20px 12px",
                  textAlign: "center", cursor: "pointer", marginBottom: 12,
                  transition: "border-color 0.2s",
                  background: preview ? "transparent" : "#080810"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#00aaff55"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1a2a3a"}
              >
                {preview ? (
                  <div style={{ position: "relative" }}>
                    <img src={preview} alt="Preview" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6, display: "block" }} />
                    {loading && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg, transparent, #00ff88, transparent)", top: `${scanLine}%`, transition: "top 0.02s linear", boxShadow: "0 0 8px #00ff88" }} />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#00ff88", fontSize: 11 }}>SCANNING...</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>⬆</div>
                    <div style={{ color: "#444", fontSize: 11 }}>Click to upload image</div>
                    <div style={{ color: "#333", fontSize: 10, marginTop: 2 }}>PNG, JPG, WEBP supported</div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} style={{ display: "none" }} />

              {/* Epsilon slider */}
              <div style={{ background: "#080810", border: "1px solid #1a1a2e", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 6 }}>
                  <span style={{ color: "#888" }}>ATTACK STRENGTH (ε)</span>
                  <span style={{ color: "#ffaa00", fontWeight: "bold" }}>{attackStrength}</span>
                </div>
                <input
                  type="range" min="0.01" max="0.30" step="0.01" value={attackStrength}
                  onChange={e => setAttackStrength(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#ffaa00" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#333", marginTop: 3 }}>
                  <span>Imperceptible</span><span>Extreme</span>
                </div>
              </div>

              {/* Defense selector */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: "#888", marginBottom: 6 }}>DEFENSE METHOD</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[["squeeze", "Feature Squeezing", "Bit-depth reduction"], ["smooth", "Median Filter", "Spatial smoothing"]].map(([val, name, sub]) => (
                    <button
                      key={val}
                      onClick={() => setDefenseMethod(val)}
                      style={{
                        padding: "8px 6px", borderRadius: 6, border: `1px solid ${defenseMethod === val ? "#00aaff" : "#1a1a2e"}`,
                        background: defenseMethod === val ? "#00aaff18" : "#080810",
                        color: defenseMethod === val ? "#00aaff" : "#555",
                        fontSize: 9, cursor: "pointer", textAlign: "center", transition: "all 0.2s"
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: 2 }}>{name}</div>
                      <div style={{ color: defenseMethod === val ? "#00aaff88" : "#333" }}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={analyzeImage}
                disabled={!image || loading}
                style={{
                  width: "100%", padding: "12px", borderRadius: 8, border: "none",
                  background: !image || loading ? "#111" : "linear-gradient(135deg, #00aa55, #00ff88)",
                  color: !image || loading ? "#333" : "#000",
                  fontFamily: "monospace", fontWeight: "bold", fontSize: 12,
                  cursor: !image || loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.1em", transition: "all 0.2s",
                  boxShadow: image && !loading ? "0 0 20px #00ff8844" : "none"
                }}
              >
                {loading ? "▶ ANALYZING..." : "▶ DEPLOY ATTACK & DEFENSE"}
              </button>

              {error && (
                <div style={{ marginTop: 10, padding: 10, background: "#1a0808", border: "1px solid #ff333344", borderRadius: 6, color: "#ff6666", fontSize: 11 }}>
                  ✗ {error}
                </div>
              )}
            </div>

            {/* History */}
            <div style={{ background: "#0c0c14", border: "1px solid #1a1a2e", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 10, color: "#00aaff", letterSpacing: "0.2em", marginBottom: 10 }}>► ANALYSIS HISTORY</div>
              {history.length === 0 ? (
                <div style={{ color: "#333", fontSize: 11, textAlign: "center", padding: "12px 0" }}>No analyses yet</div>
              ) : (
                history.map((entry, i) => <HistoryEntry key={i} entry={entry} index={i} />)
              )}
            </div>
          </div>

          {/* ── Right Panel: Results ── */}
          <div style={{ background: "#0c0c14", border: "1px solid #1a1a2e", borderRadius: 12, overflow: "hidden" }}>

            {/* Status bar */}
            <div style={{ padding: "12px 16px", background: results ? statusColor + "18" : "#080810", borderBottom: `1px solid ${results ? statusColor + "44" : "#1a1a2e"}`, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: results ? statusColor : "#222", boxShadow: results ? `0 0 10px ${statusColor}` : "none" }} />
              <span style={{ fontFamily: "monospace", fontWeight: "bold", fontSize: 13, color: results ? statusColor : "#444", letterSpacing: "0.05em", flex: 1 }}>
                {results ? results.status : "AWAITING INPUT — UPLOAD IMAGE TO BEGIN ANALYSIS"}
              </span>
              {results && <span style={{ fontSize: 10, color: "#555" }}>{results.metrics.processing_time_s}s</span>}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1a1a2e" }}>
              {tabs.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "10px 4px", background: "none", border: "none",
                    borderBottom: activeTab === tab ? "2px solid #00aaff" : "2px solid transparent",
                    color: activeTab === tab ? "#00aaff" : "#444",
                    fontFamily: "monospace", fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div style={{ padding: 16 }}>
              {/* Empty state */}
              {!results && !loading && (
                <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ fontSize: 48, opacity: 0.1 }}>⚡</div>
                  <div style={{ color: "#333", fontSize: 11, textAlign: "center", letterSpacing: "0.1em" }}>
                    CONFIGURE PARAMETERS<br />AND UPLOAD AN IMAGE TO BEGIN
                  </div>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div style={{ height: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {["Preprocessing image tensor...", "Running FGSM adversarial attack...", "Applying defense mechanism...", "Computing anomaly score..."].map((msg, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#00ff88", opacity: 0.4 + i * 0.15, animation: `pulse ${1 + i * 0.3}s infinite`, fontFamily: "monospace" }}>
                      {'> '}{msg}
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB: OVERVIEW ── */}
              {results && activeTab === "overview" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <ThreatMeter score={results.threat_score} />
                      <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>THREAT SCORE</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, justifyContent: "center" }}>
                      {[
                        ["Classification Flipped", results.classification_flipped ? "YES" : "NO", results.classification_flipped ? "#ff3333" : "#00ff88"],
                        ["Defense Recovered", results.defense_recovered ? "YES" : "NO", results.defense_recovered ? "#00ff88" : "#ff3333"],
                        ["Defense Method", results.defense_method.split(" (")[0], "#00aaff"],
                        ["Epsilon Used", `ε = ${results.metrics.epsilon}`, "#ffaa00"],
                      ].map(([label, val, color]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "4px 8px", background: "#080810", borderRadius: 4 }}>
                          <span style={{ fontSize: 10, color: "#555" }}>{label}</span>
                          <span style={{ fontSize: 10, fontWeight: "bold", color }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick prediction comparison */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      ["ORIGINAL", results.original.top5[0], "#00aaff"],
                      ["ATTACKED", results.attacked.top5[0], "#ff4444"],
                      ["DEFENDED", results.defended.top5[0], "#00ff88"],
                    ].map(([label, pred, color]) => (
                      <div key={label} style={{ background: "#080810", border: `1px solid ${color}22`, borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.15em", marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 10, color, fontWeight: "bold", marginBottom: 2 }}>{pred?.label || "—"}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>{pred?.confidence.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── TAB: PREDICTIONS ── */}
              {results && activeTab === "predictions" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                  {[
                    ["ORIGINAL", results.original.top5, "#00aaff"],
                    ["AFTER ATTACK", results.attacked.top5, "#ff4444"],
                    ["AFTER DEFENSE", results.defended.top5, "#00ff88"],
                  ].map(([label, top5, color]) => (
                    <div key={label}>
                      <div style={{ fontSize: 9, color, letterSpacing: "0.2em", marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${color}33` }}>{label}</div>
                      {top5.map((p, i) => (
                        <ConfidenceBar key={p.label} label={p.label} confidence={p.confidence} color={color} rank={i} />
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* ── TAB: IMAGES ── */}
              {results && activeTab === "images" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <ImagePanel title="ORIGINAL INPUT" b64={results.original.image_b64} accent="#00aaff">
                    <ConfidenceBar label={results.original.top5[0]?.label} confidence={results.original.top5[0]?.confidence} color="#00aaff" />
                  </ImagePanel>
                  <ImagePanel title={`FGSM ATTACK ε=${results.metrics.epsilon}`} b64={results.attacked.image_b64} accent="#ff4444">
                    <ConfidenceBar label={results.attacked.top5[0]?.label} confidence={results.attacked.top5[0]?.confidence} color="#ff4444" />
                    <div style={{ fontSize: 9, color: "#666", marginTop: 4 }}>PSNR: {results.metrics.attack_psnr_db} dB</div>
                  </ImagePanel>
                  <ImagePanel title="AFTER DEFENSE" b64={results.defended.image_b64} accent="#00ff88">
                    <ConfidenceBar label={results.defended.top5[0]?.label} confidence={results.defended.top5[0]?.confidence} color="#00ff88" />
                    <div style={{ fontSize: 9, color: "#666", marginTop: 4 }}>PSNR: {results.metrics.recovery_psnr_db} dB</div>
                  </ImagePanel>
                </div>
              )}

              {/* ── TAB: METRICS ── */}
              {results && activeTab === "metrics" && (
                <div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                    <MetricCard label="Anomaly L1" value={results.metrics.anomaly_score_l1} color="#ffaa00" />
                    <MetricCard label="Anomaly L2" value={results.metrics.anomaly_score_l2} color="#ffaa00" />
                    <MetricCard label="Pixel Δ" value={results.metrics.pixel_perturbation} color="#ff8888" />
                    <MetricCard label="Attack PSNR" value={results.metrics.attack_psnr_db} unit="dB" color="#ff4444" />
                    <MetricCard label="Recovery PSNR" value={results.metrics.recovery_psnr_db} unit="dB" color="#00ff88" />
                    <MetricCard label="Proc. Time" value={results.metrics.processing_time_s} unit="s" color="#00aaff" />
                  </div>
                  <div style={{ background: "#080810", border: "1px solid #1a1a2e", borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 10, color: "#444", marginBottom: 8 }}>TECHNICAL NOTES</div>
                    <div style={{ fontSize: 10, color: "#555", lineHeight: 1.8 }}>
                      • <span style={{ color: "#888" }}>FGSM</span>: Fast Gradient Sign Method — computes gradient of loss w.r.t. input pixels<br />
                      • <span style={{ color: "#888" }}>Feature Squeezing</span>: Reduces bit-depth to 5 bits (32 levels), removing high-freq perturbations<br />
                      • <span style={{ color: "#888" }}>Anomaly Score</span>: L1/L2 distance between attacked vs defended prediction distributions<br />
                      • <span style={{ color: "#888" }}>PSNR</span>: Peak Signal-to-Noise Ratio — higher = less visual distortion ({">"} 30dB is perceptually similar)<br />
                      • <span style={{ color: "#888" }}>Alarm threshold</span>: L1 {">"} 0.5 triggers CRITICAL alert
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        * { box-sizing: border-box; }
        input[type=range] { cursor: pointer; }
        ::-webkit-scrollbar { width: 4px; } 
        ::-webkit-scrollbar-track { background: #080810; }
        ::-webkit-scrollbar-thumb { background: #1a1a2e; border-radius: 2px; }
      `}</style>
    </main>
  );
}
