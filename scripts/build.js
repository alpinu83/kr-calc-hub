#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Calc = require("../src/calculators");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rates-2026.json"), "utf8"));

const BASE_URL = DATA.siteUrl.replace(/\/+$/, "");
const BASE_PATH = (() => {
  try {
    return new URL(BASE_URL).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();
const GENERATED_URLS = [];

const RELATION_LABELS = {
  spouse: "배우자",
  adultChild: "성년 자녀",
  minorChild: "미성년 자녀",
  parent: "부모(직계존속)",
  relative: "기타 친족",
  other: "타인"
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanDist() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
  }
  ensureDir(path.join(DIST, "assets"));
}

function copyAssets() {
  const files = ["styles.css", "calculators.js", "app.js", "favicon.svg", "og-image.svg"];
  for (const file of files) {
    fs.copyFileSync(path.join(ROOT, "src", file), path.join(DIST, "assets", file));
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatKoreanManwonLabel(manwon) {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000);
    const rem = manwon % 10000;
    return rem === 0 ? `${eok}억 원` : `${eok}억 ${rem.toLocaleString("ko-KR")}만 원`;
  }
  return `${manwon.toLocaleString("ko-KR")}만 원`;
}

function renderAffiliateCard(key) {
  const item = DATA.affiliates && DATA.affiliates[key];
  if (!item || !item.url || item.url.startsWith("#")) return "";
  const isExternal = /^https?:\/\//i.test(item.url);
  const rel = item.sponsored ? "sponsored noopener noreferrer" : "noopener noreferrer";
  const targetAttr = isExternal ? ` target="_blank"` : "";
  return `
    <aside class="affiliate-strip" aria-label="관련 공식 안내">
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.description)}</span>
      </div>
      <a class="affiliate-cta" href="${escapeHtml(item.url)}"${targetAttr} rel="${rel}">${escapeHtml(item.cta)} →</a>
    </aside>
  `;
}

function renderAdSlot(slotKey) {
  const pubId = DATA.monetization && DATA.monetization.adsensePublisherId;
  const slotId =
    DATA.monetization && DATA.monetization.adsenseSlots && DATA.monetization.adsenseSlots[slotKey];
  if (!pubId || !slotId) {
    return `<!-- AdSense slot (${escapeHtml(slotKey)}): data/rates-2026.json에 adsensePublisherId와 슬롯 ID 입력 시 자동 활성화 -->`;
  }
  return `
    <div class="ad-unit">
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="${escapeHtml(pubId)}"
           data-ad-slot="${escapeHtml(slotId)}"
           data-ad-format="auto"
           data-full-width-responsive="true"></ins>
      <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
    </div>
  `;
}

function renderFaqSection(faqs) {
  if (!faqs || !faqs.length) return "";
  return `
    <section class="section-block" aria-label="자주 묻는 질문">
      <h2>자주 묻는 질문</h2>
      <div class="faq-list">
        ${faqs
          .map(
            (f) => `
          <article class="faq-item">
            <h3>${escapeHtml(f.q)}</h3>
            <p>${escapeHtml(f.a)}</p>
          </article>
        `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderPrevNext(prev, next) {
  if (!prev && !next) return "";
  return `
    <nav class="prev-next-nav" aria-label="인접 금액 계산기 이동">
      ${
        prev
          ? `<a class="prev-next-card" href="${prev.href}"><span>이전 구간</span><strong>← ${escapeHtml(prev.label)}</strong></a>`
          : `<div></div>`
      }
      ${
        next
          ? `<a class="prev-next-card next" href="${next.href}"><span>다음 구간</span><strong>${escapeHtml(next.label)} →</strong></a>`
          : `<div></div>`
      }
    </nav>
  `;
}

function renderLayout({
  routePath,
  title,
  description,
  activeNav,
  breadcrumbs,
  bodyHtml,
  faqs,
  priority = "0.7",
  includeInSitemap = true
}) {
  const canonical = `${BASE_URL}${routePath}`;
  if (includeInSitemap) {
    GENERATED_URLS.push({ loc: canonical, priority });
  }

  const jsonLdGraph = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: title,
      url: canonical,
      applicationCategory: "FinanceApplication",
      operatingSystem: "All",
      inLanguage: "ko-KR",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" }
    }
  ];

  if (breadcrumbs && breadcrumbs.length > 0) {
    jsonLdGraph.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((b, idx) => ({
        "@type": "ListItem",
        position: idx + 1,
        name: b.label,
        item: `${BASE_URL}${b.href}`
      }))
    });
  }

  if (faqs && faqs.length > 0) {
    jsonLdGraph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a }
      }))
    });
  }

  const navItems = [
    { id: "salary", label: "연봉", href: "/salary/" },
    { id: "freelancer", label: "3.3%", href: "/freelancer/" },
    { id: "severance", label: "퇴직금", href: "/severance/" },
    { id: "unemployment", label: "실업급여", href: "/unemployment/" },
    { id: "weekly-holiday", label: "주휴수당", href: "/weekly-holiday/" },
    { id: "stock-tax", label: "해외주식", href: "/stock-tax/" },
    { id: "real-estate", label: "취등록세", href: "/real-estate/" },
    { id: "gift-tax", label: "증여세", href: "/gift-tax/" },
    { id: "jeonse", label: "전월세", href: "/jeonse/" }
  ];

  const breadcrumbHtml =
    breadcrumbs && breadcrumbs.length > 0
      ? `<nav class="breadcrumb" aria-label="현재 위치">${breadcrumbs
          .map((b, i) =>
            i === breadcrumbs.length - 1
              ? `<span>${escapeHtml(b.label)}</span>`
              : `<a href="${b.href}">${escapeHtml(b.label)}</a><span>/</span>`
          )
          .join("")}</nav>`
      : "";

  const googleVerify =
    DATA.verification && DATA.verification.googleSiteVerification
      ? `<meta name="google-site-verification" content="${escapeHtml(DATA.verification.googleSiteVerification)}" />`
      : "";
  const naverVerify =
    DATA.verification && DATA.verification.naverSiteVerification
      ? `<meta name="naver-site-verification" content="${escapeHtml(DATA.verification.naverSiteVerification)}" />`
      : "";
  const ga4Id = DATA.analytics && DATA.analytics.ga4MeasurementId;
  const ga4Head = ga4Id
    ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(ga4Id)}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${escapeHtml(ga4Id)}');</script>`
    : "";
  const clarityId = DATA.analytics && DATA.analytics.clarityProjectId;
  const clarityHead = clarityId
    ? `<script>(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${escapeHtml(clarityId)}");</script>`
    : "";
  const adsenseHead =
    DATA.monetization && DATA.monetization.adsensePublisherId
      ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(DATA.monetization.adsensePublisherId)}" crossorigin="anonymous"></script>`
      : "";
  const ogImageUrl = `${BASE_URL}/assets/og-image.svg`;
  const repoLinkHtml = DATA.repoUrl
    ? `<a href="${escapeHtml(DATA.repoUrl)}" target="_blank" rel="noopener noreferrer">GitHub</a>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} · ${escapeHtml(DATA.siteName)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#2563eb" />
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  ${googleVerify}
  ${naverVerify}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(DATA.siteName)}" />
  <meta property="og:title" content="${escapeHtml(title)} · ${escapeHtml(DATA.siteName)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:locale" content="ko_KR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)} · ${escapeHtml(DATA.siteName)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
  <link rel="stylesheet" href="/assets/styles.css" />
  ${ga4Head}
  ${clarityHead}
  ${adsenseHead}
  <script type="application/ld+json">${JSON.stringify(jsonLdGraph)}</script>
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/">
        <span class="brand-dot" aria-hidden="true"></span>
        <span>${escapeHtml(DATA.siteName)}</span>
      </a>
      <nav class="nav-links" aria-label="계산기 메뉴">
        ${navItems
          .map(
            (n) =>
              `<a href="${n.href}" class="${activeNav === n.id ? "active" : ""}">${escapeHtml(n.label)}</a>`
          )
          .join("")}
      </nav>
    </div>
  </header>

  <main class="container">
    ${breadcrumbHtml}
    ${bodyHtml}
  </main>

  <footer class="site-footer">
    <div class="container footer-inner">
      <div>${escapeHtml(DATA.siteName)} · ${DATA.year}년 세율·요율 기준 · 본 계산 결과는 참고용 추정치입니다.</div>
      <nav class="footer-links" aria-label="사이트 안내">
        <a href="/about/">사이트 소개 · 면책고지</a>
        <a href="/privacy/">개인정보처리방침</a>
        <a href="/sitemap.xml">사이트맵</a>
        ${repoLinkHtml}
      </nav>
    </div>
  </footer>

  <script src="/assets/calculators.js"></script>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}

function applyBasePath(html) {
  return BASE_PATH ? html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`) : html;
}

function writePage(routePath, html) {
  const rel = routePath.replace(/^\/+/, "");
  const outDir = rel ? path.join(DIST, rel) : DIST;
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "index.html"), applyBasePath(html), "utf8");
}

function writeRootFile(fileName, html) {
  ensureDir(DIST);
  fs.writeFileSync(path.join(DIST, fileName), applyBasePath(html), "utf8");
}

