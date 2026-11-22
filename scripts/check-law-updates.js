#!/usr/bin/env node
"use strict";

/**
 * 법제처 국가법령정보 공동활용 Open API 개정 감시 스크립트
 * - 사용법: LAW_OC=<발급받은_이메일ID> node scripts/check-law-updates.js
 * - 신청처: https://open.law.go.kr (무료 회원가입 후 Open API 승인 시 OC 값 발급)
 *
 * 법령 본문은 자연어 조문이므로 브라우저 실시간 계산에 직접 호출하지 않고,
 * GitHub Actions 월간 배치로 법령 개정/시행일 변경을 자동 감지해 이슈로 알립니다.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VERSIONS_PATH = path.join(ROOT, "data", "law-versions.json");
const OC = (process.env.LAW_OC || "").trim();

const WATCH_TARGETS = [
  { id: "income-tax", target: "law", query: "소득세법", scope: "연봉·퇴직금·해외주식·프리랜서" },
  { id: "national-pension", target: "law", query: "국민연금법", scope: "연봉 4대보험(국민연금 요율)" },
  { id: "health-insurance", target: "law", query: "국민건강보험법", scope: "연봉 4대보험(건강·장기요양)" },
  { id: "employment-insurance", target: "law", query: "고용보험법", scope: "고용보험료·실업급여" },
  { id: "local-tax", target: "law", query: "지방세법", scope: "주택 취등록세·지방소득세" },
  { id: "gift-tax", target: "law", query: "상속세 및 증여세법", scope: "증여세 공제·세율" },
  { id: "minimum-wage", target: "admrul", query: "최저임금 고시", scope: "주휴수당·실업급여 하한액" }
];

async function fetchLatestEntry(item) {
  const url = `https://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(OC)}&target=${item.target}&type=JSON&display=5&query=${encodeURIComponent(item.query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${item.query}`);
  }
  const data = await res.json();
  if (item.target === "law") {
    const raw = data && data.LawSearch && data.LawSearch.law;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const exact = list.find((x) => x["법령명한글"] === item.query) || list[0];
    if (!exact) return null;
    return {
      name: exact["법령명한글"] || item.query,
      serial: String(exact["법령일련번호"] || ""),
      promulgatedDate: String(exact["공포일자"] || ""),
      effectiveDate: String(exact["시행일자"] || ""),
      amendmentType: String(exact["제개정구분명"] || "")
    };
  }
  const raw = data && data.AdmRulSearch && data.AdmRulSearch.admrul;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const latest = list[0];
  if (!latest) return null;
  return {
    name: latest["행정규칙명"] || item.query,
    serial: String(latest["행정규칙일련번호"] || ""),
    promulgatedDate: String(latest["발령일자"] || ""),
    effectiveDate: String(latest["시행일자"] || ""),
    amendmentType: String(latest["제개정구분명"] || "")
  };
}

async function main() {
  if (!OC) {
    console.log("LAW_OC 환경변수가 설정되지 않아 법제처 Open API 조회를 건너뜁니다.");
    console.log("안내: https://open.law.go.kr 에서 OC 값을 발급받아 GitHub Secrets(LAW_OC)에 등록하세요.");
    return;
  }

  const prev = fs.existsSync(VERSIONS_PATH)
    ? JSON.parse(fs.readFileSync(VERSIONS_PATH, "utf8"))
    : { checkedAt: null, laws: {} };

  const next = { checkedAt: new Date().toISOString().slice(0, 10), laws: {} };
  const changes = [];

  for (const item of WATCH_TARGETS) {
    const info = await fetchLatestEntry(item);
    if (!info) continue;
    next.laws[item.id] = { ...info, scope: item.scope };
    const old = prev.laws && prev.laws[item.id];
    if (old && (old.serial !== info.serial || old.effectiveDate !== info.effectiveDate)) {
      changes.push({ item, old, current: info });
    }
  }

  fs.writeFileSync(VERSIONS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");

  if (changes.length > 0) {
    const lines = [
      "## 법제처 Open API 세법·노동법 개정 감지",
      "",
      `점검일: ${next.checkedAt}`,
      "",
      "| 법령/고시 | 영향 계산기 | 기존 시행일 | 신규 시행일 | 구분 |",
      "|---|---|---|---|---|"
    ];
    for (const c of changes) {
      lines.push(
        `| ${c.current.name} | ${c.item.scope} | ${c.old.effectiveDate || "-"} | ${c.current.effectiveDate || "-"} | ${c.current.amendmentType || "-"} |`
      );
    }
    lines.push("", "`data/rates-2026.json` 및 `src/calculators.js` 요율 검증이 필요합니다.");
    const reportPath = path.join(ROOT, "law-diff.md");
    fs.writeFileSync(reportPath, lines.join("\n") + "\n", "utf8");
    console.log(`Detected ${changes.length} statute update(s). Report written to law-diff.md`);
  } else {
    console.log(`Checked ${Object.keys(next.laws).length} statutes via Law Open API — no new changes.`);
  }
}

main().catch((err) => {
  console.error("Law Open API check failed:", err.message);
  process.exit(1);
});
