(function () {
  "use strict";

  const Calc = window.SemNoteCalc;
  if (!Calc) return;

  function $(id) {
    return document.getElementById(id);
  }

  function num(id, fallback) {
    const el = $(id);
    if (!el) return fallback === undefined ? 0 : fallback;
    const v = Number(el.value);
    return Number.isFinite(v) && el.value !== "" ? v : fallback === undefined ? 0 : fallback;
  }

  function checked(id) {
    const el = $(id);
    return el ? el.checked : false;
  }

  function val(id, fallback) {
    const el = $(id);
    return el ? el.value : fallback;
  }

  function negWon(value) {
    return (value > 0 ? "-" : "") + Calc.formatWon(value);
  }

  function showToast(message) {
    let el = $("semnote-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "semnote-toast";
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 2000);
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setNote(id, text) {
    const el = $(id);
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
  }

  function setBar(netId, deductId, netRatio) {
    const clamped = Math.max(0, Math.min(100, netRatio * 100));
    const netEl = $(netId);
    const dedEl = $(deductId);
    if (netEl) netEl.style.width = clamped.toFixed(1) + "%";
    if (dedEl) dedEl.style.width = (100 - clamped).toFixed(1) + "%";
  }

  function bindCopyButton(buttonId, getSummaryText) {
    const btn = $(buttonId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const text = getSummaryText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast("계산 결과를 복사했습니다."));
      } else {
        showToast("복사를 지원하지 않는 브라우저입니다.");
      }
    });
  }

  function bindPresets(containerSelector, targetInputId, onUpdate) {
    document.querySelectorAll(containerSelector + " [data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = $(targetInputId);
        if (!input) return;
        input.value = btn.getAttribute("data-preset");
        onUpdate();
      });
    });
  }

  function bindInputs(ids, update) {
    ids.forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("input", update);
      el.addEventListener("change", update);
    });
  }

  // 1. Salary Calculator
  function initSalary() {
    if (!$("salary-annual")) return;

    function compute() {
      return Calc.calcSalary(num("salary-annual") * 10000, num("salary-nontax") * 10000, num("salary-deps", 1), undefined, {
        children: num("salary-children"),
        withholdingRatio: num("salary-ratio", 1)
      });
    }

    function syncChildren() {
      const deps = num("salary-deps", 1);
      const childEl = $("salary-children");
      if (!childEl) return;
      Array.from(childEl.options).forEach((o) => {
        o.disabled = Number(o.value) > deps - 1;
      });
      if (Number(childEl.value) > deps - 1) childEl.value = String(Math.max(0, deps - 1));
    }

    function update() {
      syncChildren();
      const res = compute();
      setText("res-monthly-net", Calc.formatWon(res.monthlyNet));
      setText(
        "res-salary-sub",
        "월 실수령 × 12 = 연 " + Calc.formatWon(res.annualNet) + " · 공제율 " + Calc.formatPercent(res.effectiveDeductionRate, 1)
      );
      setText("res-monthly-gross", Calc.formatWon(res.monthlyGross));
      setText("res-pension", Calc.formatWon(res.nationalPension));
      setText("res-health", Calc.formatWon(res.healthInsurance));
      setText("res-care", Calc.formatWon(res.longTermCare));
      setText("res-employment", Calc.formatWon(res.employmentInsurance));
      setText("res-income-tax", Calc.formatWon(res.incomeTax));
      setText("res-local-tax", Calc.formatWon(res.localIncomeTax));
      setText("res-total-deduction", negWon(res.totalDeduction));
      setNote(
        "res-salary-note",
        res.childDeduction > 0
          ? "간이세액표 " + Calc.formatWon(res.tableTax) + "에서 8~20세 자녀 공제 " + Calc.formatWon(res.childDeduction) + " 차감" +
              (res.withholdingRatio !== 1 ? " 후 " + Math.round(res.withholdingRatio * 100) + "% 적용" : "")
          : res.withholdingRatio !== 1
          ? "간이세액표 " + Calc.formatWon(res.tableTax) + "의 " + Math.round(res.withholdingRatio * 100) + "% 원천징수"
          : ""
      );

      const netRatio = res.monthlyGross > 0 ? res.monthlyNet / res.monthlyGross : 1;
      setBar("bar-net", "bar-deduct", netRatio);
      setText("legend-net", "실수령 " + (netRatio * 100).toFixed(1) + "%");
      setText("legend-deduct", "공제 " + ((1 - netRatio) * 100).toFixed(1) + "%");
    }

    bindInputs(["salary-annual", "salary-nontax", "salary-deps", "salary-children", "salary-ratio"], update);
    bindPresets("#salary-presets", "salary-annual", update);
    bindCopyButton("copy-salary-btn", () => {
      const res = compute();
      return `[세금계산기 연봉 실수령액] 연봉 ${val("salary-annual")}만 원 → 월 실수령액 ${Calc.formatWon(res.monthlyNet)} (월 공제액 ${Calc.formatWon(res.totalDeduction)})`;
    });
    update();
  }

  // 2. Freelancer 3.3% Calculator
  function initFreelancer() {
    const amountEl = $("free-amount");
    if (!amountEl) return;
    let mode = "grossToNet";

    function update() {
      const res = Calc.calcFreelancer(num("free-amount") * 10000, mode);
      if (mode === "grossToNet") {
        setText("res-free-label", "예상 실수령액 (3.3% 공제 후)");
        setText("res-free-main", Calc.formatWon(res.net));
        setText("res-free-sub", "계약 금액 " + Calc.formatWon(res.gross) + " 기준");
      } else {
        setText("res-free-label", "필요 계약 금액 (세전 역산)");
        setText("res-free-main", Calc.formatWon(res.gross));
        setText("res-free-sub", "실수령 목표 " + Calc.formatWon(num("free-amount") * 10000) + " 기준");
      }
      setText("res-free-gross", Calc.formatWon(res.gross));
      setText("res-free-income", Calc.formatWon(res.incomeTax));
      setText("res-free-local", Calc.formatWon(res.localTax));
      setText("res-free-total-tax", negWon(res.totalTax));
      setText("res-free-net", Calc.formatWon(res.net));
      const netRatio = res.gross > 0 ? res.net / res.gross : 1;
      setBar("bar-free-net", "bar-free-deduct", netRatio);
    }

    document.querySelectorAll("[data-free-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        mode = btn.getAttribute("data-free-mode");
        document.querySelectorAll("[data-free-mode]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        update();
      });
    });

    amountEl.addEventListener("input", update);
    bindPresets("#free-presets", "free-amount", update);
    bindCopyButton("copy-free-btn", () => {
      const res = Calc.calcFreelancer(num("free-amount") * 10000, mode);
      return `[세금계산기 3.3% 계산] 세전 ${Calc.formatWon(res.gross)} / 세금 ${Calc.formatWon(res.totalTax)} / 실수령 ${Calc.formatWon(res.net)}`;
    });
    update();
  }

  // 3. Overseas Stock Capital Gains Tax
  function initStockTax() {
    if (!$("stock-profit")) return;

    function compute() {
      return Calc.calcOverseasStockTax(num("stock-profit") * 10000, num("stock-loss") * 10000, undefined, {
        riaGain: num("stock-ria-gain") * 10000,
        riaPeriod: val("stock-ria-period", ""),
        riaProceeds: num("stock-ria-proceeds") * 10000,
        riaNetBuy: num("stock-ria-netbuy") * 10000
      });
    }

    function update() {
      const res = compute();
      setText("res-stock-tax", Calc.formatWon(res.totalTax));
      setText(
        "res-stock-sub",
        "세후 순수익 " + Calc.formatWon(res.afterTaxProfit) + " · 실효세율 " + Calc.formatPercent(res.effectiveRate, 1)
      );
      setText("res-stock-net-profit", Calc.formatWon(res.netProfit));
      setText("res-stock-ria", negWon(res.riaDeduction) + (res.riaRate > 0 ? " (" + Math.round(res.riaRate * 1000) / 10 + "%)" : ""));
      setText("res-stock-deduction", negWon(res.deductionApplied));
      setText("res-stock-base", Calc.formatWon(res.taxableBase));
      setText("res-stock-cap-tax", Calc.formatWon(res.capitalGainsTax));
      setText("res-stock-local-tax", Calc.formatWon(res.localTax));
      setText("res-stock-after", Calc.formatWon(res.afterTaxProfit));
    }

    bindInputs(["stock-profit", "stock-loss", "stock-ria-gain", "stock-ria-period", "stock-ria-proceeds", "stock-ria-netbuy"], update);
    bindPresets("#stock-presets", "stock-profit", update);
    bindCopyButton("copy-stock-btn", () => {
      const res = compute();
      return `[세금계산기 해외주식 양도세] 순수익 ${Calc.formatWon(res.netProfit)} → 예상 양도세 ${Calc.formatWon(res.totalTax)} (세후 ${Calc.formatWon(res.afterTaxProfit)})`;
    });
    update();
  }

  // 4. Real Estate Acquisition Tax
  function initRealEstate() {
    if (!$("re-price")) return;
    const REGIME = { standard: "표준세율", heavy8: "다주택 중과 8%", heavy12: "다주택 중과 12%" };
    const RELIEF = { first: "생애최초 감면", firstSmall: "생애최초 감면(소형·인구감소지역)", birth: "출산·양육 감면" };

    function compute() {
      return Calc.calcAcquisitionTax(num("re-price") * 100000000, num("re-houses", 1), checked("re-over85"), undefined, {
        adjusted: checked("re-adjusted"),
        temporary2: checked("re-temp2"),
        relief: val("re-relief", "none")
      });
    }

    function update() {
      const res = compute();
      setText("res-re-total", Calc.formatWon(res.totalTax));
      setText(
        "res-re-sub",
        REGIME[res.regime] + " · 총 실효세율 " + Calc.formatPercent(res.totalRate, 2) + " (취득세율 " + Calc.formatPercent(res.acquisitionRate, 2) + ")"
      );
      setText("res-re-price", Calc.formatWon(res.price));
      setText("res-re-acq-before", Calc.formatWon(res.acquisitionTaxBeforeRelief));
      setText("res-re-relief", negWon(res.reliefAmount));
      setText("res-re-acq", Calc.formatWon(res.acquisitionTax));
      setText("res-re-edu", Calc.formatWon(res.localEducationTax));
      setText("res-re-rural", Calc.formatWon(res.ruralSpecialTax));
      setText("res-re-sum", Calc.formatWon(res.totalTax));
      let note = "";
      if (res.reliefRequested !== "none" && res.relief === "none") {
        note = "감면 요건(취득가 12억 원 이하·취득 후 1주택) 미충족으로 감면을 적용하지 않았습니다.";
      } else if (res.relief !== "none") {
        note = RELIEF[res.relief] + " 적용" + (res.reliefRuralTax > 0 ? " · 감면세액의 20% 농어촌특별세 포함" : "");
      }
      setNote("res-re-note", note);
    }

    bindInputs(["re-price", "re-houses", "re-over85", "re-adjusted", "re-temp2", "re-relief"], update);
    bindPresets("#re-presets", "re-price", update);
    bindCopyButton("copy-re-btn", () => {
      const res = compute();
      return `[세금계산기 주택 취득세] 매매가 ${val("re-price")}억 원 (${res.houses >= 4 ? "4주택 이상" : res.houses + "주택"}, ${REGIME[res.regime]}) → 총 납부세액 ${Calc.formatWon(res.totalTax)}`;
    });
    update();
  }

  // 5. Jeonse to Wolse Converter
  function initJeonse() {
    if (!$("jw-jeonse")) return;

    function compute() {
      const rateEl = $("jw-rate");
      const rate = rateEl && rateEl.value !== "" ? Number(rateEl.value) : undefined;
      return Calc.calcJeonseToWolse(num("jw-jeonse") * 10000, num("jw-deposit") * 10000, rate);
    }

    function update() {
      const res = compute();
      setText("res-jw-monthly", Calc.formatWon(res.monthlyRent));
      setText("res-jw-sub", "연간 월세 합계 " + Calc.formatWon(res.yearlyRent) + " · 전환율 " + res.conversionRate.toFixed(1) + "%");
      setText("res-jw-diff", Calc.formatWon(res.diffDeposit));
      setText("res-jw-yearly", Calc.formatWon(res.yearlyRent));
      setText("res-jw-cap", res.legalCapRate.toFixed(1) + "% → 월 " + Calc.formatWon(res.capMonthlyRent));
      setNote(
        "res-jw-note",
        res.exceedsCap
          ? "입력 전환율이 법정 상한(" + res.legalCapRate.toFixed(1) + "%)을 넘습니다. 계약 기간 중·갱신 시 전환이라면 월 " + Calc.formatWon(res.capMonthlyRent) + "을 넘는 차임은 무효입니다."
          : ""
      );
    }

    bindInputs(["jw-jeonse", "jw-deposit", "jw-rate"], update);
    bindPresets("#jw-rate-presets", "jw-rate", update);
    bindCopyButton("copy-jw-btn", () => {
      const res = compute();
      return `[세금계산기 전월세 전환] 전세 ${val("jw-jeonse")}만 원 → 보증금 ${val("jw-deposit")}만 원 / 월세 ${Calc.formatWon(res.monthlyRent)} (전환율 ${res.conversionRate}%, 법정 상한 ${res.legalCapRate}%)`;
    });
    update();
  }

  // 6. Severance Calculator
  function initSeverance() {
    if (!$("sev-monthly")) return;

    function compute() {
      return Calc.calcSeverance(num("sev-monthly") * 10000, num("sev-years"), {
        annualBonus: num("sev-bonus") * 10000,
        annualLeavePay: num("sev-leave") * 10000,
        threeMonthDays: num("sev-days", 91),
        irpExempt: checked("sev-irp-exempt")
      });
    }

    function update() {
      const res = compute();
      if (!res.eligible) {
        setText("res-sev-label", "법정 퇴직금");
        setText("res-sev-main", "지급 대상 아님 (1년 미만)");
        setText("res-sev-sub", "계속근로기간 1년 이상·4주 평균 주 15시간 이상이어야 법정 퇴직금이 발생합니다.");
      } else if (res.irpRequired) {
        setText("res-sev-label", "IRP 입금액 (세전 전액, 퇴직소득세 과세이연)");
        setText("res-sev-main", Calc.formatWon(res.gross));
        setText("res-sev-sub", "IRP에서 일시금 인출 시 세금 " + Calc.formatWon(res.totalTax) + " · 연금 수령(10년 이내) 시 약 " + Calc.formatWon(res.pensionTaxEstimate));
      } else {
        setText("res-sev-label", "예상 퇴직금 실수령액 (일시금)");
        setText("res-sev-main", Calc.formatWon(res.net));
        setText("res-sev-sub", "세전 퇴직금 " + Calc.formatWon(res.gross) + " · 퇴직세 합계 " + Calc.formatWon(res.totalTax));
      }
      setText("res-sev-daily", Calc.formatWon(res.dailyAverageWage) + " (" + res.threeMonthDays + "일 기준)");
      setText("res-sev-gross", Calc.formatWon(res.gross));
      setText("res-sev-ded", negWon(res.serviceDeduction));
      setText("res-sev-inc", Calc.formatWon(res.retirementIncomeTax));
      setText("res-sev-loc", Calc.formatWon(res.localTax));
      setText("res-sev-tax", negWon(res.totalTax));
      setText("res-sev-net", Calc.formatWon(res.net));
    }

    bindInputs(["sev-monthly", "sev-years", "sev-bonus", "sev-leave", "sev-days", "sev-irp-exempt"], update);
    bindPresets("#sev-presets", "sev-monthly", update);
    bindCopyButton("copy-sev-btn", () => {
      const res = compute();
      return `[세금계산기 퇴직금] 월급 ${val("sev-monthly")}만 원 · ${val("sev-years")}년 근속 → 세전 ${Calc.formatWon(res.gross)} / 퇴직소득세 등 ${Calc.formatWon(res.totalTax)}`;
    });
    update();
  }

  // 7. Unemployment Benefit Calculator
  function initUnemployment() {
    if (!$("unemp-monthly")) return;

    function compute() {
      return Calc.calcUnemployment(num("unemp-monthly") * 10000, checked("unemp-age50"), num("unemp-years", 1), undefined, {
        dailyHours: num("unemp-hours", 8)
      });
    }

    function update() {
      const res = compute();
      if (!res.eligible) {
        setText("res-unemp-total", "수급 요건 미충족");
        setText("res-unemp-sub", "이직 전 18개월 중 피보험단위기간 180일 이상이 필요합니다.");
      } else {
        setText("res-unemp-total", Calc.formatWon(res.totalBenefit));
        setText("res-unemp-sub", "1일 " + Calc.formatWon(res.dailyBenefit) + " × " + res.benefitDays + "일 (월 약 " + Calc.formatWon(res.monthlyBenefit) + ")");
      }
      setText("res-unemp-avg", Calc.formatWon(res.dailyAverageWage));
      setText("res-unemp-limits", Calc.formatWon(res.lowerLimit) + " ~ " + Calc.formatWon(res.upperLimit));
      setText("res-unemp-daily", Calc.formatWon(res.dailyBenefit));
      setText("res-unemp-days", res.benefitDays + "일");
      setText("res-unemp-monthly", Calc.formatWon(res.monthlyBenefit));
    }

    bindInputs(["unemp-monthly", "unemp-years", "unemp-age50", "unemp-hours"], update);
    bindPresets("#unemp-presets", "unemp-monthly", update);
    bindCopyButton("copy-unemp-btn", () => {
      const res = compute();
      return `[세금계산기 실업급여] 1일 ${Calc.formatWon(res.dailyBenefit)} × ${res.benefitDays}일 = 총 ${Calc.formatWon(res.totalBenefit)}`;
    });
    update();
  }

  // 8. Weekly Holiday Pay Calculator
  function initWeeklyHoliday() {
    if (!$("wh-wage")) return;

    function compute() {
      return Calc.calcWeeklyHoliday(num("wh-wage"), num("wh-hours"), undefined, { fivePlus: checked("wh-fiveplus") });
    }

    function update() {
      const res = compute();
      setText("res-wh-pay", res.eligible ? Calc.formatWon(res.holidayPay) : "0원 (주 15시간 미만)");
      setText("res-wh-sub", "주급(주휴 포함) " + Calc.formatWon(res.totalWeeklyPay) + " · 월 환산 약 " + Calc.formatWon(res.estimatedMonthlyPay));
      setText("res-wh-base", Calc.formatWon(res.regularPay));
      setText("res-wh-ot", Calc.formatWon(res.overtimePay) + (res.overtimeHours > 0 ? " (" + res.overtimeHours + "시간)" : ""));
      setText("res-wh-hours", res.holidayHours.toFixed(1) + "시간");
      setText("res-wh-total", Calc.formatWon(res.totalWeeklyPay));
      setText("res-wh-monthly", Calc.formatWon(res.estimatedMonthlyPay) + " (" + res.monthlyPaidHours + "시간)");
      const notes = [];
      if (res.belowMinimumWage) notes.push("입력 시급이 2026년 최저임금(10,320원)보다 낮습니다.");
      if (res.overLegalLimit) notes.push("주 52시간(소정 40 + 연장 12)을 초과하는 근로는 법정 한도 위반입니다.");
      setNote("res-wh-note", notes.join(" "));
    }

    bindInputs(["wh-wage", "wh-hours", "wh-fiveplus"], update);
    bindPresets("#wh-wage-presets", "wh-wage", update);
    bindPresets("#wh-hours-presets", "wh-hours", update);
    bindCopyButton("copy-wh-btn", () => {
      const res = compute();
      return `[세금계산기 주휴수당] 시급 ${val("wh-wage")}원 · 주 ${val("wh-hours")}시간 → 주휴수당 ${Calc.formatWon(res.holidayPay)} / 주급 ${Calc.formatWon(res.totalWeeklyPay)}`;
    });
    update();
  }

  // 9. Gift Tax Calculator
  function initGiftTax() {
    if (!$("gift-amount")) return;

    function compute() {
      return Calc.calcGiftTax(num("gift-amount") * 10000, val("gift-relation", "adultChild"), undefined, {
        marriageBirth: checked("gift-marriage") ? 100000000 - num("gift-marriage-used") * 10000 : 0,
        usedDeduction: num("gift-used-ded") * 10000,
        priorTax: num("gift-prior-tax") * 10000
      });
    }

    function update() {
      const rel = val("gift-relation", "adultChild");
      const mbRow = $("gift-marriage-field");
      if (mbRow) mbRow.hidden = !["adultChild", "minorChild", "adultGrandchild", "minorGrandchild"].includes(rel);
      const res = compute();
      setText("res-gift-final", Calc.formatWon(res.finalTax));
      setText("res-gift-sub", "신고세액공제 3% 적용 · 실효세율 " + Calc.formatPercent(res.effectiveRate, 1));
      setText("res-gift-gross", Calc.formatWon(res.gift));
      setText("res-gift-ded", negWon(res.deductionApplied - res.marriageBirthDeduction));
      setText("res-gift-mb", negWon(res.marriageBirthDeduction));
      setText("res-gift-base", Calc.formatWon(res.taxBase));
      setText("res-gift-calc", Calc.formatWon(res.calculatedTax));
      setText("res-gift-surcharge", Calc.formatWon(res.generationSkipSurcharge));
      setText("res-gift-prior", negWon(res.priorTaxCredit));
      setText("res-gift-credit", negWon(res.voluntaryCredit));
    }

    bindInputs(["gift-amount", "gift-relation", "gift-marriage", "gift-marriage-used", "gift-used-ded", "gift-prior-tax"], update);
    bindPresets("#gift-presets", "gift-amount", update);
    bindCopyButton("copy-gift-btn", () => {
      const res = compute();
      return `[세금계산기 증여세] 증여액 ${val("gift-amount")}만 원 → 예상 납부세액 ${Calc.formatWon(res.finalTax)}`;
    });
    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initSalary();
    initFreelancer();
    initStockTax();
    initRealEstate();
    initJeonse();
    initSeverance();
    initUnemployment();
    initWeeklyHoliday();
    initGiftTax();
  });
})();
