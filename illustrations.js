// 운동 동작 일러스트. 운동당 3장으로 시작 → 중간 → 끝 자세를 보여준다.
//
// 사진 대신 SVG인 이유: 라이선스 문제가 없고, 용량이 작아 오프라인에서 그대로
// 뜨고, 사진으로는 못 하는 것 — 움직임 방향 화살표와 "여기가 타야 함" 표시 —
// 를 그림 위에 직접 올릴 수 있다.
//
// 도형 체계 (전부 CSS 변수라 다크모드에서 같이 뒤집힌다):
//   .fig 가까운 쪽 몸   .fig2 작용하는 쪽 팔다리   .arm 팔
//   .jt  관절 점        .hl   작용 근육            .arw 움직임 방향
//   .flr 바닥           .bad  잘못된 자세          .guide 기준선

const S = (body) =>
  `<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" class="ill">
     <defs>
       <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
         <path d="M0 0 L10 5 L0 10 z" class="arwfill"/>
       </marker>
     </defs>${body}</svg>`;

const floor = '<line x1="12" y1="116" x2="188" y2="116" class="flr"/>';
// 관절 점 — 꺾이는 곳을 찍어주면 자세가 훨씬 빨리 읽힌다.
const jt = (...pts) => pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.6" class="jt"/>`).join('');
const head = (x, y) => `<circle cx="${x}" cy="${y}" r="11" class="fig fill"/>`;
const note = (x, y, t, bad) =>
  `<text x="${x}" y="${y}" class="lbl${bad ? ' bad-t' : ''}" text-anchor="middle">${t}</text>`;

