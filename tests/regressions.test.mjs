import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');

// Load the actual TypeScript modules with isolated env and external-service mocks.
function loader(overrides = {}, globals = {}) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const loadedModule = { exports: {} };
    cache.set(file, loadedModule);
    const source = readFileSync(file, 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    }}).outputText;
    vm.runInNewContext(code, {
      exports: loadedModule.exports, module: loadedModule, process, Buffer, URL, Request, Response, Event, File, FormData, Headers, AbortSignal,
      queueMicrotask, crypto: webcrypto, ...globals,
      require: name => {
        if (name === 'server-only') return {};
        if (name in overrides) return overrides[name];
        if (name.startsWith('@/')) return load(join(root, 'src', `${name.slice(2)}.ts`));
        if (name.startsWith('.')) return load(resolve(dirname(file), `${name}.ts`));
        return require(name);
      },
    }, { filename: file });
    return loadedModule.exports;
  }
  return file => load(join(root, file));
}

function authFixture(env = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'petitionpro-session-test-'));
  let now = 1_800_000_000_000;
  const settings = { NODE_ENV: 'production', ADMIN_USER: 'admin', ADMIN_PASSWORD: 'private-password',
    ADMIN_SESSION_SECRET: 'private-test-secret-with-at-least-32-characters', ADMIN_SESSION_DIR: directory, ...env };
  const globals = { process: { env: settings, cwd: () => root }, Date: class extends Date { static now() { return now; } } };
  return { auth: loader({}, globals)('src/lib/admin-session.ts'), settings, globals,
    advance: ms => { now += ms; }, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

test('missing admin config fails closed and the old forged cookie is rejected', () => {
  const fixture = authFixture({ ADMIN_SESSION_SECRET: '' });
  try {
    const { auth } = fixture;
    assert.equal(auth.isAdminConfigured(), false);
    assert.equal(auth.credentialsMatch('admin', 'admin30'), false);
    const forged = createHmac('sha256', 'petitionpro-local-admin-session').update('petitionpro-admin:admin').digest('hex');
    assert.equal(auth.sessionValid(forged), false);
    assert.throws(() => auth.sessionValue(), /not configured/);
    fixture.settings.ADMIN_SESSION_SECRET = 'private-test-secret-with-at-least-32-characters';
    assert.equal(auth.sessionValid(forged), false);
  } finally { fixture.cleanup(); }
});

test('sessions are distinct, persist across module instances, expire, and revoke independently', () => {
  const fixture = authFixture();
  try {
    const { auth } = fixture;
    assert.equal(auth.credentialsMatch('admin', 'private-password'), true);
    assert.equal(auth.credentialsMatch('admin', 'wrong'), false);
    const first = auth.sessionValue(), second = auth.sessionValue();
    assert.notEqual(first, second);
    assert.equal(loader({}, fixture.globals)('src/lib/admin-session.ts').sessionValid(first), true);
    auth.revokeSession(first);
    assert.equal(auth.sessionValid(first), false);
    assert.equal(auth.sessionValid(second), true);
    fixture.advance(12 * 60 * 60 * 1000);
    assert.equal(auth.sessionValid(second), false);
  } finally { fixture.cleanup(); }
});

test('password and secret rotation invalidate previously issued sessions', () => {
  const fixture = authFixture();
  try {
    const value = fixture.auth.sessionValue();
    fixture.settings.ADMIN_PASSWORD = 'changed-password';
    assert.equal(fixture.auth.sessionValid(value), false);
    const next = fixture.auth.sessionValue();
    fixture.settings.ADMIN_SESSION_SECRET = 'another-private-secret-with-32-characters';
    assert.equal(fixture.auth.sessionValid(next), false);
  } finally { fixture.cleanup(); }
});

function storage(initial = {}) {
  const values = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    read: key => JSON.parse(values.get(key)) };
}

// A small hook harness exercises real event handlers and deferred effects without a DOM.
function componentHarness(overrides, globals) {
  const slots = [], effects = [];
  let cursor = 0, pending = [], renderComponent;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!effects[index] || deps.some((value, i) => value !== effects[index].deps[i])) {
        pending.push(() => { effects[index]?.cleanup?.(); effects[index] = { deps, cleanup: effect() }; });
      }
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo: fn => fn(),
  };
  const jsx = (type, props) => ({ type, props });
  const load = loader({ react: hooks, 'react/jsx-runtime': { jsx, jsxs: jsx }, ...overrides }, globals);
  let tree;
  return {
    load,
    render(component) {
      if (component) renderComponent = component;
      cursor = 0; tree = renderComponent();
      const callbacks = pending; pending = []; callbacks.forEach(fn => fn());
      return tree;
    },
    async flush() { await Promise.resolve(); return this.render(); },
    nodes(type) {
      const out = [];
      function visit(node) {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (node.type === type) out.push(node);
        visit(node.props?.children);
      }
      visit(tree); return out;
    },
  };
}

for (const track of ['eb2-niw', 'eb1a']) {
  test(`standalone ${track} projects restore text, classification, and results after refresh`, async () => {
    const endeavor = 'A specific saved project subject and proposed work';
    const localStorage = storage({ 'petitionpro-projects-v2': { endeavor, track, source: 'github',
      github: { endeavor, track, projects: [{ name: 'Saved repository' }], warnings: [] },
      suggested: { projects: [], warnings: [] } } });
    const harness = componentHarness({
      'next/navigation': { useSearchParams: () => new URLSearchParams() },
      '@/components/Brand': {},
    }, { localStorage });
    const { ProjectStudio } = harness.load('src/components/ProjectStudio.tsx');
    const session = ProjectStudio();
    harness.render(() => session.type(session.props));
    await harness.flush();
    assert.equal(harness.nodes('textarea')[0].props.value, endeavor);
    assert.equal(harness.nodes('article').length, 1);
    const saved = localStorage.read('petitionpro-projects-v2');
    assert.equal(saved.endeavor, endeavor);
    assert.equal(saved.track, track);
  });
}

