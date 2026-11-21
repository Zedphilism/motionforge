export interface ModelRegistryResponse {
  configured: boolean;
  models: Array<{
    id: string;
    label: string;
    provider: string;
    tier: 'standard' | 'paid-tier';
    capabilities: string[];
    inputFormats: string[];
    outputFormats: string[];
    recommendedFor: string;
    requiresConfirmation: boolean;
  }>;
  defaults: Record<string, string>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`) as Error & { code?: string; status?: number };
    err.code = data?.code;
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const AiClient = {
  async fetchModels(): Promise<ModelRegistryResponse> {
    const res = await fetch('/api/ai/models');
    if (!res.ok) throw new Error('Unable to load AI model registry.');
    return res.json();
  },

  researchTopic(payload: {
    subject: string;
    audience: string;
    purpose: string;
    researchMode: string;
    referenceNotes?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    return postJson<{ modelUsed: string; summary: string; sources: Array<{ title: string; uri: string }> }>(
      '/api/ai/research',
      payload
    );
  },

  generateScript(payload: {
    subject: string;
    description?: string;
    audience: string;
    purpose: string;
    language: string;
    targetDurationSec: number;
    creativeDirection: string;
    researchNotes?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    return postJson<{
      modelUsed: string;
      concept: string;
      outline: string[];
      sections: Array<{
        role: string;
        title: string;
        narration: string;
        speaker?: string;
        tone?: string;
        pronunciationNotes?: string;
        sceneMarker?: string;
        estimatedDuration: number;
      }>;
    }>('/api/ai/script/generate', payload);
  },

  transformScriptSection(payload: {
    action: 'rewrite' | 'expand' | 'summarise' | 'improve-engagement' | 'change-tone' | 'change-audience';
    sectionTitle: string;
    narration: string;
    subject: string;
    targetTone?: string;
    targetAudience?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    return postJson<{ modelUsed: string; narration: string }>('/api/ai/script/transform', payload);
  },

  generateStoryboard(payload: {
    projectTitle: string;
    subject: string;
    creativeStyle: string;
    sections: Array<{ id: string; title: string; narration: string; estimatedDuration: number; role: string }>;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    return postJson<{
      modelUsed: string;
      scenes: Array<{
        title: string;
        duration: number;
        narration: string;
        visualType?: string;
        camera?: string;
        animation?: string;
        overlayText: string;
        soundDesign?: string;
        transition?: string;
        notes?: string;
        suggestedComponent: string;
      }>;
    }>('/api/ai/storyboard/generate', payload);
  },

  synthesizeVoice(payload: {
    text: string;
    voiceName: string;
    speakingStyle?: string;
    multiSpeaker?: boolean;
    secondaryVoiceName?: string;
    model?: string;
  }) {
    return postJson<{ modelUsed: string; mimeType: string; base64Audio: string }>('/api/ai/voice/synthesize', payload);
  },

  transcribeAudio(payload: { base64Audio: string; mimeType: string }) {
    return postJson<{ modelUsed: string; transcript: string }>('/api/ai/audio/transcribe', payload);
  },

  analyzeImage(payload: { base64Image: string; mimeType: string; question?: string }) {
    return postJson<{ modelUsed: string; analysis: string }>('/api/ai/media/analyze', payload);
  },

  generateImage(payload: {
    prompt: string;
    aspectRatio?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    return postJson<{ modelUsed: string; mimeType: string; base64Image: string }>('/api/ai/image/generate', payload);
  },
};
