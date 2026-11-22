(function () {
  "use strict";

  const Calc = window.SemNoteCalc;
  if (!Calc) return;

  function showToast(message) {
    let el = document.getElementById("semnote-toast");
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
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBar(netId, deductId, netRatio) {
    const clamped = Math.max(0, Math.min(100, netRatio * 100));
    const netEl = document.getElementById(netId);
    const dedEl = document.getElementById(deductId);
    if (netEl) netEl.style.width = clamped.toFixed(1) + "%";
    if (dedEl) dedEl.style.width = (100 - clamped).toFixed(1) + "%";
  }

  function bindCopyButton(buttonId, getSummaryText) {
    const btn = document.getElementById(buttonId);
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
        const input = document.getElementById(targetInputId);
        if (!input) return;
        input.value = btn.getAttribute("data-preset");
        onUpdate();
      });
    });
  }

  // 1. Salary Calculator
  function initSalary() {
    const annualEl = document.getElementById("salary-annual");
    if (!annualEl) return;
    const nonTaxEl = document.getElementById("salary-nontax");
    const depsEl = document.getElementById("salary-deps");

    function update() {
      const annualWon = (Number(annualEl.value) || 0) * 10000;
      const nonTaxWon = (Number(nonTaxEl.value) || 0) * 10000;
      const deps = Number(depsEl.value) || 1;
      const res = Calc.calcSalary(annualWon, nonTaxWon, deps);

      setText("res-monthly-net", Calc.formatWon(res.monthlyNet));
      setText(
        "res-salary-sub",
        "연 실수령액 약 " +
          Calc.formatWon(res.annualNet) +
          " · 공제율 " +
          Calc.formatPercent(res.effectiveDeductionRate, 1)
      );
      setText("res-monthly-gross", Calc.formatWon(res.monthlyGross));
      setText("res-pension", Calc.formatWon(res.nationalPension));
      setText("res-health", Calc.formatWon(res.healthInsurance));
      setText("res-care", Calc.formatWon(res.longTermCare));
      setText("res-employment", Calc.formatWon(res.employmentInsurance));
      setText("res-income-tax", Calc.formatWon(res.incomeTax));
      setText("res-local-tax", Calc.formatWon(res.localIncomeTax));
      setText("res-total-deduction", "-" + Calc.formatWon(res.totalDeduction));

      const netRatio = res.monthlyGross > 0 ? res.monthlyNet / res.monthlyGross : 1;
      setBar("bar-net", "bar-deduct", netRatio);
      setText("legend-net", "실수령 " + (netRatio * 100).toFixed(1) + "%");
      setText("legend-deduct", "공제 " + ((1 - netRatio) * 100).toFixed(1) + "%");
    }

    [annualEl, nonTaxEl, depsEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#salary-presets", "salary-annual", update);
    bindCopyButton("copy-salary-btn", () => {
      const annualWon = (Number(annualEl.value) || 0) * 10000;
      const res = Calc.calcSalary(annualWon, (Number(nonTaxEl.value) || 0) * 10000, Number(depsEl.value) || 1);
      return `[셈노트 연봉 실수령액] 연봉 ${annualEl.value}만 원 → 월 실수령액 ${Calc.formatWon(res.monthlyNet)} (월 공제액 ${Calc.formatWon(res.totalDeduction)})`;
    });
    update();
  }

  // 2. Freelancer 3.3% Calculator
  function initFreelancer() {
    const amountEl = document.getElementById("free-amount");
    if (!amountEl) return;
    let mode = "grossToNet";

    function update() {
      const amountWon = (Number(amountEl.value) || 0) * 10000;
      const res = Calc.calcFreelancer(amountWon, mode);

      if (mode === "grossToNet") {
        setText("res-free-label", "예상 실수령액 (3.3% 공제 후)");
        setText("res-free-main", Calc.formatWon(res.net));
        setText("res-free-sub", "계약 금액 " + Calc.formatWon(res.gross) + " 기준");
      } else {
        setText("res-free-label", "필요 계약 금액 (세전 역산)");
        setText("res-free-main", Calc.formatWon(res.gross));
        setText("res-free-sub", "실수령 목표 " + Calc.formatWon(res.net) + " 기준");
      }

      setText("res-free-gross", Calc.formatWon(res.gross));
      setText("res-free-income", Calc.formatWon(res.incomeTax));
      setText("res-free-local", Calc.formatWon(res.localTax));
      setText("res-free-total-tax", "-" + Calc.formatWon(res.totalTax));
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
      const res = Calc.calcFreelancer((Number(amountEl.value) || 0) * 10000, mode);
      return `[셈노트 3.3% 계산] 세전 ${Calc.formatWon(res.gross)} / 세금 ${Calc.formatWon(res.totalTax)} / 실수령 ${Calc.formatWon(res.net)}`;
    });
    update();
  }

  // 3. Overseas Stock Capital Gains Tax
  function initStockTax() {
    const profitEl = document.getElementById("stock-profit");
    if (!profitEl) return;
    const lossEl = document.getElementById("stock-loss");

    function update() {
      const profitWon = (Number(profitEl.value) || 0) * 10000;
      const lossWon = (Number(lossEl.value) || 0) * 10000;
      const res = Calc.calcOverseasStockTax(profitWon, lossWon);

      setText("res-stock-tax", Calc.formatWon(res.totalTax));
      setText(
        "res-stock-sub",
        "세후 순수익 " +
          Calc.formatWon(res.afterTaxProfit) +
          " · 실효세율 " +
          Calc.formatPercent(res.effectiveRate, 1)
      );
      setText("res-stock-net-profit", Calc.formatWon(res.netProfit));
      setText("res-stock-deduction", "-" + Calc.formatWon(res.deductionApplied));
      setText("res-stock-base", Calc.formatWon(res.taxableBase));
      setText("res-stock-cap-tax", Calc.formatWon(res.capitalGainsTax));
      setText("res-stock-local-tax", Calc.formatWon(res.localTax));
      setText("res-stock-after", Calc.formatWon(res.afterTaxProfit));

      const keepRatio = res.netProfit > 0 ? res.afterTaxProfit / res.netProfit : 1;
      setBar("bar-stock-net", "bar-stock-deduct", keepRatio);
    }

    [profitEl, lossEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#stock-presets", "stock-profit", update);
    bindCopyButton("copy-stock-btn", () => {
      const res = Calc.calcOverseasStockTax((Number(profitEl.value) || 0) * 10000, (Number(lossEl.value) || 0) * 10000);
      return `[셈노트 해외주식 양도세] 순수익 ${Calc.formatWon(res.netProfit)} → 예상 양도세 ${Calc.formatWon(res.totalTax)} (세후 ${Calc.formatWon(res.afterTaxProfit)})`;
    });
    update();
  }

  // 4. Real Estate Acquisition Tax
  function initRealEstate() {
    const priceEl = document.getElementById("re-price");
    if (!priceEl) return;
    const housesEl = document.getElementById("re-houses");
    const over85El = document.getElementById("re-over85");

    function update() {
      const priceWon = (Number(priceEl.value) || 0) * 100000000;
      const houses = Number(housesEl.value) || 1;
      const over85 = over85El ? over85El.checked : false;
      const res = Calc.calcAcquisitionTax(priceWon, houses, over85);

      setText("res-re-total", Calc.formatWon(res.totalTax));
      setText(
        "res-re-sub",
        "총 실효세율 " +
          Calc.formatPercent(res.totalRate, 2) +
          " (취득세율 " +
          Calc.formatPercent(res.acquisitionRate, 2) +
          ")"
      );
      setText("res-re-price", Calc.formatWon(res.price));
      setText("res-re-acq", Calc.formatWon(res.acquisitionTax));
      setText("res-re-edu", Calc.formatWon(res.localEducationTax));
      setText("res-re-rural", Calc.formatWon(res.ruralSpecialTax));
      setText("res-re-sum", Calc.formatWon(res.totalTax));
    }

    [priceEl, housesEl, over85El].forEach((el) => el && el.addEventListener("input", update));
    if (over85El) over85El.addEventListener("change", update);
    bindPresets("#re-presets", "re-price", update);
    bindCopyButton("copy-re-btn", () => {
      const res = Calc.calcAcquisitionTax(
        (Number(priceEl.value) || 0) * 100000000,
        Number(housesEl.value) || 1,
        over85El ? over85El.checked : false
      );
      return `[셈노트 주택 취등록세] 매매가 ${priceEl.value}억 원 (${res.houses}주택) → 총 납부세액 ${Calc.formatWon(res.totalTax)}`;
    });
    update();
  }

  // 5. Jeonse to Wolse Converter
  function initJeonse() {
    const jeonseEl = document.getElementById("jw-jeonse");
    if (!jeonseEl) return;
    const depositEl = document.getElementById("jw-deposit");
    const rateEl = document.getElementById("jw-rate");

    function update() {
      const jeonseWon = (Number(jeonseEl.value) || 0) * 10000;
      const depositWon = (Number(depositEl.value) || 0) * 10000;
      const rate = Number(rateEl.value);
      const res = Calc.calcJeonseToWolse(jeonseWon, depositWon, rate);

      setText("res-jw-monthly", Calc.formatWon(res.monthlyRent));
      setText(
        "res-jw-sub",
        "연간 월세 합계 " +
          Calc.formatWon(res.yearlyRent) +
          " · 전환율 " +
          res.conversionRate.toFixed(1) +
          "%"
      );
      setText("res-jw-diff", Calc.formatWon(res.diffDeposit));
      setText("res-jw-yearly", Calc.formatWon(res.yearlyRent));
    }

    [jeonseEl, depositEl, rateEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#jw-rate-presets", "jw-rate", update);
    bindCopyButton("copy-jw-btn", () => {
      const res = Calc.calcJeonseToWolse(
        (Number(jeonseEl.value) || 0) * 10000,
        (Number(depositEl.value) || 0) * 10000,
        Number(rateEl.value)
      );
      return `[셈노트 전월세 전환] 전세 ${jeonseEl.value}만 원 → 보증금 ${depositEl.value}만 원 / 월세 ${Calc.formatWon(res.monthlyRent)} (전환율 ${res.conversionRate}%)`;
    });
    update();
  }

  // 6. Severance Calculator
  function initSeverance() {
    const monthlyEl = document.getElementById("sev-monthly");
    if (!monthlyEl) return;
    const yearsEl = document.getElementById("sev-years");

    function update() {
      const res = Calc.calcSeverance((Number(monthlyEl.value) || 0) * 10000, Number(yearsEl.value) || 0);
      setText("res-sev-net", res.eligible ? Calc.formatWon(res.net) : "지급 대상 아님 (1년 미만)");
      setText(
        "res-sev-sub",
        res.eligible
          ? "세전 퇴직금 " + Calc.formatWon(res.gross) + " · 퇴직세 합계 " + Calc.formatWon(res.totalTax)
          : "계속근로기간 1년 이상부터 법정 퇴직금이 발생합니다."
      );
      setText("res-sev-gross", Calc.formatWon(res.gross));
      setText("res-sev-ded", "-" + Calc.formatWon(res.serviceDeduction));
      setText("res-sev-inc", Calc.formatWon(res.retirementIncomeTax));
      setText("res-sev-loc", Calc.formatWon(res.localTax));
      setText("res-sev-tax", "-" + Calc.formatWon(res.totalTax));
    }

    [monthlyEl, yearsEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#sev-presets", "sev-monthly", update);
    bindCopyButton("copy-sev-btn", () => {
      const res = Calc.calcSeverance((Number(monthlyEl.value) || 0) * 10000, Number(yearsEl.value) || 0);
      return `[셈노트 퇴직금] 월급 ${monthlyEl.value}만 원 · ${yearsEl.value}년 근속 → 실수령 약 ${Calc.formatWon(res.net)} (세전 ${Calc.formatWon(res.gross)})`;
    });
    update();
  }

  // 7. Unemployment Benefit Calculator
  function initUnemployment() {
    const monthlyEl = document.getElementById("unemp-monthly");
    if (!monthlyEl) return;
    const yearsEl = document.getElementById("unemp-years");
    const ageEl = document.getElementById("unemp-age50");

    function update() {
      const res = Calc.calcUnemployment(
        (Number(monthlyEl.value) || 0) * 10000,
        ageEl ? ageEl.checked : false,
        Number(yearsEl.value) || 1
      );
      setText("res-unemp-total", Calc.formatWon(res.totalBenefit));
      setText(
        "res-unemp-sub",
        "1일 " + Calc.formatWon(res.dailyBenefit) + " × " + res.benefitDays + "일 (월 약 " + Calc.formatWon(res.monthlyBenefit) + ")"
      );
      setText("res-unemp-daily", Calc.formatWon(res.dailyBenefit));
      setText("res-unemp-days", res.benefitDays + "일");
      setText("res-unemp-monthly", Calc.formatWon(res.monthlyBenefit));
    }

    [monthlyEl, yearsEl, ageEl].forEach((el) => el && el.addEventListener("input", update));
    if (ageEl) ageEl.addEventListener("change", update);
    bindPresets("#unemp-presets", "unemp-monthly", update);
    bindCopyButton("copy-unemp-btn", () => {
      const res = Calc.calcUnemployment(
        (Number(monthlyEl.value) || 0) * 10000,
        ageEl ? ageEl.checked : false,
        Number(yearsEl.value) || 1
      );
      return `[셈노트 실업급여] 1일 ${Calc.formatWon(res.dailyBenefit)} × ${res.benefitDays}일 = 총 ${Calc.formatWon(res.totalBenefit)}`;
    });
    update();
  }

  // 8. Weekly Holiday Pay Calculator
  function initWeeklyHoliday() {
    const wageEl = document.getElementById("wh-wage");
    if (!wageEl) return;
    const hoursEl = document.getElementById("wh-hours");

    function update() {
      const res = Calc.calcWeeklyHoliday(Number(wageEl.value) || 0, Number(hoursEl.value) || 0);
      setText("res-wh-pay", res.eligible ? Calc.formatWon(res.holidayPay) : "0원 (주 15시간 미만)");
      setText(
        "res-wh-sub",
        "주급(주휴 포함) " + Calc.formatWon(res.totalWeeklyPay) + " · 월 환산 약 " + Calc.formatWon(res.estimatedMonthlyPay)
      );
      setText("res-wh-base", Calc.formatWon(res.baseWeeklyPay));
      setText("res-wh-hours", res.holidayHours.toFixed(1) + "시간");
      setText("res-wh-total", Calc.formatWon(res.totalWeeklyPay));
      setText("res-wh-monthly", Calc.formatWon(res.estimatedMonthlyPay));
    }

    [wageEl, hoursEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#wh-wage-presets", "wh-wage", update);
    bindPresets("#wh-hours-presets", "wh-hours", update);
    bindCopyButton("copy-wh-btn", () => {
      const res = Calc.calcWeeklyHoliday(Number(wageEl.value) || 0, Number(hoursEl.value) || 0);
      return `[셈노트 주휴수당] 시급 ${wageEl.value}원 · 주 ${hoursEl.value}시간 → 주휴수당 ${Calc.formatWon(res.holidayPay)} / 주급 ${Calc.formatWon(res.totalWeeklyPay)}`;
    });
    update();
  }

  // 9. Gift Tax Calculator
  function initGiftTax() {
    const amountEl = document.getElementById("gift-amount");
    if (!amountEl) return;
    const relEl = document.getElementById("gift-relation");

    function update() {
      const res = Calc.calcGiftTax((Number(amountEl.value) || 0) * 10000, relEl.value);
      setText("res-gift-final", Calc.formatWon(res.finalTax));
      setText(
        "res-gift-sub",
        "자진신고 3% 공제 적용 · 실효세율 " + Calc.formatPercent(res.effectiveRate, 1)
      );
      setText("res-gift-gross", Calc.formatWon(res.gift));
      setText("res-gift-ded", "-" + Calc.formatWon(res.deductionApplied));
      setText("res-gift-base", Calc.formatWon(res.taxBase));
      setText("res-gift-calc", Calc.formatWon(res.calculatedTax));
      setText("res-gift-credit", "-" + Calc.formatWon(res.voluntaryCredit));
    }

    [amountEl, relEl].forEach((el) => el && el.addEventListener("input", update));
    bindPresets("#gift-presets", "gift-amount", update);
    bindCopyButton("copy-gift-btn", () => {
      const res = Calc.calcGiftTax((Number(amountEl.value) || 0) * 10000, relEl.value);
      return `[셈노트 증여세] 증여액 ${amountEl.value}만 원 → 예상 납부세액 ${Calc.formatWon(res.finalTax)}`;
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
