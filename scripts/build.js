#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Calc = require("../src/calculators");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "rates-2026.json"), "utf8"));
const TAX_TIPS = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "tax-tips-2026.json"), "utf8"));

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
  adultGrandchild: "성년 손자녀",
  minorGrandchild: "미성년 손자녀",
  parent: "부모(자녀가 증여)",
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
  const files = ["styles.css", "wage-tax-table-2026.js", "calculators.js", "app.js", "favicon.svg", "og-image.svg", "profile.jpg"];
  for (const file of files) {
    fs.copyFileSync(path.join(ROOT, "src", file), path.join(DIST, "assets", file));
  }
}

function negWon(value) {
  return (value > 0 ? "-" : "") + Calc.formatWon(value);
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

function renderPartnerCard(key) {
  const p = DATA.partners && DATA.partners[key];
  if (!p || !p.url) return "";
  return `
    <aside class="partner-card" aria-label="제휴 광고">
      <span class="partner-badge">${escapeHtml(DATA.partnerDisclosure || "광고 · 제휴 링크")}</span>
      <div class="partner-body">
        <div>
          <strong>${escapeHtml(p.title)}</strong>
          <span>${escapeHtml(p.description)}</span>
        </div>
        <a class="partner-cta" href="${escapeHtml(p.url)}" target="_blank" rel="sponsored noopener noreferrer">${escapeHtml(p.cta)} →</a>
      </div>
    </aside>
  `;
}

function renderOfficialLinks(key) {
  const links = DATA.officialLinks && DATA.officialLinks[key];
  if (!links || !links.length) return "";
  return `
    <section class="section-block official-links" aria-label="관련 공식 사이트 바로가기">
      <h2>공식 사이트 바로가기</h2>
      <p class="official-links-sub">계산 결과를 실제 신고·신청으로 이어갈 수 있는 정부·공공기관 사이트입니다. 새 창으로 열립니다.</p>
      <div class="official-grid">
        ${links
          .map(
            (l) => `<a class="official-card" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
          <strong>${escapeHtml(l.label)} <span aria-hidden="true">↗</span></strong>
          <span>${escapeHtml(l.desc)}</span>
        </a>`
          )
          .join("")}
      </div>
      <a class="official-more" href="/links/">세금·노동 공식 사이트 전체 모음 →</a>
    </section>
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

function renderCompareTable({ title, subtitle, headers, rows }) {
  if (!rows || !rows.length) return "";
  return `
    <section class="section-block" aria-label="${escapeHtml(title)}">
      <h2>${escapeHtml(title)}</h2>
      ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              ${headers
                .map((h) => `<th class="${h.num ? "num-col" : ""}">${escapeHtml(h.label)}</th>`)
                .join("")}
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `<tr class="${r.current ? "is-current" : ""}">
                ${r.cells
                  .map((c, idx) => {
                    const cls = headers[idx] && headers[idx].num ? ' class="num-col"' : "";
                    if (c && typeof c === "object" && c.href) {
                      return `<td${cls}><a href="${c.href}">${escapeHtml(c.label)}</a></td>`;
                    }
                    return `<td${cls}>${escapeHtml(c)}</td>`;
                  })
                  .join("")}
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRelatedCalcs(items) {
  if (!items || !items.length) return "";
  return `
    <section class="section-block" aria-label="이어서 계산하기">
      <h2>이어서 계산해 보세요</h2>
      <div class="official-grid">
        ${items
          .map(
            (it) => `<a class="official-card" href="${it.href}">
          <strong>${escapeHtml(it.title)} <span aria-hidden="true">→</span></strong>
          <span>${escapeHtml(it.desc)}</span>
        </a>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderTaxTipsSection(key) {
  const cat = TAX_TIPS && TAX_TIPS.categories && TAX_TIPS.categories[key];
  if (!cat || !cat.tips || !cat.tips.length) return "";
  return `
    <section class="section-block tips-section" aria-label="${escapeHtml(cat.title)}">
      <div class="tips-head">
        <div class="tips-head-title">
          <span class="tips-kicker">절세 꿀팁 · ${DATA.year}년 기준</span>
          <h2>${escapeHtml(cat.title)}</h2>
        </div>
        <a class="tips-more-link" href="/tips/#${escapeHtml(cat.slug)}">전체 세금 절세 모음 →</a>
      </div>
      ${cat.subtitle ? `<p class="tips-sub">${escapeHtml(cat.subtitle)}</p>` : ""}
      <div class="tips-grid">
        ${cat.tips
          .map(
            (tip, i) => `
          <article class="tip-card">
            <div class="tip-top">
              <span class="tip-num">TIP ${String(i + 1).padStart(2, "0")}</span>
              <span class="tip-tag">${escapeHtml(tip.tag)}</span>
            </div>
            <h3>${escapeHtml(tip.title)}</h3>
            <p>${escapeHtml(tip.body)}</p>
            ${tip.caution ? `<div class="tip-caution">주의 · ${escapeHtml(tip.caution)}</div>` : ""}
          </article>`
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderResultActions(prefix) {
  return `<div class="result-actions">
          <button type="button" class="btn-ghost" id="copy-${prefix}-btn">결과 복사</button>
          <button type="button" class="btn-ghost" id="link-${prefix}-btn">링크 복사</button>
          <button type="button" class="btn-ghost" id="img-${prefix}-btn">이미지 저장</button>
          <button type="button" class="btn-share" id="share-${prefix}-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>공유하기</button>
        </div>`;
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
    GENERATED_URLS.push({ loc: canonical, priority, title, description });
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
    { id: "jeonse", label: "전월세", href: "/jeonse/" },
    { id: "tips", label: "절세꿀팁", href: "/tips/" }
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
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(DATA.siteName)} RSS" href="/rss.xml" />
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
        <svg class="brand-mark" width="22" height="22" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="14" fill="#0f172a"/>
          <rect x="14" y="14" width="36" height="10" rx="3" fill="#2563eb"/>
          <rect x="14" y="30" width="10" height="8" rx="2" fill="#f8fafc"/>
          <rect x="27" y="30" width="10" height="8" rx="2" fill="#f8fafc"/>
          <rect x="40" y="30" width="10" height="8" rx="2" fill="#93c5fd"/>
          <rect x="14" y="42" width="10" height="8" rx="2" fill="#f8fafc"/>
          <rect x="27" y="42" width="10" height="8" rx="2" fill="#f8fafc"/>
          <rect x="40" y="42" width="10" height="8" rx="2" fill="#2563eb"/>
        </svg>
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
        <a href="/tips/">절세 꿀팁 모음</a>
        <a href="/links/">공식 사이트 모음</a>
        <a href="/about/">사이트 소개 · 면책고지</a>
        <a href="/privacy/">개인정보처리방침</a>
      </nav>
    </div>
  </footer>

  <script src="/assets/wage-tax-table-2026.js"></script>
  <script src="/assets/calculators.js"></script>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}

// 한국어 줄바꿈 보정: 한 글자 단어(월·및·총·약 등)와 숫자+단위가 줄 끝/줄 처음에 홀로 남지 않도록 다음 단어와 붙임
function bindShortWords(html) {
  const bodyIdx = html.indexOf("<body");
  if (bodyIdx < 0) return html;
  const head = html.slice(0, bodyIdx);
  const body = html.slice(bodyIdx);
  const NB = "\u00A0";
  // 태그 앞에 홀로 남는 한 글자 단어(약 <strong>, 및 <a> 등)를 다음 요소와 붙임
  const body2 = body.replace(/(^|[\s>(·,])([가-힣]) (?=<(?:strong|a|span|b|em)\b)/g, "$1$2" + NB);
  const parts = body2.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/);
  for (let i = 0; i < parts.length; i++) {
    const t = parts[i];
    if (!t || t.startsWith("<")) continue;
    parts[i] = t
      // 숫자(+만/억/천) 뒤 단위
      .replace(/([0-9][0-9,.]*(?:만|억|천)?) (원|명|년|개월|일|시간|주|세|건|채|%)/g, "$1" + NB + "$2")
      .replace(/([0-9]억) (?=[0-9])/g, "$1" + NB)
      .replace(/ ([×÷=+−]) /g, NB + "$1" + NB)
      .replace(/ · /g, NB + "· ")
      .replace(/(\d{4}\.) (\d{1,2}\.) (\d{1,2}\.)/g, "$1" + NB + "$2" + NB + "$3")
      .replace(/(20\d{2}) (?=[가-힣])/g, "$1" + NB)
      // 한 글자 단어는 뒤 단어와 붙임 (월 실수령액, 및 세전, 총 납부 등)
      .replace(/(?<=^|[\s(·,\u00A0])([가-힣]) (?=[가-힣0-9(A-Za-z])/g, "$1" + NB)
      // 문장 끝 한 글자 + 마침표 앞 단어 묶기 방지용: '~할 수 있습니다' 등 '수' 결합
      .replace(/ (수|것|때|중|후|전|내|외|분|등) /g, NB + "$1 ");
  }
  return head + parts.join("");
}

function applyBasePath(html) {
  return BASE_PATH ? html.replace(/\b(href|src)="\/(?!\/)/g, `$1="${BASE_PATH}/`) : html;
}

function writePage(routePath, html) {
  const rel = routePath.replace(/^\/+/, "");
  const outDir = rel ? path.join(DIST, rel) : DIST;
  ensureDir(outDir);
  fs.writeFileSync(path.join(outDir, "index.html"), bindShortWords(applyBasePath(html)), "utf8");
}

function writeRootFile(fileName, html) {
  ensureDir(DIST);
  fs.writeFileSync(path.join(DIST, fileName), bindShortWords(applyBasePath(html)), "utf8");
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
          <label for="salary-deps">공제대상가족 수 <span class="field-hint">본인·배우자 포함</span></label>
          <select id="salary-deps">
            ${Array.from({ length: 11 }, (_, i) => `<option value="${i + 1}"${i === 0 ? " selected" : ""}>${i + 1}명${i === 0 ? " (본인)" : ""}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="salary-children">8세 이상 20세 이하 자녀 수 <span class="field-hint">가족 수에 포함된 인원</span></label>
          <select id="salary-children">
            <option value="0" selected>없음</option>
            <option value="1">1명 (월 20,830원 차감)</option>
            <option value="2">2명 (월 45,830원 차감)</option>
            <option value="3">3명</option>
            <option value="4">4명</option>
            <option value="5">5명</option>
          </select>
        </div>
        <div class="field">
          <label for="salary-ratio">원천징수 비율 <span class="field-hint">근로자 선택</span></label>
          <select id="salary-ratio">
            <option value="0.8">80%</option>
            <option value="1" selected>100% (기본)</option>
            <option value="1.2">120%</option>
          </select>
        </div>
        <p class="calc-note">근로소득세는 소득세법 시행령 별표2 근로소득 간이세액표(2026. 2. 27. 개정) 원표를 그대로 조회합니다. 국민연금 기준소득월액 상한은 2026년 7월~2027년 6월 적용분(659만 원)입니다.</p>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">월 급여명세 추정</h2>
        <div class="result-summary">
          <div class="result-label">예상 월 실수령액</div>
          <div class="result-main num" id="res-monthly-net">${Calc.formatWon(res.monthlyNet)}</div>
          <div class="result-sub num" id="res-salary-sub">월 실수령 × 12 = 연 ${Calc.formatWon(res.annualNet)} · 공제율 ${Calc.formatPercent(res.effectiveDeductionRate, 1)}</div>
          <p class="result-note" id="res-salary-note" hidden></p>
          <div class="ratio-wrap" aria-hidden="true">
            <div class="ratio-bar">
              <div class="ratio-net" id="bar-net" style="width:${(res.monthlyGross > 0 ? (res.monthlyNet / res.monthlyGross) * 100 : 100).toFixed(1)}%"></div>
              <div class="ratio-deduct" id="bar-deduct" style="width:${(res.monthlyGross > 0 ? (1 - res.monthlyNet / res.monthlyGross) * 100 : 0).toFixed(1)}%"></div>
            </div>
            <div class="ratio-legend">
              <span class="dot-net" id="legend-net">실수령 ${(res.monthlyGross > 0 ? (res.monthlyNet / res.monthlyGross) * 100 : 100).toFixed(1)}%</span>
              <span class="dot-deduct" id="legend-deduct">공제 ${(res.monthlyGross > 0 ? (1 - res.monthlyNet / res.monthlyGross) * 100 : 0).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>월 세전 급여</th><td id="res-monthly-gross">${Calc.formatWon(res.monthlyGross)}</td></tr>
            <tr><th>국민연금 (${(DATA.salary.nationalPensionRate * 100).toFixed(2)}%)</th><td id="res-pension">${Calc.formatWon(res.nationalPension)}</td></tr>
            <tr><th>건강보험 (${(DATA.salary.healthInsuranceRate * 100).toFixed(3)}%)</th><td id="res-health">${Calc.formatWon(res.healthInsurance)}</td></tr>
            <tr><th>장기요양보험 (건보의 ${(DATA.salary.longTermCareRateOfHealth * 100).toFixed(2)}%)</th><td id="res-care">${Calc.formatWon(res.longTermCare)}</td></tr>
            <tr><th>고용보험 (${(DATA.salary.employmentInsuranceRate * 100).toFixed(1)}%)</th><td id="res-employment">${Calc.formatWon(res.employmentInsurance)}</td></tr>
            <tr><th>근로소득세 (간이세액표)</th><td id="res-income-tax">${Calc.formatWon(res.incomeTax)}</td></tr>
            <tr><th>지방소득세 (10%)</th><td id="res-local-tax">${Calc.formatWon(res.localIncomeTax)}</td></tr>
            <tr class="total-row"><th>월 공제액 합계</th><td id="res-total-deduction">${negWon(res.totalDeduction)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("salary")}
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
      a: `월 급여에서 비과세 식대(기본 20만 원)를 제외한 과세 급여를 기준으로 국민연금(${(DATA.salary.nationalPensionRate * 100).toFixed(2)}%, 기준소득월액 41만~659만 원·2026년 6월까지는 40만~637만 원), 건강보험(${(DATA.salary.healthInsuranceRate * 100).toFixed(3)}%), 장기요양보험(건강보험료의 ${(DATA.salary.longTermCareRateOfHealth * 100).toFixed(2)}%), 고용보험(${(DATA.salary.employmentInsuranceRate * 100).toFixed(1)}%)을 공제하고, 근로소득세는 소득세법 시행령 별표2 근로소득 간이세액표(2026. 2. 27. 개정) 원표에서 월급여·공제대상가족 수로 조회합니다. 지방소득세는 근로소득세의 10%입니다.`
    },
    {
      q: "자녀가 있으면 매달 떼는 세금이 줄어드나요?",
      a: "공제대상가족 중 8세 이상 20세 이하 자녀가 있으면 2026년 3월 이후 급여부터 간이세액표 세액에서 자녀 1명 20,830원, 2명 45,830원, 3명 이상은 2명 초과 1명당 33,330원을 추가로 뺍니다."
    },
    {
      q: "월 실수령액 × 12가 실제 연간 수령액과 같나요?",
      a: "아닙니다. 매달 떼는 세금은 간이세액표에 따른 선납분이고 최종 세액은 연말정산에서 확정됩니다. 국민연금 상한도 매년 7월 바뀌므로 상반기·하반기 공제액이 다를 수 있습니다."
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
          <p class="subtitle">연봉을 넣으면 4대보험과 근로소득세를 뺀 월 실수령액을 계산합니다.</p>
        </header>
        ${renderSalaryWidget(5000)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("salary")}
        ${renderAffiliateCard("salary")}
          ${renderOfficialLinks("salary")}
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
    const depRows = [1, 2, 3, 4].map((deps) => {
      const dRes = Calc.calcSalary(manwon * 10000, DATA.salary.defaultNonTaxableMonthly, deps, DATA);
      return {
        current: deps === 1,
        cells: [
          `${deps}명${deps === 1 ? " (본인)" : ""}`,
          Calc.formatWon(dRes.incomeTax + dRes.localIncomeTax),
          Calc.formatWon(dRes.totalDeduction),
          Calc.formatWon(dRes.monthlyNet),
          Calc.formatWon(dRes.annualNet)
        ]
      };
    });
    const salaryCompare = renderCompareTable({
      title: `연봉 ${label} 부양가족 수별 실수령액 비교`,
      subtitle: "비과세 식대 월 20만 원·원천징수 100% 기준입니다. 부양가족이 늘면 근로소득세가 줄어듭니다.",
      headers: [
        { label: "공제대상가족" },
        { label: "월 소득세+지방세", num: true },
        { label: "월 공제 합계", num: true },
        { label: "월 실수령액", num: true },
        { label: "연 실수령액", num: true }
      ],
      rows: depRows
    });
    const faqs = [
      {
        q: `연봉 ${label}의 월 실수령액은 얼마인가요?`,
        a: `${DATA.year}년 기준(공제대상가족 1명, 비과세 식대 20만 원, 간이세액표 100%) 세전 월급 ${Calc.formatWon(res.monthlyGross)}에서 ${Calc.formatWon(res.totalDeduction)}을 공제한 약 ${Calc.formatWon(res.monthlyNet)}입니다.`
      },
      {
        q: `연봉 ${label}에서 4대보험료는 매달 얼마가 빠져나가나요?`,
        a: `국민연금 ${Calc.formatWon(res.nationalPension)}, 건강보험 ${Calc.formatWon(res.healthInsurance)}, 장기요양보험 ${Calc.formatWon(res.longTermCare)}, 고용보험 ${Calc.formatWon(res.employmentInsurance)}을 합해 4대보험 총 ${Calc.formatWon(res.nationalPension + res.healthInsurance + res.longTermCare + res.employmentInsurance)}입니다.`
      }
    ];
    const related = renderRelatedCalcs([
      { title: "퇴직금 계산기", desc: `월급 약 ${Math.round(manwon / 12)}만 원 기준 근속연수별 퇴직금`, href: "/severance/" },
      { title: "실업급여 계산기", desc: "이직·퇴사 시 하루 구직급여와 총 수령액", href: "/unemployment/" },
      { title: "프리랜서 3.3% 비교", desc: "같은 금액을 사업소득 3.3%로 받을 때 실수령액", href: "/freelancer/" }
    ]);

    writePage(
      `/salary/${manwon}-manwon/`,
      renderLayout({
        routePath: `/salary/${manwon}-manwon/`,
        title: `연봉 ${label} 실수령액 (${Calc.formatWon(res.monthlyNet)})`,
        description: `${DATA.year}년 연봉 ${label}의 월 실수령액은 ${Calc.formatWon(res.monthlyNet)}입니다. 4대보험과 근로소득세 상세 내역 및 부양가족별 비교표를 확인하세요.`,
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
            <p class="subtitle">공제대상가족 1명·비과세 20만 원 기준 예상 월 실수령액은 <strong>${Calc.formatWon(res.monthlyNet)}</strong>입니다.</p>
          </header>
          ${renderSalaryWidget(manwon)}
          ${renderAdSlot("pseoMid")}
          ${salaryCompare}
          ${renderTaxTipsSection("salary")}
        ${renderAffiliateCard("salary")}
          ${renderOfficialLinks("salary")}
          ${related}
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
            <tr><th>지방소득세 (소득세의 10%)</th><td id="res-free-local">${Calc.formatWon(res.localTax)}</td></tr>
            <tr class="total-row"><th>원천징수 세액 합계</th><td id="res-free-total-tax">${negWon(res.totalTax)}</td></tr>
            <tr><th>최종 실수령액</th><td id="res-free-net">${Calc.formatWon(res.net)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("free")}
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
      a: "사업소득세 3.0%와 지방소득세(소득세의 10%, 0.3%)를 합산한 3.3%를 지급처가 원천징수하고 나머지 96.7%를 지급합니다. 각 세액의 10원 미만은 절사합니다."
    },
    {
      q: "3.3% 떼면 세금이 끝나나요? 5월에 환급받나요?",
      a: "3.3%는 미리 낸 세금(기납부세액)일 뿐이고, 다음 해 5월 종합소득세 확정신고에서 총수입금액·필요경비·공제를 반영해 최종 세액을 확정합니다. 결정세액이 기납부세액보다 적으면 환급, 많으면 추가 납부입니다. 수입이 크거나 다른 소득이 있으면 추가 납부가 나올 수 있습니다."
    },
    {
      q: "강연료·원고료도 3.3%인가요?",
      a: "계속·반복적인 인적용역은 사업소득 3.3%이지만, 일시적인 강연료·심사료 등은 기타소득으로 분류돼 필요경비 60% 공제 후 22%(지급액의 8.8%)를 원천징수합니다. 근로자처럼 지휘·감독을 받으며 일한다면 실질적으로 근로소득(4대보험·퇴직금 대상)일 수 있습니다."
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
          <p class="subtitle">3.3%를 떼고 받는 금액과, 원하는 실수령액에 맞는 세전 금액을 계산합니다.</p>
        </header>
        ${renderFreelancerWidget(300)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("freelancer")}
        ${renderAffiliateCard("freelancer")}
          ${renderPartnerCard("freelancer")}
          ${renderOfficialLinks("freelancer")}
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
          ${renderTaxTipsSection("freelancer")}
        ${renderAffiliateCard("freelancer")}
          ${renderPartnerCard("freelancer")}
          ${renderOfficialLinks("freelancer")}
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
        <details class="calc-details">
          <summary>2026 국내시장복귀계좌(RIA) 감면 적용</summary>
          <div class="field">
            <label for="stock-ria-gain">RIA로 매도한 양도차익 <span class="field-hint">2025.12.23 이전 보유분</span></label>
            <div class="input-wrap"><input id="stock-ria-gain" type="number" min="0" step="50" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <div class="field">
            <label for="stock-ria-period">매도 결제 완료일 <span class="field-hint">주문일 아님</span></label>
            <select id="stock-ria-period">
              <option value="" selected>RIA 미적용</option>
              <option value="may">2026.5.31까지 (100% 공제)</option>
              <option value="jul">2026.6.1~7.31 (80% 공제)</option>
              <option value="dec">2026.8.1~12.31 (50% 공제)</option>
            </select>
          </div>
          <div class="field">
            <label for="stock-ria-proceeds">RIA 납입액(매도대금) <span class="field-hint">한도 5,000만 원</span></label>
            <div class="input-wrap"><input id="stock-ria-proceeds" type="number" min="0" max="5000" step="100" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <div class="field">
            <label for="stock-ria-netbuy">RIA 외 계좌 해외주식 등 순매수액 <span class="field-hint">공제율 비례 축소</span></label>
            <div class="input-wrap"><input id="stock-ria-netbuy" type="number" min="0" step="100" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <p class="calc-note">조세특례제한법 제91조의26: RIA로 판 매도대금을 1년간 국내 주식·주식형 펀드 등에 유지해야 합니다. 순매수 축소는 시점별 가중치를 동일하게 본 간이 계산입니다.</p>
        </details>
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
            <tr><th>RIA 소득공제</th><td id="res-stock-ria">${negWon(res.riaDeduction)}</td></tr>
            <tr><th>연간 기본공제</th><td id="res-stock-deduction">${negWon(res.deductionApplied)}</td></tr>
            <tr><th>과세표준</th><td id="res-stock-base">${Calc.formatWon(res.taxableBase)}</td></tr>
            <tr><th>양도소득세 (20%)</th><td id="res-stock-cap-tax">${Calc.formatWon(res.capitalGainsTax)}</td></tr>
            <tr><th>지방소득세 (양도세의 10%)</th><td id="res-stock-local-tax">${Calc.formatWon(res.localTax)}</td></tr>
            <tr class="total-row"><th>세후 최종 순수익</th><td id="res-stock-after">${Calc.formatWon(res.afterTaxProfit)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("stock")}
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

  const stockFaqs = [
    {
      q: "해외주식 양도세는 어떻게 계산하나요?",
      a: "1년간(1.1~12.31, 결제일 기준) 실현한 양도차익에서 손실을 통산하고 기본공제 250만 원을 빼 양도소득세 20%와 지방소득세(양도세의 10%)를 냅니다. 취득가액과 양도가액은 각각 취득일·양도일의 기준환율로 원화 환산하므로 환차익도 과세되고, 증권거래 수수료 등은 필요경비로 빠집니다."
    },
    {
      q: "국내주식 손실과도 통산되나요?",
      a: "양도소득세 과세대상인 국내주식(대주주 주식·비상장주식 등)은 해외주식과 같은 그룹으로 손익이 통산되고, 기본공제 250만 원도 그룹 전체에서 한 번만 적용됩니다. 소액주주의 비과세 상장주식 손익은 통산 대상이 아닙니다."
    },
    {
      q: "2026년 RIA(국내시장복귀계좌) 감면은 무엇인가요?",
      a: "2025년 12월 23일 이전부터 보유한 해외주식을 RIA 계좌에서 팔고 매도대금을 1년간 국내 주식 등에 투자하면, 매도 결제일에 따라 양도소득의 100%(5월 말까지), 80%(6~7월), 50%(8~12월)를 공제합니다(조세특례제한법 제91조의26, 납입한도 1인 5,000만 원). RIA 외 계좌에서 해외주식을 순매수하면 공제율이 줄어듭니다."
    },
    {
      q: "수익이 250만 원 이하이면 신고하지 않아도 되나요?",
      a: "양도소득 확정신고는 과세표준이 없거나 결손이 있어도 적용되는 것이 원칙(소득세법 제110조)이지만, 납부할 세액이 없으면 무신고 가산세는 사실상 발생하지 않습니다. 다음 해 5월 1~31일에 홈택스에서 신고합니다."
    },
    {
      q: "가족에게 주식을 증여한 뒤 팔면 양도세가 줄어드나요?",
      a: "2025년부터 배우자·직계존비속에게 증여받은 주식을 1년 이내에 양도하면 증여자의 취득가액으로 양도차익을 계산(이월과세)하므로 절세 효과가 없습니다."
    }
  ];

  writePage(
    "/stock-tax/",
    renderLayout({
      routePath: "/stock-tax/",
      title: `${DATA.year} 해외주식 양도소득세 계산기`,
      description: "해외주식 연간 250만 원 기본공제, 손익통산, 2026 국내시장복귀계좌(RIA) 감면을 반영한 22% 양도소득세 계산기.",
      activeNav: "stock-tax",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "해외주식 양도세", href: "/stock-tax/" }],
      faqs: stockFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>해외주식 양도소득세 계산기</h1>
          <p class="subtitle">1년 동안의 해외주식 매매 손익으로 내야 할 양도소득세를 계산합니다.</p>
        </header>
        ${renderStockTaxWidget(1000)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("stockTax")}
        ${renderAffiliateCard("stockTax")}
          ${renderPartnerCard("stockTax")}
          ${renderOfficialLinks("stockTax")}
        ${matrixLinks(null)}
        ${renderFaqSection(stockFaqs)}
      `
    })
  );

  list.forEach((manwon, idx) => {
    const label = formatKoreanManwonLabel(manwon);
    const res = Calc.calcOverseasStockTax(manwon * 10000, 0, DATA);
    const prev = idx > 0 ? { href: `/stock-tax/${list[idx - 1]}-manwon/`, label: `수익 ${formatKoreanManwonLabel(list[idx - 1])}` } : null;
    const next = idx < list.length - 1 ? { href: `/stock-tax/${list[idx + 1]}-manwon/`, label: `수익 ${formatKoreanManwonLabel(list[idx + 1])}` } : null;
    const lossSteps = [0, 200, 500, 1000].filter((l) => l === 0 || l < manwon);
    const stockCompare = renderCompareTable({
      title: `해외주식 수익 ${label} 손익통산 시 세금 비교`,
      subtitle: "같은 해 실현한 해외주식 손실이 있다면 순수익에서 먼저 빼고 250만 원 기본공제를 적용합니다.",
      headers: [
        { label: "연간 실현 손실" },
        { label: "손익통산 순수익", num: true },
        { label: "과세표준", num: true },
        { label: "예상 양도세(22%)", num: true },
        { label: "세후 순수익", num: true }
      ],
      rows: lossSteps.map((lossM) => {
        const c = Calc.calcOverseasStockTax(manwon * 10000, lossM * 10000, DATA);
        return {
          current: lossM === 0,
          cells: [
            lossM === 0 ? "손실 없음 (0원)" : `${formatKoreanManwonLabel(lossM)} 손실`,
            Calc.formatWon(c.netProfit),
            Calc.formatWon(c.taxableBase),
            Calc.formatWon(c.totalTax),
            Calc.formatWon(c.afterTaxProfit)
          ]
        };
      })
    });
    const faqs = [
      {
        q: `해외주식 수익이 ${label}이면 양도소득세를 얼마나 내나요?`,
        a: `다른 해외주식 손실이 없다면 기본공제 250만 원을 뺀 과세표준 ${Calc.formatWon(res.taxableBase)}에 22%(양도세 20% + 지방소득세 2%)를 곱해 총 ${Calc.formatWon(res.totalTax)}을 다음 해 5월에 신고·납부합니다.`
      },
      {
        q: `해외주식 ${label} 양도세를 합법적으로 줄이는 방법이 있나요?`,
        a: "같은 해 12월 말 결제일 전까지 평가손실 종목을 매도해 손익통산하거나, 배우자(10년 6억 원 공제) 증여 후 이월과세 기간(1년) 경과 매도, 2026년 국내시장복귀계좌(RIA) 공제를 검토할 수 있습니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "증여세 계산기", desc: "배우자 6억 원 공제 등 증여 절세 시뮬레이션", href: "/gift-tax/" },
      { title: "연봉 실수령액", desc: "근로소득 4대보험과 월 실수령액 확인", href: "/salary/" },
      { title: "프리랜서 3.3%", desc: "5월 종합소득세 신고 대상 사업소득 정산", href: "/freelancer/" }
    ]);
    writePage(
      `/stock-tax/${manwon}-manwon/`,
      renderLayout({
        routePath: `/stock-tax/${manwon}-manwon/`,
        title: `해외주식 수익 ${label} 양도소득세 (${Calc.formatWon(res.totalTax)})`,
        description: `해외주식 실현 수익 ${label} 기준 예상 양도소득세는 ${Calc.formatWon(res.totalTax)}입니다. 손익통산 절세 비교표와 신고 기준을 확인하세요.`,
        activeNav: "stock-tax",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "해외주식 양도세", href: "/stock-tax/" },
          { label: `수익 ${label}`, href: `/stock-tax/${manwon}-manwon/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>해외주식 수익 ${label} 양도소득세</h1>
            <p class="subtitle">기본공제 250만 원 적용 시 납부 예상 세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>입니다. (RIA 감면 미적용 기준)</p>
          </header>
          ${renderStockTaxWidget(manwon)}
          ${renderAdSlot("pseoMid")}
          ${stockCompare}
          ${renderTaxTipsSection("stockTax")}
        ${renderAffiliateCard("stockTax")}
          ${renderPartnerCard("stockTax")}
          ${renderOfficialLinks("stockTax")}
          ${related}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
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
          <label for="re-houses">취득 후 1세대 주택 수 <span class="field-hint">입주권·분양권·주거용 오피스텔 포함</span></label>
          <select id="re-houses">
            <option value="1" selected>1주택</option>
            <option value="2">2주택</option>
            <option value="3">3주택</option>
            <option value="4">4주택 이상</option>
          </select>
        </div>
        <div class="field">
          <label class="checkbox-row">
            <input id="re-adjusted" type="checkbox" />
            <span>취득 주택이 조정대상지역<small class="checkbox-hint">서울 전역과 경기 과천, 광명, 하남, 의왕, 구리, 성남(분당, 수정, 중원), 수원(영통, 장안, 팔달), 안양 동안, 용인(수지, 기흥), 화성 동탄</small></span>
          </label>
          <label class="checkbox-row">
            <input id="re-temp2" type="checkbox" />
            <span>일시적 2주택<small class="checkbox-hint">종전 주택을 기한 안에 처분할 예정</small></span>
          </label>
          <label class="checkbox-row">
            <input id="re-over85" type="checkbox" />
            <span>전용면적 85㎡ 초과<small class="checkbox-hint">농어촌특별세 부과</small></span>
          </label>
        </div>
        <div class="field">
          <label for="re-relief">취득세 감면 <span class="field-hint">12억 원 이하·1주택</span></label>
          <select id="re-relief">
            <option value="none" selected>해당 없음</option>
            <option value="first">생애최초 주택 구입 (최대 200만 원)</option>
            <option value="firstSmall">생애최초 · 소형주택/인구감소지역 (최대 300만 원)</option>
            <option value="birth">출산·양육 주택 (최대 500만 원)</option>
          </select>
        </div>
        <p class="calc-note">중과세율은 조정대상지역 2주택 8%, 3주택 이상 12%이고, 그 외 지역은 3주택 8%, 4주택 이상 12%입니다. 조정대상지역은 2026년 7월 1일 기준이며 바뀔 수 있으니 계약 전에 국토교통부 고시를 확인하세요. 공시가격 1억 원 이하 주택 등은 중과하지 않습니다.</p>
      </div>

      <div class="sheet receipt">
        <h2 class="sheet-title">취등록세 산출</h2>
        <div class="result-summary">
          <div class="result-label">총 납부 세액</div>
          <div class="result-main num" id="res-re-total">${Calc.formatWon(res.totalTax)}</div>
          <div class="result-sub num" id="res-re-sub">표준세율 · 총 실효세율 ${Calc.formatPercent(res.totalRate, 2)} (취득세율 ${Calc.formatPercent(res.acquisitionRate, 2)})</div>
          <p class="result-note" id="res-re-note" hidden></p>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>주택 매매가</th><td id="res-re-price">${Calc.formatWon(res.price)}</td></tr>
            <tr><th>취득세 (감면 전)</th><td id="res-re-acq-before">${Calc.formatWon(res.acquisitionTaxBeforeRelief)}</td></tr>
            <tr><th>취득세 감면</th><td id="res-re-relief">${negWon(res.reliefAmount)}</td></tr>
            <tr><th>납부 취득세</th><td id="res-re-acq">${Calc.formatWon(res.acquisitionTax)}</td></tr>
            <tr><th>지방교육세</th><td id="res-re-edu">${Calc.formatWon(res.localEducationTax)}</td></tr>
            <tr><th>농어촌특별세</th><td id="res-re-rural">${Calc.formatWon(res.ruralSpecialTax)}</td></tr>
            <tr class="total-row"><th>총 납부세액 합계</th><td id="res-re-sum">${Calc.formatWon(res.totalTax)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("re")}
      </div>
    </section>
  `;
}

function buildRealEstatePages() {
  const list = DATA.pseo.realEstateEok;
  const realEstateFaqs = [
    {
      q: "주택 취득세율은 어떻게 정해지나요?",
      a: "유상 매매 표준세율은 취득가액 6억 원 이하 1%, 9억 원 초과 3%이고, 그 사이는 (취득가액 × 2/3억 원 − 3) × 1/100 산식(소수점 넷째자리)입니다. 지방교육세는 취득세율의 10%, 전용 85㎡ 초과 주택은 농어촌특별세 0.2%가 추가됩니다."
    },
    {
      q: "2주택이면 무조건 8%인가요?",
      a: "아닙니다. 조정대상지역의 주택을 취득해 2주택이 되는 경우(일시적 2주택 제외)만 8%이고, 비조정지역 주택을 취득해 2주택이 되면 1~3% 표준세율입니다. 3주택은 조정 12%·비조정 8%, 4주택 이상은 12%입니다."
    },
    {
      q: "중과세가 되면 지방교육세·농어촌특별세는 얼마인가요?",
      a: "중과 시 지방교육세는 취득가액의 0.4%로 고정되고, 전용 85㎡ 초과 주택의 농어촌특별세는 8% 중과 0.6%, 12% 중과 1.0%입니다."
    },
    {
      q: "생애최초·출산 감면은 얼마인가요?",
      a: "취득가액 12억 원 이하 주택을 2028년 12월 31일까지 살 때, 생애최초는 취득세 최대 200만 원(소형주택·인구감소지역 300만 원), 출산·양육 주택은 최대 500만 원을 감면합니다. 두 감면에 모두 해당하면 감면액이 큰 쪽 하나만 적용되고, 취득일부터 3년 안에 매각·증여·임대하면 추징됩니다."
    }
  ];
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
      description: "주택 매매가, 보유 주택 수, 조정대상지역·일시적 2주택 여부, 전용 85㎡, 생애최초·출산 감면을 반영한 주택 취득세 계산기.",
      activeNav: "real-estate",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "주택 취등록세", href: "/real-estate/" }],
      faqs: realEstateFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>아파트·주택 취등록세 계산기</h1>
          <p class="subtitle">집값과 보유 주택 수로 취득세, 지방교육세, 농어촌특별세를 계산합니다.</p>
        </header>
        ${renderRealEstateWidget(6)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("realEstate")}
        ${renderAffiliateCard("realEstate")}
          ${renderOfficialLinks("realEstate")}
        ${matrixLinks(null)}
        ${renderFaqSection(realEstateFaqs)}
      `
    })
  );

  list.forEach((eok, idx) => {
    const priceWon = eok * 100000000;
    const res = Calc.calcAcquisitionTax(priceWon, 1, false, DATA);
    const prev = idx > 0 ? { href: `/real-estate/${list[idx - 1]}-eok/`, label: `${list[idx - 1]}억 원 취등록세` } : null;
    const next = idx < list.length - 1 ? { href: `/real-estate/${list[idx + 1]}-eok/`, label: `${list[idx + 1]}억 원 취등록세` } : null;
    const scenarios = [
      { label: "1주택 (전용 85㎡ 이하)", opts: [1, false, {}], current: true },
      { label: "1주택 (전용 85㎡ 초과)", opts: [1, true, {}] },
      ...(eok <= 12
        ? [
            { label: "생애최초 감면 (최대 200만 원)", opts: [1, false, { relief: "first" }] },
            { label: "출산·양육 감면 (최대 500만 원)", opts: [1, false, { relief: "birth" }] }
          ]
        : []),
      { label: "2주택 (조정대상지역 8%)", opts: [2, false, { adjusted: true }] },
      { label: "3주택 (조정대상지역 12%)", opts: [3, false, { adjusted: true }] }
    ];
    const reCompare = renderCompareTable({
      title: `매매가 ${eok}억 원 조건별 취등록세 비교`,
      subtitle: "보유 주택 수, 조정대상지역 여부, 전용면적 85㎡ 초과 및 생애최초·출산 감면에 따른 총 납부 세액 비교입니다.",
      headers: [
        { label: "매수 조건" },
        { label: "취득세", num: true },
        { label: "지방교육세", num: true },
        { label: "농어촌특별세", num: true },
        { label: "총 납부세액", num: true }
      ],
      rows: scenarios.map((sc) => {
        const c = Calc.calcAcquisitionTax(priceWon, sc.opts[0], sc.opts[1], DATA, sc.opts[2]);
        return {
          current: Boolean(sc.current),
          cells: [
            sc.label,
            Calc.formatWon(c.acquisitionTax),
            Calc.formatWon(c.localEducationTax),
            Calc.formatWon(c.ruralSpecialTax),
            Calc.formatWon(c.totalTax)
          ]
        };
      })
    });
    const resFirst = eok <= 12 ? Calc.calcAcquisitionTax(priceWon, 1, false, DATA, { relief: "first" }) : null;
    const faqs = [
      {
        q: `${eok}억 원 아파트 1주택 취등록세는 총 얼마인가요?`,
        a: `전용 85㎡ 이하 1주택(감면 미적용) 기준으로 취득세 ${Calc.formatWon(res.acquisitionTax)}(세율 ${Calc.formatPercent(res.acquisitionRate, 2)})과 지방교육세 ${Calc.formatWon(res.localEducationTax)}를 합해 총 ${Calc.formatWon(res.totalTax)}입니다.`
      },
      {
        q: `${eok}억 원 주택 매수 시 생애최초 감면이 되나요?`,
        a: resFirst
          ? `매매가 12억 원 이하 요건에 해당하므로 무주택 세대가 생애최초 주택 구입 시 최대 200만 원을 감면받아 총 세액이 ${Calc.formatWon(resFirst.totalTax)}까지 줄어듭니다.`
          : "생애최초·출산 주택 취득세 감면은 취득가액 12억 원 이하 주택에만 적용되므로 매매가 12억 원을 초과하는 경우 일반 세율이 적용됩니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "전월세 전환율", desc: "전세 보증금을 월세로 바꿀 때 적정 월세 계산", href: "/jeonse/" },
      { title: "증여세 계산기", desc: "가족 간 주택 자금·혼인 공제 증여세 확인", href: "/gift-tax/" },
      { title: "연봉 실수령액", desc: "주담대 상환 여력 확인을 위한 월 실수령액", href: "/salary/" }
    ]);
    writePage(
      `/real-estate/${eok}-eok/`,
      renderLayout({
        routePath: `/real-estate/${eok}-eok/`,
        title: `${eok}억 원 아파트 취등록세 (${Calc.formatWon(res.totalTax)})`,
        description: `매매가 ${eok}억 원 1주택(전용 85㎡ 이하, 감면 미적용) 기준 예상 취득세·지방교육세 합계는 ${Calc.formatWon(res.totalTax)}입니다. 다주택·생애최초 감면 비교표를 확인하세요.`,
        activeNav: "real-estate",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "주택 취등록세", href: "/real-estate/" },
          { label: `${eok}억 원`, href: `/real-estate/${eok}-eok/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>매매가 ${eok}억 원 주택 취등록세</h1>
            <p class="subtitle">1주택(전용 85㎡ 이하, 감면 미적용) 기준 총 납부 세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>입니다. 다주택·감면은 아래 계산기에서 선택하세요.</p>
          </header>
          ${renderRealEstateWidget(eok)}
          ${renderAdSlot("pseoMid")}
          ${reCompare}
          ${renderTaxTipsSection("realEstate")}
        ${renderAffiliateCard("realEstate")}
          ${renderOfficialLinks("realEstate")}
          ${related}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
          ${matrixLinks(eok)}
        `
      })
    );
  });
}

/* 5. JEONSE */
function buildJeonsePage() {
  const res = Calc.calcJeonseToWolse(300000000, 100000000, undefined, DATA);
  const cap = res.legalCapRate;
  const jeonseFaqs = [
    {
      q: "전월세 전환율 법정 상한은 얼마인가요?",
      a: `주택임대차보호법 시행령 제9조에 따라 연 10%와 한국은행 기준금리 + 연 2%p 중 낮은 비율입니다. ${DATA.jeonse.baseRateAsOf} 기준금리 ${res.baseRate.toFixed(2)}%를 적용하면 상한은 연 ${cap.toFixed(1)}%입니다.`
    },
    {
      q: "신규 월세 계약에도 상한이 적용되나요?",
      a: "법정 상한은 계약 기간 중이거나 계약을 갱신하면서 보증금의 전부 또는 일부를 월세로 바꾸는 경우에 적용됩니다. 새로운 임차인과 체결하는 신규 계약은 당사자 합의로 정하며, 시장 전환율은 한국부동산원 전월세전환율 통계를 참고하세요."
    }
  ];
  writePage(
    "/jeonse/",
    renderLayout({
      routePath: "/jeonse/",
      title: `${DATA.year} 전월세 전환율 계산기`,
      description: "전세 보증금을 월세로 전환할 때 적정 월세와 연간 주거비를 계산합니다.",
      activeNav: "jeonse",
      priority: "0.85",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "전월세 전환율", href: "/jeonse/" }],
      faqs: jeonseFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>전월세 전환율 계산기</h1>
          <p class="subtitle">전세를 월세로 바꿀 때의 월세와 법정 상한(${cap.toFixed(1)}%)을 넘는지 확인합니다.</p>
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
              <div class="input-wrap"><input id="jw-rate" type="number" min="0" max="20" step="0.1" value="${cap}" /><span class="input-unit">%</span></div>
              <div class="preset-row" id="jw-rate-presets">
                <button type="button" class="chip-btn" data-preset="${cap}">법정 상한 ${cap.toFixed(1)}%</button>
                <button type="button" class="chip-btn" data-preset="4.0">4.0%</button>
                <button type="button" class="chip-btn" data-preset="4.5">4.5%</button>
                <button type="button" class="chip-btn" data-preset="6.0">6.0% (신규·시세 참고)</button>
              </div>
            </div>
            <p class="calc-note">법정 상한은 계약 기간 중·갱신 시 전환에만 적용됩니다(주택임대차보호법 제7조의2). 기준금리 ${res.baseRate.toFixed(2)}%(${DATA.jeonse.baseRateAsOf}) 반영.</p>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">전환 월세 산출</h2>
            <div class="result-summary">
              <div class="result-label">예상 월세</div>
              <div class="result-main num" id="res-jw-monthly">${Calc.formatWon(res.monthlyRent)}</div>
              <div class="result-sub num" id="res-jw-sub">연간 월세 합계 ${Calc.formatWon(res.yearlyRent)} · 전환율 ${res.conversionRate.toFixed(1)}%</div>
              <p class="result-note" id="res-jw-note" hidden></p>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>전환 대상 보증금 차액</th><td id="res-jw-diff">${Calc.formatWon(res.diffDeposit)}</td></tr>
                <tr><th>연간 월세 총액</th><td id="res-jw-yearly">${Calc.formatWon(res.yearlyRent)}</td></tr>
                <tr><th>법정 상한 적용 시</th><td id="res-jw-cap">${cap.toFixed(1)}% → 월 ${Calc.formatWon(res.capMonthlyRent)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("jw")}
          </div>
        </section>
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("jeonse")}
        ${renderAffiliateCard("jeonse")}
          ${renderOfficialLinks("jeonse")}
        ${renderFaqSection(jeonseFaqs)}
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
          <label for="sev-years">재직기간 <span class="field-hint">1년 이상 지급</span></label>
          <div class="input-wrap"><input id="sev-years" type="number" min="0" step="0.5" value="${defaultYears}" /><span class="input-unit">년</span></div>
        </div>
        <details class="calc-details">
          <summary>상여금·연차수당·3개월 일수·IRP 예외</summary>
          <div class="field">
            <label for="sev-bonus">직전 1년간 상여금 총액 <span class="field-hint">3/12 평균임금 산입</span></label>
            <div class="input-wrap"><input id="sev-bonus" type="number" min="0" step="10" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <div class="field">
            <label for="sev-leave">직전 1년간 연차수당 <span class="field-hint">3/12 산입</span></label>
            <div class="input-wrap"><input id="sev-leave" type="number" min="0" step="10" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <div class="field">
            <label for="sev-days">퇴직 전 3개월 총일수</label>
            <select id="sev-days">
              <option value="89">89일 (2월 포함)</option>
              <option value="90">90일</option>
              <option value="91" selected>91일</option>
              <option value="92">92일 (31일 달 2개)</option>
            </select>
          </div>
          <label class="checkbox-row">
            <input id="sev-irp-exempt" type="checkbox" />
            <span>IRP 이전 예외에 해당<small class="checkbox-hint">55세 이후 퇴직, 퇴직급여 300만 원 이하, 사망, 외국인 출국 등</small></span>
          </label>
        </details>
        <p class="calc-note">법정 퇴직금 = 1일 평균임금 × 30일 × 재직일수/365. 퇴직금은 원칙적으로 근로자 명의 IRP로 세전 전액 이전되며(근로자퇴직급여 보장법 제9조②, 300만 원 이하 등 예외), 퇴직소득세는 인출할 때까지 이연됩니다.</p>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">퇴직금 추정</h2>
        <div class="result-summary">
          <div class="result-label" id="res-sev-label">${res.irpRequired ? "IRP 입금액 (세전 전액, 퇴직소득세 과세이연)" : "예상 퇴직금 실수령액 (일시금)"}</div>
          <div class="result-main num" id="res-sev-main">${Calc.formatWon(res.irpRequired ? res.gross : res.net)}</div>
          <div class="result-sub num" id="res-sev-sub">${res.irpRequired ? `IRP에서 일시금 인출 시 세금 ${Calc.formatWon(res.totalTax)} · 연금 수령(10년 이내) 시 약 ${Calc.formatWon(res.pensionTaxEstimate)}` : `세전 퇴직금 ${Calc.formatWon(res.gross)} · 퇴직세 합계 ${Calc.formatWon(res.totalTax)}`}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>1일 평균임금</th><td id="res-sev-daily">${Calc.formatWon(res.dailyAverageWage)} (${res.threeMonthDays}일 기준)</td></tr>
            <tr><th>세전 퇴직금</th><td id="res-sev-gross">${Calc.formatWon(res.gross)}</td></tr>
            <tr><th>근속연수공제</th><td id="res-sev-ded">${negWon(res.serviceDeduction)}</td></tr>
            <tr><th>퇴직소득세</th><td id="res-sev-inc">${Calc.formatWon(res.retirementIncomeTax)}</td></tr>
            <tr><th>지방소득세 (10%)</th><td id="res-sev-loc">${Calc.formatWon(res.localTax)}</td></tr>
            <tr><th>퇴직세 합계</th><td id="res-sev-tax">${negWon(res.totalTax)}</td></tr>
            <tr class="total-row"><th>일시금 수령 시 세후</th><td id="res-sev-net">${Calc.formatWon(res.net)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("sev")}
      </div>
    </section>
  `;
}

function buildSeverancePages() {
  const severanceFaqs = [
    {
      q: "퇴직금은 어떻게 계산하나요?",
      a: "법정 퇴직금은 1일 평균임금 × 30일 × (재직일수 ÷ 365)입니다. 1일 평균임금은 퇴직 전 3개월 임금총액(직전 1년 상여금·연차수당의 3/12 포함)을 그 기간의 총일수(89~92일)로 나눈 금액이며, 통상임금보다 낮으면 통상임금을 씁니다."
    },
    {
      q: "퇴직금을 통장으로 바로 받을 수 있나요?",
      a: "2022년 4월 14일부터 법정 퇴직금은 근로자 명의 IRP 계좌로 세전 금액을 이전하는 것이 원칙입니다. 55세 이후 퇴직, 퇴직급여 300만 원 이하, 사망, 외국인 근로자 출국 등은 예외입니다. IRP로 받으면 퇴직소득세는 인출할 때까지 이연됩니다."
    },
    {
      q: "IRP에서 연금으로 받으면 세금이 얼마나 줄어드나요?",
      a: "55세 이후 연금으로 받으면 퇴직소득세의 70%(실제 수령연차 10년 이하), 60%(11~20년차), 50%(21년차 이후, 2026년 신설)만 과세됩니다."
    }
  ];
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
      title: `${DATA.year} 퇴직금 계산기 (퇴직소득세·IRP)`,
      description: "1일 평균임금 기준 법정 퇴직금, 근속연수공제·퇴직소득세, IRP 이전 시 과세이연과 일시금 세후액을 계산합니다.",
      activeNav: "severance",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "퇴직금 계산기", href: "/severance/" }],
      faqs: severanceFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>퇴직금 계산기</h1>
          <p class="subtitle">퇴직 전 3개월 월급과 근무 기간으로 법정 퇴직금과 퇴직소득세를 계산합니다.</p>
        </header>
        ${renderSeveranceWidget(350, 3)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("severance")}
        ${renderAffiliateCard("severance")}
          ${renderOfficialLinks("severance")}
        ${matrixLinks(null)}
        ${renderFaqSection(severanceFaqs)}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcSeverance(p.m * 10000, p.y);
    const prev = idx > 0 ? { href: `/severance/${pairs[idx - 1].slug}/`, label: `월 ${pairs[idx - 1].m}만 · ${pairs[idx - 1].y}년 퇴직금` } : null;
    const next = idx < pairs.length - 1 ? { href: `/severance/${pairs[idx + 1].slug}/`, label: `월 ${pairs[idx + 1].m}만 · ${pairs[idx + 1].y}년 퇴직금` } : null;
    const sevCompare = renderCompareTable({
      title: `월급 ${p.m}만 원 근속연수별 퇴직금 비교`,
      subtitle: "퇴직 전 3개월 91일·상여금 없음 기준입니다. 근속연수가 길수록 근속연수공제가 커져 세 부담이 줄어듭니다.",
      headers: [
        { label: "근속연수" },
        { label: "세전 퇴직금", num: true },
        { label: "근속연수공제", num: true },
        { label: "퇴직세 합계", num: true },
        { label: "일시금 세후", num: true }
      ],
      rows: yearsList.map((yr) => {
        const c = Calc.calcSeverance(p.m * 10000, yr);
        return {
          current: yr === p.y,
          cells: [
            { href: `/severance/${p.m}-manwon-${yr}-year/`, label: `${yr}년 근속` },
            Calc.formatWon(c.gross),
            Calc.formatWon(c.serviceDeduction),
            Calc.formatWon(c.totalTax),
            Calc.formatWon(c.net)
          ]
        };
      })
    });
    const faqs = [
      {
        q: `월급 ${p.m}만 원으로 ${p.y}년 근무하면 퇴직금은 얼마인가요?`,
        a: `3개월 91일·별도 상여금 없음 기준으로 세전 법정 퇴직금은 약 ${Calc.formatWon(res.gross)}이며, 퇴직소득세·지방소득세 합계는 ${Calc.formatWon(res.totalTax)}(일시금 인출 시 세후 ${Calc.formatWon(res.net)})입니다.`
      },
      {
        q: `퇴직금 ${Calc.formatWon(res.gross)}은 IRP 계좌로 받아야 하나요?`,
        a: res.irpRequired
          ? "법정 퇴직금이 300만 원을 초과하므로 만 55세 미만 퇴직 시 근로자 명의 IRP 계좌로 세전 전액 이전이 원칙이며, 퇴직소득세는 인출 시점까지 과세이연됩니다."
          : "퇴직급여가 300만 원 이하에 해당해 IRP 의무 이전 예외 대상이므로 일반 급여 계좌로 일시금 수령이 가능합니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "실업급여 계산기", desc: `월급 ${p.m}만 원 · ${p.y}년 가입 기준 예상 구직급여`, href: "/unemployment/" },
      { title: "연봉 실수령액", desc: "이직 연봉 협상 시 월 실수령액 시뮬레이션", href: "/salary/" },
      { title: "증여세 계산기", desc: "가족 자산 이전 시 공제 한도·세액 확인", href: "/gift-tax/" }
    ]);
    writePage(
      `/severance/${p.slug}/`,
      renderLayout({
        routePath: `/severance/${p.slug}/`,
        title: `월급 ${p.m}만 원 ${p.y}년 근속 퇴직금 (${Calc.formatWon(res.gross)})`,
        description: `월급 ${p.m}만 원으로 ${p.y}년 근무 시 법정 퇴직금은 약 ${Calc.formatWon(res.gross)}, 퇴직소득세·지방소득세는 ${Calc.formatWon(res.totalTax)}(일시금 기준)입니다. 근속연수별 비교표를 확인하세요.`,
        activeNav: "severance",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "퇴직금", href: "/severance/" },
          { label: `월 ${p.m}만 · ${p.y}년`, href: `/severance/${p.slug}/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>월급 ${p.m}만 원 · ${p.y}년 근속 퇴직금</h1>
            <p class="subtitle">3개월 91일·상여금 없음 기준 법정 퇴직금은 약 <strong>${Calc.formatWon(res.gross)}</strong>입니다. ${res.irpRequired ? "IRP로 세전 전액이 입금되고" : "일시금으로 받으면"} 퇴직소득세 등 ${Calc.formatWon(res.totalTax)}${res.irpRequired ? "는 인출 시까지 이연됩니다" : "를 뺀 실수령액은 " + Calc.formatWon(res.net) + "입니다"}.</p>
          </header>
          ${renderSeveranceWidget(p.m, p.y)}
          ${renderAdSlot("pseoMid")}
          ${sevCompare}
          ${renderTaxTipsSection("severance")}
        ${renderAffiliateCard("severance")}
          ${renderOfficialLinks("severance")}
          ${related}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
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
          <label for="unemp-hours">이직 전 1일 소정근로시간 <span class="field-hint">하한액 결정</span></label>
          <select id="unemp-hours">
            ${[8, 7, 6, 5, 4, 3, 2, 1].map((h) => `<option value="${h}"${h === 8 ? " selected" : ""}>${h}시간 (하한 ${Math.floor(DATA.unemployment.minimumWage * h * 0.8).toLocaleString("ko-KR")}원)</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="unemp-years">고용보험 피보험기간</label>
          <select id="unemp-years">
            <option value="0">180일 미만 (수급 불가)</option>
            <option value="0.5" ${defaultYears < 1 ? "selected" : ""}>180일 이상 ~ 1년 미만</option>
            <option value="1" ${defaultYears >= 1 && defaultYears < 3 ? "selected" : ""}>1년 이상 ~ 3년 미만</option>
            <option value="3" ${defaultYears >= 3 && defaultYears < 5 ? "selected" : ""}>3년 이상 ~ 5년 미만</option>
            <option value="5" ${defaultYears >= 5 && defaultYears < 10 ? "selected" : ""}>5년 이상 ~ 10년 미만</option>
            <option value="10" ${defaultYears >= 10 ? "selected" : ""}>10년 이상</option>
          </select>
        </div>
        <div class="field">
          <label class="checkbox-row">
            <input id="unemp-age50" type="checkbox" />
            <span>퇴사 당시 만 50세 이상 또는 장애인</span>
          </label>
        </div>
        <p class="calc-note">이직 전 18개월 중 피보험단위기간 180일 이상이고 비자발적 이직(또는 정당한 이직사유)이어야 받을 수 있습니다. 하한액은 최저임금 × 1일 소정근로시간 × 80%라 단시간 근로자는 비례해 낮아집니다.</p>
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
            <tr><th>1일 평균임금</th><td id="res-unemp-avg">${Calc.formatWon(res.dailyAverageWage)}</td></tr>
            <tr><th>1일 하한 ~ 상한</th><td id="res-unemp-limits">${Calc.formatWon(res.lowerLimit)} ~ ${Calc.formatWon(res.upperLimit)}</td></tr>
            <tr><th>1일 구직급여 (60%)</th><td id="res-unemp-daily">${Calc.formatWon(res.dailyBenefit)}</td></tr>
            <tr><th>소정급여일수</th><td id="res-unemp-days">${res.benefitDays}일</td></tr>
            <tr><th>월 환산 수령액 (30일 기준)</th><td id="res-unemp-monthly">${Calc.formatWon(res.monthlyBenefit)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("unemp")}
      </div>
    </section>
  `;
}

function buildUnemploymentPages() {
  const unempFaqs = [
    {
      q: "2026년 실업급여 1일 상한액과 하한액은 얼마인가요?",
      a: `2026년 기준 1일 구직급여 상한액은 ${Calc.formatWon(DATA.unemployment.dailyUpperLimit)}이며, 1일 8시간 근무 기준 하한액은 2026년 최저시급(${DATA.weeklyHoliday.minimumWage2026.toLocaleString("ko-KR")}원) × 8시간 × 80%인 ${Calc.formatWon(DATA.unemployment.dailyLowerLimit)}입니다.`
    },
    {
      q: "실업급여를 받으려면 고용보험에 얼마나 가입해야 하나요?",
      a: "이직일 이전 18개월 동안(초단시간 근로자는 24개월) 고용보험 피보험단위기간이 통산 180일 이상이어야 하며, 권고사직·계약만료·정년 등 비자발적 이직 사유에 해당해야 합니다."
    },
    {
      q: "실업급여 수급 기간은 나이와 가입기간에 따라 어떻게 달라지나요?",
      a: "고용보험 가입기간 1년 미만은 120일이며, 1~3년 150일(50세 이상 180일), 3~5년 180일(50세 이상 210일), 5~10년 210일(50세 이상 240일), 10년 이상 240일(50세 이상 270일)입니다."
    },
    {
      q: "실업급여를 받는 중에 빨리 재취업하면 조기재취업수당을 받나요?",
      a: "소정급여일수를 2분의 1 이상 남기고 재취업해 12개월 이상 계속 고용되거나 자영업을 영위하면 남은 급여의 50%를 조기재취업수당으로 청구할 수 있습니다."
    }
  ];
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

  const unempRelated = renderRelatedCalcs([
    { title: "퇴직금 계산기", desc: "퇴사 시 법정 퇴직금과 IRP 퇴직소득세 확인", href: "/severance/" },
    { title: "연봉 실수령액", desc: "재취업 연봉 조건별 월 실수령액 비교", href: "/salary/" },
    { title: "주휴수당 계산기", desc: "단시간·아르바이트 시급 기준 주급·월급 산출", href: "/weekly-holiday/" }
  ]);

  writePage(
    "/unemployment/",
    renderLayout({
      routePath: "/unemployment/",
      title: `${DATA.year} 실업급여 계산기`,
      description: "퇴직 전 평균 월급, 나이, 고용보험 가입기간에 따른 1일 구직급여액과 총 예상 실업급여 계산기.",
      activeNav: "unemployment",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "실업급여", href: "/unemployment/" }],
      faqs: unempFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 실업급여 계산기</h1>
          <p class="subtitle">퇴직 전 월급과 고용보험 가입 기간으로 받을 실업급여를 계산합니다.</p>
        </header>
        ${renderUnemploymentWidget(350, 3)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("unemployment")}
        ${renderAffiliateCard("unemployment")}
        ${renderOfficialLinks("unemployment")}
        ${unempRelated}
        ${matrixLinks(null)}
        ${renderFaqSection(unempFaqs)}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcUnemployment(p.m * 10000, false, p.y, DATA);
    const res50 = Calc.calcUnemployment(p.m * 10000, true, p.y, DATA);
    const prev = idx > 0 ? { href: `/unemployment/${pairs[idx - 1].slug}/`, label: `월 ${pairs[idx - 1].m}만 · ${pairs[idx - 1].y}년` } : null;
    const next = idx < pairs.length - 1 ? { href: `/unemployment/${pairs[idx + 1].slug}/`, label: `월 ${pairs[idx + 1].m}만 · ${pairs[idx + 1].y}년` } : null;
    const unempCompare = renderCompareTable({
      title: `월급 ${p.m}만 원 가입기간·연령별 실업급여 비교`,
      subtitle: `1일 구직급여 ${Calc.formatWon(res.dailyBenefit)}(1일 8시간 근무 기준)를 적용한 총 예상 수령액 비교입니다.`,
      headers: [
        { label: "고용보험 가입기간" },
        { label: "50세 미만 일수", num: true },
        { label: "50세 미만 총액", num: true },
        { label: "50세 이상 일수", num: true },
        { label: "50세 이상 총액", num: true }
      ],
      rows: yearsList.map((yr) => {
        const uUnder = Calc.calcUnemployment(p.m * 10000, false, yr, DATA);
        const uOver = Calc.calcUnemployment(p.m * 10000, true, yr, DATA);
        return {
          current: yr === p.y,
          cells: [
            { href: `/unemployment/${p.m}-manwon-${yr}-year/`, label: `${yr}년 가입` },
            `${uUnder.benefitDays}일`,
            Calc.formatWon(uUnder.totalBenefit),
            `${uOver.benefitDays}일`,
            Calc.formatWon(uOver.totalBenefit)
          ]
        };
      })
    });
    const faqs = [
      {
        q: `월급 ${p.m}만 원 · 가입 ${p.y}년이면 실업급여를 총 얼마 받나요?`,
        a: `2026년 1일 8시간 기준 1일 구직급여는 ${Calc.formatWon(res.dailyBenefit)}이며, 만 50세 미만은 ${res.benefitDays}일간 총 ${Calc.formatWon(res.totalBenefit)}, 만 50세 이상(또는 장애인)은 ${res50.benefitDays}일간 총 ${Calc.formatWon(res50.totalBenefit)}을 받을 수 있습니다.`
      },
      {
        q: "실업급여는 한 달에 얼마씩 입금되나요?",
        a: `실업인정 주기(보통 28일) 또는 30일 환산 기준으로 월 약 ${Calc.formatWon(res.monthlyBenefit)} 수준이 지급됩니다. 단, 1차 실업인정(이직 후 대기기간 7일 제외 8일분)과 마지막 회차는 일수에 따라 달라집니다.`
      }
    ];
    writePage(
      `/unemployment/${p.slug}/`,
      renderLayout({
        routePath: `/unemployment/${p.slug}/`,
        title: `월급 ${p.m}만 원 · 가입 ${p.y}년 실업급여 (${Calc.formatWon(res.totalBenefit)})`,
        description: `퇴직 전 월급 ${p.m}만 원, 고용보험 ${p.y}년 가입 시 예상 실업급여는 총 ${Calc.formatWon(res.totalBenefit)}(${res.benefitDays}일)입니다. 연령·기간별 비교표를 확인하세요.`,
        activeNav: "unemployment",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "실업급여", href: "/unemployment/" },
          { label: `월 ${p.m}만 · ${p.y}년`, href: `/unemployment/${p.slug}/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>월급 ${p.m}만 원 · 가입 ${p.y}년 실업급여</h1>
            <p class="subtitle">만 50세 미만·1일 8시간 근무 기준 1일 ${Calc.formatWon(res.dailyBenefit)}, 총 ${res.benefitDays}일간 <strong>${Calc.formatWon(res.totalBenefit)}</strong> 수령이 예상됩니다.</p>
          </header>
          ${renderUnemploymentWidget(p.m, p.y)}
          ${renderAdSlot("pseoMid")}
          ${unempCompare}
          ${renderTaxTipsSection("unemployment")}
        ${renderAffiliateCard("unemployment")}
          ${renderOfficialLinks("unemployment")}
          ${unempRelated}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
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
          <label for="wh-hours">주간 근로시간 <span class="field-hint">40시간 초과분은 연장근로</span></label>
          <div class="input-wrap"><input id="wh-hours" type="number" min="0" max="52" step="1" value="${defaultHours}" /><span class="input-unit">시간</span></div>
          <div class="preset-row" id="wh-hours-presets">
            <button type="button" class="chip-btn" data-preset="15">15시간</button>
            <button type="button" class="chip-btn" data-preset="20">20시간</button>
            <button type="button" class="chip-btn" data-preset="30">30시간</button>
            <button type="button" class="chip-btn" data-preset="40">40시간</button>
          </div>
        </div>
        <div class="field">
          <label class="checkbox-row">
            <input id="wh-fiveplus" type="checkbox" checked />
            <span>상시 근로자 5인 이상 사업장<small class="checkbox-hint">연장근로 50% 가산 적용</small></span>
          </label>
        </div>
        <p class="calc-note">주휴수당은 4주 평균 1주 소정근로시간이 15시간 이상이고 소정근로일을 개근한 경우 발생하며, 5인 미만 사업장도 지급 대상입니다. 월 환산은 (소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12를 시간 단위로 반올림(주 40시간 = 209시간)합니다.</p>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">주휴수당 및 주급 산출</h2>
        <div class="result-summary">
          <div class="result-label">예상 주휴수당 (1주 기준)</div>
          <div class="result-main num" id="res-wh-pay">${Calc.formatWon(res.holidayPay)}</div>
          <div class="result-sub num" id="res-wh-sub">주급(주휴 포함) ${Calc.formatWon(res.totalWeeklyPay)} · 월 환산 약 ${Calc.formatWon(res.estimatedMonthlyPay)}</div>
          <p class="result-note" id="res-wh-note" hidden></p>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>기본 주급 (소정근로)</th><td id="res-wh-base">${Calc.formatWon(res.regularPay)}</td></tr>
            <tr><th>연장근로수당</th><td id="res-wh-ot">${Calc.formatWon(res.overtimePay)}</td></tr>
            <tr><th>인정 주휴시간</th><td id="res-wh-hours">${res.holidayHours.toFixed(1)}시간</td></tr>
            <tr><th>주휴 포함 주급</th><td id="res-wh-total">${Calc.formatWon(res.totalWeeklyPay)}</td></tr>
            <tr><th>월 환산 급여</th><td id="res-wh-monthly">${Calc.formatWon(res.estimatedMonthlyPay)} (${res.monthlyPaidHours}시간)</td></tr>
          </tbody>
        </table>
        ${renderResultActions("wh")}
      </div>
    </section>
  `;
}

function buildWeeklyHolidayPages() {
  const min2026 = DATA.weeklyHoliday.minimumWage2026;
  const min2027 = 10700;
  const whFaqs = [
    {
      q: "주휴수당은 어떤 조건을 채워야 받을 수 있나요?",
      a: "4주 평균 1주 소정근로시간이 15시간 이상이고, 근로계약서에 정한 1주 소정근로일을 모두 개근하면 유급 주휴일 1일분의 수당이 발생합니다. 5인 미만 사업장도 동일하게 지급 대상입니다."
    },
    {
      q: "주휴수당과 월 환산 급여(209시간)는 어떻게 계산하나요?",
      a: "1주 주휴시간은 (1주 소정근로시간 ÷ 40) × 8시간(최대 8시간)입니다. 월 환산 유급시간은 (소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12를 반올림해 주 40시간 기준 209시간으로 계산합니다."
    },
    {
      q: "2026년과 2027년 최저시급 기준 월급은 얼마인가요?",
      a: `주 40시간(월 209시간) 기준 2026년 최저시급 ${min2026.toLocaleString("ko-KR")}원은 월 ${Calc.formatWon(min2026 * 209)}, 고용노동부가 2026년 8월 확정 고시한 2027년 최저시급 ${min2027.toLocaleString("ko-KR")}원은 월 ${Calc.formatWon(min2027 * 209)}(+${Calc.formatWon((min2027 - min2026) * 209)})입니다.`
    },
    {
      q: "40시간을 넘겨 일하면 주휴수당도 늘어나나요?",
      a: "법정 소정근로시간 상한은 주 40시간이므로 주휴시간은 최대 8시간까지만 인정됩니다. 40시간 초과 근무분은 5인 이상 사업장 기준 통상임금의 1.5배(연장근로수당)로 별도 가산됩니다."
    }
  ];
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
        <a class="matrix-pill ${currentSlug === "2027-minimum-wage" ? "current" : ""}" href="/weekly-holiday/2027-minimum-wage/">2027 최저시급 10,700원 비교</a>
        ${pairs.map((p) => `<a class="matrix-pill ${currentSlug === p.slug ? "current" : ""}" href="/weekly-holiday/${p.slug}/">${p.w.toLocaleString("ko-KR")}원 · 주 ${p.h}시간</a>`).join("")}
      </div>
    </section>
  `;

  const whRelated = renderRelatedCalcs([
    { title: "2027 최저임금 10,700원 비교", desc: "2026년 대비 시간별 주휴수당·월급 인상액 한눈에 보기", href: "/weekly-holiday/2027-minimum-wage/" },
    { title: "연봉 실수령액 계산기", desc: "4대보험 공제 후 실제 통장 입금액 확인", href: "/salary/" },
    { title: "실업급여 계산기", desc: "퇴사 시 1일 구직급여 하한액과 총 수령액", href: "/unemployment/" }
  ]);

  writePage(
    "/weekly-holiday/",
    renderLayout({
      routePath: "/weekly-holiday/",
      title: `${DATA.year} 주휴수당 계산기 (시급·주급·월급)`,
      description: "시급과 주간 근무시간에 따른 주휴수당, 주휴 포함 주급, 월 환산 급여 계산기. 2026년 10,320원 및 2027년 10,700원 기준 확인.",
      activeNav: "weekly-holiday",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "주휴수당", href: "/weekly-holiday/" }],
      faqs: whFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 주휴수당 계산기</h1>
          <p class="subtitle">시급과 주간 근무시간으로 주휴수당과 월급을 계산합니다.</p>
        </header>
        ${renderWeeklyHolidayWidget(min2026, 20)}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("weeklyHoliday")}
        ${renderAffiliateCard("weeklyHoliday")}
        ${renderOfficialLinks("weeklyHoliday")}
        ${whRelated}
        ${matrixLinks(null)}
        ${renderFaqSection(whFaqs)}
      `
    })
  );

  // 2027년 확정 최저임금(10,700원) 비교 가이드 페이지
  const res2026Full = Calc.calcWeeklyHoliday(min2026, 40, DATA);
  const res2027Full = Calc.calcWeeklyHoliday(min2027, 40, DATA);
  const compare2027Table = renderCompareTable({
    title: "2026년(10,320원) vs 2027년(10,700원) 근무시간별 월급 비교",
    subtitle: "고용노동부 2026년 8월 5일 확정 고시(전년 대비 +380원, +3.7%) 기준 주휴수당 포함 월 환산액입니다.",
    headers: [
      { label: "주 소정근로시간" },
      { label: "월 유급시간", num: true },
      { label: "2026년 월급", num: true },
      { label: "2027년 월급", num: true },
      { label: "월 인상액", num: true }
    ],
    rows: hours.map((h) => {
      const c26 = Calc.calcWeeklyHoliday(min2026, h, DATA);
      const c27 = Calc.calcWeeklyHoliday(min2027, h, DATA);
      return {
        current: h === 40,
        cells: [
          `주 ${h}시간 (주휴 ${c27.holidayHours.toFixed(1)}h)`,
          `${c27.monthlyPaidHours}시간`,
          Calc.formatWon(c26.estimatedMonthlyPay),
          Calc.formatWon(c27.estimatedMonthlyPay),
          `+${Calc.formatWon(c27.estimatedMonthlyPay - c26.estimatedMonthlyPay)}`
        ]
      };
    })
  });
  const faqs2027 = [
    {
      q: "2027년 최저시급과 주 40시간 월급은 얼마인가요?",
      a: `고용노동부가 2026년 8월 5일 확정 고시한 2027년 최저임금은 시급 ${min2027.toLocaleString("ko-KR")}원(2026년 대비 +380원, +3.7%)이며, 주 40시간·월 209시간 기준 세전 월급은 ${Calc.formatWon(res2027Full.estimatedMonthlyPay)}(+${Calc.formatWon(res2027Full.estimatedMonthlyPay - res2026Full.estimatedMonthlyPay)})입니다.`
    },
    {
      q: "2027년 최저임금 기준 일급과 주휴수당은 얼마인가요?",
      a: `1일 8시간 기준 일급은 ${Calc.formatWon(min2027 * 8)}이며, 주 40시간 개근 시 주휴수당(8시간) ${Calc.formatWon(res2027Full.holidayPay)}을 더해 주급은 ${Calc.formatWon(res2027Full.totalWeeklyPay)}입니다.`
    },
    {
      q: "2027년 수습기간 90% 적용 시급은 얼마인가요?",
      a: `1년 이상 근로계약을 체결하고 단순노무직종이 아닌 수습 근로자는 최대 3개월까지 최저임금의 90%인 시급 ${Math.round(min2027 * 0.9).toLocaleString("ko-KR")}원을 적용할 수 있습니다.`
    },
    {
      q: "2027년 최저임금은 언제부터 적용되나요?",
      a: "2027년 1월 1일부터 12월 31일까지 모든 사업장에 업종 구분 없이 동일하게 적용됩니다. 기존 근로계약서에 10,320원으로 적혀 있더라도 2027년 1월 1일부터는 자동으로 10,700원 이상을 지급해야 합니다."
    }
  ];

  writePage(
    "/weekly-holiday/2027-minimum-wage/",
    renderLayout({
      routePath: "/weekly-holiday/2027-minimum-wage/",
      title: `2027 최저임금 10,700원 월급·주휴수당 계산기 (월 ${Calc.formatWon(res2027Full.estimatedMonthlyPay)})`,
      description: `2027년 확정 최저시급 10,700원(월 209시간 ${Calc.formatWon(res2027Full.estimatedMonthlyPay)}) 기준 주 15~40시간 주휴수당·주급·월급과 2026년 대비 인상액을 계산합니다.`,
      activeNav: "weekly-holiday",
      priority: "0.85",
      breadcrumbs: [
        { label: "홈", href: "/" },
        { label: "주휴수당", href: "/weekly-holiday/" },
        { label: "2027 최저임금 10,700원", href: "/weekly-holiday/2027-minimum-wage/" }
      ],
      faqs: faqs2027,
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>2027년 최저임금 10,700원 월급·주휴수당 계산기</h1>
            <span class="meta-tag">고용노동부 2026. 8. 5. 확정 고시</span>
          </div>
          <p class="subtitle">2027년 시급 <strong>10,700원</strong>(전년 대비 +380원·3.7%) 기준 주 40시간 월 환산액은 <strong>${Calc.formatWon(res2027Full.estimatedMonthlyPay)}</strong>입니다.</p>
        </header>
        ${renderWeeklyHolidayWidget(min2027, 40)}
        ${renderAdSlot("pseoMid")}
        ${compare2027Table}
        ${renderTaxTipsSection("weeklyHoliday")}
        ${renderAffiliateCard("weeklyHoliday")}
        ${renderOfficialLinks("weeklyHoliday")}
        ${renderFaqSection(faqs2027)}
        ${matrixLinks("2027-minimum-wage")}
      `
    })
  );

  pairs.forEach((p, idx) => {
    const res = Calc.calcWeeklyHoliday(p.w, p.h, DATA);
    const prev = idx > 0 ? { href: `/weekly-holiday/${pairs[idx - 1].slug}/`, label: `${pairs[idx - 1].w.toLocaleString("ko-KR")}원 · ${pairs[idx - 1].h}시간` } : null;
    const next = idx < pairs.length - 1 ? { href: `/weekly-holiday/${pairs[idx + 1].slug}/`, label: `${pairs[idx + 1].w.toLocaleString("ko-KR")}원 · ${pairs[idx + 1].h}시간` } : null;
    const whCompare = renderCompareTable({
      title: `시급 ${p.w.toLocaleString("ko-KR")}원 주간 근무시간별 주휴수당·월급 비교`,
      subtitle: "주 15시간 이상 개근 시 주휴수당이 발생하며, 월 환산 유급시간은 법정 기준(주 40시간 = 209시간)을 적용합니다.",
      headers: [
        { label: "주 소정근로시간" },
        { label: "주휴수당", num: true },
        { label: "주급 (주휴 포함)", num: true },
        { label: "월 유급시간", num: true },
        { label: "월 환산 급여", num: true }
      ],
      rows: hours.map((hr) => {
        const c = Calc.calcWeeklyHoliday(p.w, hr, DATA);
        return {
          current: hr === p.h,
          cells: [
            { href: `/weekly-holiday/${p.w}-won-${hr}-hours/`, label: `주 ${hr}시간` },
            Calc.formatWon(c.holidayPay),
            Calc.formatWon(c.totalWeeklyPay),
            `${c.monthlyPaidHours}시간`,
            Calc.formatWon(c.estimatedMonthlyPay)
          ]
        };
      })
    });
    const faqs = [
      {
        q: `시급 ${p.w.toLocaleString("ko-KR")}원으로 주 ${p.h}시간 일하면 주휴수당은 얼마인가요?`,
        a: `주휴시간은 ${res.holidayHours.toFixed(1)}시간이며 예상 주휴수당은 ${Calc.formatWon(res.holidayPay)}입니다. 기본 주급 ${Calc.formatWon(res.regularPay)}을 더한 주급은 ${Calc.formatWon(res.totalWeeklyPay)}, 월 환산 급여(${res.monthlyPaidHours}시간)는 약 ${Calc.formatWon(res.estimatedMonthlyPay)}입니다.`
      },
      {
        q: "주휴수당을 받으려면 5인 이상 사업장이어야 하나요?",
        a: "아니요. 주휴수당은 상시 근로자 수와 무관하게 5인 미만 사업장에서도 1주 소정근로시간 15시간 이상·개근 요건을 충족하면 법적으로 반드시 지급해야 합니다."
      }
    ];
    writePage(
      `/weekly-holiday/${p.slug}/`,
      renderLayout({
        routePath: `/weekly-holiday/${p.slug}/`,
        title: `시급 ${p.w.toLocaleString("ko-KR")}원 주 ${p.h}시간 주휴수당 (${Calc.formatWon(res.holidayPay)})`,
        description: `시급 ${p.w.toLocaleString("ko-KR")}원, 주 ${p.h}시간 근무 시 주휴수당은 ${Calc.formatWon(res.holidayPay)}, 주급은 ${Calc.formatWon(res.totalWeeklyPay)}, 월 환산은 ${Calc.formatWon(res.estimatedMonthlyPay)}입니다.`,
        activeNav: "weekly-holiday",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "주휴수당", href: "/weekly-holiday/" },
          { label: `${p.w.toLocaleString("ko-KR")}원 · ${p.h}시간`, href: `/weekly-holiday/${p.slug}/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>시급 ${p.w.toLocaleString("ko-KR")}원 · 주 ${p.h}시간 주휴수당</h1>
            <p class="subtitle">예상 주휴수당은 <strong>${Calc.formatWon(res.holidayPay)}</strong>, 주휴 포함 주급은 ${Calc.formatWon(res.totalWeeklyPay)}입니다.</p>
          </header>
          ${renderWeeklyHolidayWidget(p.w, p.h)}
          ${renderAdSlot("pseoMid")}
          ${whCompare}
          ${renderTaxTipsSection("weeklyHoliday")}
        ${renderAffiliateCard("weeklyHoliday")}
          ${renderOfficialLinks("weeklyHoliday")}
          ${whRelated}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
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
          <label for="gift-amount">증여 재산 가액 <span class="field-hint">동일인(배우자 포함) 10년 합산액</span></label>
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
          <label for="gift-relation">받는 사람(수증자) 기준 관계 <span class="field-hint">10년 공제 한도</span></label>
          <select id="gift-relation">
            <option value="spouse" ${defaultRelation === "spouse" ? "selected" : ""}>배우자가 받음 (6억 원)</option>
            <option value="adultChild" ${defaultRelation === "adultChild" ? "selected" : ""}>성년 자녀가 부모에게 받음 (5,000만 원)</option>
            <option value="minorChild" ${defaultRelation === "minorChild" ? "selected" : ""}>미성년 자녀가 부모에게 받음 (2,000만 원)</option>
            <option value="adultGrandchild" ${defaultRelation === "adultGrandchild" ? "selected" : ""}>성년 손자녀가 조부모에게 받음 (5,000만 원·30% 할증)</option>
            <option value="minorGrandchild" ${defaultRelation === "minorGrandchild" ? "selected" : ""}>미성년 손자녀가 조부모에게 받음 (2,000만 원·30~40% 할증)</option>
            <option value="parent" ${defaultRelation === "parent" ? "selected" : ""}>부모·조부모가 자녀에게 받음 (5,000만 원)</option>
            <option value="relative" ${defaultRelation === "relative" ? "selected" : ""}>기타 친족 · 4촌 이내 혈족·3촌 이내 인척 (1,000만 원)</option>
            <option value="other" ${defaultRelation === "other" ? "selected" : ""}>타인 (공제 없음)</option>
          </select>
        </div>
        <div class="field" id="gift-marriage-field"${["adultChild", "minorChild", "adultGrandchild", "minorGrandchild"].includes(defaultRelation) ? "" : " hidden"}>
          <label class="checkbox-row">
            <input id="gift-marriage" type="checkbox" />
            <span>혼인·출산 증여재산공제 (평생 1억 원)<small class="checkbox-hint">혼인신고일 전후 2년 또는 자녀 출생일부터 2년 이내</small></span>
          </label>
          <label for="gift-marriage-used">이미 사용한 혼인·출산 공제액</label>
          <div class="input-wrap"><input id="gift-marriage-used" type="number" min="0" max="10000" step="500" value="0" /><span class="input-unit">만 원</span></div>
        </div>
        <details class="calc-details">
          <summary>10년 내 이전 증여가 있는 경우</summary>
          <div class="field">
            <label for="gift-used-ded">같은 그룹에서 이미 사용한 증여재산공제 <span class="field-hint">예: 부모님, 조부모님 합산</span></label>
            <div class="input-wrap"><input id="gift-used-ded" type="number" min="0" step="500" value="0" /><span class="input-unit">만 원</span></div>
          </div>
          <div class="field">
            <label for="gift-prior-tax">합산된 이전 증여의 산출세액 <span class="field-hint">기납부세액공제</span></label>
            <div class="input-wrap"><input id="gift-prior-tax" type="number" min="0" step="10" value="0" /><span class="input-unit">만 원</span></div>
          </div>
        </details>
        <p class="calc-note">증여재산공제는 받는 사람을 기준으로, 주는 사람 그룹마다 10년에 한 번만 적용됩니다. 과세표준이 50만 원 미만이면 세금이 없습니다.</p>
      </div>
      <div class="sheet receipt">
        <h2 class="sheet-title">증여세 산출 (자진신고 3% 반영)</h2>
        <div class="result-summary">
          <div class="result-label">최종 납부 예상 세액</div>
          <div class="result-main num" id="res-gift-final">${Calc.formatWon(res.finalTax)}</div>
          <div class="result-sub num" id="res-gift-sub">신고세액공제 3% 적용 · 실효세율 ${Calc.formatPercent(res.effectiveRate, 1)}</div>
        </div>
        <table class="breakdown-table">
          <tbody>
            <tr><th>증여 재산 가액</th><td id="res-gift-gross">${Calc.formatWon(res.gift)}</td></tr>
            <tr><th>증여재산공제</th><td id="res-gift-ded">${negWon(res.deductionApplied - res.marriageBirthDeduction)}</td></tr>
            <tr><th>혼인·출산 공제</th><td id="res-gift-mb">${negWon(res.marriageBirthDeduction)}</td></tr>
            <tr><th>과세표준</th><td id="res-gift-base">${Calc.formatWon(res.taxBase)}</td></tr>
            <tr><th>산출세액</th><td id="res-gift-calc">${Calc.formatWon(res.calculatedTax)}</td></tr>
            <tr><th>세대생략 할증세액</th><td id="res-gift-surcharge">${Calc.formatWon(res.generationSkipSurcharge)}</td></tr>
            <tr><th>기납부세액공제</th><td id="res-gift-prior">${negWon(res.priorTaxCredit)}</td></tr>
            <tr class="total-row"><th>신고세액공제 (3%)</th><td id="res-gift-credit">${negWon(res.voluntaryCredit)}</td></tr>
          </tbody>
        </table>
        ${renderResultActions("gift")}
      </div>
    </section>
  `;
}

function buildGiftTaxPages() {
  const giftFaqs = [
    {
      q: "결혼할 때 부모님께 받으면 얼마까지 세금이 없나요?",
      a: "혼인신고일 전후 2년(또는 자녀 출생일부터 2년) 이내에 직계존속에게 받으면 기본 5,000만 원과 별도로 1억 원을 추가 공제해 10년 내 다른 증여가 없다면 1억 5,000만 원까지 증여세가 없습니다(상속세 및 증여세법 제53조의2). 혼인과 출산 공제를 합쳐 평생 1억 원이 한도입니다."
    },
    {
      q: "조부모가 손주에게 주면 세금이 더 나오나요?",
      a: "부모를 건너뛰는 세대생략 증여는 산출세액의 30%가 할증되고, 받는 손자녀가 미성년자이면서 증여재산이 20억 원을 넘으면 40%가 할증됩니다(제57조). 단, 부모가 사망한 경우는 할증하지 않습니다."
    },
    {
      q: "10년 안에 두 번 증여받으면 어떻게 계산하나요?",
      a: "동일인(직계존속이면 그 배우자 포함)에게 10년 이내 받은 증여는 합산해 세액을 다시 계산하고, 이전 증여 때의 산출세액은 기납부세액으로 뺍니다(제47조·제58조). 계산기의 '10년 내 이전 증여' 항목에 입력하세요."
    },
    {
      q: "최근 증여세율이나 공제가 바뀌었나요?",
      a: "2026년 11월 현재 세율(10~50%)과 증여재산공제 금액은 바뀌지 않았습니다. 최고세율 인하·유산취득세 전환은 국회 계류 중인 개정안입니다. 기타친족 범위는 2025년 3월 14일부터 4촌 이내 혈족·3촌 이내 인척으로 좁아졌습니다."
    }
  ];
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
      title: `${DATA.year} 증여세 계산기 (공제 한도 · 혼인·출산 공제 · 신고 3%)`,
      description: "배우자·자녀·손자녀·친족 증여재산공제, 혼인·출산 1억 공제, 세대생략 할증, 기납부세액공제, 10~50% 누진세율과 신고세액공제 3%를 반영한 증여세 계산기.",
      activeNav: "gift-tax",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "증여세", href: "/gift-tax/" }],
      faqs: giftFaqs,
      bodyHtml: `
        <header class="page-head">
          <h1>${DATA.year} 증여세 계산기</h1>
          <p class="subtitle">받는 금액과 주는 사람과의 관계로 내야 할 증여세를 계산합니다.</p>
        </header>
        ${renderGiftTaxWidget(10000, "adultChild")}
        ${renderAdSlot("calcMid")}
        ${renderTaxTipsSection("giftTax")}
        ${renderAffiliateCard("giftTax")}
          ${renderPartnerCard("giftTax")}
          ${renderOfficialLinks("giftTax")}
        ${matrixLinks(null)}
        ${renderFaqSection(giftFaqs)}
      `
    })
  );

  cases.forEach((c, idx) => {
    const relLabel = RELATION_LABELS[c.relation];
    const amtLabel = formatKoreanManwonLabel(c.amountManwon);
    const giftWon = c.amountManwon * 10000;
    const res = Calc.calcGiftTax(giftWon, c.relation, DATA);
    const resMarriage = Calc.calcGiftTax(giftWon, "adultChild", DATA, { marriageBirth: 100000000 });
    const prev = idx > 0 ? { href: `/gift-tax/${cases[idx - 1].slug}/`, label: `${RELATION_LABELS[cases[idx - 1].relation]} ${formatKoreanManwonLabel(cases[idx - 1].amountManwon)}` } : null;
    const next = idx < cases.length - 1 ? { href: `/gift-tax/${cases[idx + 1].slug}/`, label: `${RELATION_LABELS[cases[idx + 1].relation]} ${formatKoreanManwonLabel(cases[idx + 1].amountManwon)}` } : null;
    const giftCompareRows = [
      { label: "배우자 (공제 6억 원)", rel: "spouse", opts: {}, current: c.relation === "spouse" },
      { label: "성년 자녀 (공제 5,000만 원)", rel: "adultChild", opts: {}, current: c.relation === "adultChild" },
      { label: "성년 자녀 + 혼인·출산 공제 (1억 5,000만 원)", rel: "adultChild", opts: { marriageBirth: 100000000 }, current: false },
      { label: "미성년 자녀 (공제 2,000만 원)", rel: "minorChild", opts: {}, current: c.relation === "minorChild" },
      { label: "기타 친족 (공제 1,000만 원)", rel: "relative", opts: {}, current: c.relation === "relative" }
    ];
    const giftCompare = renderCompareTable({
      title: `증여액 ${amtLabel} 관계별 증여세 비교`,
      subtitle: "동일인 10년 내 합산 증여 없음·기한 내 자진신고(3% 공제) 기준입니다.",
      headers: [
        { label: "수증자 관계" },
        { label: "적용 공제액", num: true },
        { label: "과세표준", num: true },
        { label: "신고공제(3%)", num: true },
        { label: "최종 납부세액", num: true }
      ],
      rows: giftCompareRows.map((row) => {
        const g = Calc.calcGiftTax(giftWon, row.rel, DATA, row.opts);
        return {
          current: row.current,
          cells: [
            row.label,
            Calc.formatWon(g.deductionApplied),
            Calc.formatWon(g.taxBase),
            Calc.formatWon(g.voluntaryCredit),
            Calc.formatWon(g.finalTax)
          ]
        };
      })
    });
    const faqs = [
      {
        q: `${relLabel}에게 ${amtLabel}을 증여하면 증여세가 얼마 나오나요?`,
        a: `10년 내 이전 증여가 없고 증여일이 속한 달의 말일부터 3개월 이내 자진신고(3% 세액공제)할 경우 증여재산공제 ${Calc.formatWon(res.deductionApplied)}을 제외한 과세표준 ${Calc.formatWon(res.taxBase)} 기준으로 최종 납부세액은 ${Calc.formatWon(res.finalTax)}입니다.`
      },
      {
        q: `성년 자녀에게 결혼·출산 자금으로 ${amtLabel}을 증여하면 세금이 줄어드나요?`,
        a: `혼인신고일 전후 2년 또는 자녀 출생일부터 2년 이내라면 기본 5,000만 원에 혼인·출산 공제 1억 원(총 1억 5,000만 원)을 합산 적용해 최종 증여세가 ${Calc.formatWon(resMarriage.finalTax)}로 줄어듭니다.`
      }
    ];
    const related = renderRelatedCalcs([
      { title: "주택 취등록세", desc: "증여받은 자금으로 주택 매수 시 취등록세 확인", href: "/real-estate/" },
      { title: "해외주식 양도세", desc: "배우자 증여 활용 해외주식 절세 시뮬레이션", href: "/stock-tax/" },
      { title: "전월세 전환율", desc: "전세·월세 자금 계획 시 적정 월세 산출", href: "/jeonse/" }
    ]);
    writePage(
      `/gift-tax/${c.slug}/`,
      renderLayout({
        routePath: `/gift-tax/${c.slug}/`,
        title: `${relLabel} ${amtLabel} 증여세 (${Calc.formatWon(res.finalTax)})`,
        description: `${relLabel}에게 ${amtLabel} 증여 시 공제 적용 및 자진신고 3% 공제 후 최종 증여세는 ${Calc.formatWon(res.finalTax)}입니다. 관계별·혼인출산 공제 비교표를 확인하세요.`,
        activeNav: "gift-tax",
        priority: "0.75",
        breadcrumbs: [
          { label: "홈", href: "/" },
          { label: "증여세", href: "/gift-tax/" },
          { label: `${relLabel} ${amtLabel}`, href: `/gift-tax/${c.slug}/` }
        ],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${relLabel} ${amtLabel} 증여세</h1>
            <p class="subtitle">증여재산공제 ${Calc.formatWon(res.deductionApplied)} 적용 및 자진신고 3% 공제 시 납부세액은 <strong>${Calc.formatWon(res.finalTax)}</strong>입니다.</p>
          </header>
          ${renderGiftTaxWidget(c.amountManwon, c.relation)}
          ${renderAdSlot("pseoMid")}
          ${giftCompare}
          ${renderTaxTipsSection("giftTax")}
        ${renderAffiliateCard("giftTax")}
          ${renderPartnerCard("giftTax")}
          ${renderOfficialLinks("giftTax")}
          ${related}
          ${renderPrevNext(prev, next)}
          ${renderFaqSection(faqs)}
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
        <header class="page-head hero-head">
          <div class="page-head-row">
            <h1>${DATA.year} 세금·금융 실수령 계산기</h1>
            <span class="meta-tag">9종 계산기 · ${DATA.updatedAt} 법령 기준 갱신</span>
          </div>
          <div class="stat-strip" aria-label="2026년 확정 법정 기준 요약">
            <div class="stat-item"><span>최저시급</span><strong class="num">${DATA.weeklyHoliday.minimumWage2026.toLocaleString("ko-KR")}원</strong></div>
            <div class="stat-item"><span>국민연금(근로자)</span><strong class="num">${(DATA.salary.nationalPensionRate * 100).toFixed(2)}%</strong></div>
            <div class="stat-item"><span>건강보험(근로자)</span><strong class="num">${(DATA.salary.healthInsuranceRate * 100).toFixed(3)}%</strong></div>
            <div class="stat-item"><span>실업급여 1일 상한</span><strong class="num">${DATA.unemployment.dailyUpperLimit.toLocaleString("ko-KR")}원</strong></div>
          </div>
        </header>

        <section class="directory-grid" aria-label="전체 계산기">
          <a class="dir-card" href="/salary/">
            <div class="dir-top"><span class="dir-cat">급여 · 4대보험</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>연봉 실수령액</h2>
            <p>4대보험과 소득세를 뺀 월 실수령액</p>
          </a>
          <a class="dir-card" href="/freelancer/">
            <div class="dir-top"><span class="dir-cat">사업소득</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>프리랜서 3.3%</h2>
            <p>3.3% 뗀 실수령액과 세전 금액 역산</p>
          </a>
          <a class="dir-card" href="/severance/">
            <div class="dir-top"><span class="dir-cat">퇴직 · 이직</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>퇴직금 계산기</h2>
            <p>법정 퇴직금과 퇴직소득세</p>
          </a>
          <a class="dir-card" href="/unemployment/">
            <div class="dir-top"><span class="dir-cat">고용보험</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>실업급여 계산기</h2>
            <p>하루 수령액과 총 받는 금액</p>
          </a>
          <a class="dir-card" href="/weekly-holiday/">
            <div class="dir-top"><span class="dir-cat">단시간 근로</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>주휴수당 계산기</h2>
            <p>주휴수당과 월급 환산액</p>
          </a>
          <a class="dir-card" href="/stock-tax/">
            <div class="dir-top"><span class="dir-cat">해외투자</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>해외주식 양도세</h2>
            <p>250만 원 공제 후 양도세 22%</p>
          </a>
          <a class="dir-card" href="/real-estate/">
            <div class="dir-top"><span class="dir-cat">부동산</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>주택 취등록세</h2>
            <p>다주택 중과와 감면까지 반영한 취득세</p>
          </a>
          <a class="dir-card" href="/gift-tax/">
            <div class="dir-top"><span class="dir-cat">상속 · 증여</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>증여세 계산기</h2>
            <p>관계별 공제와 혼인·출산 공제 반영</p>
          </a>
          <a class="dir-card" href="/jeonse/">
            <div class="dir-top"><span class="dir-cat">임대차</span><span class="dir-arrow" aria-hidden="true">→</span></div>
            <h2>전월세 전환율</h2>
            <p>보증금을 월세로 바꿀 때 적정 월세</p>
          </a>
        </section>

        <aside class="tips-banner" aria-label="세금별 절세 꿀팁 안내">
          <div>
            <span class="tips-kicker">절세 가이드 · 9종 36가지 핵심 정리</span>
            <strong>${DATA.year} 세금별 절세 꿀팁 한눈에 보기</strong>
            <p>연말정산, 프리랜서 3.3%, 해외주식 양도세, 취등록세, 증여세, 퇴직금 IRP까지 합법적으로 세금을 줄이는 핵심 체크리스트를 모았습니다.</p>
          </div>
          <a class="tips-banner-cta" href="/tips/">절세 꿀팁 전체 보기 →</a>
        </aside>

        ${renderAdSlot("homeMid")}

        <section class="section-block official-links">
          <h2>신고·신청은 공식 사이트에서</h2>
          <div class="official-grid">
            <a class="official-card" href="https://www.hometax.go.kr" target="_blank" rel="noopener noreferrer"><strong>국세청 홈택스 <span aria-hidden="true">↗</span></strong><span>연말정산, 종합소득세, 양도세, 증여세 신고</span></a>
            <a class="official-card" href="https://www.wetax.go.kr" target="_blank" rel="noopener noreferrer"><strong>위택스 <span aria-hidden="true">↗</span></strong><span>취득세 등 지방세 신고·납부</span></a>
            <a class="official-card" href="https://www.work24.go.kr" target="_blank" rel="noopener noreferrer"><strong>고용24 <span aria-hidden="true">↗</span></strong><span>실업급여 신청·실업인정</span></a>
            <a class="official-card" href="https://www.4insure.or.kr" target="_blank" rel="noopener noreferrer"><strong>4대사회보험 정보연계센터 <span aria-hidden="true">↗</span></strong><span>4대보험료 모의계산·가입내역</span></a>
          </div>
          <a class="official-more" href="/links/">공식 사이트·상담 전화 전체 보기 →</a>
        </section>

        <section class="section-block">
          <h2>자주 찾는 구간 바로가기</h2>
          <div class="link-matrix">
            <a class="matrix-pill" href="/salary/4000-manwon/">연봉 4,000만 원</a>
            <a class="matrix-pill" href="/salary/5000-manwon/">연봉 5,000만 원</a>
            <a class="matrix-pill" href="/salary/7000-manwon/">연봉 7,000만 원</a>
            <a class="matrix-pill" href="/salary/10000-manwon/">연봉 1억 원</a>
            <a class="matrix-pill" href="/severance/350-manwon-3-year/">월 350만 · 3년 퇴직금</a>
            <a class="matrix-pill" href="/unemployment/350-manwon-3-year/">월 350만 · 3년 실업급여</a>
            <a class="matrix-pill" href="/weekly-holiday/${DATA.weeklyHoliday.minimumWage2026}-won-20-hours/">2026 최저시급 주 20시간 주휴수당</a>
            <a class="matrix-pill" href="/weekly-holiday/2027-minimum-wage/">2027 최저임금 10,700원 비교</a>
            <a class="matrix-pill" href="/stock-tax/1000-manwon/">해외주식 1,000만 원 양도세</a>
            <a class="matrix-pill" href="/gift-tax/adult-child-1-eok/">성년 자녀 1억 증여세</a>
            <a class="matrix-pill" href="/real-estate/6-eok/">6억 아파트 취등록세</a>
          </div>
        </section>
      `
    })
  );
}

function buildTipsPage() {
  const order = [
    "salary",
    "freelancer",
    "stockTax",
    "realEstate",
    "giftTax",
    "severance",
    "unemployment",
    "weeklyHoliday",
    "jeonse"
  ];
  const categories = order
    .map((key) => TAX_TIPS && TAX_TIPS.categories && TAX_TIPS.categories[key])
    .filter(Boolean);
  const totalTips = categories.reduce((acc, c) => acc + c.tips.length, 0);

  const tipsFaqs = [
    {
      q: "연말정산이나 종합소득세 공제를 놓쳤으면 나중에 돌려받을 수 있나요?",
      a: "네, 법정 신고기한이 지난 날부터 5년 이내에 국세청 홈택스(손택스)에서 '경정청구'를 신청하면 누락한 월세 세액공제·중소기업 청년 감면·부양가족 공제 등을 소급해 환급받을 수 있습니다."
    },
    {
      q: "세금이 0원인 증여나 해외주식 수익도 신고해야 하나요?",
      a: "증여세는 공제 한도(배우자 6억, 자녀 5,000만·2,000만 원) 이내라 납부세액이 0원이어도 신고해 두어야 10년 기산일과 향후 자금출처가 공식 인정됩니다. 해외주식은 수익 250만 원 이하로 납부세액이 없으면 가산세는 발생하지 않습니다."
    },
    {
      q: "절세 팁을 적용하기 전 개인별 세액은 어디서 확인하나요?",
      a: "각 세목별 섹션 우측의 계산기 바로가기에서 본인 금액과 조건을 먼저 시뮬레이션하고, 실제 신고·납부는 국세청 홈택스(126)나 위택스(지방세)에서 최종 확인하세요."
    }
  ];

  const jumpPills = categories
    .map((c) => `<a class="matrix-pill" href="#${escapeHtml(c.slug)}">${escapeHtml(c.shortLabel)}</a>`)
    .join("");

  const sectionsHtml = categories
    .map(
      (cat, idx) => `
      <section class="section-block tips-hub-group" id="${escapeHtml(cat.slug)}" aria-label="${escapeHtml(cat.title)}">
        <div class="tips-head">
          <div class="tips-head-title">
            <span class="tips-kicker">0${idx + 1} · ${escapeHtml(cat.shortLabel)}</span>
            <h2>${escapeHtml(cat.title)}</h2>
          </div>
          <a class="tips-calc-btn" href="${escapeHtml(cat.calcHref)}">${escapeHtml(cat.calcLabel)} →</a>
        </div>
        ${cat.subtitle ? `<p class="tips-sub">${escapeHtml(cat.subtitle)}</p>` : ""}
        <div class="tips-grid">
          ${cat.tips
            .map(
              (tip, i) => `
            <article class="tip-card">
              <div class="tip-top">
                <span class="tip-num">TIP ${String(i + 1).padStart(2, "0")}</span>
                <span class="tip-tag">${escapeHtml(tip.tag)}</span>
              </div>
              <h3>${escapeHtml(tip.title)}</h3>
              <p>${escapeHtml(tip.body)}</p>
              ${tip.caution ? `<div class="tip-caution">주의 · ${escapeHtml(tip.caution)}</div>` : ""}
            </article>`
            )
            .join("")}
        </div>
      </section>
      ${idx === 2 || idx === 5 ? renderAdSlot("pseoMid") : ""}
    `
    )
    .join("");

  writePage(
    "/tips/",
    renderLayout({
      routePath: "/tips/",
      title: `${DATA.year} 세금별 절세 꿀팁 총정리 (${totalTips}가지 핵심 체크)`,
      description: `${DATA.year}년 법령 기준 연봉·연말정산, 프리랜서 3.3%, 해외주식 양도세, 주택 취등록세, 증여세, 퇴직금 IRP, 실업급여, 전월세까지 세금별 절세 꿀팁 ${totalTips}가지를 한곳에 모았습니다.`,
      activeNav: "tips",
      priority: "0.9",
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "절세 꿀팁 모음", href: "/tips/" }],
      faqs: tipsFaqs,
      bodyHtml: `
        <header class="page-head">
          <div class="page-head-row">
            <h1>${DATA.year} 세금별 절세 꿀팁 총정리</h1>
            <span class="meta-tag">${categories.length}개 분야 · ${totalTips}가지 핵심 · ${escapeHtml(TAX_TIPS.updatedAt || DATA.updatedAt)} 기준</span>
          </div>
          <p class="subtitle">세목별로 가장 효과가 큰 공제·감면·신고 타이밍만 추렸습니다. 원하는 세금을 눌러 바로 이동하세요.</p>
          <nav class="link-matrix" aria-label="세금별 절세 꿀팁 바로가기">
            ${jumpPills}
          </nav>
        </header>
        ${renderAdSlot("calcMid")}
        ${sectionsHtml}
        ${renderFaqSection(tipsFaqs)}
      `
    })
  );
}

function buildLinksPage() {
  const groups = [
    { key: "salary", title: "연봉·4대보험·연말정산", calc: "/salary/" },
    { key: "freelancer", title: "프리랜서·종합소득세", calc: "/freelancer/" },
    { key: "severance", title: "퇴직금·퇴직연금(IRP)", calc: "/severance/" },
    { key: "unemployment", title: "실업급여(구직급여)", calc: "/unemployment/" },
    { key: "weeklyHoliday", title: "최저임금·주휴수당·근로기준", calc: "/weekly-holiday/" },
    { key: "stockTax", title: "해외주식 양도소득세", calc: "/stock-tax/" },
    { key: "realEstate", title: "주택 취득세·부동산", calc: "/real-estate/" },
    { key: "giftTax", title: "증여세·상속세", calc: "/gift-tax/" },
    { key: "jeonse", title: "전월세·임대차", calc: "/jeonse/" }
  ];
  const faqs = [
    {
      q: "세금 신고는 어디서 하나요?",
      a: "종합소득세·양도소득세·증여세 등 국세는 국세청 홈택스(모바일은 손택스), 취득세 등 지방세는 위택스(서울은 이택스)에서 신고·납부합니다."
    },
    {
      q: "전화로 상담받을 수 있나요?",
      a: "국세는 국세청 126, 퇴직금·주휴수당·실업급여는 고용노동부 1350, 국민연금은 1355, 건강보험은 1577-1000에서 무료 상담을 받을 수 있습니다."
    }
  ];
  writePage(
    "/links/",
    renderLayout({
      routePath: "/links/",
      title: "세금·노동 공식 사이트 모음 (홈택스·위택스·고용24)",
      description: "국세청 홈택스, 위택스, 고용24, 4대보험, 통합연금포털, 실거래가 등 세금·급여·부동산 신고와 조회에 필요한 정부·공공기관 사이트와 상담 전화번호 모음.",
      activeNav: "",
      priority: "0.6",
      breadcrumbs: [
        { label: "홈", href: "/" },
        { label: "공식 사이트 모음", href: "/links/" }
      ],
      faqs,
      bodyHtml: `
        <header class="page-head">
          <h1>세금·노동 공식 사이트 모음</h1>
          <p class="subtitle">계산한 뒤 실제로 신고하고 신청할 수 있는 정부·공공기관 사이트입니다. 모두 공식 주소이며 광고 링크가 아닙니다.</p>
        </header>
        ${groups
          .map(
            (g) => `
          <section class="section-block official-links">
            <h2>${escapeHtml(g.title)} <a class="official-calc-link" href="${g.calc}">계산기 →</a></h2>
            <div class="official-grid">
              ${(DATA.officialLinks[g.key] || [])
                .map(
                  (l) => `<a class="official-card" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(l.label)} <span aria-hidden="true">↗</span></strong><span>${escapeHtml(l.desc)}</span></a>`
                )
                .join("")}
            </div>
          </section>`
          )
          .join("")}
        <section class="section-block">
          <h2>무료 전화 상담</h2>
          <div class="official-grid">
            ${(DATA.helplines || [])
              .map(
                (h) => `<a class="official-card" href="tel:${escapeHtml(h.number.replace(/-/g, ""))}"><strong>${escapeHtml(h.label)} · ${escapeHtml(h.number)}</strong><span>${escapeHtml(h.desc)}</span></a>`
              )
              .join("")}
          </div>
        </section>
        ${renderAdSlot("calcMid")}
        ${renderFaqSection(faqs)}
      `
    })
  );
}

function buildTrustPages() {
  const contactEmail = DATA.contactEmail || "";
  const contactLink = contactEmail
    ? `<a href="mailto:${escapeHtml(contactEmail)}">${escapeHtml(contactEmail)}</a>`
    : "";

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
          <p class="subtitle">세금, 4대보험, 부동산, 급여 계산을 누구나 쉽게 해볼 수 있도록 만든 무료 계산기입니다.</p>
        </header>

        <article class="prose-sheet">
          <h2>1. 제공 중인 9종 계산기</h2>
          <ul>
            <li><a href="/salary/">연봉 실수령액 계산기</a> — 4대보험(국민연금·건강보험·장기요양보험·고용보험)과 소득세법 시행령 별표2 근로소득 간이세액표(2026. 2. 27. 개정) 원표 조회, 8~20세 자녀 공제, 원천징수 80/100/120%</li>
            <li><a href="/freelancer/">프리랜서 3.3% 계산기</a> — 사업소득 원천징수(소득세 3% + 지방소득세 소득세의 10%) 정산 및 세후→세전 역산</li>
            <li><a href="/severance/">퇴직금 계산기</a> — 1일 평균임금 × 30일 × 재직일수/365 법정 퇴직금, 근속연수공제·환산급여공제 퇴직소득세, IRP 이전(과세이연) 여부</li>
            <li><a href="/unemployment/">실업급여 계산기</a> — 평균임금 60%, 상한 68,100원, 최저임금·1일 소정근로시간 연동 하한, 연령·피보험기간별 소정급여일수</li>
            <li><a href="/weekly-holiday/">주휴수당 계산기</a> — 주 15시간 이상 주휴수당, 5인 이상 사업장 연장근로 50% 가산, 월 환산 급여(주 40시간 = 209시간)</li>
            <li><a href="/stock-tax/">해외주식 양도소득세 계산기</a> — 연간 250만 원 기본공제, 손익통산, 2026 국내시장복귀계좌(RIA) 소득공제 후 22%(양도세 20% + 지방소득세)</li>
            <li><a href="/real-estate/">주택 취등록세 계산기</a> — 표준세율(1~3%), 조정대상지역·주택 수별 8%·12% 중과, 중과 시 교육세 0.4%·농특세 0.6/1.0%, 생애최초·출산 감면</li>
            <li><a href="/gift-tax/">증여세 계산기</a> — 수증자 기준 10년 공제 한도, 혼인·출산 1억 공제, 세대생략 할증, 기납부세액공제, 누진세율, 신고세액공제 3%, 과세최저한 50만 원</li>
            <li><a href="/jeonse/">전월세 전환율 계산기</a> — 보증금 차액과 전환율 기준 월세, 주택임대차보호법상 전환율 상한(기준금리 + 2%p) 자동 적용</li>
          </ul>

          <h2>2. 세율·요율 공식 참고 출처</h2>
          <p>모든 계산 로직은 대한민국 관계 기관의 공개 법령과 고시 자료를 바탕으로 주기적으로 점검합니다.</p>
          <ul>
            <li>소득세·양도소득세·증여세: <a href="https://www.hometax.go.kr" target="_blank" rel="noopener noreferrer">국세청 홈택스</a></li>
            <li>지방세(취득세·지방교육세): <a href="https://www.wetax.go.kr" target="_blank" rel="noopener noreferrer">위택스(WeTax)</a></li>
            <li>실업급여·최저임금·근로기준: <a href="https://www.work24.go.kr" target="_blank" rel="noopener noreferrer">고용24</a> 및 <a href="https://www.moel.go.kr" target="_blank" rel="noopener noreferrer">고용노동부</a></li>
            <li>금융상품·임대차 참고: <a href="https://fine.fss.or.kr" target="_blank" rel="noopener noreferrer">금융감독원 파인</a> 및 <a href="https://www.khug.or.kr" target="_blank" rel="noopener noreferrer">주택도시보증공사(HUG)</a></li>
            <li>법령 원문: <a href="https://www.law.go.kr" target="_blank" rel="noopener noreferrer">국가법령정보센터</a> (소득세법 시행령 별표2, 지방세법 제11조·제13조의2, 지방세특례제한법 제36조의3·제36조의5, 상속세 및 증여세법 제53조·제53조의2·제57조, 조세특례제한법 제91조의26, 고용보험법 제45·46조, 근로자퇴직급여 보장법 제9조, 주택임대차보호법 시행령 제9조)</li>
          </ul>
          <p>최종 법령 대조일: ${DATA.updatedAt}. 한국은행 기준금리 ${DATA.jeonse.baseRate.toFixed(2)}%(${DATA.jeonse.baseRateAsOf}), 조정대상지역은 2026년 7월 1일 지정 현황을 반영했습니다.</p>

          <h2>3. 면책고지 (Disclaimer)</h2>
          <p>${escapeHtml(DATA.siteName)}의 모든 계산 결과는 일반적인 법정 요율을 적용한 <strong>참고용 추정치</strong>입니다. 비과세 항목 구성, 부양가족·자녀 세액공제, 생애최초·신혼부부 감면, 조정대상지역 여부, 과거 10년 내 합산 증여 이력 등 개인별 특수 조건에 따라 실제 신고·납부 세액과 차이가 발생할 수 있습니다. 실제 세무 신고나 계약 결정 전에는 반드시 관할 세무서, 홈택스 모의계산 또는 세무 전문가의 확인을 받으시기 바랍니다.</p>

          <h2>4. 오류 제보 및 문의</h2>
          <p>계산 공식 오류 제보, 신규 계산기 제안, 세율 개정 반영 요청은 이메일로 보내주시면 확인 후 반영합니다. 문의: ${contactLink}</p>
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
            <li><strong>제휴 링크 (링크프라이스)</strong>: "광고"로 표시된 제휴 링크를 누르면 성과 확인을 위해 링크프라이스와 제휴사가 쿠키를 사용할 수 있습니다. 계산기에 입력한 값은 전달되지 않습니다.</li>
            <li><strong>광고 서비스 (Google AdSense 등)</strong>: 제3자 광고 사업자가 이용자의 이전 방문 기록을 바탕으로 맞춤형 광고를 제공하기 위해 쿠키를 사용할 수 있습니다.</li>
          </ul>
          <p>이용자는 브라우저 설정에서 쿠키 저장을 거부하거나, <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google 광고 설정</a>에서 맞춤형 광고를 비활성화할 수 있습니다.</p>

          <h2>3. 외부 링크에 대한 책임</h2>
          <p>본 사이트에는 국세청 홈택스, 위택스, 고용24 등 외부 공식 기관 또는 제휴 안내 페이지로 연결되는 링크가 포함되어 있습니다. 외부 사이트 이동 후의 개인정보 처리는 해당 사이트의 개인정보처리방침을 따릅니다.</p>

          <h2>4. 개인정보 보호 문의</h2>
          <p>본 방침에 관한 문의는 이메일 ${contactLink} 로 받으며, 법령 또는 서비스 변경에 따라 방침이 개정될 경우 본 페이지를 통해 공지합니다.</p>
        </article>
      `
    })
  );

  writeRootFile(
    "404.html",
    renderLayout({
      routePath: "/404.html",
      title: "페이지를 찾을 수 없습니다 (404)",
      description: `요청하신 페이지를 찾을 수 없습니다. ${DATA.siteName} 9종 계산기 목록으로 이동해 주세요.`,
      activeNav: "",
      includeInSitemap: false,
      breadcrumbs: [{ label: "홈", href: "/" }, { label: "404", href: "/404.html" }],
      bodyHtml: `
        <section class="not-found-box">
          <div class="not-found-code num">404</div>
          <h1>요청하신 페이지를 찾을 수 없습니다</h1>
          <p class="subtitle">주소가 변경되었거나 잘못 입력된 경로입니다. 아래 버튼 또는 상단 메뉴에서 원하시는 계산기를 선택해 주세요.</p>
          <a class="not-found-cta" href="/">${escapeHtml(DATA.siteName)} 홈으로 이동 →</a>
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
            <a class="matrix-pill" href="/tips/">절세 꿀팁 모음</a>
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

  const pubDate = new Date(`${DATA.updatedAt}T00:00:00Z`).toUTCString();
  const rssItems = [...GENERATED_URLS]
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 60);
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeHtml(DATA.siteName)} · ${escapeHtml(DATA.siteTagline)}</title>
    <link>${escapeHtml(BASE_URL)}/</link>
    <description>${escapeHtml(DATA.year + "년 한국 세금·금융·근로 실수령 계산기 9종 및 구간별 계산 가이드")}</description>
    <language>ko</language>
    <lastBuildDate>${pubDate}</lastBuildDate>
    <atom:link href="${escapeHtml(BASE_URL)}/rss.xml" rel="self" type="application/rss+xml" />
${rssItems
  .map(
    (u) => `    <item>
      <title>${escapeHtml(u.title || DATA.siteName)}</title>
      <link>${escapeHtml(u.loc)}</link>
      <guid isPermaLink="true">${escapeHtml(u.loc)}</guid>
      <description>${escapeHtml(u.description || DATA.siteTagline)}</description>
      <pubDate>${pubDate}</pubDate>
    </item>`
  )
  .join("\n")}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(DIST, "rss.xml"), rssXml, "utf8");

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
  try {
    const host = new URL(BASE_URL).hostname;
    if (host && !host.endsWith(".github.io")) {
      fs.writeFileSync(path.join(DIST, "CNAME"), `${host}\n`, "utf8");
    }
  } catch {
    // ignore invalid URL
  }
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
  buildTipsPage();
  buildLinksPage();
  buildTrustPages();
  writeSeoFiles();
  const elapsed = Date.now() - start;
  console.log(`Built ${GENERATED_URLS.length} static SEO pages in ${elapsed}ms -> ${DIST}`);
}

main();