export const ILLUSTRATIONS = {
  // 옆으로 누운 자세. 머리 왼쪽, 발 오른쪽.
  clamshell: [
    { caption: '옆으로 누워 무릎을 90도로 굽힙니다. 아래 팔로 머리를 받치세요.',
      svg: S(`${floor}
        ${head(30, 56)}
        <path d="M41 62 L96 80" class="fig"/>
        <path d="M34 68 L44 86 L62 80" class="arm"/>
        <path d="M96 80 L152 86" class="figdim"/>
        <path d="M152 86 L140 114" class="figdim"/>
        <path d="M96 80 L150 74" class="fig2"/>
        <path d="M150 74 L139 102" class="fig2"/>
        ${jt([96, 80], [152, 86], [150, 74])}
        ${note(128, 36, '무릎 90도 · 발 붙이기')}
        <path d="M136 42 L146 66" class="lead"/>`) },
    { caption: '발은 붙인 채 위쪽 무릎만 천천히 엽니다.',
      svg: S(`${floor}
        ${head(30, 56)}
        <path d="M41 62 L96 80" class="fig"/>
        <path d="M34 68 L44 86 L62 80" class="arm"/>
        <path d="M96 80 L152 86" class="figdim"/>
        <path d="M152 86 L140 114" class="figdim"/>
        <path d="M96 80 L142 44" class="fig2"/>
        <path d="M142 44 L146 76" class="fig2"/>
        ${jt([96, 80], [152, 86], [142, 44])}
        <circle cx="99" cy="78" r="17" class="hl"/>
        <path d="M164 88 Q176 68 166 50" class="arw" marker-end="url(#ah)"/>
        ${note(56, 32, '발뒤꿈치는 붙인 채로')}
        <path d="M74 38 L136 92" class="lead"/>`) },
    { caption: '엉덩이 옆이 타면 맞습니다. 골반이 뒤로 넘어가면 거기서 멈추세요.',
      svg: S(`${floor}
        ${head(30, 56)}
        <path d="M41 62 L96 80" class="fig"/>
        <path d="M34 68 L44 86 L62 80" class="arm"/>
        <path d="M96 80 L152 86" class="figdim"/>
        <path d="M152 86 L140 114" class="figdim"/>
        <path d="M96 80 L142 44" class="fig2"/>
        <path d="M142 44 L146 76" class="fig2"/>
        ${jt([96, 80], [152, 86], [142, 44])}
        <circle cx="99" cy="78" r="17" class="hl"/>
        ${note(58, 34, '여기가 타야 합니다')}
        <path d="M66 40 L94 66" class="lead"/>`) },
  ],

  // 누워서 엉덩이 들기. 머리 왼쪽.
  bridge: [
    { caption: '무릎을 세우고 누워 발을 골반 너비로 둡니다.',
      svg: S(`${floor}
        ${head(32, 102)}
        <path d="M43 106 L112 108" class="fig"/>
        <path d="M48 108 L72 114" class="arm"/>
        <path d="M112 108 L146 82 L152 114" class="fig2"/>
        ${jt([112, 108], [146, 82])}`) },
    { caption: '엉덩이를 조이며 천천히 들어 올립니다.',
      svg: S(`${floor}
        ${head(32, 102)}
        <path d="M43 104 L108 88" class="fig"/>
        <path d="M48 106 L72 114" class="arm"/>
        <path d="M108 88 L146 78 L152 114" class="fig2"/>
        ${jt([108, 88], [146, 78])}
        <circle cx="106" cy="90" r="15" class="hl"/>
        <path d="M100 68 Q104 54 100 42" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '어깨-골반-무릎이 대각선이 되면 1초 멈춥니다.',
      svg: S(`${floor}
        ${head(32, 102)}
        <path d="M43 102 L104 80" class="fig"/>
        <path d="M48 104 L72 114" class="arm"/>
        <path d="M104 80 L146 74 L152 114" class="fig2"/>
        ${jt([104, 80], [146, 74])}
        <line x1="38" y1="104" x2="148" y2="74" class="guide"/>
        <circle cx="104" cy="82" r="15" class="hl"/>
        ${note(92, 40, '허리가 아니라 엉덩이로')}`) },
  ],

  // 서서 옆으로 걷기. 정면.
  'band-side': [
    { caption: '밴드를 무릎 위에 걸고 무릎을 살짝 굽힙니다.',
      svg: S(`${floor}
        ${head(100, 28)}
        <path d="M100 39 L100 70" class="fig"/>
        <path d="M100 46 L80 64" class="arm"/>
        <path d="M100 46 L120 64" class="arm"/>
        <path d="M100 70 L88 92 L86 116" class="fig"/>
        <path d="M100 70 L112 92 L114 116" class="fig"/>
        <path d="M86 92 Q100 100 114 92" class="band"/>
        ${jt([100, 70], [88, 92], [112, 92])}`) },
    { caption: '골반 높이를 유지한 채 옆으로 한 걸음.',
      svg: S(`${floor}
        ${head(96, 28)}
        <path d="M96 39 L96 70" class="fig"/>
        <path d="M96 46 L76 64" class="arm"/>
        <path d="M96 46 L116 64" class="arm"/>
        <path d="M96 70 L70 94 L64 116" class="fig2"/>
        <path d="M96 70 L120 94 L124 116" class="fig"/>
        <path d="M66 96 Q96 108 122 96" class="band"/>
        ${jt([96, 70], [70, 94], [120, 94])}
        <circle cx="96" cy="72" r="15" class="hl"/>
        <path d="M58 54 L30 54" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '발을 모을 때도 밴드 장력을 풀지 마세요.',
      svg: S(`${floor}
        ${head(84, 28)}
        <path d="M84 39 L84 70" class="fig"/>
        <path d="M84 46 L64 64" class="arm"/>
        <path d="M84 46 L104 64" class="arm"/>
        <path d="M84 70 L72 94 L70 116" class="fig"/>
        <path d="M84 70 L98 94 L100 116" class="fig"/>
        <path d="M70 96 Q84 102 100 96" class="band"/>
        ${jt([84, 70], [72, 94], [98, 94])}
        ${note(142, 92, '장력 유지')}`) },
  ],

  'side-plank': [
    { caption: '팔꿈치를 어깨 아래 두고 옆으로 눕습니다.',
      svg: S(`${floor}
        ${head(40, 86)}
        <path d="M51 90 L158 108" class="fig"/>
        <path d="M54 92 L50 114" class="arm"/>
        ${jt([54, 92])}`) },
    { caption: '골반을 들어 머리-골반-발을 일직선으로.',
      svg: S(`${floor}
        ${head(40, 62)}
        <path d="M51 68 L162 110" class="fig"/>
        <path d="M54 70 L48 114" class="arm"/>
        ${jt([54, 70], [106, 89])}
        <circle cx="106" cy="89" r="15" class="hl"/>
        <path d="M104 106 Q108 92 104 78" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '골반이 처지기 시작하면 그 지점이 오늘의 한계입니다.',
      svg: S(`${floor}
        ${head(40, 62)}
        <path d="M51 68 L162 110" class="guide"/>
        <path d="M53 70 Q104 110 160 110" class="bad"/>
        <path d="M54 72 L48 114" class="arm"/>
        ${note(118, 46, '이렇게 처지면 중단', true)}`) },
  ],

  'step-down': [
    { caption: '낮은 단에 한 발로 섭니다.',
      svg: S(`${floor}
        <rect x="108" y="88" width="70" height="28" rx="4" class="box"/>
        ${head(130, 26)}
        <path d="M130 37 L130 66" class="fig"/>
        <path d="M130 44 L112 60" class="arm"/>
        <path d="M130 66 L130 88" class="fig"/>
        <path d="M130 66 L112 80" class="fig2"/>
        ${jt([130, 66])}`) },
    { caption: '무릎이 안쪽으로 말리지 않게 천천히 내려갑니다.',
      svg: S(`${floor}
        <rect x="108" y="88" width="70" height="28" rx="4" class="box"/>
        ${head(130, 34)}
        <path d="M130 45 L133 72" class="fig"/>
        <path d="M130 52 L110 66" class="arm"/>
        <path d="M133 72 L128 88" class="fig"/>
        <path d="M133 72 L96 104" class="fig2"/>
        ${jt([133, 72])}
        <circle cx="132" cy="72" r="14" class="hl"/>
        <path d="M80 74 L80 104" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '무릎이 안으로 무너지면 단을 더 낮추세요.',
      svg: S(`${floor}
        <rect x="108" y="88" width="70" height="28" rx="4" class="box"/>
        ${head(130, 34)}
        <path d="M130 45 L133 72" class="fig"/>
        <path d="M133 72 L114 88" class="bad"/>
        <line x1="133" y1="72" x2="130" y2="88" class="guide"/>
        ${jt([133, 72])}
        ${note(70, 58, '무릎 안쪽 무너짐', true)}
        <path d="M84 64 L118 78" class="lead"/>`) },
  ],

  deadbug: [
    { caption: '누워서 무릎과 고관절을 90도로 들어 올립니다.',
      svg: S(`${floor}
        ${head(36, 100)}
        <path d="M47 104 L124 106" class="fig"/>
        <path d="M100 106 L100 74 L130 72" class="fig"/>
        <path d="M124 106 L124 70 L152 68" class="fig2"/>
        <path d="M56 102 L56 70" class="arm"/>
        ${jt([100, 106], [100, 74], [124, 106], [124, 70])}`) },
    { caption: '허리를 바닥에 붙인 채 반대쪽 팔과 다리를 뻗습니다.',
      svg: S(`${floor}
        ${head(36, 100)}
        <path d="M47 104 L124 106" class="fig"/>
        <path d="M100 106 L100 74 L130 72" class="fig"/>
        <path d="M124 106 L170 96" class="fig2"/>
        <path d="M56 100 L20 84" class="arm2"/>
        ${jt([100, 106], [124, 106])}
        <circle cx="86" cy="104" r="15" class="hl"/>
        <path d="M146 64 L172 82" class="arw" marker-end="url(#ah)"/>
        <path d="M46 70 L22 60" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '허리가 뜨기 직전까지만. 뜨면 덜 뻗으세요.',
      svg: S(`${floor}
        ${head(36, 100)}
        <path d="M47 104 L124 106" class="guide"/>
        <path d="M50 98 Q86 84 120 100" class="bad"/>
        ${note(88, 60, '허리가 뜨면 너무 뻗은 것', true)}
        <path d="M88 66 L86 86" class="lead"/>`) },
  ],

  birddog: [
    { caption: '손은 어깨 아래, 무릎은 골반 아래. 네발 자세.',
      svg: S(`${floor}
        ${head(48, 52)}
        <path d="M59 58 L138 60" class="fig"/>
        <path d="M64 62 L62 116" class="arm"/>
        <path d="M134 62 L136 116" class="fig"/>
        ${jt([64, 62], [134, 62])}`) },
    { caption: '반대쪽 팔과 다리를 바닥과 나란하게 뻗습니다.',
      svg: S(`${floor}
        ${head(48, 52)}
        <path d="M59 58 L138 60" class="fig"/>
        <path d="M134 62 L136 116" class="fig"/>
        <path d="M62 58 L18 50" class="arm2"/>
        <path d="M138 62 L184 70" class="fig2"/>
        ${jt([62, 58], [138, 62])}
        <line x1="14" y1="49" x2="188" y2="70" class="guide"/>
        <circle cx="136" cy="62" r="15" class="hl"/>`) },
    { caption: '허리 위에 물컵을 올렸다 생각하고 골반을 고정합니다.',
      svg: S(`${floor}
        ${head(48, 52)}
        <path d="M59 58 L138 60" class="fig"/>
        <path d="M134 62 L136 116" class="fig"/>
        <path d="M62 58 L18 50" class="arm2"/>
        <path d="M138 62 L184 70" class="fig2"/>
        ${jt([62, 58], [138, 62])}
        <rect x="90" y="40" width="18" height="15" rx="2" class="box"/>
        ${note(99, 30, '수평 유지')}`) },
  ],

  plank: [
    { caption: '팔꿈치를 어깨 아래 두고 엎드립니다.',
      svg: S(`${floor}
        ${head(36, 80)}
        <path d="M47 84 L158 110" class="fig"/>
        <path d="M50 86 L46 116" class="arm"/>
        ${jt([50, 86])}`) },
    { caption: '엉덩이를 조여 머리-골반-발꿈치를 일직선으로.',
      svg: S(`${floor}
        ${head(36, 72)}
        <path d="M47 76 L162 108" class="fig"/>
        <path d="M50 78 L46 116" class="arm"/>
        ${jt([50, 78], [108, 94])}
        <line x1="30" y1="70" x2="172" y2="110" class="guide"/>
        <circle cx="108" cy="94" r="15" class="hl"/>`) },
    { caption: '엉덩이가 솟거나 처지면 내려오세요.',
      svg: S(`${floor}
        ${head(36, 72)}
        <path d="M47 76 Q104 52 158 108" class="bad"/>
        <path d="M50 78 L46 116" class="arm"/>
        <line x1="30" y1="70" x2="172" y2="110" class="guide"/>
        ${note(112, 44, '솟거나 처지면 중단', true)}`) },
  ],

  foam: [
    { caption: '종아리를 롤러 위에 올리고 천천히 굴립니다.',
      svg: S(`${floor}
        ${head(30, 86)}
        <path d="M41 90 L100 98" class="fig"/>
        <path d="M46 92 L68 110" class="arm"/>
        <path d="M100 98 L146 104" class="fig2"/>
        <ellipse cx="150" cy="106" rx="15" ry="10" class="roller"/>
        ${jt([100, 98])}
        <path d="M118 66 L158 66" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '아픈 지점을 만나면 숨을 참지 말고 짧게 멈춥니다.',
      svg: S(`${floor}
        ${head(30, 86)}
        <path d="M41 90 L100 98" class="fig"/>
        <path d="M46 92 L68 110" class="arm"/>
        <path d="M100 98 L146 104" class="fig2"/>
        <ellipse cx="122" cy="106" rx="15" ry="10" class="roller"/>
        <circle cx="122" cy="100" r="14" class="hl"/>
        ${jt([100, 98])}
        ${note(112, 52, '한 부위 30~60초')}`) },
    { caption: 'IT밴드 뼈 위를 세게 오래 누르지 마세요.',
      svg: S(`${floor}
        ${head(30, 86)}
        <path d="M41 90 L100 98" class="fig"/>
        <path d="M100 98 L146 104" class="fig"/>
        <ellipse cx="82" cy="104" rx="15" ry="10" class="roller bad-s"/>
        ${note(86, 48, '허벅지 바깥 뼈 위는 피하기', true)}
        <path d="M86 54 L84 92" class="lead"/>`) },
  ],

  hipflexor: [
    { caption: '런지 자세에서 뒤쪽 무릎을 바닥에 둡니다.',
      svg: S(`${floor}
        ${head(108, 28)}
        <path d="M108 39 L108 72" class="fig"/>
        <path d="M108 48 L124 64" class="arm"/>
        <path d="M108 72 L144 88 L144 116" class="fig"/>
        <path d="M108 72 L74 108 L50 114" class="fig2"/>
        ${jt([108, 72], [144, 88], [74, 108])}`) },
    { caption: '엉덩이를 조이며 골반을 앞으로 밉니다.',
      svg: S(`${floor}
        ${head(118, 26)}
        <path d="M118 37 L120 72" class="fig"/>
        <path d="M118 46 L134 62" class="arm"/>
        <path d="M120 72 L152 90 L152 116" class="fig"/>
        <path d="M120 72 L82 108 L56 114" class="fig2"/>
        ${jt([120, 72], [152, 90], [82, 108])}
        <circle cx="100" cy="92" r="15" class="hl"/>
        <path d="M134 50 L164 50" class="arw" marker-end="url(#ah)"/>`) },
    { caption: '허리를 젖혀 늘린 척하지 마세요. 엉덩이를 조이면 정확해집니다.',
      svg: S(`${floor}
        ${head(118, 26)}
        <path d="M118 37 Q106 56 124 76" class="bad"/>
        <path d="M124 76 L154 92 L154 116" class="fig"/>
        <path d="M124 76 L84 108 L58 114" class="fig2"/>
        ${jt([124, 76])}
        ${note(56, 48, '허리 젖히기 금지', true)}`) },
  ],
};
