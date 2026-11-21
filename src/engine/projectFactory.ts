import {
  AspectRatioPreset,
  CreativePresetId,
  DurationCategory,
  FrameRate,
  MotionComponentType,
  Project,
  ResearchMode,
  ResolutionPreset,
  Scene3DConfig,
  ScriptSection,
  StoryboardScene,
  TimelineClip,
} from '../types/studio';
import { getPresetById } from '../data/creativePresets';
import { computeSceneWindows } from './timelineMath';
import { generateSubtitlesFromScenes } from './subtitleEngine';

export function resolveDimensions(
  aspectRatio: AspectRatioPreset,
  resolution: ResolutionPreset,
  customWidth = 1920,
  customHeight = 1080
): { width: number; height: number } {
  if (aspectRatio === 'custom' || resolution === 'custom') {
    return {
      width: Math.max(320, Math.min(3840, Math.round(customWidth / 2) * 2)),
      height: Math.max(320, Math.min(3840, Math.round(customHeight / 2) * 2)),
    };
  }

  const baseShortSide: Record<Exclude<ResolutionPreset, 'custom'>, number> = {
    '720p': 720,
    '1080p': 1080,
    '1440p': 1440,
    '4k': 2160,
  };
  const shortSide = baseShortSide[resolution] || 1080;

  if (aspectRatio === '16:9') {
    return { width: Math.round((shortSide * 16) / 9), height: shortSide };
  }
  if (aspectRatio === '9:16') {
    return { width: shortSide, height: Math.round((shortSide * 16) / 9) };
  }
  return { width: shortSide, height: shortSide };
}

export function estimateNarrationDuration(text: string, wordsPerMinute = 145): number {
  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 3;
  return Math.max(2.5, Number(((words / wordsPerMinute) * 60).toFixed(1)));
}

export function createDefaultScene3DConfig(): Scene3DConfig {
  return {
    proceduralArchetype: 'modular-core',
    cameraType: 'perspective',
    cameraDistance: 5.2,
    cameraElevation: 1.8,
    orbitSpeed: 0.35,
    wireframe: false,
    explodedFactor: 0.15,
    materialColor: '#38BDF8',
    accentColor: '#F59E0B',
    metalness: 0.65,
    roughness: 0.28,
    backgroundColor: '#0A1220',
    transparentBg: true,
    showGrid: true,
    scale: 1,
    rotationX: 0,
    rotationY: 0.4,
  };
}

export interface NewProjectInput {
  title: string;
  description?: string;
  subject: string;
  targetAudience?: string;
  language?: string;
  purpose?: string;
  targetPlatform?: string;
  aspectRatio?: AspectRatioPreset;
  resolution?: ResolutionPreset;
  customWidth?: number;
  customHeight?: number;
  fps?: FrameRate;
  durationCategory?: DurationCategory;
  targetDurationSec?: number;
  creativePresets?: CreativePresetId[];
  researchMode?: ResearchMode;
}