test('overlapping readings preserve added notes and both responses; deleted notes stay deleted', async () => {
  const ideas = ['one', 'two'].map(id => ({ id, title: id, note: 'A research note for this case', source: '', createdAt: '2026-11-02', actions: [] }));
  const localStorage = storage({ 'petitionpro-ideas-v1': ideas });
  const calls = [];
  const harness = componentHarness({
    '@/components/Brand': {}, 'next/link': {},
    '@/lib/cases': { loadCases: () => [{ id: 'client', name: 'Client' }] },
    '@/lib/ideas': {
      loadIdeas: () => localStorage.read('petitionpro-ideas-v1'),
      saveIdeas: next => localStorage.setItem('petitionpro-ideas-v1', JSON.stringify(next)),
      caseBrief: () => 'case brief',
    },
  }, { localStorage, fetch: () => new Promise(resolve => calls.push(resolve)) });
  const { IdeaBank } = harness.load('src/components/IdeaBank.tsx');
  harness.render(IdeaBank); await harness.flush();
  harness.nodes('select').forEach(node => node.props.onChange({ target: { value: 'client' } }));
  harness.render();
  const buttons = harness.nodes('button').filter(node => node.props.children === 'Use on this case');
  const first = buttons[0].props.onClick(), second = buttons[1].props.onClick();
  const thirdIdea = { ...ideas[0], id: 'three' };
  localStorage.setItem('petitionpro-ideas-v1', JSON.stringify([...ideas, thirdIdea]));
  const response = { ok: true, json: async () => ({ insight: 'Insight', recommendation: 'Recommendation', suggestion: 'Suggestion' }) };
  calls[0](response); await first; await new Promise(resolve => setImmediate(resolve));
  calls[1](response); await second; await new Promise(resolve => setImmediate(resolve));
  let saved = localStorage.read('petitionpro-ideas-v1');
  assert.equal(saved.length, 3);
  assert.equal(saved[0].actions.length, 1);
  assert.equal(saved[1].actions.length, 1);
  harness.render();
  const third = harness.nodes('button').find(node => node.props.children === 'Use on this case').props.onClick();
  localStorage.setItem('petitionpro-ideas-v1', JSON.stringify(saved.filter(idea => idea.id !== 'one')));
  calls[2](response); await third; await new Promise(resolve => setImmediate(resolve));
  saved = localStorage.read('petitionpro-ideas-v1');
  assert.equal(saved.some(idea => idea.id === 'one'), false);
});

test('replacing a case CV clears checked quotes and draft readiness', () => {
  const cases = loader()('src/lib/cases.ts');
  const matter = cases.createCase({ name: 'Client', email: '', phone: '', matterRef: '' });
  matter.cvText = 'Old CV text'; matter.cvChecked = true; matter.readyForDraft = true;
  matter.quotesEb2[0].inCv = true; matter.quotesEb1a[0].inCv = true;
  const next = cases.replaceCaseCv(matter, 'replacement.pdf');
  assert.equal(next.cvText, '');
  assert.equal(next.cvChecked, false);
  assert.equal(cases.checkCvQuotes(next).cvChecked, false);
  assert.equal(cases.cvReady(cases.checkCvQuotes(next)), false);
  assert.equal(next.readyForDraft, false);
  assert.equal(next.quotesEb2.some(row => row.inCv), false);
  assert.equal(next.quotesEb1a.some(row => row.inCv), false);
});

test('NIW draft support flags are checked against CV text, not model assertions', async () => {
  const quotes = [
    { claim: 'Real fact', cvSpan: 'Published a paper on battery diagnostics', supported: false },
    { claim: 'Invented fact', cvSpan: 'Won the imaginary award', supported: true },
    { claim: 'Missing quote', cvSpan: '', supported: true },
  ];
  const load = loader({ '@/lib/groq': { isGroqConfigured: () => true, groqModel: () => 'test',
    groqJson: async () => ({ chosenSentence: 'A proposed endeavor', wellPositioning: { paragraphs: [], claimedFacts: quotes }, nationalImportance: { paragraphs: [], claimedFacts: quotes }, gaps: [] }) } });
  const { POST } = load('src/app/api/skeletons/route.ts');
  const response = await POST(new Request('http://localhost/api/skeletons', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ choice: 'keep', sentence: 'A proposed endeavor', record: {}, cvText: 'Published a paper on battery diagnostics.' }) }));
  assert.equal(response.status, 200);
  const result = await response.json();
  for (const draft of [result.wellPositioning, result.nationalImportance]) {
    assert.deepEqual(draft.claimedFacts.map(fact => fact.supported), [true, false, false]);
  }
});

