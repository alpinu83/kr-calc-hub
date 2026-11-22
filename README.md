# 셈노트 (kr-calc-hub) — 한국 세금·금융 계산기 pSEO 수익화 템플릿

운영비 **월 0원**(정적 호스팅 + GitHub Actions)으로 유지보수를 최소화하면서, **Programmatic SEO(데이터 기반 페이지 자동 생성)**로 검색 유입과 광고·제휴 수익을 얻기 위한 프로젝트입니다.

## 포함된 기능
- **5종 실시간 계산기**:
  1. 연봉 실수령액 계산기 (4대보험 + 근로소득세)
  2. 프리랜서 3.3% 원천징수 계산기 (세전→세후 / 세후→세전 역산)
  3. 해외주식 양도소득세 계산기 (250만 원 기본공제 + 손익통산 + 22%)
  4. 아파트·주택 취등록세 계산기 (6억·9억 구간 + 전용 85㎡ 농특세)
  5. 전월세 전환율 계산기
- **Programmatic SEO 자동 생성 (`scripts/build.js`)**:
  - `data/rates-2026.json`의 배열만 수정하면 **수십~수백 개의 롱테일 검색 페이지**(`연봉 5000만원 실수령액`, `해외주식 수익 1000만원 양도세`, `6억 아파트 취등록세` 등)가 사전 계산된 HTML + JSON-LD(`WebApplication`, `FAQPage`, `BreadcrumbList`) + `sitemap.xml` + `robots.txt`와 함께 자동 생성됩니다.
- **자동 검증 및 배포**:
  - `npm test`로 세금 계산 공식 단위 테스트 수행
  - `.github/workflows/deploy.yml`로 push 또는 매월 1일 자동 빌드·배포

## 로컬 실행 방법
```bash
npm test      # 계산기 단위 테스트
npm run build # dist/ 폴더에 전체 정적 SEO 페이지 + sitemap.xml 생성
npm run preview
```

## 0원 배포 & 수익화 체크리스트
1. **도메인 설정**: `data/rates-2026.json`의 `siteUrl`을 본인 도메인(또는 `https://<아이디>.github.io/<레포명>`)으로 변경합니다.
2. **무료 호스팅 연결**:
   - **Cloudflare Pages (추천)**: GitHub 레포 연결 → Build command: `npm run build` / Output directory: `dist` (무료, CDN 속도 매우 빠름)
   - **GitHub Pages**: 저장소 `Settings → Pages → Source: GitHub Actions` 선택
3. **검색엔진 등록 (트래픽 자동 유입의 핵심)**:
   - [Google Search Console](https://search.google.com/search-console)에 사이트 등록 후 `sitemap.xml` 제출
   - [네이버 서치어드바이저](https://searchadvisor.naver.com)에 사이트 등록 후 `sitemap.xml` 제출
4. **수익화 연결**:
   - **Google AdSense**: `scripts/build.js`의 `renderAdSlot()`에 AdSense 코드를 넣고 `dist/ads.txt`에 게시자 ID 반영
   - **제휴 마케팅(CPA/Affiliate)**: `data/rates-2026.json`의 `affiliates` 항목에 세무 환급 앱, 증권사/카드 제휴, 주담대 비교 제휴 링크를 입력하면 모든 관련 페이지에 자동 반영됩니다.

## 페이지 확장 팁 (트래픽 5배 늘리기)
- `data/rates-2026.json`의 `pseo` 배열에 금액 구간을 더 촘촘히 추가하거나, **퇴직금 계산기 / 실업급여 계산기 / 주휴수당 계산기 / 증여세 계산기**를 추가하면 검색 유입 키워드를 수백~수천 개로 확장할 수 있습니다.
