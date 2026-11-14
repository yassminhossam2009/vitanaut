// End-to-end API test. Run against a running server:
//   BASE_URL=http://localhost:3100 node scripts/smoke-api.mjs
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

let passed = 0;
let failed = 0;
function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`ok   ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
}

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, data };
}

const health = await req('/api/health');
check('health responds', health.status === 200 && health.data.ok === true);

const accounts = await req('/api/crew/accounts');
check('demo accounts listed', accounts.data.accounts.length === 2, JSON.stringify(accounts.data));

const badLogin = await req('/api/auth/login', {
  method: 'POST',
  body: { crewId: 'AST-042', password: 'wrong' },
});
check('wrong password rejected', badLogin.status === 401);

const login = await req('/api/auth/login', {
  method: 'POST',
  body: { crewId: 'AST-042', password: 'orbit2026' },
});
check('login succeeds', login.status === 200 && Boolean(login.data.token));
const token = login.data.token;
const crewState = login.data.state;
check('state returned with habits', Array.isArray(crewState.habits) && crewState.habits.length > 0);

const anon = await req('/api/state/AST-042');
check('state requires auth', anon.status === 401);

const cross = await req('/api/state/CDR-017', { token });
check('cannot read another crew profile', cross.status === 403);

const catalog = await req('/api/parameters');
check(
  'guideline baseline is loaded',
  catalog.status === 200 && catalog.data.parameters.length >= 41,
  `got ${catalog.data.parameters.length}`
);

const warnings = await req('/api/warnings', { token });
check(
  'warning engine evaluates monitored metrics',
  warnings.status === 200 && Array.isArray(warnings.data.checked) && warnings.data.checked.length > 0
);
check(
  'warnings carry consequence text',
  warnings.data.alerts.every((a) => Boolean(a.consequence) && Boolean(a.operationalImpact))
);

const stateGet = await req('/api/state/AST-042', { token });
check('owner can read state', stateGet.status === 200 && stateGet.data.state.crewId === 'AST-042');

const habit = crewState.habits[0];
const nextState = {
  ...crewState,
  habits: crewState.habits.map((h) =>
    h.id === habit.id ? { ...h, completedToday: true } : h
  ),
  history: [
    {
      id: `smoke-log-${Date.now()}`,
      habitId: habit.id,
      title: habit.title,
      category: habit.category,
      gardenElement: habit.gardenElement,
      completedAt: new Date().toISOString(),
      missionId: crewState.missionId,
      durationMinutes: habit.durationMinutes,
      moodBefore: 55,
      moodAfter: 74,
      notes: 'smoke test',
    },
    ...crewState.history,
  ],
};
const put = await req('/api/state/AST-042', { method: 'PUT', token, body: { state: nextState } });
check('state sync saves', put.status === 200 && put.data.state.habits.some((h) => h.completedToday));

const reading = {
  id: `smoke-watch-${Date.now()}`,
  timestamp: new Date().toISOString(),
  heartRateBpm: 68,
  hrvMs: 52,
  spo2Percent: 98,
  stressIndex: 31,
  sleepHours: 6.7,
  deepSleepPercent: 21,
  boneLoadKn: 1.6,
  activeMinutes: 64,
  source: 'wearable_sync',
  deviceId: 'smoke-watch-1',
};
const post = await req('/api/watch/readings', { method: 'POST', token, body: { reading } });
check('wearable reading accepted', post.status === 201 && post.data.inserted === 1);

const invalid = await req('/api/watch/readings', {
  method: 'POST',
  token,
  body: { reading: { ...reading, id: 'bad-1', heartRateBpm: 500 } },
});
check('invalid reading rejected', invalid.status === 422);

const watches = await req('/api/watch/readings?limit=5', { token });
check('reading is stored', watches.data.readings.some((r) => r.id === reading.id));

const history = await req('/api/history?limit=10', { token });
check('private history stored', history.data.total > 0 && history.data.entries.length > 0);

const param = {
  parameterId: 'sleep_duration_h',
  domain: 'sleep',
  name: 'Sleep duration per 24 h',
  unit: 'h',
  direction: 'higher_better',
  cadence: 'daily',
  source: 'NASA OCHMO-TB-041',
  sourceRef: 'TB-041',
  evidenceGrade: 'A',
  bands: { greenMin: 7, greenMax: 9, yellowMin: 6, yellowMax: 10, redBelow: 6, redAbove: 10 },
};
const imp = await req('/api/parameters/import', { method: 'POST', token, body: { parameters: [param] } });
check('guideline import works', imp.status === 200 && imp.data.imported === 1);
const params = await req('/api/parameters');
check('guideline catalog readable', params.data.parameters.some((p) => p.parameterId === 'sleep_duration_h'));

const newId = `TST-${Date.now().toString().slice(-5)}`;
const reg = await req('/api/auth/register', {
  method: 'POST',
  body: { crewId: newId, password: 'testpass123', crewName: 'Smoke Tester', missionId: 'mars' },
});
check('registration works', reg.status === 201 && reg.data.state.missionId === 'mars');

const dup = await req('/api/auth/register', {
  method: 'POST',
  body: { crewId: newId, password: 'testpass123', crewName: 'Dup', missionId: 'mars' },
});
check('duplicate crew id rejected', dup.status === 409);

const logout = await req('/api/auth/logout', { method: 'POST', token });
check('logout succeeds', logout.status === 200);
const after = await req('/api/auth/me', { token });
check('token invalid after logout', after.status === 401);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
