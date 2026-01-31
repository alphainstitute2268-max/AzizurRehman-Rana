
import React, { useState } from 'react';
import { Scene } from '../types';

interface SceneCardProps {
  scene: Scene;
  onGenerate: (seed?: number) => Promise<void>;
}

const SceneCard: React.FC<SceneCardProps> = ({ scene, onGenerate }) => {
  const [loading, setLoading] = useState(false);
  const [currentSeed, setCurrentSeed] = useState<number>(Math.floor(Math.random() * 1000000));

  const handleCreateImage = async (useExistingSeed: boolean = false) => {
    setLoading(true);
    const seedToUse = useExistingSeed ? currentSeed : Math.floor(Math.random() * 1000000);
    setCurrentSeed(seedToUse);
    await onGenerate(seedToUse);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-8 md:p-10 space-y-10 group hover:border-blue-500/20 transition-all shadow-xl">
      {/* 1. Prompt Display (The Roadmap) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-xs font-black text-blue-500 border border-slate-800">
              {scene.sceneNumber}
            </div>
            <h4 className="text-xl font-black text-slate-100 uppercase tracking-tight">{scene.title}</h4>
          </div>
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Historical context enabled</span>
        </div>

        <div className="space-y-3">
          <label className="text-[9px] font-black text-blue-500/50 uppercase tracking-[0.3em] px-1">Visual Direction & Prompt</label>
          <div className="bg-black/40 border border-slate-800/50 p-6 rounded-2xl text-slate-300 text-sm leading-relaxed font-medium italic border-l-4 border-l-blue-500/30">
            {scene.imagePrompt}
          </div>
        </div>
      </div>

      {/* 2. Individual Image Display (Shows after generation) */}
      {scene.imageUrl && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
          <label className="text-[9px] font-black text-green-500/50 uppercase tracking-[0.3em] px-1">Rendered Visual</label>
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden border border-slate-700 shadow-2xl">
            <img src={scene.imageUrl} alt={scene.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* 3. Creation Actions */}
      <div className="flex flex-col md:flex-row gap-4 pt-4">
        <button 
          onClick={() => handleCreateImage(false)}
          disabled={loading}
          className={`flex-[2] py-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 relative overflow-hidden ${
            loading ? 'bg-slate-800 text-slate-500 cursor-not-allowed' :
            'bg-blue-600 hover:bg-blue-500 text-white hover:scale-[1.01]'
          }`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Rendering Authentic Frame...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {scene.imageUrl ? "Re-Render Frame" : "Create Individual Image"}
            </>
          )}
        </button>

        {scene.imageUrl && (
          <button 
            onClick={() => handleCreateImage(true)}
            disabled={loading}
            className="flex-1 py-6 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white hover:border-slate-600 transition-all flex items-center justify-center gap-3"
            title="Maintain grit and lighting consistency with same seed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Maintain Seed
          </button>
        )}
      </div>
    </div>
  );
};

export default SceneCard;
