(function () {
  "use strict";

  const Calc = window.SemNoteCalc;
  const UI = window.SemNoteUI;
  if (!Calc || !UI) return;

  const { $, num, checked, val, negWon, setText, setNote, restoreParams, bindInputs, bindPresets, bindShareActions } = UI;

  // 10. 연말정산 환급액 계산기
  function initYearEndTax() {
    if (!$("ye-gross")) return;
    const fields = [
      { param: "gross", id: "ye-gross" },
      { param: "prepaid", id: "ye-prepaid" },
      { param: "deps", id: "ye-deps" },
      { param: "children", id: "ye-children" },
      { param: "credit", id: "ye-credit" },
      { param: "debit", id: "ye-debit" },
      { param: "pension", id: "ye-pension" },
      { param: "rent", id: "ye-rent" },
      { param: "medical", id: "ye-medical" },
      { param: "education", id: "ye-education" },
      { param: "donation", id: "ye-donation" }
    ];

    function compute() {
      const prepaidEl = $("ye-prepaid");
      const prepaidRaw = prepaidEl && prepaidEl.value !== "" ? num("ye-prepaid") * 10000 : null;
      return Calc.calcYearEndTax({
        gross: num("ye-gross") * 10000,
        prepaidTax: prepaidRaw,
        dependents: num("ye-deps", 1),
        children: num("ye-children"),
        creditCard: num("ye-credit") * 10000,
        debitCash: num("ye-debit") * 10000,
        pensionIrp: num("ye-pension") * 10000,
        monthlyRentAnnual: num("ye-rent") * 10000,
        medical: num("ye-medical") * 10000,
        education: num("ye-education") * 10000,
        donation: num("ye-donation") * 10000
      });
    }

    function update() {
      const res = compute();
      const isRefund = res.refundAmount >= 0;
      setText("res-ye-label", isRefund ? "예상 연말정산 환급액" : "예상 추가 납부세액");
      setText("res-ye-main", (isRefund ? "+" : "-") + Calc.formatWon(Math.abs(res.refundAmount)));
      setText(
        "res-ye-sub",
        "결정세액 " + Calc.formatWon(res.determinedTotalTax) + " · 기납부세액 " + Calc.formatWon(res.prepaidTax)
      );
      setText("res-ye-earned", Calc.formatWon(res.earnedIncome));
      setText("res-ye-card", negWon(res.cardDeduction));
      setText("res-ye-base", Calc.formatWon(res.taxBase) + " (" + Math.round(res.marginalRate * 100) + "% 구간)");
      setText("res-ye-calc", Calc.formatWon(res.calculatedTax));
      setText("res-ye-credit", negWon(res.totalTaxCredit));
      setText("res-ye-det", Calc.formatWon(res.determinedTotalTax));
      setText("res-ye-prepaid", Calc.formatWon(res.prepaidTax));
      setNote(
        "res-ye-note",
        isRefund
          ? "기납부세액보다 결정세액이 적어 약 " + Calc.formatWon(res.refundAmount) + " 환급이 예상됩니다."
          : "기납부세액보다 결정세액이 많아 약 " + Calc.formatWon(Math.abs(res.refundAmount)) + " 추가 납부가 예상됩니다."
      );
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#ye-presets", "ye-gross", update);
    bindShareActions("ye", {
      title: "세금계산기 · 연말정산 환급액 계산 결과",
      filename: "세금계산기-연말정산.png",
      fields,
      getSummary: () => {
        const res = compute();
        const tag = res.refundAmount >= 0 ? "환급 " + Calc.formatWon(res.refundAmount) : "추가납부 " + Calc.formatWon(Math.abs(res.refundAmount));
        return `[세금계산기 연말정산] 총급여 ${val("ye-gross")}만 원 → 예상 ${tag} (결정세액 ${Calc.formatWon(res.determinedTotalTax)})`;
      }
    });
    update();
  }

  // 11. 맞벌이 부부 연말정산 절세 계산기
  function initCoupleTax() {
    if (!$("cp-husband")) return;
    const fields = [
      { param: "h", id: "cp-husband" },
      { param: "w", id: "cp-wife" },
      { param: "children", id: "cp-children" },
      { param: "otherDeps", id: "cp-other-deps" },
      { param: "med", id: "cp-medical" },
      { param: "edu", id: "cp-education" },
      { param: "card", id: "cp-card" }
    ];

    function compute() {
      return Calc.calcCoupleTax({
        husbandGross: num("cp-husband") * 10000,
        wifeGross: num("cp-wife") * 10000,
        children: num("cp-children"),
        otherDeps: num("cp-other-deps"),
        sharedMedical: num("cp-medical") * 10000,
        sharedEducation: num("cp-education") * 10000,
        sharedCard: num("cp-card") * 10000
      });
    }

    function update() {
      const res = compute();
      const b = res.best;
      setText("res-cp-main", Calc.formatWon(b.totalTax));
      setText(
        "res-cp-sub",
        res.maxSavings > 0
          ? "최적 배분 시 최악 조합 대비 연 " + Calc.formatWon(res.maxSavings) + " 절세!"
          : "부부 합산 결정세액 (지방소득세 포함)"
      );
      setText("res-cp-dep-split", "남편 " + (b.hChild + b.hOther) + "명 (자녀 " + b.hChild + ") · 아내 " + (b.wChild + b.wOther) + "명 (자녀 " + b.wChild + ")");
      setText("res-cp-med-split", num("cp-medical") > 0 ? (b.medTo === "H" ? "남편 몰아주기 유리" : "아내 몰아주기 유리") : "입력 없음");
      setText("res-cp-edu-split", num("cp-education") > 0 ? (b.eduTo === "H" ? "남편 몰아주기 유리" : "아내 몰아주기 유리") : "입력 없음");
      setText("res-cp-card-split", num("cp-card") > 0 ? (b.cardTo === "H" ? "남편 카드 사용 유리" : "아내 카드 사용 유리") : "입력 없음");
      setText("res-cp-best-each", "남편 " + Calc.formatWon(b.husbandTax) + " + 아내 " + Calc.formatWon(b.wifeTax));
      setText("res-cp-all-h", Calc.formatWon(res.allHusband.totalTax));
      setText("res-cp-all-w", Calc.formatWon(res.allWife.totalTax));
      setText("res-cp-savings", Calc.formatWon(res.maxSavings));
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindShareActions("cp", {
      title: "세금계산기 · 맞벌이 부부 절세 계산 결과",
      filename: "세금계산기-맞벌이절세.png",
      fields,
      getSummary: () => {
        const res = compute();
        const b = res.best;
        return `[세금계산기 맞벌이 절세] 남편 ${val("cp-husband")}만 · 아내 ${val("cp-wife")}만 → 최적 합산세액 ${Calc.formatWon(b.totalTax)} (최대 ${Calc.formatWon(res.maxSavings)} 절세)`;
      }
    });
    update();
  }

  // 12. 사업소득금액 · 종합소득세 계산기
  function initBusinessTax() {
    if (!$("biz-revenue")) return;
    const fields = [
      { param: "rev", id: "biz-revenue" },
      { param: "mode", id: "biz-mode" },
      { param: "rate", id: "biz-rate" },
      { param: "exp", id: "biz-actual-exp" },
      { param: "deps", id: "biz-deps" },
      { param: "yellow", id: "biz-yellow" },
      { param: "pension", id: "biz-pension" },
      { param: "auto33", id: "biz-auto33", type: "checkbox" },
      { param: "prepaid", id: "biz-prepaid" }
    ];

    function compute() {
      return Calc.calcBusinessIncomeTax({
        revenue: num("biz-revenue") * 10000,
        expenseMode: val("biz-mode", "simple"),
        expenseRate: num("biz-rate", 64.1),
        actualExpenses: num("biz-actual-exp") * 10000,
        dependents: num("biz-deps", 1),
        yellowUmbrella: num("biz-yellow") * 10000,
        pensionIrp: num("biz-pension") * 10000,
        autoPrepaid33: checked("biz-auto33"),
        prepaidTax: num("biz-prepaid") * 10000
      });
    }

    function update() {
      const mode = val("biz-mode", "simple");
      const rateField = $("biz-rate-field");
      const expField = $("biz-exp-field");
      const prepaidField = $("biz-prepaid-field");
      if (rateField) rateField.hidden = mode === "actual";
      if (expField) expField.hidden = mode !== "actual";
      if (prepaidField) prepaidField.hidden = checked("biz-auto33");

      const res = compute();
      const isRefund = res.balanceDue < 0;
      setText("res-biz-label", isRefund ? "5월 종합소득세 예상 환급액" : "5월 종합소득세 예상 납부액");
      setText("res-biz-main", (isRefund ? "+" : "") + Calc.formatWon(Math.abs(res.balanceDue)));
      setText("res-biz-sub", "사업소득금액 " + Calc.formatWon(res.businessIncome) + " · 결정세액 " + Calc.formatWon(res.totalTax));
      setText("res-biz-exp", negWon(res.recognizedExpenses));
      setText("res-biz-income", Calc.formatWon(res.businessIncome));
      setText("res-biz-yellow", negWon(res.yellowDeduction) + " (한도 " + Calc.formatWon(res.yellowLimit) + ")");
      setText("res-biz-base", Calc.formatWon(res.taxBase) + " (" + Math.round(res.marginalRate * 100) + "% 구간)");
      setText("res-biz-total", Calc.formatWon(res.totalTax));
      setText("res-biz-prepaid", negWon(res.prepaidTax));
      setText("res-biz-due", (isRefund ? "환급 " : "납부 ") + Calc.formatWon(Math.abs(res.balanceDue)));
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#biz-presets", "biz-revenue", update);
    bindPresets("#biz-rate-presets", "biz-rate", update);
    bindShareActions("biz", {
      title: "세금계산기 · 사업소득금액 · 종합소득세 계산 결과",
      filename: "세금계산기-종합소득세.png",
      fields,
      getSummary: () => {
        const res = compute();
        const tag = res.balanceDue < 0 ? "환급 " + Calc.formatWon(Math.abs(res.balanceDue)) : "추가납부 " + Calc.formatWon(res.balanceDue);
        return `[세금계산기 종합소득세] 연 매출 ${val("biz-revenue")}만 원 → 사업소득금액 ${Calc.formatWon(res.businessIncome)} / 5월 ${tag}`;
      }
    });
    update();
  }

  // 13. 상속세 계산기
  function initInheritanceTax() {
    if (!$("inh-estate")) return;
    const fields = [
      { param: "estate", id: "inh-estate" },
      { param: "debt", id: "inh-debt" },
      { param: "prior", id: "inh-prior" },
      { param: "spouse", id: "inh-spouse", type: "checkbox" },
      { param: "spouseActual", id: "inh-spouse-actual" },
      { param: "children", id: "inh-children" },
      { param: "fin", id: "inh-financial" }
    ];

    function compute() {
      return Calc.calcInheritanceTax({
        grossEstate: num("inh-estate") * 100000000,
        debt: num("inh-debt") * 100000000,
        priorGifts: num("inh-prior") * 100000000,
        hasSpouse: checked("inh-spouse"),
        spouseActual: num("inh-spouse-actual") * 100000000,
        children: num("inh-children", 2),
        netFinancial: num("inh-financial") * 100000000,
        voluntary: true
      });
    }

    function update() {
      const spField = $("inh-spouse-actual-field");
      if (spField) spField.hidden = !checked("inh-spouse");
      const res = compute();
      setText("res-inh-main", Calc.formatWon(res.finalTax));
      setText("res-inh-sub", "자진신고 3% 공제 적용 · 실효세율 " + Calc.formatPercent(res.effectiveRate, 1));
      setText("res-inh-val", Calc.formatWon(res.taxableValue));
      setText("res-inh-lump", negWon(res.lumpSumOrItem));
      setText("res-inh-spouse", negWon(res.spouseDeduction));
      setText("res-inh-fin", negWon(res.financialDeduction));
      setText("res-inh-base", Calc.formatWon(res.taxBase));
      setText("res-inh-calc", Calc.formatWon(res.calculatedTax));
      setText("res-inh-credit", negWon(res.voluntaryCredit));
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#inh-presets", "inh-estate", update);
    bindShareActions("inh", {
      title: "세금계산기 · 상속세 계산 결과",
      filename: "세금계산기-상속세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 상속세] 상속재산 ${val("inh-estate")}억 원 → 예상 납부세액 ${Calc.formatWon(res.finalTax)} (공제 합계 ${Calc.formatWon(res.totalDeduction)})`;
      }
    });
    update();
  }

  // 14. 부동산 양도소득세 계산기
  function initTransferTax() {
    if (!$("tr-buy")) return;
    const fields = [
      { param: "buy", id: "tr-buy" },
      { param: "sell", id: "tr-sell" },
      { param: "exp", id: "tr-exp" },
      { param: "hold", id: "tr-hold" },
      { param: "reside", id: "tr-reside" },
      { param: "oneHome", id: "tr-onehome", type: "checkbox" },
      { param: "heavy", id: "tr-heavy", type: "checkbox" }
    ];

    function compute() {
      return Calc.calcPropertyTransferTax({
        buyPrice: num("tr-buy") * 100000000,
        sellPrice: num("tr-sell") * 100000000,
        expenses: num("tr-exp") * 10000,
        holdYears: num("tr-hold", 5),
        resideYears: num("tr-reside", 3),
        isOneHome: checked("tr-onehome"),
        isMultiHeavy: checked("tr-heavy")
      });
    }

    function update() {
      const res = compute();
      setText("res-tr-main", Calc.formatWon(res.totalTax));
      setText("res-tr-sub", "양도차익 " + Calc.formatWon(res.totalGain) + " · 실효세율 " + Calc.formatPercent(res.effectiveRate, 1));
      setText("res-tr-gain", Calc.formatWon(res.totalGain));
      setText("res-tr-exempt", negWon(res.exemptGain));
      setText("res-tr-lt", negWon(res.ltDeduction) + " (" + Math.round(res.ltDeductionRate * 100) + "%)");
      setText("res-tr-basic", negWon(res.basicDeduction));
      setText("res-tr-base", Calc.formatWon(res.taxBase));
      setText("res-tr-tax", Calc.formatWon(res.transferTax));
      setText("res-tr-local", Calc.formatWon(res.localTax));
      setNote("res-tr-note", res.note);
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#tr-presets", "tr-sell", update);
    bindShareActions("tr", {
      title: "세금계산기 · 부동산 양도소득세 계산 결과",
      filename: "세금계산기-부동산양도세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 부동산 양도세] 취득 ${val("tr-buy")}억 → 양도 ${val("tr-sell")}억 → 총 양도세 ${Calc.formatWon(res.totalTax)}`;
      }
    });
    update();
  }

  // 15. 부가가치세(VAT) 계산기
  function initVat() {
    if (!$("vat-mode")) return;
    const fields = [
      { param: "mode", id: "vat-mode" },
      { param: "amount", id: "vat-amount" },
      { param: "inc", id: "vat-inclusive", type: "checkbox" },
      { param: "sales", id: "vat-sales" },
      { param: "purchases", id: "vat-purchases" },
      { param: "card", id: "vat-card" },
      { param: "vrate", id: "vat-value-rate" }
    ];

    function compute() {
      return Calc.calcVat({
        mode: val("vat-mode", "simple"),
        amount: num("vat-amount") * 10000,
        isInclusive: checked("vat-inclusive"),
        sales: num("vat-sales") * 10000,
        purchases: num("vat-purchases") * 10000,
        cardSales: num("vat-card") * 10000,
        vatValueRate: num("vat-value-rate", 30) / 100
      });
    }

    function update() {
      const mode = val("vat-mode", "simple");
      const simpleBox = $("vat-simple-box");
      const bizBox = $("vat-biz-box");
      const vrateBox = $("vat-vrate-field");
      if (simpleBox) simpleBox.hidden = mode !== "simple";
      if (bizBox) bizBox.hidden = mode === "simple";
      if (vrateBox) vrateBox.hidden = mode !== "simplified";

      const res = compute();
      if (mode === "simple") {
        setText("res-vat-label", "부가가치세 (10%)");
        setText("res-vat-main", Calc.formatWon(res.vat));
        setText("res-vat-sub", "공급가액 " + Calc.formatWon(res.supply) + " · 합계금액 " + Calc.formatWon(res.total));
        setText("res-vat-row1-k", "공급가액");
        setText("res-vat-row1-v", Calc.formatWon(res.supply));
        setText("res-vat-row2-k", "부가가치세 (10%)");
        setText("res-vat-row2-v", Calc.formatWon(res.vat));
        setText("res-vat-row3-k", "신용카드 발행공제");
        setText("res-vat-row3-v", "-");
        setText("res-vat-row4-k", "합계금액 (공급대가)");
        setText("res-vat-row4-v", Calc.formatWon(res.total));
        setNote("res-vat-note", "");
      } else {
        const isRefund = res.payableVat < 0;
        setText("res-vat-label", isRefund ? "부가가치세 예상 환급액" : "예상 납부 부가가치세");
        setText("res-vat-main", (isRefund ? "+" : "") + Calc.formatWon(Math.abs(res.payableVat)));
        setText("res-vat-sub", mode === "simplified" ? "간이과세자 (부가가치율 " + Math.round(res.vatValueRate * 100) + "%)" : "일반과세자 기준");
        setText("res-vat-row1-k", "매출세액");
        setText("res-vat-row1-v", Calc.formatWon(res.salesVat));
        setText("res-vat-row2-k", mode === "simplified" ? "매입세액공제 (0.5%)" : "매입세액 (10%)");
        setText("res-vat-row2-v", negWon(res.purchaseVat));
        setText("res-vat-row3-k", "신용카드 발행공제 (1.3%)");
        setText("res-vat-row3-v", negWon(res.cardCredit));
        setText("res-vat-row4-k", isRefund ? "최종 예상 환급액" : "최종 예상 납부세액");
        setText("res-vat-row4-v", Calc.formatWon(Math.abs(res.payableVat)));
        setNote("res-vat-note", res.exempt ? "간이과세자 연 공급대가 4,800만 원 미만으로 납부의무가 면제됩니다(신고는 필수)." : "");
      }
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#vat-presets", "vat-amount", update);
    bindShareActions("vat", {
      title: "세금계산기 · 부가가치세(VAT) 계산 결과",
      filename: "세금계산기-부가가치세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return res.mode === "simple"
          ? `[세금계산기 부가세] 공급가액 ${Calc.formatWon(res.supply)} + 부가세 ${Calc.formatWon(res.vat)} = 합계 ${Calc.formatWon(res.total)}`
          : `[세금계산기 부가세] 예상 납부세액 ${Calc.formatWon(res.payableVat)}`;
      }
    });
    update();
  }

  // 16. 금융소득종합과세 계산기
  function initFinancialTax() {
    if (!$("fin-interest")) return;
    const fields = [
      { param: "int", id: "fin-interest" },
      { param: "div", id: "fin-dividend" },
      { param: "other", id: "fin-other" }
    ];

    function compute() {
      return Calc.calcFinancialTax({
        interest: num("fin-interest") * 10000,
        dividend: num("fin-dividend") * 10000,
        otherIncome: num("fin-other") * 10000
      });
    }

    function update() {
      const res = compute();
      setText("res-fin-main", Calc.formatWon(res.additionalTotal));
      setText(
        "res-fin-sub",
        res.isComprehensive
          ? "금융소득 " + Calc.formatWon(res.totalFinancial) + " → 종합과세 대상 (기납부 15.4% 외 추가분)"
          : "연 2,000만 원 이하 분리과세 종결 (추가 납부 0원)"
      );
      setText("res-fin-total", Calc.formatWon(res.totalFinancial));
      setText("res-fin-excess", Calc.formatWon(res.excessFinancial));
      setText("res-fin-withheld", Calc.formatWon(res.withheldTotal));
      setText("res-fin-add-nat", Calc.formatWon(res.additionalNational));
      setText("res-fin-add-loc", Calc.formatWon(res.additionalLocal));
      setText("res-fin-all-tax", Calc.formatWon(res.totalFinancialTax));
      setText("res-fin-after", Calc.formatWon(res.afterTaxFinancial));
      setNote(
        "res-fin-note",
        res.healthInsuranceWarning
          ? "이자·배당 합계가 연 2,000만 원을 초과해 5월 종합소득세 신고 대상이며, 건강보험 피부양자 탈락 및 소득월액보험료 부과 대상이 될 수 있습니다."
          : ""
      );
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#fin-presets", "fin-dividend", update);
    bindShareActions("fin", {
      title: "세금계산기 · 금융소득종합과세 계산 결과",
      filename: "세금계산기-금융소득종합과세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 금융소득종합과세] 금융소득 ${Calc.formatWon(res.totalFinancial)} → 원천징수 ${Calc.formatWon(res.withheldTotal)} + 추가세액 ${Calc.formatWon(res.additionalTotal)}`;
      }
    });
    update();
  }

  // 17. 자동차세 & 자동차 취득세 계산기
  function initCarTax() {
    if (!$("car-type")) return;
    const fields = [
      { param: "type", id: "car-type" },
      { param: "cc", id: "car-cc" },
      { param: "age", id: "car-age" },
      { param: "prepay", id: "car-prepay" },
      { param: "price", id: "car-price" }
    ];

    function compute() {
      return Calc.calcCarTax({
        carType: val("car-type", "passenger"),
        cc: num("car-cc", 1998),
        carAge: num("car-age", 1),
        prepayMonth: num("car-prepay", 1),
        carPrice: num("car-price", 3500) * 10000
      });
    }

    function update() {
      const t = val("car-type", "passenger");
      const ccField = $("car-cc-field");
      if (ccField) ccField.hidden = t === "ev" || t === "van7";
      const res = compute();
      setText("res-car-main", Calc.formatWon(res.finalCarTax));
      setText(
        "res-car-sub",
        res.prepayDiscount > 0
          ? "연납 할인 " + Calc.formatWon(res.prepayDiscount) + " 적용 · 차량 취득세 " + Calc.formatWon(res.finalAcqTax)
          : "연간 자동차세 (교육세 포함) · 차량 취득세 " + Calc.formatWon(res.finalAcqTax)
      );
      setText("res-car-base", Calc.formatWon(res.discountedBase) + (res.ageDiscountRate > 0 ? " (차령 -" + Math.round(res.ageDiscountRate * 100) + "%)" : ""));
      setText("res-car-edu", Calc.formatWon(res.localEduTax));
      setText("res-car-annual", Calc.formatWon(res.annualCarTax));
      setText("res-car-prepay", negWon(res.prepayDiscount));
      setText("res-car-acq-raw", Calc.formatWon(res.rawAcqTax) + " (" + Math.round(res.acqRate * 100) + "%)");
      setText("res-car-acq-relief", negWon(res.acqRelief));
      setText("res-car-acq-final", Calc.formatWon(res.finalAcqTax));
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#car-cc-presets", "car-cc", update);
    bindShareActions("car", {
      title: "세금계산기 · 자동차세 · 취득세 계산 결과",
      filename: "세금계산기-자동차세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 자동차세] 연간 자동차세 ${Calc.formatWon(res.finalCarTax)} / 차량 취득세 ${Calc.formatWon(res.finalAcqTax)}`;
      }
    });
    update();
  }

  // 18. 기타소득세(8.8%) 계산기
  function initOtherIncome() {
    if (!$("oth-gross")) return;
    const fields = [
      { param: "gross", id: "oth-gross" },
      { param: "rate", id: "oth-exp-rate" }
    ];

    function compute() {
      return Calc.calcOtherIncomeTax({
        gross: num("oth-gross") * 10000,
        expenseRatePct: num("oth-exp-rate", 60)
      });
    }

    function update() {
      const res = compute();
      setText("res-oth-main", Calc.formatWon(res.net));
      setText("res-oth-sub", "원천징수 " + Calc.formatWon(res.totalTax) + " (실효세율 " + Calc.formatPercent(res.effectiveRate, 1) + ")");
      setText("res-oth-gross", Calc.formatWon(res.gross));
      setText("res-oth-exp", negWon(res.expenseAmount) + " (" + Math.round(res.expenseRate * 100) + "%)");
      setText("res-oth-income", Calc.formatWon(res.otherIncome));
      setText("res-oth-inc-tax", Calc.formatWon(res.incomeTax));
      setText("res-oth-loc-tax", Calc.formatWon(res.localTax));
      setText("res-oth-total-tax", negWon(res.totalTax));
      setNote(
        "res-oth-note",
        res.taxFreeMin
          ? "건별 기타소득금액이 5만 원 이하(과세최저한)로 세금이 0원입니다."
          : res.separateTaxEligible
          ? "연간 기타소득금액 합계가 300만 원 이하라면 5월 종합소득세에 합산하지 않고 분리과세를 선택할 수 있습니다."
          : "연간 기타소득금액이 300만 원을 초과해 다음 해 5월 종합소득세 합산 신고 대상입니다."
      );
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#oth-presets", "oth-gross", update);
    bindShareActions("oth", {
      title: "세금계산기 · 기타소득세(8.8%) 계산 결과",
      filename: "세금계산기-기타소득세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 기타소득세] 지급액 ${Calc.formatWon(res.gross)} → 세금 ${Calc.formatWon(res.totalTax)} / 실수령 ${Calc.formatWon(res.net)}`;
      }
    });
    update();
  }

  // 19. 보유세(재산세 · 종부세) 계산기
  function initHoldingTax() {
    if (!$("hold-price")) return;
    const fields = [
      { param: "price", id: "hold-price" },
      { param: "oneHome", id: "hold-onehome", type: "checkbox" },
      { param: "threePlus", id: "hold-threeplus", type: "checkbox" },
      { param: "age", id: "hold-age" },
      { param: "years", id: "hold-years" }
    ];

    function compute() {
      return Calc.calcHoldingTax({
        officialPrice: num("hold-price") * 100000000,
        isOneHome: checked("hold-onehome"),
        isThreePlus: checked("hold-threeplus"),
        ownerAge: num("hold-age", 45),
        holdYears: num("hold-years", 5)
      });
    }

    function update() {
      const threeField = $("hold-three-field");
      if (threeField) threeField.hidden = checked("hold-onehome");
      const res = compute();
      setText("res-hold-main", Calc.formatWon(res.totalHoldingTax));
      setText("res-hold-sub", "재산세 등 " + Calc.formatWon(res.totalPropertyTax) + " + 종부세 등 " + Calc.formatWon(res.totalJongbuTax));
      setText("res-hold-prop-base", Calc.formatWon(res.propBase) + " (공정시장 " + Math.round(res.propRatio * 100) + "%)");
      setText("res-hold-prop", Calc.formatWon(res.propertyTax));
      setText("res-hold-urban", Calc.formatWon(res.urbanTax + res.propEduTax));
      setText("res-hold-jb-base", Calc.formatWon(res.jongbuBase) + " (공제 " + Math.round(res.jongbuDeduction / 100000000) + "억)");
      setText("res-hold-jb-credit", res.creditRate > 0 ? Math.round(res.creditRate * 100) + "% 적용" : "해당 없음");
      setText("res-hold-jb", Calc.formatWon(res.totalJongbuTax));
      setText("res-hold-total", Calc.formatWon(res.totalHoldingTax));
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#hold-presets", "hold-price", update);
    bindShareActions("hold", {
      title: "세금계산기 · 보유세(재산세·종부세) 계산 결과",
      filename: "세금계산기-보유세.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 보유세] 공시가격 ${val("hold-price")}억 원 → 연간 총 보유세 ${Calc.formatWon(res.totalHoldingTax)} (재산세 ${Calc.formatWon(res.totalPropertyTax)} + 종부세 ${Calc.formatWon(res.totalJongbuTax)})`;
      }
    });
    update();
  }

  // 20. 근로장려금 · 자녀장려금 계산기
  function initEitc() {
    if (!$("eitc-household")) return;
    const fields = [
      { param: "hh", id: "eitc-household" },
      { param: "inc", id: "eitc-income" },
      { param: "children", id: "eitc-children" },
      { param: "assets", id: "eitc-assets" }
    ];

    function compute() {
      return Calc.calcEitc({
        household: val("eitc-household", "single"),
        income: num("eitc-income") * 10000,
        children: num("eitc-children", 0),
        assets: num("eitc-assets", 1) * 100000000
      });
    }

    function update() {
      const hh = val("eitc-household", "single");
      const childField = $("eitc-child-field");
      if (childField) childField.hidden = hh === "single";
      const res = compute();
      setText("res-eitc-main", Calc.formatWon(res.totalBenefit));
      setText("res-eitc-sub", "근로장려금 " + Calc.formatWon(res.eitc) + " + 자녀장려금 " + Calc.formatWon(res.ctc));
      setText("res-eitc-limit", Calc.formatWon(res.maxIncomeLimit) + " 미만");
      setText("res-eitc-work", Calc.formatWon(res.eitc));
      setText("res-eitc-child", Calc.formatWon(res.ctc));
      setText("res-eitc-asset", res.assetEligible ? (res.assetHalfPenalty ? "충족 (50% 감액 구간)" : "충족 (100% 지급)") : "초과 (지급 제외)");
      setNote("res-eitc-note", res.statusNote);
    }

    restoreParams(fields);
    bindInputs(fields.map((f) => f.id), update);
    bindPresets("#eitc-presets", "eitc-income", update);
    bindShareActions("eitc", {
      title: "세금계산기 · 근로·자녀장려금 계산 결과",
      filename: "세금계산기-근로장려금.png",
      fields,
      getSummary: () => {
        const res = compute();
        return `[세금계산기 근로·자녀장려금] 총 예상 수령액 ${Calc.formatWon(res.totalBenefit)} (근로 ${Calc.formatWon(res.eitc)} + 자녀 ${Calc.formatWon(res.ctc)})`;
      }
    });
    update();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initYearEndTax();
    initCoupleTax();
    initBusinessTax();
    initInheritanceTax();
    initTransferTax();
    initVat();
    initFinancialTax();
    initCarTax();
    initOtherIncome();
    initHoldingTax();
    initEitc();
  });
})();
