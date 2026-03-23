"use client";
import { useState } from "react";

export default function Home() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  // NEW: State for the slider (starts at 0.05)
  const [attackStrength, setAttackStrength] = useState(0.05);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
      setResults(null);
      setError(null);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", image);
    // NEW: Attach the slider value to the data we send to Python
    formData.append("strength", attackStrength);

    try {
      const res = await fetch("http://127.0.0.1:5000/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">AI Security Firewall</h1>
          <p className="text-gray-400">Adversarial Attack Detection via Feature Squeezing</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Left Column: Upload & Controls */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">1. Threat Configuration</h2>
            
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 mb-4 cursor-pointer"
            />

            {/* NEW: The Attack Strength Slider */}
            <div className="mb-6 bg-gray-900 p-4 rounded-lg border border-gray-700">
              <label className="flex justify-between text-sm font-semibold text-gray-300 mb-2">
                <span>Hacker Attack Strength (Epsilon)</span>
                <span className="text-yellow-400">{attackStrength}</span>
              </label>
              <input 
                type="range" 
                min="0.01" 
                max="0.30" 
                step="0.01" 
                value={attackStrength} 
                onChange={(e) => setAttackStrength(parseFloat(e.target.value))}
                className="w-full accent-yellow-400"
              />
              <p className="text-xs text-gray-500 mt-2">
                Higher values create more noise, forcing the AI to misclassify robust images.
              </p>
            </div>

            {preview && (
              <div className="mb-6">
                <img src={preview} alt="Preview" className="w-full h-64 object-cover rounded-lg border-2 border-gray-600" />
              </div>
            )}

            <button 
              onClick={analyzeImage}
              disabled={!image || loading}
              className={`w-full py-3 rounded-lg font-bold text-white transition-all ${!image || loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 shadow-lg shadow-green-500/30'}`}
            >
              {loading ? "Analyzing Security..." : "Deploy Attack & Defense"}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm">
                Error: {error}
              </div>
            )}
          </div>

          {/* Right Column: Results Section */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4 border-b border-gray-700 pb-2">2. System Diagnostics</h2>
            
            {!results && !loading && (
              <div className="h-64 flex items-center justify-center text-gray-500 italic text-center">
                Awaiting image input...
              </div>
            )}

            {loading && (
              <div className="h-64 flex flex-col items-center justify-center text-blue-400 animate-pulse">
                <div className="text-4xl mb-2">⚙️</div>
                <p>Injecting Noise Pattern...</p>
                <p>Applying Feature Squeezing...</p>
              </div>
            )}

            {results && (
              <div className="space-y-4 animate-fade-in">
                <div className={`p-4 rounded-lg font-bold text-center text-lg ${results.status.includes("ALARM") ? 'bg-red-900/80 text-red-200 border border-red-500 shadow-lg shadow-red-900/50' : 'bg-green-900/80 text-green-200 border border-green-500'}`}>
                  {results.status}
                </div>

                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Original AI Sees:</span>
                    <span className="font-semibold text-white">{results.original_prediction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">After Hacker Attack:</span>
                    <span className="font-semibold text-red-400">{results.attacked_prediction}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">After Squeezer Defense:</span>
                    <span className="font-semibold text-green-400">{results.defended_prediction}</span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-800 mt-2">
                    <span className="text-gray-400">Anomaly Distance Score:</span>
                    <span className="font-mono text-yellow-400">{results.anomaly_score.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  );
}