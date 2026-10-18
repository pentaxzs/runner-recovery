# 러닝 회복 트래커 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대회 카운트다운 앱을 상태 기반 ITBS 회복 앱으로 재작성하고, 홈 화면에 설치되는 오프라인 PWA로 배포한다.

**Architecture:** 순수 로직(`logic.js`)과 데이터(`data.js`)를 DOM에서 분리해 Node 내장 테스트 러너로 검증하고, `app.js`가 렌더링과 이벤트만 담당한다. ES 모듈을 쓰되 번들러·트랜스파일러는 없다 — 브라우저가 `<script type="module">`로 직접 읽고, Node도 같은 파일을 그대로 import한다. 서비스워커가 app shell 전체를 cache-first로 잡아 오프라인에서 완전히 동작한다.

**Tech Stack:** 바닐라 ES 모듈, 손으로 쓴 CSS, `node --test` (의존성 0), `sips`(아이콘), Vercel

**Spec:** `docs/superpowers/specs/2026-10-18-runner-recovery-rebuild-design.md`

## Global Constraints

- **빌드 도구 금지.** 번들러·트랜스파일러·PostCSS 없음. 브라우저가 소스를 그대로 읽는다
- **런타임 의존성 0.** CDN 스크립트 금지 (Tailwind CDN 제거가 재설계 사유 중 하나다)
- **날짜는 전부 로컬 시간 기준 `YYYY-MM-DD`.** `toISOString()` 사용 금지
- **localStorage 키 prefix `rr_v3_`.** `runner_tracker_*_v2`는 읽지도 쓰지도 않는다
- **체크 기록은 운동 `id` 기반.** DOM 인덱스 금지
- **모바일 우선.** 기준 폭 390px, 좌우 여백 16px, 가로 스크롤 없음, 터치 타깃 최소 44px
- **다크모드 필수** — `prefers-color-scheme: dark`
- **사용자 입력은 절대 `innerHTML`로 넣지 않는다.** `textContent` 또는 이스케이프
- 모든 커밋 메시지 끝에: `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Review Focus

스펙이 전제하지만 어느 태스크도 자연히 다루지 않는 입력들. 각 줄의 테스트를 해당 태스크에 넣었다.

1. **localStorage 접근이 throw** (사파리 프라이빗 모드, 저장 공간 초과) — 앱이 죽지 않고 메모리 폴백으로 동작해야 한다 → Task 2
2. **`?steps=` 에 비정상 값** (음수, 문자열, 1e9, 잘못된 date 형식, 미래 날짜) — 저장하지 않고 조용히 무시 → Task 6
3. **메모·사용자 입력에 HTML** (`<img onerror=...>`, `&`, `<`) — 렌더가 깨지거나 실행되지 않아야 한다 → Task 9
4. **세션이 0개일 때** 그래프·주간 리포트·사다리 판정 — 0으로 나누거나 빈 배열 `max()`로 터지지 않아야 한다 → Task 7, Task 10
5. **앱을 켜둔 채 자정을 넘김** — 날짜 키가 갱신되어야 하고, 입력 중이던 내용은 보존되어야 한다 (기존 앱은 `location.reload()`로 날렸다) → Task 9

---

## File Structure

```
index.html              마크업 셸 + 모듈 로드
styles.css              손으로 쓴 CSS (토큰, 다크모드, 컴포넌트)
data.js                 운동 정의 / 자투리 미션 풀 / 사다리  (순수 데이터, import 없음)
logic.js                순수 함수 — 날짜, streak, 사다리, 미션 선택, 통계  (DOM 참조 없음)
store.js                localStorage 래퍼 (백엔드 주입 가능, 실패 시 메모리 폴백)
app.js                  DOM 렌더링 + 이벤트 바인딩
sw.js                   서비스워커 (cache-first app shell)
manifest.webmanifest
icons/icon-180.png      apple-touch-icon
icons/icon-192.png
icons/icon-512.png
icons/icon.svg          아이콘 원본
package.json            {"type":"module","private":true} — Node ESM 플래그 전용
tests/*.test.js         node --test
```

삭제: `index_old01.html`, `index_old02.html` (Task 13)

---

### Task 1: 스캐폴딩 + 날짜 유틸리티

**Files:**
- Create: `package.json`, `logic.js`, `tests/dates.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `todayStr(now?)`, `toDateStr(date)`, `parseLocalDate(s)`, `addDays(date, n)`, `mondayOf(date)`, `isValidDateStr(s)` — 전부 `logic.js`에서 export. 날짜 문자열은 `YYYY-MM-DD`

- [ ] **Step 1: `package.json` 생성**

```json
{
  "name": "runner-recovery",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`tests/dates.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayStr, toDateStr, parseLocalDate, addDays, mondayOf, isValidDateStr } from '../logic.js';

test('toDateStr uses local time, not UTC', () => {
  // KST(UTC+9) 기준 자정 직후. toISOString()을 쓰면 전날이 나온다.
  const d = new Date(2026, 9, 18, 0, 30);
  assert.equal(toDateStr(d), '2026-10-18');
});

test('toDateStr pads single digits', () => {
  assert.equal(toDateStr(new Date(2026, 0, 5)), '2026-01-05');
});

test('parseLocalDate round-trips with toDateStr', () => {
  assert.equal(toDateStr(parseLocalDate('2026-03-09')), '2026-03-09');
});

test('addDays crosses month and year boundaries', () => {
  assert.equal(toDateStr(addDays(parseLocalDate('2026-10-31'), 1)), '2026-11-01');
  assert.equal(toDateStr(addDays(parseLocalDate('2026-12-31'), 1)), '2027-01-01');
  assert.equal(toDateStr(addDays(parseLocalDate('2026-01-01'), -1)), '2025-12-31');
});

test('mondayOf returns Monday for every day of the week', () => {
  // 2026-10-12(월) ~ 2026-10-18(일)
  for (const day of ['12','13','14','15','16','17','18']) {
    assert.equal(toDateStr(mondayOf(parseLocalDate(`2026-10-${day}`))), '2026-10-12');
  }
});

test('todayStr accepts an injected clock', () => {
  assert.equal(todayStr(new Date(2026, 4, 3, 23, 59)), '2026-05-03');
});

test('isValidDateStr rejects malformed input', () => {
  assert.equal(isValidDateStr('2026-10-18'), true);
  for (const bad of ['2026-13-01', '2026-10-32', '20261018', 'abc', '', null, undefined, '2026-2-3']) {
    assert.equal(isValidDateStr(bad), false, `expected ${bad} to be invalid`);
  }
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `node --test tests/dates.test.js`
Expected: FAIL — `Cannot find module '../logic.js'`

- [ ] **Step 4: `logic.js` 구현**

```js
const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function parseLocalDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function mondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();            // 0=일
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseLocalDate(s);
  return !Number.isNaN(d.getTime()) && toDateStr(d) === s;
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `node --test tests/dates.test.js`
Expected: PASS (7 tests)

- [ ] **Step 6: 커밋**

```bash
git add package.json logic.js tests/dates.test.js
git commit -m "$(cat <<'EOF'
Add local-time date utilities with tests

Replaces the UTC toISOString() approach that shifted dates by a day
before 09:00 KST.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 저장소 레이어

**Files:**
- Create: `store.js`, `tests/store.test.js`

**Interfaces:**
- Consumes: 없음
- Produces: `createStore(backend?)` → `{ get(key, fallback), set(key, value), remove(key) }`. `key`는 prefix 없는 짧은 이름(`'checks'`, `'sessions'`, `'steps'`, `'settings'`), 내부에서 `rr_v3_` 를 붙인다. backend 미지정 시 `globalThis.localStorage`, 접근 불가하면 메모리 폴백.

> **Review Focus #1** — localStorage가 throw해도 앱이 죽지 않아야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/store.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_PREFIX } from '../store.js';

function fakeBackend(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

test('set then get round-trips an object', () => {
  const s = createStore(fakeBackend());
  s.set('checks', { '2026-10-18': ['clamshell'] });
  assert.deepEqual(s.get('checks', {}), { '2026-10-18': ['clamshell'] });
});

test('keys are namespaced with the v3 prefix', () => {
  const b = fakeBackend();
  createStore(b).set('checks', {});
  assert.ok(b._map.has(`${STORAGE_PREFIX}checks`));
});

test('get returns the fallback for a missing key', () => {
  assert.deepEqual(createStore(fakeBackend()).get('sessions', []), []);
});

test('get returns the fallback for corrupted JSON', () => {
  const b = fakeBackend({ [`${STORAGE_PREFIX}sessions`]: '{not json' });
  assert.deepEqual(createStore(b).get('sessions', []), []);
});

test('v2 keys are never read', () => {
  const b = fakeBackend({ runner_tracker_state_v2: '{"2026-01-01__0":true}' });
  assert.deepEqual(createStore(b).get('checks', {}), {});
});

test('a throwing backend falls back to memory instead of crashing', () => {
  const hostile = {
    getItem() { throw new Error('SecurityError'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('SecurityError'); },
  };
  const s = createStore(hostile);
  assert.doesNotThrow(() => s.set('checks', { a: 1 }));
  assert.deepEqual(s.get('checks', {}), { a: 1 });   // 메모리에서 되읽힌다
});

test('remove deletes the key', () => {
  const s = createStore(fakeBackend());
  s.set('steps', { '2026-10-18': 100 });
  s.remove('steps');
  assert.deepEqual(s.get('steps', {}), {});
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/store.test.js`
Expected: FAIL — `Cannot find module '../store.js'`

- [ ] **Step 3: `store.js` 구현**

```js
export const STORAGE_PREFIX = 'rr_v3_';

function defaultBackend() {
  try {
    const ls = globalThis.localStorage;
    const probe = `${STORAGE_PREFIX}__probe`;
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function createStore(backend = defaultBackend()) {
  const memory = new Map();

  const readRaw = (k) => {
    if (backend) {
      try { return backend.getItem(k); } catch { /* fall through */ }
    }
    return memory.has(k) ? memory.get(k) : null;
  };

  const writeRaw = (k, v) => {
    memory.set(k, v);                       // 항상 메모리에도 둔다
    if (backend) {
      try { backend.setItem(k, v); } catch { /* 메모리만으로 계속 */ }
    }
  };

  return {
    get(key, fallback) {
      const raw = readRaw(STORAGE_PREFIX + key);
      if (raw === null) return fallback;
      try {
        const parsed = JSON.parse(raw);
        return parsed === null || parsed === undefined ? fallback : parsed;
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      writeRaw(STORAGE_PREFIX + key, JSON.stringify(value));
    },
    remove(key) {
      const k = STORAGE_PREFIX + key;
      memory.delete(k);
      if (backend) {
        try { backend.removeItem(k); } catch { /* noop */ }
      }
    },
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/store.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add store.js tests/store.test.js
git commit -m "$(cat <<'EOF'
Add namespaced store with memory fallback

Survives Safari private mode and quota errors instead of throwing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: 콘텐츠 데이터 (`data.js`)

**Files:**
- Create: `data.js`, `tests/data.test.js`

**Interfaces:**
- Consumes: 없음 (import 없는 순수 데이터 모듈)
- Produces:
  - `TASKS: Array<{id, title, tier, contexts, detail, youtube?}>` — `tier`는 `'essential'|'recommended'|'recovery'`
  - `MICRO_MISSIONS: Array<{id, context, text}>` — `context`는 `'subway'|'desk'|'lunch'|'home'|'outdoor'`
  - `RUN_LADDER: Array<{level, runMin, walkMin, sets, approxKm, label}>`
  - `RUN_RULES: string[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, MICRO_MISSIONS, RUN_LADDER, RUN_RULES } from '../data.js';

const TIERS = new Set(['essential', 'recommended', 'recovery']);
const CONTEXTS = new Set(['subway', 'desk', 'lunch', 'home', 'outdoor']);

test('exactly two tasks are essential', () => {
  const essential = TASKS.filter((t) => t.tier === 'essential');
  assert.equal(essential.length, 2);
  assert.deepEqual(essential.map((t) => t.id).sort(), ['bridge', 'clamshell']);
});

test('task ids are unique and every tier is known', () => {
  assert.equal(new Set(TASKS.map((t) => t.id)).size, TASKS.length);
  for (const t of TASKS) {
    assert.ok(TIERS.has(t.tier), `${t.id} has unknown tier ${t.tier}`);
    assert.ok(t.title && t.detail, `${t.id} is missing title or detail`);
  }
});

test('micro-mission ids are unique and contexts are known', () => {
  assert.equal(new Set(MICRO_MISSIONS.map((m) => m.id)).size, MICRO_MISSIONS.length);
  for (const m of MICRO_MISSIONS) {
    assert.ok(CONTEXTS.has(m.context), `${m.id} has unknown context ${m.context}`);
    assert.ok(m.text.length > 0);
  }
});

test('weekday and weekend pools are both large enough to pick 3', () => {
  const weekday = MICRO_MISSIONS.filter((m) => ['subway', 'desk', 'lunch', 'home'].includes(m.context));
  const weekend = MICRO_MISSIONS.filter((m) => ['home', 'outdoor'].includes(m.context));
  assert.ok(weekday.length >= 10, `weekday pool is ${weekday.length}`);
  assert.ok(weekend.length >= 3, `weekend pool is ${weekend.length}`);
});

test('ladder levels are contiguous from 1 and increase in volume', () => {
  RUN_LADDER.forEach((l, i) => assert.equal(l.level, i + 1));
  for (let i = 1; i < RUN_LADDER.length; i++) {
    assert.ok(RUN_LADDER[i].approxKm > RUN_LADDER[i - 1].approxKm,
      `level ${i + 1} is not longer than level ${i}`);
  }
});

test('run rules mention the non-negotiables', () => {
  const all = RUN_RULES.join(' ');
  for (const kw of ['내리막', '보폭', '2']) assert.ok(all.includes(kw), `missing rule: ${kw}`);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/data.test.js`
Expected: FAIL — `Cannot find module '../data.js'`

- [ ] **Step 3: `data.js` 구현**

스펙 8장의 미션 14개와 7장의 사다리를 그대로 옮긴다. 운동 설명은 기존 `index.html`의
`EXERCISE_GUIDES` 배열(342행 이후)에서 가져오되 `tier`/`contexts`를 추가한다.

```js
export const TASKS = [
  { id: 'clamshell', tier: 'essential', contexts: ['home'],
    title: '클램셸', detail: '15회 × 3세트',
    summary: '옆으로 누워 무릎을 벌려 중둔근을 깨웁니다.',
    how: ['옆으로 누워 무릎을 90도로 굽힙니다.', '발은 붙인 채 위쪽 무릎만 천천히 엽니다.',
          '골반이 뒤로 넘어가지 않는 범위까지만 벌립니다.'],
    mistakes: ['허리를 젖히며 골반까지 같이 열기', '반동으로 무릎을 확 벌리기'],
    tips: ['배꼽이 정면을 보게 유지하세요.', '크게 벌리기보다 천천히 버티는 게 중요합니다.'],
    youtube: 'https://www.youtube.com/watch?v=t0ASA5CxgKI' },

  { id: 'bridge', tier: 'essential', contexts: ['home'],
    title: '힙 브리지', detail: '15회 × 2세트',
    summary: '누워서 엉덩이를 들어 둔근과 햄스트링을 씁니다.',
    how: ['무릎을 세우고 누워 발을 골반 너비로 둡니다.', '엉덩이를 천천히 들어 올립니다.',
          '어깨-골반-무릎이 대각선이 되면 1초 멈춘 뒤 내려옵니다.'],
    mistakes: ['허리만 꺾어서 들어 올리기', '무릎이 바깥/안쪽으로 벌어지기'],
    tips: ['발바닥 전체로 바닥을 누르세요.'],
    youtube: 'https://www.youtube.com/watch?v=PhTDzR0TpZs' },

  { id: 'band-side', tier: 'recommended', contexts: ['home'],
    title: '밴드 사이드워킹', detail: '10m × 3세트',
    summary: '밴드를 걸고 옆으로 걸어 한 발 버티기 안정성을 키웁니다.',
    how: ['밴드를 무릎 위에 걸고 무릎을 살짝 굽힙니다.', '골반 높이를 유지한 채 옆으로 5~10걸음.',
          '왕복 내내 밴드 장력을 유지합니다.'],
    mistakes: ['발을 모을 때 텐션이 풀리기', '상체가 좌우로 흔들리기'],
    tips: ['허벅지보다 엉덩이 옆이 타는 느낌이면 맞습니다.'],
    youtube: 'https://www.youtube.com/watch?v=tUqN-hWOwY0' },

  { id: 'side-plank', tier: 'recommended', contexts: ['home'],
    title: '사이드 플랭크', detail: '20~30초 × 2세트 (양쪽)',
    summary: '몸통 측면과 중둔근을 함께 버티게 합니다.',
    how: ['팔꿈치를 어깨 아래 두고 옆으로 눕습니다.', '골반을 들어 머리-골반-발이 일직선이 되게 합니다.',
          '호흡을 참지 않고 버팁니다.'],
    mistakes: ['골반이 아래로 처지기', '어깨가 앞으로 말리기'],
    tips: ['힘들면 무릎을 굽혀 지지면을 줄이세요.'] },

  { id: 'step-down', tier: 'recommended', contexts: ['home'],
    title: '싱글레그 스텝다운', detail: '10회 × 2세트 (양쪽)',
    summary: '낮은 계단에서 한 발로 천천히 내려오며 착지 안정성을 기릅니다.',
    how: ['낮은 단에 한 발로 섭니다.', '무릎이 안쪽으로 말리지 않게 천천히 내려갑니다.',
          '반대 발이 바닥에 닿으면 다시 올라옵니다.'],
    mistakes: ['무릎이 안쪽으로 무너지기', '빠르게 떨어지듯 내려가기'],
    tips: ['통증이 있으면 단 높이를 낮추세요.'] },

  { id: 'foam', tier: 'recovery', contexts: ['home'],
    title: '폼롤러 + 스트레칭', detail: '부위당 30~60초',
    summary: '종아리·엉덩이 긴장을 줄여 보상 움직임을 막습니다.',
    how: ['종아리와 엉덩이를 30~60초씩 천천히 굴립니다.', '아픈 지점에서 숨을 참지 말고 짧게 멈춥니다.',
          '고관절과 종아리 스트레칭으로 마무리합니다.'],
    mistakes: ['IT밴드 뼈 위를 세게 오래 누르기', '통증을 참으며 과하게 롤링하기'],
    tips: ['예민한 날은 강도보다 시간을 줄이세요.'],
    youtube: 'https://www.youtube.com/watch?v=i9DvJa0mZQA' },

  { id: 'hipflexor', tier: 'recovery', contexts: ['home'],
    title: '고관절 굴곡근 스트레칭', detail: '30초 × 양쪽',
    summary: '하루 8시간 앉아 짧아진 앞쪽을 늘립니다.',
    how: ['런지 자세에서 뒤쪽 무릎을 바닥에 둡니다.', '골반을 앞으로 밀며 엉덩이를 조입니다.',
          '허리를 꺾지 않고 30초 유지합니다.'],
    mistakes: ['허리를 젖혀서 늘린 것처럼 느끼기'],
    tips: ['뒤쪽 엉덩이를 조이면 늘어나는 곳이 정확해집니다.'] },
];

export const MICRO_MISSIONS = [
  { id: 'sub-1', context: 'subway', text: '한 발에 체중 싣고 3정거장 (번갈아)' },
  { id: 'sub-2', context: 'subway', text: '손잡이 잡고 뒤꿈치 들기 20회' },
  { id: 'sub-3', context: 'subway', text: '앉으면 다리 꼬지 않기' },
  { id: 'sub-4', context: 'subway', text: '엉덩이 조이기 10초 × 10 (티 안 남)' },
  { id: 'sub-5', context: 'subway', text: '계단은 올라갈 때만, 내려갈 땐 에스컬레이터' },
  { id: 'desk-1', context: 'desk', text: '90분마다 일어서기' },
  { id: 'desk-2', context: 'desk', text: '모션데스크 30분 서서 일하기' },
  { id: 'desk-3', context: 'desk', text: '테니스공 발바닥 굴리기 2분' },
  { id: 'desk-4', context: 'desk', text: '책상 옆 런지로 고관절 앞쪽 30초' },
  { id: 'desk-5', context: 'desk', text: '무릎 사이 쿠션 끼고 조이기 15회' },
  { id: 'lunch-1', context: 'lunch', text: '15분 걷기 — 보폭 줄이고 걸음 수 늘리기' },
  { id: 'lunch-2', context: 'lunch', text: '경사 없는 평지 코스로' },
  { id: 'home-1', context: 'home', text: '양치하면서 한 발 서기 30초씩' },
  { id: 'home-2', context: 'home', text: '폼롤러 종아리 1분' },
  { id: 'out-1', context: 'outdoor', text: '엘리베이터 대신 올라가는 계단만 이용' },
  { id: 'out-2', context: 'outdoor', text: '걸을 때 보폭 줄이고 걸음 수 늘리기' },
];

export const RUN_LADDER = [
  { level: 1, runMin: 3,  walkMin: 2, sets: 4, approxKm: 2.0, label: '뛰기 3분 / 걷기 2분 × 4' },
  { level: 2, runMin: 3,  walkMin: 2, sets: 5, approxKm: 2.4, label: '뛰기 3분 / 걷기 2분 × 5' },
  { level: 3, runMin: 4,  walkMin: 2, sets: 5, approxKm: 2.9, label: '뛰기 4분 / 걷기 2분 × 5' },
  { level: 4, runMin: 5,  walkMin: 2, sets: 5, approxKm: 3.4, label: '뛰기 5분 / 걷기 2분 × 5' },
  { level: 5, runMin: 6,  walkMin: 2, sets: 5, approxKm: 3.9, label: '뛰기 6분 / 걷기 2분 × 5' },
  { level: 6, runMin: 8,  walkMin: 2, sets: 4, approxKm: 4.2, label: '뛰기 8분 / 걷기 2분 × 4' },
  { level: 7, runMin: 10, walkMin: 2, sets: 3, approxKm: 4.5, label: '뛰기 10분 / 걷기 2분 × 3' },
  { level: 8, runMin: 0,  walkMin: 0, sets: 1, approxKm: 5.0, label: '연속 러닝 5.0km' },
  { level: 9, runMin: 0,  walkMin: 0, sets: 1, approxKm: 5.5, label: '연속 러닝 5.5km' },
  { level: 10, runMin: 0, walkMin: 0, sets: 1, approxKm: 6.1, label: '연속 러닝 6.1km' },
];

export const RUN_RULES = [
  '평지만 — 내리막 피하기',
  '보폭 줄이고 걸음 자주 (케이던스 +5~10%)',
  '통증 2/10 넘으면 즉시 종료',
];
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/data.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add data.js tests/data.test.js
git commit -m "$(cat <<'EOF'
Add exercise, micro-mission, and run ladder data

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 연속 기록(streak) 계산

**Files:**
- Modify: `logic.js`
- Create: `tests/streak.test.js`

**Interfaces:**
- Consumes: Task 1 날짜 유틸
- Produces: `calcStreak(checks, essentialIds, today)` → `number`.
  `checks`는 `{ 'YYYY-MM-DD': string[] }`, `essentialIds`는 `string[]`, `today`는 `'YYYY-MM-DD'`

규칙(스펙 9장): 그날 필수 전부 체크 = 완료. **토요일은 건너뛴다**(세지도, 끊지도 않음).
오늘부터 거슬러 세되 **최근 7일 구간 안에서 미완료 1일까지 허용**, 같은 구간에서 두 번째
미완료가 나오면 멈춘다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/streak.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcStreak } from '../logic.js';

const ESS = ['clamshell', 'bridge'];
const full = (dates) => Object.fromEntries(dates.map((d) => [d, [...ESS]]));

test('no checks means zero', () => {
  assert.equal(calcStreak({}, ESS, '2026-10-18'), 0);
});

test('partial completion does not count', () => {
  assert.equal(calcStreak({ '2026-10-18': ['clamshell'] }, ESS, '2026-10-18'), 0);
});

test('consecutive complete days count', () => {
  // 2026-10-15(목) 16(금) 18(일) — 17은 토요일이라 건너뜀
  const checks = full(['2026-10-15', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 3);
});

test('Saturday is skipped entirely, not counted and not breaking', () => {
  // 2026-10-17이 토요일. 비어 있어도 끊기지 않고 길이에도 안 들어간다.
  const checks = full(['2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 2);
});

test('one miss inside the recent 7 days is forgiven but not counted', () => {
  // 14(수) 결석, 나머지 완료
  const checks = full(['2026-10-13', '2026-10-15', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 4);
});

test('a second miss in the same 7-day window stops the streak', () => {
  // 14(수)와 15(목) 둘 다 결석
  const checks = full(['2026-10-13', '2026-10-16', '2026-10-18']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 2);  // 18, 16 까지만
});

test('today being incomplete still allows yesterday to count', () => {
  const checks = full(['2026-10-16']);
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 1);
});

test('extra non-essential checks do not matter', () => {
  const checks = { '2026-10-18': ['clamshell', 'bridge', 'foam'] };
  assert.equal(calcStreak(checks, ESS, '2026-10-18'), 1);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/streak.test.js`
Expected: FAIL — `calcStreak is not a function`

- [ ] **Step 3: `logic.js`에 구현 추가**

```js
const SATURDAY = 6;

export function calcStreak(checks, essentialIds, today) {
  const done = (dateStr) => {
    const list = checks[dateStr];
    return Array.isArray(list) && essentialIds.every((id) => list.includes(id));
  };

  let streak = 0;
  let cursor = parseLocalDate(today);
  const missAt = [];                       // 미완료가 발생한 "검사 순번"
  let examined = 0;

  for (let guard = 0; guard < 400; guard++) {
    const dateStr = toDateStr(cursor);
    if (cursor.getDay() !== SATURDAY) {
      examined++;
      if (done(dateStr)) {
        streak++;
      } else {
        // 최근 7일 창 안의 미완료만 집계
        const recentMisses = missAt.filter((i) => examined - i < 7).length;
        if (recentMisses >= 1) break;      // 두 번째 미완료 → 종료
        missAt.push(examined);             // 첫 미완료는 용서, 증가는 없음
      }
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/streak.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add logic.js tests/streak.test.js
git commit -m "$(cat <<'EOF'
Add streak calculation with Saturday skip and one-miss grace

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 사다리 진행 + `painFreeKm`

**Files:**
- Modify: `logic.js`
- Create: `tests/progression.test.js`

**Interfaces:**
- Consumes: Task 3 `RUN_LADDER`
- Produces:
  - `painFreeKm(session)` → `number`
  - `nextLevel(currentLevel, runSessions, ladderLength)` → `{ level, reason, paused }`
    `runSessions`는 **최신이 마지막**인 `type:'run'` 세션 배열

규칙(스펙 7장): 통증 없이 2회 연속 → +1 / 통증 → −1 / 통증 3회 연속 → `paused: true`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/progression.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { painFreeKm, nextLevel } from '../logic.js';
import { RUN_LADDER } from '../data.js';

const LEN = RUN_LADDER.length;
const clean = (km) => ({ type: 'run', hadPain: false, distanceKm: km });
const hurt  = (km, onset) => ({ type: 'run', hadPain: true, distanceKm: km, painOnsetKm: onset });

test('painFreeKm uses the full distance when there was no pain', () => {
  assert.equal(painFreeKm(clean(3.4)), 3.4);
});

test('painFreeKm uses the onset distance when there was pain', () => {
  assert.equal(painFreeKm(hurt(3.4, 2.1)), 2.1);
});

test('painFreeKm falls back to distance when onset is missing', () => {
  assert.equal(painFreeKm({ type: 'run', hadPain: true, distanceKm: 3.0 }), 3.0);
});

test('two clean sessions in a row promote one level', () => {
  const r = nextLevel(3, [clean(2.9), clean(2.9)], LEN);
  assert.equal(r.level, 4);
  assert.equal(r.paused, false);
});

test('a single clean session holds the level', () => {
  assert.equal(nextLevel(3, [hurt(2.9, 2.0), clean(2.9)], LEN).level, 3);
});

test('pain demotes one level', () => {
  assert.equal(nextLevel(4, [clean(3.4), hurt(3.4, 2.2)], LEN).level, 3);
});

test('demotion never goes below level 1', () => {
  assert.equal(nextLevel(1, [hurt(2.0, 1.2)], LEN).level, 1);
});

test('promotion never goes past the top of the ladder', () => {
  assert.equal(nextLevel(LEN, [clean(9), clean(9)], LEN).level, LEN);
});

test('three painful sessions in a row pause running', () => {
  const r = nextLevel(4, [hurt(3, 2), hurt(3, 1.9), hurt(3, 1.5)], LEN);
  assert.equal(r.paused, true);
});

test('no sessions holds the level and does not pause', () => {
  const r = nextLevel(2, [], LEN);
  assert.equal(r.level, 2);
  assert.equal(r.paused, false);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/progression.test.js`
Expected: FAIL — `painFreeKm is not a function`

- [ ] **Step 3: `logic.js`에 구현 추가**

```js
export function painFreeKm(session) {
  if (!session) return 0;
  if (session.hadPain && Number.isFinite(session.painOnsetKm)) return session.painOnsetKm;
  return Number.isFinite(session.distanceKm) ? session.distanceKm : 0;
}

export function nextLevel(currentLevel, runSessions, ladderLength) {
  const runs = (runSessions || []).filter((s) => s.type === 'run');
  if (runs.length === 0) return { level: currentLevel, reason: '기록 없음', paused: false };

  const last3 = runs.slice(-3);
  if (last3.length === 3 && last3.every((s) => s.hadPain)) {
    return { level: Math.max(1, currentLevel - 1), reason: '통증 3회 연속 — 2주 중단 권장', paused: true };
  }

  const last = runs[runs.length - 1];
  if (last.hadPain) {
    return { level: Math.max(1, currentLevel - 1), reason: '통증 발생 — 한 단계 내립니다', paused: false };
  }

  const last2 = runs.slice(-2);
  if (last2.length === 2 && last2.every((s) => !s.hadPain)) {
    return { level: Math.min(ladderLength, currentLevel + 1), reason: '통증 없이 2회 연속 — 한 단계 올립니다', paused: false };
  }

  return { level: currentLevel, reason: '한 번 더 통증 없이 끝내면 올립니다', paused: false };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/progression.test.js`
Expected: PASS (10 tests)

- [ ] **Step 5: 커밋**

```bash
git add logic.js tests/progression.test.js
git commit -m "$(cat <<'EOF'
Add condition-based run ladder progression

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 자투리 미션 선택 + 걸음 수 파라미터

**Files:**
- Modify: `logic.js`
- Create: `tests/missions.test.js`, `tests/steps.test.js`

**Interfaces:**
- Consumes: Task 1 날짜 유틸, Task 3 `MICRO_MISSIONS`
- Produces:
  - `pickMissions(pool, dateStr, count)` → `Array<mission>` — 날짜 시드 결정적 선택, 요일로 context 필터
  - `parseStepsParam(search, today)` → `{ date, steps } | null`

> **Review Focus #2** — `?steps=` 비정상 입력은 저장하지 않고 조용히 무시한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/missions.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickMissions } from '../logic.js';
import { MICRO_MISSIONS } from '../data.js';

test('same date gives the same picks every call', () => {
  const a = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  const b = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
});

test('different dates give different picks at least sometimes', () => {
  const week = ['19','20','21','22','23'].map((d) => pickMissions(MICRO_MISSIONS, `2026-10-${d}`, 3));
  const signatures = new Set(week.map((p) => p.map((m) => m.id).join(',')));
  assert.ok(signatures.size > 1, '5일 내내 같은 미션이 나왔다');
});

test('picks are distinct within a day', () => {
  const p = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  assert.equal(new Set(p.map((m) => m.id)).size, p.length);
});

test('weekdays only draw from subway/desk/lunch/home', () => {
  // 2026-10-19는 월요일
  const p = pickMissions(MICRO_MISSIONS, '2026-10-19', 3);
  for (const m of p) assert.ok(['subway', 'desk', 'lunch', 'home'].includes(m.context));
});

test('weekends only draw from home/outdoor', () => {
  // 2026-10-17(토), 2026-10-18(일)
  for (const d of ['2026-10-17', '2026-10-18']) {
    for (const m of pickMissions(MICRO_MISSIONS, d, 3)) {
      assert.ok(['home', 'outdoor'].includes(m.context), `${d}: ${m.context}`);
    }
  }
});

test('asking for more than the pool returns the whole pool, not duplicates', () => {
  const p = pickMissions(MICRO_MISSIONS, '2026-10-17', 99);
  assert.equal(new Set(p.map((m) => m.id)).size, p.length);
});

test('an empty pool returns an empty array', () => {
  assert.deepEqual(pickMissions([], '2026-10-19', 3), []);
});
```

`tests/steps.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStepsParam } from '../logic.js';

const TODAY = '2026-10-18';

test('reads a valid steps and date pair', () => {
  assert.deepEqual(parseStepsParam('?steps=9240&date=2026-10-18', TODAY),
    { date: '2026-10-18', steps: 9240 });
});

test('defaults to today when date is absent', () => {
  assert.deepEqual(parseStepsParam('?steps=500', TODAY), { date: TODAY, steps: 500 });
});

test('accepts a past date', () => {
  assert.deepEqual(parseStepsParam('?steps=100&date=2026-10-17', TODAY),
    { date: '2026-10-17', steps: 100 });
});

test('rejects junk without throwing', () => {
  const bad = [
    '', '?', '?steps=', '?steps=abc', '?steps=-5', '?steps=1e9', '?steps=999999999',
    '?steps=12.5.3', '?steps=100&date=notadate', '?steps=100&date=2026-13-01',
    '?steps=100&date=2026-10-19',            // 미래 날짜
    '?date=2026-10-18',                      // steps 없음
  ];
  for (const s of bad) assert.equal(parseStepsParam(s, TODAY), null, `expected null for ${s}`);
});

test('rounds a fractional step count', () => {
  assert.deepEqual(parseStepsParam('?steps=9240.7', TODAY), { date: TODAY, steps: 9241 });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/missions.test.js tests/steps.test.js`
Expected: FAIL — `pickMissions is not a function`

- [ ] **Step 3: `logic.js`에 구현 추가**

```js
const WEEKDAY_CONTEXTS = ['subway', 'desk', 'lunch', 'home'];
const WEEKEND_CONTEXTS = ['home', 'outdoor'];
export const MAX_STEPS = 100000;

function dateSeed(dateStr) {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickMissions(pool, dateStr, count) {
  if (!Array.isArray(pool) || pool.length === 0) return [];
  const day = parseLocalDate(dateStr).getDay();
  const allowed = day === 0 || day === 6 ? WEEKEND_CONTEXTS : WEEKDAY_CONTEXTS;
  const candidates = pool.filter((m) => allowed.includes(m.context));
  if (candidates.length === 0) return [];

  const rand = mulberry32(dateSeed(dateStr));
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {         // Fisher-Yates
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function parseStepsParam(search, today) {
  let params;
  try { params = new URLSearchParams(search); } catch { return null; }

  const rawSteps = params.get('steps');
  if (rawSteps === null || rawSteps.trim() === '') return null;
  const steps = Number(rawSteps);
  if (!Number.isFinite(steps) || steps < 0 || steps > MAX_STEPS) return null;

  const rawDate = params.get('date');
  const date = rawDate === null ? today : rawDate;
  if (!isValidDateStr(date)) return null;
  if (date > today) return null;                           // 미래 날짜 거부

  return { date, steps: Math.round(steps) };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/missions.test.js tests/steps.test.js`
Expected: PASS (12 tests)

- [ ] **Step 5: 커밋**

```bash
git add logic.js tests/missions.test.js tests/steps.test.js
git commit -m "$(cat <<'EOF'
Add date-seeded mission picking and steps param validation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 주간 리포트 집계

**Files:**
- Modify: `logic.js`
- Create: `tests/report.test.js`

**Interfaces:**
- Consumes: Task 1 날짜 유틸, Task 5 `painFreeKm`
- Produces: `weeklyReport({checks, sessions, steps, essentialIds}, weekStartStr)` →
  `{ essentialDone, essentialTarget, runCount, totalKm, bestPainFreeKm, prevBestPainFreeKm, delta, avgSteps, hasData }`

> **Review Focus #4** — 세션 0개에서 터지지 않아야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/report.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReport } from '../logic.js';

const ESS = ['clamshell', 'bridge'];
const EMPTY = { checks: {}, sessions: [], steps: {}, essentialIds: ESS };

test('an empty week reports hasData false and no NaN', () => {
  const r = weeklyReport(EMPTY, '2026-10-12');
  assert.equal(r.hasData, false);
  assert.equal(r.runCount, 0);
  assert.equal(r.totalKm, 0);
  assert.equal(r.avgSteps, 0);
  assert.equal(r.essentialDone, 0);
  for (const v of Object.values(r)) assert.ok(!Number.isNaN(v), 'NaN leaked into the report');
});

test('counts only sessions inside the week', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-11', type: 'run', hadPain: false, distanceKm: 9 },   // 전주
    { date: '2026-10-13', type: 'run', hadPain: false, distanceKm: 2.4 },
    { date: '2026-10-18', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.1 },
    { date: '2026-10-19', type: 'run', hadPain: false, distanceKm: 9 },   // 다음 주
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.runCount, 2);
  assert.equal(r.totalKm, 5.4);
});

test('bestPainFreeKm takes the max of the week and compares to the previous week', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-07', type: 'run', hadPain: false, distanceKm: 2.0 },  // 전주
    { date: '2026-10-13', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.6 },
    { date: '2026-10-15', type: 'run', hadPain: false, distanceKm: 2.9 },
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.bestPainFreeKm, 2.9);
  assert.equal(r.prevBestPainFreeKm, 2.0);
  assert.ok(Math.abs(r.delta - 0.9) < 1e-9);
});

test('essentialDone counts fully-complete days in the week', () => {
  const data = { ...EMPTY, checks: {
    '2026-10-12': ['clamshell', 'bridge'],
    '2026-10-13': ['clamshell'],                 // 미완료
    '2026-10-14': ['clamshell', 'bridge'],
    '2026-10-19': ['clamshell', 'bridge'],       // 다음 주
  }};
  assert.equal(weeklyReport(data, '2026-10-12').essentialDone, 2);
});

test('avgSteps averages only days that have step data', () => {
  const data = { ...EMPTY, steps: { '2026-10-12': 8000, '2026-10-13': 10000, '2026-10-19': 50 } };
  assert.equal(weeklyReport(data, '2026-10-12').avgSteps, 9000);
});

test('golf and walk sessions are excluded from run stats', () => {
  const data = { ...EMPTY, sessions: [
    { date: '2026-10-13', type: 'golf' },
    { date: '2026-10-14', type: 'walk', distanceKm: 4 },
    { date: '2026-10-15', type: 'run', hadPain: false, distanceKm: 2.4 },
  ]};
  const r = weeklyReport(data, '2026-10-12');
  assert.equal(r.runCount, 1);
  assert.equal(r.totalKm, 2.4);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/report.test.js`
Expected: FAIL — `weeklyReport is not a function`

- [ ] **Step 3: `logic.js`에 구현 추가**

```js
const round1 = (n) => Math.round(n * 10) / 10;

function runsBetween(sessions, startStr, endStr) {
  return (sessions || []).filter(
    (s) => s.type === 'run' && s.date >= startStr && s.date <= endStr);
}

export function weeklyReport({ checks = {}, sessions = [], steps = {}, essentialIds = [] }, weekStartStr) {
  const start = parseLocalDate(weekStartStr);
  const days = Array.from({ length: 7 }, (_, i) => toDateStr(addDays(start, i)));
  const endStr = days[6];
  const prevStart = toDateStr(addDays(start, -7));
  const prevEnd = toDateStr(addDays(start, -1));

  const runs = runsBetween(sessions, weekStartStr, endStr);
  const prevRuns = runsBetween(sessions, prevStart, prevEnd);

  const best = runs.length ? Math.max(...runs.map(painFreeKm)) : 0;
  const prevBest = prevRuns.length ? Math.max(...prevRuns.map(painFreeKm)) : 0;

  const stepDays = days.map((d) => steps[d]).filter((n) => Number.isFinite(n));
  const avgSteps = stepDays.length
    ? Math.round(stepDays.reduce((a, b) => a + b, 0) / stepDays.length)
    : 0;

  const essentialDone = days.filter((d) => {
    const list = checks[d];
    return Array.isArray(list) && essentialIds.every((id) => list.includes(id));
  }).length;

  return {
    essentialDone,
    essentialTarget: 7,
    runCount: runs.length,
    totalKm: round1(runs.reduce((sum, s) => sum + (Number(s.distanceKm) || 0), 0)),
    bestPainFreeKm: round1(best),
    prevBestPainFreeKm: round1(prevBest),
    delta: round1(best - prevBest),
    avgSteps,
    hasData: runs.length > 0 || essentialDone > 0 || stepDays.length > 0,
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/report.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 전체 테스트 실행 + 커밋**

```bash
npm test
git add logic.js tests/report.test.js
git commit -m "$(cat <<'EOF'
Add weekly report aggregation

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 스타일시트 + HTML 셸 + 탭 전환

**Files:**
- Create: `styles.css`, `index.html`, `app.js`

**Interfaces:**
- Consumes: 없음
- Produces: DOM 계약 — `#tab-today`, `#tab-log`, `#tab-guide` (섹션),
  `.tabbar button[data-tab]`, `app.js`의 `activateTab(name)`.
  `app.js`는 `window.__rr = { store, render }` 를 노출해 이후 태스크가 붙을 수 있게 한다.

- [ ] **Step 1: `styles.css` 작성 — 토큰 + 다크모드 + 기본 컴포넌트**

Tailwind를 쓰지 않으므로 전부 직접 쓴다. 필수 포함 항목:

```css
:root {
  --bg: #f8fafc;  --surface: #ffffff;  --border: #e2e8f0;
  --text: #0f172a; --muted: #64748b;   --brand: #2563eb;
  --ok: #059669;   --warn: #dc2626;
  --radius: 16px;  --gap: 16px;
  --font: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b1120; --surface: #111c33; --border: #1f2d4d;
    --text: #e8eefc; --muted: #94a3b8; --brand: #60a5fa;
  }
}
:root[data-theme="dark"] { /* 위와 동일한 값 */ }

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text); font-family: var(--font);
  -webkit-tap-highlight-color: transparent;
}
.app { max-width: 480px; margin: 0 auto; padding: 0 var(--gap);
       padding-bottom: calc(env(safe-area-inset-bottom) + 24px); }
button, .tap { min-height: 44px; }        /* 터치 타깃 */
.hidden { display: none !important; }
```

추가로 작성할 클래스: `.card`, `.stat`, `.tabbar`, `.check-row`, `.mission`, `.pill`,
`.btn`, `.btn-primary`, `.collapse`, `.chart`, `.modal`. 전부 토큰만 참조한다.

- [ ] **Step 2: `index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>러닝 회복</title>
  <link rel="stylesheet" href="styles.css">
  <script type="module" src="app.js"></script>
</head>
<body>
  <div class="app">
    <header id="header"></header>
    <nav class="tabbar">
      <button data-tab="today" class="tap">오늘</button>
      <button data-tab="log"   class="tap">기록</button>
      <button data-tab="guide" class="tap">가이드</button>
    </nav>
    <main>
      <section id="tab-today"></section>
      <section id="tab-log"   class="hidden"></section>
      <section id="tab-guide" class="hidden"></section>
    </main>
  </div>
  <div id="modal-root"></div>
</body>
</html>
```

PWA 태그(manifest, apple-touch-icon, theme-color)는 Task 12에서 추가한다.

- [ ] **Step 3: `app.js` 작성 — 탭 전환만**

```js
import { createStore } from './store.js';

const store = createStore();
const TABS = ['today', 'log', 'guide'];

export function activateTab(name) {
  for (const t of TABS) {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name);
  }
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === name);
  });
  store.set('lastTab', name);
}

document.querySelectorAll('.tabbar button').forEach((b) => {
  b.addEventListener('click', () => activateTab(b.dataset.tab));
});

activateTab(store.get('lastTab', 'today'));
window.__rr = { store };
```

- [ ] **Step 4: 로컬에서 확인**

Run: `python3 -m http.server 8787 --bind 127.0.0.1` (이미 떠 있으면 생략)
브라우저로 `http://localhost:8787/` 열고 탭 3개가 전환되는지, 다크모드에서 읽히는지,
390px 폭에서 가로 스크롤이 없는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add index.html styles.css app.js
git commit -m "$(cat <<'EOF'
Add hand-written stylesheet, HTML shell, and tab routing

Drops the Tailwind CDN dependency so the page renders instantly and
works offline.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: "오늘" 화면

**Files:**
- Modify: `app.js`, `styles.css`
- Create: `tests/escape.test.js`

**Interfaces:**
- Consumes: Task 2 `store`, Task 3 `TASKS`/`MICRO_MISSIONS`/`RUN_LADDER`/`RUN_RULES`,
  Task 4 `calcStreak`, Task 5 `nextLevel`, Task 6 `pickMissions`/`parseStepsParam`
- Produces: `renderToday()`, `logic.js`의 `escapeHtml(s)`

스펙 5장 레이아웃 순서를 그대로 따른다: 이미 해낸 것 → 오늘의 한 가지 → 필수 2개 →
자투리 3개 → 접힌 권장/회복 → (러닝한 날만) 기록 버튼.

> **Review Focus #3** — 사용자 입력에 HTML이 들어가도 실행되거나 깨지지 않아야 한다.
> **Review Focus #5** — 앱을 켜둔 채 자정을 넘기면 날짜가 갱신되되 입력 중인 내용은 남아야 한다.

- [ ] **Step 1: 이스케이프 테스트 작성**

`tests/escape.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../logic.js';

test('escapes the characters that break markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('"q" \'p\''), '&quot;q&quot; &#39;p&#39;');
});

test('ampersand is escaped first so entities are not double-built', () => {
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
});

test('handles non-string input without throwing', () => {
  for (const v of [null, undefined, 42, {}]) {
    assert.equal(typeof escapeHtml(v), 'string');
  }
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/escape.test.js`
Expected: FAIL — `escapeHtml is not a function`

- [ ] **Step 3: `logic.js`에 `escapeHtml` 추가**

```js
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/escape.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: `app.js`에 `renderToday()` 구현**

요구사항:

1. **걸음 수 흡수** — 시작 시 `parseStepsParam(location.search, todayStr())`를 호출하고,
   값이 있으면 `steps[date] = n`으로 **덮어쓰기** 저장한 뒤
   `history.replaceState({}, '', location.pathname)`으로 쿼리를 제거한다.
2. **상단 줄** — `🔥 N일째` (`calcStreak`) + 걸음 수. 걸음 수가 없고 평일이면
   `출퇴근 걷기 45분` 폴백을 보여준다 (주말에는 폴백 없음).
3. **오늘의 한 가지** — 요일로 결정:
   - 토요일: `오늘은 쉬는 날입니다` 카드. 필수 2개는 접은 상태로 둔다
   - `settings.runDays`에 포함되거나 일요일: `RUN_LADDER[level-1].label` + `RUN_RULES` 표시
   - 그 외 평일: 필수 2개 (5분)
4. **필수 2개** — `TASKS.filter(t => t.tier === 'essential')`. 체크 시
   `checks[today]`에 **id를 넣고 빼며** 저장, 즉시 `renderToday()` 재호출
5. **자투리 3개** — `pickMissions(MICRO_MISSIONS, today, 3)`. 체크는 저장하지 않는다
   (당일 안내용이므로 streak·통계에 영향 없음)
6. **접힌 영역 2개** — `recommended`, `recovery` 티어. `<details>` 사용
7. **러닝 기록 버튼** — 러닝 지정일에만 노출. 누르면 모달:
   거리(number), 통증 있었나(checkbox), 통증 시작 거리(통증 체크 시에만 노출),
   통증 점수(0–10 range), 메모(textarea). 저장 시 `sessions`에 append하고
   `nextLevel()`로 `settings.runLevel` 갱신
8. **골프 경고** — 같은 날 `type:'golf'` 세션이 이미 있으면 러닝 카드에
   `오늘 골프 연습을 했습니다 — 한 발 버티기가 지친 상태라 폼이 무너지기 쉽습니다` 표시
9. **모든 사용자 입력은 `escapeHtml()`을 통과시키거나 `textContent`로 넣는다**
10. **자정 처리** — 60초 간격 `setInterval`로 `todayStr()`을 비교해 날짜가 바뀌면
    **`location.reload()`를 쓰지 않고** `renderToday()`만 다시 호출한다.
    입력 중이던 모달 값은 건드리지 않는다

- [ ] **Step 6: 온보딩 구현**

`settings`가 비어 있으면 첫 화면에서 묻는다: **"최근에 뛰었을 때 몇 km쯤에서 아팠나요?"**
(number, 비워두면 건너뛰기 가능) + **주중 러닝 요일** (기본 화·목).
입력값으로 `settings`를 만든다:

```js
const km = Number(input) || 0;
const level = km > 0
  ? Math.max(1, RUN_LADDER.findLastIndex((l) => l.approxKm <= km * 0.8) + 1)
  : 1;
store.set('settings', { painOnsetKm: km, runLevel: level, runDays: [2, 4], startedAt: todayStr() });
```

- [ ] **Step 7: 로컬 확인**

`http://localhost:8787/` 에서:
- 체크 2개 → 새로고침 후에도 유지되는가
- 메모에 `<img src=x onerror=alert(1)>` 입력 → 저장 후 **문자 그대로** 보이고 alert이 안 뜨는가
- `?steps=9240` 붙여 열기 → 걸음 수가 반영되고 주소창에서 쿼리가 사라지는가
- `?steps=-5`, `?steps=abc` → 아무 일도 안 일어나는가
- 390px 폭에서 가로 스크롤 없는가

- [ ] **Step 8: 커밋**

```bash
npm test
git add app.js styles.css logic.js tests/escape.test.js
git commit -m "$(cat <<'EOF'
Add today screen with streak, missions, and run logging

Opens on what is already done rather than on 0/7, and keeps weekday
checkboxes down to the two essentials.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: "기록" 탭 + SVG 그래프

**Files:**
- Modify: `app.js`, `styles.css`
- Create: `tests/chart.test.js`

**Interfaces:**
- Consumes: Task 5 `painFreeKm`, Task 7 `weeklyReport`
- Produces: `renderLog()`, `logic.js`의 `chartPoints(sessions, width, height)` →
  `{ points: Array<{x, y, hadPain, date, km}>, maxKm, minKm }`

> **Review Focus #4** — 세션 0개/1개에서도 좌표 계산이 터지지 않아야 한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/chart.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPoints } from '../logic.js';

const S = (date, km, hadPain = false) => ({ date, type: 'run', hadPain, distanceKm: km });

test('no sessions yields no points and no NaN', () => {
  const r = chartPoints([], 300, 120);
  assert.deepEqual(r.points, []);
  assert.ok(Number.isFinite(r.maxKm) && Number.isFinite(r.minKm));
});

test('a single session is placed without dividing by zero', () => {
  const r = chartPoints([S('2026-10-18', 2.4)], 300, 120);
  assert.equal(r.points.length, 1);
  for (const p of r.points) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `NaN coord: ${JSON.stringify(p)}`);
  }
});

test('all-equal values do not divide by zero', () => {
  const r = chartPoints([S('2026-10-14', 3), S('2026-10-16', 3), S('2026-10-18', 3)], 300, 120);
  for (const p of r.points) assert.ok(Number.isFinite(p.y));
});

test('points stay inside the box and higher km sits higher on screen', () => {
  const r = chartPoints([S('2026-10-14', 2.0), S('2026-10-18', 4.0)], 300, 120);
  for (const p of r.points) {
    assert.ok(p.x >= 0 && p.x <= 300, `x out of range: ${p.x}`);
    assert.ok(p.y >= 0 && p.y <= 120, `y out of range: ${p.y}`);
  }
  assert.ok(r.points[1].y < r.points[0].y, 'larger km should have smaller y');
});

test('non-run sessions are excluded', () => {
  const sessions = [S('2026-10-14', 2), { date: '2026-10-15', type: 'golf' }];
  assert.equal(chartPoints(sessions, 300, 120).points.length, 1);
});

test('points are sorted by date regardless of input order', () => {
  const r = chartPoints([S('2026-10-18', 4), S('2026-10-14', 2)], 300, 120);
  assert.deepEqual(r.points.map((p) => p.date), ['2026-10-14', '2026-10-18']);
});

test('pain sessions are flagged so they can be drawn differently', () => {
  const r = chartPoints([{ date: '2026-10-18', type: 'run', hadPain: true, distanceKm: 3, painOnsetKm: 2.1 }], 300, 120);
  assert.equal(r.points[0].hadPain, true);
  assert.equal(r.points[0].km, 2.1);
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `node --test tests/chart.test.js`
Expected: FAIL — `chartPoints is not a function`

- [ ] **Step 3: `logic.js`에 구현 추가**

```js
export function chartPoints(sessions, width, height) {
  const runs = (sessions || [])
    .filter((s) => s.type === 'run')
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (runs.length === 0) return { points: [], maxKm: 0, minKm: 0 };

  const values = runs.map(painFreeKm);
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);
  const maxKm = rawMax === rawMin ? rawMax + 1 : rawMax;
  const minKm = rawMax === rawMin ? Math.max(0, rawMin - 1) : rawMin;
  const span = maxKm - minKm;                       // span > 0 보장됨

  const points = runs.map((s, i) => {
    const km = painFreeKm(s);
    const x = runs.length === 1 ? width / 2 : (i / (runs.length - 1)) * width;
    const y = height - ((km - minKm) / span) * height;
    return { x, y, km, date: s.date, hadPain: !!s.hadPain };
  });

  return { points, maxKm, minKm };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `node --test tests/chart.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: `app.js`에 `renderLog()` 구현**

1. **메인 차트** — `chartPoints()` 결과로 `<svg viewBox="0 0 300 120">` 안에
   `<polyline>` + 점. 통증 있었던 점은 `--warn` 색, 없던 점은 `--brand` 색.
   세션이 없으면 `아직 기록이 없습니다. 첫 러닝을 기록해보세요.` 빈 상태
2. **걸음 수 막대** — 최근 14일, 높이 40px 정도로 작게. 데이터 없는 날은 건너뛴다
3. **일요일 밤 주간 리포트** — 일요일이고 22시 이후일 때만 차트 위에 카드로.
   `weeklyReport()` 결과 + `nextLevel()`의 `reason`을 다음 주 제안으로 표시.
   `hasData`가 false면 리포트를 띄우지 않는다
4. **세션 목록** — 최신순. 날짜, 종류, 거리, 통증. 메모는 `textContent`로 넣는다

- [ ] **Step 6: 로컬 확인**

기록이 0개인 상태에서 빈 상태 문구가 나오는지, 러닝을 2~3개 기록한 뒤 선이 그려지는지,
390px에서 차트가 잘리지 않는지 확인한다.

- [ ] **Step 7: 커밋**

```bash
npm test
git add app.js styles.css logic.js tests/chart.test.js
git commit -m "$(cat <<'EOF'
Add log tab with pain-free distance chart

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: "가이드" 탭 + 설정 모달

**Files:**
- Modify: `app.js`, `styles.css`

**Interfaces:**
- Consumes: Task 3 `TASKS`
- Produces: `renderGuide()`, `openSettings()`

- [ ] **Step 1: `renderGuide()` 구현**

- 필터 칩 4개: `전체` / `필수` / `권장` / `회복`. **칩은 반드시 HTML에 실재해야 한다**
  (기존 앱은 `.guide-filter`를 JS로 찾는데 마크업에 없어서 필터가 죽어 있었다)
- 각 운동 카드: 제목, 티어 배지, 요약, 하는 법(`how`), 잘못된 자세(`mistakes`),
  코칭 팁(`tips`), 유튜브 링크(`youtube`가 있을 때만)
- **일러스트는 모든 폭에서 보인다.** 기존 앱은 `hidden sm:block`이라 폰에서만 숨었다
- 카드는 `<details>`로 접어 기본은 제목+요약만 보이게 한다

- [ ] **Step 2: `openSettings()` 구현**

- 주중 러닝 요일 선택 (월~금 토글, 연속 이틀 조합이면 저장 버튼 비활성 + 사유 표시)
- 현재 사다리 레벨 표시 + 수동 조정 (±)
- `painOnsetKm` 수정
- **단축어 설정 안내** — 스펙 11장 내용을 단계별로. 복사 가능한 URL 템플릿 포함:
  `https://runner-recovery.vercel.app/?steps=[걸음수]&date=[날짜]`
- **데이터 초기화** 버튼 (confirm 2회)

- [ ] **Step 3: 로컬 확인**

필터 칩 4개가 실제로 동작하는지, 폰 폭에서 일러스트가 보이는지,
연속 이틀 러닝 요일 조합이 막히는지 확인한다.

- [ ] **Step 4: 커밋**

```bash
npm test
git add app.js styles.css
git commit -m "$(cat <<'EOF'
Add guide tab with working filters and settings modal

The old guide filter buttons were referenced in JS but never existed in
markup; the illustrations were hidden on phones. Both fixed.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: PWA — 아이콘, manifest, 서비스워커

**Files:**
- Create: `icons/icon.svg`, `icons/icon-180.png`, `icons/icon-192.png`, `icons/icon-512.png`,
  `manifest.webmanifest`, `sw.js`
- Modify: `index.html`, `app.js`

**Interfaces:**
- Consumes: Task 8 `index.html`
- Produces: 설치 가능한 오프라인 PWA

- [ ] **Step 1: 아이콘 원본 SVG 작성**

`icons/icon.svg` — 512×512. 브랜드 색 배경 라운드 사각형 + 단순한 러너 실루엣.
글자는 넣지 않는다 (작은 크기에서 뭉갠다).

- [ ] **Step 2: PNG 3종 생성**

```bash
cd icons
for s in 180 192 512; do
  sips -s format png icon.svg --resampleHeightWidth $s $s --out icon-$s.png
done
sips -g pixelWidth -g pixelHeight icon-180.png icon-192.png icon-512.png
```

Expected: 각각 180×180, 192×192, 512×512

- [ ] **Step 3: `manifest.webmanifest` 작성**

```json
{
  "name": "러닝 회복",
  "short_name": "러닝회복",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f8fafc",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 4: `index.html` `<head>`에 PWA 태그 추가**

```html
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="러닝회복">
<meta name="theme-color" content="#2563eb">
```

> iOS는 manifest의 `icons`를 무시하고 `apple-touch-icon`을 쓴다. 둘 다 필요하다.

- [ ] **Step 5: `sw.js` 작성**

```js
const VERSION = 'rr-v3-001';          // 배포할 때마다 올린다
const ASSETS = [
  './', './index.html', './styles.css',
  './app.js', './logic.js', './data.js', './store.js',
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit || fetch(e.request).catch(() => caches.match('./index.html'))
    )
  );
});
```

> `ignoreSearch: true` 가 중요하다 — 단축어가 `?steps=...`를 붙여 열기 때문에
> 쿼리가 다르다고 캐시를 놓치면 오프라인에서 실패한다.

- [ ] **Step 6: `app.js`에 서비스워커 등록 + iOS 설치 안내**

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* 무시 */ });
  });
}