test('login creates a usable session and logout revokes the copied cookie', async () => {
  const fixture = authFixture();
  try {
    const load = loader({ '@/lib/admin-session': fixture.auth });
    const login = load('src/app/api/admin/login/route.ts').POST;
    const response = await login(new Request('http://localhost/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'private-password' }),
    }));
    assert.equal(response.status, 200);
    const value = response.headers.get('set-cookie').match(/petitionpro-admin=([^;]+)/)[1];
    assert.equal(fixture.auth.sessionValid(value), true);
    const logout = load('src/app/api/admin/logout/route.ts').POST;
    const result = await logout({ cookies: { get: () => ({ value }) } });
    assert.equal(result.status, 200);
    assert.equal(fixture.auth.sessionValid(value), false);
  } finally { fixture.cleanup(); }
});

test('login returns a configuration error rather than accepting defaults', async () => {
  const fixture = authFixture({ ADMIN_PASSWORD: '' });
  try {
    const load = loader({ '@/lib/admin-session': fixture.auth });
    const response = await load('src/app/api/admin/login/route.ts').POST(new Request('http://localhost/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin30' }),
    }));
    assert.equal(response.status, 503);
    assert.equal(response.headers.has('set-cookie'), false);
  } finally { fixture.cleanup(); }
});

test('cost intake preserves unknown amounts and calculates exact cents', () => {
  const costs = loader()('src/lib/costs.ts');
  assert.equal(costs.moneyCents(''), null);
  assert.equal(costs.moneyCents('0'), 0);
  assert.equal(costs.moneyCents('0.29'), 29);
  assert.equal(costs.moneyCents('1200.05'), 120005);
  for (const amount of ['-1', '1.001', 'NaN', '1e3', '10,000', '1000000000']) {
    assert.throws(() => costs.moneyCents(amount));
  }
  const input = { estimated: '1200', actual: '', paid: '', responsible: 'Case manager', payee: '', reference: '', paymentDate: '', notes: '' };
  assert.equal(costs.createCost(input).actualCents, null);
  assert.throws(() => costs.createCost({ ...input, responsible: '' }), /responsible/);
  assert.throws(() => costs.createCost({ ...input, paid: '100' }), /paid/);
  assert.throws(() => costs.createCost({ ...input, paid: '100', payee: 'Vendor', paymentDate: '2026-02-30' }), /date/);
  assert.equal(costs.createCost({ ...input, paid: '100', payee: 'Vendor', paymentDate: '2026-11-02' }).paidCents, 10000);
});

test('case totals preserve balances per milestone and include advances and waived costs', () => {
  const costs = loader()('src/lib/costs.ts');
  const entry = (estimated, actual, paid) => costs.createCost({
    estimated, actual, paid, responsible: 'Manager', payee: 'Vendor',
    reference: 'Invoice', paymentDate: '2026-11-02', notes: '',
  });
  const totals = costs.costTotals([
    { cost: entry('200', '200', '300') },
    { cost: entry('100', '100', '0') },
    { cost: entry('50', '', '25') },
    { cost: entry('30', '30', '30'), waivedReason: 'Left out' },
    {},
  ]);
  assert.equal(totals.estimated, 38000);
  assert.equal(totals.actual, 33000);
  assert.equal(totals.paid, 35500);
  assert.equal(totals.outstanding, 10000);
  assert.equal(totals.advance, 12500);
  assert.equal(totals.actualUnknown, 1);
  assert.equal(totals.recorded, 4);
});

test('case costs survive storage and period closure snapshots totals without changing evidence', () => {
  const localStorage = storage();
  const load = loader({}, { window: {}, localStorage });
  const cases = load('src/lib/cases.ts');
  const costs = load('src/lib/costs.ts');
  const matter = cases.createCase({ name: 'Client', email: '', phone: '', matterRef: '' });
  matter.milestones[0].cost = costs.createCost({ estimated: '1000', actual: '900', paid: '400', responsible: 'Manager', payee: 'Vendor', reference: 'INV-1', paymentDate: '2026-11-02', notes: 'Approved' });
  assert.equal(cases.milestoneState(matter.milestones[0]), 'missing');
  cases.upsertCase(matter);
  const restored = cases.loadCases()[0];
  assert.equal(restored.milestones[0].cost.reference, 'INV-1');
  const closed = cases.closePeriod(restored, 'Costs reviewed', '2026-12-01');
  assert.equal(closed.periods[0].summary.includes('$500.00 outstanding'), true);
  assert.equal(closed.periods[0].summary.includes('$400.00 paid'), true);
  // A historical snapshot remains unchanged when a later period updates costs.
  const reopened = cases.startPeriod(closed);
  reopened.milestones[0].cost.paidCents = 90000;
  assert.equal(reopened.periods[0].summary.includes('$500.00 outstanding'), true);
  assert.equal(costs.costTotals(reopened.milestones).outstanding, 0);
  // Legacy cases do not need a migration to open.
  delete matter.milestones[0].cost;
  cases.upsertCase(matter);
  assert.equal(costs.costTotals(cases.loadCases()[0].milestones).recorded, 0);
});

