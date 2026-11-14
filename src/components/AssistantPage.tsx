import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, HeartPulse, Send, Sprout } from 'lucide-react';
import { CATEGORY_META, GARDEN_ELEMENT_META } from '../data/nasaResources.ts';
import { ChatMessage, CrewState, HabitTask } from '../types.ts';
import { apiFetch } from '../lib/api.ts';

interface AssistantPageProps {
  crewState: CrewState;
  draftPrompt?: string | null;
  onClearDraftPrompt?: () => void;
  onAssistantUpdate: (messages: ChatMessage[], addedHabit?: HabitTask) => void;
  onGoToTasks: () => void;
  onGoToGarden: () => void;
}

const CONDITION_PRESETS = [
  'I have lower back tightness after ARED resistive squats and feel mentally drained.',
  'Experiencing insomnia and anxiety from the 16 orbital sunrises per day.',
  'Feeling isolated and homesick halfway through this mission sol.',
  'My watch showed elevated resting heart rate and low HRV after today’s EVA prep.',
];

export const AssistantPage: React.FC<AssistantPageProps> = ({
  crewState,
  draftPrompt,
  onClearDraftPrompt,
  onAssistantUpdate,
  onGoToTasks,
  onGoToGarden,
}) => {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (draftPrompt) {
      setInput(draftPrompt);
      onClearDraftPrompt?.();
    }
  }, [draftPrompt, onClearDraftPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [crewState.chatMessages.length, sending]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };

    const nextMessages = [...crewState.chatMessages, userMsg];
    onAssistantUpdate(nextMessages);
    setInput('');
    setSending(true);

    try {
      const res = await apiFetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewId: crewState.crewId,
          message: trimmed,
          history: nextMessages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = (await res.json()) as {
        reply?: string;
        addedHabit?: HabitTask | null;
        error?: string;
      };

      if (!res.ok) {
        const errMsg: ChatMessage = {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          text:
            data.error ??
            'Unable to connect to the Health Assistant right now. Please try again.',
          timestamp: new Date().toISOString(),
          error: true,
        };
        onAssistantUpdate([...nextMessages, errMsg]);
        return;
      }

      const aiMsg: ChatMessage = {
        id: `msg-a-${Date.now()}`,
        role: 'assistant',
        text: data.reply ?? 'Countermeasure guidance logged.',
        timestamp: new Date().toISOString(),
        addedHabit: data.addedHabit ?? undefined,
      };
      onAssistantUpdate([...nextMessages, aiMsg], data.addedHabit ?? undefined);
    } catch {
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        text: 'Network interruption while contacting the Health Assistant.',
        timestamp: new Date().toISOString(),
        error: true,
      };
      onAssistantUpdate([...nextMessages, errMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const latestWatch = crewState.watchReadings[crewState.watchReadings.length - 1];
  const prescribedHabits = crewState.habits.filter((h) => h.addedByAssistant);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <aside className="lg:col-span-4 space-y-5">
          <div className="bg-white border border-[#D5E3DD] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0369A1]">
              <HeartPulse className="w-4 h-4" />
              <span>MedGemma · Condition Intake</span>
            </div>
            <h1 className="text-xl font-bold text-[#0F2922]">
              Flight Health Assistant
            </h1>
            <p className="text-sm text-[#3B5950] leading-relaxed">
              Powered by MedGemma medical AI. Describe physical soreness, sleep disruption, stress, or fatigue to receive guidance and add a tailored habit to your tracker and garden.
            </p>
          </div>

          {latestWatch && (
            <div className="bg-[#EBF3FA] border border-[#CBE0EE] rounded-2xl p-5 space-y-2.5">
              <div className="text-xs font-semibold text-[#075985]">
                Watch Telemetry Shared with Assistant
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[#4A685F]">Heart Rate</div>
                  <div className="font-mono font-bold text-base tabular-nums text-[#0F2922]">
                    {latestWatch.heartRateBpm} bpm
                  </div>
                </div>
                <div>
                  <div className="text-[#4A685F]">HRV</div>
                  <div className="font-mono font-bold text-base tabular-nums text-[#0F2922]">
                    {latestWatch.hrvMs} ms
                  </div>
                </div>
                <div>
                  <div className="text-[#4A685F]">Stress Index</div>
                  <div className="font-mono font-bold text-base tabular-nums text-[#0F2922]">
                    {latestWatch.stressIndex} / 100
                  </div>
                </div>
                <div>
                  <div className="text-[#4A685F]">Last Sleep</div>
                  <div className="font-mono font-bold text-base tabular-nums text-[#0F2922]">
                    {latestWatch.sleepHours} hrs
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white border border-[#D5E3DD] rounded-2xl p-5 space-y-3">
            <div className="text-xs font-semibold text-[#3B5950]">
              Quick Condition Prompts
            </div>
            <div className="space-y-2">
              {CONDITION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={sending}
                  onClick={() => void sendMessage(preset)}
                  className="w-full text-left p-3 rounded-xl bg-[#F6FAF8] hover:bg-[#EFF6F2] border border-[#D5E3DD] text-xs text-[#0F2922] leading-relaxed transition-colors cursor-pointer disabled:opacity-60"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {prescribedHabits.length > 0 && (
            <div className="bg-[#FEFCE8] border border-[#FDE047] rounded-2xl p-5 space-y-2.5">
              <div className="text-xs font-semibold text-[#A16207]">
                Habits Added by Assistant ({prescribedHabits.length})
              </div>
              <ul className="space-y-2">
                {prescribedHabits.map((hab) => (
                  <li key={hab.id} className="text-xs text-[#4B4429] border-t border-[#FDE047]/60 pt-2">
                    <div className="font-semibold text-[#0F2922]">{hab.title}</div>
                    <div className="font-mono text-[11px] text-[#713F12]">
                      {CATEGORY_META[hab.category].shortLabel} · {hab.scheduledTime}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        <section className="lg:col-span-8 bg-white border border-[#D5E3DD] rounded-2xl flex flex-col h-[74vh] min-h-[540px] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E4EDE9] bg-[#F6FAF8] flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#0F2922]">
                MedGemma Behavioral &amp; Clinical Consultation
              </h2>
              <p className="text-xs text-[#4A685F]">
                Evaluates watch vitals and prescribes tailored habits to your tracker &amp; garden
              </p>
            </div>
            <button
              type="button"
              onClick={onGoToTasks}
              className="px-3 py-1.5 text-xs font-semibold text-[#0369A1] bg-[#EBF3FA] hover:bg-[#DBEAFE] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              View All Tasks
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {crewState.chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-2xl px-4 py-3.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-[#0369A1] text-white'
                        : msg.error
                          ? 'bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B]'
                          : 'bg-[#EFF6F2] border border-[#D5E3DD] text-[#0F2922]'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>

                  {msg.addedHabit && (
                    <div className="mt-2.5 max-w-2xl w-full rounded-xl bg-[#FEFCE8] border border-[#EAB308]/60 p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#15803D] inline-flex items-center gap-1.5">
                          <Sprout className="w-4 h-4" />
                          <span>New Habit Added to Your Tracker</span>
                        </span>
                        <span className="font-mono text-[#713F12]">
                          {CATEGORY_META[msg.addedHabit.category].label} ·{' '}
                          {GARDEN_ELEMENT_META[msg.addedHabit.gardenElement].name}
                        </span>
                      </div>

                      <div className="text-base font-bold text-[#0F2922]">
                        {msg.addedHabit.title}
                      </div>
                      <p className="text-xs text-[#4B4429] leading-relaxed">
                        {msg.addedHabit.description}
                      </p>
                      <div className="text-xs text-[#3B5950]">
                        <strong>Protocol:</strong> {msg.addedHabit.equipmentOrProtocol} ·{' '}
                        <span className="font-mono">{msg.addedHabit.scheduledTime}</span> (
                        {msg.addedHabit.durationMinutes} min)
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={onGoToTasks}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>Open in Tasks</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={onGoToGarden}
                          className="px-3 py-1.5 text-xs font-semibold text-[#15803D] bg-white border border-[#86EFAC] hover:bg-[#ECFDF5] rounded-lg transition-colors cursor-pointer"
                        >
                          See in Garden
                        </button>
                      </div>
                    </div>
                  )}

                  <span className="text-[11px] font-mono text-[#5C7A70] mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start">
                <div className="rounded-2xl px-4 py-3 bg-[#EFF6F2] border border-[#D5E3DD] text-sm text-[#3B5950]">
                  Analyzing condition &amp; calibrating countermeasure habit...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-4 border-t border-[#E4EDE9] bg-[#FBFDFC] flex items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter physical symptoms, sleep issues, or mental health feelings..."
              className="flex-1 px-4 py-2.5 text-sm bg-white border border-[#C9DBD4] rounded-xl text-[#0F2922] focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-[#0369A1] hover:bg-[#075985] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Send</span>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
