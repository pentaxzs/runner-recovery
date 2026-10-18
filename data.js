// 콘텐츠 데이터. import 없음 — 운동·미션·사다리를 여기서만 고치면 된다.

export const TASKS = [
  {
    id: 'clamshell', tier: 'essential', contexts: ['home'],
    title: '클램셸', detail: '15회 × 3세트',
    summary: '옆으로 누워 무릎을 벌려 중둔근을 깨웁니다.',
    when: '러닝할 때 골반이 흔들리거나 무릎이 안쪽으로 말릴 때',
    how: [
      '옆으로 누워 무릎을 90도로 굽힙니다.',
      '발은 붙인 채 위쪽 무릎만 천천히 엽니다.',
      '골반이 뒤로 넘어가지 않는 범위까지만 벌립니다.',
    ],
    mistakes: ['허리를 젖히며 골반까지 같이 열기', '반동으로 무릎을 확 벌리기'],
    tips: ['배꼽이 정면을 보게 유지하세요.', '크게 벌리기보다 천천히 버티는 게 중요합니다.'],
    youtube: 'https://www.youtube.com/watch?v=t0ASA5CxgKI',
  },
  {
    id: 'bridge', tier: 'essential', contexts: ['home'],
    title: '힙 브리지', detail: '15회 × 2세트',
    summary: '누워서 엉덩이를 들어 둔근과 햄스트링을 씁니다.',
    when: '골반이 쉽게 처지거나 엉덩이 힘이 약하다고 느껴질 때',
    how: [
      '무릎을 세우고 누워 발을 골반 너비로 둡니다.',
      '엉덩이를 천천히 들어 올립니다.',
      '어깨-골반-무릎이 대각선이 되면 1초 멈춘 뒤 내려옵니다.',
    ],
    mistakes: ['허리만 꺾어서 들어 올리기', '무릎이 바깥/안쪽으로 벌어지기'],
    tips: ['발바닥 전체로 바닥을 누르세요.'],
    youtube: 'https://www.youtube.com/watch?v=PhTDzR0TpZs',
  },
  {
    id: 'band-side', tier: 'recommended', contexts: ['home'],
    title: '밴드 사이드워킹', detail: '10m × 3세트',
    summary: '밴드를 걸고 옆으로 걸어 한 발 버티기 안정성을 키웁니다.',
    when: '무릎 바깥쪽이 불편하거나 착지 때 중심이 한쪽으로 무너질 때',
    how: [
      '밴드를 무릎 위에 걸고 무릎을 살짝 굽힙니다.',
      '골반 높이를 유지한 채 옆으로 5~10걸음 이동합니다.',
      '왕복 내내 밴드 장력을 유지합니다.',
    ],
    mistakes: ['발을 모을 때 텐션이 풀리기', '상체가 좌우로 흔들리기'],
    tips: ['허벅지보다 엉덩이 옆이 타는 느낌이면 맞습니다.'],
    youtube: 'https://www.youtube.com/watch?v=tUqN-hWOwY0',
  },
  {
    id: 'side-plank', tier: 'recommended', contexts: ['home'],
    title: '사이드 플랭크', detail: '20~30초 × 2세트 (양쪽)',
    summary: '몸통 측면과 중둔근을 함께 버티게 합니다.',
    when: '러닝 후반에 자세가 무너지는 느낌이 있을 때',
    how: [
      '팔꿈치를 어깨 아래 두고 옆으로 눕습니다.',
      '골반을 들어 머리-골반-발이 일직선이 되게 합니다.',
      '호흡을 참지 않고 버팁니다.',
    ],
    mistakes: ['골반이 아래로 처지기', '어깨가 앞으로 말리기'],
    tips: ['힘들면 무릎을 굽혀 지지면을 줄이세요.'],
  },
  {
    id: 'step-down', tier: 'recommended', contexts: ['home'],
    title: '싱글레그 스텝다운', detail: '10회 × 2세트 (양쪽)',
    summary: '낮은 계단에서 한 발로 천천히 내려오며 착지 안정성을 기릅니다.',
    when: '계단을 내려갈 때 무릎 바깥이 불편할 때',
    how: [
      '낮은 단에 한 발로 섭니다.',
      '무릎이 안쪽으로 말리지 않게 천천히 내려갑니다.',
      '반대 발이 바닥에 닿으면 다시 올라옵니다.',
    ],
    mistakes: ['무릎이 안쪽으로 무너지기', '빠르게 떨어지듯 내려가기'],
    tips: ['통증이 있으면 단 높이를 낮추세요.'],
  },
  {
    id: 'foam', tier: 'recovery', contexts: ['home'],
    title: '폼롤러 + 스트레칭', detail: '부위당 30~60초',
    summary: '종아리·엉덩이 긴장을 줄여 보상 움직임을 막습니다.',
    when: '뻐근함이 누적되거나 다음 날 다리가 무거울 때',
    how: [
      '종아리와 엉덩이를 30~60초씩 천천히 굴립니다.',
      '아픈 지점에서 숨을 참지 말고 짧게 멈춥니다.',
      '고관절과 종아리 스트레칭으로 마무리합니다.',
    ],
    mistakes: ['IT밴드 뼈 위를 세게 오래 누르기', '통증을 참으며 과하게 롤링하기'],
    tips: ['예민한 날은 강도보다 시간을 줄이세요.'],
    youtube: 'https://www.youtube.com/watch?v=i9DvJa0mZQA',
  },
  {
    id: 'hipflexor', tier: 'recovery', contexts: ['home'],
    title: '고관절 굴곡근 스트레칭', detail: '30초 × 양쪽',
    summary: '하루 8시간 앉아 짧아진 앞쪽을 늘립니다.',
    when: '오래 앉아 있던 날, 골반 앞쪽이 뻣뻣할 때',
    how: [
      '런지 자세에서 뒤쪽 무릎을 바닥에 둡니다.',
      '골반을 앞으로 밀며 엉덩이를 조입니다.',
      '허리를 꺾지 않고 30초 유지합니다.',
    ],
    mistakes: ['허리를 젖혀서 늘린 것처럼 느끼기'],
    tips: ['뒤쪽 엉덩이를 조이면 늘어나는 곳이 정확해집니다.'],
  },
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
  { level: 1, runMin: 3, walkMin: 2, sets: 4, approxKm: 2.0, label: '뛰기 3분 / 걷기 2분 × 4' },
  { level: 2, runMin: 3, walkMin: 2, sets: 5, approxKm: 2.4, label: '뛰기 3분 / 걷기 2분 × 5' },
  { level: 3, runMin: 4, walkMin: 2, sets: 5, approxKm: 2.9, label: '뛰기 4분 / 걷기 2분 × 5' },
  { level: 4, runMin: 5, walkMin: 2, sets: 5, approxKm: 3.4, label: '뛰기 5분 / 걷기 2분 × 5' },
  { level: 5, runMin: 6, walkMin: 2, sets: 5, approxKm: 3.9, label: '뛰기 6분 / 걷기 2분 × 5' },
  { level: 6, runMin: 8, walkMin: 2, sets: 4, approxKm: 4.2, label: '뛰기 8분 / 걷기 2분 × 4' },
  { level: 7, runMin: 10, walkMin: 2, sets: 3, approxKm: 4.5, label: '뛰기 10분 / 걷기 2분 × 3' },
  { level: 8, runMin: 0, walkMin: 0, sets: 1, approxKm: 5.0, label: '연속 러닝 5.0km' },
  { level: 9, runMin: 0, walkMin: 0, sets: 1, approxKm: 5.5, label: '연속 러닝 5.5km' },
  { level: 10, runMin: 0, walkMin: 0, sets: 1, approxKm: 6.1, label: '연속 러닝 6.1km' },
];

export const RUN_RULES = [
  '평지만 — 내리막 피하기',
  '보폭 줄이고 걸음 자주 (케이던스 +5~10%)',
  '통증 2/10 넘으면 즉시 종료',
];

export const TIER_LABELS = {
  essential: '필수',
  recommended: '권장',
  recovery: '회복',
};

export const CONTEXT_LABELS = {
  subway: '지하철',
  desk: '데스크',
  lunch: '점심',
  home: '집',
  outdoor: '바깥',
};
