import { Type } from '@google/genai';
import { createGeminiClient, GeminiServiceError, withRetry } from './geminiClient';
import { ModelRegistryService } from './modelRegistry';

function assertPaidConfirmed(modelTier: 'standard' | 'paid-tier', confirmedPaidUsage?: boolean, modelId?: string) {
  if (modelTier === 'paid-tier' && !confirmedPaidUsage) {
    throw new GeminiServiceError(
      `Model "${modelId}" requires paid API usage. Confirm paid-tier usage before running this generation request.`,
      402,
      'PAID_CONFIRMATION_REQUIRED'
    );
  }
}

export const ResearchService = {
  async researchTopic(input: {
    subject: string;
    audience: string;
    purpose: string;
    researchMode: string;
    referenceNotes?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    const model = ModelRegistryService.resolveModel(input.model, 'research-grounding', 'gemini-4-hydrogen');
    assertPaidConfirmed(model.tier, input.confirmedPaidUsage, model.id);

    const ai = createGeminiClient();
    const useSearch = input.researchMode === 'research-assisted' || input.researchMode === 'mixed';

    const prompt = [
      `You are a factual video research strategist preparing material for a video on: "${input.subject}".`,
      `Target audience: ${input.audience || 'General informed audience'}.`,
      `Video purpose: ${input.purpose || 'Educational explainer'}.`,
      input.referenceNotes ? `User-supplied reference notes:\n${input.referenceNotes}` : '',
      useSearch
        ? 'Use Google Search grounding to retrieve accurate, verifiable facts. Never invent statistics, quotes, dates, or citations.'
        : 'Rely strictly on well-established general knowledge and user-supplied notes. Distinguish established facts from creative framing.',
      'Return a concise structured research summary in Markdown with:',
      '1) Core Topic Understanding & Angle',
      '2) Verified Key Facts (bullet list)',
      '3) Claims Requiring Manual Verification or Caveats',
      '4) Recommended Visual Storytelling Approach (tailored specifically to this subject, never a generic template).',
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: model.id,
        contents: prompt,
        config: useSearch ? { tools: [{ googleSearch: {} }] } : undefined,
      })
    );

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk) => {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (!web?.uri) return null;
        return { title: web.title || web.uri, uri: web.uri };
      })
      .filter((s): s is { title: string; uri: string } => Boolean(s));

    return {
      modelUsed: model.id,
      summary: response.text || '',
      sources,
    };
  },
};