/* 1. SALARY */
function renderSalaryWidget(defaultManwon) {
  const res = Calc.calcSalary(defaultManwon * 10000, DATA.salary.defaultNonTaxableMonthly, 1, DATA);
  return `
    <section class="calc-grid" aria-label="연봉 실수령액 계산기">
      <div class="sheet">
        <h2 class="sheet-title">급여 조건</h2>
        <div class="field">
          <label for="salary-annual">연봉 (세전) <span class="field-hint">퇴직금 별도</span></label>
          <div class="input-wrap">
            <input id="salary-annual" type="number" min="0" step="100" value="${defaultManwon}" />
            <span class="input-unit">만 원</span>
          </div>
          <div class="preset-row" id="salary-presets">
            <button type="button" class="chip-btn" data-preset="3000">3,000만</button>
            <button type="button" class="chip-btn" data-preset="4000">4,000만</button>
            <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
            <button type="button" class="chip-btn" data-preset="6000">6,000만</button>
            <button type="button" class="chip-btn" data-preset="8000">8,000만</button>
            <button type="button" class="chip-btn" data-preset="10000">1억</button>
          </div>
        </div>
        <div class="field">
          <label for="salary-nontax">월 비과세액 <span class="field-hint">식대 월 20만 원 기본</span></label>
          <div class="input-wrap">
            <input id="salary-nontax" type="number" min="0" step="10" value="20" />
            <span class="input-unit">만 원</span>
          </div>
        </div>
        <div class="field">
          <label for="salary-deps">부양가족 수 <span class="field-hint">본인 포함</span></label>
          <select id="salary-deps">
            <option value="1" selected>1명 (본인)</option>
            <option value="2">2명</option>
            <option value="3">3명</option>
            <option value="4">4명</option>
            <option value="5">5명 이상</option>
          </select>
        </div>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">월 급여명세 추정</h2>
        <div class="result-summary">
          <div class="result-label">예상 월 실수령액</div>
          <div class="result-main num" id="res-monthly-net">${Calc.formatWon(res.monthlyNet)}</div>
          <div class="result-sub num" id="res-salary-sub">연 실수령액 약 ${Calc.formatWon(res.annualNet)} · 공제율 ${Calc.formatPercent(res.effectiveDeductionRate, 1)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>월 세전 급여</th><td id="res-monthly-gross">${Calc.formatWon(res.monthlyGross)}</td></tr>
            <tr><th>국민연금 (4.5%)</th><td id="res-pension">${Calc.formatWon(res.nationalPension)}</td></tr>
            <tr><th>건강보험 (3.545%)</th><td id="res-health">${Calc.formatWon(res.healthInsurance)}</td></tr>
            <tr><th>장기요양보험</th><td id="res-care">${Calc.formatWon(res.longTermCare)}</td></tr>
            <tr><th>고용보험 (0.9%)</th><td id="res-employment">${Calc.formatWon(res.employmentInsurance)}</td></tr>
            <tr><th>근로소득세</th><td id="res-income-tax">${Calc.formatWon(res.incomeTax)}</td></tr>
            <tr><th>지방소득세 (10%)</th><td id="res-local-tax">${Calc.formatWon(res.localIncomeTax)}</td></tr>
            <tr class="total-row"><th>월 공제액 합계</th><td id="res-total-deduction">-${Calc.formatWon(res.totalDeduction)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions">
          <button type="button" class="btn-ghost" id="copy-salary-btn">결과 복사</button>
        </div>
      </div>
    </section>
  `;
}

function buildSalaryPages() {
  const list = DATA.pseo.salaryManwon;
  const matrixLinks = (current) => `
    <section class="section-block">
      <h2>연봉 구간별 실수령액</h2>
      <div class="link-matrix">
        ${list.map((m) => `<a class="matrix-pill ${current === m ? "current" : ""}" href="/salary/${m}-manwon/">연봉 ${formatKoreanManwonLabel(m)}</a>`).join("")}
      </div>
    </section>
  `;

  const mainFaqs = [
    {
      q: "2026년 연봉 실수령액은 어떤 기준으로 계산되나요?",
      a: "월 급여에서 비과세 식대(기본 20만 원)를 제외한 과세 급여를 기준으로 국민연금(4.5%), 건강보험(3.545%), 장기요양보험(건강보험료의 12.95%), 고용보험(0.9%), 근로소득세 및 지방소득세를 공제해 산출합니다."
    },
    {
      q: "비과세 식대를 늘리면 실수령액이 달라지나요?",
      a: "비과세 항목(식대 월 최대 20만 원 등)은 4대보험과 소득세 부과 대상에서 제외되므로 과세 표준이 줄어들어 실수령액이 증가합니다."
    }
  ];

  writePage(
    "/salary/",
    renderLayout({
      routePath: "/salary/",
      title: `${DATA.year} 연봉 실수령액 계산기`,
      description: `${DATA.year}년 4대보험 요율과 근로소득세 기준 연봉 실수령액 계산기.`,
      activeNav: "salary",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "연봉 실수령액", href: "/salary/" }],
      faqs: mainFaqs,
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>${DATA.year} 연봉 실수령액 계산기</h1>
            <span class="meta-tag">기준 ${DATA.updatedAt}</span>
          </div>
          <p class="subtitle">연봉, 비과세액, 부양가족 수에 따른 4대보험·소득세 공제 내역과 월 실수령액을 계산합니다.</p>
        </header>
        ${renderSalaryWidget(5000)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("salary")}
        ${matrixLinks(null)}
        ${renderFaqSection(mainFaqs)}
      `
    })
  );

  list.forEach((manwon, idx) => {
    const label = formatKoreanManwonLabel(manwon);
    const res = Calc.calcSalary(manwon * 10000, DATA.salary.defaultNonTaxableMonthly, 1, DATA);
    const prev = idx > 0 ? { href: `/salary/${list[idx - 1]}-manwon/`, label: `연봉 ${formatKoreanManwonLabel(list[idx - 1])}` } : null;
    const next = idx < list.length - 1 ? { href: `/salary/${list[idx + 1]}-manwon/`, label: `연봉 ${formatKoreanManwonLabel(list[idx + 1])}` } : null;
    const faqs = [
      {
        q: `연봉 ${label}의 월 실수령액은 얼마인가요?`,
        a: `${DATA.year}년 기준(부양가족 1명, 비과세 식대 20만 원) 세전 월급 ${Calc.formatWon(res.monthlyGross)}에서 ${Calc.formatWon(res.totalDeduction)}을 공제한 약 ${Calc.formatWon(res.monthlyNet)}입니다.`
      }
    ];

    writePage(
      `/salary/${manwon}-manwon/`,
      renderLayout({
        routePath: `/salary/${manwon}-manwon/`,
        title: `연봉 ${label} 실수령액 (${Calc.formatWon(res.monthlyNet)})`,
        description: `${DATA.year}년 연봉 ${label}의 월 실수령액은 ${Calc.formatWon(res.monthlyNet)}입니다. 4대보험과 근로소득세 상세 내역을 확인하세요.`,
        activeNav: "salary",
        priority: "0.8",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "연봉 실수령액", href: "/salary/" },
          { label: `연봉 ${label}`, href: `/salary/${manwon}-manwon/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>연봉 ${label} 실수령액</h1>
              <span class="meta-tag">${DATA.year}년 기준</span>
            </div>
            <p class="subtitle">부양가족 1명·비과세 20만 원 기준 예상 월 실수령액은 <strong>${Calc.formatWon(res.monthlyNet)}</strong>입니다.</p>
          </header>
          ${renderSalaryWidget(manwon)}
          ${renderAdSlot("pseoMid")}
          ${renderAffiliateCard("salary")}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
          ${matrixLinks(manwon)}
        `
      })
    );
  });
}

/* 2. FREELANCER 3.3% */
function renderFreelancerWidget(defaultManwon) {
  const res = Calc.calcFreelancer(defaultManwon * 10000, "grossToNet", DATA);
  return `
    <section class="calc-grid" aria-label="프리랜서 3.3% 계산기">
      <div class="sheet">
        <h2 class="sheet-title">계약 조건</h2>
        <div class="field">
          <label>계산 방식</label>
          <div class="toggle-group">
            <button type="button" class="toggle-btn active" data-free-mode="grossToNet">세전 → 실수령</button>
            <button type="button" class="toggle-btn" data-free-mode="netToGross">실수령 → 세전 역산</button>
          </div>
        </div>
        <div class="field">
          <label for="free-amount">금액</label>
          <div class="input-wrap">
            <input id="free-amount" type="number" min="0" step="10" value="${defaultManwon}" />
            <span class="input-unit">만 원</span>
          </div>
          <div class="preset-row" id="free-presets">
            <button type="button" class="chip-btn" data-preset="100">100만</button>
            <button type="button" class="chip-btn" data-preset="200">200만</button>
            <button type="button" class="chip-btn" data-preset="300">300만</button>
            <button type="button" class="chip-btn" data-preset="500">500만</button>
            <button type="button" class="chip-btn" data-preset="1000">1,000만</button>
          </div>
        </div>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">원천징수 명세</h2>
        <div class="result-summary">
          <div class="result-label" id="res-free-label">예상 실수령액 (3.3% 공제 후)</div>
          <div class="result-main num" id="res-free-main">${Calc.formatWon(res.net)}</div>
          <div class="result-sub num" id="res-free-sub">계약 금액 ${Calc.formatWon(res.gross)} 기준</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>계약 금액 (세전)</th><td id="res-free-gross">${Calc.formatWon(res.gross)}</td></tr>
            <tr><th>사업소득세 (3.0%)</th><td id="res-free-income">${Calc.formatWon(res.incomeTax)}</td></tr>
            <tr><th>지방소득세 (0.3%)</th><td id="res-free-local">${Calc.formatWon(res.localTax)}</td></tr>
            <tr class="total-row"><th>원천징수 세액 합계</th><td id="res-free-total-tax">-${Calc.formatWon(res.totalTax)}</td></tr>
            <tr><th>최종 실수령액</th><td id="res-free-net">${Calc.formatWon(res.net)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions">
          <button type="button" class="btn-ghost" id="copy-free-btn">결과 복사</button>
        </div>
      </div>
    </section>
  `;
}

function buildFreelancerPages() {
  const list = DATA.pseo.freelancerManwon;
  const matrixLinks = (current) => `
    <section class="section-block">
      <h2>금액별 3.3% 실수령액</h2>
      <div class="link-matrix">
        ${list.map((m) => `<a class="matrix-pill ${current === m ? "current" : ""}" href="/freelancer/${m}-manwon/">${formatKoreanManwonLabel(m)}</a>`).join("")}
      </div>
    </section>
  `;

  const mainFaqs = [
    {
      q: "프리랜서 3.3%는 어떻게 구성되나요?",
      a: "사업소득세 3.0%와 지방소득세 0.3%를 합산한 3.3%를 지급처가 원천징수하고 나머지 96.7%를 지급합니다."
    }
  ];

  writePage(
    "/freelancer/",
    renderLayout({
      routePath: "/freelancer/",
      title: `${DATA.year} 프리랜서 3.3% 계산기`,
      description: "프리랜서 3.3% 원천징수 실수령액 및 세전 금액 역산 계산기.",
      activeNav: "freelancer",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "프리랜서 3.3%", href: "/freelancer/" }],
      faqs: mainFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>프리랜서 3.3% 원천징수 계산기</h1>
          <p class="subtitle">사업소득세 3%와 지방소득세 0.3% 공제 후 실수령액 및 세전 계약금 역산을 계산합니다.</p>
        </header>
        ${renderFreelancerWidget(300)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("freelancer")}
        ${matrixLinks(null)}
        ${renderFaqSection(mainFaqs)}
      `
    })
  );

  list.forEach((manwon, idx) => {
    const label = formatKoreanManwonLabel(manwon);
    const res = Calc.calcFreelancer(manwon * 10000, "grossToNet", DATA);
    const prev = idx > 0 ? { href: `/freelancer/${list[idx - 1]}-manwon/`, label: `${formatKoreanManwonLabel(list[idx - 1])} 3.3%` } : null;
    const next = idx < list.length - 1 ? { href: `/freelancer/${list[idx + 1]}-manwon/`, label: `${formatKoreanManwonLabel(list[idx + 1])} 3.3%` } : null;
    const faqs = [
      {
        q: `${label}에서 3.3% 공제 후 실수령액은 얼마인가요?`,
        a: `원천징수 세액 ${Calc.formatWon(res.totalTax)}을 제외하고 ${Calc.formatWon(res.net)}을 수령합니다.`
      }
    ];

    writePage(
      `/freelancer/${manwon}-manwon/`,
      renderLayout({
        routePath: `/freelancer/${manwon}-manwon/`,
        title: `${label} 3.3% 실수령액 (${Calc.formatWon(res.net)})`,
        description: `프리랜서 ${label} 계약 시 3.3% 세금은 ${Calc.formatWon(res.totalTax)}, 실수령액은 ${Calc.formatWon(res.net)}입니다.`,
        activeNav: "freelancer",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "프리랜서 3.3%", href: "/freelancer/" },
          { label: label, href: `/freelancer/${manwon}-manwon/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${label} 3.3% 원천징수 실수령액</h1>
            <p class="subtitle">세전 ${label} 기준 원천징수 세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>, 실수령액은 <strong>${Calc.formatWon(res.net)}</strong>입니다.</p>
          </header>
          ${renderFreelancerWidget(manwon)}
          ${renderAdSlot("pseoMid")}
          ${renderAffiliateCard("freelancer")}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
          ${matrixLinks(manwon)}
        `
      })
    );
  });
}

