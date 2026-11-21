export type WorkspaceTab =
  | 'dashboard'
  | 'projects'
  | 'ai-creator'
  | 'script-lab'
  | 'storyboard'
  | 'assets'
  | 'voice-studio'
  | 'motion-composer'
  | 'video-editor'
  | 'export-studio'
  | 'settings';

export type AspectRatioPreset = '16:9' | '9:16' | '1:1' | 'custom';
export type FrameRate = 24 | 25 | 30 | 60;
export type ResolutionPreset = '720p' | '1080p' | '1440p' | '4k' | 'custom';
export type DurationCategory = 'short' | 'medium' | 'long' | 'custom';
export type ResearchMode = 'research-assisted' | 'user-material' | 'creative' | 'mixed';

export type CreativePresetId =
  | 'technical-blueprint'
  | 'hyperframe-motion'
  | 'cinematic-documentary'
  | 'minimalist-explainer'
  | 'scientific-visualisation'
  | 'corporate-presentation'
  | 'editorial-motion'
  | 'kinetic-typography'
  | '3d-product-demo'
  | 'data-storytelling'
  | string;

export interface CreativePreset {
  id: CreativePresetId;
  name: string;
  description: string;
  isCustom?: boolean;
  palette: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    mutedText: string;
    gridLine: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    monoFont: string;
    headingWeight: number;
    letterSpacing: number;
  };
  backgroundTreatment: 'blueprint-grid' | 'radial-studio' | 'editorial-grain' | 'minimal-flat' | 'gradient-depth' | 'dark-tech';
  graphicStyle: 'wireframe' | 'geometric-bold' | 'editorial-lines' | 'scientific-precision' | 'clean-cards';
  defaultAnimation: AnimationPreset;
  defaultTransition: TransitionType;
  compositionRules: string;
}

export type MotionComponentType =
  | 'AnimatedTitle'
  | 'KineticTypography'
  | 'BlueprintGrid'
  | 'TechnicalCallout'
  | 'AnimatedArrow'
  | 'TrackingMarker'
  | 'CircularDiagram'
  | 'ExplodedView'
  | 'DataCounter'
  | 'ComparisonPanel'
  | 'AnimatedChart'
  | 'ProgressIndicator'
  | 'InfographicCard'
  | 'TimelineGraphic'
  | 'ImageReveal'
  | 'VideoFrame'
  | 'SectionDivider'
  | 'AnimatedDiagram'
  | '3DModelViewer'
  | 'EndCard';

export type AnimationPreset =
  | 'fade'
  | 'slide'
  | 'scale'
  | 'reveal'
  | 'typewriter'
  | 'draw-line'
  | 'counter'
  | 'pulse'
  | 'rotate'
  | 'orbit'
  | 'wipe'
  | 'mask-reveal'
  | 'morph'
  | 'parallax'
  | 'split-transition'
  | 'blueprint-assembly';

export type EasingType =
  | 'linear'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeOutExpo'
  | 'easeOutBack'
  | 'easeInOutQuad';

export type AnimationDirection = 'up' | 'down' | 'left' | 'right' | 'center';

export type TransitionType =
  | 'cut'
  | 'crossfade'
  | 'technical-wipe'
  | 'slide-left'
  | 'split-reveal'
  | 'zoom-through';

export type ScriptSectionRole =
  | 'hook'
  | 'introduction'
  | 'main'
  | 'explanation'
  | 'example'
  | 'visual-demo'
  | 'conclusion'
  | 'cta';

export interface ScriptSection {
  id: string;
  role: ScriptSectionRole;
  title: string;
  narration: string;
  speaker: string;
  tone: string;
  pronunciationNotes: string;
  sceneMarker: string;
  estimatedDuration: number;
  sourceIds?: string[];
  flaggedClaims?: string[];
}

export interface ResearchFinding {
  id: string;
  claim: string;
  status: 'verified' | 'needs-review' | 'speculative';
  notes: string;
  sources: Array<{ title: string; uri: string }>;
  sectionId?: string;
}

export interface StoryboardScene {
  id: string;
  title: string;
  duration: number;
  narration: string;
  visualStyle: CreativePresetId;
  visualType: string;
  camera: string;
  animation: AnimationPreset;
  overlayText: string;
  subtitleText: string;
  soundDesign: string;
  transition: TransitionType;
  notes: string;
  approved: boolean;
  suggestedComponent: MotionComponentType;
  assetIds: string[];
  scriptSectionId?: string;
}

export type TrackType = 'video' | 'image' | 'graphics' | 'text' | 'audio';