export const ScriptService = {
  async generateScript(input: {
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
    const model = ModelRegistryService.resolveModel(input.model, 'structured-json', 'gemini-4-hydrogen');
    assertPaidConfirmed(model.tier, input.confirmedPaidUsage, model.id);

    const ai = createGeminiClient();
    const targetWords = Math.max(45, Math.round((input.targetDurationSec / 60) * 145));

    const prompt = [
      `Create a complete, production-ready video script for the topic: "${input.subject}".`,
      input.description ? `Project brief: ${input.description}` : '',
      `Audience: ${input.audience}. Purpose: ${input.purpose}. Language: ${input.language}.`,
      `Creative direction: ${input.creativeDirection}.`,
      `Target total duration: ~${input.targetDurationSec} seconds (~${targetWords} spoken words total).`,
      input.researchNotes ? `Reference/research context:\n${input.researchNotes}` : '',
      'Do not fabricate statistics or quotes. Structure into 5–7 crisp sections spanning hook, introduction, main points, visual demonstration, conclusion, and call to action.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: model.id,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert documentary and explainer scriptwriter. Write vivid, concise spoken narration tailored to the user subject. Return valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              concept: { type: Type.STRING, description: 'One-paragraph creative concept summary.' },
              outline: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Ordered narrative beat outline.',
              },
              sections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    role: {
                      type: Type.STRING,
                      description: 'One of: hook, introduction, main, explanation, example, visual-demo, conclusion, cta',
                    },
                    title: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    speaker: { type: Type.STRING },
                    tone: { type: Type.STRING },
                    pronunciationNotes: { type: Type.STRING },
                    sceneMarker: { type: Type.STRING },
                    estimatedDuration: { type: Type.NUMBER },
                  },
                  required: ['role', 'title', 'narration', 'estimatedDuration'],
                },
              },
            },
            required: ['concept', 'outline', 'sections'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{}').trim());
    return { modelUsed: model.id, ...parsed };
  },

  async transformSection(input: {
    action: 'rewrite' | 'expand' | 'summarise' | 'improve-engagement' | 'change-tone' | 'change-audience';
    sectionTitle: string;
    narration: string;
    subject: string;
    targetTone?: string;
    targetAudience?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    const model = ModelRegistryService.resolveModel(input.model, 'text', 'gemini-4-hydrogen');
    assertPaidConfirmed(model.tier, input.confirmedPaidUsage, model.id);

    const ai = createGeminiClient();
    const actionInstructions: Record<string, string> = {
      rewrite: 'Rewrite this narration passage to be clearer, tighter, and more rhythmic when spoken aloud.',
      expand: 'Expand this narration passage with one concrete, accurate supporting explanation or analogy.',
      summarise: 'Condense this narration passage to roughly half its length while preserving the core insight.',
      'improve-engagement': 'Strengthen the opening phrasing and curiosity hook without sensationalism or invented claims.',
      'change-tone': `Rewrite this passage in a "${input.targetTone || 'conversational expert'}" tone.`,
      'change-audience': `Adapt this passage for a "${input.targetAudience || 'general curious'}" audience.`,
    };

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: model.id,
        contents: `Topic: ${input.subject}\nSection: ${input.sectionTitle}\nInstruction: ${actionInstructions[input.action]}\n\nOriginal narration:\n${input.narration}\n\nReturn ONLY the revised spoken narration text with no markdown headings or commentary.`,
      })
    );

    return {
      modelUsed: model.id,
      narration: (response.text || input.narration).trim(),
    };
  },
};

export const StoryboardService = {
  async generateStoryboard(input: {
    projectTitle: string;
    subject: string;
    creativeStyle: string;
    sections: Array<{ id: string; title: string; narration: string; estimatedDuration: number; role: string }>;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    const model = ModelRegistryService.resolveModel(input.model, 'structured-json', 'gemini-4-hydrogen');
    assertPaidConfirmed(model.tier, input.confirmedPaidUsage, model.id);

    const ai = createGeminiClient();
    const scriptSummary = input.sections
      .map((s, idx) => `Section ${idx + 1} (${s.role}, ~${s.estimatedDuration}s) — ${s.title}:\n${s.narration}`)
      .join('\n\n');

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: model.id,
        contents: `Convert this approved script for "${input.projectTitle}" (subject: ${input.subject}, style: ${input.creativeStyle}) into a scene-by-scene motion graphics storyboard.\n\n${scriptSummary}`,
        config: {
          systemInstruction:
            'You are a motion graphics director. For each script section, design a distinct visual scene choosing the best motion component from: AnimatedTitle, KineticTypography, BlueprintGrid, TechnicalCallout, AnimatedArrow, TrackingMarker, CircularDiagram, ExplodedView, DataCounter, ComparisonPanel, AnimatedChart, ProgressIndicator, InfographicCard, TimelineGraphic, ImageReveal, VideoFrame, SectionDivider, AnimatedDiagram, 3DModelViewer, EndCard.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    duration: { type: Type.NUMBER },
                    narration: { type: Type.STRING },
                    visualType: { type: Type.STRING },
                    camera: { type: Type.STRING },
                    animation: { type: Type.STRING },
                    overlayText: { type: Type.STRING },
                    soundDesign: { type: Type.STRING },
                    transition: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    suggestedComponent: { type: Type.STRING },
                  },
                  required: ['title', 'duration', 'narration', 'overlayText', 'suggestedComponent'],
                },
              },
            },
            required: ['scenes'],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text || '{"scenes":[]}').trim());
    return { modelUsed: model.id, scenes: parsed.scenes || [] };
  },
};

