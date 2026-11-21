import React, { useState } from 'react';
import { Plus, Trash2, Sparkles, ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { Project, ScriptSection, ScriptSectionRole, WorkspaceTab } from '../types/studio';
import { estimateNarrationDuration, syncStoryboardToTimeline } from '../engine/projectFactory';
import { generateSubtitlesFromScenes } from '../engine/subtitleEngine';
import { AiClient } from '../services/aiClient';

interface ScriptLabViewProps {
  project: Project;
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

const SECTION_ROLES: Array<{ value: ScriptSectionRole; label: string }> = [
  { value: 'hook', label: 'Opening Hook' },
  { value: 'introduction', label: 'Introduction' },
  { value: 'main', label: 'Main Section' },
  { value: 'explanation', label: 'Supporting Explanation' },
  { value: 'example', label: 'Example' },
  { value: 'visual-demo', label: 'Visual Demonstration' },
  { value: 'conclusion', label: 'Conclusion' },
  { value: 'cta', label: 'Call to Action' },
];

export const ScriptLabView: React.FC<ScriptLabViewProps> = ({ project, onUpdateProject, onNavigate }) => {
  const [activeId, setActiveId] = useState<string>(project.script[0]?.id || '');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetTone, setTargetTone] = useState('Measured documentary');

  const selected = project.script.find((s) => s.id === activeId) || project.script[0] || null;
  const totalWords = project.script.reduce(
    (sum, s) => sum + s.narration.trim().split(/\s+/).filter(Boolean).length,
    0
  );
  const totalEstSec = project.script.reduce((sum, s) => sum + (s.estimatedDuration || 0), 0);

  const updateSection = (id: string, partial: Partial<ScriptSection>) => {
    onUpdateProject((p) => ({
      ...p,
      script: p.script.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...partial };
        if (partial.narration !== undefined) {
          next.estimatedDuration = estimateNarrationDuration(partial.narration);
        }
        return next;
      }),
    }));
  };

  const addSection = () => {
    const idx = project.script.length + 1;
    const next: ScriptSection = {
      id: `sec-${Date.now()}`,
      role: 'main',
      title: `Section ${idx}`,
      narration: '',
      speaker: 'Narrator',
      tone: 'Clear and direct',
      pronunciationNotes: '',
      sceneMarker: `SCENE ${String(idx).padStart(2, '0')}`,
      estimatedDuration: 4,
    };
    onUpdateProject((p) => ({ ...p, script: [...p.script, next] }));
    setActiveId(next.id);
  };

  const deleteSection = (id: string) => {
    if (project.script.length <= 1) return;
    onUpdateProject((p) => ({
      ...p,
      script: p.script.filter((s) => s.id !== id),
    }));
  };

  const moveSection = (index: number, delta: -1 | 1) => {
    const nextIdx = index + delta;
    if (nextIdx < 0 || nextIdx >= project.script.length) return;
    onUpdateProject((p) => {
      const copy = [...p.script];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIdx, 0, item);
      return { ...p, script: copy };
    });
  };

  const handleAiTransform = async (
    action: 'rewrite' | 'expand' | 'summarise' | 'improve-engagement' | 'change-tone' | 'change-audience'
  ) => {
    if (!selected) return;
    setError(null);
    setBusyAction(action);
    try {
      const res = await AiClient.transformScriptSection({
        action,
        sectionTitle: selected.title,
        narration: selected.narration,
        subject: project.subject,
        targetTone,
        targetAudience: project.targetAudience,
      });
      updateSection(selected.id, { narration: res.narration });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to transform script section.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleBuildStoryboardFromScript = () => {
    onUpdateProject((p) => {
      const scenes = p.script.map((sec, idx) => {
        const existing = p.storyboard.find((sc) => sc.scriptSectionId === sec.id);
        if (existing) {
          return {
            ...existing,
            title: sec.title,
            narration: sec.narration,
            subtitleText: sec.narration,
            duration: Math.max(2.5, sec.estimatedDuration || 5),
          };
        }
        return {
          id: `scene-from-${sec.id}`,
          title: sec.title,
          duration: Math.max(2.5, sec.estimatedDuration || 5),
          narration: sec.narration,
          visualStyle: p.settings.primaryPresetId,
          visualType: idx === 0 ? 'animated-title' : idx === p.script.length - 1 ? 'end-card' : 'infographic-card',
          camera: 'slow-push-in',
          animation: 'slide' as const,
          overlayText: sec.title.toUpperCase(),
          subtitleText: sec.narration,
          soundDesign: 'Balanced bed',
          transition: 'crossfade' as const,
          notes: sec.pronunciationNotes,
          approved: false,
          suggestedComponent:
            idx === 0
              ? ('AnimatedTitle' as const)
              : idx === p.script.length - 1
              ? ('EndCard' as const)
              : ('InfographicCard' as const),
          assetIds: [],
          scriptSectionId: sec.id,
        };
      });
      const audioClips = p.clips.filter((c) => c.trackType === 'audio');
      return {
        ...p,
        storyboard: scenes,
        clips: syncStoryboardToTimeline(scenes, p.settings.primaryPresetId, p.title, audioClips),
        subtitles: generateSubtitlesFromScenes(scenes),
      };
    });
    onNavigate('storyboard');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Script Lab</h1>
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            <span>{project.script.length} sections</span>
            <span aria-hidden="true">·</span>
            <span>{totalWords} words</span>
            <span aria-hidden="true">·</span>
            <span>Est. Narration {totalEstSec.toFixed(1)}s</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={addSection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#181E2B] border border-[#2B3346] text-xs text-slate-200 hover:bg-[#222A3C]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Section</span>
          </button>
          <button
            type="button"
            onClick={handleBuildStoryboardFromScript}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Sync Script to Storyboard</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="px-4 py-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Ordered Section List */}
        <div className="lg:col-span-4 space-y-2">
          {project.script.map((sec, idx) => {
            const isActive = selected?.id === sec.id;
            return (
              <div
                key={sec.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'bg-[#171D2A] border-amber-500/70'
                    : 'bg-[#11151D] border-[#222836] hover:border-[#343E56]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(sec.id)}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-amber-400">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="text-xs font-semibold text-slate-100 truncate">{sec.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 tabular-nums">
                      {sec.role} · {sec.speaker} · {sec.estimatedDuration.toFixed(1)}s
                    </p>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ${sec.title} up`}
                      onClick={() => moveSection(idx, -1)}
                      className="p-1 text-slate-500 hover:text-slate-200"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${sec.title} down`}
                      onClick={() => moveSection(idx, 1)}
                      className="p-1 text-slate-500 hover:text-slate-200"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    {project.script.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${sec.title}`}
                        onClick={() => deleteSection(sec.id)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Active Section Editor */}
        {selected && (
          <div className="lg:col-span-8 p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Section Title</span>
                <input
                  type="text"
                  value={selected.title}
                  onChange={(e) => updateSection(selected.id, { title: e.target.value })}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Narrative Role</span>
                <select
                  value={selected.role}
                  onChange={(e) => updateSection(selected.id, { role: e.target.value as ScriptSectionRole })}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  {SECTION_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Scene Marker</span>
                <input
                  type="text"
                  value={selected.sceneMarker}
                  onChange={(e) => updateSection(selected.id, { sceneMarker: e.target.value })}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-slate-100 font-mono"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-medium">Spoken Narration</span>
                <span className="font-mono text-slate-400 tabular-nums">
                  Est. {selected.estimatedDuration.toFixed(1)}s
                </span>
              </div>
              <textarea
                rows={6}
                aria-label="Spoken narration text"
                value={selected.narration}
                onChange={(e) => updateSection(selected.id, { narration: e.target.value })}
                placeholder="Write or refine spoken narration for this section..."
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-3.5 py-2.5 text-sm text-slate-100 leading-relaxed"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Speaker</span>
                <input
                  type="text"
                  value={selected.speaker}
                  onChange={(e) => updateSection(selected.id, { speaker: e.target.value })}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Narration Tone</span>
                <input
                  type="text"
                  value={selected.tone}
                  onChange={(e) => updateSection(selected.id, { tone: e.target.value })}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Pronunciation Notes</span>
                <input
                  type="text"
                  value={selected.pronunciationNotes}
                  onChange={(e) => updateSection(selected.id, { pronunciationNotes: e.target.value })}
                  placeholder="e.g., phonetic hints or pauses"
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
            </div>

            {/* AI Section Refinement Toolbar */}
            <div className="pt-4 border-t border-[#1E2330] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Section Refinement (Optional)</span>
                </span>
                <input
                  type="text"
                  aria-label="Target tone for rewrite"
                  value={targetTone}
                  onChange={(e) => setTargetTone(e.target.value)}
                  className="bg-[#0B0E14] border border-[#283044] rounded px-2.5 py-1 text-xs text-slate-200 w-44"
                  placeholder="Target tone"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['rewrite', 'Rewrite'],
                    ['expand', 'Expand'],
                    ['summarise', 'Summarise'],
                    ['improve-engagement', 'Improve Hook'],
                    ['change-tone', 'Apply Tone'],
                    ['change-audience', 'Adapt Audience'],
                  ] as const
                ).map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    disabled={busyAction !== null}
                    onClick={() => handleAiTransform(action)}
                    className="px-3 py-1.5 rounded bg-[#181E2B] border border-[#2A3346] text-xs text-slate-200 hover:bg-[#222A3C] disabled:opacity-50"
                  >
                    {busyAction === action ? 'Working...' : label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
