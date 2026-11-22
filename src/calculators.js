(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SemNoteCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

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
      totalTaxRate: 0.22
    },
    realEstate: {
      localEducationRateFactor: 0.1,
      ruralSpecialTaxOver85: 0.002,
      multiHomeRates: {
        2: 0.08,
        3: 0.12
      }
    },
    jeonse: {
      defaultConversionRate: 5.0
    }
  };

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

  /**
   * 근로소득공제 계산 (소득세법 기준)
   */
  function earnedIncomeDeduction(annualTaxable) {
    if (annualTaxable <= 5000000) {
      return annualTaxable * 0.7;
    }
    if (annualTaxable <= 15000000) {
      return 3500000 + (annualTaxable - 5000000) * 0.4;
    }
    if (annualTaxable <= 45000000) {
      return 7500000 + (annualTaxable - 15000000) * 0.15;
    }
    if (annualTaxable <= 100000000) {
      return 12000000 + (annualTaxable - 45000000) * 0.05;
    }
    return Math.min(20000000, 14750000 + (annualTaxable - 100000000) * 0.02);
  }

  /**
   * 종합소득세 기본세율 산출세액
   */
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
   * 근로소득세액공제
   */
  function earnedIncomeTaxCredit(calculatedTax, annualTaxable) {
    let credit =
      calculatedTax <= 1300000
        ? calculatedTax * 0.55
        : 715000 + (calculatedTax - 1300000) * 0.3;

    let cap = 740000;
    if (annualTaxable <= 33000000) {
      cap = 740000;
    } else if (annualTaxable <= 70000000) {
      cap = Math.max(660000, 740000 - (annualTaxable - 33000000) * 0.008);
    } else if (annualTaxable <= 120000000) {
      cap = Math.max(500000, 660000 - (annualTaxable - 70000000) * 0.5);
    } else {
      cap = Math.max(200000, 500000 - (annualTaxable - 120000000) * 0.5);
    }
    return Math.min(credit, cap);
  }

  /**
   * 1. 연봉 실수령액 계산기
   */
  function calcSalary(annualWon, nonTaxableMonthly, dependents, ratesInput) {
    const r = (ratesInput && ratesInput.salary) || DEFAULT_RATES.salary;
    const annual = Math.max(0, Number(annualWon) || 0);
    const nonTaxable = Math.max(
      0,
      nonTaxableMonthly === undefined ? r.defaultNonTaxableMonthly : Number(nonTaxableMonthly) || 0
    );
    const deps = Math.max(1, Math.min(11, Math.floor(Number(dependents) || 1)));

    const monthlyGross = Math.round(annual / 12);
    const taxableMonthly = Math.max(0, monthlyGross - nonTaxable);

    const pensionBase =
      taxableMonthly > 0
        ? clamp(taxableMonthly, r.nationalPensionMinBase, r.nationalPensionMaxBase)
        : 0;
    const nationalPension = floor10(pensionBase * r.nationalPensionRate);
    const healthInsurance = floor10(taxableMonthly * r.healthInsuranceRate);
    const longTermCare = floor10(healthInsurance * r.longTermCareRateOfHealth);
    const employmentInsurance = floor10(taxableMonthly * r.employmentInsuranceRate);

    // 간이세액표 근사 산출
    const annualTaxable = taxableMonthly * 12;
    const incomeDed = earnedIncomeDeduction(annualTaxable);
    const personalDed = deps * 1500000;
    const pensionDed = nationalPension * 12;
    // 국세청 간이세액표 특별소득공제 근사치
    let specialDed = 3100000 + annualTaxable * 0.04;
    if (deps >= 2) {
      specialDed = 3600000 + annualTaxable * 0.04;
    }
    const taxBase = Math.max(0, annualTaxable - incomeDed - personalDed - pensionDed - specialDed);
    const annualCalcTax = progressiveIncomeTax(taxBase);
    const annualCredit = earnedIncomeTaxCredit(annualCalcTax, annualTaxable);
    const annualNetTax = Math.max(0, annualCalcTax - annualCredit);

    const incomeTax = floor10(annualNetTax / 12);
    const localIncomeTax = floor10(incomeTax * r.localIncomeTaxRate);

    const totalDeduction =
      nationalPension +
      healthInsurance +
      longTermCare +
      employmentInsurance +
      incomeTax +
      localIncomeTax;

    const monthlyNet = Math.max(0, monthlyGross - totalDeduction);
    const annualNet = monthlyNet * 12;
    const effectiveDeductionRate = monthlyGross > 0 ? totalDeduction / monthlyGross : 0;

    return {
      annualGross: annual,
      monthlyGross,
      nonTaxableMonthly: nonTaxable,
      taxableMonthly,
      dependents: deps,
      nationalPension,
      healthInsurance,
      longTermCare,
      employmentInsurance,
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
   * mode: "grossToNet" | "netToGross"
   */
  function calcFreelancer(amountWon, mode, ratesInput) {
    const r = (ratesInput && ratesInput.freelancer) || DEFAULT_RATES.freelancer;
    const amount = Math.max(0, Number(amountWon) || 0);
    const calcMode = mode === "netToGross" ? "netToGross" : "grossToNet";

    let gross = amount;
    if (calcMode === "netToGross") {
      gross = Math.round(amount / (1 - r.totalRate));
    }

    const incomeTax = floor10(gross * r.incomeTaxRate);
    const localTax = floor10(gross * r.localTaxRate);
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
   */
  function calcOverseasStockTax(profitWon, lossesWon, ratesInput) {
    const r = (ratesInput && ratesInput.overseasStock) || DEFAULT_RATES.overseasStock;
    const profit = Math.max(0, Number(profitWon) || 0);
    const losses = Math.max(0, Number(lossesWon) || 0);

    const netProfit = Math.max(0, profit - losses);
    const deductionApplied = Math.min(netProfit, r.basicDeduction);
    const taxableBase = Math.max(0, netProfit - r.basicDeduction);
    const capitalGainsTax = Math.floor(taxableBase * r.capitalGainsTaxRate);
    const localTax = Math.floor(taxableBase * r.localTaxRate);
    const totalTax = capitalGainsTax + localTax;
    const afterTaxProfit = Math.max(0, netProfit - totalTax);
    const effectiveRate = netProfit > 0 ? totalTax / netProfit : 0;

    return {
      profit,
      losses,
      netProfit,
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

  /**
   * 4. 부동산 주택 취등록세 계산기
   */
  function calcAcquisitionTax(priceWon, housesCount, over85sqm, ratesInput) {
    const r = (ratesInput && ratesInput.realEstate) || DEFAULT_RATES.realEstate;
    const price = Math.max(0, Number(priceWon) || 0);
    const houses = Math.max(1, Math.min(3, Math.floor(Number(housesCount) || 1)));
    const isOver85 = Boolean(over85sqm);

    let acquisitionRate = 0.01;
    let educationRate = 0.001;

    if (houses === 1) {
      if (price <= 600000000) {
        acquisitionRate = 0.01;
      } else if (price <= 900000000) {
        // (취득가액(억원) * 2/3 - 3) / 100
        const eok = price / 100000000;
        acquisitionRate = Math.round(((eok * 2) / 3 - 3) * 100) / 10000;
      } else {
        acquisitionRate = 0.03;
      }
      educationRate = acquisitionRate * r.localEducationRateFactor;
    } else if (houses === 2) {
      acquisitionRate = r.multiHomeRates[2] || 0.08;
      educationRate = 0.004;
    } else {
      acquisitionRate = r.multiHomeRates[3] || 0.12;
      educationRate = 0.004;
    }

    const ruralRate = isOver85 ? r.ruralSpecialTaxOver85 : 0;

    const acquisitionTax = Math.round(price * acquisitionRate);
    const localEducationTax = Math.round(price * educationRate);
    const ruralSpecialTax = Math.round(price * ruralRate);
    const totalTax = acquisitionTax + localEducationTax + ruralSpecialTax;
    const totalRate = price > 0 ? totalTax / price : 0;

    return {
      price,
      houses,
      isOver85,
      acquisitionRate,
      educationRate,
      ruralRate,
      acquisitionTax,
      localEducationTax,
      ruralSpecialTax,
      totalTax,
      totalRate
    };
  }

  /**
   * 5. 전월세 전환율 계산기
   */
  function calcJeonseToWolse(jeonseWon, depositWon, conversionRate, ratesInput) {
    const r = (ratesInput && ratesInput.jeonse) || DEFAULT_RATES.jeonse;
    const jeonse = Math.max(0, Number(jeonseWon) || 0);
    const deposit = Math.max(0, Number(depositWon) || 0);
    const rate =
      conversionRate === undefined || conversionRate === ""
        ? r.defaultConversionRate
        : Math.max(0, Number(conversionRate) || 0);

    const diffDeposit = Math.max(0, jeonse - deposit);
    const yearlyRent = Math.round(diffDeposit * (rate / 100));
    const monthlyRent = Math.round(yearlyRent / 12);

    return {
      jeonse,
      deposit,
      diffDeposit,
      conversionRate: rate,
      monthlyRent,
      yearlyRent
    };
  }

  /**
   * 6. 퇴직금 계산기 (근속연수공제 + 퇴직소득세 근사)
   */
  function calcSeverance(monthlySalaryWon, yearsWorked) {
    const monthly = Math.max(0, Number(monthlySalaryWon) || 0);
    const years = Math.max(0, Number(yearsWorked) || 0);
    const gross = Math.round(monthly * years);
    if (gross === 0 || years < 1) {
      return {
        monthlySalary: monthly,
        yearsWorked: years,
        eligible: years >= 1,
        gross: years >= 1 ? gross : 0,
        serviceDeduction: 0,
        retirementIncomeTax: 0,
        localTax: 0,
        totalTax: 0,
        net: years >= 1 ? gross : 0
      };
    }

    const wholeYears = Math.ceil(years);
    let serviceDeduction = 0;
    if (wholeYears <= 5) {
      serviceDeduction = 1000000 * wholeYears;
    } else if (wholeYears <= 10) {
      serviceDeduction = 5000000 + 2000000 * (wholeYears - 5);
    } else if (wholeYears <= 20) {
      serviceDeduction = 15000000 + 2500000 * (wholeYears - 10);
    } else {
      serviceDeduction = 40000000 + 3000000 * (wholeYears - 20);
    }

    const afterService = Math.max(0, gross - serviceDeduction);
    const convertedIncome = (afterService * 12) / wholeYears;

    let convertedDed = 0;
    if (convertedIncome <= 8000000) {
      convertedDed = convertedIncome;
    } else if (convertedIncome <= 70000000) {
      convertedDed = 8000000 + (convertedIncome - 8000000) * 0.6;
    } else if (convertedIncome <= 100000000) {
      convertedDed = 45200000 + (convertedIncome - 70000000) * 0.55;
    } else if (convertedIncome <= 300000000) {
      convertedDed = 61700000 + (convertedIncome - 100000000) * 0.45;
    } else {
      convertedDed = 151700000 + (convertedIncome - 300000000) * 0.35;
    }

    const convertedTaxBase = Math.max(0, convertedIncome - convertedDed);
    const convertedTax = progressiveIncomeTax(convertedTaxBase);
    const retirementIncomeTax = floor10((convertedTax * wholeYears) / 12);
    const localTax = floor10(retirementIncomeTax * 0.1);
    const totalTax = retirementIncomeTax + localTax;
    const net = Math.max(0, gross - totalTax);

    return {
      monthlySalary: monthly,
      yearsWorked: years,
      eligible: true,
      gross,
      serviceDeduction: Math.min(gross, serviceDeduction),
      retirementIncomeTax,
      localTax,
      totalTax,
      net
    };
  }

  /**
   * 7. 실업급여 계산기
   */
  function calcUnemployment(monthlySalaryWon, age50Plus, insuredYears, ratesInput) {
    const r = (ratesInput && ratesInput.unemployment) || {
      dailyUpperLimit: 68100,
      dailyLowerLimit: 66048,
      benefitRate: 0.6
    };
    const monthly = Math.max(0, Number(monthlySalaryWon) || 0);
    const years = Math.max(0, Number(insuredYears) || 0);
    const is50Plus = Boolean(age50Plus);

    const dailyAvg = monthly / 30;
    const rawDaily = Math.round(dailyAvg * r.benefitRate);
    const dailyBenefit = monthly > 0 ? clamp(rawDaily, r.dailyLowerLimit, r.dailyUpperLimit) : 0;

    let benefitDays = 120;
    if (years < 1) {
      benefitDays = 120;
    } else if (years < 3) {
      benefitDays = is50Plus ? 180 : 150;
    } else if (years < 5) {
      benefitDays = is50Plus ? 210 : 180;
    } else if (years < 10) {
      benefitDays = is50Plus ? 240 : 210;
    } else {
      benefitDays = is50Plus ? 270 : 240;
    }

    const monthlyBenefit = dailyBenefit * 30;
    const totalBenefit = dailyBenefit * benefitDays;

    return {
      monthlySalary: monthly,
      age50Plus: is50Plus,
      insuredYears: years,
      dailyBenefit,
      benefitDays,
      monthlyBenefit,
      totalBenefit
    };
  }

  /**
   * 8. 주휴수당 계산기
   */
  function calcWeeklyHoliday(hourlyWage, weeklyHours, ratesInput) {
    const r = (ratesInput && ratesInput.weeklyHoliday) || {
      minimumWage2026: 10320,
      minWeeklyHours: 15,
      maxStandardWeeklyHours: 40
    };
    const wage = Math.max(0, Number(hourlyWage) || 0);
    const hours = Math.max(0, Math.min(168, Number(weeklyHours) || 0));
    const eligible = hours >= r.minWeeklyHours;

    const baseWeeklyPay = Math.round(wage * hours);
    const holidayHours = eligible ? (Math.min(hours, r.maxStandardWeeklyHours) / 40) * 8 : 0;
    const holidayPay = Math.round(holidayHours * wage);
    const totalWeeklyPay = baseWeeklyPay + holidayPay;
    const estimatedMonthlyPay = Math.round(totalWeeklyPay * 4.345);

    return {
      hourlyWage: wage,
      weeklyHours: hours,
      eligible,
      holidayHours,
      baseWeeklyPay,
      holidayPay,
      totalWeeklyPay,
      estimatedMonthlyPay
    };
  }

  /**
   * 9. 증여세 계산기
   */
  function calcGiftTax(giftWon, relation, ratesInput) {
    const r = (ratesInput && ratesInput.giftTax) || {
      deductions: {
        spouse: 600000000,
        adultChild: 50000000,
        minorChild: 20000000,
        parent: 50000000,
        relative: 10000000,
        other: 0
      },
      voluntaryFilingCreditRate: 0.03
    };
    const gift = Math.max(0, Number(giftWon) || 0);
    const rel = r.deductions[relation] !== undefined ? relation : "adultChild";
    const deductionLimit = r.deductions[rel];
    const deductionApplied = Math.min(gift, deductionLimit);
    const taxBase = Math.max(0, gift - deductionLimit);

    let bracketRate = 0.1;
    let calculatedTax = 0;
    if (taxBase <= 0) {
      bracketRate = 0;
      calculatedTax = 0;
    } else if (taxBase <= 100000000) {
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

    calculatedTax = Math.round(calculatedTax);
    const voluntaryCredit = Math.floor(calculatedTax * r.voluntaryFilingCreditRate);
    const finalTax = Math.max(0, calculatedTax - voluntaryCredit);
    const effectiveRate = gift > 0 ? finalTax / gift : 0;

    return {
      gift,
      relation: rel,
      deductionLimit,
      deductionApplied,
      taxBase,
      bracketRate,
      calculatedTax,
      voluntaryCredit,
      finalTax,
      effectiveRate
    };
  }

  return {
    DEFAULT_RATES,
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