export function createBlankProject(input: NewProjectInput): Project {
  const now = new Date().toISOString();
  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const aspectRatio = input.aspectRatio || '16:9';
  const resolution = input.resolution || '1080p';
  const fps = input.fps || 30;
  const dims = resolveDimensions(aspectRatio, resolution, input.customWidth, input.customHeight);
  const creativePresets = input.creativePresets?.length ? input.creativePresets : ['technical-blueprint'];
  const primaryPresetId = creativePresets[0];
  const preset = getPresetById(primaryPresetId);

  const subject = input.subject.trim() || input.title.trim() || 'Untitled Subject';
  const title = input.title.trim() || subject;

  const initialSections: ScriptSection[] = [
    {
      id: 'sec-1',
      role: 'hook',
      title: 'Opening Hook',
      narration: `Every breakthrough starts with a single question: how does ${subject} actually work beneath the surface?`,
      speaker: 'Narrator',
      tone: 'Curious and precise',
      pronunciationNotes: '',
      sceneMarker: 'SCENE 01',
      estimatedDuration: 5.5,
    },
    {
      id: 'sec-2',
      role: 'main',
      title: 'Core Mechanism',
      narration: `By breaking ${subject} into modular components, we can map how each layer interacts in real time.`,
      speaker: 'Narrator',
      tone: 'Clear and analytical',
      pronunciationNotes: '',
      sceneMarker: 'SCENE 02',
      estimatedDuration: 6.0,
    },
    {
      id: 'sec-3',
      role: 'visual-demo',
      title: 'Key Metrics & Impact',
      narration: `Comparing baseline approaches against modern architecture highlights measurable gains in clarity, scale, and reliability.`,
      speaker: 'Narrator',
      tone: 'Measured and authoritative',
      pronunciationNotes: '',
      sceneMarker: 'SCENE 03',
      estimatedDuration: 6.0,
    },
    {
      id: 'sec-4',
      role: 'conclusion',
      title: 'Summary & Next Steps',
      narration: `With the fundamentals mapped out, you now have a clear visual blueprint for ${subject}.`,
      speaker: 'Narrator',
      tone: 'Confident closing',
      pronunciationNotes: '',
      sceneMarker: 'SCENE 04',
      estimatedDuration: 5.0,
    },
  ];

  const initialScenes: StoryboardScene[] = [
    {
      id: 'scene-001',
      title: 'Opening Hook',
      duration: 5.5,
      narration: initialSections[0].narration,
      visualStyle: primaryPresetId,
      visualType: 'kinetic-title',
      camera: 'slow-push-in',
      animation: preset.defaultAnimation,
      overlayText: title.toUpperCase(),
      subtitleText: initialSections[0].narration,
      soundDesign: 'Subtle ambient swell',
      transition: preset.defaultTransition,
      notes: 'Establish visual tone and subject focus.',
      approved: true,
      suggestedComponent: 'AnimatedTitle',
      assetIds: [],
      scriptSectionId: 'sec-1',
    },
    {
      id: 'scene-002',
      title: 'Core Mechanism',
      duration: 6.0,
      narration: initialSections[1].narration,
      visualStyle: primaryPresetId,
      visualType: 'animated-diagram',
      camera: 'orthographic-pan',
      animation: 'draw-line',
      overlayText: 'SYSTEM ARCHITECTURE',
      subtitleText: initialSections[1].narration,
      soundDesign: 'Soft vector click accents',
      transition: preset.defaultTransition,
      notes: 'Visualise modular structure with callouts.',
      approved: false,
      suggestedComponent: 'AnimatedDiagram',
      assetIds: [],
      scriptSectionId: 'sec-2',
    },
    {
      id: 'scene-003',
      title: 'Key Metrics & Impact',
      duration: 6.0,
      narration: initialSections[2].narration,
      visualStyle: primaryPresetId,
      visualType: 'data-chart',
      camera: 'static-locked',
      animation: 'counter',
      overlayText: 'COMPARATIVE PERFORMANCE',
      subtitleText: initialSections[2].narration,
      soundDesign: 'Clean tonal rise',
      transition: 'slide-left',
      notes: 'Present measurable comparison cleanly.',
      approved: false,
      suggestedComponent: 'AnimatedChart',
      assetIds: [],
      scriptSectionId: 'sec-3',
    },
    {
      id: 'scene-004',
      title: 'Summary & Closing',
      duration: 5.0,
      narration: initialSections[3].narration,
      visualStyle: primaryPresetId,
      visualType: 'end-card',
      camera: 'gentle-pull-back',
      animation: 'fade',
      overlayText: title,
      subtitleText: initialSections[3].narration,
      soundDesign: 'Resolved harmonic chord',
      transition: 'crossfade',
      notes: 'Closing summary card.',
      approved: false,
      suggestedComponent: 'EndCard',
      assetIds: [],
      scriptSectionId: 'sec-4',
    },
  ];

  const clips = syncStoryboardToTimeline(initialScenes, primaryPresetId, title);
  const subtitles = generateSubtitlesFromScenes(initialScenes);

  return {
    id,
    title,
    description: input.description?.trim() || `Production workspace for ${subject}.`,
    subject,
    targetAudience: input.targetAudience?.trim() || 'General informed viewers',
    language: input.language?.trim() || 'English',
    purpose: input.purpose?.trim() || 'Educational explainer',
    targetPlatform: input.targetPlatform?.trim() || (aspectRatio === '9:16' ? 'Short-form Vertical' : 'YouTube / Web'),
    createdAt: now,
    updatedAt: now,
    settings: {
      aspectRatio,
      width: dims.width,
      height: dims.height,
      fps,
      resolution,
      durationCategory: input.durationCategory || 'short',
      targetDurationSec: input.targetDurationSec || 45,
      creativePresets,
      primaryPresetId,
      researchMode: input.researchMode || 'research-assisted',
    },
    aiBrief: {
      concept: `A structured visual presentation exploring ${subject} with ${preset.name} styling.`,
      outline: initialSections.map((s) => `${s.title}: ${s.narration.slice(0, 80)}`),
      referenceNotes: '',
      referenceUrls: [],
      approvedDirection: true,
    },
    research: [],
    script: initialSections,
    storyboard: initialScenes,
    clips,
    subtitles,
    subtitleStyle: {
      enabled: true,
      fontFamily: 'DM Sans',
      fontSize: 32,
      textColor: '#F8FAFC',
      highlightColor: preset.palette.accent,
      backgroundColor: 'rgba(10, 14, 22, 0.78)',
      position: 'bottom',
    },
    voiceSettings: {
      primaryVoice: 'Kore',
      secondaryVoice: 'Puck',
      speakingStyle: 'Clear, engaging documentary narrator',
      multiSpeaker: false,
      model: 'gemini-3.8-flash-lite-tts',
    },
    audioMix: {
      narrationVolume: 1.0,
      musicVolume: 0.25,
      sfxVolume: 0.65,
      ambientVolume: 0.2,
      masterVolume: 0.95,
    },
    exportConfig: {
      aspectRatio,
      width: dims.width,
      height: dims.height,
      fps,
      resolution,
      format: 'auto',
      videoBitsPerSecond: 6_000_000,
      burnSubtitles: true,
      includeAudio: true,
      previewQuality: 0.75,
    },
    scene3D: {
      ...createDefaultScene3DConfig(),
      materialColor: preset.palette.primary,
      accentColor: preset.palette.accent,
      backgroundColor: preset.palette.background,
    },
  };
}

