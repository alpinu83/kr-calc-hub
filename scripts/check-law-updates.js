#!/usr/bin/env node
"use strict";

/**
 * 법제처 국가법령정보 공동활용 Open API 개정 감시 스크립트
 * - 사용법: LAW_OC=<발급받은_OC> node scripts/check-law-updates.js
 * - 신청처: https://open.law.go.kr (무료 회원가입 후 Open API 승인 시 OC 값 발급)
 *
 * 개선(2026-11-23)
 * - 실제 요율이 들어 있는 시행령·고시와 감면 법률(지방세특례제한법·조세특례제한법 등)까지 감시 대상 확대
 * - target=eflaw, nw=2,3 으로 "현행 + 시행예정" 개정을 함께 조회 → 공포됐지만 아직 시행 전인 개정도 미리 감지
 * - 법령명 완전 일치만 채택(유사 명칭 오탐 방지), 고시는 발령일 내림차순 + 제외어 필터
 * - 기준선(law-versions.json)이 비어 있으면 알림 없이 초기화만 수행(첫 실행 전체 오탐 방지)
 * - 대상별 오류를 격리하고 결과를 GitHub Step Summary에 기록
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const VERSIONS_PATH = path.join(ROOT, "data", "law-versions.json");
const REPORT_PATH = path.join(ROOT, "law-diff.md");
const OC = (process.env.LAW_OC || "").trim();

const WATCH_TARGETS = [
  // 세법
  { id: "income-tax", target: "eflaw", query: "소득세법", scope: "연봉·퇴직금·해외주식·프리랜서 (세율·공제)" },
  { id: "income-tax-decree", target: "eflaw", query: "소득세법 시행령", scope: "근로소득 간이세액표(별표2)·자녀 공제" },
  { id: "local-tax", target: "eflaw", query: "지방세법", scope: "주택 취득세율·중과·지방교육세" },
  { id: "local-tax-decree", target: "eflaw", query: "지방세법 시행령", scope: "중과 제외 주택·일시적 2주택" },
  { id: "local-tax-special", target: "eflaw", query: "지방세특례제한법", scope: "생애최초·출산 취득세 감면" },
  { id: "rural-special-tax", target: "eflaw", query: "농어촌특별세법", scope: "취득세 농어촌특별세" },
  { id: "gift-tax", target: "eflaw", query: "상속세 및 증여세법", scope: "증여세 세율·공제·할증" },
  { id: "tax-special", target: "eflaw", query: "조세특례제한법", scope: "해외주식 RIA 공제" },
  // 4대보험
  { id: "national-pension", target: "eflaw", query: "국민연금법", scope: "국민연금 보험료율" },
  { id: "health-insurance-decree", target: "eflaw", query: "국민건강보험법 시행령", scope: "건강보험료율(제44조)" },
  { id: "ltc-insurance-decree", target: "eflaw", query: "노인장기요양보험법 시행령", scope: "장기요양보험료율" },
  { id: "ltc-insurance", target: "eflaw", query: "노인장기요양보험법", scope: "장기요양보험료 산정 비율" },
  { id: "insurance-premium-decree", target: "eflaw", query: "고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행령", scope: "고용보험료율(근로자 0.9%)" },
  // 노동·임대차
  { id: "employment-insurance", target: "eflaw", query: "고용보험법", scope: "실업급여 지급률·소정급여일수" },
  { id: "employment-insurance-decree", target: "eflaw", query: "고용보험법 시행령", scope: "구직급여 상한(제68조)" },
  { id: "retirement-benefit", target: "eflaw", query: "근로자퇴직급여 보장법", scope: "퇴직금·IRP 이전" },
  { id: "labor-standards", target: "eflaw", query: "근로기준법", scope: "주휴수당·연장근로 가산" },
  { id: "housing-lease-decree", target: "eflaw", query: "주택임대차보호법 시행령", scope: "전월세 전환율 상한(제9조)" },
  // 행정규칙(고시)
  { id: "minimum-wage", target: "admrul", query: "최저임금 고시", mustInclude: ["적용 최저임금"], exclude: ["선원"], scope: "주휴수당·실업급여 하한액(최저시급)" },
  { id: "pension-income-cap", target: "admrul", query: "기준소득월액", mustInclude: ["기준소득월액"], exclude: [], scope: "국민연금 기준소득월액 상·하한" }
];

// 법령으로 감지할 수 없는 항목: 매 점검 이슈에 수동 확인 체크리스트로 포함
const MANUAL_CHECKS = [
  "한국은행 기준금리(전월세 전환율 상한 = 기준금리 + 2%p) → data/rates-2026.json `jeonse.baseRate`",
  "조정대상지역 지정·해제(국토교통부 고시) → 취득세 계산기 안내 문구",
  "건강보험·장기요양보험료율 연도별 결정(매년 8~11월 의결, 1월 시행)",
  "국민연금 기준소득월액 상·하한(매년 7월 적용)"
];

function toList(raw) {
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`JSON 파싱 실패: ${text.slice(0, 120)}`);
  }
}

async function fetchLaw(item) {
  const url =
    `https://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(OC)}&target=eflaw&type=JSON` +
    `&nw=2,3&display=50&sort=efdes&query=${encodeURIComponent(item.query)}`;
  const data = await getJson(url);
  const list = toList(data && data.LawSearch && data.LawSearch.law).filter(
    (x) => String(x["법령명한글"] || "").trim() === item.query
  );
  if (!list.length) return null;
  // 현행 + 시행예정 중 시행일자가 가장 늦은 판(=가장 최근 개정)을 기준으로 삼음
  list.sort((a, b) => Number(b["시행일자"] || 0) - Number(a["시행일자"] || 0) || Number(b["법령일련번호"] || 0) - Number(a["법령일련번호"] || 0));
  const latest = list[0];
  const current = list.find((x) => String(x["현행연혁코드"] || "").includes("현행")) || latest;
  return {
    name: latest["법령명한글"],
    serial: String(latest["법령일련번호"] || ""),
    promulgatedDate: String(latest["공포일자"] || ""),
    effectiveDate: String(latest["시행일자"] || ""),
    amendmentType: String(latest["제개정구분명"] || ""),
    status: String(latest["현행연혁코드"] || ""),
    currentEffectiveDate: String(current["시행일자"] || "")
  };
}

async function fetchAdminRule(item) {
  const url =
    `https://www.law.go.kr/DRF/lawSearch.do?OC=${encodeURIComponent(OC)}&target=admrul&type=JSON` +
    `&display=50&sort=ddes&query=${encodeURIComponent(item.query)}`;
  const data = await getJson(url);
  const list = toList(data && data.AdmRulSearch && data.AdmRulSearch.admrul).filter((x) => {
    const name = String(x["행정규칙명"] || "");
    return item.mustInclude.every((w) => name.includes(w)) && !item.exclude.some((w) => name.includes(w));
  });
  if (!list.length) return null;
  list.sort((a, b) => Number(b["발령일자"] || 0) - Number(a["발령일자"] || 0));
  const latest = list[0];
  return {
    name: latest["행정규칙명"],
    serial: String(latest["행정규칙일련번호"] || ""),
    promulgatedDate: String(latest["발령일자"] || ""),
    effectiveDate: String(latest["시행일자"] || ""),
    amendmentType: String(latest["제개정구분명"] || ""),
    status: "",
    currentEffectiveDate: String(latest["시행일자"] || "")
  };
}

function writeSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n", "utf8");
  }
}

async function main() {
  if (!OC) {
    console.log("LAW_OC 환경변수가 설정되지 않아 법제처 Open API 조회를 건너뜁니다.");
    console.log("안내: https://open.law.go.kr 에서 OC 값을 발급받아 GitHub Secrets(LAW_OC)에 등록하세요.");
    return;
  }

  const prev = fs.existsSync(VERSIONS_PATH) ? JSON.parse(fs.readFileSync(VERSIONS_PATH, "utf8")) : { laws: {} };
  const next = { checkedAt: new Date().toISOString().slice(0, 10), laws: {} };
  const changes = [];
  const initialized = [];
  const failures = [];

  for (const item of WATCH_TARGETS) {
    let info = null;
    try {
      info = item.target === "admrul" ? await fetchAdminRule(item) : await fetchLaw(item);
    } catch (err) {
      failures.push(`${item.query}: ${err.message}`);
    }
    const old = prev.laws && prev.laws[item.id];
    if (!info) {
      if (!failures.find((f) => f.startsWith(item.query))) failures.push(`${item.query}: 검색 결과 없음`);
      if (old) next.laws[item.id] = old; // 조회 실패 시 기존 기준선 유지
      continue;
    }
    next.laws[item.id] = { ...info, scope: item.scope };
    if (!old || !old.serial) {
      initialized.push(item.query);
    } else if (old.serial !== info.serial || old.effectiveDate !== info.effectiveDate) {
      changes.push({ item, old, current: info });
    }
  }

  fs.writeFileSync(VERSIONS_PATH, JSON.stringify(next, null, 2) + "\n", "utf8");

  const summary = [
    `## 법령 개정 감시 결과 (${next.checkedAt})`,
    "",
    `- 감시 대상 ${WATCH_TARGETS.length}개 / 조회 성공 ${Object.keys(next.laws).length}개`,
    `- 개정 감지 ${changes.length}건, 기준선 초기화 ${initialized.length}건, 조회 실패 ${failures.length}건`
  ];
  if (initialized.length) summary.push("", "기준선 초기화(알림 없음): " + initialized.join(", "));
  if (failures.length) summary.push("", "조회 실패:", ...failures.map((f) => `- ${f}`));
  writeSummary(summary);
  console.log(summary.join("\n"));

  if (changes.length > 0) {
    const lines = [
      "## 법제처 Open API 세법·노동법 개정 감지",
      "",
      `점검일: ${next.checkedAt}`,
      "",
      "| 법령/고시 | 영향 계산기 | 기존 시행일 | 새 시행일 | 상태 | 구분 | 공포일 |",
      "|---|---|---|---|---|---|---|"
    ];
    for (const c of changes) {
      lines.push(
        `| ${c.current.name} | ${c.item.scope} | ${c.old.effectiveDate || "-"} | ${c.current.effectiveDate || "-"} | ${c.current.status || "-"} | ${c.current.amendmentType || "-"} | ${c.current.promulgatedDate || "-"} |`
      );
    }
    lines.push(
      "",
      "### 처리 방법",
      "1. 국가법령정보센터에서 개정 조문(신구조문 대비표)을 확인합니다.",
      "2. 요율·금액이 바뀌면 `data/rates-2026.json`·`src/calculators.js`를 수정하고 `scripts/test-calc.js` 기대값을 법령 기준으로 갱신합니다.",
      "3. 간이세액표(소득세법 시행령 별표2)가 바뀌면 `src/wage-tax-table-2026.js`를 새 별표로 교체합니다.",
      "",
      "### 법령 외 수동 확인 항목",
      ...MANUAL_CHECKS.map((m) => `- [ ] ${m}`)
    );
    if (failures.length) lines.push("", "### 조회 실패", ...failures.map((f) => `- ${f}`));
    fs.writeFileSync(REPORT_PATH, lines.join("\n") + "\n", "utf8");
    console.log(`Detected ${changes.length} statute update(s). Report written to law-diff.md`);
  }

  if (failures.length === WATCH_TARGETS.length) {
    console.error("모든 대상 조회에 실패했습니다. LAW_OC 값과 API 승인 상태를 확인하세요.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Law Open API check failed:", err.message);
  process.exit(1);
});
