import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import {
  GoogleGenAI,
  Type,
  type Content,
  type FunctionDeclaration,
} from '@google/genai';
import { createSeedCrewState, categoryToGardenElement } from './src/data/seedCrewState.ts';
import {
  HabitCategory,
  MissionId,
  type CrewAccountSummary,
  type CrewState,
  type HabitTask,
} from './src/types.ts';
import { applyDailyHabitReset, getSystemDateKey } from './src/utils/dailyReset.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'crew_store.json');

interface PersistedAccount {
  crewId: string;
  password: string;
  state: CrewState;
}

type CrewDatabase = Record<string, PersistedAccount>;

function loadDatabase(): CrewDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      return JSON.parse(raw) as CrewDatabase;
    }
  } catch (err) {
    console.error('Failed to load crew database, initializing defaults:', err);
  }

  const seeded: CrewDatabase = {
    'AST-042': {
      crewId: 'AST-042',
      password: 'orbit2026',
      state: createSeedCrewState('AST-042', 'Dr. Maya Lin', MissionId.ISS),
    },
    'CDR-017': {
      crewId: 'CDR-017',
      password: 'artemis',
      state: createSeedCrewState('CDR-017', 'Cmdr. Tariq Hassan', MissionId.LUNAR),
    },
  };
  saveDatabase(seeded);
  return seeded;
}

function saveDatabase(db: CrewDatabase): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist crew database:', err);
  }
}

let db: CrewDatabase = loadDatabase();

