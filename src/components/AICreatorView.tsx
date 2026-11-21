import React, { useState } from 'react';
import { Search, Sparkles, CheckCircle2, AlertTriangle, ExternalLink, Layers, FileText, Plus } from 'lucide-react';
import {
  CreativePreset,
  MotionComponentType,
  Project,
  ResearchFinding,
  ResearchMode,
  ScriptSection,
  StoryboardScene,
  WorkspaceTab,
} from '../types/studio';
import { AiClient, ModelRegistryResponse } from '../services/aiClient';
import { getPresetById } from '../data/creativePresets';
import { syncStoryboardToTimeline } from '../engine/projectFactory';
import { generateSubtitlesFromScenes } from '../engine/subtitleEngine';

interface AICreatorViewProps {
  project: Project;
  customPresets: CreativePreset[];
  modelRegistry: ModelRegistryResponse | null;
  onUpdateProject: (updater: (p: Project) => Project) => void;
  onNavigate: (tab: WorkspaceTab) => void;
}

const VALID_COMPONENTS = new Set<MotionComponentType>([
  'AnimatedTitle',
  'KineticTypography',
  'BlueprintGrid',
  'TechnicalCallout',
  'AnimatedArrow',
  'TrackingMarker',
  'CircularDiagram',
  'ExplodedView',
  'DataCounter',
  'ComparisonPanel',
  'AnimatedChart',
  'ProgressIndicator',
  'InfographicCard',
  'TimelineGraphic',
  'ImageReveal',
  'VideoFrame',
  'SectionDivider',
  'AnimatedDiagram',
  '3DModelViewer',
  'EndCard',
]);