export function buildClipForMotionComponent(
  componentType: MotionComponentType,
  scene: StoryboardScene,
  startTime: number,
  duration: number,
  presetId: CreativePresetId,
  projectTitle: string
): TimelineClip {
  const preset = getPresetById(presetId);
  const trackType =
    componentType === 'AnimatedTitle' || componentType === 'KineticTypography' || componentType === 'EndCard'
      ? 'text'
      : componentType === 'ImageReveal'
      ? 'image'
      : componentType === 'VideoFrame' || componentType === '3DModelViewer'
      ? 'video'
      : 'graphics';

  return {
    id: `clip-${scene.id}-${componentType.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`,
    trackType,
    name: `${scene.title} · ${componentType}`,
    sceneId: scene.id,
    startTime: Number(startTime.toFixed(2)),
    duration: Number(duration.toFixed(2)),
    layerOrder: trackType === 'text' ? 30 : trackType === 'graphics' ? 20 : 10,
    opacity: 1,
    x: 50,
    y: 50,
    width: 84,
    height: 76,
    scale: 1,
    rotation: 0,
    animation: scene.animation || preset.defaultAnimation,
    animationDuration: Math.min(1.1, duration * 0.3),
    animationDelay: 0.1,
    easing: 'easeOutCubic',
    direction: 'up',
    componentType,
    transitionIn: scene.transition || preset.defaultTransition,
    transitionDuration: 0.45,
    motionProps: {
      title: scene.overlayText || scene.title,
      subtitle: scene.title,
      body: scene.narration,
      label: scene.visualType.replace(/-/g, ' ').toUpperCase(),
      value: 94,
      unit: '%',
      prefix: '',
      accentColor: preset.palette.accent,
      textColor: preset.palette.text,
      bgColor: preset.palette.surface,
      progress: 0.86,
      ctaText: projectTitle,
      items: [
        { label: 'Phase 01', value: 42, color: preset.palette.primary },
        { label: 'Phase 02', value: 68, color: preset.palette.accent },
        { label: 'Phase 03', value: 89, color: preset.palette.primary },
        { label: 'Target', value: 96, color: preset.palette.accent },
      ],
      leftTitle: 'Conventional Baseline',
      leftPoints: ['Manual workflow', 'Static presentation', 'Fixed pacing'],
      rightTitle: 'Structured Approach',
      rightPoints: ['Modular architecture', 'Deterministic visuals', 'Scalable output'],
      milestones: [
        { year: '01', title: 'Foundation', detail: 'Core principles defined' },
        { year: '02', title: 'Integration', detail: 'Systems connected cleanly' },
        { year: '03', title: 'Optimization', detail: 'Measured efficiency gains' },
      ],
      scene3D: {
        ...createDefaultScene3DConfig(),
        materialColor: preset.palette.primary,
        accentColor: preset.palette.accent,
        backgroundColor: preset.palette.background,
      },
    },
  };
}