function getAccountSummaries(): CrewAccountSummary[] {
  return Object.values(db).map(({ state }) => ({
    crewId: state.crewId,
    crewName: state.crewName,
    roleTitle: state.roleTitle,
    missionId: state.missionId,
    missionSol: state.missionSol,
    avatarUrl: state.avatarUrl,
  }));
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  app.get('/api/crew/accounts', (_req, res) => {
    res.json({ accounts: getAccountSummaries() });
  });

  app.post('/api/auth/login', (req, res) => {
    const { crewId, password, missionId, clientDate } = req.body as {
      crewId?: string;
      password?: string;
      missionId?: MissionId;
      clientDate?: string;
    };

    const normalizedId = (crewId ?? '').trim().toUpperCase();
    if (!normalizedId || !password) {
      res.status(400).json({ error: 'Crew ID and password are required.' });
      return;
    }

    const existing = db[normalizedId];
    if (!existing) {
      res.status(401).json({
        error: 'Crew ID not found. Create a new account or choose an existing crew member.',
      });
      return;
    }

    if (existing.password !== password) {
      res.status(401).json({ error: 'Invalid password for this Crew ID.' });
      return;
    }

    if (missionId && Object.values(MissionId).includes(missionId)) {
      existing.state.missionId = missionId;
      saveDatabase(db);
    }

    const safeDate =
      typeof clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
        ? clientDate
        : getSystemDateKey();

    const { state: resetState, needsPersist } = applyDailyHabitReset(
      existing.state,
      safeDate
    );
    if (needsPersist) {
      existing.state = resetState;
      saveDatabase(db);
    }

    res.json({ state: existing.state, accounts: getAccountSummaries() });
  });

  app.post('/api/auth/register', (req, res) => {
    const { crewId, password, crewName, missionId, avatarUrl, clientDate } = req.body as {
      crewId?: string;
      password?: string;
      crewName?: string;
      missionId?: MissionId;
      avatarUrl?: string;
      clientDate?: string;
    };

    const normalizedId = (crewId ?? '').trim().toUpperCase();
    const cleanName = (crewName ?? '').trim();
    if (!cleanName || !normalizedId || !password || password.length < 4) {
      res.status(400).json({
        error: 'Provide your Name, Crew ID, and a password of at least 4 characters.',
      });
      return;
    }

    if (db[normalizedId]) {
      res.status(409).json({ error: 'This Crew ID already exists. Choose a different ID or sign in.' });
      return;
    }

    const safeMission =
      missionId && Object.values(MissionId).includes(missionId) ? missionId : MissionId.ISS;
    const cleanAvatar = (avatarUrl ?? '').trim() || undefined;
    const safeDate =
      typeof clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)
        ? clientDate
        : getSystemDateKey();
    const state = createSeedCrewState(
      normalizedId,
      cleanName,
      safeMission,
      cleanAvatar,
      safeDate
    );

    db[normalizedId] = {
      crewId: normalizedId,
      password,
      state,
    };
    saveDatabase(db);

    res.json({ state, accounts: getAccountSummaries() });
  });

  app.get('/api/state/:crewId', (req, res) => {
    const normalizedId = req.params.crewId.trim().toUpperCase();
    const record = db[normalizedId];
    if (!record) {
      res.status(404).json({ error: 'Crew profile not found.' });
      return;
    }
    const clientDate =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? req.query.date
        : getSystemDateKey();
    const { state: resetState, needsPersist } = applyDailyHabitReset(
      record.state,
      clientDate
    );
    if (needsPersist) {
      record.state = resetState;
      saveDatabase(db);
    }
    res.json({ state: record.state });
  });

  app.put('/api/state/:crewId', (req, res) => {
    const normalizedId = req.params.crewId.trim().toUpperCase();
    const record = db[normalizedId];
    if (!record) {
      res.status(404).json({ error: 'Crew profile not found.' });
      return;
    }
    const nextState = req.body?.state as CrewState | undefined;
    if (!nextState || nextState.crewId !== normalizedId) {
      res.status(400).json({ error: 'Invalid crew state payload.' });
      return;
    }
    record.state = nextState;
    saveDatabase(db);
    res.json({ state: record.state });
  });

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

  app.post('/api/assistant', async (req, res) => {
    const { crewId, message, history } = req.body as {
      crewId?: string;
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; text: string }>;
    };

    if (!message || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const dr7ApiKey = process.env.DR7_API_KEY?.trim();
    const hasDr7Key =
      Boolean(dr7ApiKey) &&
      dr7ApiKey !== 'MY_DR7_API_KEY' &&
      dr7ApiKey !== 'sk-dr7-your-api-key';
    const dr7Model =
      process.env.DR7_MEDGEMMA_MODEL?.trim() || 'medgemma-4b-it';

    const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
    const hasGeminiKey =
      Boolean(geminiApiKey) && geminiApiKey !== 'MY_GEMINI_API_KEY';

    if (!hasDr7Key && !hasGeminiKey) {
      res.status(503).json({
        error:
          'DR7_API_KEY is not configured in environment secrets. Add your Dr7.ai API key to use MedGemma.',
      });
      return;
    }

    const normalizedId = (crewId ?? 'AST-042').trim().toUpperCase();
    const record = db[normalizedId];
    const crewState = record?.state;
    const latestWatch =
      crewState?.watchReadings?.[crewState.watchReadings.length - 1];

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

    // Primary Path: Dr7.ai MedGemma OpenAI-compatible API
    if (hasDr7Key && dr7ApiKey) {
      const medGemmaSystemPrompt = [
        ...baseContextLines,
        'When the astronaut describes a physical symptom, mental health challenge, sleep issue, or adverse watch reading:',
        '1) Respond with warm, clinically grounded aerospace health guidance in 2-4 concise sentences referencing relevant NASA countermeasures (ARED, T2, CEVIS, BHP mindfulness, SSLA lighting, hydration/nutrition).',
        '2) At the very end of your message, append ONE structured JSON block wrapped in <habit_json>...</habit_json> so Vitanaut automatically adds a tailored habit to their tracker and garden.',
        'Format strictly as:',
        '<habit_json>{"title":"Short Habit Title","category":"muscle_bone|cardio|mental_health|sleep_circadian|nutrition","equipmentOrProtocol":"Specific protocol or machine","scheduledTime":"Today · Next Window","durationMinutes":15,"description":"1-2 sentence step-by-step instructions.","mentalBenefit":"How it helps mood or nervous system recovery.","conditionNote":"Symptom or goal addressed"}</habit_json>',
      ].join('\n');

      const medGemmaMessages = [
        { role: 'system', content: medGemmaSystemPrompt },
        ...(history ?? []).slice(-8).map((item) => ({
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: item.text,
        })),
        { role: 'user', content: message },
      ];

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25_000);
        const dr7Res = await fetch(DR7_MEDGEMMA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${dr7ApiKey}`,
          },
          body: JSON.stringify({
            model: dr7Model,
            messages: medGemmaMessages,
            max_tokens: 1000,
            temperature: 0.35,
            stream: false,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (dr7Res.ok) {
          const payload = (await dr7Res.json()) as {
            choices?: Array<{
              message?: { content?: string | Array<{ text?: string }> };
            }>;
          };
          const rawMessageContent = payload.choices?.[0]?.message?.content;
          const contentText = Array.isArray(rawMessageContent)
            ? rawMessageContent.map((p) => p.text ?? '').join('')
            : String(rawMessageContent ?? '');

          const { replyText, addedHabit } = parseMedGemmaResponse(
            contentText,
            message
          );

          if (addedHabit && record) {
            record.state.habits.unshift(addedHabit);
            saveDatabase(db);
          }

          const finalReply =
            replyText ||
            (addedHabit
              ? `I have added "${addedHabit.title}" to your daily mission tasks based on your condition.`
              : 'I am here to support your physical and mental health. How are you feeling right now?');

          res.json({
            reply: finalReply,
            addedHabit: addedHabit ?? null,
            provider: 'dr7-medgemma',
            model: dr7Model,
          });
          return;
        }

        const errBody = await dr7Res.text();
        console.error(`Dr7.ai MedGemma error (${dr7Res.status}):`, errBody);

        if (dr7Res.status === 401 || dr7Res.status === 403) {
          res.status(dr7Res.status).json({
            error:
              'Dr7.ai MedGemma authentication failed. Please check DR7_API_KEY in environment secrets.',
          });
          return;
        }

        if (!hasGeminiKey) {
          res.status(dr7Res.status).json({
            error: `Dr7.ai MedGemma service returned status ${dr7Res.status}.`,
          });
          return;
        }
      } catch (dr7Err: unknown) {
        console.error('Dr7.ai MedGemma request failed:', dr7Err);
        if (!hasGeminiKey) {
          const msg =
            dr7Err instanceof Error
              ? dr7Err.message
              : 'Failed to contact Dr7.ai MedGemma.';
          res.status(502).json({ error: msg });
          return;
        }
      }
    }

    // Fallback Path if DR7_API_KEY is unset or Dr7.ai experienced a transient outage
    const ai = new GoogleGenAI({
      apiKey: geminiApiKey!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = [
      ...baseContextLines,
      'Whenever the astronaut describes a physical symptom, mental health challenge, sleep issue, or adverse watch reading, you MUST:',
      '1) Acknowledge their physical and emotional experience warmly and practically in 2-4 concise sentences grounded in spaceflight countermeasures (ARED, T2, CEVIS, BHP mindfulness, SSLA lighting, nutrition).',
      '2) Call the `add_habit_to_tracker` tool to immediately create ONE targeted, realistic habit tailored to their condition so it appears in their habit list and grows a corresponding element in their garden (stone = muscle_bone, bird = mental_health, flower = cardio, sunbeam = sleep_circadian, tree = nutrition).',
      'Do not ask them to add the habit manually—use the tool directly whenever a condition, symptom, or request for a routine is mentioned.',
    ].join('\n');

    const contents: Content[] = (history ?? [])
      .slice(-8)
      .map((item) => ({
        role: item.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: item.text }],
      }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    try {
      const response1 = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: [addHabitDeclaration] }],
        },
      });

      const functionCalls = response1.functionCalls;
      let addedHabit: HabitTask | undefined;
      let replyText = (response1.text ?? '').trim();

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === 'add_habit_to_tracker' && call.args) {
          addedHabit = buildPrescribedHabit(
            call.args as Record<string, unknown>,
            message
          );

          if (record) {
            record.state.habits.unshift(addedHabit);
            saveDatabase(db);
          }

          const previousContent = response1.candidates?.[0]?.content;
          if (previousContent) {
            const response2 = await ai.models.generateContent({
              model: 'gemini-4-hydrogen',
              contents: [
                ...contents,
                previousContent,
                {
                  role: 'user',
                  parts: [
                    {
                      functionResponse: {
                        id: call.id,
                        name: call.name,
                        response: {
                          status: 'added',
                          habitTitle: addedHabit.title,
                          category: addedHabit.category,
                          gardenElement: addedHabit.gardenElement,
                        },
                      },
                    },
                  ],
                },
              ],
              config: {
                systemInstruction,
                tools: [{ functionDeclarations: [addHabitDeclaration] }],
              },
            });
            replyText = (response2.text ?? replyText).trim();
          }
        }
      }

      if (!replyText) {
        replyText = addedHabit
          ? `I have added "${addedHabit.title}" to your daily mission tasks to support your recovery.`
          : 'I am here to support both your physical readiness and mental wellbeing. How are you feeling right now?';
      }

      res.json({
        reply: replyText,
        addedHabit: addedHabit ?? null,
        provider: 'fallback',
        model: 'gemini-4-hydrogen',
      });
    } catch (err: unknown) {
      console.error('Assistant error:', err);
      const messageStr =
        err instanceof Error ? err.message : 'Assistant request failed.';
      res.status(500).json({ error: messageStr });
    }
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vitanaut server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
