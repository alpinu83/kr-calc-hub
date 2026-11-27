# [OUT-261127-ZKWI] 연말정산 키워드 10종 · 부족 요소 3가지 반영 구현 설계서

- 작성: Aside (외주 OUT-261127-ZKWI) · 2026-11-27 KST
- 기준: `alpinu83/kr-calc-hub@main` 최신 커밋 `2a0a511` (PR #7 머지, 2026-11-27 16:34 KST) 파일을 직접 받아 줄 번호까지 확인
- 이 문서는 **설계서**입니다. 이번 PR은 이 문서 1개만 추가하며 빌드·배포 결과는 바뀌지 않습니다. 실제 코드 수정은 후속 업무(tsk_c75c6472, AGY)가 이 설계를 따라 진행합니다.

## 0. 목표 기준 요약

| 항목 | 내용 |
|---|---|
| 프로젝트 지표 | 서치콘솔 28일 검색 클릭 1회 → 300회 (기한 2027-01-15) |
| 이번 마일스톤 완료 기준 | 연말정산 핵심 키워드 10종이 각 페이지 메타 태그 및 본문에 반영되어 배포 완료 |
| 남은 차이 | 아래 3장 실측 결과, 10종 중 **title에 키워드 구문이 그대로 들어간 페이지 0개**, 단어가 모두 들어간 페이지 1개(/couple-tax/) |
| 병목 1 | 검색어와 페이지 제목·설명 문구가 어긋남 (예: "미리보기", "환급금", "소득공제", "세액공제 체크리스트", "교육비"가 해당 페이지 title에 없음) |
| 병목 2 | 경쟁 계산기에 있는 시즌 정보(D-day 일정표, 개정 비교표·법령 근거, 총급여 구간별 안내)가 없음 |
| 이번 단계에서 움직일 지표 | 배포 후 서치콘솔 "검색어" 보고서에서 아래 10종 관련 검색어의 노출 수 (배포 전 값과 비교, 배포 7일 뒤 1차 확인) |

---

## 1. 실제 파일에서 확인한 사실 (근거)

| 파일 | 크기 | 확인 내용 |
|---|---|---|
| `scripts/build.js` | 3,310줄 | 13줄에서 `data/tax-tips-2026.json`을 `TAX_TIPS`로 읽음. 202줄 `renderCompareTable`(셀 값을 escapeHtml 처리), 259줄 `renderTaxTipsSection(key)`(`TAX_TIPS.categories[key]`만 읽음), 301줄 `renderLayout`(411줄 `<title>`, 412줄 `meta description`, 317~353줄 JSON-LD·FAQPage 생성), 3283~3300줄 `buildExtendedPages(ctx)` 호출 |
| `scripts/build-ext.js` | 2,576줄 | 24줄 `buildYearEndTaxPages()`. 126~139줄 연말정산 FAQ, 147줄 `grossPresets`(3000~10000), 148~155줄 `topicPages`(6종), 156~171줄 `topicMatrixLinks`/`matrixLinks`, **173~202줄 /year-end-tax/ 메타·본문**, 225~391줄 `topicSpecs`(checklist·card-deduction·pension-irp·monthly-rent·child-credit·medical-deduction의 title·description·h1·sub·table·faqs), 393~431줄 주제 페이지 생성, 433~490줄 연봉별 페이지 생성, 494줄 `buildCoupleTaxPage`(616~625줄 /couple-tax/ 메타·h1), 699줄 `buildBusinessTaxPages`(824~833줄 /business-tax/ 메타·h1) |
| `data/tax-tips-2026.json` | 43KB | 최상위 키 `updatedAt`, `categories`(20개 분야 × 팁 4개). `categories.yearEndTax` 팁 4개(연금저축·IRP 900만, 고향사랑기부 10만, 간소화 누락 주의, 2026 확대 항목) |
| `src/app-ext.js` | 707줄 | 11~85줄 `initYearEndTax()`: `ye-*` 입력 → `Calc.calcYearEndTax` → 결과 표시. 메타 태그는 다루지 않음 |
| `src/app.js` | 1,025줄 | 공통 UI(입력·공유·이미지 저장)와 연봉·프리랜서 등 기본 계산기 초기화. **메타 태그 생성 코드 없음** (메타는 빌드 스크립트에서 생성) |
| `src/calculators-ext.js` | 참고 | 91줄 `calcYearEndTax`: 카드 기본한도 300만/250만(총급여 7,000만 기준, 142줄), 연금 공제율 15%/12%(5,500만 기준, 150줄), 월세 17%/15%·8,000만 초과 제외(155~157줄), 의료비 총급여 3% 문턱(159줄), **교육비는 15% 단순 적용·1인당 한도 없음(161줄)** |
| `scripts/verify-dist.js` | 참고 | 필수 파일 목록, **모든 페이지 title·description 중복 금지**, h1 필수, 내부 링크 깨짐 금지, HTML 280개 이상 |
| `.github/workflows/deploy.yml` | 참고 | main push와 **매월 1일**에만 빌드·배포 → 빌드 시점에 D-day 숫자를 박으면 한 달 내내 틀린 숫자가 남음 |

라이브 사이트(https://korea-tax-cal.com) 2026-11-27 20시 확인: /year-end-tax/ title = "2026 연말정산 환급액 계산기 (카드·연금저축·월세·자녀공제) · 세금계산기"로 저장소 177줄과 같음 → **저장소 main = 라이브**. sitemap URL 284개, 그중 year-end-tax 17개.

> 정정: 이전 팀 보고의 "우리 사이트 /year-end-tax/는 월세·연금IRP 2종 중심"은 사실과 다릅니다. 실제로는 주제 페이지 6종 + 연봉별 페이지 10종이 이미 있습니다. 또 `scripts/build-ext.js`는 실제로 있는 파일입니다.

---

## 2. 키워드 10종 (출처)

CEO Hub 업무 tsk_58a9f0cc("연말정산 핵심 키워드 10종 선정 및 메타데이터 기획", 11/26)의 목록을 그대로 씁니다. 검색량 수치는 확인되지 않았습니다(미확인). Manus Cue가 다른 목록을 확정하면 **5장의 `yearEndSeo.keywords` 데이터만 바꾸면** 되도록 설계했습니다.

| # | 키워드 | 반영 대상 페이지 |
|---|---|---|
| K1 | 연말정산 미리보기 | /year-end-tax/ |
| K2 | 연말정산 환급금 조회 | /year-end-tax/ |
| K3 | 연말정산 공제 항목 | /year-end-tax/ |
| K4 | 맞벌이 연말정산 절세 | /couple-tax/ |
| K5 | 연말정산 소득공제 계산 | /year-end-tax/card-deduction/ |
| K6 | 연말정산 세액공제 체크리스트 | /year-end-tax/checklist/ |
| K7 | 연말정산 퇴직연금 환급 | /year-end-tax/pension-irp/ |
| K8 | 연말정산 의료비 공제 | /year-end-tax/medical-deduction/ |
| K9 | 연말정산 교육비 공제 | **신규** /year-end-tax/education-deduction/ |
| K10 | 연말정산 프리랜서 소득공제 | /freelancer/, /business-tax/ (FAQ·본문만, 아래 주의 참고) |

---

## 3. 현재 반영 상태 실측 (라이브 HTML, 2026-11-27)

"완전일치" = 키워드 구문 그대로 있음, "단어모두" = 단어는 다 있지만 떨어져 있음, 괄호 = 빠진 단어.

| # | 대상 | title | description | h1 | 본문 |
|---|---|---|---|---|---|
| K1 | /year-end-tax/ | 없음(미리보기) | 없음(미리보기) | 없음(미리보기) | 단어모두 |
| K2 | /year-end-tax/ | 없음(환급금, 조회) | 없음(환급금, 조회) | 없음 | 없음(환급금) |
| K3 | /year-end-tax/ | 없음(항목) | 없음(항목) | 없음 | 단어모두 |
| K4 | /couple-tax/ | 단어모두 | 없음 | 단어모두 | 단어모두 |
| K5 | card-deduction | 없음(소득공제) | 없음 | 없음 | 단어모두 |
| K6 | checklist | 없음(세액공제) | 없음 | 없음(세액공제) | 단어모두 |
| K7 | pension-irp | 없음(연말정산, 퇴직연금) | 없음 | 없음 | 없음(퇴직연금) |
| K8 | medical-deduction | 없음(연말정산) | 없음(연말정산) | 없음(연말정산) | 단어모두 |
| K9 | (페이지 없음) | - | - | - | - |
| K10 | /business-tax/ | 없음 | 없음 | 없음 | 단어모두 |

---

## 4. 키워드별 반영 위치 (파일·줄·필드·바꿀 문구)

원칙: 페이지마다 **주 키워드 1개 + 보조 1개**만 넣습니다. 공통 템플릿(`build.js` 411~412줄)에 키워드를 일괄로 붙이면 280개 페이지 description이 비슷해지고 스팸처럼 보이므로 **하지 않습니다**. `verify-dist.js`의 title·description 중복 금지 규칙도 그대로 지켜야 합니다.

### K1·K2·K3 → `/year-end-tax/` (build-ext.js 173~202줄)
| 필드 | 위치 | 현재 | 변경안 |
|---|---|---|---|
| title | 177줄 | `${DATA.year} 연말정산 환급액 계산기 (카드·연금저축·월세·자녀공제)` | `${DATA.year} 연말정산 미리보기 · 환급금 계산기 (카드·연금저축·월세·자녀공제)` |
| description | 178줄 | 총급여, 부양가족, … 예상 환급액을 계산합니다. | `2026년 귀속 연말정산 미리보기. 총급여와 카드·연금저축·IRP·월세·의료비·교육비 등 연말정산 공제 항목을 넣으면 예상 연말정산 환급금을 바로 계산합니다. 홈택스 환급금 조회 전에 먼저 확인하세요.` |
| h1 | 186줄 | `${DATA.year} 연말정산 환급액 계산기` | `${DATA.year} 연말정산 미리보기 · 환급액 계산기` |
| 본문 H2 | 158줄 (topicMatrixLinks 제목) | 공제 항목별 연말정산 핵심 가이드 | **연말정산 공제 항목**별 핵심 가이드 (K3) |
| FAQ 추가 | 126~139줄 `faqs` 배열 | - | Q "연말정산 환급금 조회는 어디서 하나요?" A "확정 환급금은 회사 정산 후 원천징수영수증 또는 홈택스에서 확인합니다. 이 계산기는 그 전에 예상 금액을 미리 보는 용도입니다." (K2, 사실과 추정 구분) |

※ "조회"는 홈택스 기능이므로 title에 "조회"를 넣지 않고 description·FAQ에만 넣습니다(사용자 오해 방지).
※ `faqs`는 연봉별 페이지(471줄)에도 같이 쓰이므로 FAQ 1개 추가가 10개 페이지 FAQPage JSON-LD에 함께 반영됩니다(의도된 동작).

### K4 → `/couple-tax/` (build-ext.js 612~625줄)
| 필드 | 위치 | 변경안 |
|---|---|---|
| description | 617줄 | 앞에 `맞벌이 연말정산 절세 계산기.` 한 문장 추가 (title·h1은 이미 단어 모두 포함이라 유지) |

### K5 → `card-deduction` (topicSpecs 255~281줄)
| 필드 | 위치 | 변경안 |
|---|---|---|
| title | 257줄 | `2026 연말정산 카드 소득공제 계산 (신용·체크 25% 황금비율·자녀 추가한도)` |
| h1 | 259줄 | `2026 연말정산 카드 소득공제 계산 · 25% 황금비율` |
| description | 258줄 | 맨 앞에 `연말정산 소득공제 계산:` 추가 |

### K6 → `checklist` (topicSpecs 226~254줄)
| 필드 | 위치 | 변경안 |
|---|---|---|
| title | 228줄 | `2026 연말정산 세액공제 체크리스트 (12월 막판 절세·공제별 최대 환급액)` |
| h1 | 230줄 | `2026 연말정산 세액공제 체크리스트 · 12월 막판 절세` |
| 본문 | 233줄 표 아래 | **D-day 일정표(6장 A) 삽입** — 체크리스트 페이지와 시즌 일정이 가장 잘 맞음 |

### K7 → `pension-irp` (topicSpecs 282~308줄)
| 필드 | 위치 | 변경안 |
|---|---|---|
| title | 284줄 | `2026 연말정산 연금저축·IRP(퇴직연금) 세액공제 계산기 (600만·900만 최대 환급)` |
| h1 | 286줄 | `2026 연말정산 연금저축·IRP(퇴직연금) 세액공제 환급액` |
| FAQ 추가 | 304~307줄 | Q "회사 퇴직연금(DC·IRP)에 내가 더 넣은 돈도 연말정산 환급을 받나요?" — 답변은 **소득세법 제59조의3(연금계좌세액공제) 원문 확인 후** 작성 (현재 미확인) |
| topicPages 라벨 | 151줄 | `연금저축·IRP(퇴직연금) 최대 환급액` |

### K8 → `medical-deduction` (topicSpecs 363~390줄)
| 필드 | 위치 | 변경안 |
|---|---|---|
| title | 365줄 | `2026 연말정산 의료비 공제 계산기 (총급여 3% 초과 15%·맞벌이 전략)` |
| h1 | 367줄 | `2026 연말정산 의료비 공제 계산 및 절세 전략` |

### K9 → 신규 `/year-end-tax/education-deduction/`
| 위치 | 변경 |
|---|---|
| build-ext.js 148~155줄 `topicPages` | `{ slug: "education-deduction", label: "교육비 세액공제 (15%)" }` 추가 (medical-deduction 다음, 이전/다음 링크 자동 연결) |
| build-ext.js 225~391줄 `topicSpecs` | 같은 순서로 항목 추가: title `2026 연말정산 교육비 공제 계산기 (본인·자녀 교육비 15%)`, h1 `2026 연말정산 교육비 공제 환급액`, table = 연봉 5,000만 기준 교육비 0/300만/600만 비교(`Calc.calcYearEndTax({ gross: 50000000, dependents: 2, children: 1, education: … })`), FAQ 2개 |
| build-ext.js 207~223줄 | 비교표용 계산값 `edu300`, `edu600` 추가 |
| verify-dist.js requiredFiles | `"year-end-tax/education-deduction/index.html"` 추가 |

⚠ 주의: `calculators-ext.js` 161줄은 교육비에 **1인당 한도가 없습니다**(실제 세법은 대상별 한도가 있음). 이번 페이지 표는 한도 안쪽 금액만 쓰고, 표 subtitle에 "대상별 연간 한도가 있으며 계산기는 한도를 자동 적용하지 않습니다"를 적습니다. 한도 반영은 별도 계산 로직 수정 업무로 분리(`npm test` 영향 있음). 한도 금액은 소득세법 제59조의4 원문 확인 전까지 페이지에 숫자로 쓰지 않습니다.

### K10 → `/freelancer/`, `/business-tax/` (title은 바꾸지 않음)
- 대부분의 프리랜서(3.3% 사업소득자)는 연말정산이 아니라 **5월 종합소득세 신고**로 정산합니다. 예외로 보험모집인·방문판매원 등 일부 사업소득자는 사업소득 연말정산 대상입니다(소득세법 제144조의2, 원문 확인 권장).
- 그래서 "연말정산"을 프리랜서 페이지 title에 넣으면 검색 의도와 내용이 어긋납니다. **title은 유지**하고 다음만 추가합니다.
  - build-ext.js `buildBusinessTaxPages`의 FAQ 배열(699줄 함수 안)과 build.js `buildFreelancerPages`(1030줄)의 FAQ에: Q "프리랜서도 연말정산 소득공제를 받나요?" A "3.3% 프리랜서는 보통 연말정산 대신 5월 종합소득세 신고로 정산하며, 노란우산공제·연금저축 등은 그때 공제받습니다. 보험설계사 등 일부 직종은 회사에서 사업소득 연말정산을 합니다."
- 팀장 판단 필요: K10을 "프리랜서 3.3% 환급" 같은 실제 의도에 맞는 키워드로 바꾸는 것을 권장합니다.

---

## 5. 키워드 데이터화 + 자동 검증 (완료 기준을 기계로 확인)

### 5-1. `data/tax-tips-2026.json`에 최상위 키 추가
`renderTaxTipsSection`과 /tips/ 페이지(build.js 2824줄)는 `categories`만 읽으므로 최상위에 새 키를 추가해도 기존 출력은 바뀌지 않습니다.

```json
"yearEndSeo": {
  "source": "CEO Hub tsk_58a9f0cc (2026-11-26)",
  "keywords": [
    { "id": "K1", "keyword": "연말정산 미리보기", "route": "/year-end-tax/", "mustIn": ["title", "description", "h1"] },
    { "id": "K2", "keyword": "연말정산 환급금", "route": "/year-end-tax/", "mustIn": ["description"] },
    { "id": "K3", "keyword": "연말정산 공제 항목", "route": "/year-end-tax/", "mustIn": ["description", "body"] },
    { "id": "K4", "keyword": "맞벌이 연말정산 절세", "route": "/couple-tax/", "mustIn": ["description"] },
    { "id": "K5", "keyword": "연말정산 카드 소득공제 계산", "route": "/year-end-tax/card-deduction/", "mustIn": ["title", "h1"] },
    { "id": "K6", "keyword": "연말정산 세액공제 체크리스트", "route": "/year-end-tax/checklist/", "mustIn": ["title", "h1"] },
    { "id": "K7", "keyword": "퇴직연금", "route": "/year-end-tax/pension-irp/", "mustIn": ["title", "h1"] },
    { "id": "K8", "keyword": "연말정산 의료비 공제", "route": "/year-end-tax/medical-deduction/", "mustIn": ["title", "h1"] },
    { "id": "K9", "keyword": "연말정산 교육비 공제", "route": "/year-end-tax/education-deduction/", "mustIn": ["title", "h1"] },
    { "id": "K10", "keyword": "프리랜서도 연말정산", "route": "/business-tax/", "mustIn": ["body"] }
  ]
}
```

### 5-2. `scripts/verify-dist.js`에 검사 추가 (`verify()` 끝, sitemap 검사 앞)
- `data/tax-tips-2026.json`을 읽어 `yearEndSeo.keywords`를 돌며 `resolveDistTarget(route)`로 HTML을 열고, `mustIn`의 각 필드(title = `<title>`, description = meta description, h1 = 첫 `<h1>`, body = 태그 제거한 `<body>`)에 `keyword` 문자열이 있는지 `assert`.
- 이렇게 하면 "10종 반영"이 CI에서 자동 확인되고, 나중에 누가 제목을 바꿔 키워드가 빠지면 배포 전에 막힙니다.
- 문구를 바꿀 때는 4장 변경안과 이 표의 `keyword`가 정확히 같아야 합니다.

---

## 6. 경쟁사 대비 부족 요소 3가지 구현 설계

### A. 시즌 D-day 일정표

**데이터** — `data/tax-tips-2026.json` 최상위 `yearEndSchedule`:
```json
"yearEndSchedule": {
  "season": "2026년 귀속 연말정산",
  "checkedAt": "YYYY-MM-DD",
  "items": [
    { "id": "pension-deadline", "label": "연금저축·IRP 납입, 기부, 카드 사용 마감", "date": "2026-12-31", "basis": "과세기간 종료일", "status": "확정", "sourceUrl": "" },
    { "id": "simplified-open", "label": "홈택스 간소화 자료 조회 시작", "date": "", "basis": "국세청 공지", "status": "미확인", "sourceUrl": "" },
    { "id": "company-submit", "label": "회사에 공제 서류 제출", "date": "", "basis": "회사별 일정", "status": "회사별", "sourceUrl": "" },
    { "id": "february-pay", "label": "2월 급여에서 환급·추가납부 반영", "date": "", "basis": "소득세법 제137조(원문 확인)", "status": "미확인", "sourceUrl": "" },
    { "id": "statement-deadline", "label": "회사의 지급명세서 제출 기한", "date": "", "basis": "소득세법 제164조(원문 확인)", "status": "미확인", "sourceUrl": "" }
  ]
}
```
- 날짜는 **국세청 공지·법령 원문으로 확인한 것만** 채웁니다. 확인 못 한 항목은 `status: "미확인"`으로 두고 화면에 날짜 대신 "공지 예정"이라고 표시합니다. (이전 팀 보고의 "12.18 미리보기 마감"은 출처 미확인이라 그대로 쓰지 않습니다.)

**빌드** — `scripts/build.js`:
- 290줄(`renderTaxTipsSection` 끝) 다음에 `function renderYearEndSchedule()` 추가. `TAX_TIPS.yearEndSchedule`이 없으면 `""` 반환.
- `renderCompareTable`은 셀을 escape하므로 `data-` 속성을 넣을 수 없음 → 같은 클래스(`section-block`, `compare-table-wrap`, `compare-table`)를 쓰는 전용 마크업을 직접 생성 → **styles.css 수정 불필요**.
- 각 행: `<td>항목</td><td>날짜 또는 "공지 예정"</td><td class="num-col"><span class="ye-dday" data-dday="2026-12-31">12월 31일</span></td><td>근거</td>`. 날짜 없는 행은 `data-dday` 생략.
- 3283~3300줄 `buildExtendedPages({...})` 인자에 `renderYearEndSchedule` 추가.

**배치** — `scripts/build-ext.js`:
- 1~20줄 구조분해에 `renderYearEndSchedule` 추가.
- /year-end-tax/ 본문 191줄 `${renderWidget(5000)}` 바로 다음.
- checklist 주제 페이지: 393~431줄 `topicSpecs.forEach` 안 420줄 `${tp.table}` 다음에 `${tp.slug === "checklist" ? renderYearEndSchedule() : ""}`.

**D-day 숫자 (클라이언트)** — `src/app-ext.js`:
- 배포가 push·매월 1일에만 일어나므로 D-day 숫자는 브라우저에서 계산.
- 11줄 `initYearEndTax` 앞에 `function initYearEndSchedule()` 추가: `document.querySelectorAll(".ye-dday[data-dday]")` → 한국 시간 기준 오늘과의 일수 차이 → "D-12" / "D-DAY" / "지남". 파일 끝 init 호출부에 `initYearEndSchedule();` 추가.
- JS가 꺼져 있어도 날짜 텍스트는 보이므로 SEO·접근성 문제 없음.

### B. 2025 vs 2026 개정 비교표 · 법령 근거

**데이터** — `data/tax-tips-2026.json` 최상위 `yearEndChanges`:
```json
"yearEndChanges": {
  "basis": "2025년 귀속 vs 2026년 귀속",
  "items": [
    { "id": "child-credit", "item": "자녀세액공제", "y2025": "", "y2026": "", "lawKey": "income-tax", "article": "제59조의2", "sourceUrl": "", "verified": false }
  ]
}
```
- `lawKey`는 `data/law-versions.json`의 `laws` 키(예: `income-tax` = 소득세법, `tax-special` = 조세특례제한법)와 연결해 법령명·현행 시행일을 함께 표시.
- **`verified: true`인 항목만 렌더링**합니다. 확인 안 된 개정 내용이 라이브에 나가는 것을 구조적으로 막기 위함입니다.

**빌드** — `scripts/build.js`:
- 13줄 다음에 `const LAW_VERSIONS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "law-versions.json"), "utf8"));` 추가.
- `function renderYearEndChanges()` 추가: verified 항목만 모아 `renderCompareTable`(202줄)로 출력. 헤더 = 항목 / 2025년 귀속 / 2026년 귀속 / 법령 근거. 법령 근거 셀은 `{ href, label }` 객체(225줄 분기)로 `sourceUrl` 링크.
- `buildExtendedPages` 인자에 추가.

**배치** — `scripts/build-ext.js`:
- /year-end-tax/ 본문 194줄 `renderTaxTipsSection("yearEndTax")` 앞.
- child-credit 주제 페이지(420줄 위치, `tp.slug === "child-credit"`일 때).
- 131~134줄 FAQ "2026년 연말정산에서 크게 바뀐 공제는 무엇인가요?" 답변을 `yearEndChanges`의 verified 항목으로 만들기(본문 표와 FAQ 내용 불일치 방지).

**사전 검증 필요(중요)**: 현재 사이트는 자녀세액공제 25만/30만/40만을 "2026 확대 항목"(tax-tips 연말정산 팁 4, build-ext.js 132~133줄 FAQ)으로 안내합니다. 이 인상이 2025년 귀속부터 이미 적용된 것이라면 "2026 변경"이라는 표현은 틀립니다. 저는 이번에 법령 원문을 확인하지 않았으므로 **추정·미확인**입니다. 비교표 데이터를 채우기 전에 국가법령정보센터 소득세법 제59조의2 연혁으로 확인해야 합니다.

### C. 총급여 구간별 공제 안내

**빌드** — `scripts/build-ext.js` `buildYearEndTaxPages` 안, 171줄(`matrixLinks`) 다음에 `const renderGrossBracketGuide = (current) => renderCompareTable({...})` 추가.
- 행: `grossPresets`(147줄) 10개 구간. `current` 구간은 `current: true`(강조).
- 열과 계산 방법 (숫자를 직접 쓰지 않고 `Calc.calcYearEndTax` 결과로 계산 → 계산기와 표가 항상 일치):

| 열 | 계산 |
|---|---|
| 총급여 | `formatKoreanManwonLabel(m)` |
| 카드 공제 문턱(25%) | `m * 10000 * 0.25` |
| 연금저축·IRP 공제율 | `r = Calc.calcYearEndTax({ gross, dependents: 1, pensionIrp: 9000000 })` → `r.pensionCredit / 9000000` |
| 월세 세액공제율 | `Calc.calcYearEndTax({ gross, dependents: 1, monthlyRentAnnual: 10000000 }).rentCredit / 10000000` → 0이면 "대상 아님" |
| 의료비 공제 시작 금액(3%) | `m * 10000 * 0.03` |
| 예상 정산 (카드 1,800만·연금 300만) | 436줄 `mid`와 같은 입력 → `fmtRef` |

- 공제율 열은 지방소득세 포함 여부를 subtitle에 명시(`pensionCredit`은 국세 기준).
- 배치: /year-end-tax/ 본문 198줄 `${matrixLinks(null)}` 바로 앞에 `${renderGrossBracketGuide(null)}`, 연봉별 페이지 479줄 `${cmp}` 다음에 `${renderGrossBracketGuide(m)}`.
- 표 제목: "총급여 구간별 연말정산 공제 안내 (2026년 귀속)". 연봉별 페이지마다 같은 표가 반복되지만 현재 구간 강조로 차이를 두고, 페이지 title·description은 기존 그대로라 중복 검사에 걸리지 않습니다.

---

## 7. 파일별 변경 요약 (구현 담당용 체크리스트)

| 파일 | 함수·위치 | 변경 |
|---|---|---|
| `data/tax-tips-2026.json` | 최상위 | `yearEndSeo`, `yearEndSchedule`, `yearEndChanges` 추가, `updatedAt` 갱신. 기존 `categories`는 그대로 |
| `scripts/build.js` | 13줄 다음 | `LAW_VERSIONS` 로드 |
| `scripts/build.js` | 290줄 다음 | `renderYearEndSchedule()`, `renderYearEndChanges()` 추가 |
| `scripts/build.js` | 3283~3300줄 | ctx에 두 함수 추가 |
| `scripts/build-ext.js` | 3~20줄 | 구조분해에 두 함수 추가 |
| `scripts/build-ext.js` | 126~139줄 | FAQ 1개 추가(K2), 개정 FAQ를 verified 데이터 기반으로 |
| `scripts/build-ext.js` | 148~158줄 | topicPages에 education-deduction, 151줄 라벨, 158줄 H2 문구(K3) |
| `scripts/build-ext.js` | 171줄 다음 | `renderGrossBracketGuide` |
| `scripts/build-ext.js` | 177~198줄 | /year-end-tax/ title·description·h1(K1·K2), 일정표·개정표·구간표 배치 |
| `scripts/build-ext.js` | 207~391줄 | 교육비 계산값·topicSpecs 항목 추가(K9), checklist·card-deduction·pension-irp·medical-deduction title·h1·description(K5~K8), pension-irp FAQ |
| `scripts/build-ext.js` | 420줄 | 주제 페이지별 일정표·개정표 조건부 삽입 |
| `scripts/build-ext.js` | 479줄 | 연봉별 페이지에 구간표 |
| `scripts/build-ext.js` | 617줄 | /couple-tax/ description(K4) |
| `scripts/build-ext.js` | 699줄~ | /business-tax/ FAQ(K10) |
| `scripts/build.js` | 1030줄~ | /freelancer/ FAQ(K10) |
| `src/app-ext.js` | 11줄 앞 + init 호출부 | `initYearEndSchedule()` |
| `src/app.js` | - | **변경 없음** (메타 생성 코드 없음. 공통 UI라 건드리면 20개 계산기 전체 영향) |
| `scripts/verify-dist.js` | requiredFiles, verify() | education-deduction 필수 파일, 키워드 검사(5-2) |

건드리지 않는 것: `.github/`, `data/rates-2026.json`(키워드와 무관), `styles.css`(기존 클래스 재사용), `calculators-ext.js`(교육비 한도는 별도 업무).

---

## 8. 검증 절차와 완료 기준

1. `npm test` 통과 (계산 로직 미변경이므로 기존 결과 그대로여야 함)
2. `npm run build` → 페이지 수 +1 (education-deduction)
3. `npm run verify` 통과: title·description 중복 0, 내부 링크 깨짐 0, **키워드 10종 검사 통과**
4. 로컬 `dist/year-end-tax/index.html`에서 일정표·구간표가 보이고, verified 항목이 없으면 개정표가 출력되지 않는지 확인
5. PR 본문에 변경 파일·테스트 결과 기재 → 대표님 결재 후 배포
6. 배포 후(피클/Cue 실측 업무): 라이브 10개 대상 URL의 title·description·h1 인용 확인, 서치콘솔에 새 URL(education-deduction) 색인 요청은 **이미 요청한 5건과 별개로 신규 1건만**
7. 지표 확인: 배포일 기준 7일·14일 뒤 서치콘솔 검색어 보고서에서 K1~K10 관련 노출 수 (배포 전 28일 노출은 10회 수준)

## 9. 위험과 대응

| 위험 | 대응 |
|---|---|
| title 변경으로 이미 색인된 7개 URL 순위 변동 | URL·canonical은 그대로, 문구만 변경. 변경 전 title을 PR 본문에 남겨 되돌리기 쉽게 |
| 확인 안 된 날짜·개정 내용 노출 | `status`·`verified` 필드로 미확인 항목은 출력 안 함 |
| 교육비 계산 한도 미반영 | 표는 한도 안쪽 금액만, 안내 문구 명시, 한도 반영은 별도 업무 |
| 프리랜서 키워드 의도 불일치 | title 미변경, FAQ로 정확한 안내, 키워드 교체 권장 |
| D-day 숫자가 오래됨 | 브라우저 계산, 빌드 결과엔 날짜만 |

## 10. 확인한 사실 / 추정 구분
- 확인: 1장 파일·줄 번호, 3장 라이브 실측, verify-dist 규칙, 배포 주기, 계산 로직의 공제율·문턱.
- 미확인(추정): 10종 키워드의 검색량, 자녀세액공제 인상 적용 연도, 2026년 귀속 연말정산 일정 날짜, 퇴직연금 추가 납입분 공제 범위, 교육비 대상별 한도 금액, 사업소득 연말정산 대상 직종 범위.