function maybeShowInstallHint() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (standalone || !isIOS || store.get('installHintDismissed', false)) return;
  // "공유 버튼 → 홈 화면에 추가" 안내 배너를 띄우고,
  // 닫기 누르면 store.set('installHintDismissed', true)
}
```

- [ ] **Step 7: 로컬 확인**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/manifest.webmanifest
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/sw.js
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8787/icons/icon-180.png
```

Expected: 전부 200.
브라우저 DevTools → Application → Service Workers 에서 등록 확인,
Network 탭 Offline 체크 후 새로고침 → **스타일이 입혀진 채로** 열려야 한다.

- [ ] **Step 8: 커밋**

```bash
git add icons manifest.webmanifest sw.js index.html app.js
git commit -m "$(cat <<'EOF'
Add PWA manifest, icons, and offline service worker

Makes the app installable to the iOS home screen and fully usable
offline, which the Tailwind CDN previously prevented.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: 구버전 제거 + 배포

**Files:**
- Delete: `index_old01.html`, `index_old02.html`
- Create: `README.md`

**Interfaces:**
- Consumes: Task 1–12 전부
- Produces: 프로덕션 배포

- [ ] **Step 1: 전체 테스트 통과 확인**

Run: `npm test`
Expected: 모든 테스트 PASS

- [ ] **Step 2: 구버전 파일 삭제**

```bash
git rm index_old01.html index_old02.html
```

git 히스토리(`3e0f246`)에 남아 있으므로 복원 가능하다.

- [ ] **Step 3: `README.md` 작성**

내용: 무엇인지 한 문단, 로컬 실행법(`python3 -m http.server 8787`),
테스트(`npm test`), 배포(`main`에 푸시하면 Vercel 자동 배포),
단축어 설정법, 파일 구성 표, 스펙·플랜 문서 링크.

- [ ] **Step 4: 커밋 + 푸시**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Remove superseded single-file versions and add README

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push origin main
```