test('milestone cost form saves validated intake and closed periods block edits', () => {
  const saved = [];
  const harness = componentHarness({}, {});
  const { MilestoneCostIntake } = harness.load('src/components/MilestoneCostIntake.tsx');
  harness.render(() => MilestoneCostIntake({ editable: true, onSave: cost => saved.push(cost) }));
  const values = ['100.29', '90.29', '20.29', 'Manager', 'Vendor', '2026-11-02', 'INV-123'];
  harness.nodes('input').forEach((node, index) => node.props.onChange({ target: { value: values[index] } }));
  harness.render();
  harness.nodes('form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].estimatedCents, 10029);
  assert.equal(saved[0].actualCents, 9029);
  assert.equal(saved[0].paidCents, 2029);
  assert.equal(saved[0].reference, 'INV-123');
  harness.render(() => MilestoneCostIntake({ editable: false, cost: saved[0], onSave: cost => saved.push(cost) }));
  assert.equal(harness.nodes('fieldset')[0].props.disabled, true);
  harness.nodes('form')[0].props.onSubmit({ preventDefault() {} });
  assert.equal(saved.length, 1);
});

test('required progress counts only active required milestones and separates partial evidence', () => {
  const load = loader();
  const cases = load('src/lib/cases.ts');
  const visuals = load('src/lib/case-visuals.ts');
  const matter = cases.createCase({ name: 'Client', email: '', phone: '', matterRef: '' });
  assert.equal(visuals.requiredProgress(matter).total, 0);
  matter.pathway = 'eb2-niw';
  const required = cases.applicableMilestones(matter).filter(item => !item.optional);
  required[0].bullets.forEach(item => { item.done = true; });
  required[1].bullets[0].done = true;
  matter.milestones.find(item => item.optional).bullets.forEach(item => { item.done = true; });
  const progress = visuals.requiredProgress(matter);
  assert.equal(progress.complete, 1);
  assert.equal(progress.partial, 1);
  assert.equal(progress.missing, required.length - 2);
  assert.equal(progress.percent, Math.round(100 / required.length));
});

test('timeline bar widths reflect calendar days and include future reviews', () => {
  const { periodTimeline } = loader()('src/lib/case-visuals.ts');
  const timeline = periodTimeline([
    { id: 'one', number: 1, openedAt: '2026-01-01T12:00:00Z', closedAt: '2026-01-03T12:00:00Z', nextReview: '2026-01-10' },
    { id: 'two', number: 2, openedAt: '2026-01-04T12:00:00Z', closedAt: null, nextReview: '' },
  ], '2026-01-05');
  assert.equal(timeline.start, '2026-01-01');
  assert.equal(timeline.end, '2026-01-10');
  assert.equal(timeline.rows[0].days, 3);
  assert.equal(timeline.rows[0].width, 30);
  assert.equal(timeline.rows[0].reviewPosition, 95);
  assert.equal(timeline.rows[1].days, 2);
  assert.equal(timeline.rows[1].width, 20);
  assert.equal(timeline.rows[1].left, 30);
  assert.equal(timeline.todayPosition, 45);
  assert.equal(periodTimeline([], '2026-01-05'), null);
  assert.equal(periodTimeline([{ id: 'x', openedAt: 'bad' }], '2026-01-05'), null);
});

test('Kanban groups cases exactly once, handles due-today dates, and filters case search', () => {
  const load = loader();
  const cases = load('src/lib/cases.ts');
  const { caseDashboard } = load('src/lib/case-visuals.ts');
  const one = cases.createCase({ name: 'Alice', matterRef: 'REF-1', email: '', phone: '' });
  const two = cases.createCase({ name: 'Bob', matterRef: 'REF-2', email: 'bob@example.org', phone: '' });
  const three = cases.createCase({ name: 'Carol', matterRef: '', email: '', phone: '' });
  one.stage = 'cv'; one.periods[0].closedAt = '2026-01-01'; one.periods[0].nextReview = '2026-01-05';
  two.stage = 'positioning'; two.readyForDraft = true;
  three.stage = 'cv';
  const dashboard = caseDashboard([three, two, one], '', 'all', '2026-01-05');
  assert.equal(dashboard.total, 3);
  assert.equal(dashboard.due, 1);
  assert.equal(dashboard.active, 2);
  assert.equal(dashboard.ready, 1);
  assert.equal(dashboard.columns.find(column => column.id === 'cv').cases[0].id, one.id);
  assert.equal(dashboard.columns.flatMap(column => column.cases).length, 3);
  assert.equal(caseDashboard([one, two, three], 'REF-2', 'all', '2026-01-05').visible, 1);
  assert.equal(caseDashboard([one, two, three], 'EXAMPLE.ORG', 'all', '2026-01-05').visible, 1);
  assert.equal(caseDashboard([one, two, three], '', 'due', '2026-01-05').visible, 1);
  assert.equal(caseDashboard([one, two, three], '', 'ready', '2026-01-05').visible, 1);
  assert.equal(caseDashboard([one, two, three], 'unknown', 'all', '2026-01-05').visible, 0);
});

test('older stage labels and unknown stages cannot leave a counted client off the board', () => {
  const localStorage = storage();
  const load = loader({}, { window: {}, localStorage });
  const cases = load('src/lib/cases.ts');
  const { caseDashboard } = load('src/lib/case-visuals.ts');
  const labels = ['well-positioning', 'Well positioning', 'CV profile', 'profile-evaluation', 'retired-stage', undefined];
  const matters = labels.map((stage, index) => ({ ...cases.createCase({ name: `Client ${index}`, email: '', phone: '', matterRef: '' }), stage }));
  const dashboard = caseDashboard(matters);
  assert.equal(dashboard.total, labels.length);
  assert.equal(dashboard.columns.flatMap(column => column.cases).length, labels.length);
  assert.equal(dashboard.columns.find(column => column.id === 'positioning').cases.length, 2);
  cases.saveCases(matters);
  const restored = cases.loadCases();
  assert.deepEqual(Array.from(restored, matter => matter.stage), ['positioning', 'positioning', 'cv', 'profile', 'profile', 'profile']);
  assert.equal(restored[0].id, matters[0].id);
});

test('the mounted workflow board refreshes after case saves, tab changes, and navigation restores', async () => {
  const localStorage = storage();
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = 'visible';
  const harness = componentHarness({
    'next/navigation': { useRouter: () => ({ push() {} }) },
    '@/components/Brand': {}, '@/components/RequiredProgress': {}, '@/components/InquiryNotice': {},
  }, { window, document, localStorage, setInterval: () => 0, clearInterval() {} });
  const cases = harness.load('src/lib/cases.ts');
  const { CaseBoard } = harness.load('src/components/CaseBoard.tsx');
  harness.render(CaseBoard); await harness.flush();
  assert.equal(harness.nodes('a').length, 0);
  const board = { scrollLeft: 0, getBoundingClientRect: () => ({ left: 0 }),
    querySelector: selector => ({ getBoundingClientRect: () => ({ left: (selector.includes('positioning') ? 1000 : 0) - board.scrollLeft }) }) };
  harness.nodes('div').find(node => node.props.className === 'kanban-scroll').props.ref.current = board;
  const matter = cases.createCase({ name: 'Current client', email: '', phone: '', matterRef: '' });
  matter.stage = 'positioning';
  cases.upsertCase(matter);
  harness.render();
  assert.equal(harness.nodes('a')[0].props.href, `/cases/${matter.id}`);
  assert.equal(board.scrollLeft, 1000, 'the occupied stage is brought into view');
  harness.nodes('button').find(node => Array.isArray(node.props.children) && node.props.children[0] === 'Profile').props.onClick();
  assert.equal(board.scrollLeft, 0, 'stage navigation can return to earlier columns');
  for (const eventName of ['storage', 'focus', 'pageshow', 'visibilitychange']) {
    const renamed = { ...matter, name: `Updated on ${eventName}` };
    localStorage.setItem(cases.CASES_STORAGE, JSON.stringify([renamed]));
    const event = new Event(eventName);
    if (eventName === 'storage') event.key = cases.CASES_STORAGE;
    (eventName === 'visibilitychange' ? document : window).dispatchEvent(event);
    harness.render();
    assert.equal(harness.nodes('h4')[0].props.children, renamed.name);
  }
  cases.removeCase(matter.id);
  harness.render();
  assert.equal(harness.nodes('a').length, 0);
});

function inquiryFixture(extraEnv = {}, fetch) {
  const directory = mkdtempSync(join(tmpdir(), 'petitionpro-inquiry-test-'));
  const env = { INQUIRY_STORAGE_DIR: join(directory, 'inquiries'), PUBLIC_LIMIT_DIR: join(directory, 'limits'), ...extraEnv };
  const load = loader({}, { process: { env, cwd: () => root }, ...(fetch ? { fetch } : {}) });
  return { load, env, cleanup: () => rmSync(directory, { recursive: true, force: true }) };
}

function inquiryInput(id = webcrypto.randomUUID()) {
  return { id, name: 'Prospective Client', email: 'client@example.org', phone: '555-0100', message: 'Please review my evidence.',
    endeavor: 'Develop battery diagnostic methods for utility-scale storage reliability in the United States.',
    mechanism: 'Battery diagnostics', beneficiaries: 'U.S. utilities', nationalImportance: 'Improve storage reliability',
    cvText: 'Published research on battery diagnostics and led a research project evaluating storage performance and reliability.',
    cvFileName: 'original-cv.pdf', cvType: 'application/pdf', report: '# Assessment\n\nProposed endeavor and well positioning.\n\nThis is a generated working draft with evidence gaps for review.' };
}

function submissionRequest(input, consent = true, file = new File(['%PDF-test-CV'], 'original-cv.pdf', { type: 'application/pdf' })) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (!['id', 'cvFileName', 'cvType'].includes(key)) form.set(key, value);
  }
  form.set('submissionId', input.id);
  if (consent) form.set('consent', 'yes');
  if (file) form.set('cv', file);
  return new Request('http://localhost/api/inquiries', { method: 'POST', body: form });
}