/* 3. OVERSEAS STOCK TAX */
function renderStockTaxWidget(defaultProfitManwon) {
  const res = Calc.calcOverseasStockTax(defaultProfitManwon * 10000, 0, DATA);
  return `
    <section class="calc-grid" aria-label="해외주식 양도소득세 계산기">
      <div class="sheet">
        <h2 class="sheet-title">연간 매매 손익</h2>
        <div class="field">
          <label for="stock-profit">연간 실현 수익 <span class="field-hint">제비용 차감 후</span></label>
          <div class="input-wrap">
            <input id="stock-profit" type="number" min="0" step="50" value="${defaultProfitManwon}" />
            <span class="input-unit">만 원</span>
          </div>
          <div class="preset-row" id="stock-presets">
            <button type="button" class="chip-btn" data-preset="500">500만</button>
            <button type="button" class="chip-btn" data-preset="1000">1,000만</button>
            <button type="button" class="chip-btn" data-preset="3000">3,000만</button>
            <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
          </div>
        </div>
        <div class="field">
          <label for="stock-loss">연간 실현 손실 <span class="field-hint">손익통산</span></label>
          <div class="input-wrap">
            <input id="stock-loss" type="number" min="0" step="50" value="0" />
            <span class="input-unit">만 원</span>
          </div>
        </div>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">양도소득세 산출 (22%)</h2>
        <div class="result-summary">
          <div class="result-label">5월 납부 예상 세액</div>
          <div class="result-main num" id="res-stock-tax">${Calc.formatWon(res.totalTax)}</div>
          <div class="result-sub num" id="res-stock-sub">세후 순수익 ${Calc.formatWon(res.afterTaxProfit)} · 실효세율 ${Calc.formatPercent(res.effectiveRate, 1)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>손익통산 후 순수익</th><td id="res-stock-net-profit">${Calc.formatWon(res.netProfit)}</td></tr>
            <tr><th>연간 기본공제</th><td id="res-stock-deduction">-${Calc.formatWon(res.deductionApplied)}</td></tr>
            <tr><th>과세표준</th><td id="res-stock-base">${Calc.formatWon(res.taxableBase)}</td></tr>
            <tr><th>양도소득세 (20%)</th><td id="res-stock-cap-tax">${Calc.formatWon(res.capitalGainsTax)}</td></tr>
            <tr><th>지방소득세 (2%)</th><td id="res-stock-local-tax">${Calc.formatWon(res.localTax)}</td></tr>
            <tr class="total-row"><th>세후 최종 순수익</th><td id="res-stock-after">${Calc.formatWon(res.afterTaxProfit)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions">
          <button type="button" class="btn-ghost" id="copy-stock-btn">결과 복사</button>
        </div>
      </div>
    </section>
  `;
}

