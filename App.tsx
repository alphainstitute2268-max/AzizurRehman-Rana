
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AppStatus, Scene, ScriptAnalysis, UserSettings, GeneratedImageRecord } from './types';
import { parseScript, suggestStyleFromTopic, generateSceneImage } from './services/geminiService';
import SceneCard from './components/SceneCard';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [scriptText, setScriptText] = useState('');
  const [style, setStyle] = useState('');
  const [topic, setTopic] = useState('');
  const [requestedPrompts, setRequestedPrompts] = useState(24);
  const [analysis, setAnalysis] = useState<ScriptAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSuggestingStyle, setIsSuggestingStyle] = useState(false);
  const [history, setHistory] = useState<GeneratedImageRecord[]>([]);
  
  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStyleFilter, setHistoryStyleFilter] = useState<string>('all');
  const [historySort, setHistorySort] = useState<'newest' | 'oldest' | 'scene_asc' | 'scene_desc'>('newest');
  
  const [userSettings, setUserSettings] = useState<UserSettings>({
    generatedImageCount: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          fullText += textContent.items.map((item: any) => (item as any).str).join(' ') + '\n';
        }
        setScriptText(fullText);
      } catch (err) {
        setError("Error processing PDF. Ensure it has readable text.");
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => setScriptText(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const handleTopicBlur = async () => {
    if (!topic || style) return;
    setIsSuggestingStyle(true);
    try {
      const suggested = await suggestStyleFromTopic(topic);
      setStyle(suggested);
    } catch (err) {
      console.error("Style suggestion error:", err);
    } finally {
      setIsSuggestingStyle(false);
    }
  };

  const handleAnalyze = async () => {
    if (!scriptText.trim()) {
      setError("Please upload or paste a script first.");
      return;
    }
    
    setStatus(AppStatus.ANALYZING);
    setError(null);
    try {
      const result = await parseScript(scriptText, topic || "Untitled", style || "Cinematic", requestedPrompts);
      setAnalysis(result);
      setStatus(AppStatus.READY);
    } catch (err) {
      console.error("Analysis Error:", err);
      setError("Failed to understand script. Try reducing prompt count or checking script content for complex formatting errors.");
      setStatus(AppStatus.ERROR);
    }
  };

  const onGenerateImage = async (scene: Scene, seed?: number) => {
    try {
      const imageUrl = await generateSceneImage(scene.imagePrompt, seed);
      
      setAnalysis(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: prev.scenes.map(s => s.id === scene.id ? { ...s, imageUrl } : s)
        };
      });

      const record: GeneratedImageRecord = {
        timestamp: Date.now(),
        imageUrl,
        prompt: scene.imagePrompt,
        sceneTitle: scene.title,
        sceneNumber: scene.sceneNumber,
        style: analysis?.projectStyle || style || 'Cinematic'
      };
      setHistory(prev => [record, ...prev].slice(0, 100)); // Increased history limit

      setUserSettings(prev => ({ ...prev, generatedImageCount: prev.generatedImageCount + 1 }));
    } catch (err) {
      console.error("Image Generation Error:", err);
      alert("Error generating image. This may be due to safety filters regarding historical distress or network issues.");
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setStatus(AppStatus.IDLE);
    setScriptText('');
    setTopic('');
    setStyle('');
    setRequestedPrompts(24);
    setError(null);
  };

  const formatDate = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter Logic
  const uniqueStyles = useMemo(() => {
    return Array.from(new Set(history.map(r => r.style))).filter(Boolean);
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history
      .filter(record => {
        const matchesSearch = (
          record.sceneTitle.toLowerCase().includes(historySearch.toLowerCase()) ||
          record.prompt.toLowerCase().includes(historySearch.toLowerCase()) ||
          record.sceneNumber.toString().includes(historySearch)
        );
        const matchesStyle = historyStyleFilter === 'all' || record.style === historyStyleFilter;
        return matchesSearch && matchesStyle;
      })
      .sort((a, b) => {
        if (historySort === 'newest') return b.timestamp - a.timestamp;
        if (historySort === 'oldest') return a.timestamp - b.timestamp;
        if (historySort === 'scene_asc') return a.sceneNumber - b.sceneNumber;
        if (historySort === 'scene_desc') return b.sceneNumber - a.sceneNumber;
        return 0;
      });
  }, [history, historySearch, historyStyleFilter, historySort]);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-blue-500/30">
      {/* Top Navigation / Status */}
      <nav className="bg-slate-900/90 border-b border-slate-800 px-8 py-3 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-[100] backdrop-blur-md">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-blue-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span>CONTEXTUAL ENGINE 4.2</span>
          </div>
          <div className="w-[1px] h-3 bg-slate-800"></div>
          <span className="text-indigo-400">UNLIMITED GENERATION ENABLED</span>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-slate-400">Total Assets Created: <span className="text-blue-500">{userSettings.generatedImageCount}</span></div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16 w-full flex-1">
        {status !== AppStatus.READY ? (
          <div className="space-y-16">
            <div className="text-center space-y-5">
              <h1 className="text-6xl font-black text-white tracking-tighter">ScriptVisualizer</h1>
              <p className="text-slate-400 text-lg max-w-xl mx-auto font-medium leading-relaxed">
                Transform historical screenplays into authentic visual storyboards. 
                <span className="text-blue-500 block mt-2">Professional Grade & Unlimited Creation.</span>
              </p>
            </div>

            <div className="bg-slate-900/30 border border-slate-800 p-10 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.4)] space-y-12">
              <div className="space-y-5">
                <div className="flex items-center justify-between px-2">
                  <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    1. Script Content
                  </label>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700 hover:border-slate-500 transition-all"
                  >
                    Upload PDF / TXT
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.pdf" onChange={handleFileUpload} />
                </div>
                <textarea 
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="Paste your screenplay here..."
                  className="w-full h-64 bg-slate-950 border border-slate-800 rounded-[2rem] p-8 text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest px-2">2. Visual Style</label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="e.g. Gritty 35mm B&W"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                    />
                    {isSuggestingStyle && <div className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest px-2">3. Historical Topic</label>
                  <input 
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onBlur={handleTopicBlur}
                    placeholder="e.g. Victorian Workhouse"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-white font-bold focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[11px] font-black text-blue-500 uppercase tracking-widest px-2">4. Precision Frames (1-500)</label>
                <div className="flex items-center gap-6">
                  <input 
                    type="range"
                    min="1"
                    max="500"
                    value={requestedPrompts}
                    onChange={(e) => setRequestedPrompts(parseInt(e.target.value))}
                    className="flex-1 accent-blue-600 h-2 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <input 
                    type="number"
                    value={requestedPrompts}
                    onChange={(e) => setRequestedPrompts(Math.min(500, parseInt(e.target.value) || 1))}
                    className="w-24 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-black text-center text-xl"
                  />
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-6 rounded-3xl text-xs font-bold animate-pulse">{error}</div>}

              <button 
                onClick={handleAnalyze}
                disabled={status === AppStatus.ANALYZING || !scriptText.trim()}
                className={`w-full py-8 rounded-[2rem] font-black text-2xl shadow-2xl transition-all flex items-center justify-center gap-5 relative overflow-hidden group ${
                  status === AppStatus.ANALYZING ? 'bg-slate-800 text-slate-500' : 'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.01] active:scale-[0.99]'
                }`}
              >
                {status === AppStatus.ANALYZING ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                    <span className="uppercase tracking-widest text-sm">Understanding Subtext...</span>
                  </>
                ) : (
                  <>
                    <span>Begin Contextual Mapping</span>
                    <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="flex flex-col md:flex-row items-end justify-between gap-8 border-b border-slate-800 pb-12">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full">Analysis Complete</span>
                  <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{analysis?.scenes.length} Authentic Beats</span>
                </div>
                <h2 className="text-6xl font-black text-white tracking-tighter leading-tight">{analysis?.projectTitle}</h2>
                <div className="flex items-center gap-3 text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                  <p className="text-sm font-black uppercase tracking-[0.2em]">{analysis?.projectStyle}</p>
                </div>
              </div>
              <button 
                onClick={handleReset} 
                className="px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white border border-slate-800 hover:border-slate-600 transition-all flex items-center gap-3"
              >
                Start New Project
              </button>
            </div>

            <div className="space-y-20">
              {analysis?.scenes.map((scene) => (
                <SceneCard 
                  key={scene.id} 
                  scene={scene} 
                  onGenerate={(seed?: number) => onGenerateImage(scene, seed)}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      <aside className="w-full bg-[#010409] border-t border-slate-800 p-12 md:p-20 mt-20">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* History Header & Controls */}
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white tracking-tighter">Generated Asset History</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">Historical Archive & Visual Metadata</p>
              </div>
              <div className="flex items-center gap-4 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">{history.length} Assets Logged</span>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])} className="text-[9px] font-black text-red-500/50 hover:text-red-400 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-xl transition-all">Clear Archive</button>
                )}
              </div>
            </div>

            {/* Filters Toolbar */}
            {history.length > 0 && (
              <div className="bg-slate-900/20 p-5 rounded-3xl border border-slate-800/50 flex flex-col lg:flex-row gap-4 justify-between items-center backdrop-blur-sm">
                <div className="w-full lg:w-1/3 relative">
                  <input 
                      type="text" 
                      placeholder="Filter by scene title, prompt text, or ID..." 
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 pl-10 text-xs font-bold text-slate-200 focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-slate-700 transition-all"
                  />
                  <svg className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="relative group">
                    <select 
                        value={historyStyleFilter} 
                        onChange={(e) => setHistoryStyleFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pr-8 text-[10px] font-black uppercase tracking-widest text-slate-400 focus:text-white outline-none appearance-none cursor-pointer hover:border-slate-600 transition-colors min-w-[140px]"
                    >
                        <option value="all">All Styles</option>
                        {uniqueStyles.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>

                  <div className="relative group">
                    <select 
                      value={historySort} 
                      onChange={(e) => setHistorySort(e.target.value as any)}
                      className="bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pr-8 text-[10px] font-black uppercase tracking-widest text-slate-400 focus:text-white outline-none appearance-none cursor-pointer hover:border-slate-600 transition-colors min-w-[140px]"
                    >
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="scene_asc">Scene 1-99</option>
                        <option value="scene_desc">Scene 99-1</option>
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Empty States */}
          {history.length === 0 ? (
            <div className="text-center py-32 border-2 border-dashed border-slate-800 rounded-[3rem] bg-slate-900/10 group hover:border-blue-500/20 transition-all">
              <div className="flex flex-col items-center gap-5 opacity-20 group-hover:opacity-40 transition-opacity">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <span className="text-sm font-black uppercase tracking-[0.4em]">Historical Log Empty</span>
              </div>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-20 border border-slate-800 rounded-[3rem] bg-slate-900/20">
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">No assets match current filters</p>
              <button onClick={() => {setHistorySearch(''); setHistoryStyleFilter('all');}} className="mt-4 text-blue-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors">Clear Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {filteredHistory.map((record) => (
                <div key={record.timestamp} className="group relative bg-[#020617] border border-slate-800 rounded-3xl overflow-hidden hover:border-blue-500/40 transition-all flex flex-col shadow-2xl">
                  <div className="aspect-video bg-black overflow-hidden relative">
                    <img src={record.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" loading="lazy" />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg text-[8px] font-black text-slate-400 border border-white/5">
                      {formatDate(record.timestamp)}
                    </div>
                  </div>

                  <div className="p-6 space-y-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Beat {record.sceneNumber}</span>
                      <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">{record.style.slice(0, 20)}{record.style.length > 20 ? '...' : ''}</span>
                    </div>
                    
                    <h4 className="text-xs font-black text-white truncate group-hover:text-blue-400 transition-colors uppercase">{record.sceneTitle}</h4>
                    
                    <div className="relative flex-1">
                      <p className="text-[9px] text-slate-500 font-medium leading-relaxed line-clamp-4 italic bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                        "{record.prompt}"
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 mt-auto flex items-center justify-between gap-2">
                       <button 
                         onClick={() => {
                            const link = document.createElement('a');
                            link.href = record.imageUrl;
                            link.download = `frame_${record.sceneNumber}_${record.timestamp}.png`;
                            link.click();
                         }}
                         className="text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest flex items-center gap-2 transition-colors"
                       >
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         Export
                       </button>
                       <span className="text-[8px] font-bold text-slate-700 uppercase">Contextual-ID: {record.timestamp.toString().slice(-4)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      <footer className="py-20 text-center text-[10px] font-black text-slate-800 uppercase tracking-[0.6em] border-t border-slate-900">
        Engineered with Google Gemini &bull; ScriptVisualizer Context System 4.2
      </footer>
    </div>
  );
};

export default App;