test('public consultant submission saves the original CV and result without exposing them in the response', async () => {
  const fixture = inquiryFixture();
  try {
    const input = inquiryInput();
    const submit = fixture.load('src/app/api/inquiries/route.ts').POST;
    const response = await submit(submissionRequest(input));
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.id, input.id);
    assert.equal('email' in body, false);
    assert.equal('cvText' in body, false);
    const store = fixture.load('src/lib/inquiries-local.ts');
    const inquiry = store.readInquiry(input.id);
    assert.equal(inquiry.endeavor, input.endeavor);
    assert.equal(inquiry.report, input.report);
    assert.equal(inquiry.emailStatus, 'not-configured');
    assert.equal(store.inquiryCv(input.id).toString(), '%PDF-test-CV');
    assert.ok(inquiry.consentAt);
    const retry = await submit(submissionRequest(input));
    assert.equal(retry.status, 201);
    assert.equal(store.listInquiries().length, 1);
    const changed = await submit(submissionRequest({ ...input, name: 'Different person' }));
    assert.equal(changed.status, 409);
  } finally { fixture.cleanup(); }
});

test('consultant submission requires consent, a completed assessment, and the original file when reattachment is needed', async () => {
  const fixture = inquiryFixture();
  try {
    const input = inquiryInput();
    const submit = fixture.load('src/app/api/inquiries/route.ts').POST;
    assert.equal((await submit(submissionRequest(input, false))).status, 400);
    assert.equal((await submit(submissionRequest({ ...input, report: '' }))).status, 400);
    assert.equal((await submit(submissionRequest(input, true, new File(['html'], 'cv.html')))).status, 400);
    const missingFile = submissionRequest(input, true, null);
    const form = await missingFile.formData(); form.set('originalFileRequired', 'yes');
    assert.equal((await submit(new Request('http://localhost/api/inquiries', { method: 'POST', body: form }))).status, 400);
    assert.equal(fixture.load('src/lib/inquiries-local.ts').listInquiries().length, 0);
    assert.throws(() => fixture.load('src/lib/inquiries-local.ts').readInquiry('../secret'), /not found/);
  } finally { fixture.cleanup(); }
});

