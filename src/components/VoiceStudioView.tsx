import React, { useState } from 'react';
import { Mic, Volume2, Download, Plus, FileAudio, Sparkles } from 'lucide-react';
import { MediaAsset, Project, VoiceSettings } from '../types/studio';
import { AiClient } from '../services/aiClient';
import { computeSceneWindows } from '../engine/timelineMath';

interface VoiceStudioViewProps {
  project: Project;
  audioAssets: MediaAsset[];
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onAddGeneratedAudio: (asset: MediaAsset, blob: Blob, sceneStartTime?: number) => Promise<void>;
}

const VOICES: Array<VoiceSettings['primaryVoice']> = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

export const VoiceStudioView: React.FC<VoiceStudioViewProps> = ({
  project,
  audioAssets,
  onUpdateProject,
  onAddGeneratedAudio,
}) => {
  const [selectedSceneId, setSelectedSceneId] = useState(project.storyboard[0]?.id || '');
  const [customText, setCustomText] = useState(project.storyboard[0]?.narration || '');
  const [synthesizing, setSynthesizing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const windows = computeSceneWindows(project.storyboard);
  const activeWin = windows.find((w) => w.scene.id === selectedSceneId) || windows[0];

  const handleSelectScene = (id: string) => {
    setSelectedSceneId(id);
    const sc = project.storyboard.find((s) => s.id === id);
    if (sc) setCustomText(sc.narration);
  };

  const handleSynthesize = async () => {
    if (!customText.trim()) {
      setError('Enter narration text before generating speech.');
      return;
    }
    setError(null);
    setSynthesizing(true);
    try {
      const res = await AiClient.synthesizeVoice({
        text: customText.trim(),
        voiceName: project.voiceSettings.primaryVoice,
        speakingStyle: project.voiceSettings.speakingStyle,
        multiSpeaker: project.voiceSettings.multiSpeaker,
        secondaryVoiceName: project.voiceSettings.secondaryVoice,
        model: project.voiceSettings.model,
      });
      const bytes = Uint8Array.from(atob(res.base64Audio), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'audio/wav' });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewBlob(blob);
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'TTS narration generation failed.');
    } finally {
      setSynthesizing(false);
    }
  };

  const handleCommitToTimeline = async () => {
    if (!previewBlob) return;
    const label = activeWin ? `${activeWin.scene.title}_narration.wav` : `narration_${Date.now()}.wav`;
    const asset: MediaAsset = {
      id: `asset-tts-${Date.now()}`,
      projectId: project.id,
      name: label,
      kind: 'audio',
      mimeType: 'audio/wav',
      sizeBytes: previewBlob.size,
      createdAt: new Date().toISOString(),
      tags: ['narration', 'gemini-tts', project.voiceSettings.primaryVoice],
      license: 'Generated narration',
      attribution: project.voiceSettings.model,
      source: 'tts-generated',
      audioCategory: 'narration',
      hasBlob: true,
    };
    await onAddGeneratedAudio(asset, previewBlob, activeWin?.startTime ?? 0);
  };

  const updateMix = (key: keyof Project['audioMix'], val: number) => {
    onUpdateProject((p) => ({
      ...p,
      audioMix: { ...p.audioMix, [key]: val },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Voice & Audio Studio</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Synthesize scene narration with Gemini 3.8 TTS, configure multi-speaker dialogue, and balance audio tracks.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Gemini TTS Narration Generator */}
        <div className="xl:col-span-7 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-400" />
              <span>Gemini Text-to-Speech Narration</span>
            </h2>
            <span className="text-xs font-mono text-slate-400">{project.voiceSettings.model}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Target Scene</span>
              <select
                value={selectedSceneId}
                onChange={(e) => handleSelectScene(e.target.value)}
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
              >
                {project.storyboard.map((sc, i) => (
                  <option key={sc.id} value={sc.id}>
                    {String(i + 1).padStart(2, '0')} · {sc.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Primary Voice</span>
              <select
                value={project.voiceSettings.primaryVoice}
                onChange={(e) =>
                  onUpdateProject((p) => ({
                    ...p,
                    voiceSettings: {
                      ...p.voiceSettings,
                      primaryVoice: e.target.value as VoiceSettings['primaryVoice'],
                    },
                  }))
                }
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
              >
                {VOICES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">TTS Mode</span>
              <select
                value={project.voiceSettings.multiSpeaker ? 'multi' : 'single'}
                onChange={(e) => {
                  const multi = e.target.value === 'multi';
                  onUpdateProject((p) => ({
                    ...p,
                    voiceSettings: {
                      ...p.voiceSettings,
                      multiSpeaker: multi,
                      model: multi ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts',
                    },
                  }));
                }}
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
              >
                <option value="single">Single Speaker (Flash Lite)</option>
                <option value="multi">Dual Speaker Dialogue (Flash TTS)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex flex-col gap-1">
              <span className="text-slate-400">Speaking Style Instruction</span>
              <input
                type="text"
                value={project.voiceSettings.speakingStyle}
                onChange={(e) =>
                  onUpdateProject((p) => ({
                    ...p,
                    voiceSettings: { ...p.voiceSettings, speakingStyle: e.target.value },
                  }))
                }
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-slate-100"
              />
            </label>
            {project.voiceSettings.multiSpeaker && (
              <label className="flex flex-col gap-1">
                <span className="text-slate-400">Secondary Voice</span>
                <select
                  value={project.voiceSettings.secondaryVoice}
                  onChange={(e) =>
                    onUpdateProject((p) => ({
                      ...p,
                      voiceSettings: {
                        ...p.voiceSettings,
                        secondaryVoice: e.target.value as VoiceSettings['secondaryVoice'],
                      },
                    }))
                  }
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  {VOICES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <label className="flex flex-col gap-1.5 text-xs">
            <span className="text-slate-400">Narration Script to Synthesize</span>
            <textarea
              rows={4}
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-sm text-slate-100 leading-relaxed"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={synthesizing}
              onClick={handleSynthesize}
              className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{synthesizing ? 'Synthesizing WAV...' : 'Generate Scene Narration'}</span>
            </button>
          </div>

          {previewUrl && (
            <div className="p-3.5 rounded-lg bg-[#0B0E14] border border-[#273044] space-y-3">
              <audio controls src={previewUrl} className="w-full h-9" />
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCommitToTimeline}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-500"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add to Audio Track at {activeWin ? `${activeWin.startTime.toFixed(1)}s` : '0.0s'}</span>
                </button>
                <a
                  href={previewUrl}
                  download={`narration_${selectedSceneId || 'clip'}.wav`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#1A202D] border border-[#2D364B] text-xs text-slate-200 hover:bg-[#232B3D]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download WAV</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right: 4-Bus Audio Mixer & Project Audio Library */}
        <div className="xl:col-span-5 space-y-5">
          <div className="p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Multitrack Audio Mixer</span>
            </h2>
            {(
              [
                ['narrationVolume', 'Narration Bus'],
                ['musicVolume', 'Background Music'],
                ['sfxVolume', 'Sound Effects'],
                ['ambientVolume', 'Ambient Audio'],
                ['masterVolume', 'Master Output'],
              ] as const
            ).map(([key, label]) => {
              const val = project.audioMix[key];
              return (
                <label key={key} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-mono text-slate-400 tabular-nums">{Math.round(val * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.25}
                    step={0.05}
                    value={val}
                    onChange={(e) => updateMix(key, Number(e.target.value))}
                    className="accent-emerald-500"
                  />
                </label>
              );
            })}
          </div>

          <div className="p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-3">
            <h2 className="text-sm font-semibold text-slate-200">Project Audio Clips ({audioAssets.length})</h2>
            {audioAssets.length === 0 ? (
              <p className="text-xs text-slate-500">
                No audio files attached yet. Generate narration above or upload audio recordings in Asset Library.
              </p>
            ) : (
              <div className="divide-y divide-[#1E2330]">
                {audioAssets.map((a) => (
                  <div key={a.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-slate-200 truncate">{a.name}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {(a.sizeBytes / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
