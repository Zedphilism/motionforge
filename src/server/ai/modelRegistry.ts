import { isGeminiConfigured } from './geminiClient';

export type ModelCapability =
  | 'text'
  | 'research-grounding'
  | 'structured-json'
  | 'multimodal-analysis'
  | 'tts'
  | 'tts-multispeaker'
  | 'transcription'
  | 'image-generation'
  | 'video-generation'
  | 'music-generation';

export interface RegisteredModel {
  id: string;
  label: string;
  provider: 'google-gemini';
  tier: 'standard' | 'paid-tier';
  capabilities: ModelCapability[];
  inputFormats: string[];
  outputFormats: string[];
  recommendedFor: string;
  requiresConfirmation: boolean;
}

const MODEL_CATALOG: RegisteredModel[] = [
  {
    id: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (Fast)',
    provider: 'google-gemini',
    tier: 'standard',
    capabilities: ['text', 'research-grounding', 'structured-json', 'multimodal-analysis'],
    inputFormats: ['text', 'image', 'url'],
    outputFormats: ['text', 'json'],
    recommendedFor: 'Research grounding, script drafting, rewrites, storyboard generation, and media analysis.',
    requiresConfirmation: false,
  },
  {
    id: 'gemini-4-neon',
    label: 'Gemini 4 Neon (Complex Reasoning)',
    provider: 'google-gemini',
    tier: 'paid-tier',
    capabilities: ['text', 'research-grounding', 'structured-json', 'multimodal-analysis'],
    inputFormats: ['text', 'image'],
    outputFormats: ['text', 'json'],
    recommendedFor: 'Deep technical documentaries, complex STEM scripting, and multi-source synthesis.',
    requiresConfirmation: true,
  },
  {
    id: 'gemini-3.8-flash-lite-tts',
    label: 'Gemini 3.8 Flash Lite TTS',
    provider: 'google-gemini',
    tier: 'standard',
    capabilities: ['tts'],
    inputFormats: ['text'],
    outputFormats: ['audio/wav'],
    recommendedFor: 'Fast single-speaker narration across scenes and explainers.',
    requiresConfirmation: false,
  },
  {
    id: 'gemini-3.8-flash-tts',
    label: 'Gemini 3.8 Flash TTS (Multi-Speaker)',
    provider: 'google-gemini',
    tier: 'standard',
    capabilities: ['tts', 'tts-multispeaker'],
    inputFormats: ['text'],
    outputFormats: ['audio/wav'],
    recommendedFor: 'Dual-speaker dialogue, custom voice personas, and expressive narration.',
    requiresConfirmation: false,
  },
  {
    id: 'gemini-3.5-transcribe',
    label: 'Gemini 3.5 Transcribe',
    provider: 'google-gemini',
    tier: 'standard',
    capabilities: ['transcription'],
    inputFormats: ['audio/wav', 'audio/mp3', 'audio/webm'],
    outputFormats: ['text'],
    recommendedFor: 'Transcribing uploaded narration and voiceovers for subtitle alignment.',
    requiresConfirmation: false,
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Nano Banana (Flash Image)',
    provider: 'google-gemini',
    tier: 'paid-tier',
    capabilities: ['image-generation'],
    inputFormats: ['text', 'image'],
    outputFormats: ['image/png', 'image/jpeg'],
    recommendedFor: 'Fast concept illustrations, scene backdrops, and visual variations (requires paid API key).',
    requiresConfirmation: true,
  },
  {
    id: 'gemini-nano-banana-2.1',
    label: 'Nano Banana 2.1 (High Resolution)',
    provider: 'google-gemini',
    tier: 'paid-tier',
    capabilities: ['image-generation'],
    inputFormats: ['text', 'image'],
    outputFormats: ['image/png', 'image/jpeg'],
    recommendedFor: 'High-detail 1K–4K production artwork and reference-guided imagery (requires paid API key).',
    requiresConfirmation: true,
  },
  {
    id: 'gemini-omni-1.2-flash',
    label: 'Gemini Omni / Veo Video',
    provider: 'google-gemini',
    tier: 'paid-tier',
    capabilities: ['video-generation'],
    inputFormats: ['text', 'image'],
    outputFormats: ['video/mp4'],
    recommendedFor: 'Optional short generative B-roll clips (requires paid API key and async job execution).',
    requiresConfirmation: true,
  },
  {
    id: 'lyria-3-clip-preview',
    label: 'Lyria 3 Clip (Music)',
    provider: 'google-gemini',
    tier: 'paid-tier',
    capabilities: ['music-generation'],
    inputFormats: ['text'],
    outputFormats: ['audio/mpeg'],
    recommendedFor: 'Optional 30-second instrumental background music beds (requires paid API key).',
    requiresConfirmation: true,
  },
];

export const ModelRegistryService = {
  listModels(): {
    configured: boolean;
    models: RegisteredModel[];
    defaults: Record<string, string>;
  } {
    return {
      configured: isGeminiConfigured(),
      models: MODEL_CATALOG,
      defaults: {
        research: 'gemini-4-hydrogen',
        script: 'gemini-4-hydrogen',
        storyboard: 'gemini-4-hydrogen',
        tts: 'gemini-3.8-flash-lite-tts',
        ttsMultiSpeaker: 'gemini-3.8-flash-tts',
        transcription: 'gemini-3.5-transcribe',
        mediaAnalysis: 'gemini-4-hydrogen',
        image: 'gemini-3.1-flash-lite-image',
        video: 'gemini-omni-1.2-flash',
        music: 'lyria-3-clip-preview',
      },
    };
  },

  resolveModel(requestedId: string | undefined, capability: ModelCapability, fallbackId: string): RegisteredModel {
    const candidate = requestedId
      ? MODEL_CATALOG.find((m) => m.id === requestedId && m.capabilities.includes(capability))
      : undefined;
    if (candidate) return candidate;
    return MODEL_CATALOG.find((m) => m.id === fallbackId) || MODEL_CATALOG[0];
  },
};