export interface Scene3DConfig {
  modelAssetId?: string;
  proceduralArchetype: 'modular-core' | 'turbine-rotor' | 'orbital-array' | 'layered-chassis';
  cameraType: 'perspective' | 'orthographic';
  cameraDistance: number;
  cameraElevation: number;
  orbitSpeed: number;
  wireframe: boolean;
  explodedFactor: number;
  materialColor: string;
  accentColor: string;
  metalness: number;
  roughness: number;
  backgroundColor: string;
  transparentBg: boolean;
  showGrid: boolean;
  scale: number;
  rotationX: number;
  rotationY: number;
}

export interface MotionProps {
  title?: string;
  subtitle?: string;
  body?: string;
  label?: string;
  value?: number;
  unit?: string;
  prefix?: string;
  targetX?: number;
  targetY?: number;
  items?: Array<{ label: string; value: number; color?: string }>;
  leftTitle?: string;
  leftPoints?: string[];
  rightTitle?: string;
  rightPoints?: string[];
  milestones?: Array<{ year: string; title: string; detail: string }>;
  assetId?: string;
  accentColor?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
  progress?: number;
  ctaText?: string;
  scene3D?: Scene3DConfig;
}

export interface TimelineClip {
  id: string;
  trackType: TrackType;
  name: string;
  sceneId?: string;
  startTime: number;
  duration: number;
  layerOrder: number;
  opacity: number;
  // Spatial properties normalized 0..100 (% of canvas)
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  rotation: number;
  // Animation properties
  animation: AnimationPreset;
  animationDuration: number;
  animationDelay: number;
  easing: EasingType;
  direction: AnimationDirection;
  // Component / media payload
  componentType?: MotionComponentType;
  motionProps?: MotionProps;
  assetId?: string;
  // Audio-specific properties
  audioCategory?: 'narration' | 'music' | 'sfx' | 'ambient';
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  muted?: boolean;
  // Transitions
  transitionIn?: TransitionType;
  transitionDuration?: number;
}

export interface SubtitleCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  highlightedWords: string[];
  speaker?: string;
}

export interface SubtitleStyle {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  backgroundColor: string;
  position: 'bottom' | 'center' | 'top';
}

export type AssetKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'svg'
  | 'gif'
  | 'model3d'
  | 'font'
  | 'background'
  | 'document';

export interface MediaAsset {
  id: string;
  projectId: string;
  name: string;
  kind: AssetKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  tags: string[];
  license: string;
  attribution: string;
  source: 'uploaded' | 'ai-generated' | 'tts-generated' | 'procedural';
  duration?: number;
  width?: number;
  height?: number;
  audioCategory?: 'narration' | 'music' | 'sfx' | 'ambient';
  // Stored in IndexedDB assetBlobs store; objectUrl is hydrated at runtime
  hasBlob: boolean;
  textContent?: string;
}

export interface VoiceSettings {
  primaryVoice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  secondaryVoice: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  speakingStyle: string;
  multiSpeaker: boolean;
  model: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';
}

export interface AudioMixConfig {
  narrationVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  masterVolume: number;
}

export interface ExportConfig {
  aspectRatio: AspectRatioPreset;
  width: number;
  height: number;
  fps: FrameRate;
  resolution: ResolutionPreset;
  format: 'auto' | 'webm' | 'mp4';
  videoBitsPerSecond: number;
  burnSubtitles: boolean;
  includeAudio: boolean;
  previewQuality: 0.5 | 0.75 | 1;
}

export interface ProjectSettings {
  aspectRatio: AspectRatioPreset;
  width: number;
  height: number;
  fps: FrameRate;
  resolution: ResolutionPreset;
  durationCategory: DurationCategory;
  targetDurationSec: number;
  creativePresets: CreativePresetId[];
  primaryPresetId: CreativePresetId;
  researchMode: ResearchMode;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  subject: string;
  targetAudience: string;
  language: string;
  purpose: string;
  targetPlatform: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  aiBrief: {
    concept: string;
    outline: string[];
    referenceNotes: string;
    referenceUrls: string[];
    approvedDirection: boolean;
  };
  research: ResearchFinding[];
  script: ScriptSection[];
  storyboard: StoryboardScene[];
  clips: TimelineClip[];
  subtitles: SubtitleCue[];
  subtitleStyle: SubtitleStyle;
  voiceSettings: VoiceSettings;
  audioMix: AudioMixConfig;
  exportConfig: ExportConfig;
  scene3D: Scene3DConfig;
}
