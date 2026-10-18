// 헤더 글리프. 새로고침할 때마다 하나가 무작위로 뜬다.
//
// 각진 디자인에 맞춰 곡선 없이 직선과 꺾임만 썼다. 색은 currentColor라
// 다크모드에서 같이 뒤집힌다. 24×24 기준, stroke-width 2.

const G = (body) =>
  `<svg viewBox="0 0 24 24" class="glyph" xmlns="http://www.w3.org/2000/svg"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="square" stroke-linejoin="miter">${body}</svg>`;

export const GLYPHS = [
  // 달리는 사람
  { id: 'runner', title: '러너', svg: G(`
    <path d="M14 3h2v2h-2z" fill="currentColor" stroke="none"/>
    <path d="M15 4v0"/>
    <path d="M13 8l-4 3 2 4-3 5"/>
    <path d="M13 8l4 2 1 4"/>
    <path d="M9 11l-4 1"/>
    <path d="M11 15l5 1 2 4"/>`) },

  // 운동화
  { id: 'shoe', title: '러닝화', svg: G(`
    <path d="M3 17V9l4 2 3-3 3 3 7 2v4z"/>
    <path d="M3 17h18"/>
    <path d="M10 11v3"/>
    <path d="M13 12v2"/>`) },

  // 스톱워치
  { id: 'watch', title: '스톱워치', svg: G(`
    <path d="M5 6h14v14H5z"/>
    <path d="M9 3h6"/>
    <path d="M12 10v4h3"/>`) },

  // 발자국
  { id: 'steps', title: '발자국', svg: G(`
    <path d="M4 4h5v7H4z"/>
    <path d="M4 13h5v3H4z"/>
    <path d="M15 8h5v7h-5z"/>
    <path d="M15 17h5v3h-5z"/>`) },

  // 심박
  { id: 'pulse', title: '심박', svg: G(`
    <path d="M2 12h4l2-6 4 12 3-8 2 2h5"/>`) },

  // 물병
  { id: 'water', title: '수분', svg: G(`
    <path d="M9 2h6v3l2 3v12H7V8l2-3z"/>
    <path d="M7 13h10"/>`) },

  // 메달
  { id: 'medal', title: '메달', svg: G(`
    <path d="M8 2l2 7"/>
    <path d="M16 2l-2 7"/>
    <path d="M7 9h10v10H7z"/>
    <path d="M11 13h2v3h-2z"/>`) },

  // 트랙
  { id: 'track', title: '트랙', svg: G(`
    <path d="M2 7h20v10H2z"/>
    <path d="M6 10h12v4H6z"/>
    <path d="M12 7v3"/>
    <path d="M12 14v3"/>`) },

  // 언덕길
  { id: 'hill', title: '언덕', svg: G(`
    <path d="M2 19l6-10 4 5 4-8 6 13z"/>
    <path d="M2 19h20"/>`) },

  // 무릎 관절
  { id: 'knee', title: '무릎', svg: G(`
    <path d="M10 2v7l5 4v9"/>
    <path d="M10 9h5"/>
    <path d="M7 11h6v5H7z"/>`) },

  // 깃발
  { id: 'flag', title: '목표', svg: G(`
    <path d="M6 2v20"/>
    <path d="M6 3h12v7H6z"/>
    <path d="M10 3v7"/>
    <path d="M14 3v7"/>`) },

  // 캘린더 체크
  { id: 'streak', title: '연속', svg: G(`
    <path d="M3 5h18v16H3z"/>
    <path d="M3 10h18"/>
    <path d="M8 2v4"/>
    <path d="M16 2v4"/>
    <path d="M8 14l3 3 5-5"/>`) },
];

// 날짜 시드가 아니라 진짜 무작위다 — 새로고침할 때마다 바뀌어야 재미가 있다.
export function randomGlyph(pool = GLYPHS) {
  if (!Array.isArray(pool) || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