export const VoiceService = {
  async synthesizeSpeech(input: {
    text: string;
    voiceName: string;
    speakingStyle?: string;
    multiSpeaker?: boolean;
    secondaryVoiceName?: string;
    model?: string;
  }) {
    const allowedVoices = new Set(['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr']);
    const primaryVoice = allowedVoices.has(input.voiceName) ? input.voiceName : 'Kore';
    const secondaryVoice = allowedVoices.has(input.secondaryVoiceName || '') ? input.secondaryVoiceName! : 'Puck';

    const targetModelId = input.multiSpeaker
      ? 'gemini-3.8-flash-tts'
      : input.model === 'gemini-3.8-flash-tts'
      ? 'gemini-3.8-flash-tts'
      : 'gemini-3.8-flash-lite-tts';

    const ai = createGeminiClient();

    if (input.multiSpeaker) {
      const lines = input.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const parts = lines.map((line, i) => {
        const speaker = i % 2 === 0 ? 'Host' : 'Analyst';
        return {
          text: `${speaker}: ${line.replace(/^(Host|Analyst|Speaker\s*\d+):\s*/i, '')}`,
          speechMetadata: {
            speaker,
            style: input.speakingStyle || 'Clear, engaging documentary narrator',
          },
        };
      });

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: targetModelId,
          contents: [{ role: 'user', parts }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: [
                  { speaker: 'Host', voiceConfig: { prebuiltVoiceConfig: { voiceName: primaryVoice } } },
                  { speaker: 'Analyst', voiceConfig: { prebuiltVoiceConfig: { voiceName: secondaryVoice } } },
                ],
              },
            },
          },
        })
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new GeminiServiceError('No audio bytes returned by TTS model.', 502, 'EMPTY_AUDIO');
      }
      return { modelUsed: targetModelId, mimeType: 'audio/wav', base64Audio };
    }

    const response = await withRetry(() =>
      ai.models.generateContent({
        model: targetModelId,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: input.text,
                speechMetadata: {
                  style: input.speakingStyle || 'Clear, measured documentary narrator',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: primaryVoice },
            },
          },
        },
      })
    );

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new GeminiServiceError('No audio bytes returned by TTS model.', 502, 'EMPTY_AUDIO');
    }
    return { modelUsed: targetModelId, mimeType: 'audio/wav', base64Audio };
  },
};

export const TranscriptionService = {
  async transcribeAudio(input: { base64Audio: string; mimeType: string }) {
    const ai = createGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            { inlineData: { mimeType: input.mimeType || 'audio/wav', data: input.base64Audio } },
            { text: 'Transcribe this narration cleanly with natural sentence punctuation.' },
          ],
        },
      })
    );
    return { modelUsed: 'gemini-3.5-transcribe', transcript: (response.text || '').trim() };
  },
};

export const MediaAnalysisService = {
  async analyzeImage(input: { base64Image: string; mimeType: string; question?: string }) {
    const ai = createGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            { inlineData: { mimeType: input.mimeType || 'image/png', data: input.base64Image } },
            {
              text:
                input.question ||
                'Analyze this reference image for video production: describe its composition, palette, lighting, and suggest 2 motion graphics callouts or overlays that pair cleanly with it.',
            },
          ],
        },
      })
    );
    return { modelUsed: 'gemini-4-hydrogen', analysis: (response.text || '').trim() };
  },
};

export const ImageService = {
  async generateImage(input: {
    prompt: string;
    aspectRatio?: string;
    model?: string;
    confirmedPaidUsage?: boolean;
  }) {
    const model = ModelRegistryService.resolveModel(input.model, 'image-generation', 'gemini-3.1-flash-lite-image');
    assertPaidConfirmed(model.tier, input.confirmedPaidUsage, model.id);

    const ai = createGeminiClient();
    const response = await withRetry(() =>
      ai.models.generateContent({
        model: model.id,
        contents: input.prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: input.aspectRatio || '16:9',
          },
        },
      })
    );

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      throw new GeminiServiceError('Image generation returned no image data.', 502, 'EMPTY_IMAGE');
    }

    return {
      modelUsed: model.id,
      mimeType: imagePart.inlineData.mimeType || 'image/png',
      base64Image: imagePart.inlineData.data,
    };
  },
};