export const AICreatorView: React.FC<AICreatorViewProps> = ({
  project,
  customPresets,
  modelRegistry,
  onUpdateProject,
  onNavigate,
}) => {
  const [selectedModel, setSelectedModel] = useState('gemini-4-hydrogen');
  const [confirmedPaid, setConfirmedPaid] = useState(false);
  const [busyTask, setBusyTask] = useState<'research' | 'script' | 'storyboard' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [researchMarkdown, setResearchMarkdown] = useState<string>('');
  const [manualClaim, setManualClaim] = useState('');
  const [urlInput, setUrlInput] = useState('');

  const textModels = (modelRegistry?.models || []).filter((m) => m.capabilities.includes('text'));
  const activeModelMeta = textModels.find((m) => m.id === selectedModel);
  const preset = getPresetById(project.settings.primaryPresetId, customPresets);

  const handleRunResearch = async () => {
    setError(null);
    setBusyTask('research');
    try {
      const res = await AiClient.researchTopic({
        subject: project.subject,
        audience: project.targetAudience,
        purpose: project.purpose,
        researchMode: project.settings.researchMode,
        referenceNotes: project.aiBrief.referenceNotes,
        model: selectedModel,
        confirmedPaidUsage: confirmedPaid,
      });
      setResearchMarkdown(res.summary);
      if (res.sources.length > 0 || res.summary) {
        const newFinding: ResearchFinding = {
          id: `res-${Date.now()}`,
          claim: `Grounded research synthesis (${res.modelUsed})`,
          status: res.sources.length > 0 ? 'verified' : 'needs-review',
          notes: res.summary.slice(0, 360),
          sources: res.sources,
        };
        onUpdateProject((p) => ({
          ...p,
          research: [newFinding, ...p.research],
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research request failed.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleGenerateScript = async () => {
    setError(null);
    setBusyTask('script');
    try {
      const res = await AiClient.generateScript({
        subject: project.subject,
        description: project.description,
        audience: project.targetAudience,
        purpose: project.purpose,
        language: project.language,
        targetDurationSec: project.settings.targetDurationSec,
        creativeDirection: `${preset.name}: ${preset.compositionRules}`,
        researchNotes: [project.aiBrief.referenceNotes, researchMarkdown].filter(Boolean).join('\n\n'),
        model: selectedModel,
        confirmedPaidUsage: confirmedPaid,
      });

      const sections: ScriptSection[] = (res.sections || []).map((s, idx) => ({
        id: `sec-ai-${Date.now()}-${idx}`,
        role: (s.role as ScriptSection['role']) || 'main',
        title: s.title || `Section ${idx + 1}`,
        narration: s.narration || '',
        speaker: s.speaker || 'Narrator',
        tone: s.tone || 'Clear and informative',
        pronunciationNotes: s.pronunciationNotes || '',
        sceneMarker: s.sceneMarker || `SCENE ${String(idx + 1).padStart(2, '0')}`,
        estimatedDuration: Math.max(2.5, Number(s.estimatedDuration) || 5),
      }));

      onUpdateProject((p) => ({
        ...p,
        aiBrief: {
          ...p.aiBrief,
          concept: res.concept || p.aiBrief.concept,
          outline: Array.isArray(res.outline) && res.outline.length > 0 ? res.outline : p.aiBrief.outline,
        },
        script: sections.length > 0 ? sections : p.script,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Script generation failed.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleGenerateStoryboard = async () => {
    setError(null);
    setBusyTask('storyboard');
    try {
      const res = await AiClient.generateStoryboard({
        projectTitle: project.title,
        subject: project.subject,
        creativeStyle: preset.name,
        sections: project.script.map((s) => ({
          id: s.id,
          title: s.title,
          narration: s.narration,
          estimatedDuration: s.estimatedDuration,
          role: s.role,
        })),
        model: selectedModel,
        confirmedPaidUsage: confirmedPaid,
      });

      const scenes: StoryboardScene[] = (res.scenes || []).map((sc, idx) => {
        const comp = VALID_COMPONENTS.has(sc.suggestedComponent as MotionComponentType)
          ? (sc.suggestedComponent as MotionComponentType)
          : 'AnimatedTitle';
        return {
          id: `scene-ai-${Date.now()}-${idx}`,
          title: sc.title || `Scene ${idx + 1}`,
          duration: Math.max(2.5, Number(sc.duration) || 5),
          narration: sc.narration || '',
          visualStyle: project.settings.primaryPresetId,
          visualType: sc.visualType || 'motion-graphic',
          camera: sc.camera || 'slow-push-in',
          animation: (sc.animation as StoryboardScene['animation']) || preset.defaultAnimation,
          overlayText: sc.overlayText || sc.title || '',
          subtitleText: sc.narration || '',
          soundDesign: sc.soundDesign || 'Subtle ambient bed',
          transition: (sc.transition as StoryboardScene['transition']) || preset.defaultTransition,
          notes: sc.notes || '',
          approved: false,
          suggestedComponent: comp,
          assetIds: [],
        };
      });

      if (scenes.length > 0) {
        onUpdateProject((p) => {
          const audioClips = p.clips.filter((c) => c.trackType === 'audio');
          const syncedClips = syncStoryboardToTimeline(scenes, p.settings.primaryPresetId, p.title, audioClips);
          const subtitles = generateSubtitlesFromScenes(scenes);
          return {
            ...p,
            storyboard: scenes,
            clips: syncedClips,
            subtitles,
          };
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Storyboard generation failed.');
    } finally {
      setBusyTask(null);
    }
  };

  const handleAddManualFinding = () => {
    if (!manualClaim.trim()) return;
    const item: ResearchFinding = {
      id: `res-man-${Date.now()}`,
      claim: manualClaim.trim(),
      status: 'needs-review',
      notes: 'Added manually for verification.',
      sources: [],
    };
    onUpdateProject((p) => ({ ...p, research: [item, ...p.research] }));
    setManualClaim('');
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      setError('Reference URLs must start with http:// or https://');
      return;
    }
    setError(null);
    onUpdateProject((p) => ({
      ...p,
      aiBrief: {
        ...p.aiBrief,
        referenceUrls: Array.from(new Set([...p.aiBrief.referenceUrls, trimmed])),
      },
    }));
    setUrlInput('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100">AI Creator & Research</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ground facts with Google Search, draft structured scripts, and convert concepts into motion storyboards.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Model</span>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[#11151D] border border-[#283044] rounded px-2.5 py-1.5 text-slate-100"
            >
              {textModels.length === 0 ? (
                <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Fast)</option>
              ) : (
                textModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} {m.tier === 'paid-tier' ? '(Paid Tier)' : '(Standard)'}
                  </option>
                ))
              )}
            </select>
          </label>
          <span className="font-mono text-slate-400">
            Server AI: {modelRegistry?.configured ? 'Ready' : 'Offline Mode (Key not configured)'}
          </span>
        </div>
      </div>

      {activeModelMeta?.tier === 'paid-tier' && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg bg-amber-950/30 border border-amber-700/50 text-xs text-amber-200">
          <span>
            <strong>Paid-tier model selected ({activeModelMeta.id}):</strong> Confirm paid API billing usage before running generation.
          </span>
          <label className="flex items-center gap-2 whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedPaid}
              onChange={(e) => setConfirmedPaid(e.target.checked)}
              className="accent-amber-500"
            />
            <span>Confirm paid API usage</span>
          </label>
        </div>
      )}

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg bg-red-950/50 border border-red-800 text-red-200 text-xs">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left: Subject, Creative Brief & Controls */}
        <div className="xl:col-span-7 space-y-5">
          <div className="p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Topic & Creative Input</h2>
            <label className="flex flex-col gap-1.5 text-xs">
              <span className="text-slate-400">Main Subject / Video Topic</span>
              <input
                type="text"
                value={project.subject}
                onChange={(e) => onUpdateProject((p) => ({ ...p, subject: e.target.value }))}
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-sm text-slate-100"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Research Mode</span>
                <select
                  value={project.settings.researchMode}
                  onChange={(e) =>
                    onUpdateProject((p) => ({
                      ...p,
                      settings: { ...p.settings, researchMode: e.target.value as ResearchMode },
                    }))
                  }
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                >
                  <option value="research-assisted">Research-assisted (Search Grounding)</option>
                  <option value="user-material">User-supplied material only</option>
                  <option value="creative">Creative mode</option>
                  <option value="mixed">Mixed mode</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Audience</span>
                <input
                  type="text"
                  value={project.targetAudience}
                  onChange={(e) => onUpdateProject((p) => ({ ...p, targetAudience: e.target.value }))}
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                <span className="text-slate-400">Target Duration (sec)</span>
                <input
                  type="number"
                  min={15}
                  max={1200}
                  value={project.settings.targetDurationSec}
                  onChange={(e) =>
                    onUpdateProject((p) => ({
                      ...p,
                      settings: { ...p.settings, targetDurationSec: Number(e.target.value) || 45 },
                    }))
                  }
                  className="bg-[#0B0E14] border border-[#283044] rounded-md px-2.5 py-1.5 text-slate-100 font-mono"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5 text-xs">
              <span className="text-slate-400">Reference Notes, Existing Script, or Constraints</span>
              <textarea
                rows={4}
                value={project.aiBrief.referenceNotes}
                onChange={(e) =>
                  onUpdateProject((p) => ({
                    ...p,
                    aiBrief: { ...p.aiBrief, referenceNotes: e.target.value },
                  }))
                }
                placeholder="Paste reference excerpts, existing script drafts, key points to emphasize, or visual constraints..."
                className="bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-xs text-slate-100 leading-relaxed"
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs text-slate-400 block">Reference URLs</span>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.org/reference-article"
                  className="flex-1 bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-xs text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleAddUrl}
                  className="px-3 py-1.5 rounded-md bg-[#1B2130] border border-[#2B3346] text-xs text-slate-200 hover:bg-[#232A3D]"
                >
                  Add URL
                </button>
              </div>
              {project.aiBrief.referenceUrls.length > 0 && (
                <div className="space-y-1">
                  {project.aiBrief.referenceUrls.map((u) => (
                    <div key={u} className="flex items-center justify-between text-xs text-sky-400 font-mono">
                      <span className="truncate">{u}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject((p) => ({
                            ...p,
                            aiBrief: {
                              ...p.aiBrief,
                              referenceUrls: p.aiBrief.referenceUrls.filter((x) => x !== u),
                            },
                          }))
                        }
                        className="text-slate-500 hover:text-red-400 ml-2"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#1E2330]">
              <button
                type="button"
                disabled={busyTask !== null}
                onClick={handleRunResearch}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#19202F] border border-[#2D384F] text-xs font-medium text-slate-100 hover:bg-[#222B3F] disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5 text-sky-400" />
                <span>{busyTask === 'research' ? 'Researching...' : 'Research Topic'}</span>
              </button>
              <button
                type="button"
                disabled={busyTask !== null}
                onClick={handleGenerateScript}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{busyTask === 'script' ? 'Generating Script...' : 'Generate Concept & Script'}</span>
              </button>
              <button
                type="button"
                disabled={busyTask !== null || project.script.length === 0}
                onClick={handleGenerateStoryboard}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#19202F] border border-[#2D384F] text-xs font-medium text-slate-100 hover:bg-[#222B3F] disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>{busyTask === 'storyboard' ? 'Building Storyboard...' : 'Generate Storyboard'}</span>
              </button>
            </div>
          </div>

          {/* Concept & Outline Approval */}
          <div className="p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">Proposed Concept & Outline</h2>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={project.aiBrief.approvedDirection}
                  onChange={(e) =>
                    onUpdateProject((p) => ({
                      ...p,
                      aiBrief: { ...p.aiBrief, approvedDirection: e.target.checked },
                    }))
                  }
                  className="accent-amber-500"
                />
                <span>Direction approved</span>
              </label>
            </div>
            <textarea
              rows={2}
              value={project.aiBrief.concept}
              onChange={(e) =>
                onUpdateProject((p) => ({
                  ...p,
                  aiBrief: { ...p.aiBrief, concept: e.target.value },
                }))
              }
              className="w-full bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-2 text-xs text-slate-200"
            />
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('script-lab')}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Edit {project.script.length} Script Sections in Script Lab</span>
              </button>
              <span className="text-slate-600">·</span>
              <button
                type="button"
                onClick={() => onNavigate('storyboard')}
                className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Review {project.storyboard.length} Storyboard Scenes</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: Research & Factual Verification Log */}
        <div className="xl:col-span-5 space-y-4">
          <div className="p-5 rounded-lg bg-[#11151D] border border-[#222836] space-y-4">
            <h2 className="text-sm font-semibold text-slate-200">Factual Verification & Sources</h2>

            {researchMarkdown && (
              <div className="p-3 rounded-md bg-[#0B0E14] border border-[#222836] text-xs text-slate-300 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                {researchMarkdown}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={manualClaim}
                onChange={(e) => setManualClaim(e.target.value)}
                placeholder="Log a claim or fact to verify..."
                className="flex-1 bg-[#0B0E14] border border-[#283044] rounded-md px-3 py-1.5 text-xs text-slate-100"
              />
              <button
                type="button"
                onClick={handleAddManualFinding}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-[#1B2130] border border-[#2B3346] text-xs text-slate-200 hover:bg-[#232A3D]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {project.research.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No factual claims logged yet. Run Research Topic or log claims manually for educational topics.
              </p>
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {project.research.map((item) => (
                  <div key={item.id} className="p-3 rounded-md bg-[#0D1017] border border-[#222836] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-slate-100">{item.claim}</p>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateProject((p) => ({
                            ...p,
                            research: p.research.map((r) =>
                              r.id === item.id
                                ? { ...r, status: r.status === 'verified' ? 'needs-review' : 'verified' }
                                : r
                            ),
                          }))
                        }
                        className={`flex items-center gap-1 text-[11px] font-mono shrink-0 ${
                          item.status === 'verified' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {item.status === 'verified' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        <span>{item.status === 'verified' ? 'Verified' : 'Needs Review'}</span>
                      </button>
                    </div>
                    {item.notes && <p className="text-[11px] text-slate-400 leading-relaxed">{item.notes}</p>}
                    {item.sources.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-[#1C212E]">
                        {item.sources.map((src, i) => (
                          <a
                            key={`${src.uri}-${i}`}
                            href={src.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-[11px] text-sky-400 hover:underline truncate"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
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
