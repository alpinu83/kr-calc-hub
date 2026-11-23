(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./wage-tax-table-2026"));
  } else {
    root.SemNoteCalc = factory(root.KrWageTaxTable);
  }
})(typeof self !== "undefined" ? self : this, function (WAGE_TAX_TABLE) {
  "use strict";

  /*
   * 2026년 기준 요율 (2026-11-23 법령·고시 재검증)
   * - 국민연금 4.75%, 기준소득월액 41만~659만 원(2026.7.1~2027.6.30 / 2026.6.30까지는 40만~637만 원)
   * - 건강보험 7.19%(근로자 3.595%), 장기요양 0.9448%(건강보험료의 13.14%)
   * - 고용보험(실업급여) 근로자 0.9%
   * - 근로소득세: 소득세법 시행령 별표2 근로소득 간이세액표(2026.2.27 개정) 원표 조회
   */
  const DEFAULT_RATES = {
    salary: {
      nationalPensionRate: 0.0475,
      nationalPensionMinBase: 410000,
      nationalPensionMaxBase: 6590000,
      healthInsuranceRate: 0.03595,
      longTermCareRateOfHealth: 0.1314,
      employmentInsuranceRate: 0.009,
      localIncomeTaxRate: 0.1,
      defaultNonTaxableMonthly: 200000
    },
    freelancer: {
      incomeTaxRate: 0.03,
      localTaxRate: 0.003,
      totalRate: 0.033
    },
    overseasStock: {
      basicDeduction: 2500000,
      capitalGainsTaxRate: 0.2,
      localTaxRate: 0.02,
      totalTaxRate: 0.22,
      riaDeductionRates: { may: 1, jul: 0.8, dec: 0.5 }
    },
    realEstate: {
      localEducationRateFactor: 0.1,
      ruralSpecialTaxOver85: 0.002,
      multiHomeRates: { 8: 0.08, 12: 0.12 },
      heavyLocalEducationRate: 0.004,
      heavyRuralSpecialTaxOver85: { 8: 0.006, 12: 0.01 },
      reliefPriceLimit: 1200000000,
      reliefLimits: { first: 2000000, firstSmall: 3000000, birth: 5000000 },
      reliefRuralSpecialTaxRate: 0.2
    },
    jeonse: {
      baseRate: 3.0,
      spreadOverBaseRate: 2.0,
      statutoryMaxRate: 10.0
    },
    unemployment: {
      dailyUpperLimit: 68100,
      dailyWageCap: 113500,
      minimumWage: 10320,
      lowerLimitRate: 0.8,
      benefitRate: 0.6,
      minInsuredYears: 0.5
    },
    weeklyHoliday: {
      minimumWage2026: 10320,
      minWeeklyHours: 15,
      maxStandardWeeklyHours: 40,
      maxLegalWeeklyHours: 52,
      overtimePremium: 1.5
    },
    severance: {
      defaultThreeMonthDays: 91,
      irpExemptMaxAmount: 3000000
    },
    giftTax: {
      deductions: {
        spouse: 600000000,
        adultChild: 50000000,
        minorChild: 20000000,
        adultGrandchild: 50000000,
        minorGrandchild: 20000000,
        parent: 50000000,
        relative: 10000000,
        other: 0
      },
      marriageBirthDeductionMax: 100000000,
      generationSkipSurcharge: 0.3,
      generationSkipSurchargeMinorOver2B: 0.4,
      minTaxBase: 500000,
      voluntaryFilingCreditRate: 0.03
    }
  };

  function pick(ratesInput, key) {
    const base = DEFAULT_RATES[key];
    const given = ratesInput && ratesInput[key];
    return given ? Object.assign({}, base, given) : base;
  }

  function floor10(value) {
    return Math.floor(Math.max(0, value) / 10) * 10;
  }

  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  function formatWon(value) {
    return Math.round(value).toLocaleString("ko-KR") + "원";
  }

  function formatManwon(value) {
    const man = Math.round(value / 10000);
    return man.toLocaleString("ko-KR") + "만 원";
  }

  function formatPercent(ratio, digits) {
    const d = typeof digits === "number" ? digits : 2;
    return (ratio * 100).toFixed(d) + "%";
  }

  /** 기본세율 산출세액 — 소득세법 제55조 (퇴직소득 환산산출세액에 사용) */
  function progressiveIncomeTax(taxBase) {
    if (taxBase <= 0) return 0;
    if (taxBase <= 14000000) return taxBase * 0.06;
    if (taxBase <= 50000000) return taxBase * 0.15 - 1260000;
    if (taxBase <= 88000000) return taxBase * 0.24 - 5760000;
    if (taxBase <= 150000000) return taxBase * 0.35 - 15440000;
    if (taxBase <= 300000000) return taxBase * 0.38 - 19940000;
    if (taxBase <= 500000000) return taxBase * 0.4 - 25940000;
    if (taxBase <= 1000000000) return taxBase * 0.42 - 35940000;
    return taxBase * 0.45 - 65940000;
  }

  /**
   * 근로소득 간이세액표 조회 (소득세법 시행령 별표2, 2026.2.27 개정)
   * @param {number} taxableMonthly 비과세·학자금 제외 월급여액(원)
   * @param {number} family 공제대상가족 수(본인·배우자 포함)
   */
  function lookupWageTax(taxableMonthly, family) {
    const T = WAGE_TAX_TABLE;
    if (!T) throw new Error("근로소득 간이세액표 데이터(wage-tax-table-2026.js)를 먼저 불러와야 합니다.");
    const m = Math.max(0, Math.floor(Number(taxableMonthly) || 0));
    const fam = Math.max(1, Math.floor(Number(family) || 1));

    function taxForColumn(col) {
      if (m < T.rows[0][0] * 1000) return 0;
      if (m < 10000000) {
        let lo = 0;
        let hi = T.rows.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const row = T.rows[mid];
          if (m < row[0] * 1000) hi = mid - 1;
          else if (m >= row[1] * 1000) lo = mid + 1;
          else return row[2 + col];
        }
        return 0;
      }
      const base = T.at10000[col];
      if (m === 10000000) return base;
      for (const seg of T.over10000) {
        if (m <= seg.upTo) {
          return floor10(base + seg.fixed + (m - seg.base) * seg.factor * seg.rate);
        }
      }
      return base;
    }

    if (fam <= 11) return taxForColumn(fam - 1);
    // 별표2 제4호: 11명 초과 = 11명 세액 - (10명 세액 - 11명 세액) × 11명 초과 인원
    const t11 = taxForColumn(10);
    const t10 = taxForColumn(9);
    return Math.max(0, t11 - (t10 - t11) * (fam - 11));
  }

  /** 8세 이상 20세 이하 자녀 공제액 (별표2 제3호, 2026.3.1 이후 원천징수분) */
  function childWithholdingDeduction(children) {
    const n = Math.max(0, Math.floor(Number(children) || 0));
    const c = (WAGE_TAX_TABLE && WAGE_TAX_TABLE.childDeduction) || { one: 20830, two: 45830, extraPerChild: 33330 };
    if (n === 0) return 0;
    if (n === 1) return c.one;
    return c.two + (n - 2) * c.extraPerChild;
  }

  /**
   * 1. 연봉 실수령액 계산기
   * options: { children: 8~20세 자녀 수, withholdingRatio: 0.8 | 1 | 1.2 }
   */
  function calcSalary(annualWon, nonTaxableMonthly, dependents, ratesInput, options) {
    const r = pick(ratesInput, "salary");
    const opts = options || {};
    const annual = Math.max(0, Number(annualWon) || 0);
    const nonTaxable = Math.max(
      0,
      nonTaxableMonthly === undefined ? r.defaultNonTaxableMonthly : Number(nonTaxableMonthly) || 0
    );
    const deps = Math.max(1, Math.min(20, Math.floor(Number(dependents) || 1)));
    const children = Math.max(0, Math.min(deps - 1, Math.floor(Number(opts.children) || 0)));
    const ratio = [0.8, 1, 1.2].includes(Number(opts.withholdingRatio)) ? Number(opts.withholdingRatio) : 1;

    const monthlyGross = Math.round(annual / 12);
    const taxableMonthly = Math.max(0, monthlyGross - nonTaxable);

    // 국민연금: 기준소득월액(천원 미만 절사)에 상·하한 적용
    const pensionBase =
      taxableMonthly > 0
        ? clamp(Math.floor(taxableMonthly / 1000) * 1000, r.nationalPensionMinBase, r.nationalPensionMaxBase)
        : 0;
    const nationalPension = floor10(pensionBase * r.nationalPensionRate);
    const healthInsurance = floor10(taxableMonthly * r.healthInsuranceRate);
    const longTermCare = floor10(healthInsurance * r.longTermCareRateOfHealth);
    const employmentInsurance = floor10(taxableMonthly * r.employmentInsuranceRate);

    // 근로소득세: 간이세액표 원표 조회 → 8~20세 자녀 공제 → 원천징수 비율(80/100/120%)
    const tableTax = lookupWageTax(taxableMonthly, deps);
    const childDeduction = childWithholdingDeduction(children);
    const afterChild = Math.max(0, tableTax - childDeduction);
    const incomeTax = floor10(afterChild * ratio);
    const localIncomeTax = floor10(incomeTax * r.localIncomeTaxRate);

    const totalDeduction =
      nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;

    const monthlyNet = Math.max(0, monthlyGross - totalDeduction);
    const annualNet = monthlyNet * 12;
    const effectiveDeductionRate = monthlyGross > 0 ? totalDeduction / monthlyGross : 0;

    return {
      annualGross: annual,
      monthlyGross,
      nonTaxableMonthly: nonTaxable,
      taxableMonthly,
      dependents: deps,
      children,
      withholdingRatio: ratio,
      pensionBase,
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
      tableTax,
      childDeduction,
      incomeTax,
      localIncomeTax,
      totalDeduction,
      monthlyNet,
      annualNet,
      effectiveDeductionRate
    };
  }

  /**
   * 2. 프리랜서 3.3% 원천징수 계산기
   * 거주자 인적용역 사업소득: 소득세 3% + 지방소득세(소득세의 10%), 각각 10원 미만 절사
   * mode: "grossToNet" | "netToGross"
   */
  function calcFreelancer(amountWon, mode, ratesInput) {
    const r = pick(ratesInput, "freelancer");
    const amount = Math.max(0, Number(amountWon) || 0);
    const calcMode = mode === "netToGross" ? "netToGross" : "grossToNet";

    let gross = amount;
    if (calcMode === "netToGross") {
      gross = Math.round(amount / (1 - r.totalRate));
    }

    const incomeTax = floor10(gross * r.incomeTaxRate);
    const localTax = floor10(incomeTax * 0.1);
    const totalTax = incomeTax + localTax;
    const net = Math.max(0, gross - totalTax);

    return {
      mode: calcMode,
      gross,
      incomeTax,
      localTax,
      totalTax,
      net,
      effectiveRate: gross > 0 ? totalTax / gross : 0
    };
  }

  /**
   * 3. 해외주식 양도소득세 계산기
   * options (국내시장복귀계좌 RIA, 조세특례제한법 제91조의26):
   *  - riaGain: RIA 계좌로 양도한(2025.12.23 이전 보유분) 해외주식 양도소득금액(원)
   *  - riaPeriod: "may"(2026.5.31까지 결제 100%) | "jul"(6.1~7.31, 80%) | "dec"(8.1~12.31, 50%) | ""(미적용)
   *  - riaProceeds: RIA 납입액, riaNetBuy: RIA 외 계좌 해외주식 등 순매수액 → 공제율 비례 축소(간이)
   */
  function calcOverseasStockTax(profitWon, lossesWon, ratesInput, options) {
    const r = pick(ratesInput, "overseasStock");
    const opts = options || {};
    const profit = Math.max(0, Number(profitWon) || 0);
    const losses = Math.max(0, Number(lossesWon) || 0);
    const netProfit = Math.max(0, profit - losses);

    const periodRate = (r.riaDeductionRates && r.riaDeductionRates[opts.riaPeriod]) || 0;
    const riaGain = Math.min(netProfit, Math.max(0, Number(opts.riaGain) || 0));
    const proceeds = Math.max(0, Number(opts.riaProceeds) || 0);
    const netBuy = Math.max(0, Number(opts.riaNetBuy) || 0);
    const reduceRatio = proceeds > 0 ? clamp(1 - netBuy / proceeds, 0, 1) : 1;
    const riaRate = periodRate * reduceRatio;
    const riaDeduction = Math.floor(riaGain * riaRate);

    const afterRia = Math.max(0, netProfit - riaDeduction);
    const deductionApplied = Math.min(afterRia, r.basicDeduction);
    const taxableBase = Math.max(0, afterRia - r.basicDeduction);
    const capitalGainsTax = Math.floor(taxableBase * r.capitalGainsTaxRate);
    const localTax = Math.floor(capitalGainsTax * 0.1);
    const totalTax = capitalGainsTax + localTax;
    const afterTaxProfit = Math.max(0, netProfit - totalTax);
    const effectiveRate = netProfit > 0 ? totalTax / netProfit : 0;

    return {
      profit,
      losses,
      netProfit,
      riaGain,
      riaRate,
      riaDeduction,
      basicDeduction: r.basicDeduction,
      deductionApplied,
      taxableBase,
      capitalGainsTax,
      localTax,
      totalTax,
      afterTaxProfit,
      effectiveRate
    };
  }

  /** 주택 유상취득 표준세율(지방세법 제11조 제1항 제8호): 6억 이하 1%, 6억~9억 산식(소수점 넷째자리), 9억 초과 3% */
  function standardHousingRate(price) {
    if (price <= 600000000) return 0.01;
    if (price <= 900000000) {
      const eok = price / 100000000;
      return Math.round((((eok * 2) / 3 - 3) / 100) * 10000) / 10000;
    }
    return 0.03;
  }

  /**
   * 4. 주택 취득세 계산기 (유상 매매)
   * housesCount: 취득 후 1세대 주택 수 1 | 2 | 3 | 4(4주택 이상)
   * options: { adjusted: 취득 주택이 조정대상지역, temporary2: 일시적 2주택,
   *            relief: "none" | "first"(생애최초 200만) | "firstSmall"(생애최초 소형·인구감소지역 300만) | "birth"(출산·양육 500만) }
   */
  function calcAcquisitionTax(priceWon, housesCount, over85sqm, ratesInput, options) {
    const r = pick(ratesInput, "realEstate");
    const opts = options || {};
    const price = Math.max(0, Number(priceWon) || 0);
    const houses = Math.max(1, Math.min(4, Math.floor(Number(housesCount) || 1)));
    const isOver85 = Boolean(over85sqm);
    const adjusted = Boolean(opts.adjusted);
    const temporary2 = Boolean(opts.temporary2);

    // 지방세법 제13조의2: 조정 2주택(일시적 2주택 제외)·비조정 3주택 8%, 조정 3주택 이상·비조정 4주택 이상 12%
    let heavy = 0;
    if (houses === 2 && adjusted && !temporary2) heavy = 8;
    else if (houses === 3) heavy = adjusted ? 12 : 8;
    else if (houses >= 4) heavy = 12;

    // 감면(지방세특례제한법 제36조의3·제36조의5): 12억 이하·1주택, 중복 시 큰 것 하나(제180조), 생애최초는 중과 미적용
    const reliefKey = ["first", "firstSmall", "birth"].includes(opts.relief) ? opts.relief : "none";
    const reliefEligible =
      reliefKey !== "none" &&
      price <= r.reliefPriceLimit &&
      (houses === 1 || (reliefKey === "birth" && houses === 2 && temporary2));
    if (reliefEligible) heavy = 0;

    let acquisitionRate;
    let educationRate;
    let ruralRate;
    if (heavy) {
      acquisitionRate = r.multiHomeRates[heavy];
      educationRate = r.heavyLocalEducationRate;
      ruralRate = isOver85 ? r.heavyRuralSpecialTaxOver85[heavy] : 0;
    } else {
      acquisitionRate = standardHousingRate(price);
      educationRate = acquisitionRate * r.localEducationRateFactor;
      ruralRate = isOver85 ? r.ruralSpecialTaxOver85 : 0;
    }

    const acquisitionTaxBeforeRelief = floor10(price * acquisitionRate);
    const reliefLimit = reliefEligible ? r.reliefLimits[reliefKey] : 0;
    const reliefAmount = Math.min(acquisitionTaxBeforeRelief, reliefLimit);
    const acquisitionTax = acquisitionTaxBeforeRelief - reliefAmount;
    const localEducationTax = floor10(price * educationRate);
    // 감면받은 취득세의 20% 농어촌특별세(국민주택규모 이하는 비과세)
    const reliefRuralTax = isOver85 ? floor10(reliefAmount * r.reliefRuralSpecialTaxRate) : 0;
    const ruralSpecialTax = floor10(price * ruralRate) + reliefRuralTax;
    const totalTax = acquisitionTax + localEducationTax + ruralSpecialTax;
    const totalRate = price > 0 ? totalTax / price : 0;

    return {
      price,
      houses,
      isOver85,
      adjusted,
      temporary2,
      regime: heavy ? "heavy" + heavy : "standard",
      acquisitionRate,
      educationRate,
      ruralRate,
      acquisitionTaxBeforeRelief,
      relief: reliefEligible ? reliefKey : "none",
      reliefRequested: reliefKey,
      reliefAmount,
      reliefRuralTax,
      acquisitionTax,
      localEducationTax,
      ruralSpecialTax,
      totalTax,
      totalRate
    };
  }

  /**
   * 5. 전월세 전환율 계산기
   * 주택임대차보호법 시행령 제9조: 전환율 상한 = min(연 10%, 한국은행 기준금리 + 연 2%p)
   * (계약 기간 중 또는 갱신 시 보증금을 월차임으로 전환하는 경우 적용, 신규 계약은 당사자 합의)
   */
  function calcJeonseToWolse(jeonseWon, depositWon, conversionRate, ratesInput) {
    const r = pick(ratesInput, "jeonse");
    const legalCapRate = Math.round(Math.min(r.statutoryMaxRate, r.baseRate + r.spreadOverBaseRate) * 100) / 100;
    const jeonse = Math.max(0, Number(jeonseWon) || 0);
    const deposit = Math.max(0, Number(depositWon) || 0);
    const rate =
      conversionRate === undefined || conversionRate === null || conversionRate === "" || Number.isNaN(Number(conversionRate))
        ? legalCapRate
        : Math.max(0, Number(conversionRate) || 0);

    const diffDeposit = Math.max(0, jeonse - deposit);
    const yearlyRent = Math.round(diffDeposit * (rate / 100));
    const monthlyRent = Math.round(yearlyRent / 12);
    const capMonthlyRent = Math.round(Math.round(diffDeposit * (legalCapRate / 100)) / 12);

    return {
      jeonse,
      deposit,
      diffDeposit,
      conversionRate: rate,
      monthlyRent,
      yearlyRent,
      baseRate: r.baseRate,
      legalCapRate,
      capMonthlyRent,
      exceedsCap: rate > legalCapRate + 1e-9
    };
  }

  /**
   * 6. 퇴직금 계산기
   * 법정 퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365)  (근로자퇴직급여 보장법 제8조, 근로기준법 제2조)
   * 1일 평균임금 = (3개월 임금총액 + 연간 상여금×3/12 + 연차수당×3/12) ÷ 3개월 총일수(89~92일)
   * options: { annualBonus, annualLeavePay, threeMonthDays, irpExempt }
   */
  function calcSeverance(monthlySalaryWon, yearsWorked, options) {
    const opts = options || {};
    const rs = DEFAULT_RATES.severance;
    const monthly = Math.max(0, Number(monthlySalaryWon) || 0);
    const years = Math.max(0, Number(yearsWorked) || 0);
    const bonus = Math.max(0, Number(opts.annualBonus) || 0);
    const leavePay = Math.max(0, Number(opts.annualLeavePay) || 0);
    const days = [89, 90, 91, 92].includes(Number(opts.threeMonthDays))
      ? Number(opts.threeMonthDays)
      : rs.defaultThreeMonthDays;

    const threeMonthWages = monthly * 3 + (bonus * 3) / 12 + (leavePay * 3) / 12;
    const dailyAverageWage = threeMonthWages / days;
    const serviceDays = Math.round(years * 365);
    const eligible = years >= 1;
    const gross = eligible ? Math.floor((dailyAverageWage * 30 * serviceDays) / 365) : 0;

    const base = {
      monthlySalary: monthly,
      yearsWorked: years,
      eligible,
      threeMonthDays: days,
      dailyAverageWage: Math.round(dailyAverageWage),
      gross,
      serviceYearsForTax: eligible ? Math.ceil(years) : 0,
      serviceDeduction: 0,
      retirementIncomeTax: 0,
      localTax: 0,
      totalTax: 0,
      pensionTaxEstimate: 0,
      net: gross,
      irpRequired: false
    };
    if (!eligible || gross === 0) return base;

    // 퇴직소득세: 근속연수는 1년 미만 끝수를 1년으로 계산
    const wholeYears = Math.ceil(years);
    let serviceDeduction;
    if (wholeYears <= 5) serviceDeduction = 1000000 * wholeYears;
    else if (wholeYears <= 10) serviceDeduction = 5000000 + 2000000 * (wholeYears - 5);
    else if (wholeYears <= 20) serviceDeduction = 15000000 + 2500000 * (wholeYears - 10);
    else serviceDeduction = 40000000 + 3000000 * (wholeYears - 20);

    const afterService = Math.max(0, gross - serviceDeduction);
    const convertedIncome = (afterService * 12) / wholeYears;

    let convertedDed;
    if (convertedIncome <= 8000000) convertedDed = convertedIncome;
    else if (convertedIncome <= 70000000) convertedDed = 8000000 + (convertedIncome - 8000000) * 0.6;
    else if (convertedIncome <= 100000000) convertedDed = 45200000 + (convertedIncome - 70000000) * 0.55;
    else if (convertedIncome <= 300000000) convertedDed = 61700000 + (convertedIncome - 100000000) * 0.45;
    else convertedDed = 151700000 + (convertedIncome - 300000000) * 0.35;

    const convertedTaxBase = Math.max(0, convertedIncome - convertedDed);
    const convertedTax = progressiveIncomeTax(convertedTaxBase);
    const retirementIncomeTax = floor10((convertedTax * wholeYears) / 12);
    const localTax = floor10(retirementIncomeTax * 0.1);
    const totalTax = retirementIncomeTax + localTax;

    // 근로자퇴직급여 보장법 제9조②: 55세 이후 퇴직·300만 원 이하 등 예외가 아니면 IRP로 세전 이전(과세이연)
    const irpRequired = !opts.irpExempt && gross > rs.irpExemptMaxAmount;

    return Object.assign(base, {
      serviceDeduction: Math.min(gross, serviceDeduction),
      retirementIncomeTax,
      localTax,
      totalTax,
      pensionTaxEstimate: floor10(totalTax * 0.7),
      net: Math.max(0, gross - totalTax),
      irpRequired
    });
  }

  /**
   * 7. 실업급여(구직급여) 계산기 — 고용보험법 제45조·제46조·제50조, 시행령 제68조
   * 1일 구직급여 = 기초일액(평균임금, 상한 113,500원) × 60%
   * 하한 = 이직일 최저임금 × 1일 소정근로시간 × 80% (8시간 66,048원, 단시간이면 비례 감소)
   * options: { dailyHours: 1일 소정근로시간(1~8) }
   */
  function calcUnemployment(monthlySalaryWon, age50Plus, insuredYears, ratesInput, options) {
    const r = pick(ratesInput, "unemployment");
    const opts = options || {};
    const monthly = Math.max(0, Number(monthlySalaryWon) || 0);
    const years = Math.max(0, Number(insuredYears) || 0);
    const is50Plus = Boolean(age50Plus);
    const hours = clamp(Number(opts.dailyHours) || 8, 1, 8);
    const eligible = years >= r.minInsuredYears && monthly > 0;

    // 평균임금(일) = 3개월 임금총액 ÷ 3개월 총일수 → 월급 × 12 ÷ 365로 근사
    const dailyAvg = (monthly * 12) / 365;
    const rawDaily = Math.floor(Math.min(dailyAvg, r.dailyWageCap) * r.benefitRate);
    const lowerLimit = Math.floor(r.minimumWage * hours * r.lowerLimitRate);
    const dailyBenefit = eligible ? Math.min(r.dailyUpperLimit, Math.max(rawDaily, lowerLimit)) : 0;

    let benefitDays = 0;
    if (eligible) {
      if (years < 1) benefitDays = 120;
      else if (years < 3) benefitDays = is50Plus ? 180 : 150;
      else if (years < 5) benefitDays = is50Plus ? 210 : 180;
      else if (years < 10) benefitDays = is50Plus ? 240 : 210;
      else benefitDays = is50Plus ? 270 : 240;
    }

    return {
      monthlySalary: monthly,
      age50Plus: is50Plus,
      insuredYears: years,
      dailyHours: hours,
      eligible,
      dailyAverageWage: Math.round(dailyAvg),
      lowerLimit,
      upperLimit: r.dailyUpperLimit,
      dailyBenefit,
      benefitDays,
      monthlyBenefit: dailyBenefit * 30,
      totalBenefit: dailyBenefit * benefitDays
    };
  }

  /**
   * 8. 주휴수당 계산기 — 근로기준법 제55조·제18조③(주 15시간), 제56조(연장 50% 가산), 제53조(주 52시간)
   * options: { fivePlus: 상시 5인 이상 사업장(연장근로 가산 적용), 기본 true }
   */
  function calcWeeklyHoliday(hourlyWage, weeklyHours, ratesInput, options) {
    const r = pick(ratesInput, "weeklyHoliday");
    const opts = options || {};
    const fivePlus = opts.fivePlus === undefined ? true : Boolean(opts.fivePlus);
    const wage = Math.max(0, Number(hourlyWage) || 0);
    const hours = Math.max(0, Math.min(80, Number(weeklyHours) || 0));
    const regularHours = Math.min(hours, r.maxStandardWeeklyHours);
    const overtimeHours = Math.max(0, hours - r.maxStandardWeeklyHours);
    const overtimeMultiplier = fivePlus ? r.overtimePremium : 1;
    const eligible = regularHours >= r.minWeeklyHours;

    const regularPay = Math.round(wage * regularHours);
    const overtimePay = Math.round(wage * overtimeHours * overtimeMultiplier);
    const baseWeeklyPay = regularPay + overtimePay;
    const holidayHours = eligible ? (regularHours / 40) * 8 : 0;
    const holidayPay = Math.round(holidayHours * wage);
    const totalWeeklyPay = baseWeeklyPay + holidayPay;

    // 월 환산: (소정근로시간 + 주휴시간) × 365 ÷ 7 ÷ 12, 시간 단위 반올림 (주 40시간 = 209시간)
    const weeksPerMonth = 365 / 7 / 12;
    const monthlyPaidHours = Math.round((regularHours + holidayHours) * weeksPerMonth);
    const monthlyOvertimePay = Math.round(overtimeHours * weeksPerMonth * wage * overtimeMultiplier);
    const estimatedMonthlyPay = monthlyPaidHours * wage + monthlyOvertimePay;

    return {
      hourlyWage: wage,
      weeklyHours: hours,
      regularHours,
      overtimeHours,
      fivePlus,
      eligible,
      overLegalLimit: hours > r.maxLegalWeeklyHours,
      belowMinimumWage: wage > 0 && wage < r.minimumWage2026,
      holidayHours,
      regularPay,
      overtimePay,
      baseWeeklyPay,
      holidayPay,
      totalWeeklyPay,
      monthlyPaidHours,
      estimatedMonthlyPay
    };
  }

  /**
   * 9. 증여세 계산기 — 상속세 및 증여세법 제53조·제53조의2·제55조·제56조·제57조·제58조·제69조
   * relation: spouse | adultChild | minorChild | adultGrandchild | minorGrandchild | parent | relative | other
   * options: { marriageBirth: 혼인·출산 증여재산공제 적용액(최대 1억),
   *            usedDeduction: 10년 내 같은 공제 그룹에서 이미 사용한 증여재산공제,
   *            priorTax: 10년 합산된 이전 증여분의 산출세액(기납부세액공제) }
   */
  function calcGiftTax(giftWon, relation, ratesInput, options) {
    const r = pick(ratesInput, "giftTax");
    const opts = options || {};
    const deductions = Object.assign({}, DEFAULT_RATES.giftTax.deductions, r.deductions || {});
    const gift = Math.max(0, Number(giftWon) || 0);
    const rel = deductions[relation] !== undefined ? relation : "adultChild";
    const isDescendant = ["adultChild", "minorChild", "adultGrandchild", "minorGrandchild"].includes(rel);
    const isGrandchild = rel === "adultGrandchild" || rel === "minorGrandchild";
    const isMinor = rel === "minorChild" || rel === "minorGrandchild";

    const usedDeduction = Math.max(0, Number(opts.usedDeduction) || 0);
    const deductionLimit = Math.max(0, deductions[rel] - usedDeduction);
    const marriageBirthLimit = isDescendant
      ? Math.min(r.marriageBirthDeductionMax, Math.max(0, Number(opts.marriageBirth) || 0))
      : 0;
    const basicApplied = Math.min(gift, deductionLimit);
    const marriageBirthDeduction = Math.min(gift - basicApplied, marriageBirthLimit);
    const deductionApplied = basicApplied + marriageBirthDeduction;
    const rawTaxBase = Math.max(0, gift - deductionApplied);
    // 과세표준 50만 원 미만이면 증여세를 부과하지 않음(제55조②)
    const taxBase = rawTaxBase < r.minTaxBase ? 0 : rawTaxBase;

    let bracketRate = 0;
    let calculatedTax = 0;
    if (taxBase > 0) {
      if (taxBase <= 100000000) {
        bracketRate = 0.1;
        calculatedTax = taxBase * 0.1;
      } else if (taxBase <= 500000000) {
        bracketRate = 0.2;
        calculatedTax = taxBase * 0.2 - 10000000;
      } else if (taxBase <= 1000000000) {
        bracketRate = 0.3;
        calculatedTax = taxBase * 0.3 - 60000000;
      } else if (taxBase <= 3000000000) {
        bracketRate = 0.4;
        calculatedTax = taxBase * 0.4 - 160000000;
      } else {
        bracketRate = 0.5;
        calculatedTax = taxBase * 0.5 - 460000000;
      }
    }
    calculatedTax = Math.round(calculatedTax);

    // 세대생략 할증(제57조): 30%, 미성년자가 20억 초과 증여받으면 40%
    const surchargeRate = isGrandchild
      ? isMinor && gift > 2000000000
        ? r.generationSkipSurchargeMinorOver2B
        : r.generationSkipSurcharge
      : 0;
    const generationSkipSurcharge = Math.round(calculatedTax * surchargeRate);
    const taxWithSurcharge = calculatedTax + generationSkipSurcharge;

    // 기납부세액공제(제58조) 후 신고세액공제 3%(제69조②)
    const priorTaxCredit = Math.min(taxWithSurcharge, Math.max(0, Number(opts.priorTax) || 0));
    const creditBase = taxWithSurcharge - priorTaxCredit;
    const voluntaryCredit = Math.floor(creditBase * r.voluntaryFilingCreditRate);
    const finalTax = Math.max(0, creditBase - voluntaryCredit);
    const effectiveRate = gift > 0 ? finalTax / gift : 0;

    return {
      gift,
      relation: rel,
      deductionLimit,
      marriageBirthDeduction,
      deductionApplied,
      taxBase,
      bracketRate,
      calculatedTax,
      surchargeRate,
      generationSkipSurcharge,
      priorTaxCredit,
      voluntaryCredit,
      finalTax,
      effectiveRate
    };
  }

  return {
    DEFAULT_RATES,
    lookupWageTax,
    childWithholdingDeduction,
    calcSalary,
    calcFreelancer,
    calcOverseasStockTax,
    calcAcquisitionTax,
    calcJeonseToWolse,
    calcSeverance,
    calcUnemployment,
    calcWeeklyHoliday,
    calcGiftTax,
    formatWon,
    formatManwon,
    formatPercent
  };
});
