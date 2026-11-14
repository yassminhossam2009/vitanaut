import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  FunctionDeclaration,
  GoogleGenAI,
  Type,
  Content,
} from '@google/genai';
import { categoryToGardenElement } from './src/data/seedCrewState.ts';
import {
  CrewState,
  HabitCategory,
  HabitTask,
  MissionId,
} from './src/types.ts';
import { applyDailyHabitReset, getSystemDateKey } from './src/utils/dailyReset.ts';
import {
  initDb,
  closeDb,
  findUserByCrewId,
  composeState,
  saveState,
  audit,
} from './server/db.ts';
import { router, requireAuth } from './server/routes.ts';
import { purgeExpiredSessions } from './server/sessions.ts';

dotenv.config();

const PORT = Number(process.env.PORT ?? 3000);

// Append a habit created by the assistant to a crew member's state.
function appendHabitToCrew(crewId: string, habit: HabitTask): void {
  const user = findUserByCrewId(crewId);
  const state = user ? composeState(user.id) : undefined;
  if (!user || !state) return;
  saveState(user.id, { ...state, habits: [habit, ...state.habits] });
}

const addHabitDeclaration: FunctionDeclaration = {
  name: 'add_habit_to_tracker',
  description:
    'Adds a new personalized physical or mental health habit to the astronaut habit tracker and living garden based on their reported health condition, symptoms, or watch readings.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'Concise, actionable name of the habit (e.g., "Lumbar Decompression Stretch & Box Breathing").',
      },
      category: {
        type: Type.STRING,
        description:
          'Must be one of: muscle_bone, cardio, mental_health, sleep_circadian, nutrition.',
      },
      equipmentOrProtocol: {
        type: Type.STRING,
        description:
          'Specific spaceflight machine or NASA protocol (e.g., "ARED Mobility Rig", "CEVIS Ergometer", "NASA BHP Guided Breathing", "SSLA Warm Amber Mode", "Electrolyte Solution").',
      },
      scheduledTime: {
        type: Type.STRING,
        description: 'Suggested daily UTC time or window (e.g., "19:30 UTC", "Pre-Sleep Window").',
      },
      durationMinutes: {
        type: Type.NUMBER,
        description: 'Recommended session length in minutes (e.g., 10, 15, 25).',
      },
      description: {
        type: Type.STRING,
        description: 'Clear 1-2 sentence step-by-step instructions tailored to the condition.',
      },
      mentalBenefit: {
        type: Type.STRING,
        description: 'How this habit supports mental wellbeing, stress regulation, or mood.',
      },
      conditionNote: {
        type: Type.STRING,
        description: 'Short summary of the health condition or symptom this habit addresses.',
      },
    },
    required: [
      'title',
      'category',
      'equipmentOrProtocol',
      'scheduledTime',
      'durationMinutes',
      'description',
      'mentalBenefit',
      'conditionNote',
    ],
  },
};

function normalizeCategory(raw: string): HabitCategory {
  const values = Object.values(HabitCategory) as string[];
  if (values.includes(raw)) return raw as HabitCategory;
  if (raw.includes('mental') || raw.includes('stress') || raw.includes('mood')) {
    return HabitCategory.MENTAL_HEALTH;
  }
  if (raw.includes('cardio') || raw.includes('heart')) {
    return HabitCategory.CARDIO;
  }
  if (raw.includes('sleep') || raw.includes('circadian')) {
    return HabitCategory.SLEEP_CIRCADIAN;
  }
  if (raw.includes('nutri') || raw.includes('hydrat') || raw.includes('food')) {
    return HabitCategory.NUTRITION;
  }
  return HabitCategory.MUSCLE_BONE;
}

