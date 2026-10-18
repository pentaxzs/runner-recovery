# RE:RUN

장경인대 증후군(ITBS) 회복을 위한 개인 트래커. 대회 카운트다운이 아니라
**통증 상태에 따라 거리를 조정하는** 방식으로 동작합니다.

프로덕션: https://runner-recovery.vercel.app

## 설계 원칙

- **평일 밤에 보이는 체크박스는 2개.** 9시에 퇴근해도 할 수 있어야 필수입니다.
- **0이 아닌 값으로 연다.** 연속 기록과 걸음 수를 먼저 보여줍니다.
- **날짜가 아니라 상태가 올린다.** 통증 없이 2회 연속이면 한 단계 위로, 통증이 나오면 아래로.
- **토요일은 비운다.** 휴식도 프로그램의 일부입니다.
- **빌드 도구 없음.** 브라우저가 소스를 그대로 읽습니다. 몇 달 뒤에도 그냥 열립니다.

## 로컬 실행

```bash
python3 -m http.server 8787 --bind 127.0.0.1
open http://localhost:8787/
```

ES 모듈을 쓰므로 `file://`로는 열리지 않습니다. HTTP 서버가 필요합니다.

## 테스트

```bash
npm test     # node --test, 의존성 0
```

순수 로직(`logic.js`)은 DOM을 참조하지 않아 Node에서 그대로 실행됩니다.

## 배포

`main`에 푸시하면 Vercel이 자동 배포합니다.

```bash
git push origin main
```

`sw.js`의 `VERSION` 상수를 올려야 오래된 캐시가 교체됩니다.

## 걸음 수 연동 (iOS 단축어)

웹 앱은 HealthKit을 직접 읽을 수 없습니다. 단축어로 우회합니다.

1. 단축어 앱 → 새 단축어
2. **건강 샘플 찾기** (*Find Health Samples*) — 유형 `걸음 수`, 필터: 시작 날짜 `오늘`, 제한 끄기
   - 이름이 비슷한 **건강 샘플 기록**은 건강 앱에 값을 *써넣는* 동작이다. 다른 것.
3. **통계 계산** — 연산 `합계`
   - 합계가 샘플을 못 받으면 앞에 **건강 샘플 세부사항 가져오기** → 세부사항 `값`
4. **URL 열기** — `https://runner-recovery.vercel.app/?steps=` + 합계 변수
5. 단축어를 **홈 화면에 추가**

합계는 `9,240`처럼 천 단위 구분자가 붙어 오는데, 파서가 걷어내고 읽는다.

홈 화면 아이콘 하나로 앱 진입과 걸음 수 입력이 동시에 됩니다.
시간 기반 자동화는 iOS가 Safari를 강제로 띄워 방해가 크므로 쓰지 않습니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` | 마크업 셸 |
| `styles.css` | 손으로 쓴 CSS (토큰 + 다크모드) |
| `data.js` | 운동 정의 / 자투리 미션 / 사다리 — 내용을 고칠 땐 여기만 |
| `logic.js` | 순수 함수 (날짜, streak, 사다리, 미션 선택, 통계, 차트 좌표) |
| `store.js` | localStorage 래퍼 (실패 시 메모리 폴백) |
| `app.js` | DOM 렌더링 + 이벤트 |
| `sw.js` | 서비스워커 (오프라인). `VERSION`을 올려야 폰에 새 코드가 간다 |
| `tests/` | `node --test` |

## 문서

- 설계: [`docs/superpowers/specs/2026-10-18-runner-recovery-rebuild-design.md`](docs/superpowers/specs/2026-10-18-runner-recovery-rebuild-design.md)
- 구현 계획: [`docs/superpowers/plans/2026-10-18-runner-recovery-rebuild.md`](docs/superpowers/plans/2026-10-18-runner-recovery-rebuild.md)

## 데이터

localStorage에만 저장됩니다 (`rr_v3_` prefix). 기기 간 동기화는 없습니다.
브라우저 데이터를 지우면 기록도 사라집니다.