test('email notification includes the endeavor, original CV and assessment and records provider acceptance', async () => {
  const requests = [];
  const fixture = inquiryFixture({ RESEND_API_KEY: 'test-key', INQUIRY_EMAIL_FROM: 'team@example.org', INQUIRY_EMAIL_TO: 'admin@example.org', APP_URL: 'https://petition.example' }, async (url, options) => {
    requests.push({ url, options }); return Response.json({ id: 'mail-123' });
  });
  try {
    const store = fixture.load('src/lib/inquiries-local.ts');
    const input = inquiryInput(); store.createInquiry(input, Buffer.from('original attachment'));
    const notify = fixture.load('src/lib/inquiry-mail.ts').notifyInquiry;
    const result = await notify(input.id);
    assert.equal(result.emailStatus, 'accepted');
    const payload = JSON.parse(requests[0].options.body);
    assert.equal(payload.to[0], 'admin@example.org');
    assert.equal(payload.reply_to, input.email);
    assert.equal(payload.text.includes(input.endeavor), true);
    assert.equal(payload.text.includes(`https://petition.example/inquiries#${input.id}`), true);
    assert.equal(Buffer.from(payload.attachments[0].content, 'base64').toString(), 'original attachment');
    assert.equal(Buffer.from(payload.attachments[1].content, 'base64').toString(), input.report);
    assert.equal(requests[0].options.headers['Idempotency-Key'], `inquiry-${input.id}`);
    await notify(input.id);
    assert.equal(requests.length, 1, 'accepted notifications are not sent again');
  } finally { fixture.cleanup(); }
});

test('mail failure preserves the inquiry and a later retry can succeed', async () => {
  let fail = true;
  const fixture = inquiryFixture({ RESEND_API_KEY: 'test-key', INQUIRY_EMAIL_FROM: 'team@example.org', INQUIRY_EMAIL_TO: 'admin@example.org' }, async () => fail ? new Response('Unavailable', { status: 503 }) : Response.json({ id: 'retried' }));
  try {
    const input = inquiryInput();
    const submit = fixture.load('src/app/api/inquiries/route.ts').POST;
    assert.equal((await submit(submissionRequest(input))).status, 201);
    const store = fixture.load('src/lib/inquiries-local.ts');
    assert.equal(store.readInquiry(input.id).emailStatus, 'failed');
    store.updateInquiry(input.id, { status: 'reviewed' });
    fail = false;
    const next = await fixture.load('src/lib/inquiry-mail.ts').notifyInquiry(input.id);
    assert.equal(next.emailStatus, 'accepted');
    assert.equal(next.status, 'reviewed');
  } finally { fixture.cleanup(); }
});

test('admin inquiry APIs and original CV downloads require a valid session', async () => {
  const fixture = authFixture();
  const directory = mkdtempSync(join(tmpdir(), 'petitionpro-inquiry-access-'));
  try {
    fixture.settings.INQUIRY_STORAGE_DIR = directory;
    const load = loader({ '@/lib/admin-session': fixture.auth, './admin-session': fixture.auth }, fixture.globals);
    const list = load('src/app/api/admin/inquiries/route.ts').GET;
    const cv = load('src/app/api/admin/inquiries/[id]/cv/route.ts').GET;
    assert.equal((await list(new Request('http://localhost/api/admin/inquiries'))).status, 401);
    assert.equal((await cv(new Request('http://localhost/api/admin/inquiries/x/cv'), { params: Promise.resolve({ id: 'x' }) })).status, 401);
    const store = load('src/lib/inquiries-local.ts');
    const input = inquiryInput(); store.createInquiry(input, Buffer.from('private CV'));
    const headers = { cookie: `petitionpro-admin=${fixture.auth.sessionValue()}` };
    const response = await cv(new Request('http://localhost/api/admin/inquiries/x/cv', { headers }), { params: Promise.resolve({ id: input.id }) });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'private CV');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('content-disposition').includes('attachment'), true);
    assert.equal((await list(new Request('http://localhost/api/admin/inquiries', { headers }))).status, 200);
  } finally { fixture.cleanup(); rmSync(directory, { recursive: true, force: true }); }
});

test('inquiry conversion prefills the case and never overwrites existing case work', () => {
  const load = loader();
  const { caseFromInquiry } = load('src/lib/inquiry-case.ts');
  const inquiry = { ...inquiryInput(), createdAt: '2026-11-02', consentAt: '2026-11-02', status: 'new', emailStatus: 'pending', emailId: '' };
  const matter = caseFromInquiry(inquiry, []);
  assert.equal(matter.id, inquiry.id);
  assert.equal(matter.endeavorSentence, inquiry.endeavor);
  assert.equal(matter.cvText, inquiry.cvText);
  assert.equal(matter.assessmentReport, inquiry.report);
  matter.stage = 'positioning'; matter.baseline[0].rating = 'strong';
  assert.equal(caseFromInquiry(inquiry, [matter]), matter);
  assert.equal(caseFromInquiry(inquiry, [matter]).stage, 'positioning');
});