export async function createApp() {
  initDb();
  purgeExpiredSessions();
  setInterval(purgeExpiredSessions, 6 * 3600_000).unref();

  const app = express();
  app.set('trust proxy', 1);
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
  });
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', router);

  const DR7_MEDGEMMA_URL = 'https://dr7.ai/api/v1/medical/chat/completions';

  function buildPrescribedHabit(
    args: Record<string, unknown>,
    fallbackCondition: string
  ): HabitTask {
    const category = normalizeCategory(String(args.category ?? 'mental_health'));
    const gardenElement = categoryToGardenElement(category);
    return {
      id: `hab-ai-${Date.now()}`,
      title: String(args.title ?? 'Targeted Spaceflight Countermeasure').slice(0, 90),
      category,
      gardenElement,
      equipmentOrProtocol: String(
        args.equipmentOrProtocol ?? 'MedGemma Clinical Countermeasure'
      ).slice(0, 90),
      scheduledTime: String(args.scheduledTime ?? 'Today · Next Window').slice(0, 40),
      durationMinutes: Math.max(
        5,
        Math.min(90, Math.round(Number(args.durationMinutes ?? 15)) || 15)
      ),
      description: String(
        args.description ??
          'Perform this guided recovery session at a comfortable pace.'
      ),
      mentalBenefit: String(
        args.mentalBenefit ?? 'Supports nervous system calm and mission focus.'
      ),
      nasaReference: 'MedGemma-Prescribed Countermeasure · NASA HRP Aligned',
      completedToday: false,
      isUrgent: true,
      addedByAssistant: true,
      conditionNote: String(args.conditionNote ?? fallbackCondition.slice(0, 120)),
    };
  }

  function inferHabitFromCondition(userMessage: string): HabitTask | undefined {
    const lower = userMessage.toLowerCase();
    const isConditionOrRequest =
      /(pain|ache|sore|tight|stiff|back|knee|neck|shoulder|muscle|bone|sleep|insomnia|tired|fatigue|exhaust|stress|anxi|isolat|homesick|sad|mood|depress|heart|hrv|pulse|bpm|dizz|headache|hydrat|water|nausea|habit|add|routine|recommend|prescribe)/.test(
        lower
      );
    if (!isConditionOrRequest) return undefined;

    if (/(sleep|insomnia|tired|fatigue|sunrise|circadian)/.test(lower)) {
      return buildPrescribedHabit(
        {
          title: 'Circadian Amber Wind-Down & Pre-Sleep Reset',
          category: HabitCategory.SLEEP_CIRCADIAN,
          equipmentOrProtocol: 'SSLA Warm Amber Lighting (2700K) + Sleep Mask',
          scheduledTime: 'Pre-Sleep Window',
          durationMinutes: 25,
          description:
            'Dim cabin lighting to warm amber 30 minutes before rest, silence telemetry alerts, and practice slow 4-7-8 exhalations.',
          mentalBenefit:
            'Calms hyperarousal from orbital light cycles and protects restorative deep sleep.',
          conditionNote: userMessage.slice(0, 120),
        },
        userMessage
      );
    }

    if (/(back|knee|neck|shoulder|muscle|bone|sore|tight|stiff|ared|squat)/.test(lower)) {
      return buildPrescribedHabit(
        {
          title: 'Spinal Unloading & Gentle Mobility Recovery',
          category: HabitCategory.MUSCLE_BONE,
          equipmentOrProtocol: 'ARED Mobility Harness & Core Stabilization',
          scheduledTime: 'Today · Next Window',
          durationMinutes: 15,
          description:
            'Perform controlled thoracic rotations, cat-camel spinal flexion, and low-load isometric glute/core holds without axial strain.',
          mentalBenefit:
            'Relieves physical tension and restores grounded proprioceptive confidence.',
          conditionNote: userMessage.slice(0, 120),
        },
        userMessage
      );
    }

    if (/(heart|hrv|cardio|bpm|pulse|eva|breath|stamina)/.test(lower)) {
      return buildPrescribedHabit(
        {
          title: 'Low-Impact Zone-2 Recovery Spin & Breath Pace',
          category: HabitCategory.CARDIO,
          equipmentOrProtocol: 'CEVIS Cycle Ergometer (Zone 2)',
          scheduledTime: 'Today · Recovery Slot',
          durationMinutes: 20,
          description:
            'Cycle at light resistance keeping heart rate steady at 60–70% max while maintaining nasal breathing to boost HRV recovery.',
          mentalBenefit:
            'Regulates autonomic nervous system balance and lowers post-EVA cardiovascular strain.',
          conditionNote: userMessage.slice(0, 120),
        },
        userMessage
      );
    }

    if (/(hydrat|water|nausea|headache|diet|eat|food|nutri)/.test(lower)) {
      return buildPrescribedHabit(
        {
          title: 'Electrolyte Rehydration & Micronutrient Boost',
          category: HabitCategory.NUTRITION,
          equipmentOrProtocol: 'ISS Potable Water + Potassium-Citrate Mix',
          scheduledTime: 'Today · Hydration Check',
          durationMinutes: 10,
          description:
            'Sip 500 mL electrolyte-balanced water steadily over 15 minutes alongside a light nutrient-dense snack.',
          mentalBenefit:
            'Stabilizes cerebral blood flow, eases headache fatigue, and sharpens cognitive focus.',
          conditionNote: userMessage.slice(0, 120),
        },
        userMessage
      );
    }

    return buildPrescribedHabit(
      {
        title: 'Mindful Decompression & Acoustic Grounding',
        category: HabitCategory.MENTAL_HEALTH,
        equipmentOrProtocol: 'NASA BHP Guided Breathing & Songbird Audio',
        scheduledTime: 'Today · Mental Break',
        durationMinutes: 15,
        description:
          'Step away from displays for 15 minutes of slow paced breathing (4s in, 6s out) paired with Earth nature acoustics and brief journaling.',
        mentalBenefit:
          'Lowers cortisol, counters isolation stress, and restores emotional steadiness.',
        conditionNote: userMessage.slice(0, 120),
      },
      userMessage
    );
  }

  function parseMedGemmaResponse(
    rawContent: string,
    userMessage: string
  ): { replyText: string; addedHabit?: HabitTask } {
    let replyText = rawContent.trim();
    let addedHabit: HabitTask | undefined;

    const tagMatch = /<habit_json>\s*([\s\S]*?)\s*<\/habit_json>/i.exec(replyText);
    const fencedMatch =
      !tagMatch &&
      /```(?:json)?\s*(\{[\s\S]*?"title"[\s\S]*?\})\s*```/i.exec(replyText);

    const jsonCandidate = tagMatch?.[1] ?? (fencedMatch ? fencedMatch[1] : null);
    if (tagMatch) {
      replyText = replyText.replace(tagMatch[0], '').trim();
    } else if (fencedMatch) {
      replyText = replyText.replace(fencedMatch[0], '').trim();
    }

    if (jsonCandidate) {
      try {
        const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;
        if (parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
          addedHabit = buildPrescribedHabit(parsed, userMessage);
        }
      } catch {
        // Ignore malformed JSON and fall back to keyword prescription if applicable
      }
    }

    if (!addedHabit) {
      addedHabit = inferHabitFromCondition(userMessage);
    }

    return { replyText, addedHabit };
  }

  type AssistantResult = {
    reply: string;
    addedHabit?: HabitTask;
    provider: string;
    model: string;
  };

  type ProviderInput = {
    message: string;
    history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    baseContextLines: string[];
  };

  function buildAssistantSystemPrompt(baseContextLines: string[]): string {
    return [
      ...baseContextLines,
      'When the astronaut describes a physical symptom, mental health challenge, sleep issue, or adverse watch reading:',
      '1) Respond with warm, clinically grounded aerospace health guidance in 2-4 concise sentences referencing relevant NASA countermeasures (ARED, T2, CEVIS, BHP mindfulness, SSLA lighting, hydration/nutrition).',
      '2) At the very end of your message, append ONE structured JSON block wrapped in <habit_json>...</habit_json> so Vitanaut automatically adds a tailored habit to their tracker and garden.',
      'Format strictly as:',
      '<habit_json>{"title":"Short Habit Title","category":"muscle_bone|cardio|mental_health|sleep_circadian|nutrition","equipmentOrProtocol":"Specific protocol or machine","scheduledTime":"Today · Next Window","durationMinutes":15,"description":"1-2 sentence step-by-step instructions.","mentalBenefit":"How it helps mood or nervous system recovery.","conditionNote":"Symptom or goal addressed"}</habit_json>',
      'Never diagnose. Encourage the astronaut to contact the flight surgeon for severe, worsening or emergency symptoms.',
    ].join('\n');
  }

  async function runDr7(input: ProviderInput): Promise<AssistantResult> {
    const apiKey = process.env.DR7_API_KEY?.trim();
    if (!apiKey) throw new Error('Dr7 is not configured.');
    const model = process.env.DR7_MEDGEMMA_MODEL?.trim() || 'medgemma-4b-it';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch('https://dr7.ai/api/v1/medical/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildAssistantSystemPrompt(input.baseContextLines) },
            ...(input.history ?? []).slice(-8).map((item) => ({
              role: item.role === 'assistant' ? 'assistant' : 'user',
              content: item.text,
            })),
            { role: 'user', content: input.message },
          ],
          max_tokens: 1000,
          temperature: 0.35,
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Dr7 MedGemma returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      const raw = payload.choices?.[0]?.message?.content;
      const content = Array.isArray(raw) ? raw.map((part) => part.text ?? '').join('') : String(raw ?? '');
      const { replyText, addedHabit } = parseMedGemmaResponse(content, input.message);
      return {
        reply: replyText || 'I am here to support your physical and mental health. How are you feeling right now?',
        addedHabit,
        provider: 'dr7-medgemma',
        model,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function runGemini(input: ProviderInput): Promise<AssistantResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error('Gemini is not configured.');
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash';
    const ai = new GoogleGenAI({ apiKey });
    const systemInstruction = [
      ...input.baseContextLines,
      'Whenever the astronaut describes a physical symptom, mental health challenge, sleep issue, or adverse watch reading, acknowledge it warmly and call the add_habit_to_tracker tool with ONE tailored habit.',
      'Never diagnose. Encourage the astronaut to contact the flight surgeon for severe, worsening or emergency symptoms.',
    ].join('\n');

    const contents: Content[] = (input.history ?? []).slice(-8).map((item) => ({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: item.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: input.message }] });

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: [addHabitDeclaration] }],
      },
    });

    let addedHabit: HabitTask | undefined;
    let replyText = (response.text ?? '').trim();
    const call = response.functionCalls?.[0];
    if (call?.name === 'add_habit_to_tracker' && call.args) {
      addedHabit = buildPrescribedHabit(call.args as Record<string, unknown>, input.message);
    }

    return {
      reply:
        replyText ||
        (addedHabit
          ? `I have added "${addedHabit.title}" to your daily mission tasks to support your recovery.`
          : 'I am here to support both your physical readiness and mental wellbeing. How are you feeling right now?'),
      addedHabit,
      provider: 'gemini',
      model,
    };
  }

  async function runOpenAI(input: ProviderInput): Promise<AssistantResult> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OpenAI is not configured.');
    const baseUrl = (
      process.env.OPENAI_BASE_URL ||
      process.env.OPENAI_API_BASE ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');
    const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5-mini';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildAssistantSystemPrompt(input.baseContextLines) },
            ...(input.history ?? []).slice(-8).map((item) => ({
              role: item.role === 'assistant' ? 'assistant' : 'user',
              content: item.text,
            })),
            { role: 'user', content: input.message },
          ],
          stream: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenAI returned ${response.status}: ${body.slice(0, 200)}`);
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
      };
      const raw = payload.choices?.[0]?.message?.content;
      const content = Array.isArray(raw) ? raw.map((part) => part.text ?? '').join('') : String(raw ?? '');
      const { replyText, addedHabit } = parseMedGemmaResponse(content, input.message);
      return {
        reply: replyText || 'I am here to support your physical and mental health. How are you feeling right now?',
        addedHabit,
        provider: 'openai',
        model,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  function runLocalAssistant(input: ProviderInput): AssistantResult {
    const addedHabit = inferHabitFromCondition(input.message);
    const reply = addedHabit
      ? `Thank you for telling me. I have added "${addedHabit.title}" to your daily tasks as a first countermeasure, and your garden will grow as you complete it. Keep the effort gentle, hydrate, and tell the flight surgeon if the symptom worsens or you feel unsafe.`
      : 'I am here to support your physical readiness and mental wellbeing. Tell me what you are feeling — pain, sleep problems, stress, isolation or fatigue — and I will suggest a NASA-aligned countermeasure and add it to your tracker.';
    return { reply, addedHabit, provider: 'local-guidance', model: 'rule-based' };
  }

  app.post('/api/assistant', requireAuth, async (req, res) => {
    const { crewId, message, history } = req.body as {
      crewId?: string;
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const normalizedId = (crewId ?? req.user!.crewId).trim().toUpperCase();
    if (normalizedId !== req.user!.crewId.toUpperCase()) {
      res.status(403).json({ error: 'This profile belongs to another crew member.' });
      return;
    }

    const user = findUserByCrewId(normalizedId);
    const crewState = user ? composeState(user.id) : undefined;
    const latestWatch = crewState?.watchReadings?.[crewState.watchReadings.length - 1];

    const baseContextLines = [
      'You are MedGemma, the Spaceflight Medical & Behavioral Health Assistant inside Vitanaut, a NASA-inspired astronaut habit sanctuary.',
      'Your role is to support both mental health (isolation, anxiety, sleep stress, mood regulation, cognitive fatigue) and physical health (bone density, muscle soreness, cardiovascular stamina, hydration, circadian alignment).',
      crewState
        ? `Current Astronaut Context: Name=${crewState.crewName}, Mission=${crewState.missionId}, Sol=${crewState.missionSol}, Active Habits=${crewState.habits.map((h) => h.title).join('; ')}.`
        : '',
      latestWatch
        ? `Latest Watch Telemetry: HR=${latestWatch.heartRateBpm} bpm, HRV=${latestWatch.hrvMs} ms, SpO2=${latestWatch.spo2Percent}%, Stress=${latestWatch.stressIndex}/100, Sleep=${latestWatch.sleepHours}h, BoneLoad=${latestWatch.boneLoadKn} kN.`
        : '',
    ].filter(Boolean);

    const input: ProviderInput = { message, history, baseContextLines };

    const isPlaceholder = (value: string | undefined) =>
      !value || value === 'MY_DR7_API_KEY' || value === 'MY_GEMINI_API_KEY' || value === 'sk-dr7-your-api-key';

    const providers: Array<{ label: string; run: () => Promise<AssistantResult> }> = [];
    if (!isPlaceholder(process.env.DR7_API_KEY?.trim())) {
      providers.push({ label: 'dr7-medgemma', run: () => runDr7(input) });
    }
    if (!isPlaceholder(process.env.GEMINI_API_KEY?.trim())) {
      providers.push({ label: 'gemini', run: () => runGemini(input) });
    }
    if (!isPlaceholder(process.env.OPENAI_API_KEY?.trim())) {
      providers.push({ label: 'openai', run: () => runOpenAI(input) });
    }

    let result: AssistantResult | undefined;
    for (const provider of providers) {
      try {
        result = await provider.run();
        break;
      } catch (error: unknown) {
        console.error(`Assistant provider ${provider.label} failed:`, error);
      }
    }

    if (!result) {
      result = runLocalAssistant(input);
    }

    if (result.addedHabit) {
      appendHabitToCrew(normalizedId, result.addedHabit);
    }

    res.json(result);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  return app;
}

async function startServer() {
  const app = await createApp();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vitanaut server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
