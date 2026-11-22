# 셈노트 (`kr-calc-hub`) — 2026 한국 세금·금융·근로 계산기 pSEO 허브

- **라이브 사이트**: https://alpinu83.github.io/kr-calc-hub/
- **사이트맵**: https://alpinu83.github.io/kr-calc-hub/sitemap.xml

운영비 **월 0원**(GitHub Pages + GitHub Actions)으로 유지보수를 최소화하면서, **Programmatic SEO(데이터 기반 정적 페이지 자동 생성)**로 검색 유입과 광고·제휴 수익을 얻기 위한 프로젝트입니다.

## 포함된 기능
- **9종 실시간 계산기** (100% 브라우저 클라이언트 측 계산):
  1. 연봉 실수령액 계산기 (4대보험 + 근로소득세·지방소득세)
  2. 프리랜서 3.3% 원천징수 계산기 (세전→세후 / 세후→세전 역산)
  3. 퇴직금 계산기 (계속근로기간 · 퇴직소득세 추정)
  4. 실업급여 계산기 (연령·피보험기간별 소정급여일수 · 상하한액 반영)
  5. 주휴수당 계산기 (주 15시간 이상 기준 주휴수당 · 월 환산 급여)
  6. 해외주식 양도소득세 계산기 (250만 원 기본공제 + 손익통산 + 22%)
  7. 아파트·주택 취등록세 계산기 (6억·9억 구간 · 다주택 중과 · 전용 85㎡ 농특세)
  8. 증여세 계산기 (관계별 10년 공제 한도 · 누진세율 · 자진신고 3% 공제)
  9. 전월세 전환율 계산기
- **Programmatic SEO 자동 생성 (`scripts/build.js`)**:
  - `data/rates-2026.json` 배열 기반으로 **177개 정적 SEO 페이지**(`연봉 5,000만 원 실수령액`, `성년 자녀 1억 증여세`, `6억 아파트 취등록세` 등) + 신뢰 페이지(`/about/`, `/privacy/`, `404.html`) + JSON-LD(`WebApplication`, `FAQPage`, `BreadcrumbList`) + `sitemap.xml` + `robots.txt` + `ads.txt` 자동 생성
  - `siteUrl`에서 `BASE_PATH`를 자동 추론하므로 GitHub Pages 하위 경로(`/kr-calc-hub`)와 커스텀 루트 도메인 모두 별도 코드 수정 없이 지원
- **자동 검증 및 배포**:
  - `npm test`: 9종 계산기 세율·공식 단위 테스트
  - `npm run verify`: 전체 생성 HTML의 메타 태그, JSON-LD, 내부 링크 무결성 및 사이트맵 자동 검증
  - `.github/workflows/deploy.yml`: `main` push 및 매월 1일 자동 빌드·검증·GitHub Pages 배포

## 로컬 실행
```bash
npm test       # 9종 계산기 단위 테스트
npm run build  # dist/ 정적 SEO 사이트 생성
npm run verify # SEO 메타·JSON-LD·내부 링크 무결성 검증
npm run preview
```

## 설정 가이드 (`data/rates-2026.json`)
- **도메인 변경**: `siteUrl`을 커스텀 도메인(`https://example.com`)으로 수정하면 경로 프리픽스·`canonical`·`sitemap.xml`·`robots.txt`가 자동 갱신됩니다.
- **검색엔진 인증**: `verification.googleSiteVerification`, `verification.naverSiteVerification`에 HTML 태그 `content` 값 입력
- **방문자 분석**: `analytics.ga4MeasurementId` (`G-...`), `analytics.clarityProjectId` 입력
- **수익화**: `monetization.adsensePublisherId` (`ca-pub-...`) 및 슬롯 ID 입력 시 AdSense 스크립트·슬롯·`ads.txt` 자동 활성화