test('streamed multipart and JSON bodies are size limited without trusting request headers', async () => {
  const { limitedFormData, limitedJson } = loader()('src/lib/request-body.ts');
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(200)); controller.close(); } });
  await assert.rejects(() => limitedFormData(new Request('http://localhost', { method: 'POST', body, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=test' } }), 20), error => error.status === 413);
  await assert.rejects(() => limitedJson(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(200) }) }), 20), error => error.status === 413);
});

test('anonymous free routes work while admin pages and data stay private', () => {
  const load = loader({ '@/lib/admin-session': { ADMIN_COOKIE: 'petitionpro-admin', sessionValid: () => false, safeNext: value => value }, '@/lib/public-limit': { publicLimit: () => null } });
  const { proxy } = load('src/proxy.ts');
  const request = (path, method = 'GET') => ({ nextUrl: new URL(`http://localhost${path}`), url: `http://localhost${path}`, method, cookies: { get: () => undefined } });
  assert.equal(proxy(request('/')).status, 200);
  assert.equal(proxy(request('/diy')).status, 200);
  for (const path of ['/api/endeavor', '/api/parse-cv', '/api/fit', '/api/skeletons', '/api/inquiries']) assert.equal(proxy(request(path, 'POST')).status, 200);
  assert.equal(proxy(request('/api/admin/inquiries')).status, 401);
  assert.equal(proxy(request('/api/admin/inquiries/x/cv')).status, 401);
  assert.equal(proxy(request('/api/inquiries')).status, 401);
  assert.equal(proxy(request('/studio')).status, 307);
  assert.equal(proxy(request('/cases')).status, 307);
});

test('free request admission limits persist between module instances', () => {
  const fixture = inquiryFixture();
  try {
    const request = new Request('http://localhost/api/inquiries', { method: 'POST', headers: { 'x-forwarded-for': '192.0.2.1' } });
    const limit = fixture.load('src/lib/public-limit.ts').publicLimit;
    for (let i = 0; i < 5; i++) assert.equal(limit(request, 'inquiry'), null);
    const nextLoad = loader({}, { process: { env: fixture.env, cwd: () => root } });
    assert.equal(nextLoad('src/lib/public-limit.ts').publicLimit(request, 'inquiry').status, 429);
  } finally { fixture.cleanup(); }
});

test('public assessment restores only its own data and presents consultant and DIY handoff after the result', async () => {
  const draft = { chosenSentence: 'Develop battery diagnostics for utility storage reliability across the United States.',
    wellPositioning: { paragraphs: ['A CV-based well-positioning draft.'], claimedFacts: [] },
    nationalImportance: { paragraphs: ['Prospective impact of the endeavor.'], claimedFacts: [] }, gaps: [] };
  const load = loader();
  const types = load('src/lib/types.ts');
  const snapshot = { step: 'skeletons', track: 'eb2-niw', intake: types.emptyIntake(),
    options: [{ id: 'core', label: 'Core', sentence: draft.chosenSentence, description: 'Scope', nationalImportanceFrame: 'Impact' }],
    selectedId: 'core', record: types.emptyRecord(), cvText: 'Public CV text', skeletons: draft, originalFileName: 'public-cv.pdf' };
  const localStorage = storage({ 'petitionpro-free-v1': snapshot, 'petitionpro-v1': { ...snapshot, cvText: 'PRIVATE ADMIN CV' } });
  const NextSteps = () => null;
  const harness = componentHarness({ '@/components/Brand': {}, '@/components/PublicBrand': {},
    '@/components/AssessmentNextSteps': { AssessmentNextSteps: NextSteps }, 'next/link': {} }, { localStorage });
  const { Studio } = harness.load('src/components/Studio.tsx');
  harness.render(() => Studio({ publicMode: true })); await harness.flush();
  const next = harness.nodes(NextSteps)[0];
  assert.equal(next.props.endeavor, draft.chosenSentence);
  assert.equal(next.props.cvText, 'Public CV text');
  assert.equal(next.props.originalFileName, 'public-cv.pdf');
  assert.equal(localStorage.read('petitionpro-v1').cvText, 'PRIVATE ADMIN CV');
  assert.equal(next.props.report.includes('Well positioning') || next.props.report.includes('well positioning'), true);
});

