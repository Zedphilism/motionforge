import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ModelRegistryService } from './src/server/ai/modelRegistry';
import {
  ImageService,
  MediaAnalysisService,
  ResearchService,
  ScriptService,
  StoryboardService,
  TranscriptionService,
  VoiceService,
} from './src/server/ai/services';
import { GeminiServiceError } from './src/server/ai/geminiClient';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '25mb' }));

  // Model Registry & Health
  app.get('/api/ai/models', (_req, res) => {
    res.json(ModelRegistryService.listModels());
  });

  // Research Service
  app.post('/api/ai/research', async (req, res) => {
    try {
      const { subject, audience, purpose, researchMode, referenceNotes, model, confirmedPaidUsage } = req.body || {};
      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        res.status(400).json({ error: 'A project subject or topic is required.' });
        return;
      }
      const result = await ResearchService.researchTopic({
        subject: subject.trim().slice(0, 500),
        audience: typeof audience === 'string' ? audience.slice(0, 200) : '',
        purpose: typeof purpose === 'string' ? purpose.slice(0, 200) : '',
        researchMode: typeof researchMode === 'string' ? researchMode : 'research-assisted',
        referenceNotes: typeof referenceNotes === 'string' ? referenceNotes.slice(0, 6000) : '',
        model: typeof model === 'string' ? model : undefined,
        confirmedPaidUsage: Boolean(confirmedPaidUsage),
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Script Generation Service
  app.post('/api/ai/script/generate', async (req, res) => {
    try {
      const {
        subject,
        description,
        audience,
        purpose,
        language,
        targetDurationSec,
        creativeDirection,
        researchNotes,
        model,
        confirmedPaidUsage,
      } = req.body || {};
      if (!subject || typeof subject !== 'string' || !subject.trim()) {
        res.status(400).json({ error: 'A subject is required to generate a script.' });
        return;
      }
      const result = await ScriptService.generateScript({
        subject: subject.trim().slice(0, 500),
        description: typeof description === 'string' ? description.slice(0, 1500) : '',
        audience: typeof audience === 'string' ? audience.slice(0, 200) : 'General audience',
        purpose: typeof purpose === 'string' ? purpose.slice(0, 200) : 'Explainer',
        language: typeof language === 'string' ? language.slice(0, 60) : 'English',
        targetDurationSec: Number.isFinite(Number(targetDurationSec))
          ? Math.max(15, Math.min(1200, Number(targetDurationSec)))
          : 60,
        creativeDirection: typeof creativeDirection === 'string' ? creativeDirection.slice(0, 400) : 'Technical Blueprint',
        researchNotes: typeof researchNotes === 'string' ? researchNotes.slice(0, 6000) : '',
        model: typeof model === 'string' ? model : undefined,
        confirmedPaidUsage: Boolean(confirmedPaidUsage),
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Script Section Transform Service
  app.post('/api/ai/script/transform', async (req, res) => {
    try {
      const { action, sectionTitle, narration, subject, targetTone, targetAudience, model, confirmedPaidUsage } =
        req.body || {};
      const validActions = new Set([
        'rewrite',
        'expand',
        'summarise',
        'improve-engagement',
        'change-tone',
        'change-audience',
      ]);
      if (!validActions.has(action) || typeof narration !== 'string' || !narration.trim()) {
        res.status(400).json({ error: 'Valid transform action and section narration text are required.' });
        return;
      }
      const result = await ScriptService.transformSection({
        action,
        sectionTitle: typeof sectionTitle === 'string' ? sectionTitle.slice(0, 200) : 'Section',
        narration: narration.slice(0, 4000),
        subject: typeof subject === 'string' ? subject.slice(0, 300) : '',
        targetTone: typeof targetTone === 'string' ? targetTone.slice(0, 100) : undefined,
        targetAudience: typeof targetAudience === 'string' ? targetAudience.slice(0, 100) : undefined,
        model: typeof model === 'string' ? model : undefined,
        confirmedPaidUsage: Boolean(confirmedPaidUsage),
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Storyboard Generation Service
  app.post('/api/ai/storyboard/generate', async (req, res) => {
    try {
      const { projectTitle, subject, creativeStyle, sections, model, confirmedPaidUsage } = req.body || {};
      if (!Array.isArray(sections) || sections.length === 0) {
        res.status(400).json({ error: 'At least one script section is required to generate a storyboard.' });
        return;
      }
      const result = await StoryboardService.generateStoryboard({
        projectTitle: typeof projectTitle === 'string' ? projectTitle.slice(0, 200) : 'Untitled Project',
        subject: typeof subject === 'string' ? subject.slice(0, 400) : '',
        creativeStyle: typeof creativeStyle === 'string' ? creativeStyle.slice(0, 200) : 'Technical Blueprint',
        sections: sections.slice(0, 30),
        model: typeof model === 'string' ? model : undefined,
        confirmedPaidUsage: Boolean(confirmedPaidUsage),
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Voice TTS Service
  app.post('/api/ai/voice/synthesize', async (req, res) => {
    try {
      const { text, voiceName, speakingStyle, multiSpeaker, secondaryVoiceName, model } = req.body || {};
      if (typeof text !== 'string' || !text.trim()) {
        res.status(400).json({ error: 'Narration text is required for speech synthesis.' });
        return;
      }
      const result = await VoiceService.synthesizeSpeech({
        text: text.trim().slice(0, 4000),
        voiceName: typeof voiceName === 'string' ? voiceName : 'Kore',
        speakingStyle: typeof speakingStyle === 'string' ? speakingStyle.slice(0, 200) : undefined,
        multiSpeaker: Boolean(multiSpeaker),
        secondaryVoiceName: typeof secondaryVoiceName === 'string' ? secondaryVoiceName : undefined,
        model: typeof model === 'string' ? model : undefined,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Audio Transcription Service
  app.post('/api/ai/audio/transcribe', async (req, res) => {
    try {
      const { base64Audio, mimeType } = req.body || {};
      if (typeof base64Audio !== 'string' || !base64Audio) {
        res.status(400).json({ error: 'Base64 audio data is required.' });
        return;
      }
      const result = await TranscriptionService.transcribeAudio({
        base64Audio,
        mimeType: typeof mimeType === 'string' ? mimeType : 'audio/wav',
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Multimodal Media Analysis Service
  app.post('/api/ai/media/analyze', async (req, res) => {
    try {
      const { base64Image, mimeType, question } = req.body || {};
      if (typeof base64Image !== 'string' || !base64Image) {
        res.status(400).json({ error: 'Base64 image data is required.' });
        return;
      }
      const result = await MediaAnalysisService.analyzeImage({
        base64Image,
        mimeType: typeof mimeType === 'string' ? mimeType : 'image/png',
        question: typeof question === 'string' ? question.slice(0, 400) : undefined,
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Optional Paid-Tier Image Generation Adapter
  app.post('/api/ai/image/generate', async (req, res) => {
    try {
      const { prompt, aspectRatio, model, confirmedPaidUsage } = req.body || {};
      if (typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'An image prompt is required.' });
        return;
      }
      const result = await ImageService.generateImage({
        prompt: prompt.trim().slice(0, 1000),
        aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : '16:9',
        model: typeof model === 'string' ? model : undefined,
        confirmedPaidUsage: Boolean(confirmedPaidUsage),
      });
      res.json(result);
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // Mount Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MOTIONFORGE server listening on http://localhost:${PORT}`);
  });
}

function handleApiError(res: express.Response, err: unknown) {
  if (err instanceof GeminiServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json({ error: message, code: 'INTERNAL_ERROR' });
}

startServer().catch((err) => {
  console.error('Failed to start MOTIONFORGE server:', err);
  process.exit(1);
});