function buildStockTaxPages() {
  const list = DATA.pseo.stockTaxManwon;
  const matrixLinks = (current) => `
    <section class="section-block">
      <h2>수익 구간별 양도소득세</h2>
      <div class="link-matrix">
        ${list.map((m) => `<a class="matrix-pill ${current === m ? "current" : ""}" href="/stock-tax/${m}-manwon/">수익 ${formatKoreanManwonLabel(m)}</a>`).join("")}
      </div>
    </section>
  `;

  writePage(
    "/stock-tax/",
    renderLayout({
      routePath: "/stock-tax/",
      title: `${DATA.year} 해외주식 양도소득세 계산기`,
      description: "해외주식 연간 250만 원 기본공제와 손익통산을 반영한 22% 양도소득세 계산기.",
      activeNav: "stock-tax",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "해외주식 양도세", href: "/stock-tax/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>해외주식 양도소득세 계산기</h1>
          <p class="subtitle">연간 기본공제 250만 원과 손익통산을 적용한 양도세(20%) + 지방소득세(2%)를 산출합니다.</p>
        </header>
        ${renderStockTaxWidget(1000)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("stockTax")}
        ${matrixLinks(null)}
      `
    })
  );

  list.forEach((manwon, idx) => {
    const label = formatKoreanManwonLabel(manwon);
    const res = Calc.calcOverseasStockTax(manwon * 10000, 0, DATA);
    const prev = idx > 0 ? { href: `/stock-tax/${list[idx - 1]}-manwon/`, label: `수익 ${formatKoreanManwonLabel(list[idx - 1])}` } : null;
    const next = idx < list.length - 1 ? { href: `/stock-tax/${list[idx + 1]}-manwon/`, label: `수익 ${formatKoreanManwonLabel(list[idx + 1])}` } : null;
    writePage(
      `/stock-tax/${manwon}-manwon/`,
      renderLayout({
        routePath: `/stock-tax/${manwon}-manwon/`,
        title: `해외주식 수익 ${label} 양도소득세 (${Calc.formatWon(res.totalTax)})`,
        description: `해외주식 실현 수익 ${label} 기준 예상 양도소득세는 ${Calc.formatWon(res.totalTax)}입니다.`,
        activeNav: "stock-tax",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "해외주식 양도세", href: "/stock-tax/" },
          { label: `수익 ${label}`, href: `/stock-tax/${manwon}-manwon/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>해외주식 수익 ${label} 양도소득세</h1>
            <p class="subtitle">기본공제 250만 원 적용 시 납부 예상 세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>입니다.</p>
          </header>
          ${renderStockTaxWidget(manwon)}
          ${renderAffiliateCard("stockTax")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(manwon)}
        `
      })
    );
  });
}

/* 4. REAL ESTATE */
function renderRealEstateWidget(defaultEok) {
  const res = Calc.calcAcquisitionTax(defaultEok * 100000000, 1, false, DATA);
  return `
    <section class="calc-grid" aria-label="주택 취등록세 계산기">
      <div class="sheet">
        <h2 class="sheet-title">주택 매수 조건</h2>
        <div class="field">
          <label for="re-price">매매가</label>
          <div class="input-wrap">
            <input id="re-price" type="number" min="0" step="0.5" value="${defaultEok}" />
            <span class="input-unit">억 원</span>
          </div>
          <div class="preset-row" id="re-presets">
            <button type="button" class="chip-btn" data-preset="3">3억</button>
            <button type="button" class="chip-btn" data-preset="6">6억</button>
            <button type="button" class="chip-btn" data-preset="9">9억</button>
            <button type="button" class="chip-btn" data-preset="12">12억</button>
          </div>
        </div>
        <div class="field">
          <label for="re-houses">취득 후 보유 주택 수</label>
          <select id="re-houses">
            <option value="1" selected>1주택 (1~3%)</option>
            <option value="2">2주택 (조정지역 중과 참고 8%)</option>
            <option value="3">3주택 이상 (중과 참고 12%)</option>
          </select>
        </div>
        <div class="field">
          <label class="checkbox-row">
            <input id="re-over85" type="checkbox" />
            <span>전용면적 85㎡ 초과 (농어촌특별세 0.2%)</span>
          </label>
        </div>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">취등록세 산출</h2>
        <div class="result-summary">
          <div class="result-label">총 납부 세액</div>
          <div class="result-main num" id="res-re-total">${Calc.formatWon(res.totalTax)}</div>
          <div class="result-sub num" id="res-re-sub">총 실효세율 ${Calc.formatPercent(res.totalRate, 2)} (취득세율 ${Calc.formatPercent(res.acquisitionRate, 2)})</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>주택 매매가</th><td id="res-re-price">${Calc.formatWon(res.price)}</td></tr>
            <tr><th>취득세</th><td id="res-re-acq">${Calc.formatWon(res.acquisitionTax)}</td></tr>
            <tr><th>지방교육세</th><td id="res-re-edu">${Calc.formatWon(res.localEducationTax)}</td></tr>
            <tr><th>농어촌특별세</th><td id="res-re-rural">${Calc.formatWon(res.ruralSpecialTax)}</td></tr>
            <tr class="total-row"><th>총 취등록세 합계</th><td id="res-re-sum">${Calc.formatWon(res.totalTax)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions">
          <button type="button" class="btn-ghost" id="copy-re-btn">결과 복사</button>
        </div>
      </div>
    </section>
  `;
}

function buildRealEstatePages() {
  const list = DATA.pseo.realEstateEok;
  const matrixLinks = (current) => `
    <section class="section-block">
      <h2>매매가별 주택 취등록세</h2>
      <div class="link-matrix">
        ${list.map((eok) => `<a class="matrix-pill ${current === eok ? "current" : ""}" href="/real-estate/${eok}-eok/">매매가 ${eok}억 원</a>`).join("")}
      </div>
    </section>
  `;

  writePage(
    "/real-estate/",
    renderLayout({
      routePath: "/real-estate/",
      title: `${DATA.year} 아파트·주택 취등록세 계산기`,
      description: "주택 매매가, 보유 주택 수, 전용 85㎡ 여부에 따른 취등록세 계산기.",
      activeNav: "real-estate",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "주택 취등록세", href: "/real-estate/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>아파트·주택 취등록세 계산기</h1>
          <p class="subtitle">6억·9억 구간별 취득세율과 지방교육세, 농어촌특별세를 계산합니다.</p>
        </header>
        ${renderRealEstateWidget(6)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("realEstate")}
        ${matrixLinks(null)}
      `
    })
  );

  list.forEach((eok, idx) => {
    const res = Calc.calcAcquisitionTax(eok * 100000000, 1, false, DATA);
    const prev = idx > 0 ? { href: `/real-estate/${list[idx - 1]}-eok/`, label: `${list[idx - 1]}억 원 취등록세` } : null;
    const next = idx < list.length - 1 ? { href: `/real-estate/${list[idx + 1]}-eok/`, label: `${list[idx + 1]}억 원 취등록세` } : null;
    writePage(
      `/real-estate/${eok}-eok/`,
      renderLayout({
        routePath: `/real-estate/${eok}-eok/`,
        title: `${eok}억 원 아파트 취등록세 (${Calc.formatWon(res.totalTax)})`,
        description: `매매가 ${eok}억 원 1주택 기준 예상 취등록세는 ${Calc.formatWon(res.totalTax)}입니다.`,
        activeNav: "real-estate",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "주택 취등록세", href: "/real-estate/" },
          { label: `${eok}억 원`, href: `/real-estate/${eok}-eok/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>매매가 ${eok}억 원 주택 취등록세</h1>
            <p class="subtitle">1주택(전용 85㎡ 이하) 기준 총 납부 세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>입니다.</p>
          </header>
          ${renderRealEstateWidget(eok)}
          ${renderAffiliateCard("realEstate")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(eok)}
        `
      })
    );
  });
}

/* 5. JEONSE */
function buildJeonsePage() {
  const res = Calc.calcJeonseToWolse(300000000, 100000000, DATA.jeonse.defaultConversionRate, DATA);
  writePage(
    "/jeonse/",
    renderLayout({
      routePath: "/jeonse/",
      title: `${DATA.year} 전월세 전환율 계산기`,
      description: "전세 보증금을 월세로 전환할 때 적정 월세와 연간 주거비를 계산합니다.",
      activeNav: "jeonse",
      priority: "0.85",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "전월세 전환율", href: "/jeonse/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>전월세 전환율 계산기</h1>
          <p class="subtitle">전세 보증금과 월세 보증금 차액에 전환율을 적용해 적정 월세를 계산합니다.</p>
        </header>
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">보증금 및 전환율</h2>
            <div class="field">
              <label for="jw-jeonse">기존 전세 보증금</label>
              <div class="input-wrap"><input id="jw-jeonse" type="number" min="0" step="1000" value="30000" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field">
              <label for="jw-deposit">전환 후 월세 보증금</label>
              <div class="input-wrap"><input id="jw-deposit" type="number" min="0" step="1000" value="10000" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field">
              <label for="jw-rate">적용 전환율</label>
              <div class="input-wrap"><input id="jw-rate" type="number" min="0" max="20" step="0.1" value="${DATA.jeonse.defaultConversionRate}" /><span class="input-unit">%</span></div>
              <div class="preset-row" id="jw-rate-presets">
                <button type="button" class="chip-btn" data-preset="4.0">4.0%</button>
                <button type="button" class="chip-btn" data-preset="4.5">4.5%</button>
                <button type="button" class="chip-btn" data-preset="5.0">5.0%</button>
                <button type="button" class="chip-btn" data-preset="5.5">5.5%</button>
              </div>
            </div>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">전환 월세 산출</h2>
            <div class="result-summary">
              <div class="result-label">예상 월세</div>
              <div class="result-main num" id="res-jw-monthly">${Calc.formatWon(res.monthlyRent)}</div>
              <div class="result-sub num" id="res-jw-sub">연간 월세 합계 ${Calc.formatWon(res.yearlyRent)} · 전환율 ${res.conversionRate.toFixed(1)}%</div>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>전환 대상 보증금 차액</th><td id="res-jw-diff">${Calc.formatWon(res.diffDeposit)}</td></tr>
                <tr><th>연간 월세 총액</th><td id="res-jw-yearly">${Calc.formatWon(res.yearlyRent)}</td></tr>
              </tbody>
            </table>
            <div class="result-actions"><button type="button" class="btn-ghost" id="copy-jw-btn">결과 복사</button></div>
          </div>
        </section>
        ${renderAffiliateCard("jeonse")}
      `
    })
  );
}

/* 6. SEVERANCE (퇴직금) */
function renderSeveranceWidget(defaultMonthlyManwon, defaultYears) {
  const res = Calc.calcSeverance(defaultMonthlyManwon * 10000, defaultYears);
  return `
    <section class="calc-grid" aria-label="퇴직금 계산기">
      <div class="sheet">
        <h2 class="sheet-title">근무 조건</h2>
        <div class="field">
          <label for="sev-monthly">퇴직 전 3개월 평균 월급 (세전)</label>
          <div class="input-wrap"><input id="sev-monthly" type="number" min="0" step="10" value="${defaultMonthlyManwon}" /><span class="input-unit">만 원</span></div>
          <div class="preset-row" id="sev-presets">
            <button type="button" class="chip-btn" data-preset="250">250만</button>
            <button type="button" class="chip-btn" data-preset="300">300만</button>
            <button type="button" class="chip-btn" data-preset="400">400만</button>
            <button type="button" class="chip-btn" data-preset="500">500만</button>
          </div>
        </div>
        <div class="field">
          <label for="sev-years">근속연수 <span class="field-hint">1년 이상 지급</span></label>
          <div class="input-wrap"><input id="sev-years" type="number" min="0" step="0.5" value="${defaultYears}" /><span class="input-unit">년</span></div>
        </div>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">퇴직금 실수령 추정</h2>
        <div class="result-summary">
          <div class="result-label">예상 퇴직금 실수령액</div>
          <div class="result-main num" id="res-sev-net">${Calc.formatWon(res.net)}</div>
          <div class="result-sub num" id="res-sev-sub">세전 퇴직금 ${Calc.formatWon(res.gross)} · 퇴직세 합계 ${Calc.formatWon(res.totalTax)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>세전 퇴직금</th><td id="res-sev-gross">${Calc.formatWon(res.gross)}</td></tr>
            <tr><th>근속연수공제</th><td id="res-sev-ded">-${Calc.formatWon(res.serviceDeduction)}</td></tr>
            <tr><th>퇴직소득세</th><td id="res-sev-inc">${Calc.formatWon(res.retirementIncomeTax)}</td></tr>
            <tr><th>지방소득세 (10%)</th><td id="res-sev-loc">${Calc.formatWon(res.localTax)}</td></tr>
            <tr class="total-row"><th>퇴직세 합계</th><td id="res-sev-tax">-${Calc.formatWon(res.totalTax)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions"><button type="button" class="btn-ghost" id="copy-sev-btn">결과 복사</button></div>
      </div>
    </section>
  `;
}

function buildSeverancePages() {
  const months = DATA.pseo.severanceMonthlyManwon;
  const yearsList = DATA.pseo.severanceYears;
  const pairs = [];
  for (const m of months) {
    for (const y of yearsList) {
      pairs.push({ m, y, slug: `${m}-manwon-${y}-year` });
    }
  }

  const matrixLinks = (currentSlug) => `
    <section class="section-block">
      <h2>월급·근속연수별 퇴직금</h2>
      <div class="link-matrix">
        ${pairs.map((p) => `<a class="matrix-pill ${currentSlug === p.slug ? "current" : ""}" href="/severance/${p.slug}/">월 ${p.m}만 · ${p.y}년</a>`).join("")}
      </div>
    </section>
  `;

  writePage(
    "/severance/",
    renderLayout({
      routePath: "/severance/",
      title: `${DATA.year} 퇴직금 실수령액 계산기`,
      description: "평균 월급과 근속연수에 따른 세전 퇴직금, 근속연수공제, 퇴직소득세 및 실수령액 계산기.",
      activeNav: "severance",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "퇴직금 계산기", href: "/severance/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>퇴직금 실수령액 계산기</h1>
          <p class="subtitle">평균 월급과 근속연수를 입력하면 근속연수공제와 퇴직소득세를 반영한 실수령액을 계산합니다.</p>
        </header>
        ${renderSeveranceWidget(350, 3)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("severance")}
        ${matrixLinks(null)}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcSeverance(p.m * 10000, p.y);
    const prev = idx > 0 ? { href: `/severance/${pairs[idx - 1].slug}/`, label: `월 ${pairs[idx - 1].m}만 · ${pairs[idx - 1].y}년 퇴직금` } : null;
    const next = idx < pairs.length - 1 ? { href: `/severance/${pairs[idx + 1].slug}/`, label: `월 ${pairs[idx + 1].m}만 · ${pairs[idx + 1].y}년 퇴직금` } : null;
    writePage(
      `/severance/${p.slug}/`,
      renderLayout({
        routePath: `/severance/${p.slug}/`,
        title: `월급 ${p.m}만 원 ${p.y}년 근속 퇴직금 (${Calc.formatWon(res.net)})`,
        description: `월급 ${p.m}만 원으로 ${p.y}년 근무 시 세전 퇴직금 ${Calc.formatWon(res.gross)}, 세후 실수령액 약 ${Calc.formatWon(res.net)}입니다.`,
        activeNav: "severance",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "퇴직금", href: "/severance/" },
          { label: `월 ${p.m}만 · ${p.y}년`, href: `/severance/${p.slug}/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>월급 ${p.m}만 원 · ${p.y}년 근속 퇴직금</h1>
            <p class="subtitle">세전 퇴직금 ${Calc.formatWon(res.gross)}, 퇴직소득세 공제 후 실수령액은 약 <strong>${Calc.formatWon(res.net)}</strong>입니다.</p>
          </header>
          ${renderSeveranceWidget(p.m, p.y)}
          ${renderAffiliateCard("severance")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(p.slug)}
        `
      })
    );
  });
}

/* 7. UNEMPLOYMENT (실업급여) */
function renderUnemploymentWidget(defaultMonthlyManwon, defaultYears) {
  const res = Calc.calcUnemployment(defaultMonthlyManwon * 10000, false, defaultYears, DATA);
  return `
    <section class="calc-grid" aria-label="실업급여 계산기">
      <div class="sheet">
        <h2 class="sheet-title">고용보험 이력</h2>
        <div class="field">
          <label for="unemp-monthly">퇴직 전 3개월 평균 월급 (세전)</label>
          <div class="input-wrap"><input id="unemp-monthly" type="number" min="0" step="10" value="${defaultMonthlyManwon}" /><span class="input-unit">만 원</span></div>
          <div class="preset-row" id="unemp-presets">
            <button type="button" class="chip-btn" data-preset="250">250만</button>
            <button type="button" class="chip-btn" data-preset="300">300만</button>
            <button type="button" class="chip-btn" data-preset="350">350만</button>
            <button type="button" class="chip-btn" data-preset="450">450만</button>
          </div>
        </div>
        <div class="field">
          <label for="unemp-years">고용보험 총 가입기간</label>
          <select id="unemp-years">
            <option value="0.5" ${defaultYears < 1 ? "selected" : ""}>1년 미만</option>
            <option value="1" ${defaultYears >= 1 && defaultYears < 3 ? "selected" : ""}>1년 이상 ~ 3년 미만</option>
            <option value="3" ${defaultYears >= 3 && defaultYears < 5 ? "selected" : ""}>3년 이상 ~ 5년 미만</option>
            <option value="5" ${defaultYears >= 5 && defaultYears < 10 ? "selected" : ""}>5년 이상 ~ 10년 미만</option>
            <option value="10" ${defaultYears >= 10 ? "selected" : ""}>10년 이상</option>
          </select>
        </div>
        <div class="field">
          <label class="checkbox-row">
            <input id="unemp-age50" type="checkbox" />
            <span>퇴사 시 만 50세 이상 또는 장애인</span>
          </label>
        </div>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">구직급여 산출</h2>
        <div class="result-summary">
          <div class="result-label">예상 총 실업급여</div>
          <div class="result-main num" id="res-unemp-total">${Calc.formatWon(res.totalBenefit)}</div>
          <div class="result-sub num" id="res-unemp-sub">1일 ${Calc.formatWon(res.dailyBenefit)} × ${res.benefitDays}일 (월 약 ${Calc.formatWon(res.monthlyBenefit)})</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>1일 구직급여액 (상·하한 반영)</th><td id="res-unemp-daily">${Calc.formatWon(res.dailyBenefit)}</td></tr>
            <tr><th>소정급여일수</th><td id="res-unemp-days">${res.benefitDays}일</td></tr>
            <tr><th>월 환산 수령액 (30일 기준)</th><td id="res-unemp-monthly">${Calc.formatWon(res.monthlyBenefit)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions"><button type="button" class="btn-ghost" id="copy-unemp-btn">결과 복사</button></div>
      </div>
    </section>
  `;
}

function buildUnemploymentPages() {
  const months = DATA.pseo.unemploymentMonthlyManwon;
  const yearsList = DATA.pseo.unemploymentInsuredYears;
  const pairs = [];
  for (const m of months) {
    for (const y of yearsList) {
      pairs.push({ m, y, slug: `${m}-manwon-${y}-year` });
    }
  }

  const matrixLinks = (currentSlug) => `
    <section class="section-block">
      <h2>월급·가입기간별 실업급여</h2>
      <div class="link-matrix">
        ${pairs.map((p) => `<a class="matrix-pill ${currentSlug === p.slug ? "current" : ""}" href="/unemployment/${p.slug}/">월 ${p.m}만 · ${p.y}년</a>`).join("")}
      </div>
    </section>
  `;

  writePage(
    "/unemployment/",
    renderLayout({
      routePath: "/unemployment/",
      title: `${DATA.year} 실업급여 계산기`,
      description: "퇴직 전 평균 월급, 나이, 고용보험 가입기간에 따른 1일 구직급여액과 총 예상 실업급여 계산기.",
      activeNav: "unemployment",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "실업급여", href: "/unemployment/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 실업급여 계산기</h1>
          <p class="subtitle">고용보험 1일 구직급여 상·하한액과 소정급여일수 기준으로 총 예상 수령액을 산출합니다.</p>
        </header>
        ${renderUnemploymentWidget(350, 3)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("unemployment")}
        ${matrixLinks(null)}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcUnemployment(p.m * 10000, false, p.y, DATA);
    const prev = idx > 0 ? { href: `/unemployment/${pairs[idx - 1].slug}/`, label: `월 ${pairs[idx - 1].m}만 · ${pairs[idx - 1].y}년` } : null;
    const next = idx < pairs.length - 1 ? { href: `/unemployment/${pairs[idx + 1].slug}/`, label: `월 ${pairs[idx + 1].m}만 · ${pairs[idx + 1].y}년` } : null;
    writePage(
      `/unemployment/${p.slug}/`,
      renderLayout({
        routePath: `/unemployment/${p.slug}/`,
        title: `월급 ${p.m}만 원 · 가입 ${p.y}년 실업급여 (${Calc.formatWon(res.totalBenefit)})`,
        description: `퇴직 전 월급 ${p.m}만 원, 고용보험 ${p.y}년 가입 시 예상 실업급여는 총 ${Calc.formatWon(res.totalBenefit)}(${res.benefitDays}일)입니다.`,
        activeNav: "unemployment",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "실업급여", href: "/unemployment/" },
          { label: `월 ${p.m}만 · ${p.y}년`, href: `/unemployment/${p.slug}/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>월급 ${p.m}만 원 · 가입 ${p.y}년 실업급여</h1>
            <p class="subtitle">만 50세 미만 기준 1일 ${Calc.formatWon(res.dailyBenefit)}, 총 ${res.benefitDays}일간 <strong>${Calc.formatWon(res.totalBenefit)}</strong> 수령이 예상됩니다.</p>
          </header>
          ${renderUnemploymentWidget(p.m, p.y)}
          ${renderAffiliateCard("unemployment")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(p.slug)}
        `
      })
    );
  });
}

/* 8. WEEKLY HOLIDAY PAY (주휴수당) */
function renderWeeklyHolidayWidget(defaultWage, defaultHours) {
  const res = Calc.calcWeeklyHoliday(defaultWage, defaultHours, DATA);
  return `
    <section class="calc-grid" aria-label="주휴수당 계산기">
      <div class="sheet">
        <h2 class="sheet-title">근무 조건</h2>
        <div class="field">
          <label for="wh-wage">시급 <span class="field-hint">최저시급 ${DATA.weeklyHoliday.minimumWage2026.toLocaleString("ko-KR")}원</span></label>
          <div class="input-wrap"><input id="wh-wage" type="number" min="0" step="100" value="${defaultWage}" /><span class="input-unit">원</span></div>
          <div class="preset-row" id="wh-wage-presets">
            <button type="button" class="chip-btn" data-preset="${DATA.weeklyHoliday.minimumWage2026}">최저시급</button>
            <button type="button" class="chip-btn" data-preset="11000">11,000원</button>
            <button type="button" class="chip-btn" data-preset="12000">12,000원</button>
            <button type="button" class="chip-btn" data-preset="15000">15,000원</button>
          </div>
        </div>
        <div class="field">
          <label for="wh-hours">주간 소정근로시간 <span class="field-hint">주 15시간 이상 발생</span></label>
          <div class="input-wrap"><input id="wh-hours" type="number" min="0" max="80" step="1" value="${defaultHours}" /><span class="input-unit">시간</span></div>
          <div class="preset-row" id="wh-hours-presets">
            <button type="button" class="chip-btn" data-preset="15">15시간</button>
            <button type="button" class="chip-btn" data-preset="20">20시간</button>
            <button type="button" class="chip-btn" data-preset="30">30시간</button>
            <button type="button" class="chip-btn" data-preset="40">40시간</button>
          </div>
        </div>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">주휴수당 및 주급 산출</h2>
        <div class="result-summary">
          <div class="result-label">예상 주휴수당 (1주 기준)</div>
          <div class="result-main num" id="res-wh-pay">${Calc.formatWon(res.holidayPay)}</div>
          <div class="result-sub num" id="res-wh-sub">주급(주휴 포함) ${Calc.formatWon(res.totalWeeklyPay)} · 월 환산 약 ${Calc.formatWon(res.estimatedMonthlyPay)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>기본 주급</th><td id="res-wh-base">${Calc.formatWon(res.baseWeeklyPay)}</td></tr>
            <tr><th>인정 주휴시간</th><td id="res-wh-hours">${res.holidayHours.toFixed(1)}시간</td></tr>
            <tr><th>주휴 포함 주급</th><td id="res-wh-total">${Calc.formatWon(res.totalWeeklyPay)}</td></tr>
            <tr><th>월 환산 급여 (4.345주)</th><td id="res-wh-monthly">${Calc.formatWon(res.estimatedMonthlyPay)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions"><button type="button" class="btn-ghost" id="copy-wh-btn">결과 복사</button></div>
      </div>
    </section>
  `;
}

function buildWeeklyHolidayPages() {
  const wages = DATA.pseo.weeklyHolidayWages;
  const hours = DATA.pseo.weeklyHolidayHours;
  const pairs = [];
  for (const w of wages) {
    for (const h of hours) {
      pairs.push({ w, h, slug: `${w}-won-${h}-hours` });
    }
  }

  const matrixLinks = (currentSlug) => `
    <section class="section-block">
      <h2>시급·근무시간별 주휴수당</h2>
      <div class="link-matrix">
        ${pairs.map((p) => `<a class="matrix-pill ${currentSlug === p.slug ? "current" : ""}" href="/weekly-holiday/${p.slug}/">${p.w.toLocaleString("ko-KR")}원 · 주 ${p.h}시간</a>`).join("")}
      </div>
    </section>
  `;

  writePage(
    "/weekly-holiday/",
    renderLayout({
      routePath: "/weekly-holiday/",
      title: `${DATA.year} 주휴수당 계산기 (시급·주급·월급)`,
      description: "시급과 주간 근무시간에 따른 주휴수당, 주휴 포함 주급, 월 환산 급여 계산기.",
      activeNav: "weekly-holiday",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "주휴수당", href: "/weekly-holiday/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 주휴수당 계산기</h1>
          <p class="subtitle">주 15시간 이상 개근 시 발생하는 법정 주휴수당과 월 환산 급여를 계산합니다.</p>
        </header>
        ${renderWeeklyHolidayWidget(DATA.weeklyHoliday.minimumWage2026, 20)}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("weeklyHoliday")}
        ${matrixLinks(null)}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcWeeklyHoliday(p.w, p.h, DATA);
    const prev = idx > 0 ? { href: `/weekly-holiday/${pairs[idx - 1].slug}/`, label: `${pairs[idx - 1].w.toLocaleString("ko-KR")}원 · ${pairs[idx - 1].h}시간` } : null;
    const next = idx < pairs.length - 1 ? { href: `/weekly-holiday/${pairs[idx + 1].slug}/`, label: `${pairs[idx + 1].w.toLocaleString("ko-KR")}원 · ${pairs[idx + 1].h}시간` } : null;
    writePage(
      `/weekly-holiday/${p.slug}/`,
      renderLayout({
        routePath: `/weekly-holiday/${p.slug}/`,
        title: `시급 ${p.w.toLocaleString("ko-KR")}원 주 ${p.h}시간 주휴수당 (${Calc.formatWon(res.holidayPay)})`,
        description: `시급 ${p.w.toLocaleString("ko-KR")}원, 주 ${p.h}시간 근무 시 주휴수당은 ${Calc.formatWon(res.holidayPay)}, 주급은 ${Calc.formatWon(res.totalWeeklyPay)}입니다.`,
        activeNav: "weekly-holiday",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "주휴수당", href: "/weekly-holiday/" },
          { label: `${p.w.toLocaleString("ko-KR")}원 · ${p.h}시간`, href: `/weekly-holiday/${p.slug}/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>시급 ${p.w.toLocaleString("ko-KR")}원 · 주 ${p.h}시간 주휴수당</h1>
            <p class="subtitle">예상 주휴수당은 <strong>${Calc.formatWon(res.holidayPay)}</strong>, 주휴 포함 주급은 ${Calc.formatWon(res.totalWeeklyPay)}입니다.</p>
          </header>
          ${renderWeeklyHolidayWidget(p.w, p.h)}
          ${renderAffiliateCard("weeklyHoliday")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(p.slug)}
        `
      })
    );
  });
}

/* 9. GIFT TAX (증여세) */
function renderGiftTaxWidget(defaultAmountManwon, defaultRelation) {
  const res = Calc.calcGiftTax(defaultAmountManwon * 10000, defaultRelation, DATA);
  return `
    <section class="calc-grid" aria-label="증여세 계산기">
      <div class="sheet">
        <h2 class="sheet-title">증여 조건</h2>
        <div class="field">
          <label for="gift-amount">증여 재산 가액 <span class="field-hint">10년 합산 기준</span></label>
          <div class="input-wrap"><input id="gift-amount" type="number" min="0" step="500" value="${defaultAmountManwon}" /><span class="input-unit">만 원</span></div>
          <div class="preset-row" id="gift-presets">
            <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
            <button type="button" class="chip-btn" data-preset="10000">1억</button>
            <button type="button" class="chip-btn" data-preset="30000">3억</button>
            <button type="button" class="chip-btn" data-preset="50000">5억</button>
            <button type="button" class="chip-btn" data-preset="100000">10억</button>
          </div>
        </div>
        <div class="field">
          <label for="gift-relation">증여자와의 관계 (공제 한도)</label>
          <select id="gift-relation">
            <option value="spouse" ${defaultRelation === "spouse" ? "selected" : ""}>배우자 (6억 원 공제)</option>
            <option value="adultChild" ${defaultRelation === "adultChild" ? "selected" : ""}>성년 자녀 (5,000만 원 공제)</option>
            <option value="minorChild" ${defaultRelation === "minorChild" ? "selected" : ""}>미성년 자녀 (2,000만 원 공제)</option>
            <option value="parent" ${defaultRelation === "parent" ? "selected" : ""}>부모·직계존속 (5,000만 원 공제)</option>
            <option value="relative" ${defaultRelation === "relative" ? "selected" : ""}>기타 친족 (1,000만 원 공제)</option>
            <option value="other" ${defaultRelation === "other" ? "selected" : ""}>타인 (공제 없음)</option>
          </select>
        </div>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">증여세 산출 (자진신고 3% 반영)</h2>
        <div class="result-summary">
          <div class="result-label">최종 납부 예상 세액</div>
          <div class="result-main num" id="res-gift-final">${Calc.formatWon(res.finalTax)}</div>
          <div class="result-sub num" id="res-gift-sub">자진신고 3% 공제 적용 · 실효세율 ${Calc.formatPercent(res.effectiveRate, 1)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>증여 재산 가액</th><td id="res-gift-gross">${Calc.formatWon(res.gift)}</td></tr>
            <tr><th>증여재산공제</th><td id="res-gift-ded">-${Calc.formatWon(res.deductionApplied)}</td></tr>
            <tr><th>과세표준</th><td id="res-gift-base">${Calc.formatWon(res.taxBase)}</td></tr>
            <tr><th>산출세액</th><td id="res-gift-calc">${Calc.formatWon(res.calculatedTax)}</td></tr>
            <tr class="total-row"><th>자진신고 세액공제 (3%)</th><td id="res-gift-credit">-${Calc.formatWon(res.voluntaryCredit)}</td></tr>
          </tbody>
        </table>
        <div class="result-actions"><button type="button" class="btn-ghost" id="copy-gift-btn">결과 복사</button></div>
      </div>
    </section>
  `;
}

function buildGiftTaxPages() {
  const cases = DATA.pseo.giftTaxCases;
  const matrixLinks = (currentSlug) => `
    <section class="section-block">
      <h2>관계·금액별 증여세</h2>
      <div class="link-matrix">
        ${cases
          .map(
            (c) =>
              `<a class="matrix-pill ${currentSlug === c.slug ? "current" : ""}" href="/gift-tax/${c.slug}/">${RELATION_LABELS[c.relation]} ${formatKoreanManwonLabel(c.amountManwon)}</a>`
          )
          .join("")}
      </div>
    </section>
  `;

  writePage(
    "/gift-tax/",
    renderLayout({
      routePath: "/gift-tax/",
      title: `${DATA.year} 증여세 계산기 (공제 한도 · 자진신고 3%)`,
      description: "배우자·자녀·친족 증여재산공제 한도와 10~50% 누진세율, 자진신고 3% 공제를 반영한 증여세 계산기.",
      activeNav: "gift-tax",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "증여세", href: "/gift-tax/" }],
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 증여세 계산기</h1>
          <p class="subtitle">증여자 관계별 10년 공제 한도와 누진세율, 3개월 이내 자진신고 3% 공제를 반영해 계산합니다.</p>
        </header>
        ${renderGiftTaxWidget(10000, "adultChild")}
        ${renderAdSlot("calcMid")}
        ${renderAffiliateCard("giftTax")}
        ${matrixLinks(null)}
      `
    })
  );

  cases.forEach((c, idx) => {
    const relLabel = RELATION_LABELS[c.relation];
    const amtLabel = formatKoreanManwonLabel(c.amountManwon);
    const res = Calc.calcGiftTax(c.amountManwon * 10000, c.relation, DATA);
    const prev = idx > 0 ? { href: `/gift-tax/${cases[idx - 1].slug}/`, label: `${RELATION_LABELS[cases[idx - 1].relation]} ${formatKoreanManwonLabel(cases[idx - 1].amountManwon)}` } : null;
    const next = idx < cases.length - 1 ? { href: `/gift-tax/${cases[idx + 1].slug}/`, label: `${RELATION_LABELS[cases[idx + 1].relation]} ${formatKoreanManwonLabel(cases[idx + 1].amountManwon)}` } : null;
    writePage(
      `/gift-tax/${c.slug}/`,
      renderLayout({
        routePath: `/gift-tax/${c.slug}/`,
        title: `${relLabel} ${amtLabel} 증여세 (${Calc.formatWon(res.finalTax)})`,
        description: `${relLabel}에게 ${amtLabel} 증여 시 공제 적용 및 자진신고 3% 공제 후 최종 증여세는 ${Calc.formatWon(res.finalTax)}입니다.`,
        activeNav: "gift-tax",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "증여세", href: "/gift-tax/" },
          { label: `${relLabel} ${amtLabel}`, href: `/gift-tax/${c.slug}/` }
        ],
        bodyHtml: `
          <header class="page-head">
            <h1>${relLabel} ${amtLabel} 증여세</h1>
            <p class="subtitle">증여재산공제 ${Calc.formatWon(res.deductionApplied)} 적용 및 자진신고 3% 공제 시 납부세액은 <strong>${Calc.formatWon(res.finalTax)}</strong>입니다.</p>
          </header>
          ${renderGiftTaxWidget(c.amountManwon, c.relation)}
          ${renderAffiliateCard("giftTax")}
          ${renderPrevNext(prev, next)}
          ${matrixLinks(c.slug)}
        `
      })
    );
  });
}

/* HOME PAGE */
function buildHomePage() {
  writePage(
    "/",
    renderLayout({
      routePath: "/",
      title: `${DATA.siteTagline}`,
      description: `${DATA.year}년 한국 세금·금융 계산기 9종. 연봉 실수령액, 프리랜서 3.3%, 퇴직금, 실업급여, 주휴수당, 해외주식 양도세, 주택 취등록세, 증여세, 전월세 전환율.`,
      activeNav: "",
      priority: "1.0",
      breadcrumbs: [],
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>${DATA.year} 세금·금융 계산기</h1>
            <span class="meta-tag">9개 계산기 · ${DATA.updatedAt} 기준</span>
          </div>
          <p class="subtitle">국내 세율·4대보험·고용보험 기준 실수령액과 납부세액을 바로 계산합니다.</p>
        </header>

        <section class="directory-grid" aria-label="전체 계산기">
          <a class="dir-card" href="/salary/">
            <span class="dir-cat">급여 · 4대보험</span>
            <h2>연봉 실수령액</h2>
            <p>국민연금·건강보험·소득세 공제 후 월 실수령액</p>
          </a>
          <a class="dir-card" href="/freelancer/">
            <span class="dir-cat">사업소득</span>
            <h2>프리랜서 3.3%</h2>
            <p>3.3% 원천징수 실수령 및 세전 계약금 역산</p>
          </a>
          <a class="dir-card" href="/severance/">
            <span class="dir-cat">퇴직 · 이직</span>
            <h2>퇴직금 계산기</h2>
            <p>근속연수공제 및 퇴직소득세 반영 실수령액</p>
          </a>
          <a class="dir-card" href="/unemployment/">
            <span class="dir-cat">고용보험</span>
            <h2>실업급여 계산기</h2>
            <p>1일 구직급여 상·하한액 및 소정급여일수 산출</p>
          </a>
          <a class="dir-card" href="/weekly-holiday/">
            <span class="dir-cat">단시간 근로</span>
            <h2>주휴수당 계산기</h2>
            <p>주 15시간 이상 주휴수당 및 월 환산 급여</p>
          </a>
          <a class="dir-card" href="/stock-tax/">
            <span class="dir-cat">해외투자</span>
            <h2>해외주식 양도세</h2>
            <p>연 250만 원 공제·손익통산 22% 양도세</p>
          </a>
          <a class="dir-card" href="/real-estate/">
            <span class="dir-cat">부동산</span>
            <h2>주택 취등록세</h2>
            <p>6억·9억 구간별 취득세·지방교육세·농특세</p>
          </a>
          <a class="dir-card" href="/gift-tax/">
            <span class="dir-cat">상속 · 증여</span>
            <h2>증여세 계산기</h2>
            <p>관계별 10년 공제 한도 및 자진신고 3% 공제</p>
          </a>
          <a class="dir-card" href="/jeonse/">
            <span class="dir-cat">임대차</span>
            <h2>전월세 전환율</h2>
            <p>전세 보증금 차액 기준 적정 월세 산출</p>
          </a>
        </section>

        ${renderAdSlot("homeMid")}

        <section class="section-block">
          <h2>자주 찾는 구간 바로가기</h2>
          <div class="link-matrix">
            <a class="matrix-pill" href="/salary/4000-manwon/">연봉 4,000만 원</a>
            <a class="matrix-pill" href="/salary/5000-manwon/">연봉 5,000만 원</a>
            <a class="matrix-pill" href="/salary/7000-manwon/">연봉 7,000만 원</a>
            <a class="matrix-pill" href="/salary/10000-manwon/">연봉 1억 원</a>
            <a class="matrix-pill" href="/severance/350-manwon-3-year/">월 350만 · 3년 퇴직금</a>
            <a class="matrix-pill" href="/unemployment/350-manwon-3-year/">월 350만 · 3년 실업급여</a>
            <a class="matrix-pill" href="/weekly-holiday/10030-won-20-hours/">최저시급 주 20시간 주휴수당</a>
            <a class="matrix-pill" href="/stock-tax/1000-manwon/">해외주식 1,000만 원 양도세</a>
            <a class="matrix-pill" href="/gift-tax/adult-child-1-eok/">성년 자녀 1억 증여세</a>
            <a class="matrix-pill" href="/real-estate/6-eok/">6억 아파트 취등록세</a>
          </div>
        </section>
      `
    })
  );
}

function buildTrustPages() {
  const repoIssueUrl = DATA.repoUrl ? `${DATA.repoUrl}/issues` : "https://github.com";

  writePage(
    "/about/",
    renderLayout({
      routePath: "/about/",
      title: "사이트 소개 · 산출 기준 및 면책고지",
      description: `${DATA.siteName}의 ${DATA.year}년 한국 세금·금융·근로 계산기 9종 산출 기준, 공식 참고 출처 및 면책고지 안내.`,
      activeNav: "",
      priority: "0.5",
      breadcrumbs: [
        { label: "홈", href: "/" },
        { label: "사이트 소개", href: "/about/" }
      ],
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>${escapeHtml(DATA.siteName)} 소개 · 면책고지</h1>
            <span class="meta-tag">${DATA.year}년 세율·요율 기준</span>
          </div>
          <p class="subtitle">복잡한 한국 세금·4대보험·부동산·근로 급여 계산을 누구나 빠르고 투명하게 확인할 수 있도록 만든 무료 계산기 허브입니다.</p>
        </header>

        <article class="prose-sheet">
          <h2>1. 제공 중인 9종 계산기</h2>
          <ul>
            <li><a href="/salary/">연봉 실수령액 계산기</a> — 4대보험(국민연금·건강보험·장기요양보험·고용보험) 및 근로소득세·지방소득세 추정</li>
            <li><a href="/freelancer/">프리랜서 3.3% 계산기</a> — 사업소득 원천징수(소득세 3% + 지방소득세 0.3%) 정산 및 세후→세전 역산</li>
            <li><a href="/severance/">퇴직금 계산기</a> — 계속근로기간 기준 법정 퇴직금 및 근속연수공제 반영 퇴직소득세 추정</li>
            <li><a href="/unemployment/">실업급여 계산기</a> — 연령·피보험기간별 소정급여일수 및 상·하한액 적용 구직급여 산출</li>
            <li><a href="/weekly-holiday/">주휴수당 계산기</a> — 주 15시간 이상 근로 기준 주휴수당 및 월 환산 급여 계산</li>
            <li><a href="/stock-tax/">해외주식 양도소득세 계산기</a> — 연간 250만 원 기본공제 및 손익통산 후 22%(양도세 20%+지방세 2%) 산출</li>
            <li><a href="/real-estate/">주택 취등록세 계산기</a> — 6억·9억 구간별 세율, 다주택 중과, 전용 85㎡ 초과 농어촌특별세 반영</li>
            <li><a href="/gift-tax/">증여세 계산기</a> — 수증자 관계별 10년 공제 한도, 누진세율, 자진신고 3% 세액공제 반영</li>
            <li><a href="/jeonse/">전월세 전환율 계산기</a> — 보증금 차액과 전환율 기준 적정 월세 산출</li>
          </ul>

          <h2>2. 세율·요율 공식 참고 출처</h2>
          <p>모든 계산 로직은 대한민국 관계 기관의 공개 법령과 고시 자료를 바탕으로 주기적으로 점검합니다.</p>
          <ul>
            <li>소득세·양도소득세·증여세: <a href="https://www.hometax.go.kr" target="_blank" rel="noopener noreferrer">국세청 홈택스</a></li>
            <li>지방세(취득세·지방교육세): <a href="https://www.wetax.go.kr" target="_blank" rel="noopener noreferrer">위택스(WeTax)</a></li>
            <li>실업급여·최저임금·근로기준: <a href="https://www.work24.go.kr" target="_blank" rel="noopener noreferrer">고용24</a> 및 <a href="https://www.moel.go.kr" target="_blank" rel="noopener noreferrer">고용노동부</a></li>
            <li>금융상품·임대차 참고: <a href="https://fine.fss.or.kr" target="_blank" rel="noopener noreferrer">금융감독원 파인</a> 및 <a href="https://www.khug.or.kr" target="_blank" rel="noopener noreferrer">주택도시보증공사(HUG)</a></li>
          </ul>

          <h2>3. 면책고지 (Disclaimer)</h2>
          <p>${escapeHtml(DATA.siteName)}의 모든 계산 결과는 일반적인 법정 요율을 적용한 <strong>참고용 추정치</strong>입니다. 비과세 항목 구성, 부양가족·자녀 세액공제, 생애최초·신혼부부 감면, 조정대상지역 여부, 과거 10년 내 합산 증여 이력 등 개인별 특수 조건에 따라 실제 신고·납부 세액과 차이가 발생할 수 있습니다. 실제 세무 신고나 계약 결정 전에는 반드시 관할 세무서, 홈택스 모의계산 또는 세무 전문가의 확인을 받으시기 바랍니다.</p>

          <h2>4. 오류 제보 및 문의</h2>
          <p>계산 공식 오류 제보, 신규 계산기 제안, 세율 개정 반영 요청은 <a href="${escapeHtml(repoIssueUrl)}" target="_blank" rel="noopener noreferrer">GitHub Issues</a>를 통해 남겨주시면 확인 후 반영합니다.</p>
        </article>
      `
    })
  );

  writePage(
    "/privacy/",
    renderLayout({
      routePath: "/privacy/",
      title: "개인정보처리방침",
      description: `${DATA.siteName} 개인정보처리방침. 브라우저 내 클라이언트 계산 방식 및 쿠키·광고·접속 통계 안내.`,
      activeNav: "",
      priority: "0.4",
      breadcrumbs: [
        { label: "홈", href: "/" },
        { label: "개인정보처리방침", href: "/privacy/" }
      ],
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>개인정보처리방침</h1>
            <span class="meta-tag">시행일: ${DATA.updatedAt}</span>
          </div>
          <p class="subtitle">${escapeHtml(DATA.siteName)}는 이용자의 급여·자산·세금 입력 정보를 서버로 전송하거나 저장하지 않습니다.</p>
        </header>

        <article class="prose-sheet">
          <h2>1. 개인정보의 수집 및 처리 방식</h2>
          <p>${escapeHtml(DATA.siteName)}는 회원가입 없이 누구나 이용할 수 있는 정적 웹 계산기 서비스입니다. 이용자가 연봉, 보증금, 증여액, 주식 수익 등 계산기에 입력하는 모든 수치는 <strong>이용자의 웹 브라우저 내부(클라이언트 측 JavaScript)에서만 즉시 계산</strong>되며, 외부 서버로 전송·저장·수집되지 않습니다.</p>

          <h2>2. 쿠키(Cookie) 및 자동 수집 정보</h2>
          <p>본 사이트는 서비스 품질 개선 및 무료 운영 유지를 위해 향후 아래와 같은 제3자 도구를 사용할 수 있습니다.</p>
          <ul>
            <li><strong>웹 접속 통계 (Google Analytics 등)</strong>: 방문 페이지, 체류 시간, 기기 유형 등 개인을 직접 식별하지 않는 익명화된 트래픽 통계 분석</li>
            <li><strong>광고 서비스 (Google AdSense 등)</strong>: 제3자 광고 사업자가 이용자의 이전 방문 기록을 바탕으로 맞춤형 광고를 제공하기 위해 쿠키를 사용할 수 있습니다.</li>
          </ul>
          <p>이용자는 브라우저 설정에서 쿠키 저장을 거부하거나, <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서 맞춤형 광고를 비활성화할 수 있습니다.</p>

          <h2>3. 외부 링크에 대한 책임</h2>
          <p>본 사이트에는 국세청 홈택스, 위택스, 고용24 등 외부 공식 기관 또는 제휴 안내 페이지로 연결되는 링크가 포함되어 있습니다. 외부 사이트 이동 후의 개인정보 처리는 해당 사이트의 개인정보처리방침을 따릅니다.</p>

          <h2>4. 개인정보 보호 문의</h2>
          <p>본 방침에 관한 문의 사항은 <a href="${escapeHtml(repoIssueUrl)}" target="_blank" rel="noopener noreferrer">GitHub 저장소 문의 페이지</a>를 통해 접수할 수 있으며, 법령 또는 서비스 변경에 따라 방침이 개정될 경우 본 페이지를 통해 공지합니다.</p>
        </article>
      `
    })
  );

  writeRootFile(
    "404.html",
    renderLayout({
      routePath: "/404.html",
      title: "페이지를 찾을 수 없습니다 (404)",
      description: "요청하신 페이지를 찾을 수 없습니다. 셈노트 9종 계산기 목록으로 이동해 주세요.",
      activeNav: "",
      includeInSitemap: false,
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "404", href: "/404.html" }],
      bodyHtml: `
        <section class="not-found-box">
          <div class="not-found-code num">404</div>
          <h1>요청하신 페이지를 찾을 수 없습니다</h1>
          <p class="subtitle">주소가 변경되었거나 잘못 입력된 경로입니다. 아래 버튼 또는 상단 메뉴에서 원하시는 계산기를 선택해 주세요.</p>
          <a class="not-found-cta" href="/">셈노트 홈으로 이동 →</a>
        </section>

        <section class="section-block">
          <h2>전체 계산기 바로가기</h2>
          <div class="link-matrix">
            <a class="matrix-pill" href="/salary/">연봉 실수령액</a>
            <a class="matrix-pill" href="/freelancer/">프리랜서 3.3%</a>
            <a class="matrix-pill" href="/severance/">퇴직금</a>
            <a class="matrix-pill" href="/unemployment/">실업급여</a>
            <a class="matrix-pill" href="/weekly-holiday/">주휴수당</a>
            <a class="matrix-pill" href="/stock-tax/">해외주식 양도세</a>
            <a class="matrix-pill" href="/real-estate/">주택 취등록세</a>
            <a class="matrix-pill" href="/gift-tax/">증여세</a>
            <a class="matrix-pill" href="/jeonse/">전월세 전환율</a>
          </div>
        </section>
      `
    })
  );
}

function writeSeoFiles() {
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${GENERATED_URLS.map(
  (u) => `  <url>
    <loc>${escapeHtml(u.loc)}</loc>
    <lastmod>${DATA.updatedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(DIST, "sitemap.xml"), sitemapXml, "utf8");

  const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
  fs.writeFileSync(path.join(DIST, "robots.txt"), robotsTxt, "utf8");

  const pubId = DATA.monetization && DATA.monetization.adsensePublisherId;
  const cleanPub = pubId ? pubId.replace(/^ca-/, "") : "";
  const adsTxt = cleanPub
    ? `google.com, ${cleanPub}, DIRECT, f08c47fec0942fa0\n`
    : `# data/rates-2026.json의 monetization.adsensePublisherId 입력 후 빌드하면 자동 생성됩니다.\n`;
  fs.writeFileSync(path.join(DIST, "ads.txt"), adsTxt, "utf8");
  fs.writeFileSync(path.join(DIST, ".nojekyll"), "", "utf8");
}

function main() {
  const start = Date.now();
  cleanDist();
  copyAssets();
  buildHomePage();
  buildSalaryPages();
  buildFreelancerPages();
  buildStockTaxPages();
  buildRealEstatePages();
  buildJeonsePage();
  buildSeverancePages();
  buildUnemploymentPages();
  buildWeeklyHolidayPages();
  buildGiftTaxPages();
  buildTrustPages();
  writeSeoFiles();
  const elapsed = Date.now() - start;
  console.log(`Built ${GENERATED_URLS.length} static SEO pages in ${elapsed}ms -> ${DIST}`);
}

main();