export function syncStoryboardToTimeline(
  scenes: StoryboardScene[],
  primaryPresetId: CreativePresetId,
  projectTitle: string,
  existingAudioClips: TimelineClip[] = []
): TimelineClip[] {
  const windows = computeSceneWindows(scenes);
  const preset = getPresetById(primaryPresetId);
  const clips: TimelineClip[] = [];

  for (const w of windows) {
    // Background drafting grid or atmospheric layer
    clips.push({
      id: `clip-bg-${w.scene.id}`,
      trackType: 'graphics',
      name: `${w.scene.title} · Grid Layer`,
      sceneId: w.scene.id,
      startTime: Number(w.startTime.toFixed(2)),
      duration: Number((w.endTime - w.startTime).toFixed(2)),
      layerOrder: 1,
      opacity: 0.85,
      x: 50,
      y: 50,
      width: 100,
      height: 100,
      scale: 1,
      rotation: 0,
      animation: 'fade',
      animationDuration: 0.4,
      animationDelay: 0,
      easing: 'easeOutCubic',
      direction: 'center',
      componentType: 'BlueprintGrid',
      motionProps: {
        label: `SCENE ${String(w.index + 1).padStart(2, '0')} / ${w.scene.title.toUpperCase()}`,
        accentColor: preset.palette.primary,
        textColor: preset.palette.mutedText,
      },
    });

    // Primary visual motion component for the scene
    clips.push(
      buildClipForMotionComponent(
        w.scene.suggestedComponent || 'AnimatedTitle',
        w.scene,
        w.startTime,
        w.endTime - w.startTime,
        w.scene.visualStyle || primaryPresetId,
        projectTitle
      )
    );

    // Subtle progress bar indicator on non-closing scenes
    if (w.index < windows.length - 1) {
      clips.push({
        id: `clip-prog-${w.scene.id}`,
        trackType: 'graphics',
        name: `${w.scene.title} · Progress`,
        sceneId: w.scene.id,
        startTime: Number(w.startTime.toFixed(2)),
        duration: Number((w.endTime - w.startTime).toFixed(2)),
        layerOrder: 40,
        opacity: 0.9,
        x: 50,
        y: 6,
        width: 88,
        height: 4,
        scale: 1,
        rotation: 0,
        animation: 'wipe',
        animationDuration: 0.3,
        animationDelay: 0,
        easing: 'linear',
        direction: 'right',
        componentType: 'ProgressIndicator',
        motionProps: {
          label: `${String(w.index + 1).padStart(2, '0')} / ${String(windows.length).padStart(2, '0')}`,
          progress: (w.index + 1) / windows.length,
          accentColor: preset.palette.accent,
          textColor: preset.palette.mutedText,
        },
      });
    }
  }

  return [...clips, ...existingAudioClips];
}

export function parseImportedProject(rawJson: string): Project {
  const parsed = JSON.parse(rawJson);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.title !== 'string' || !parsed.settings) {
    throw new Error('Invalid MOTIONFORGE project JSON: missing required title or settings fields.');
  }
  const now = new Date().toISOString();
  return {
    ...parsed,
    id: `proj-imp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    updatedAt: now,
    storyboard: Array.isArray(parsed.storyboard) ? parsed.storyboard : [],
    script: Array.isArray(parsed.script) ? parsed.script : [],
    clips: Array.isArray(parsed.clips) ? parsed.clips : [],
    subtitles: Array.isArray(parsed.subtitles) ? parsed.subtitles : [],
    research: Array.isArray(parsed.research) ? parsed.research : [],
  } as Project;
}
