(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    const base = require("./calculators");
    const ext = factory(base);
    Object.assign(base, ext);
    module.exports = ext;
  } else {
    const base = root.SemNoteCalc || {};
    const ext = factory(base);
    Object.assign(base, ext);
    root.SemNoteCalc = base;
  }
})(typeof self !== "undefined" ? self : this, function (Base) {
  "use strict";

  function clampNonNeg(n) {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }

  function floor10(n) {
    return Math.floor(Math.max(0, n) / 10) * 10;
  }

  function round10(n) {
    return Math.round(Math.max(0, n) / 10) * 10;
  }

  /* 공통: 2026년 종합소득세 8단계 누진세율표 (소득세법 제55조) */
  const INCOME_TAX_BRACKETS = [
    { limit: 14000000, rate: 0.06, quick: 0 },
    { limit: 50000000, rate: 0.15, quick: 1260000 },
    { limit: 88000000, rate: 0.24, quick: 5760000 },
    { limit: 150000000, rate: 0.35, quick: 15440000 },
    { limit: 300000000, rate: 0.38, quick: 19940000 },
    { limit: 500000000, rate: 0.4, quick: 25940000 },
    { limit: 1000000000, rate: 0.42, quick: 35940000 },
    { limit: Infinity, rate: 0.45, quick: 65940000 }
  ];

  function calcProgressiveIncomeTax(taxBase) {
    const base = clampNonNeg(taxBase);
    if (base <= 0) return { tax: 0, rate: 0.06 };
    for (const b of INCOME_TAX_BRACKETS) {
      if (base <= b.limit) {
        return { tax: Math.max(0, Math.floor(base * b.rate - b.quick)), rate: b.rate };
      }
    }
    return { tax: 0, rate: 0.06 };
  }

  /* 근로소득공제 (소득세법 제47조, 한도 2,000만 원) */
  function calcEarnedIncomeDeduction(gross) {
    const g = clampNonNeg(gross);
    let d = 0;
    if (g <= 5000000) d = g * 0.7;
    else if (g <= 15000000) d = 3500000 + (g - 5000000) * 0.4;
    else if (g <= 45000000) d = 7500000 + (g - 15000000) * 0.15;
    else if (g <= 100000000) d = 12000000 + (g - 45000000) * 0.05;
    else d = 14750000 + (g - 100000000) * 0.02;
    return Math.min(20000000, Math.floor(d));
  }

  /* 근로소득세액공제 (소득세법 제59조) */
  function calcEarnedIncomeTaxCredit(calcTax, gross) {
    const t = clampNonNeg(calcTax);
    const raw = t <= 1300000 ? t * 0.55 : 715000 + (t - 1300000) * 0.3;
    let limit = 740000;
    if (gross <= 33000000) {
      limit = 740000;
    } else if (gross <= 70000000) {
      limit = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    } else if (gross <= 120000000) {
      limit = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
    } else {
      limit = Math.max(200000, 500000 - (gross - 120000000) * 0.5);
    }
    return Math.floor(Math.min(raw, limit));
  }

  /* 자녀세액공제 (소득세법 제59조의2, 2026년 귀속: 1명 25만, 2명 55만, 3명+ 55만 + 40만/인) */
  function calcChildTaxCredit(childrenCount) {
    const c = Math.max(0, Math.floor(Number(childrenCount) || 0));
    if (c === 0) return 0;
    if (c === 1) return 250000;
    if (c === 2) return 550000;
    return 550000 + (c - 2) * 400000;
  }

  /* 10. 연말정산 환급액 계산기 (소득세법 제47·50·52·59·59의2·59의4조, 조특법 제95의2·126의2조) */
  function calcYearEndTax(params = {}) {
    const gross = clampNonNeg(params.gross);
    const dependents = Math.max(1, Math.floor(Number(params.dependents) || 1));
    const children = Math.max(0, Math.min(dependents - 1, Math.floor(Number(params.children) || 0)));
    const creditCard = clampNonNeg(params.creditCard);
    const debitCash = clampNonNeg(params.debitCash);
    const pensionIrp = Math.min(9000000, clampNonNeg(params.pensionIrp));
    const monthlyRentAnnual = clampNonNeg(params.monthlyRentAnnual);
    const medical = clampNonNeg(params.medical);
    const education = clampNonNeg(params.education);
    const donation = clampNonNeg(params.donation);

    // 4대보험(근로자) 연간 추정:
    // 국민연금 = 연금보험료공제(표준세액공제와 중복 가능)
    // 건강·장기요양·고용보험 = 특별소득공제(표준세액공제 13만 원과 중복 불가!)
    let nationalPensionAnnual = 0;
    let specialInsuranceAnnual = 0;
    let prepaidTax =
      params.prepaidTax !== undefined && params.prepaidTax !== null && params.prepaidTax !== ""
        ? clampNonNeg(params.prepaidTax)
        : null;

    if (gross > 0 && !params.customInsurance) {
      const sal = Base.calcSalary(gross, 0, dependents, undefined, { children });
      nationalPensionAnnual = sal.nationalPension * 12;
      specialInsuranceAnnual = (sal.healthInsurance + sal.longTermCare + sal.employmentInsurance) * 12;
      if (prepaidTax === null) {
        prepaidTax = (sal.incomeTax + sal.localIncomeTax) * 12;
      }
    } else if (params.customInsurance) {
      nationalPensionAnnual = clampNonNeg(params.nationalPensionAnnual);
      specialInsuranceAnnual = clampNonNeg(params.specialInsuranceAnnual || params.insuranceAnnual);
    }
    if (prepaidTax === null) prepaidTax = 0;
    const insuranceAnnual = nationalPensionAnnual + specialInsuranceAnnual;

    // 1) 근로소득금액
    const earnedDeduction = calcEarnedIncomeDeduction(gross);
    const earnedIncome = Math.max(0, gross - earnedDeduction);

    // 2) 공통 소득공제: 인적공제 + 국민연금 + 신용/체크카드(2026 자녀 추가한도 반영)
    const personalDeduction = dependents * 1500000;
    const minCardThreshold = gross * 0.25;
    let cardDeduction = 0;
    const totalCard = creditCard + debitCash;
    if (totalCard > minCardThreshold) {
      const creditUsedForThreshold = Math.min(creditCard, minCardThreshold);
      const remThreshold = Math.max(0, minCardThreshold - creditUsedForThreshold);
      const creditEligible = Math.max(0, creditCard - creditUsedForThreshold);
      const debitEligible = Math.max(0, debitCash - remThreshold);
      const rawCard = creditEligible * 0.15 + debitEligible * 0.3;
      const baseCardLimit = gross <= 70000000 ? 3000000 : 2500000;
      const childBonus =
        gross <= 70000000 ? Math.min(1000000, children * 500000) : Math.min(500000, children * 250000);
      cardDeduction = Math.floor(Math.min(rawCard, baseCardLimit + childBonus));
    }

    // 공통 세액공제 (표준세액공제와 중복 가능: 근로소득·자녀·연금계좌)
    const childTaxCredit = calcChildTaxCredit(children);
    const pensionRate = gross <= 55000000 ? 0.15 : 0.12;
    const pensionCredit = Math.floor(pensionIrp * pensionRate);

    // 특별세액공제 및 월세 세액공제 (표준세액공제 13만 원과 택일)
    let rentCredit = 0;
    if (gross > 0 && gross <= 80000000 && monthlyRentAnnual > 0) {
      const rentBase = Math.min(10000000, monthlyRentAnnual);
      rentCredit = Math.floor(rentBase * (gross <= 55000000 ? 0.17 : 0.15));
    }
    const medicalBase = Math.max(0, medical - gross * 0.03);
    const medicalCredit = Math.floor(Math.min(medicalBase, 7000000) * 0.15);
    const educationCredit = Math.floor(education * 0.15);
    const donationCredit =
      donation <= 10000000
        ? Math.floor(donation * 0.15)
        : Math.floor(1500000 + (donation - 10000000) * 0.3);
    const specialTaxCredits = rentCredit + medicalCredit + educationCredit + donationCredit;

    // Track A: 특별소득공제(건강·장기요양·고용보험) + 특별세액공제 + 월세 세액공제
    const totalIncomeDedA = personalDeduction + nationalPensionAnnual + specialInsuranceAnnual + cardDeduction;
    const taxBaseA = Math.max(0, earnedIncome - totalIncomeDedA);
    const calcA = calcProgressiveIncomeTax(taxBaseA);
    const earnedCreditA = calcEarnedIncomeTaxCredit(calcA.tax, gross);
    const totalTaxCreditA = earnedCreditA + childTaxCredit + pensionCredit + specialTaxCredits;
    const detIncomeA = floor10(Math.max(0, calcA.tax - totalTaxCreditA));

    // Track B: 표준세액공제 13만 원 선택 (특별소득공제·특별세액공제·월세 제외, 소득세법 제59조의4 제9항)
    const totalIncomeDedB = personalDeduction + nationalPensionAnnual + cardDeduction;
    const taxBaseB = Math.max(0, earnedIncome - totalIncomeDedB);
    const calcB = calcProgressiveIncomeTax(taxBaseB);
    const earnedCreditB = calcEarnedIncomeTaxCredit(calcB.tax, gross);
    const standardCredit = gross > 0 ? 130000 : 0;
    const totalTaxCreditB = earnedCreditB + childTaxCredit + pensionCredit + standardCredit;
    const detIncomeB = floor10(Math.max(0, calcB.tax - totalTaxCreditB));

    // 납세자에게 유리한(결정세액이 적은) 방식 자동 선택
    const useStandard = detIncomeB < detIncomeA;
    const totalIncomeDeduction = useStandard ? totalIncomeDedB : totalIncomeDedA;
    const taxBase = useStandard ? taxBaseB : taxBaseA;
    const marginalRate = useStandard ? calcB.rate : calcA.rate;
    const calculatedTax = useStandard ? calcB.tax : calcA.tax;
    const earnedTaxCredit = useStandard ? earnedCreditB : earnedCreditA;
    const totalTaxCredit = useStandard ? totalTaxCreditB : totalTaxCreditA;
    const determinedIncomeTax = useStandard ? detIncomeB : detIncomeA;
    const determinedLocalTax = floor10(determinedIncomeTax * 0.1);
    const determinedTotalTax = determinedIncomeTax + determinedLocalTax;
    const refundAmount = Math.round(prepaidTax - determinedTotalTax);

    return {
      gross,
      earnedDeduction,
      earnedIncome,
      personalDeduction,
      nationalPensionAnnual,
      specialInsuranceAnnual,
      insuranceAnnual,
      cardDeduction,
      totalIncomeDeduction,
      taxBase,
      marginalRate,
      calculatedTax,
      earnedTaxCredit,
      childTaxCredit,
      pensionCredit,
      rentCredit: useStandard ? 0 : rentCredit,
      medicalCredit: useStandard ? 0 : medicalCredit,
      educationCredit: useStandard ? 0 : educationCredit,
      donationCredit: useStandard ? 0 : donationCredit,
      usedStandardCredit: useStandard,
      specialOrStandard: useStandard ? standardCredit : specialTaxCredits,
      totalTaxCredit,
      determinedIncomeTax,
      determinedLocalTax,
      determinedTotalTax,
      prepaidTax,
      refundAmount
    };
  }

  /* 11. 맞벌이 부부 연말정산 절세 계산기 (세법상 부양가족 귀속 원칙 반영) */
  function calcCoupleTax(params = {}) {
    const hGross = clampNonNeg(params.husbandGross);
    const wGross = clampNonNeg(params.wifeGross);
    const otherDeps = Math.max(0, Math.min(6, Math.floor(Number(params.otherDeps) || 0)));
    const children = Math.max(0, Math.min(5, Math.floor(Number(params.children) || 0)));
    const sharedMedical = clampNonNeg(params.sharedMedical); // 부부 본인 의료비 (교차 공제 가능)
    const sharedEducation = clampNonNeg(params.sharedEducation); // 자녀·부양가족 교육비 (기본공제자만 공제)
    const sharedCard = clampNonNeg(params.sharedCard); // 부부 생활비 카드 (결제 명의 선택)

    const hasDependents = otherDeps + children > 0;

    function evalSplit(hOther, hChild, medTo, eduTo, cardTo) {
      const wOther = otherDeps - hOther;
      const wChild = children - hChild;
      const hRes = calcYearEndTax({
        gross: hGross,
        dependents: 1 + hOther + hChild,
        children: hChild,
        medical: medTo === "H" ? sharedMedical : 0,
        education: eduTo === "H" ? sharedEducation : 0,
        debitCash: cardTo === "H" ? sharedCard : 0
      });
      const wRes = calcYearEndTax({
        gross: wGross,
        dependents: 1 + wOther + wChild,
        children: wChild,
        medical: medTo === "W" ? sharedMedical : 0,
        education: eduTo === "W" ? sharedEducation : 0,
        debitCash: cardTo === "W" ? sharedCard : 0
      });
      return {
        hOther,
        wOther,
        hChild,
        wChild,
        medTo,
        eduTo,
        cardTo,
        husbandTax: hRes.determinedTotalTax,
        wifeTax: wRes.determinedTotalTax,
        totalTax: hRes.determinedTotalTax + wRes.determinedTotalTax
      };
    }

    let best = null;
    let worst = null;
    const medChoices = sharedMedical > 0 ? ["H", "W"] : ["H"];
    const cardChoices = sharedCard > 0 ? ["H", "W"] : ["H"];

    for (let ho = 0; ho <= otherDeps; ho++) {
      for (let hc = 0; hc <= children; hc++) {
        const hDeps = ho + hc;
        const wDeps = otherDeps - ho + (children - hc);

        // 세법상 부양가족 교육비는 해당 부양가족 기본공제를 받는 배우자만 공제 가능
        let eduChoices;
        if (sharedEducation <= 0) {
          eduChoices = ["H"];
        } else if (!hasDependents) {
          eduChoices = ["H", "W"];
        } else if (hDeps > 0 && wDeps === 0) {
          eduChoices = ["H"];
        } else if (wDeps > 0 && hDeps === 0) {
          eduChoices = ["W"];
        } else {
          eduChoices = ["H", "W"];
        }

        for (const m of medChoices) {
          for (const e of eduChoices) {
            for (const c of cardChoices) {
              const cur = evalSplit(ho, hc, m, e, c);
              if (!best || cur.totalTax < best.totalTax) best = cur;
              if (!worst || cur.totalTax > worst.totalTax) worst = cur;
            }
          }
        }
      }
    }

    const allHusband = evalSplit(otherDeps, children, "H", "H", "H");
    const allWife = evalSplit(0, 0, "W", "W", "W");

    return {
      husbandGross: hGross,
      wifeGross: wGross,
      totalDependents: otherDeps + children,
      best,
      worst,
      allHusband,
      allWife,
      maxSavings: worst && best ? Math.max(0, worst.totalTax - best.totalTax) : 0,
      savingsVsHusband: best ? Math.max(0, allHusband.totalTax - best.totalTax) : 0,
      savingsVsWife: best ? Math.max(0, allWife.totalTax - best.totalTax) : 0
    };
  }

  /* 12. 사업소득금액 · 종합소득세 계산기 (2026년 기준) */
  function calcBusinessIncomeTax(params = {}) {
    const revenue = clampNonNeg(params.revenue);
    const expenseMode = params.expenseMode || "simple"; // simple | actual
    const expenseRate = Math.min(95, Math.max(0, Number(params.expenseRate) || 0)) / 100;
    const excessExpenseRate =
      params.excessExpenseRate !== undefined && params.excessExpenseRate !== null && params.excessExpenseRate !== ""
        ? Math.min(95, Math.max(0, Number(params.excessExpenseRate))) / 100
        : null;
    const actualExpenses = clampNonNeg(params.actualExpenses);
    const dependents = Math.max(1, Math.floor(Number(params.dependents) || 1));
    const yellowUmbrellaInput = clampNonNeg(params.yellowUmbrella);
    const pensionIrp = Math.min(9000000, clampNonNeg(params.pensionIrp));

    let prepaidTax;
    if (params.autoPrepaid33) {
      const preInc = floor10(revenue * 0.03);
      prepaidTax = preInc + floor10(preInc * 0.1);
    } else {
      prepaidTax = clampNonNeg(params.prepaidTax);
    }

    let recognizedExpenses;
    if (expenseMode === "actual") {
      recognizedExpenses = Math.min(revenue, actualExpenses);
    } else if (excessExpenseRate !== null && revenue > 40000000) {
      // 인적용역 등 4,000만 원 초과율 적용 시
      recognizedExpenses = Math.round(40000000 * expenseRate + (revenue - 40000000) * excessExpenseRate);
    } else {
      recognizedExpenses = Math.round(revenue * expenseRate);
    }
    const businessIncome = Math.max(0, revenue - recognizedExpenses);

    // 2026 노란우산공제 소득공제 한도 (4천 이하 600만 / 6천 이하 500만 / 1억 이하 400만 / 초과 200만)
    let yellowLimit = 6000000;
    if (businessIncome <= 40000000) yellowLimit = 6000000;
    else if (businessIncome <= 60000000) yellowLimit = 5000000;
    else if (businessIncome <= 100000000) yellowLimit = 4000000;
    else yellowLimit = 2000000;
    const yellowDeduction = Math.min(yellowUmbrellaInput, yellowLimit);

    const personalDeduction = dependents * 1500000;
    const totalDeduction = personalDeduction + yellowDeduction;
    const taxBase = Math.max(0, businessIncome - totalDeduction);

    const { tax: calculatedTax, rate: marginalRate } = calcProgressiveIncomeTax(taxBase);
    const pensionRate = businessIncome <= 45000000 ? 0.15 : 0.12;
    const pensionCredit = Math.floor(pensionIrp * pensionRate);
    const standardCredit = businessIncome > 0 ? 70000 : 0; // 일반 사업자 표준세액공제 7만 원
    const totalTaxCredit = pensionCredit + standardCredit;

    const determinedIncomeTax = floor10(Math.max(0, calculatedTax - totalTaxCredit));
    const determinedLocalTax = floor10(determinedIncomeTax * 0.1);
    const totalTax = determinedIncomeTax + determinedLocalTax;
    const balanceDue = Math.round(totalTax - prepaidTax); // 양수면 추가납부, 음수면 환급

    return {
      revenue,
      expenseMode,
      recognizedExpenses,
      businessIncome,
      personalDeduction,
      yellowLimit,
      yellowDeduction,
      taxBase,
      marginalRate,
      calculatedTax,
      pensionCredit,
      standardCredit,
      determinedIncomeTax,
      determinedLocalTax,
      totalTax,
      prepaidTax,
      balanceDue
    };
  }

  /* 13. 상속세 계산기 (상속세 및 증여세법 제18·19·20·21·22·24·26·69조, 2026년 기준) */
  function calcInheritanceTax(params = {}) {
    const grossEstate = clampNonNeg(params.grossEstate);
    const debt = clampNonNeg(params.debt);
    const funeral = Math.min(15000000, Math.max(5000000, clampNonNeg(params.funeral || 5000000)));
    const priorGifts = clampNonNeg(params.priorGifts);
    const hasSpouse = Boolean(params.hasSpouse);
    const children = Math.max(0, Math.floor(Number(params.children) || 0));
    const netFinancial = clampNonNeg(params.netFinancial);
    const voluntary = params.voluntary !== false;

    const taxableValue = Math.max(0, grossEstate - debt - (grossEstate > 0 ? funeral : 0) + priorGifts);
    const isSpouseOnly = hasSpouse && children === 0;

    // 상증세법 제21조 제1항 단서: 배우자 단독상속 시 일괄공제(5억) 불가 → 기초공제 2억만 적용
    const itemDeduction = 200000000 + children * 50000000;
    const lumpSumOrItem = taxableValue > 0 ? (isSpouseOnly ? 200000000 : Math.max(500000000, itemDeduction)) : 0;

    // 배우자 상속공제 (상증세법 제19조): 배우자 생존 시 최소 5억 ~ 법정상속분 한도 내 최대 30억
    let spouseDeduction = 0;
    if (hasSpouse && taxableValue > 0) {
      const spouseActual = clampNonNeg(params.spouseActual);
      const legalShareRatio = children > 0 ? 1.5 / (1.5 + children) : 1;
      const legalCap = Math.min(3000000000, Math.floor(taxableValue * legalShareRatio));
      if (spouseActual > 0) {
        spouseDeduction = Math.max(500000000, Math.min(spouseActual, legalCap, 3000000000));
      } else {
        spouseDeduction = 500000000;
      }
    }

    // 금융재산 상속공제 (상증세법 제22조: 2,000만 이하 전액 / 1억 이하 2,000만 / 1억 초과 20%, 최대 2억)
    let financialDeduction = 0;
    if (netFinancial > 0) {
      if (netFinancial <= 20000000) financialDeduction = netFinancial;
      else if (netFinancial <= 100000000) financialDeduction = 20000000;
      else financialDeduction = Math.min(200000000, Math.floor(netFinancial * 0.2));
    }

    // 상증세법 제24조 (공제 적용의 한도): 과세가액 5억 초과 시 가산된 사전증여재산 과표 상당액은 공제 한도에서 차감
    const deductionCap = taxableValue > 500000000 ? Math.max(0, taxableValue - priorGifts) : taxableValue;
    const totalDeduction = Math.min(deductionCap, lumpSumOrItem + spouseDeduction + financialDeduction);
    const taxBase = Math.max(0, taxableValue - totalDeduction);

    // 5단계 누진세율 (10~50%)
    const brackets = [
      { limit: 100000000, rate: 0.1, quick: 0 },
      { limit: 500000000, rate: 0.2, quick: 10000000 },
      { limit: 1000000000, rate: 0.3, quick: 60000000 },
      { limit: 3000000000, rate: 0.4, quick: 160000000 },
      { limit: Infinity, rate: 0.5, quick: 460000000 }
    ];
    let calculatedTax = 0;
    let marginalRate = 0.1;
    if (taxBase > 0) {
      for (const b of brackets) {
        if (taxBase <= b.limit) {
          calculatedTax = Math.floor(taxBase * b.rate - b.quick);
          marginalRate = b.rate;
          break;
        }
      }
    }

    const voluntaryCredit = voluntary ? Math.floor(calculatedTax * 0.03) : 0;
    const finalTax = floor10(Math.max(0, calculatedTax - voluntaryCredit));

    return {
      grossEstate,
      taxableValue,
      isSpouseOnly,
      lumpSumOrItem,
      spouseDeduction,
      financialDeduction,
      deductionCap,
      totalDeduction,
      taxBase,
      marginalRate,
      calculatedTax,
      voluntaryCredit,
      finalTax,
      effectiveRate: taxableValue > 0 ? finalTax / taxableValue : 0
    };
  }

  /* 14. 부동산 양도소득세 계산기 (소득세법 제89·95·103·104조, 2026년 5월 10일 다주택 중과 복귀 반영) */
  function calcPropertyTransferTax(params = {}) {
    const buyPrice = clampNonNeg(params.buyPrice);
    const sellPrice = clampNonNeg(params.sellPrice);
    const expenses = clampNonNeg(params.expenses);
    const holdYears = Math.max(0, Number(params.holdYears) || 0);
    const resideYears = Math.max(0, Math.min(holdYears, Number(params.resideYears) || 0));
    const needReside2Years = Boolean(params.needReside2Years); // 취득 당시 조정대상지역(2년 거주 요건)

    // heavyMode: "none" | "two"(+20%p) | "three"(+30%p) — 기존 isMultiHeavy 호환
    let heavyMode = params.heavyMode || (params.isMultiHeavy ? "two" : "none");
    if (!["none", "two", "three"].includes(heavyMode)) heavyMode = "none";
    const isMultiHeavy = heavyMode !== "none";
    const isOneHome = !isMultiHeavy && Boolean(params.isOneHome);

    const totalGain = Math.max(0, sellPrice - buyPrice - expenses);
    if (totalGain <= 0) {
      return {
        totalGain: 0,
        taxableGain: 0,
        exemptGain: 0,
        ltDeductionRate: 0,
        ltDeduction: 0,
        basicDeduction: 0,
        taxBase: 0,
        transferTax: 0,
        localTax: 0,
        totalTax: 0,
        effectiveRate: 0,
        note: "양도차익이 없어 납부할 양도소득세가 없습니다."
      };
    }

    // 1세대 1주택 비과세 요건: 2년 이상 보유 (취득 시 조정대상지역이면 2년 이상 거주 포함)
    const oneHomeExemptEligible = isOneHome && holdYears >= 2 && (!needReside2Years || resideYears >= 2);
    let taxableGain = totalGain;
    let exemptGain = 0;
    if (oneHomeExemptEligible) {
      if (sellPrice <= 1200000000) {
        taxableGain = 0;
        exemptGain = totalGain;
      } else {
        taxableGain = Math.floor((totalGain * (sellPrice - 1200000000)) / sellPrice);
        exemptGain = totalGain - taxableGain;
      }
    }

    // 장기보유특별공제 (소득세법 제95조: 3년 이상 보유, 다주택 중과 시 배제)
    let ltDeductionRate = 0;
    if (!isMultiHeavy && holdYears >= 3 && taxableGain > 0) {
      if (isOneHome && resideYears >= 2) {
        // 1세대 1주택 표2: 보유 연 4%(최대 40%) + 거주 연 4%(최대 40%) = 최대 80%
        const holdRate = Math.min(0.4, Math.floor(holdYears) * 0.04);
        const resideRate = Math.min(0.4, Math.floor(resideYears) * 0.04);
        ltDeductionRate = Math.min(0.8, holdRate + resideRate);
      } else {
        // 일반 표1: 연 2%, 15년 이상 최대 30%
        ltDeductionRate = Math.min(0.3, Math.floor(holdYears) * 0.02);
      }
    }

    const ltDeduction = Math.floor(taxableGain * ltDeductionRate);
    const incomeAfterLt = Math.max(0, taxableGain - ltDeduction);
    const basicDeduction = incomeAfterLt > 0 ? Math.min(2500000, incomeAfterLt) : 0;
    const taxBase = Math.max(0, incomeAfterLt - basicDeduction);

    let transferTaxRaw = 0;
    let note = "";
    if (taxBase > 0) {
      if (holdYears < 1) {
        transferTaxRaw = Math.floor(taxBase * 0.7);
        note = "주택 1년 미만 단기 양도(70% 단일세율) 적용";
      } else if (holdYears < 2) {
        transferTaxRaw = Math.floor(taxBase * 0.6);
        note = "주택 1년 이상~2년 미만 단기 양도(60% 단일세율) 적용";
      } else {
        const baseCalc = calcProgressiveIncomeTax(taxBase);
        if (heavyMode === "two") {
          transferTaxRaw = Math.floor(baseCalc.tax + taxBase * 0.2);
          note = "조정대상지역 2주택 중과(기본세율 +20%p, 장기보유특별공제 배제 · 2026.5.10 이후 복귀)";
        } else if (heavyMode === "three") {
          transferTaxRaw = Math.floor(baseCalc.tax + taxBase * 0.3);
          note = "조정대상지역 3주택 이상 중과(기본세율 +30%p, 장기보유특별공제 배제 · 2026.5.10 이후 복귀)";
        } else {
          transferTaxRaw = baseCalc.tax;
          if (isOneHome && needReside2Years && resideYears < 2) {
            note = "취득 당시 조정대상지역 2년 실거주 요건 미충족으로 12억 비과세가 배제되었습니다.";
          }
        }
      }
    } else if (exemptGain > 0 && taxableGain === 0) {
      note = "1세대 1주택 비과세 요건(양도가 12억 원 이하) 충족으로 양도소득세 0원";
    }

    const transferTax = floor10(transferTaxRaw);
    const localTax = floor10(transferTax * 0.1);
    const totalTax = transferTax + localTax;

    return {
      totalGain,
      taxableGain,
      exemptGain,
      ltDeductionRate,
      ltDeduction,
      basicDeduction,
      taxBase,
      transferTax,
      localTax,
      totalTax,
      effectiveRate: totalGain > 0 ? totalTax / totalGain : 0,
      note
    };
  }

  /* 15. 부가가치세(VAT) 계산기 (부가가치세법 제46·63·69조) */
  function calcVat(params = {}) {
    const mode = params.mode || "simple"; // simple | general | simplified
    if (mode === "simple") {
      const amount = clampNonNeg(params.amount);
      const isInclusive = Boolean(params.isInclusive);
      const supply = isInclusive ? Math.round(amount / 1.1) : amount;
      const vat = isInclusive ? amount - supply : Math.round(amount * 0.1);
      const total = supply + vat;
      return { mode, supply, vat, total, payableVat: vat, exempt: false, overSimplifiedLimit: false };
    }

    const sales = clampNonNeg(params.sales);
    const purchases = clampNonNeg(params.purchases);
    const cardSales = clampNonNeg(params.cardSales);

    if (mode === "general") {
      const salesVat = Math.floor(sales * 0.1);
      const purchaseVat = Math.floor(purchases * 0.1);
      const netBeforeCard = salesVat - purchaseVat;
      // 부가가치세법 제46조: 신용카드 발행세액공제(1.3%, 연 1,000만 한도)는 납부세액 한도 내 공제(환급 불가)
      const rawCardCredit = Math.min(10000000, Math.floor(cardSales * 0.013));
      const cardCredit = netBeforeCard > 0 ? Math.min(netBeforeCard, rawCardCredit) : 0;
      const payableVat =
        netBeforeCard >= 0 ? floor10(netBeforeCard - cardCredit) : -floor10(Math.abs(netBeforeCard));
      return {
        mode,
        sales,
        purchases,
        salesVat,
        purchaseVat,
        cardCredit,
        payableVat,
        exempt: false,
        overSimplifiedLimit: false
      };
    }

    // 간이과세자 (연 공급대가 1억 400만 원 미만 적용, 4,800만 원 미만 납부의무 면제, 환급 불가)
    const vatValueRate = Math.min(0.4, Math.max(0.15, Number(params.vatValueRate) || 0.3));
    const exempt = sales < 48000000;
    const overSimplifiedLimit = sales >= 104000000;
    const salesVat = Math.floor(sales * vatValueRate * 0.1);
    const purchaseCredit = Math.floor(purchases * 0.005); // 적격증빙 매입액(공급대가) × 0.5%
    const afterPurchase = Math.max(0, salesVat - purchaseCredit);
    const rawCardCredit = Math.min(10000000, Math.floor(cardSales * 0.013));
    const cardCredit = Math.min(afterPurchase, rawCardCredit);
    const rawPayable = Math.max(0, afterPurchase - cardCredit);
    const payableVat = exempt ? 0 : floor10(rawPayable);

    return {
      mode,
      sales,
      purchases,
      vatValueRate,
      salesVat,
      purchaseVat: purchaseCredit,
      cardCredit,
      payableVat,
      exempt,
      overSimplifiedLimit
    };
  }

  /* 16. 금융소득종합과세 계산기 (소득세법 제17조③·제56조·제62조 — 10% 배당 그로스업·배당세액공제·비교과세) */
  function calcFinancialTax(params = {}) {
    const interest = clampNonNeg(params.interest);
    const dividend = clampNonNeg(params.dividend);
    const otherIncome = clampNonNeg(params.otherIncome);
    const domesticDividend = params.domesticDividend !== false; // 국내 법인 배당 10% 그로스업 적용 기본값 true
    const totalFinancial = interest + dividend;

    // 원천징수 15.4% (국세 14% + 지방세 1.4%)
    const withheldNational = Math.floor(totalFinancial * 0.14);
    const withheldLocal = Math.floor(withheldNational * 0.1);
    const withheldTotal = withheldNational + withheldLocal;

    const isComprehensive = totalFinancial > 20000000;
    const excessFinancial = Math.max(0, totalFinancial - 20000000);
    const personalBasic = 1500000;

    // 타 종합소득 단독 산출세액
    const otherBase = Math.max(0, otherIncome - personalBasic);
    const otherOnlyTax = calcProgressiveIncomeTax(otherBase).tax;

    // 배당가산액(Gross-up 10%): 2,000만 원 기준은 이자소득 먼저 채우고 초과분 중 국내 배당소득에 10% 가산
    const grossUpDividend = isComprehensive && domesticDividend ? Math.min(dividend, excessFinancial) : 0;
    const grossUpAmount = Math.floor(grossUpDividend * 0.1);

    let combinedCalcTax = withheldNational + otherOnlyTax;
    let dividendTaxCredit = 0;

    if (isComprehensive) {
      // 소득세법 제62조 비교과세:
      // Option A = 2,000만 × 14% + (타소득과표 + 초과금융소득 + 배당가산액) 누진세액
      // Option B = 금융소득전액 × 14% + 타소득 단독 누진세액
      const optionA = 20000000 * 0.14 + calcProgressiveIncomeTax(otherBase + excessFinancial + grossUpAmount).tax;
      const optionB = totalFinancial * 0.14 + otherOnlyTax;
      combinedCalcTax = Math.max(optionA, optionB);

      // 소득세법 제56조 배당세액공제 한도 = min(배당가산액, 종합과세 산출세액 - 분리과세 비교세액)
      dividendTaxCredit = Math.min(grossUpAmount, Math.max(0, combinedCalcTax - optionB));
    }

    const combinedAfterCredit = Math.max(0, combinedCalcTax - dividendTaxCredit);
    const financialPartNational = Math.max(withheldNational, combinedAfterCredit - otherOnlyTax);
    const additionalNational = floor10(Math.max(0, financialPartNational - withheldNational));
    const additionalLocal = floor10(additionalNational * 0.1);
    const additionalTotal = additionalNational + additionalLocal;
    const totalFinancialTax = withheldTotal + additionalTotal;

    return {
      interest,
      dividend,
      domesticDividend,
      totalFinancial,
      excessFinancial,
      grossUpAmount,
      dividendTaxCredit,
      isComprehensive,
      withheldTotal,
      additionalNational,
      additionalLocal,
      additionalTotal,
      totalFinancialTax,
      afterTaxFinancial: Math.max(0, totalFinancial - totalFinancialTax),
      healthInsuranceWarning: totalFinancial > 20000000
    };
  }

  /* 17. 자동차세 & 자동차 취득세 계산기 (지방세법 제12·127·150·151조, 지특법 제66·67조, 2026년 기준) */
  function calcCarTax(params = {}) {
    const rawType = params.carType || "passenger"; // passenger | compact | ev | van11 (legacy alias: van7)
    const carType = rawType === "van7" ? "van11" : rawType;
    const cc = clampNonNeg(params.cc);
    const carAge = Math.max(1, Math.min(20, Math.floor(Number(params.carAge) || 1)));
    const prepayMonth = Number(params.prepayMonth) || 0; // 0(미적용), 1, 3, 6, 9
    const carPrice = clampNonNeg(params.carPrice);
    const isUsedCar = Boolean(params.isUsedCar); // 신차는 부가세 제외 공급가액 과세, 중고차는 매매가 그대로

    // 1) 연간 자동차세 (비영업용 승용차만 지방교육세 30% 부과; 11인승 이상 승합차는 65,000원 정액·교육세 비과세)
    let baseTax = 0;
    let ageDiscountRate = 0;
    let hasLocalEdu = true;

    if (carType === "ev") {
      baseTax = 100000; // 전기차 정액 10만 원 (+ 교육세 3만 = 13만 원, 차령 경감 없음)
    } else if (carType === "van11") {
      baseTax = 65000; // 11인승 이상 비영업용 승합차(소형일반버스) 정액 65,000원
      hasLocalEdu = false; // 지방세법 제150조: 승합차는 지방교육세 부과 대상 아님
    } else {
      const effCc = carType === "compact" ? Math.min(1000, cc || 998) : cc;
      if (effCc <= 1000) baseTax = effCc * 80;
      else if (effCc <= 1600) baseTax = effCc * 140;
      else baseTax = effCc * 200;

      // 3년 차부터 연 5% 경감, 12년 이상 최대 50%
      if (carAge >= 3) {
        ageDiscountRate = Math.min(0.5, (carAge - 2) * 0.05);
      }
    }

    const discountedBase = floor10(baseTax * (1 - ageDiscountRate));
    const localEduTax = hasLocalEdu ? floor10(discountedBase * 0.3) : 0;
    const annualCarTax = discountedBase + localEduTax;

    // 2026년 연납 공제 (잔여기간 5% 공제 -> 실공제율 1월 약 4.58%, 3월 3.75%, 6월 2.5%, 9월 1.25%)
    const prepayRates = { 0: 0, 1: (11 / 12) * 0.05, 3: (9 / 12) * 0.05, 6: (6 / 12) * 0.05, 9: (3 / 12) * 0.05 };
    const prepayRate = prepayRates[prepayMonth] || 0;
    const prepayDiscount = floor10(annualCarTax * prepayRate);
    const finalCarTax = annualCarTax - prepayDiscount;

    // 2) 자동차 취득세 (신차: 부가세 제외 공급가액 = 차량가 ÷ 1.1 / 중고차: 매매가)
    // 승용 7%, 경차 4%(최대 75만 감면), 전기차 7%(최대 140만 감면), 11인승 이상 승합 5%
    let acqRate = 0.07;
    let acqReliefCap = 0;
    if (carType === "compact") {
      acqRate = 0.04;
      acqReliefCap = 750000;
    } else if (carType === "ev") {
      acqRate = 0.07;
      acqReliefCap = 1400000;
    } else if (carType === "van11") {
      acqRate = 0.05;
    }
    const acqTaxBase = isUsedCar ? carPrice : Math.round(carPrice / 1.1);
    const rawAcqTax = floor10(acqTaxBase * acqRate);
    const acqRelief = Math.min(rawAcqTax, acqReliefCap);
    const finalAcqTax = Math.max(0, rawAcqTax - acqRelief);

    return {
      carType,
      cc,
      carAge,
      isUsedCar,
      ageDiscountRate,
      discountedBase,
      localEduTax,
      annualCarTax,
      prepayMonth,
      prepayRate,
      prepayDiscount,
      finalCarTax,
      carPrice,
      acqTaxBase,
      acqRate,
      rawAcqTax,
      acqRelief,
      finalAcqTax
    };
  }

  /* 18. 기타소득세(8.8%) 계산기 (소득세법 제21·84·129조) */
  function calcOtherIncomeTax(params = {}) {
    const gross = clampNonNeg(params.gross);
    const expenseRatePct = Number(params.expenseRatePct !== undefined ? params.expenseRatePct : 60);
    const expenseRate = Math.min(80, Math.max(0, expenseRatePct)) / 100;

    const expenseAmount = Math.round(gross * expenseRate);
    const otherIncome = Math.max(0, gross - expenseAmount);

    // 과세최저한: 건별 기타소득금액 5만 원 이하 비과세 (소득세법 제84조)
    const taxFreeMin = otherIncome <= 50000;
    const incomeTax = taxFreeMin ? 0 : floor10(otherIncome * 0.2);
    const localTax = taxFreeMin ? 0 : floor10(incomeTax * 0.1);
    const totalTax = incomeTax + localTax;
    const net = Math.max(0, gross - totalTax);

    return {
      gross,
      expenseRate,
      expenseAmount,
      otherIncome,
      taxFreeMin,
      incomeTax,
      localTax,
      totalTax,
      net,
      effectiveRate: gross > 0 ? totalTax / gross : 0,
      separateTaxEligible: otherIncome <= 3000000
    };
  }

  /* 19. 보유세(재산세 · 종합부동산세) 계산기 (지방세법 제111·111의2조, 종부세법 제8·9조, 시행령 제4조의3) */
  function calcHoldingTax(params = {}) {
    const officialPrice = clampNonNeg(params.officialPrice);
    const isOneHome = Boolean(params.isOneHome);
    const isThreePlus = !isOneHome && Boolean(params.isThreePlus);
    const ownerAge = Math.max(0, Math.floor(Number(params.ownerAge) || 40));
    const holdYears = Math.max(0, Math.floor(Number(params.holdYears) || 3));

    // 1) 재산세 공정시장가액비율 (2026: 1주택 3억이하 43%, 3~6억 44%, 6억초과 45% / 일반 60%)
    let propRatio = 0.6;
    if (isOneHome) {
      if (officialPrice <= 300000000) propRatio = 0.43;
      else if (officialPrice <= 600000000) propRatio = 0.44;
      else propRatio = 0.45;
    }
    const propBase = Math.floor(officialPrice * propRatio);

    // 재산세율 (1주택 공시가격 9억 이하 특례세율 0.05~0.35% / 일반 0.1~0.4%)
    const useSpecialRate = isOneHome && officialPrice <= 900000000;
    function calcPropBracket(base, special) {
      const b = clampNonNeg(base);
      if (special) {
        if (b <= 60000000) return b * 0.0005;
        if (b <= 150000000) return 30000 + (b - 60000000) * 0.001;
        if (b <= 300000000) return 120000 + (b - 150000000) * 0.002;
        return 420000 + (b - 300000000) * 0.0035;
      }
      if (b <= 60000000) return b * 0.001;
      if (b <= 150000000) return 60000 + (b - 60000000) * 0.0015;
      if (b <= 300000000) return 195000 + (b - 150000000) * 0.0025;
      return 570000 + (b - 300000000) * 0.004;
    }

    const propertyTax = floor10(calcPropBracket(propBase, useSpecialRate));
    const urbanTax = floor10(propBase * 0.0014); // 도시지역분 0.14%
    const propEduTax = floor10(propertyTax * 0.2); // 지방교육세 20%
    const totalPropertyTax = propertyTax + urbanTax + propEduTax;

    // 2) 종합부동산세 (2026: 1주택 12억 / 일반 9억, 공정시장가액비율 60%)
    const jongbuDeduction = isOneHome ? 1200000000 : 900000000;
    const jongbuRatio = 0.6;
    const jongbuExcess = Math.max(0, officialPrice - jongbuDeduction);
    const jongbuBase = Math.floor(jongbuExcess * jongbuRatio);

    let jongbuRaw = 0;
    if (jongbuBase > 0) {
      const brackets = isThreePlus
        ? [
            { limit: 300000000, rate: 0.005, quick: 0 },
            { limit: 600000000, rate: 0.007, quick: 600000 },
            { limit: 1200000000, rate: 0.01, quick: 2400000 },
            { limit: 2500000000, rate: 0.02, quick: 14400000 },
            { limit: 5000000000, rate: 0.03, quick: 39400000 },
            { limit: 9400000000, rate: 0.04, quick: 89400000 },
            { limit: Infinity, rate: 0.05, quick: 183400000 }
          ]
        : [
            { limit: 300000000, rate: 0.005, quick: 0 },
            { limit: 600000000, rate: 0.007, quick: 600000 },
            { limit: 1200000000, rate: 0.01, quick: 2400000 },
            { limit: 2500000000, rate: 0.013, quick: 6000000 },
            { limit: 5000000000, rate: 0.015, quick: 11000000 },
            { limit: 9400000000, rate: 0.02, quick: 36000000 },
            { limit: Infinity, rate: 0.027, quick: 101800000 }
          ];
      for (const b of brackets) {
        if (jongbuBase <= b.limit) {
          jongbuRaw = Math.max(0, Math.floor(jongbuBase * b.rate - b.quick));
          break;
        }
      }
    }

    // 종부세법 시행령 제4조의3 & 시행규칙 제5조:
    // 공제할 재산세액 = 주택분 재산세 본세 × (종부세 과세표준 × 재산세 공정시장가액비율 × 0.4%) ÷ 총표준세율 재산세액
    const stdPropTaxTotal = calcPropBracket(propBase, false);
    const overlapPropDed =
      jongbuBase > 0 && stdPropTaxTotal > 0
        ? Math.floor(propertyTax * ((jongbuBase * propRatio * 0.004) / stdPropTaxTotal))
        : 0;
    const jongbuAfterOverlap = Math.max(0, jongbuRaw - overlapPropDed);

    // 1세대 1주택 고령자·장기보유 세액공제 (합산 최대 80%)
    let creditRate = 0;
    if (isOneHome && jongbuAfterOverlap > 0) {
      let ageRate = 0;
      if (ownerAge >= 70) ageRate = 0.4;
      else if (ownerAge >= 65) ageRate = 0.3;
      else if (ownerAge >= 60) ageRate = 0.2;

      let holdRate = 0;
      if (holdYears >= 15) holdRate = 0.5;
      else if (holdYears >= 10) holdRate = 0.4;
      else if (holdYears >= 5) holdRate = 0.2;

      creditRate = Math.min(0.8, ageRate + holdRate);
    }

    const jongbuTax = floor10(jongbuAfterOverlap * (1 - creditRate));
    const jongbuRuralTax = floor10(jongbuTax * 0.2); // 농어촌특별세 20%
    const totalJongbuTax = jongbuTax + jongbuRuralTax;
    const totalHoldingTax = totalPropertyTax + totalJongbuTax;

    return {
      officialPrice,
      propRatio,
      propBase,
      propertyTax,
      urbanTax,
      propEduTax,
      totalPropertyTax,
      jongbuDeduction,
      jongbuBase,
      overlapPropDed,
      creditRate,
      jongbuTax,
      jongbuRuralTax,
      totalJongbuTax,
      totalHoldingTax
    };
  }

  /* 20. 근로장려금(EITC) · 자녀장려금 계산기 (조세특례제한법 제100조의3·5·29·30, 2026년 기준) */
  function calcEitc(params = {}) {
    const requestedHousehold = params.household || "single"; // single | singleEarner | dualEarner
    const income = clampNonNeg(params.income);
    const children = Math.max(0, Math.floor(Number(params.children) || 0));
    const assets = clampNonNeg(params.assets);

    const assetEligible = assets < 240000000;
    const assetHalfPenalty = assets >= 170000000 && assets < 240000000;

    // 조특법 제100조의3: 맞벌이 가구는 신청자·배우자 각각 300만 원 이상(합산 최소 600만 원 이상)이어야 인정, 미만 시 홑벌이 분류
    const reclassifiedToSingleEarner = requestedHousehold === "dualEarner" && income > 0 && income < 6000000;
    const household = reclassifiedToSingleEarner ? "singleEarner" : requestedHousehold;

    // 2026년 근로장려금 구간 (단독 2,200 / 홑벌이 3,200 / 맞벌이 4,400만 원 미만)
    const config =
      {
        single: { up: 4000000, flat: 9000000, maxInc: 22000000, maxPay: 1650000 },
        singleEarner: { up: 7000000, flat: 14000000, maxInc: 32000000, maxPay: 2850000 },
        dualEarner: { up: 8000000, flat: 17000000, maxInc: 44000000, maxPay: 3300000 }
      }[household] || { up: 4000000, flat: 9000000, maxInc: 22000000, maxPay: 1650000 };

    let eitcRaw = 0;
    if (assetEligible && income > 0 && income < config.maxInc) {
      if (income < config.up) {
        eitcRaw = (income / config.up) * config.maxPay;
      } else if (income < config.flat) {
        eitcRaw = config.maxPay;
      } else {
        eitcRaw = config.maxPay * ((config.maxInc - income) / (config.maxInc - config.flat));
      }
      eitcRaw = Math.max(0, round10(eitcRaw));
    }

    // 자녀장려금 (조특법 제100조의29: 18세 미만 자녀, 홑벌이/맞벌이 7,000만 원 미만, 1인당 50~100만 원)
    let ctcRaw = 0;
    if (assetEligible && household !== "single" && children > 0 && income > 0 && income < 70000000) {
      const flatEnd = household === "dualEarner" ? 25000000 : 21000000;
      let perChild = 1000000;
      if (income >= flatEnd) {
        perChild = 1000000 - ((income - flatEnd) / (70000000 - flatEnd)) * 500000;
      }
      perChild = Math.max(500000, Math.min(1000000, round10(perChild)));
      ctcRaw = perChild * children;
    }

    const factor = assetHalfPenalty ? 0.5 : 1;
    const eitc = round10(eitcRaw * factor);
    const ctc = round10(ctcRaw * factor);
    const totalBenefit = eitc + ctc;

    const notes = [];
    if (!assetEligible) {
      notes.push("가구 재산 합계 2억 4,000만 원 이상으로 지급 대상에서 제외됩니다.");
    } else {
      if (reclassifiedToSingleEarner) {
        notes.push("부부 합산 소득이 600만 원 미만(각 300만 원 요건 미달)이라 법령상 홑벌이가구 기준으로 산정되었습니다.");
      }
      if (assetHalfPenalty && totalBenefit > 0) {
        notes.push("가구 재산 1억 7,000만~2억 4,000만 원 미만 구간으로 산정액의 50%가 감액되었습니다.");
      }
      if (ctc > 0) {
        notes.push("연말정산·종소세에서 자녀세액공제를 받은 경우 해당 금액만큼 자녀장려금에서 차감됩니다(중복 불가).");
      }
      if (totalBenefit === 0) {
        notes.push("입력하신 소득 또는 가구 유형이 2026년 장려금 지급 기준에 해당하지 않습니다.");
      }
    }

    return {
      household,
      reclassifiedToSingleEarner,
      income,
      children,
      assets,
      assetEligible,
      assetHalfPenalty,
      maxIncomeLimit: config.maxInc,
      eitc,
      ctc,
      totalBenefit,
      statusNote: notes.join(" ")
    };
  }

  return {
    calcProgressiveIncomeTax,
    calcYearEndTax,
    calcCoupleTax,
    calcBusinessIncomeTax,
    calcInheritanceTax,
    calcPropertyTransferTax,
    calcVat,
    calcFinancialTax,
    calcCarTax,
    calcOtherIncomeTax,
    calcHoldingTax,
    calcEitc
  };
});
