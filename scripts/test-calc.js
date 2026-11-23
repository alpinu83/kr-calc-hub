#!/usr/bin/env node
"use strict";

/*
 * 9종 계산기 단위 테스트 — 기대값은 법령 원문·공식 고시 기준으로 검산한 값
 * (2026-11-23 대조: 소득세법 시행령 별표2, 지방세법 제11조·제13조의2, 지방세특례제한법 제36조의3·5,
 *  상속세 및 증여세법 제53조·제53조의2·제55조·제57조, 조세특례제한법 제91조의26, 고용보험법 시행령 제68조)
 */
const assert = require("assert");
const Calc = require("../src/calculators");

function eq(actual, expected, label) {
  assert.strictEqual(actual, expected, `${label}: expected ${expected}, got ${actual}`);
}

function runTests() {
  // 1. 연봉 — 간이세액표 원표 값과 일치해야 함 (비과세 0원)
  const table = {
    2000000: [19520, 14750, 6600, 3220],
    3000000: [74350, 56850, 31940, 26690],
    4000000: [195960, 167950, 109590, 91670],
    5000000: [335470, 306710, 237850, 219100],
    8000000: [959500, 909890, 768550, 738550]
  };
  for (const [monthly, values] of Object.entries(table)) {
    values.forEach((v, i) => eq(Calc.calcSalary(Number(monthly) * 12, 0, i + 1).incomeTax, v, `간이세액표 ${monthly}/${i + 1}명`));
  }
  eq(Calc.lookupWageTax(10000000, 1), 1507400, "간이세액표 1,000만 원");
  eq(Calc.lookupWageTax(4000000, 11), 23070, "간이세액표 400만 원 11명");
  // 자녀 공제(2026.3~): 400만 원·4명·자녀 2명 = 91,670 - 45,830
  eq(Calc.calcSalary(48000000, 0, 4, null, { children: 2 }).incomeTax, 45840, "자녀 2명 공제");
  eq(Calc.calcSalary(48000000, 0, 1, null, { withholdingRatio: 0.8 }).incomeTax, 156760, "원천징수 80%");
  // 연봉 5,000만 원·식대 20만 원: 소득세+지방세 209,680원
  const s5000 = Calc.calcSalary(50000000, 200000, 1);
  eq(s5000.incomeTax + s5000.localIncomeTax, 209680, "연봉 5천 세금");
  eq(s5000.nationalPension, 188380, "연봉 5천 국민연금(기준소득월액 천원 미만 절사)");
  const sHigh = Calc.calcSalary(150000000, 200000, 1);
  eq(sHigh.nationalPension, Math.floor((6590000 * 0.0475) / 10) * 10, "국민연금 상한");
  eq(Calc.calcSalary(0, 200000, 1).monthlyNet, 0, "연봉 0");

  // 2. 프리랜서 3.3%
  const f100 = Calc.calcFreelancer(1000000, "grossToNet");
  eq(f100.incomeTax, 30000, "3% 소득세");
  eq(f100.localTax, 3000, "지방소득세");
  eq(f100.net, 967000, "실수령");
  eq(Calc.calcFreelancer(967000, "netToGross").gross, 1000000, "역산");

  // 3. 해외주식
  eq(Calc.calcOverseasStockTax(2500000, 0).totalTax, 0, "250만 이하");
  const st = Calc.calcOverseasStockTax(10000000, 2000000);
  eq(st.taxableBase, 5500000, "과세표준");
  eq(st.totalTax, 1210000, "22%");
  // RIA: 차익 2,000만 원, 6~7월 결제(80%) → (2,000 - 1,600 - 250) × 22% = 33만 원 (금감원 예시)
  eq(Calc.calcOverseasStockTax(20000000, 0, null, { riaGain: 20000000, riaPeriod: "jul" }).totalTax, 330000, "RIA 80%");
  eq(Calc.calcOverseasStockTax(20000000, 0, null, { riaGain: 20000000, riaPeriod: "dec" }).totalTax, 1650000, "RIA 50%");

  // 4. 주택 취득세
  eq(Calc.calcAcquisitionTax(500000000, 1, false).totalTax, 5500000, "5억 1주택");
  eq(Calc.calcAcquisitionTax(1000000000, 1, true).totalTax, 35000000, "10억 85㎡ 초과");
  eq(Calc.calcAcquisitionTax(700000000, 1, false).acquisitionRate, 0.0167, "7억 세율 1.67%");
  eq(Calc.calcAcquisitionTax(600000000, 2, false, null, { adjusted: false }).totalTax, 6600000, "비조정 2주택 = 표준세율");
  eq(Calc.calcAcquisitionTax(600000000, 2, false, null, { adjusted: true }).totalTax, 50400000, "조정 2주택 8.4%");
  eq(Calc.calcAcquisitionTax(600000000, 2, false, null, { adjusted: true, temporary2: true }).totalTax, 6600000, "일시적 2주택");
  eq(Calc.calcAcquisitionTax(1000000000, 3, true, null, { adjusted: true }).totalTax, 134000000, "조정 3주택 85㎡ 초과 13.4%");
  eq(Calc.calcAcquisitionTax(1000000000, 3, true, null, { adjusted: false }).totalTax, 90000000, "비조정 3주택 85㎡ 초과 9.0%");
  eq(Calc.calcAcquisitionTax(500000000, 1, false, null, { relief: "first" }).acquisitionTax, 3000000, "생애최초 200만");
  eq(Calc.calcAcquisitionTax(500000000, 1, false, null, { relief: "birth" }).acquisitionTax, 0, "출산 500만");
  eq(Calc.calcAcquisitionTax(1300000000, 1, false, null, { relief: "first" }).reliefAmount, 0, "12억 초과 감면 불가");

  // 5. 전월세 — 상한 = 기준금리 3.00% + 2%p
  const jw = Calc.calcJeonseToWolse(300000000, 100000000, 6.0);
  eq(jw.monthlyRent, 1000000, "6% 월세");
  eq(jw.legalCapRate, 5, "법정 상한");
  eq(jw.exceedsCap, true, "상한 초과 표시");
  eq(Calc.calcJeonseToWolse(300000000, 100000000).conversionRate, 5, "기본값 = 상한");

  // 6. 퇴직금 — 1일 평균임금(91일) × 30 × 재직일수/365
  const sev = Calc.calcSeverance(3500000, 3);
  eq(sev.gross, 10384615, "350만·3년 퇴직금");
  eq(sev.irpRequired, true, "IRP 이전 대상");
  const sevBonus = Calc.calcSeverance(3500000, 3, { annualBonus: 4000000, threeMonthDays: 92 });
  assert(sevBonus.gross > sev.gross, "상여금 반영");
  eq(Calc.calcSeverance(4000000, 0.5).eligible, false, "1년 미만");
  eq(Calc.calcSeverance(4000000, 0.5).gross, 0, "1년 미만 0원");
  eq(Calc.calcSeverance(800000, 3, { irpExempt: false }).irpRequired, false, "300만 원 이하 IRP 예외");

  // 7. 실업급여
  const unemp = Calc.calcUnemployment(4000000, false, 4);
  eq(unemp.dailyBenefit, 68100, "상한");
  eq(unemp.benefitDays, 180, "3~5년 180일");
  eq(Calc.calcUnemployment(2200000, false, 1).dailyBenefit, 66048, "8시간 하한");
  eq(Calc.calcUnemployment(1000000, false, 3, null, { dailyHours: 4 }).dailyBenefit, 33024, "4시간 하한");
  eq(Calc.calcUnemployment(3000000, false, 0).eligible, false, "180일 미만");

  // 8. 주휴수당
  const wh40 = Calc.calcWeeklyHoliday(10320, 40);
  eq(wh40.holidayPay, 82560, "주휴수당 40시간");
  eq(wh40.monthlyPaidHours, 209, "월 209시간");
  eq(wh40.estimatedMonthlyPay, 2156880, "최저임금 월 환산 고시액");
  eq(Calc.calcWeeklyHoliday(10320, 10).holidayPay, 0, "15시간 미만");
  eq(Calc.calcWeeklyHoliday(10320, 50).overtimePay, 154800, "연장 10시간 × 1.5");

  // 9. 증여세
  const gift = Calc.calcGiftTax(100000000, "adultChild");
  eq(gift.finalTax, 4850000, "성년 자녀 1억");
  eq(Calc.calcGiftTax(200000000, "adultChild", null, { marriageBirth: 100000000 }).finalTax, 4850000, "혼인공제 1억 추가");
  eq(Calc.calcGiftTax(50400000, "adultChild").finalTax, 0, "과세표준 50만 원 미만");
  eq(Calc.calcGiftTax(100000000, "adultGrandchild").finalTax, 6305000, "세대생략 30% 할증");
  eq(Calc.calcGiftTax(200000000, "adultChild", null, { priorTax: 5000000 }).finalTax, 14550000, "기납부세액공제");

  console.log("All 9 calculator unit tests passed! (statute-verified expectations)");
}

runTests();
