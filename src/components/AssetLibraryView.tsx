import React, { useRef, useState } from 'react';
import { Upload, Trash2, Plus, Sparkles, Image as ImageIcon, Film, Music, Box, FileText, Eye } from 'lucide-react';
import { AssetKind, MediaAsset, Project } from '../types/studio';
import { LoadedMediaCache } from '../engine/compositor';
import { AiClient } from '../services/aiClient';

interface AssetLibraryViewProps {
  project: Project;
  assets: MediaAsset[];
  mediaCache: LoadedMediaCache;
  onUploadFiles: (files: FileList) => Promise<void>;
  onAddGeneratedAsset: (asset: MediaAsset, blob: Blob) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onInsertAssetToTimeline: (asset: MediaAsset) => void;
}

const FILTER_KINDS: Array<{ id: 'all' | AssetKind; label: string }> = [
  { id: 'all', label: 'All Assets' },
  { id: 'image', label: 'Images' },
  { id: 'video', label: 'Videos' },
  { id: 'audio', label: 'Audio' },
  { id: 'svg', label: 'SVG' },
  { id: 'model3d', label: '3D Models (GLB)' },
  { id: 'document', label: 'Documents' },
];

export const AssetLibraryView: React.FC<AssetLibraryViewProps> = ({
  project,
  assets,
  mediaCache,
  onUploadFiles,
  onAddGeneratedAsset,
  onDeleteAsset,
  onInsertAssetToTimeline,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | AssetKind>('all');
  const [search, setSearch] = useState('');
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgModel, setImgModel] = useState('gemini-3.1-flash-lite-image');
  const [imgAspect, setImgAspect] = useState<string>(
    project.settings.aspectRatio === 'custom' ? '16:9' : project.settings.aspectRatio
  );
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisText, setAnalysisText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = assets.filter((a) => {
    if (kindFilter !== 'all' && a.kind !== kindFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q));
    }
    return true;
  });

  const handleGenerateImage = async () => {
    if (!imgPrompt.trim()) {
      setError('Enter an image prompt before generating.');
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await AiClient.generateImage({
        prompt: imgPrompt.trim(),
        aspectRatio: imgAspect,
        model: imgModel,
        confirmedPaidUsage: confirmedPaid,
      });
      const bytes = Uint8Array.from(atob(res.base64Image), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: res.mimeType });
      const asset: MediaAsset = {
        id: `asset-gen-${Date.now()}`,
        projectId: project.id,
        name: `${imgPrompt.trim().slice(0, 28).replace(/\s+/g, '_')}.png`,
        kind: 'image',
        mimeType: res.mimeType,
        sizeBytes: blob.size,
        createdAt: new Date().toISOString(),
        tags: ['ai-generated', res.modelUsed],
        license: 'Generated via Gemini API',
        attribution: res.modelUsed,
        source: 'ai-generated',
        hasBlob: true,
      };
      await onAddGeneratedAsset(asset, blob);
      setImgPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleAnalyzeAsset = async (asset: MediaAsset) => {
    const blob = mediaCache.blobs.get(asset.id);
    if (!blob) return;
    setError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(blob);
      });
      const res = await AiClient.analyzeImage({ base64Image: base64, mimeType: asset.mimeType });
      setAnalysisText(`${asset.name}: ${res.analysis}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to analyze reference image.');
    }
  };

  const iconForKind = (kind: AssetKind) => {
    switch (kind) {
      case 'image':
      case 'svg':
      case 'gif':
      case 'background':
        return <ImageIcon className="w-4 h-4 text-sky-400" />;
      case 'video':
        return <Film className="w-4 h-4 text-indigo-400" />;
      case 'audio':
        return <Music className="w-4 h-4 text-emerald-400" />;
      case 'model3d':
        return <Box className="w-4 h-4 text-amber-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Asset Library</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload local images, videos, audio, SVGs, 3D GLB/GLTF models, or reference documents. Stored locally in IndexedDB.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*,.svg,.glb,.gltf,.txt,.md,.json,.pdf"
            onChange={(e) => {
              if (e.target.files?.length) {
                void onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Media / 3D Assets</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      {analysisText && (
        <div className="p-4 rounded-lg bg-[#11151D] border border-sky-800/60 text-xs text-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sky-400">Multimodal Reference Analysis</span>
            <button type="button" onClick={() => setAnalysisText(null)} className="text-slate-400 hover:text-white">
              Dismiss
            </button>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed text-slate-300">{analysisText}</p>
        </div>
      )}

      {/* Optional AI Asset Generation Panel (Honest Paid-Tier Gating) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 p-4 rounded-lg bg-[#11151D] border border-[#222836] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Optional AI Image Generation (Nano Banana)</span>
            </h2>
            <span className="text-[11px] font-mono text-amber-400">Requires Paid API Key</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <input
              type="text"
              value={imgPrompt}
              onChange={(e) => setImgPrompt(e.target.value)}
              placeholder="Describe a custom visual backdrop, diagram illustration, or product render..."
              className="sm:col-span-7 bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-xs text-slate-100"
            />
            <select
              aria-label="Image generation model"
              value={imgModel}
              onChange={(e) => setImgModel(e.target.value)}
              className="sm:col-span-3 bg-[#0B0E14] border border-[#283044] rounded-md px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="gemini-3.1-flash-lite-image">Nano Banana Lite</option>
              <option value="gemini-nano-banana-2.1">Nano Banana 2.1</option>
            </select>
            <select
              aria-label="Image aspect ratio"
              value={imgAspect}
              onChange={(e) => setImgAspect(e.target.value)}
              className="sm:col-span-2 bg-[#0B0E14] border border-[#283044] rounded-md px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedPaid}
                onChange={(e) => setConfirmedPaid(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Confirm paid-tier image generation request</span>
            </label>
            <button
              type="button"
              disabled={generating}
              onClick={handleGenerateImage}
              className="px-3.5 py-1.5 rounded-md bg-[#1B2231] border border-[#323D54] text-xs font-medium text-slate-100 hover:bg-[#242D40] disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Image'}
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 p-4 rounded-lg bg-[#11151D] border border-[#222836] space-y-2">
          <h2 className="text-sm font-semibold text-slate-200">Generative Video & Music Adapters</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Gemini Omni / Veo (<span className="font-mono">gemini-omni-1.2-flash</span>) and Lyria (
            <span className="font-mono">lyria-3-clip-preview</span>) are registered in Settings as optional paid-tier async adapters.
          </p>
          <p className="text-xs text-slate-400">
            All production workflows operate fully without generative video by combining uploaded clips, 3D models, and the deterministic 20-component motion graphics engine.
          </p>
        </div>
      </div>

      {/* Filter Bar & Asset Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#11151D] border border-[#222836] rounded-lg">
            {FILTER_KINDS.map((fk) => (
              <button
                key={fk.id}
                type="button"
                onClick={() => setKindFilter(fk.id)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  kindFilter === fk.id ? 'bg-[#222A3C] text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {fk.label}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets or tags..."
            aria-label="Search assets"
            className="bg-[#11151D] border border-[#283044] rounded-md px-3 py-1.5 text-xs text-slate-100"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center rounded-lg border border-dashed border-[#2A3244] bg-[#0F131B]">
            <p className="text-sm text-slate-300">No media assets uploaded for this filter yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload images, videos, narration/music audio, SVGs, or .GLB/.GLTF 3D models to use them in scenes and timeline tracks.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 px-4 py-2 rounded-md bg-[#1A202D] border border-[#2D364B] text-xs font-medium text-slate-100 hover:bg-[#232B3D]"
            >
              Choose Files to Upload
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((asset) => {
              const imgEl = mediaCache.images.get(asset.id);
              const kb = (asset.sizeBytes / 1024).toFixed(1);
              return (
                <div
                  key={asset.id}
                  className="rounded-lg bg-[#11151D] border border-[#222836] overflow-hidden flex flex-col justify-between"
                >
                  <div className="h-32 bg-[#090C11] flex items-center justify-center overflow-hidden border-b border-[#1D2230]">
                    {imgEl?.src ? (
                      <img
                        src={imgEl.src}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-slate-400">
                        {iconForKind(asset.kind)}
                        <span className="text-[11px] font-mono uppercase">{asset.kind}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-100 truncate">{asset.name}</p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                        {asset.kind} · {kb} KB · {asset.source}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-[#1D2230]">
                      <button
                        type="button"
                        onClick={() => onInsertAssetToTimeline(asset)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1B2231] text-[11px] font-medium text-slate-100 hover:bg-[#252E42]"
                      >
                        <Plus className="w-3 h-3 text-amber-400" />
                        <span>Add to Timeline</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {asset.kind === 'image' && (
                          <button
                            type="button"
                            aria-label={`Analyze ${asset.name}`}
                            onClick={() => handleAnalyzeAsset(asset)}
                            className="p-1.5 rounded text-slate-400 hover:text-sky-300 hover:bg-[#1A202D]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete ${asset.name}`}
                          onClick={() => onDeleteAsset(asset.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
