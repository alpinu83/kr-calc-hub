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
  const first5 = Calc.calcAcquisitionTax(500000000, 1, false, null, { relief: "first" });
  eq(first5.acquisitionTax, 3000000, "생애최초 200만");
  eq(first5.localEducationTax, 300000, "생애최초 지방교육세 비례 감면(30만)");
  const birth5 = Calc.calcAcquisitionTax(500000000, 1, false, null, { relief: "birth" });
  eq(birth5.acquisitionTax, 0, "출산 500만");
  eq(birth5.localEducationTax, 0, "출산 전액 감면 시 지방교육세 0원");
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

  require("../src/calculators-ext");

  // 10. 연말정산 환급액 (표준세액공제 13만 vs 특별소득·세액공제 중복 금지 검증)
  const ye = Calc.calcYearEndTax({
    gross: 50000000,
    dependents: 1,
    children: 0,
    creditCard: 10000000,
    debitCash: 8000000,
    pensionIrp: 6000000,
    monthlyRentAnnual: 6000000
  });
  eq(ye.pensionCredit, 900000, "연금저축 600만 × 15% (총급여 5,500만 이하)");
  eq(ye.rentCredit, 1020000, "월세 600만 × 17% (총급여 5,500만 이하)");
  eq(ye.usedStandardCredit, false, "건강·고용보험 및 월세 공제 시 표준세액공제 13만 중복 불가");
  assert(ye.cardDeduction > 0, "카드 소득공제 발생");
  assert(ye.refundAmount > 0, "공제 반영 시 환급 발생");
  const yePlain = Calc.calcYearEndTax({ gross: 50000000, dependents: 1 });
  eq(yePlain.usedStandardCredit, false, "총급여 5,000만은 건강·고용보험 특별소득공제가 표준 13만보다 유리(중복 없음)");
  eq(Calc.calcYearEndTax({ gross: 60000000, dependents: 3, children: 2 }).childTaxCredit, 550000, "2026 자녀 2명 55만");

  // 11. 맞벌이 절세 (부양가족 교육비 귀속 원칙 검증)
  const cp = Calc.calcCoupleTax({
    husbandGross: 80000000,
    wifeGross: 40000000,
    children: 1,
    otherDeps: 0,
    sharedMedical: 3000000,
    sharedEducation: 2000000,
    sharedCard: 15000000
  });
  assert(cp.best.totalTax <= cp.allHusband.totalTax && cp.best.totalTax <= cp.allWife.totalTax, "최적 배분이 몰아주기보다 작거나 같음");
  eq(cp.best.hChild === 1 ? cp.best.eduTo : cp.best.eduTo, cp.best.hChild === 1 ? "H" : "W", "자녀 교육비는 기본공제 배우자에게만 귀속");

  // 12. 사업소득금액 · 종합소득세
  const biz = Calc.calcBusinessIncomeTax({
    revenue: 50000000,
    expenseMode: "simple",
    expenseRate: 64.1,
    dependents: 1,
    yellowUmbrella: 6000000,
    autoPrepaid33: true
  });
  eq(biz.businessIncome, 17950000, "매출 5천만 × (1-64.1%)");
  eq(biz.yellowLimit, 6000000, "2026 사업소득 4천만 이하 노란우산 600만 한도");
  eq(biz.prepaidTax, 1650000, "3.3% 기납부");

  // 13. 상속세 (배우자 단독상속 일괄공제 불가 + 제24조 사전증여 공제한도 검증)
  eq(Calc.calcInheritanceTax({ grossEstate: 1000000000, hasSpouse: true, children: 2 }).finalTax, 0, "배우자 생존 10억 비과세");
  const inhSpouseOnly = Calc.calcInheritanceTax({ grossEstate: 1000000000, hasSpouse: true, children: 0 });
  eq(inhSpouseOnly.isSpouseOnly, true, "배우자 단독상속 판별");
  eq(inhSpouseOnly.lumpSumOrItem, 200000000, "배우자 단독상속 시 일괄 5억 불가 → 기초공제 2억");
  const inhPrior = Calc.calcInheritanceTax({ grossEstate: 600000000, priorGifts: 400000000, hasSpouse: true, children: 2 });
  assert(inhPrior.taxBase > 0, "상증세법 제24조: 사전증여재산은 상속공제 종합한도에서 차감");
  eq(Calc.calcInheritanceTax({ grossEstate: 2000000000, hasSpouse: false, children: 2, netFinancial: 1000000000 }).financialDeduction, 200000000, "금융재산공제 최대 2억");

  // 14. 부동산 양도소득세 (2년 거주 요건 + 2/3주택 중과)
  eq(Calc.calcPropertyTransferTax({ buyPrice: 600000000, sellPrice: 1200000000, holdYears: 3, resideYears: 2, isOneHome: true }).totalTax, 0, "1주택 12억 비과세");
  const trNeedReside = Calc.calcPropertyTransferTax({ buyPrice: 600000000, sellPrice: 1200000000, holdYears: 3, resideYears: 0, isOneHome: true, needReside2Years: true });
  assert(trNeedReside.totalTax > 0, "조정대상지역 2년 거주 미충족 시 비과세 배제");
  const tr15 = Calc.calcPropertyTransferTax({ buyPrice: 800000000, sellPrice: 1500000000, expenses: 20000000, holdYears: 10, resideYears: 10, isOneHome: true });
  eq(tr15.ltDeductionRate, 0.8, "1주택 10년 보유·거주 장특공제 80%");
  const trHeavy2 = Calc.calcPropertyTransferTax({ buyPrice: 500000000, sellPrice: 800000000, holdYears: 5, heavyMode: "two" });
  const trHeavy3 = Calc.calcPropertyTransferTax({ buyPrice: 500000000, sellPrice: 800000000, holdYears: 5, heavyMode: "three" });
  assert(trHeavy3.totalTax > trHeavy2.totalTax && trHeavy2.ltDeduction === 0, "3주택(+30%p) > 2주택(+20%p) 및 장특공제 배제");

  // 15. 부가가치세(VAT) (신용카드 발행공제 환급 불가 검증)
  const vatSimple = Calc.calcVat({ mode: "simple", amount: 11000000, isInclusive: true });
  eq(vatSimple.supply, 10000000, "부가세 포함 역산 공급가액");
  eq(vatSimple.vat, 1000000, "부가세 포함 역산 VAT");
  const vatNoRefundCard = Calc.calcVat({ mode: "general", sales: 10000000, purchases: 9500000, cardSales: 10000000 });
  eq(vatNoRefundCard.payableVat, 0, "일반과세자 신용카드 발행공제는 납부세액 한도 내 공제(환급 불가)");
  eq(Calc.calcVat({ mode: "simplified", sales: 40000000, vatValueRate: 0.3 }).payableVat, 0, "간이과세 4,800만 미만 납부면제");
  eq(Calc.calcVat({ mode: "simplified", sales: 110000000, vatValueRate: 0.3 }).overSimplifiedLimit, true, "간이과세 1억 400만 초과 전환 경고");

  // 16. 금융소득종합과세 (국내 배당 10% 그로스업 & 배당세액공제 검증)
  eq(Calc.calcFinancialTax({ interest: 10000000, dividend: 10000000, otherIncome: 50000000 }).additionalTotal, 0, "2,000만 이하 추가세액 0원");
  const finDom = Calc.calcFinancialTax({ interest: 0, dividend: 50000000, otherIncome: 50000000, domesticDividend: true });
  const finFor = Calc.calcFinancialTax({ interest: 0, dividend: 50000000, otherIncome: 50000000, domesticDividend: false });
  eq(finDom.grossUpAmount, 3000000, "국내배당 2,000만 초과분 3,000만 × 10% 그로스업");
  eq(finDom.dividendTaxCredit, 3000000, "배당세액공제 300만 적용");
  assert(finDom.additionalTotal < finFor.additionalTotal, "국내배당 그로스업·배당세액공제 시 해외배당보다 추가세액 감소");

  // 17. 자동차세 · 자동차 취득세 (11인승 승합차 교육세 면제 + 신차 부가세 제외 공급가액)
  const ev = Calc.calcCarTax({ carType: "ev", carAge: 1, prepayMonth: 0, carPrice: 55000000 });
  eq(ev.annualCarTax, 130000, "전기차 자동차세 연 13만 원");
  eq(ev.acqTaxBase, 50000000, "신차 취득세 과표 = 공급가액(부가세 제외)");
  eq(ev.acqRelief, 1400000, "2026 전기차 취득세 감면 140만 원");
  const van11 = Calc.calcCarTax({ carType: "van11", carAge: 1, prepayMonth: 0, carPrice: 44000000 });
  eq(van11.annualCarTax, 65000, "11인승 승합차 자동차세 65,000원 (지방교육세 0원 면제)");
  eq(van11.localEduTax, 0, "승합차 지방교육세 비과세");
  const car33 = Calc.calcCarTax({ carType: "passenger", cc: 2000, carAge: 1, prepayMonth: 1, carPrice: 33000000, isUsedCar: false });
  eq(car33.annualCarTax, 520000, "2,000cc 신차 자동차세 52만 원");
  eq(car33.finalAcqTax, 2100000, "3,300만 신차 취득세 = 공급가 3,000만 × 7% = 210만");

  // 18. 기타소득세(8.8%)
  eq(Calc.calcOtherIncomeTax({ gross: 1000000, expenseRatePct: 60 }).totalTax, 88000, "100만 원 강연료 8.8%");
  eq(Calc.calcOtherIncomeTax({ gross: 125000, expenseRatePct: 60 }).totalTax, 0, "과세최저한 5만 원 이하 비과세");

  // 19. 보유세(재산세 · 종부세) (시행령 제4조의3 공제할 재산세액 법정 산식 검증)
  const hold10 = Calc.calcHoldingTax({ officialPrice: 1000000000, isOneHome: true });
  eq(hold10.totalJongbuTax, 0, "1주택 공시가 12억 이하 종부세 0원");
  eq(hold10.propRatio, 0.45, "2026 1주택 6억 초과 재산세 공정시장가액비율 45%");
  const hold20 = Calc.calcHoldingTax({ officialPrice: 2000000000, isOneHome: true, ownerAge: 70, holdYears: 15 });
  eq(hold20.overlapPropDed, 864000, "시행령 제4조의3: 20억 1주택 공제할 재산세액 = 4.8억 × 45% × 0.4% = 864,000원");
  eq(hold20.creditRate, 0.8, "고령자+장기보유 최대 80% 공제");
  assert(hold20.totalJongbuTax > 0, "공시가 20억 종부세 발생");

  // 20. 근로장려금 · 자녀장려금 (맞벌이 600만 미만 홑벌이 재분류 검증)
  eq(Calc.calcEitc({ household: "single", income: 6000000, assets: 100000000 }).eitc, 1650000, "단독 최대 165만 원");
  eq(Calc.calcEitc({ household: "dualEarner", income: 12000000, children: 2, assets: 100000000 }).totalBenefit, 5300000, "맞벌이 330만 + 자녀 2명 200만");
  eq(Calc.calcEitc({ household: "dualEarner", income: 5000000, children: 0, assets: 100000000 }).reclassifiedToSingleEarner, true, "맞벌이 600만 미만 홑벌이 분류");
  eq(Calc.calcEitc({ household: "dualEarner", income: 40000000, children: 0, assets: 100000000 }).eitc > 0, true, "2026 맞벌이 4,400만 미만 수급");
  eq(Calc.calcEitc({ household: "single", income: 6000000, assets: 250000000 }).totalBenefit, 0, "재산 2.4억 이상 제외");

  console.log("All 20 calculator unit tests passed! (statute-verified 2026 expectations)");
}

runTests();