function supabaseFixture(options = {}) {
  const rows = new Map(), objects = new Map(), calls = [];
  let failInsert = options.failInsert ?? false;
  const env = { SUPABASE_URL: 'https://cvlrhumxbyakxqzhenuw.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test_server_key' };
  const fetch = async (address, init = {}) => {
    const url = new URL(address);
    const method = init.method || 'GET';
    const headers = new Headers(init.headers);
    calls.push({ url, method, headers, body: init.body });
    assert.equal(headers.get('apikey'), env.SUPABASE_SECRET_KEY);
    assert.equal(headers.has('Authorization'), false, 'new secret keys use apikey, not Bearer');
    if (url.pathname.startsWith('/storage/v1/object/authenticated/')) {
      const key = url.pathname.split('/').slice(6).map(decodeURIComponent).join('/');
      return objects.has(key) ? new Response(objects.get(key)) : Response.json({ error: 'NotFound' }, { status: 404 });
    }
    if (url.pathname === '/storage/v1/object/petitionpro-cvs' && method === 'DELETE') {
      for (const key of JSON.parse(init.body).prefixes) objects.delete(key);
      return Response.json({});
    }
    if (url.pathname.startsWith('/storage/v1/object/petitionpro-cvs/')) {
      const key = url.pathname.split('/').slice(5).map(decodeURIComponent).join('/');
      if (objects.has(key)) return Response.json({ error: 'Duplicate' }, { status: 409 });
      objects.set(key, Buffer.from(init.body));
      return Response.json({ Key: key });
    }
    if (url.pathname.endsWith('/rpc/petitionpro_patch_inquiry')) {
      const { p_id, p_patch } = JSON.parse(init.body);
      const row = rows.get(p_id);
      if (!row) return Response.json([]);
      row.payload = { ...row.payload, ...p_patch };
      return Response.json([row]);
    }
    if (url.pathname === '/rest/v1/petitionpro_inquiries') {
      if (method === 'GET') {
        const id = url.searchParams.get('id')?.slice(3);
        if (id) return Response.json(rows.has(id) ? [rows.get(id)] : []);
        const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 100);
        return Response.json([...rows.values()].slice(offset, offset + limit));
      }
      if (method === 'POST') {
        if (failInsert) return Response.json({ code: 'Unavailable' }, { status: 503 });
        const row = JSON.parse(init.body);
        if (rows.has(row.id)) return Response.json({ code: '23505' }, { status: 409 });
        rows.set(row.id, row);
        if (options.ambiguousCommit) throw new Error('Connection lost after commit');
        return Response.json([row]);
      }
    }
    throw new Error(`Unexpected Supabase request ${method} ${url.pathname}`);
  };
  const load = loader({}, { process: { env, cwd: () => root }, fetch });
  return { load, env, rows, objects, calls, allowInsert: () => { failInsert = false; } };
}

test('Supabase configuration rejects publishable keys and never falls back after partial configuration', async () => {
  const fixture = supabaseFixture();
  const supabase = fixture.load('src/lib/supabase.ts');
  fixture.env.SUPABASE_SECRET_KEY = 'sb_publishable_not_a_server_key';
  assert.throws(() => supabase.supabaseConfig(), /server secret/);
  fixture.env.SUPABASE_SECRET_KEY = '';
  assert.equal(supabase.supabaseRequested(), true);
  await assert.rejects(() => fixture.load('src/lib/inquiries.ts').listInquiries(), /SUPABASE_SECRET_KEY/);
});

test('Supabase saves private CVs, supports idempotent retries, and updates statuses without replacing the assessment', async () => {
  const fixture = supabaseFixture();
  const store = fixture.load('src/lib/inquiries.ts');
  const input = inquiryInput();
  const first = await store.createInquiry(input, Buffer.from('Supabase private CV'));
  assert.equal(first.endeavor, input.endeavor);
  assert.equal(fixture.rows.size, 1);
  assert.equal(fixture.objects.size, 1);
  assert.equal((await store.inquiryCv(input.id)).toString(), 'Supabase private CV');
  const again = await store.createInquiry(input, Buffer.from('Supabase private CV'));
  assert.equal(again.createdAt, first.createdAt);
  assert.equal(fixture.objects.size, 1);
  await store.updateInquiry(input.id, { status: 'reviewed' });
  await store.updateInquiry(input.id, { emailStatus: 'accepted', emailId: 'cloud-mail' });
  const current = await store.readInquiry(input.id);
  assert.equal(current.status, 'reviewed');
  assert.equal(current.emailStatus, 'accepted');
  assert.equal(current.report, input.report);
  assert.equal('fingerprint' in (await store.listInquiries())[0], false);
  await assert.rejects(() => store.createInquiry({ ...input, email: 'someone-else@example.org' }, Buffer.from('different CV')), error => error.status === 409);
  assert.equal(fixture.objects.size, 1, 'a conflicting retry never overwrites the original CV');
  assert.equal(fixture.calls.some(call => call.url.pathname.includes('/object/public/')), false);
});

test('a failed cloud insert retains a private upload and can complete on retry', async () => {
  const fixture = supabaseFixture({ failInsert: true });
  const store = fixture.load('src/lib/inquiries.ts');
  const input = inquiryInput();
  await assert.rejects(() => store.createInquiry(input, Buffer.from('recoverable CV')));
  assert.equal(fixture.rows.size, 0);
  assert.equal(fixture.objects.size, 1);
  fixture.allowInsert();
  await store.createInquiry(input, Buffer.from('recoverable CV'));
  assert.equal(fixture.rows.size, 1);
  assert.equal(fixture.objects.size, 1);
});

test('cloud insertion recognizes a committed record after a connection loss', async () => {
  const fixture = supabaseFixture({ ambiguousCommit: true });
  const input = inquiryInput();
  const saved = await fixture.load('src/lib/inquiries.ts').createInquiry(input, Buffer.from('committed CV'));
  assert.equal(saved.id, input.id);
  assert.equal(fixture.rows.size, 1);
});

test('cloud inquiry listing paginates instead of losing older clients', async () => {
  const fixture = supabaseFixture();
  for (let i = 0; i < 105; i++) {
    const input = inquiryInput();
    fixture.rows.set(input.id, { id: input.id, payload: { ...input, fingerprint: 'a'.repeat(64) } });
  }
  assert.equal((await fixture.load('src/lib/inquiries.ts').listInquiries()).length, 105);
  assert.equal(fixture.calls.filter(call => call.url.searchParams.has('offset')).length, 2);
});