- [ ] **Step 5: 배포 확인**

```bash
vercel --prod --yes
sleep 5
for p in / /manifest.webmanifest /sw.js /icons/icon-180.png /styles.css /app.js /logic.js /data.js /store.js; do
  printf "%-28s " "$p"
  curl -s -o /dev/null -w "%{http_code}\n" "https://runner-recovery.vercel.app$p"
done
```

Expected: 전부 200

- [ ] **Step 6: 프로덕션 스모크 테스트**

- `https://runner-recovery.vercel.app/` — 탭 3개 동작, 다크모드 정상
- `https://runner-recovery.vercel.app/?steps=9240` — 걸음 수 반영, 쿼리 제거됨
- 폰 Safari에서 열어 **공유 → 홈 화면에 추가** → 아이콘 확인 →
  실행 시 Safari UI 없이 전체화면인지 확인
- 비행기 모드에서 홈 화면 아이콘 실행 → 스타일 입혀진 채 열리는지 확인

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 장 | 태스크 |
|---|---|
| 5 정보 구조 (탭 3개) | 8 |
| 5 "오늘" 화면 레이아웃 | 9 |
| 6 데이터 모델 / `painFreeKm` | 2, 5 |
| 7 진행 로직 | 5 |
| 8 자투리 미션 | 3, 6 |
| 9 streak | 4 |
| 10 주간 리포트 | 7, 10 |
| 11 걸음 수 연동 | 6, 9, 11 |
| 12 기록 탭 그래프 | 10 |
| 13 파일 구성 | 8, 13 |
| 14 스타일 | 8 |
| 15 PWA | 12 |
| 17 성공 기준 | 13 Step 6 |

누락 없음.

**2. 플레이스홀더** — "적절히", "등등", "TBD" 없음. UI 태스크는 코드 대신
명시적 요구사항 번호 목록으로 대체했고, 각 항목이 검증 가능하다.

**3. 타입 일관성** — `painFreeKm`은 Task 5에서 정의되어 Task 7·10에서 같은 이름으로 쓰인다.
`checks`는 전 구간에서 `{date: string[]}`, `sessions`는 `{date, type, ...}[]`,
`steps`는 `{date: number}`로 일관된다. `store.get/set` 키는 prefix 없는 짧은 이름으로 통일.

**4. Review Focus 커버리지** — 5개 항목 모두 담당 태스크에 테스트가 들어갔다:
#1 Task 2, #2 Task 6, #3 Task 9, #4 Task 7·10, #5 Task 9 Step 5-10.
