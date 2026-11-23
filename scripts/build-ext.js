"use strict";

module.exports = function buildExtendedPages(ctx) {
  const {
    DATA,
    Calc,
    negWon,
    writePage,
    renderLayout,
    renderAdSlot,
    renderTaxTipsSection,
    renderAffiliateCard,
    renderPartnerCard,
    renderOfficialLinks,
    renderFaqSection,
    renderCompareTable,
    renderRelatedCalcs,
    renderResultActions,
    renderPrevNext,
    formatKoreanManwonLabel
  } = ctx;

  /* 10. 연말정산 환급액 계산기 */
  function buildYearEndTaxPages() {
    function renderWidget(defaultGrossManwon) {
      const res = Calc.calcYearEndTax({
        gross: defaultGrossManwon * 10000,
        dependents: 1,
        creditCard: 1200 * 10000,
        debitCash: 600 * 10000,
        pensionIrp: 300 * 10000
      });
      const isRefund = res.refundAmount >= 0;
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">급여 및 공제 입력</h2>
            <div class="field">
              <label for="ye-gross">연간 총급여 (비과세 제외)</label>
              <div class="input-wrap"><input id="ye-gross" type="number" min="0" step="100" value="${defaultGrossManwon}" /><span class="input-unit">만 원</span></div>
              <div class="preset-row" id="ye-presets">
                <button type="button" class="chip-btn" data-preset="3500">3,500만</button>
                <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
                <button type="button" class="chip-btn" data-preset="7000">7,000만</button>
                <button type="button" class="chip-btn" data-preset="10000">1억</button>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="ye-deps">인적공제 (본인 포함)</label>
                <div class="input-wrap"><input id="ye-deps" type="number" min="1" max="11" step="1" value="1" /><span class="input-unit">명</span></div>
              </div>
              <div class="field">
                <label for="ye-children">자녀세액공제 대상</label>
                <div class="input-wrap"><input id="ye-children" type="number" min="0" max="5" step="1" value="0" /><span class="input-unit">명</span></div>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="ye-credit">신용카드 사용액</label>
                <div class="input-wrap"><input id="ye-credit" type="number" min="0" step="100" value="1200" /><span class="input-unit">만 원</span></div>
              </div>
              <div class="field">
                <label for="ye-debit">체크카드·현금영수증</label>
                <div class="input-wrap"><input id="ye-debit" type="number" min="0" step="100" value="600" /><span class="input-unit">만 원</span></div>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="ye-pension">연금저축 + IRP 납입액</label>
                <div class="input-wrap"><input id="ye-pension" type="number" min="0" max="900" step="50" value="300" /><span class="input-unit">만 원</span></div>
              </div>
              <div class="field">
                <label for="ye-rent">연간 월세 지출액</label>
                <div class="input-wrap"><input id="ye-rent" type="number" min="0" step="60" value="0" /><span class="input-unit">만 원</span></div>
              </div>
            </div>
            <details class="calc-details">
              <summary>기납부세액 · 의료비 · 교육비 · 기부금 추가 입력</summary>
              <div class="field">
                <label for="ye-prepaid">기납부세액 (비워두면 간이세액표 100% 자동 추정)</label>
                <div class="input-wrap"><input id="ye-prepaid" type="number" min="0" step="10" value="" placeholder="자동 추정" /><span class="input-unit">만 원</span></div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="ye-medical">의료비 지출액</label>
                  <div class="input-wrap"><input id="ye-medical" type="number" min="0" step="50" value="0" /><span class="input-unit">만 원</span></div>
                </div>
                <div class="field">
                  <label for="ye-education">교육비 지출액</label>
                  <div class="input-wrap"><input id="ye-education" type="number" min="0" step="50" value="0" /><span class="input-unit">만 원</span></div>
                </div>
              </div>
              <div class="field">
                <label for="ye-donation">기부금 (정치·고향사랑 외 일반 지정기부)</label>
                <div class="input-wrap"><input id="ye-donation" type="number" min="0" step="10" value="0" /><span class="input-unit">만 원</span></div>
              </div>
            </details>
            <p class="calc-note">2026년 종합소득세 8단계 세율(6~45%), 자녀세액공제(9세 이상·2016년 이전 출생, 25·30·40만 원), 월세 공제(총급여 8,000만 이하 연 1,000만 한도), 특별공제 vs 표준세액공제(13만 원) 유리 선택을 자동 반영합니다.</p>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">연말정산 환급액 산출</h2>
            <div class="result-summary">
              <div class="result-label" id="res-ye-label">${isRefund ? "예상 연말정산 환급액" : "예상 추가 납부세액"}</div>
              <div class="result-main num" id="res-ye-main">${(isRefund ? "+" : "-") + Calc.formatWon(Math.abs(res.refundAmount))}</div>
              <div class="result-sub num" id="res-ye-sub">결정세액 ${Calc.formatWon(res.determinedTotalTax)} · 기납부세액 ${Calc.formatWon(res.prepaidTax)}</div>
              <p class="result-note" id="res-ye-note"></p>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>근로소득금액</th><td id="res-ye-earned">${Calc.formatWon(res.earnedIncome)}</td></tr>
                <tr><th>신용·체크카드 소득공제</th><td id="res-ye-card">${negWon(res.cardDeduction)}</td></tr>
                <tr><th>종합소득 과세표준</th><td id="res-ye-base">${Calc.formatWon(res.taxBase)} (${Math.round(res.marginalRate * 100)}% 구간)</td></tr>
                <tr><th>산출세액</th><td id="res-ye-calc">${Calc.formatWon(res.calculatedTax)}</td></tr>
                <tr><th>세액공제 합계</th><td id="res-ye-credit">${negWon(res.totalTaxCredit)}</td></tr>
                <tr><th>최종 결정세액 (지방세 포함)</th><td id="res-ye-det">${Calc.formatWon(res.determinedTotalTax)}</td></tr>
                <tr class="total-row"><th>기납부세액 (1년 원천징수)</th><td id="res-ye-prepaid">${Calc.formatWon(res.prepaidTax)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("ye")}
          </div>
        </section>
      `;
    }

    const faqs = [
      {
        q: "연말정산 환급액은 어떻게 결정되나요?",
        a: "1년 동안 월급에서 미리 뗀 세금(기납부세액)에서 각종 소득·세액공제를 반영해 확정한 최종 결정세액을 뺀 금액입니다. 기납부세액이 더 크면 환급, 적으면 추가 납부합니다."
      },
      {
        q: "2026년 연말정산에서 크게 바뀐 공제는 무엇인가요?",
        a: "자녀세액공제가 첫째 25만, 둘째 30만, 셋째 이상 40만 원으로 확대되었고, 월세 세액공제 대상은 총급여 8,000만 원 이하·연 1,000만 원 한도로 적용됩니다."
      },
      {
        q: "연말정산 결과가 추가 납부로 나오면 어떻게 줄이나요?",
        a: "12월 31일 전까지 연금저축·IRP 납입(최대 900만 원), 고향사랑기부금 10만 원, 체크카드·현금영수증 비중 확대, 맞벌이 부양가족 최적 배분을 활용하면 세액을 크게 줄일 수 있습니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "맞벌이 절세 계산기", desc: "부부 부양가족·의료비 최적 몰아주기 조합 찾기", href: "/couple-tax/" },
      { title: "연봉 실수령액 계산기", desc: "4대보험과 매달 떼는 근로소득세 확인", href: "/salary/" },
      { title: "전월세 전환율", desc: "월세 세액공제와 주거비 비교", href: "/jeonse/" }
    ]);

    writePage(
      "/year-end-tax/",
      renderLayout({
        routePath: "/year-end-tax/",
        title: `${DATA.year} 연말정산 환급액 계산기 (카드·연금저축·월세·자녀공제)`,
        description: "총급여, 부양가족, 신용·체크카드, 연금저축·IRP, 월세·의료비·교육비 공제를 반영해 2026년 연말정산 예상 환급액을 계산합니다.",
        activeNav: "year-end-tax",
        priority: "0.95",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "연말정산 계산기", href: "/year-end-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 연말정산 환급액 계산기</h1>
              <span class="meta-tag">2026 소득세법 기준</span>
            </div>
            <p class="subtitle">연봉과 카드·연금저축·월세·부양가족 공제를 입력해 예상 환급액(13월의 월급)을 미리 계산합니다.</p>
          </header>
          ${renderWidget(5000)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("yearEndTax")}
          ${renderAffiliateCard("yearEndTax")}
          ${renderOfficialLinks("yearEndTax")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  /* 11. 맞벌이 부부 연말정산 절세 계산기 */
  function buildCoupleTaxPage() {
    const res = Calc.calcCoupleTax({
      husbandGross: 7000 * 10000,
      wifeGross: 4500 * 10000,
      children: 1,
      otherDeps: 1,
      sharedMedical: 300 * 10000,
      sharedEducation: 200 * 10000,
      sharedCard: 1500 * 10000
    });
    const b = res.best;

    const faqs = [
      {
        q: "맞벌이 부부는 무조건 연봉 높은 쪽에 부양가족을 몰아주는 게 유리한가요?",
        a: "부부 연봉 차이가 크면 고소득자에게 몰아주는 것이 유리하지만, 연봉이 비슷하거나 공제 항목이 많으면 두 사람의 과세표준 누진구간(15%·24%·35%)을 함께 낮추도록 나누어 배정하는 편이 합산 세금이 더 적게 나오는 경우가 많습니다."
      },
      {
        q: "의료비는 부양가족 공제를 받지 않은 배우자가 공제받아도 되나요?",
        a: "배우자 본인의 의료비는 소득 요건과 무관하게 지출한 배우자가 공제받을 수 있습니다. 다만 자녀·부모님 등 부양가족의 의료비·교육비·보험료는 해당 가족의 기본공제를 받는 배우자만 공제 가능합니다."
      },
      {
        q: "자녀 교육비와 보험료도 따로 나눠서 공제받을 수 있나요?",
        a: "아니요. 자녀의 교육비·보장성 보험료·기부금은 해당 자녀의 기본공제(150만 원)를 받는 배우자만 공제할 수 있습니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "연말정산 환급액 계산기", desc: "개인별 상세 카드·연금·월세 공제 시뮬레이션", href: "/year-end-tax/" },
      { title: "연봉 실수령액 계산기", desc: "부부 각자의 월 실수령액과 4대보험 확인", href: "/salary/" },
      { title: "증여세 계산기", desc: "배우자 10년 6억 원 증여 공제 시뮬레이션", href: "/gift-tax/" }
    ]);

    writePage(
      "/couple-tax/",
      renderLayout({
        routePath: "/couple-tax/",
        title: `${DATA.year} 맞벌이 부부 연말정산 절세 계산기 (최적 몰아주기 자동 탐색)`,
        description: "부부 각자의 연봉과 자녀·부모님 부양가족, 의료비·교육비·카드 지출을 입력하면 부부 합산 세금이 가장 적은 최적 배분 조합을 자동 계산합니다.",
        activeNav: "couple-tax",
        priority: "0.95",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "맞벌이 절세 계산기", href: "/couple-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 맞벌이 부부 연말정산 절세 계산기</h1>
              <span class="meta-tag">최적 조합 자동 탐색</span>
            </div>
            <p class="subtitle">부양가족과 의료비·교육비·카드를 누구에게 몰아줘야 부부 합산 세금이 가장 적은지 세법상 귀속 요건을 지켜 자동 비교합니다.</p>
          </header>
          <section class="calc-grid">
            <div class="sheet">
              <h2 class="sheet-title">부부 연봉 및 공유 공제 입력</h2>
              <div class="field-row">
                <div class="field">
                  <label for="cp-husband">남편 총급여</label>
                  <div class="input-wrap"><input id="cp-husband" type="number" min="0" step="100" value="7000" /><span class="input-unit">만 원</span></div>
                </div>
                <div class="field">
                  <label for="cp-wife">아내 총급여</label>
                  <div class="input-wrap"><input id="cp-wife" type="number" min="0" step="100" value="4500" /><span class="input-unit">만 원</span></div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="cp-children">자녀 수 (세액공제 대상)</label>
                  <div class="input-wrap"><input id="cp-children" type="number" min="0" max="5" step="1" value="1" /><span class="input-unit">명</span></div>
                </div>
                <div class="field">
                  <label for="cp-other-deps">기타 부양가족 (부모님 등)</label>
                  <div class="input-wrap"><input id="cp-other-deps" type="number" min="0" max="6" step="1" value="1" /><span class="input-unit">명</span></div>
                </div>
              </div>
              <div class="field-row">
                <div class="field">
                  <label for="cp-medical">부부 본인 의료비 합계 (몰아주기 가능)</label>
                  <div class="input-wrap"><input id="cp-medical" type="number" min="0" step="50" value="300" /><span class="input-unit">만 원</span></div>
                </div>
                <div class="field">
                  <label for="cp-education">자녀·부양가족 교육비 (기본공제자 귀속)</label>
                  <div class="input-wrap"><input id="cp-education" type="number" min="0" step="50" value="200" /><span class="input-unit">만 원</span></div>
                </div>
              </div>
              <div class="field">
                <label for="cp-card">생활비 카드·체크카드 지출 (한쪽 집중 가능액)</label>
                <div class="input-wrap"><input id="cp-card" type="number" min="0" step="100" value="1500" /><span class="input-unit">만 원</span></div>
              </div>
              <p class="calc-note">부양가족 교육비는 기본공제를 받는 배우자에게만 귀속되는 세법 규정을 준수하며, 모든 합법 조합 중 합산 결정세액이 최소인 조합을 찾아줍니다.</p>
            </div>
            <div class="sheet receipt">
              <h2 class="sheet-title">맞벌이 최적 절세 조합</h2>
              <div class="result-summary">
                <div class="result-label">최적 배분 시 부부 합산 결정세액</div>
                <div class="result-main num" id="res-cp-main">${Calc.formatWon(b.totalTax)}</div>
                <div class="result-sub num" id="res-cp-sub">최적 배분 시 최악 조합 대비 연 ${Calc.formatWon(res.maxSavings)} 절세!</div>
              </div>
              <table class="breakdown-table">
                <tbody>
                  <tr><th>추천 부양가족 배분</th><td id="res-cp-dep-split">남편 ${b.hChild + b.hOther}명 · 아내 ${b.wChild + b.wOther}명</td></tr>
                  <tr><th>추천 의료비 몰아주기</th><td id="res-cp-med-split">${b.medTo === "H" ? "남편 몰아주기 유리" : "아내 몰아주기 유리"}</td></tr>
                  <tr><th>추천 교육비 몰아주기</th><td id="res-cp-edu-split">${b.eduTo === "H" ? "남편 몰아주기 유리" : "아내 몰아주기 유리"}</td></tr>
                  <tr><th>추천 생활비 카드</th><td id="res-cp-card-split">${b.cardTo === "H" ? "남편 카드 사용 유리" : "아내 카드 사용 유리"}</td></tr>
                  <tr><th>최적 조합 각자 세액</th><td id="res-cp-best-each">남편 ${Calc.formatWon(b.husbandTax)} + 아내 ${Calc.formatWon(b.wifeTax)}</td></tr>
                  <tr><th>남편에게 전부 몰아줄 때</th><td id="res-cp-all-h">${Calc.formatWon(res.allHusband.totalTax)}</td></tr>
                  <tr><th>아내에게 전부 몰아줄 때</th><td id="res-cp-all-w">${Calc.formatWon(res.allWife.totalTax)}</td></tr>
                  <tr class="total-row"><th>최대 절세 효과</th><td id="res-cp-savings">${Calc.formatWon(res.maxSavings)}</td></tr>
                </tbody>
              </table>
              ${renderResultActions("cp")}
            </div>
          </section>
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("coupleTax")}
          ${renderAffiliateCard("coupleTax")}
          ${renderOfficialLinks("coupleTax")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  /* 12. 사업소득금액 · 종합소득세 계산기 */
  function buildBusinessTaxPages() {
    const revPresets = [3000, 5000, 7000, 10000, 15000, 20000];

    function renderWidget(defaultRevManwon) {
      const res = Calc.calcBusinessIncomeTax({
        revenue: defaultRevManwon * 10000,
        expenseMode: "simple",
        expenseRate: 64.1,
        dependents: 1,
        yellowUmbrella: 300 * 10000,
        pensionIrp: 0,
        autoPrepaid33: true
      });
      const isRefund = res.balanceDue < 0;
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">매출 · 경비 · 공제 입력</h2>
            <div class="field">
              <label for="biz-revenue">연간 총수입금액 (연 매출)</label>
              <div class="input-wrap"><input id="biz-revenue" type="number" min="0" step="100" value="${defaultRevManwon}" /><span class="input-unit">만 원</span></div>
              <div class="preset-row" id="biz-presets">
                <button type="button" class="chip-btn" data-preset="3000">3,000만</button>
                <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
                <button type="button" class="chip-btn" data-preset="10000">1억</button>
                <button type="button" class="chip-btn" data-preset="20000">2억</button>
              </div>
            </div>
            <div class="field">
              <label for="biz-mode">필요경비 계산 방식</label>
              <select id="biz-mode">
                <option value="simple" selected>추계 신고 (단순경비율 적용)</option>
                <option value="actual">장부 기장 (실제 필요경비 입력)</option>
              </select>
            </div>
            <div class="field" id="biz-rate-field">
              <label for="biz-rate">업종 단순경비율 (%)</label>
              <div class="input-wrap"><input id="biz-rate" type="number" min="0" max="95" step="0.1" value="64.1" /><span class="input-unit">%</span></div>
              <div class="preset-row" id="biz-rate-presets">
                <button type="button" class="chip-btn" data-preset="64.1">프리랜서·IT 64.1%</button>
                <button type="button" class="chip-btn" data-preset="61.7">강사·자문 61.7%</button>
                <button type="button" class="chip-btn" data-preset="86.0">도소매 86.0%</button>
                <button type="button" class="chip-btn" data-preset="89.7">음식점 89.7%</button>
              </div>
            </div>
            <div class="field" id="biz-exp-field" hidden>
              <label for="biz-actual-exp">연간 실제 필요경비</label>
              <div class="input-wrap"><input id="biz-actual-exp" type="number" min="0" step="100" value="3000" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="biz-deps">인적공제 (본인 포함)</label>
                <div class="input-wrap"><input id="biz-deps" type="number" min="1" max="10" step="1" value="1" /><span class="input-unit">명</span></div>
              </div>
              <div class="field">
                <label for="biz-yellow">노란우산공제 납입액</label>
                <div class="input-wrap"><input id="biz-yellow" type="number" min="0" max="600" step="50" value="300" /><span class="input-unit">만 원</span></div>
              </div>
            </div>
            <div class="field">
              <label for="biz-pension">연금저축 + IRP 납입액</label>
              <div class="input-wrap"><input id="biz-pension" type="number" min="0" max="900" step="50" value="0" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field">
              <label class="checkbox-row"><input id="biz-auto33" type="checkbox" checked /><span>기납부세액 3.3% 자동 반영 (프리랜서 원천징수 기준)</span></label>
            </div>
            <div class="field" id="biz-prepaid-field" hidden>
              <label for="biz-prepaid">기납부세액 (중간예납 등 직접 입력)</label>
              <div class="input-wrap"><input id="biz-prepaid" type="number" min="0" step="10" value="0" /><span class="input-unit">만 원</span></div>
            </div>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">사업소득금액 · 5월 종소세 산출</h2>
            <div class="result-summary">
              <div class="result-label" id="res-biz-label">${isRefund ? "5월 종합소득세 예상 환급액" : "5월 종합소득세 예상 납부액"}</div>
              <div class="result-main num" id="res-biz-main">${(isRefund ? "+" : "") + Calc.formatWon(Math.abs(res.balanceDue))}</div>
              <div class="result-sub num" id="res-biz-sub">사업소득금액 ${Calc.formatWon(res.businessIncome)} · 결정세액 ${Calc.formatWon(res.totalTax)}</div>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>인정 필요경비</th><td id="res-biz-exp">${negWon(res.recognizedExpenses)}</td></tr>
                <tr><th>사업소득금액 (매출 - 경비)</th><td id="res-biz-income">${Calc.formatWon(res.businessIncome)}</td></tr>
                <tr><th>노란우산 소득공제</th><td id="res-biz-yellow">${negWon(res.yellowDeduction)} (한도 ${Calc.formatWon(res.yellowLimit)})</td></tr>
                <tr><th>종합소득 과세표준</th><td id="res-biz-base">${Calc.formatWon(res.taxBase)} (${Math.round(res.marginalRate * 100)}% 구간)</td></tr>
                <tr><th>결정세액 합계 (지방세 포함)</th><td id="res-biz-total">${Calc.formatWon(res.totalTax)}</td></tr>
                <tr><th>기납부세액 (3.3% 등)</th><td id="res-biz-prepaid">${negWon(res.prepaidTax)}</td></tr>
                <tr class="total-row"><th>최종 5월 정산액</th><td id="res-biz-due">${(isRefund ? "환급 " : "납부 ") + Calc.formatWon(Math.abs(res.balanceDue))}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("biz")}
          </div>
        </section>
      `;
    }

    const matrixLinks = (current) => `
      <section class="section-block">
        <h2>연 매출별 사업소득금액 · 종합소득세</h2>
        <div class="link-matrix">
          ${revPresets.map((m) => `<a class="matrix-pill ${current === m ? "current" : ""}" href="/business-tax/${m}-manwon/">매출 ${formatKoreanManwonLabel(m)}</a>`).join("")}
        </div>
      </section>
    `;

    const faqs = [
      {
        q: "사업소득금액과 연 매출(총수입금액)은 어떻게 다른가요?",
        a: "연 매출에서 필요경비를 뺀 순이익이 '사업소득금액'입니다. 종합소득세 세율, 노란우산공제 한도, 건강보험 피부양자 판정은 모두 매출이 아닌 사업소득금액을 기준으로 합니다."
      },
      {
        q: "프리랜서 3.3%를 떼고 받았는데 5월에 환급받나요, 더 내나요?",
        a: "결정세액이 1년간 미리 낸 3.3%(기납부세액)보다 적으면 환급, 많으면 차액을 추가 납부합니다. 연 수입이 3,000만~4,000만 원 이하이고 단순경비율 대상이면 환급되는 경우가 많습니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "프리랜서 3.3% 계산기", desc: "건별 계약금에서 3.3% 공제 및 세전 역산", href: "/freelancer/" },
      { title: "부가가치세 계산기", desc: "일반·간이과세자 부가세 납부세액 확인", href: "/vat/" },
      { title: "기타소득세 8.8%", desc: "일시적 강연료·원고료 원천징수 비교", href: "/other-income/" }
    ]);

    writePage(
      "/business-tax/",
      renderLayout({
        routePath: "/business-tax/",
        title: `${DATA.year} 사업소득금액 · 종합소득세 계산기 (단순경비율·노란우산·3.3% 환급)`,
        description: "프리랜서와 개인사업자의 연 매출·단순경비율(또는 실제 경비)·노란우산공제·기납부 3.3%를 반영해 사업소득금액과 5월 종합소득세 납부·환급액을 계산합니다.",
        activeNav: "business-tax",
        priority: "0.95",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "사업소득·종합소득세", href: "/business-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 사업소득금액 · 종합소득세 계산기</h1>
              <span class="meta-tag">2026 노란우산 600만 반영</span>
            </div>
            <p class="subtitle">연 매출과 경비율(또는 실제 경비)로 사업소득금액과 5월 종합소득세 납부·환급액을 계산합니다.</p>
          </header>
          ${renderWidget(5000)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("businessTax")}
          ${renderAffiliateCard("businessTax")}
          ${renderPartnerCard("businessTax")}
          ${renderOfficialLinks("businessTax")}
          ${related}
          ${matrixLinks(null)}
          ${renderFaqSection(faqs)}
        `
      })
    );

    revPresets.forEach((m, idx) => {
      const label = formatKoreanManwonLabel(m);
      const res = Calc.calcBusinessIncomeTax({ revenue: m * 10000, expenseMode: "simple", expenseRate: 64.1, dependents: 1, autoPrepaid33: true });
      const prev = idx > 0 ? { href: `/business-tax/${revPresets[idx - 1]}-manwon/`, label: `매출 ${formatKoreanManwonLabel(revPresets[idx - 1])}` } : null;
      const next = idx < revPresets.length - 1 ? { href: `/business-tax/${revPresets[idx + 1]}-manwon/`, label: `매출 ${formatKoreanManwonLabel(revPresets[idx + 1])}` } : null;
      const cmp = renderCompareTable({
        title: `연 매출 ${label} 경비율별 종합소득세 비교`,
        subtitle: "인적공제 1명·3.3% 기납부 기준입니다. 경비율이 높거나 실제 경비를 많이 인정받을수록 세금이 크게 줄어듭니다.",
        headers: [
          { label: "적용 경비율" },
          { label: "사업소득금액", num: true },
          { label: "결정세액 합계", num: true },
          { label: "기납부(3.3%)", num: true },
          { label: "5월 정산액", num: true }
        ],
        rows: [50, 64.1, 75, 86].map((r) => {
          const c = Calc.calcBusinessIncomeTax({ revenue: m * 10000, expenseMode: "simple", expenseRate: r, dependents: 1, autoPrepaid33: true });
          return {
            current: r === 64.1,
            cells: [
              `경비율 ${r}%`,
              Calc.formatWon(c.businessIncome),
              Calc.formatWon(c.totalTax),
              Calc.formatWon(c.prepaidTax),
              (c.balanceDue < 0 ? "환급 " : "납부 ") + Calc.formatWon(Math.abs(c.balanceDue))
            ]
          };
        })
      });
      writePage(
        `/business-tax/${m}-manwon/`,
        renderLayout({
          routePath: `/business-tax/${m}-manwon/`,
          title: `연 매출 ${label} 사업소득금액 · 종합소득세 (${Calc.formatWon(res.totalTax)})`,
          description: `프리랜서·개인사업자 연 매출 ${label}(경비율 64.1% 기준) 사업소득금액은 ${Calc.formatWon(res.businessIncome)}, 결정세액은 ${Calc.formatWon(res.totalTax)}입니다.`,
          activeNav: "business-tax",
          priority: "0.75",
          breadcrumbs: [
            { label: "홈", href: "/" },
            { label: "사업소득·종합소득세", href: "/business-tax/" },
            { label: `매출 ${label}`, href: `/business-tax/${m}-manwon/` }
          ],
          faqs,
          bodyHtml: `
            <header class="page-head">
              <h1>연 매출 ${label} 사업소득금액 · 종합소득세</h1>
              <p class="subtitle">프리랜서 대표 단순경비율(64.1%) 적용 시 사업소득금액은 <strong>${Calc.formatWon(res.businessIncome)}</strong>, 결정세액은 <strong>${Calc.formatWon(res.totalTax)}</strong>입니다.</p>
            </header>
            ${renderWidget(m)}
            ${renderAdSlot("pseoMid")}
            ${cmp}
            ${renderTaxTipsSection("businessTax")}
            ${renderAffiliateCard("businessTax")}
            ${renderPartnerCard("businessTax")}
            ${renderOfficialLinks("businessTax")}
            ${related}
            ${renderPrevNext(prev, next)}
            ${matrixLinks(m)}
          `
        })
      );
    });
  }

  /* 13. 상속세 계산기 */
  function buildInheritanceTaxPages() {
    const estates = [10, 15, 20, 30, 50];

    function renderWidget(defaultEok) {
      const res = Calc.calcInheritanceTax({ grossEstate: defaultEok * 100000000, hasSpouse: true, children: 2, netFinancial: 200000000, voluntary: true });
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">상속재산 및 공제 입력</h2>
            <div class="field">
              <label for="inh-estate">총 상속재산가액 (부동산·금융 등)</label>
              <div class="input-wrap"><input id="inh-estate" type="number" min="0" step="1" value="${defaultEok}" /><span class="input-unit">억 원</span></div>
              <div class="preset-row" id="inh-presets">
                <button type="button" class="chip-btn" data-preset="10">10억</button>
                <button type="button" class="chip-btn" data-preset="15">15억</button>
                <button type="button" class="chip-btn" data-preset="20">20억</button>
                <button type="button" class="chip-btn" data-preset="30">30억</button>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="inh-debt">채무·미지급 세금</label>
                <div class="input-wrap"><input id="inh-debt" type="number" min="0" step="0.5" value="0" /><span class="input-unit">억 원</span></div>
              </div>
              <div class="field">
                <label for="inh-financial">순금융재산 (20% 공제)</label>
                <div class="input-wrap"><input id="inh-financial" type="number" min="0" step="0.5" value="2" /><span class="input-unit">억 원</span></div>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="inh-children">상속인 자녀 수</label>
                <div class="input-wrap"><input id="inh-children" type="number" min="0" max="10" step="1" value="2" /><span class="input-unit">명</span></div>
              </div>
              <div class="field">
                <label for="inh-prior">10년 내 사전증여재산</label>
                <div class="input-wrap"><input id="inh-prior" type="number" min="0" step="0.5" value="0" /><span class="input-unit">억 원</span></div>
              </div>
            </div>
            <div class="field">
              <label class="checkbox-row"><input id="inh-spouse" type="checkbox" checked /><span>배우자 생존 (최소 5억~최대 30억 원 배우자 상속공제 적용)</span></label>
            </div>
            <div class="field" id="inh-spouse-actual-field">
              <label for="inh-spouse-actual">배우자 실제 상속액 (0 입력 시 최소 5억 적용)</label>
              <div class="input-wrap"><input id="inh-spouse-actual" type="number" min="0" step="1" value="0" /><span class="input-unit">억 원</span></div>
            </div>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">상속세 산출 내역</h2>
            <div class="result-summary">
              <div class="result-label">예상 최종 납부 상속세</div>
              <div class="result-main num" id="res-inh-main">${Calc.formatWon(res.finalTax)}</div>
              <div class="result-sub num" id="res-inh-sub">자진신고 3% 공제 적용 · 실효세율 ${Calc.formatPercent(res.effectiveRate, 1)}</div>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>상속세 과세가액 (장례비 등 차감)</th><td id="res-inh-val">${Calc.formatWon(res.taxableValue)}</td></tr>
                <tr><th>일괄공제 (5억) / 기초+자녀</th><td id="res-inh-lump">${negWon(res.lumpSumOrItem)}</td></tr>
                <tr><th>배우자 상속공제</th><td id="res-inh-spouse">${negWon(res.spouseDeduction)}</td></tr>
                <tr><th>금융재산 상속공제</th><td id="res-inh-fin">${negWon(res.financialDeduction)}</td></tr>
                <tr><th>과세표준</th><td id="res-inh-base">${Calc.formatWon(res.taxBase)}</td></tr>
                <tr><th>산출세액 (10~50%)</th><td id="res-inh-calc">${Calc.formatWon(res.calculatedTax)}</td></tr>
                <tr class="total-row"><th>신고세액공제 (3%)</th><td id="res-inh-credit">${negWon(res.voluntaryCredit)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("inh")}
          </div>
        </section>
      `;
    }

    const matrixLinks = (current) => `
      <section class="section-block">
        <h2>상속재산 규모별 상속세 계산</h2>
        <div class="link-matrix">
          ${estates.map((e) => `<a class="matrix-pill ${current === e ? "current" : ""}" href="/inheritance-tax/${e}-eok/">상속재산 ${e}억 원</a>`).join("")}
        </div>
      </section>
    `;

    const faqs = [
      {
        q: "상속세는 얼마까지 면제(비과세)되나요?",
        a: "2026년 기준 배우자가 생존해 있으면 일괄공제 5억 원 + 배우자 공제 최소 5억 원 = 최소 10억 원까지 상속세가 0원이며, 배우자가 없으면 일괄공제 5억 원까지 비과세입니다. 순금융재산이 있으면 최대 2억 원이 추가 공제됩니다."
      },
      {
        q: "상속세 신고 기한은 언제까지인가요?",
        a: "상속개시일(사망일)이 속하는 달의 말일부터 6개월 이내에 홈택스나 세무서에 신고·납부하면 산출세액의 3%를 신고세액공제로 차감받습니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "증여세 계산기", desc: "10년 주기 사전 증여로 상속세 과표 줄이기", href: "/gift-tax/" },
      { title: "부동산 양도세", desc: "상속받은 주택 매도 시 취득가액과 양도세", href: "/transfer-tax/" },
      { title: "보유세 계산기", desc: "상속 주택 보유 시 재산세·종부세 확인", href: "/holding-tax/" }
    ]);

    writePage(
      "/inheritance-tax/",
      renderLayout({
        routePath: "/inheritance-tax/",
        title: `${DATA.year} 상속세 계산기 (일괄공제 5억 · 배우자공제 · 금융재산공제)`,
        description: "상속재산가액, 일괄공제 5억, 배우자 상속공제(5~30억), 금융재산공제(최대 2억), 10~50% 누진세율과 신고세액공제 3%를 반영한 2026년 상속세 계산기.",
        activeNav: "inheritance-tax",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "상속세 계산기", href: "/inheritance-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 상속세 계산기</h1>
              <span class="meta-tag">일괄·배우자·금융공제 반영</span>
            </div>
            <p class="subtitle">상속재산과 배우자·자녀·금융재산 공제를 반영해 예상 상속세를 계산합니다.</p>
          </header>
          ${renderWidget(15)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("inheritanceTax")}
          ${renderAffiliateCard("inheritanceTax")}
          ${renderPartnerCard("inheritanceTax")}
          ${renderOfficialLinks("inheritanceTax")}
          ${related}
          ${matrixLinks(null)}
          ${renderFaqSection(faqs)}
        `
      })
    );

    estates.forEach((e, idx) => {
      const resSpouse = Calc.calcInheritanceTax({ grossEstate: e * 100000000, hasSpouse: true, children: 2, voluntary: true });
      const resNoSpouse = Calc.calcInheritanceTax({ grossEstate: e * 100000000, hasSpouse: false, children: 2, voluntary: true });
      const prev = idx > 0 ? { href: `/inheritance-tax/${estates[idx - 1]}-eok/`, label: `상속재산 ${estates[idx - 1]}억 원` } : null;
      const next = idx < estates.length - 1 ? { href: `/inheritance-tax/${estates[idx + 1]}-eok/`, label: `상속재산 ${estates[idx + 1]}억 원` } : null;
      const cmp = renderCompareTable({
        title: `상속재산 ${e}억 원 배우자 유무별 상속세 비교`,
        subtitle: "채무 없음·자진신고(3% 공제) 기준입니다. 배우자 생존 시 최소 5억 원 이상 추가 공제됩니다.",
        headers: [
          { label: "상속 조건" },
          { label: "공제 합계", num: true },
          { label: "과세표준", num: true },
          { label: "최종 납부세액", num: true }
        ],
        rows: [
          {
            current: true,
            cells: ["배우자 있음 (기본 10억 공제)", Calc.formatWon(resSpouse.totalDeduction), Calc.formatWon(resSpouse.taxBase), Calc.formatWon(resSpouse.finalTax)]
          },
          {
            current: false,
            cells: ["배우자 없음 (일괄 5억 공제)", Calc.formatWon(resNoSpouse.totalDeduction), Calc.formatWon(resNoSpouse.taxBase), Calc.formatWon(resNoSpouse.finalTax)]
          }
        ]
      });
      writePage(
        `/inheritance-tax/${e}-eok/`,
        renderLayout({
          routePath: `/inheritance-tax/${e}-eok/`,
          title: `상속재산 ${e}억 원 상속세 (${Calc.formatWon(resSpouse.finalTax)})`,
          description: `상속재산 ${e}억 원 기준 배우자 생존 시 예상 상속세는 ${Calc.formatWon(resSpouse.finalTax)}, 배우자 없음 시 ${Calc.formatWon(resNoSpouse.finalTax)}입니다.`,
          activeNav: "inheritance-tax",
          priority: "0.75",
          breadcrumbs: [
            { label: "홈", href: "/" },
            { label: "상속세", href: "/inheritance-tax/" },
            { label: `${e}억 원`, href: `/inheritance-tax/${e}-eok/` }
          ],
          faqs,
          bodyHtml: `
            <header class="page-head">
              <h1>상속재산 ${e}억 원 상속세</h1>
              <p class="subtitle">배우자 생존(기본 공제 10억) 기준 예상 상속세는 <strong>${Calc.formatWon(resSpouse.finalTax)}</strong>, 배우자가 없으면 <strong>${Calc.formatWon(resNoSpouse.finalTax)}</strong>입니다.</p>
            </header>
            ${renderWidget(e)}
            ${renderAdSlot("pseoMid")}
            ${cmp}
            ${renderTaxTipsSection("inheritanceTax")}
            ${renderAffiliateCard("inheritanceTax")}
            ${renderPartnerCard("inheritanceTax")}
            ${renderOfficialLinks("inheritanceTax")}
            ${related}
            ${renderPrevNext(prev, next)}
            ${matrixLinks(e)}
          `
        })
      );
    });
  }

  /* 14. 부동산 양도소득세 계산기 */
  function buildTransferTaxPages() {
    const sellCases = [
      { slug: "buy-5-sell-10", buy: 5, sell: 10 },
      { slug: "buy-6-sell-12", buy: 6, sell: 12 },
      { slug: "buy-8-sell-15", buy: 8, sell: 15 },
      { slug: "buy-10-sell-18", buy: 10, sell: 18 },
      { slug: "buy-10-sell-20", buy: 10, sell: 20 }
    ];

    function renderWidget(defaultBuy, defaultSell) {
      const res = Calc.calcPropertyTransferTax({
        buyPrice: defaultBuy * 100000000,
        sellPrice: defaultSell * 100000000,
        expenses: 2000 * 10000,
        holdYears: 5,
        resideYears: 3,
        isOneHome: true
      });
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">매매가 · 보유기간 · 1주택 여부</h2>
            <div class="field-row">
              <div class="field">
                <label for="tr-buy">취득가액 (산 가격)</label>
                <div class="input-wrap"><input id="tr-buy" type="number" min="0" step="0.5" value="${defaultBuy}" /><span class="input-unit">억 원</span></div>
              </div>
              <div class="field">
                <label for="tr-sell">양도가액 (판 가격)</label>
                <div class="input-wrap"><input id="tr-sell" type="number" min="0" step="0.5" value="${defaultSell}" /><span class="input-unit">억 원</span></div>
              </div>
            </div>
            <div class="preset-row" id="tr-presets" style="margin-bottom:14px;">
              <button type="button" class="chip-btn" data-preset="10">양도 10억</button>
              <button type="button" class="chip-btn" data-preset="12">12억</button>
              <button type="button" class="chip-btn" data-preset="15">15억</button>
              <button type="button" class="chip-btn" data-preset="20">20억</button>
            </div>
            <div class="field">
              <label for="tr-exp">필요경비 (취득세·중개보수·샷시 등)</label>
              <div class="input-wrap"><input id="tr-exp" type="number" min="0" step="100" value="2000" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="tr-hold">보유기간</label>
                <div class="input-wrap"><input id="tr-hold" type="number" min="0" max="30" step="1" value="5" /><span class="input-unit">년</span></div>
              </div>
              <div class="field">
                <label for="tr-reside">실거주기간</label>
                <div class="input-wrap"><input id="tr-reside" type="number" min="0" max="30" step="1" value="3" /><span class="input-unit">년</span></div>
              </div>
            </div>
            <div class="field">
              <label class="checkbox-row"><input id="tr-onehome" type="checkbox" checked /><span>1세대 1주택 (12억 비과세 + 장기보유특별공제 최대 80%)</span></label>
              <label class="checkbox-row"><input id="tr-need-reside" type="checkbox" /><span>취득 당시 조정대상지역 (1주택 비과세 시 2년 실거주 필수)</span></label>
            </div>
            <div class="field">
              <label for="tr-heavy">다주택 중과 여부 (2026.5.9 중과 유예 종료)</label>
              <select id="tr-heavy">
                <option value="none" selected>일반 과세 (1주택 또는 비조정지역)</option>
                <option value="two">조정대상지역 2주택 중과 (+20%p · 장특공제 배제)</option>
                <option value="three">조정대상지역 3주택 이상 중과 (+30%p · 장특공제 배제)</option>
              </select>
            </div>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">부동산 양도소득세 산출</h2>
            <div class="result-summary">
              <div class="result-label">총 납부 양도소득세 (지방세 포함)</div>
              <div class="result-main num" id="res-tr-main">${Calc.formatWon(res.totalTax)}</div>
              <div class="result-sub num" id="res-tr-sub">양도차익 ${Calc.formatWon(res.totalGain)} · 실효세율 ${Calc.formatPercent(res.effectiveRate, 1)}</div>
              <p class="result-note" id="res-tr-note" ${res.note ? "" : "hidden"}>${res.note || ""}</p>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>전체 양도차익 (경비 차감)</th><td id="res-tr-gain">${Calc.formatWon(res.totalGain)}</td></tr>
                <tr><th>1세대 1주택 비과세분 (12억)</th><td id="res-tr-exempt">${negWon(res.exemptGain)}</td></tr>
                <tr><th>장기보유특별공제</th><td id="res-tr-lt">${negWon(res.ltDeduction)} (${Math.round(res.ltDeductionRate * 100)}%)</td></tr>
                <tr><th>양도소득 기본공제</th><td id="res-tr-basic">${negWon(res.basicDeduction)}</td></tr>
                <tr><th>과세표준</th><td id="res-tr-base">${Calc.formatWon(res.taxBase)}</td></tr>
                <tr><th>양도소득세 (국세)</th><td id="res-tr-tax">${Calc.formatWon(res.transferTax)}</td></tr>
                <tr class="total-row"><th>지방소득세 (10%)</th><td id="res-tr-local">${Calc.formatWon(res.localTax)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("tr")}
          </div>
        </section>
      `;
    }

    const matrixLinks = (current) => `
      <section class="section-block">
        <h2>주요 매매 구간별 부동산 양도세</h2>
        <div class="link-matrix">
          ${sellCases.map((c) => `<a class="matrix-pill ${current === c.slug ? "current" : ""}" href="/transfer-tax/${c.slug}/">${c.buy}억 → ${c.sell}억 양도세</a>`).join("")}
        </div>
      </section>
    `;

    const faqs = [
      {
        q: "1세대 1주택이면 12억 원 넘는 집을 팔 때 세금을 얼마나 내나요?",
        a: "전체 양도차익 중 12억 원 초과 비율만큼만 과세되며, 2년 이상 거주하고 3년 이상 보유했다면 보유 연 4%(최대 40%) + 거주 연 4%(최대 40%)로 최대 80% 장기보유특별공제를 받을 수 있습니다."
      },
      {
        q: "부동산 양도세 신고 기한은 언제인가요?",
        a: "잔금청산일(또는 등기접수일 중 빠른 날)이 속하는 달의 말일부터 2개월 이내에 홈택스에서 예정신고·납부해야 합니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "주택 취등록세 계산기", desc: "갈아타기 새 집 매수 시 취등록세 확인", href: "/real-estate/" },
      { title: "보유세 계산기", desc: "매도 전후 재산세·종합부동산세 비교", href: "/holding-tax/" },
      { title: "증여세 계산기", desc: "양도 vs 가족 증여 세금 비교", href: "/gift-tax/" }
    ]);

    writePage(
      "/transfer-tax/",
      renderLayout({
        routePath: "/transfer-tax/",
        title: `${DATA.year} 부동산 양도소득세 계산기 (1주택 12억 비과세 · 장특공제 80%)`,
        description: "취득가·양도가·필요경비, 1세대 1주택 12억 비과세, 장기보유특별공제(최대 80%), 단기양도·누진세율을 반영한 2026년 부동산 양도소득세 계산기.",
        activeNav: "transfer-tax",
        priority: "0.95",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "부동산 양도세", href: "/transfer-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 부동산 양도소득세 계산기</h1>
              <span class="meta-tag">12억 비과세 · 장특공제 반영</span>
            </div>
            <p class="subtitle">취득가·양도가와 보유·거주기간으로 아파트·주택 매도 시 양도소득세를 계산합니다.</p>
          </header>
          ${renderWidget(8, 15)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("transferTax")}
          ${renderAffiliateCard("transferTax")}
          ${renderPartnerCard("transferTax")}
          ${renderOfficialLinks("transferTax")}
          ${related}
          ${matrixLinks(null)}
          ${renderFaqSection(faqs)}
        `
      })
    );

    sellCases.forEach((c, idx) => {
      const r1 = Calc.calcPropertyTransferTax({ buyPrice: c.buy * 1e8, sellPrice: c.sell * 1e8, expenses: 20000000, holdYears: 5, resideYears: 3, isOneHome: true });
      const rGen = Calc.calcPropertyTransferTax({ buyPrice: c.buy * 1e8, sellPrice: c.sell * 1e8, expenses: 20000000, holdYears: 5, resideYears: 0, isOneHome: false });
      const prev = idx > 0 ? { href: `/transfer-tax/${sellCases[idx - 1].slug}/`, label: `${sellCases[idx - 1].buy}억 → ${sellCases[idx - 1].sell}억` } : null;
      const next = idx < sellCases.length - 1 ? { href: `/transfer-tax/${sellCases[idx + 1].slug}/`, label: `${sellCases[idx + 1].buy}억 → ${sellCases[idx + 1].sell}억` } : null;
      const cmp = renderCompareTable({
        title: `${c.buy}억 매수 → ${c.sell}억 매도 조건별 양도세 비교`,
        subtitle: "필요경비 2,000만 원·5년 보유 기준입니다.",
        headers: [
          { label: "매도 조건" },
          { label: "과세 양도차익", num: true },
          { label: "장기보유공제", num: true },
          { label: "총 양도세", num: true }
        ],
        rows: [
          { current: true, cells: ["1세대 1주택 (5년 보유·3년 거주)", Calc.formatWon(r1.taxableGain), Calc.formatWon(r1.ltDeduction), Calc.formatWon(r1.totalTax)] },
          { current: false, cells: ["일반 과세 (다주택 비과세 미적용)", Calc.formatWon(rGen.taxableGain), Calc.formatWon(rGen.ltDeduction), Calc.formatWon(rGen.totalTax)] }
        ]
      });
      writePage(
        `/transfer-tax/${c.slug}/`,
        renderLayout({
          routePath: `/transfer-tax/${c.slug}/`,
          title: `${c.buy}억 매수 ${c.sell}억 매도 부동산 양도세 (${Calc.formatWon(r1.totalTax)})`,
          description: `${c.buy}억 원에 산 주택을 ${c.sell}억 원에 매도 시 1세대 1주택(5년 보유·3년 거주) 양도세는 ${Calc.formatWon(r1.totalTax)}, 일반 과세는 ${Calc.formatWon(rGen.totalTax)}입니다.`,
          activeNav: "transfer-tax",
          priority: "0.75",
          breadcrumbs: [
            { label: "홈", href: "/" },
            { label: "부동산 양도세", href: "/transfer-tax/" },
            { label: `${c.buy}억 → ${c.sell}억`, href: `/transfer-tax/${c.slug}/` }
          ],
          faqs,
          bodyHtml: `
            <header class="page-head">
              <h1>${c.buy}억 매수 → ${c.sell}억 매도 양도소득세</h1>
              <p class="subtitle">1세대 1주택(5년 보유·3년 거주) 기준 예상 양도세는 <strong>${Calc.formatWon(r1.totalTax)}</strong>, 일반 과세는 <strong>${Calc.formatWon(rGen.totalTax)}</strong>입니다.</p>
            </header>
            ${renderWidget(c.buy, c.sell)}
            ${renderAdSlot("pseoMid")}
            ${cmp}
            ${renderTaxTipsSection("transferTax")}
            ${renderAffiliateCard("transferTax")}
            ${renderPartnerCard("transferTax")}
            ${renderOfficialLinks("transferTax")}
            ${related}
            ${renderPrevNext(prev, next)}
            ${matrixLinks(c.slug)}
          `
        })
      );
    });
  }

  /* 15. 부가가치세(VAT) 계산기 */
  function buildVatPage() {
    const res = Calc.calcVat({ mode: "simple", amount: 1000 * 10000, isInclusive: false });
    const faqs = [
      {
        q: "부가세 포함(공급대가) 금액에서 공급가액과 부가세를 어떻게 나누나요?",
        a: "합계금액을 1.1로 나누면 공급가액, 나머지 10%가 부가가치세입니다. 예를 들어 110만 원(부가세 포함)이면 공급가액 100만 원, 부가세 10만 원입니다."
      },
      {
        q: "간이과세자는 부가가치세를 어떻게 계산하나요?",
        a: "간이과세자는 부가세 포함 매출액(공급대가)에 업종별 부가가치율(15~40%)과 10%를 곱해 매출세액을 구하며, 연간 공급대가가 4,800만 원 미만이면 납부의무가 면제됩니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "종합소득세 계산기", desc: "개인사업자 연 매출 기준 5월 종소세 계산", href: "/business-tax/" },
      { title: "프리랜서 3.3%", desc: "면세 인적용역 3.3% 원천징수 계산", href: "/freelancer/" }
    ]);

    writePage(
      "/vat/",
      renderLayout({
        routePath: "/vat/",
        title: `${DATA.year} 부가가치세(VAT) 계산기 (공급가액 역산 · 일반/간이과세자)`,
        description: "세금계산서 공급가액·합계금액 부가세 10% 역산부터 일반과세자·간이과세자(4,800만 원 면제) 예상 납부세액까지 계산합니다.",
        activeNav: "vat",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "부가가치세 계산기", href: "/vat/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${DATA.year} 부가가치세(VAT) 계산기</h1>
            <p class="subtitle">공급가액·합계금액 10% 간편 계산과 일반·간이과세자 납부세액을 계산합니다.</p>
          </header>
          <section class="calc-grid">
            <div class="sheet">
              <h2 class="sheet-title">과세 유형 및 금액 입력</h2>
              <div class="field">
                <label for="vat-mode">계산 모드</label>
                <select id="vat-mode">
                  <option value="simple" selected>간편 계산 (공급가액 ↔ 합계금액 10%)</option>
                  <option value="general">일반과세자 납부세액 (매출 - 매입)</option>
                  <option value="simplified">간이과세자 납부세액 (업종별 부가가치율)</option>
                </select>
              </div>
              <div id="vat-simple-box">
                <div class="field">
                  <label for="vat-amount">거래 금액</label>
                  <div class="input-wrap"><input id="vat-amount" type="number" min="0" step="10" value="1000" /><span class="input-unit">만 원</span></div>
                  <div class="preset-row" id="vat-presets">
                    <button type="button" class="chip-btn" data-preset="100">100만</button>
                    <button type="button" class="chip-btn" data-preset="500">500만</button>
                    <button type="button" class="chip-btn" data-preset="1000">1,000만</button>
                    <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
                  </div>
                </div>
                <div class="field">
                  <label class="checkbox-row"><input id="vat-inclusive" type="checkbox" /><span>입력 금액이 부가세 포함(합계금액)입니다 (역산 계산)</span></label>
                </div>
              </div>
              <div id="vat-biz-box" hidden>
                <div class="field-row">
                  <div class="field">
                    <label for="vat-sales">매출액 (일반: 공급가액 / 간이: 포함)</label>
                    <div class="input-wrap"><input id="vat-sales" type="number" min="0" step="100" value="6000" /><span class="input-unit">만 원</span></div>
                  </div>
                  <div class="field">
                    <label for="vat-purchases">매입액 (적격증빙 매입)</label>
                    <div class="input-wrap"><input id="vat-purchases" type="number" min="0" step="100" value="2500" /><span class="input-unit">만 원</span></div>
                  </div>
                </div>
                <div class="field" id="vat-vrate-field" hidden>
                  <label for="vat-value-rate">간이과세 업종별 부가가치율</label>
                  <select id="vat-value-rate">
                    <option value="15">소매업 · 음식점(일부) — 15%</option>
                    <option value="20">제조 · 농림어업 · 숙박 — 20%</option>
                    <option value="30" selected>음식점 · 건설 · 운수 · 통신 — 30%</option>
                    <option value="40">전문서비스 · 부동산임대 — 40%</option>
                  </select>
                </div>
                <div class="field">
                  <label for="vat-card">카드·현금영수증 매출 (1.3% 발행공제)</label>
                  <div class="input-wrap"><input id="vat-card" type="number" min="0" step="100" value="0" /><span class="input-unit">만 원</span></div>
                </div>
              </div>
            </div>
            <div class="sheet receipt">
              <h2 class="sheet-title">부가가치세 산출 내역</h2>
              <div class="result-summary">
                <div class="result-label" id="res-vat-label">부가가치세 (10%)</div>
                <div class="result-main num" id="res-vat-main">${Calc.formatWon(res.vat)}</div>
                <div class="result-sub num" id="res-vat-sub">공급가액 ${Calc.formatWon(res.supply)} · 합계금액 ${Calc.formatWon(res.total)}</div>
                <p class="result-note" id="res-vat-note" hidden></p>
              </div>
              <table class="breakdown-table">
                <tbody>
                  <tr><th id="res-vat-row1-k">공급가액</th><td id="res-vat-row1-v">${Calc.formatWon(res.supply)}</td></tr>
                  <tr><th id="res-vat-row2-k">부가가치세 (10%)</th><td id="res-vat-row2-v">${Calc.formatWon(res.vat)}</td></tr>
                  <tr><th id="res-vat-row3-k">신용카드 발행공제</th><td id="res-vat-row3-v">-</td></tr>
                  <tr class="total-row"><th id="res-vat-row4-k">합계금액 (공급대가)</th><td id="res-vat-row4-v">${Calc.formatWon(res.total)}</td></tr>
                </tbody>
              </table>
              ${renderResultActions("vat")}
            </div>
          </section>
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("vat")}
          ${renderAffiliateCard("vat")}
          ${renderOfficialLinks("vat")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  /* 16. 금융소득종합과세 계산기 */
  function buildFinancialTaxPage() {
    const res = Calc.calcFinancialTax({ interest: 1000 * 10000, dividend: 2000 * 10000, otherIncome: 5000 * 10000 });
    const faqs = [
      {
        q: "금융소득종합과세 기준 2,000만 원은 세전인가요, 세후인가요?",
        a: "원천징수(15.4%)를 떼기 전 '세전' 연간 이자소득과 배당소득의 합계 기준입니다. 비과세 계좌(ISA 비과세 한도, 비과세 종합저축 등)와 연금계좌 수익은 제외됩니다."
      },
      {
        q: "연 2,000만 원을 넘으면 전체 금액에 높은 세율이 붙나요?",
        a: "아닙니다. 2,000만 원까지는 15.4% 분리과세를 유지하고, 2,000만 원을 초과한 금액만 다른 종합소득(근로·사업소득 등)과 합산해 누진세율(6~45%)을 적용합니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "해외주식 양도세", desc: "해외주식 매매차익(연 250만 공제·분리과세 22%)", href: "/stock-tax/" },
      { title: "증여세 계산기", desc: "배우자 6억 증여로 금융소득 분산 설계", href: "/gift-tax/" }
    ]);

    writePage(
      "/financial-tax/",
      renderLayout({
        routePath: "/financial-tax/",
        title: `${DATA.year} 금융소득종합과세 계산기 (이자·배당 2,000만 원 초과 추가세액)`,
        description: "연간 이자·배당소득이 2,000만 원을 넘을 때 분리과세(15.4%) 외에 5월 종합소득세로 추가 납부할 세액과 건강보험 피부양자 탈락 여부를 계산합니다.",
        activeNav: "financial-tax",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "금융소득종합과세", href: "/financial-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${DATA.year} 금융소득종합과세 계산기</h1>
            <p class="subtitle">연간 이자·배당 합계 2,000만 원 초과 시 5월 추가 납부세액과 건보료 유의사항을 계산합니다.</p>
          </header>
          <section class="calc-grid">
            <div class="sheet">
              <h2 class="sheet-title">이자 · 배당 · 타 소득 입력</h2>
              <div class="field-row">
                <div class="field">
                  <label for="fin-interest">연간 이자소득 (세전)</label>
                  <div class="input-wrap"><input id="fin-interest" type="number" min="0" step="100" value="1000" /><span class="input-unit">만 원</span></div>
                </div>
                <div class="field">
                  <label for="fin-dividend">연간 배당소득 (세전)</label>
                  <div class="input-wrap"><input id="fin-dividend" type="number" min="0" step="100" value="2000" /><span class="input-unit">만 원</span></div>
                </div>
              </div>
              <div class="preset-row" id="fin-presets" style="margin-bottom:14px;">
                <button type="button" class="chip-btn" data-preset="1000">배당 1,000만</button>
                <button type="button" class="chip-btn" data-preset="2000">2,000만</button>
                <button type="button" class="chip-btn" data-preset="3000">3,000만</button>
                <button type="button" class="chip-btn" data-preset="5000">5,000만</button>
              </div>
              <div class="field">
                <label class="checkbox-row"><input id="fin-domestic" type="checkbox" checked /><span>국내 법인 배당소득 (10% 그로스업·배당세액공제 적용 · 해외배당은 체크 해제)</span></label>
              </div>
              <div class="field">
                <label for="fin-other">다른 종합소득금액 (근로·사업소득 과세표준 기준)</label>
                <div class="input-wrap"><input id="fin-other" type="number" min="0" step="500" value="5000" /><span class="input-unit">만 원</span></div>
              </div>
              <p class="calc-note">소득세법 제17조(10% 배당가산)·제56조(배당세액공제)·제62조(비교과세) 산식으로 5월 추가 세액을 산출합니다.</p>
            </div>
            <div class="sheet receipt">
              <h2 class="sheet-title">금융소득종합과세 산출</h2>
              <div class="result-summary">
                <div class="result-label">5월 추가 납부 예상 세액 (지방세 포함)</div>
                <div class="result-main num" id="res-fin-main">${Calc.formatWon(res.additionalTotal)}</div>
                <div class="result-sub num" id="res-fin-sub">금융소득 ${Calc.formatWon(res.totalFinancial)} → 종합과세 대상</div>
                <p class="result-note" id="res-fin-note" ${res.healthInsuranceWarning ? "" : "hidden"}>연 금융소득 2,000만 원 초과로 건보료 피부양자 탈락 유의</p>
              </div>
              <table class="breakdown-table">
                <tbody>
                  <tr><th>연간 금융소득 합계</th><td id="res-fin-total">${Calc.formatWon(res.totalFinancial)}</td></tr>
                  <tr><th>2,000만 원 초과 종합합산액</th><td id="res-fin-excess">${Calc.formatWon(res.excessFinancial)}</td></tr>
                  <tr><th>기납부 원천징수 (15.4%)</th><td id="res-fin-withheld">${Calc.formatWon(res.withheldTotal)}</td></tr>
                  <tr><th>종합과세 추가 국세</th><td id="res-fin-add-nat">${Calc.formatWon(res.additionalNational)}</td></tr>
                  <tr><th>종합과세 추가 지방소득세</th><td id="res-fin-add-loc">${Calc.formatWon(res.additionalLocal)}</td></tr>
                  <tr><th>금융소득 총 세금 합계</th><td id="res-fin-all-tax">${Calc.formatWon(res.totalFinancialTax)}</td></tr>
                  <tr class="total-row"><th>세후 순 금융소득</th><td id="res-fin-after">${Calc.formatWon(res.afterTaxFinancial)}</td></tr>
                </tbody>
              </table>
              ${renderResultActions("fin")}
            </div>
          </section>
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("financialTax")}
          ${renderAffiliateCard("financialTax")}
          ${renderOfficialLinks("financialTax")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  /* 17. 자동차세 & 자동차 취득세 계산기 */
  function buildCarTaxPages() {
    const carPresets = [
      { slug: "1000cc", label: "경차 1,000cc", type: "compact", cc: 998, price: 1800 },
      { slug: "1600cc", label: "준중형 1,600cc", type: "passenger", cc: 1598, price: 2800 },
      { slug: "2000cc", label: "중형 2,000cc", type: "passenger", cc: 1998, price: 3800 },
      { slug: "2500cc", label: "준대형 2,500cc", type: "passenger", cc: 2497, price: 4800 },
      { slug: "ev", label: "전기차 (EV)", type: "ev", cc: 0, price: 5000 }
    ];

    function renderWidget(defType, defCc, defPrice) {
      const res = Calc.calcCarTax({ carType: defType, cc: defCc, carAge: 1, prepayMonth: 1, carPrice: defPrice * 10000 });
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">차량 정보 및 연납 설정</h2>
            <div class="field">
              <label for="car-type">차량 구분</label>
              <select id="car-type">
                <option value="passenger" ${defType === "passenger" ? "selected" : ""}>비영업용 승용차 (세단·SUV·7~9인승 포함)</option>
                <option value="compact" ${defType === "compact" ? "selected" : ""}>경차 (1,000cc 이하 · 취득세 4% 75만 감면)</option>
                <option value="ev" ${defType === "ev" ? "selected" : ""}>전기차 (자동차세 연 13만 · 취득세 140만 감면)</option>
                <option value="van11" ${defType === "van11" ? "selected" : ""}>11인승 이상 승합차 (연 65,000원 · 교육세 면제 · 취득세 5%)</option>
              </select>
            </div>
            <div class="field" id="car-cc-field" ${defType === "ev" || defType === "van11" ? "hidden" : ""}>
              <label for="car-cc">배기량 (cc)</label>
              <div class="input-wrap"><input id="car-cc" type="number" min="0" step="100" value="${defCc}" /><span class="input-unit">cc</span></div>
              <div class="preset-row" id="car-cc-presets">
                <button type="button" class="chip-btn" data-preset="998">998cc</button>
                <button type="button" class="chip-btn" data-preset="1598">1,598cc</button>
                <button type="button" class="chip-btn" data-preset="1998">1,998cc</button>
                <button type="button" class="chip-btn" data-preset="2497">2,497cc</button>
                <button type="button" class="chip-btn" data-preset="3470">3,470cc</button>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="car-age">차량 연식 (차령)</label>
                <div class="input-wrap"><input id="car-age" type="number" min="1" max="20" step="1" value="1" /><span class="input-unit">년 차</span></div>
              </div>
              <div class="field">
                <label for="car-prepay">자동차세 연납 신청</label>
                <select id="car-prepay">
                  <option value="1" selected>1월 연납 (실효 4.58% 할인)</option>
                  <option value="3">3월 연납 (실효 3.75% 할인)</option>
                  <option value="6">6월 연납 (실효 2.50% 할인)</option>
                  <option value="9">9월 연납 (실효 1.25% 할인)</option>
                  <option value="0">연납 미적용 (6·12월 분납)</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label for="car-price">차량 가격 (취득세 계산용 · 신차는 부가세 포함 출고가 입력)</label>
              <div class="input-wrap"><input id="car-price" type="number" min="0" step="100" value="${defPrice}" /><span class="input-unit">만 원</span></div>
            </div>
            <div class="field">
              <label class="checkbox-row"><input id="car-used" type="checkbox" /><span>중고차 구매 (미체크 시 신차: 부가세 10% 제외 공급가액으로 취득세 계산)</span></label>
            </div>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">자동차세 · 차량 취득세 산출</h2>
            <div class="result-summary">
              <div class="result-label">연간 납부 자동차세 (연납 반영)</div>
              <div class="result-main num" id="res-car-main">${Calc.formatWon(res.finalCarTax)}</div>
              <div class="result-sub num" id="res-car-sub">연납 할인 ${Calc.formatWon(res.prepayDiscount)} 적용 · 차량 취득세 ${Calc.formatWon(res.finalAcqTax)}</div>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>자동차세 본세</th><td id="res-car-base">${Calc.formatWon(res.discountedBase)}</td></tr>
                <tr><th>지방교육세 (30%)</th><td id="res-car-edu">${Calc.formatWon(res.localEduTax)}</td></tr>
                <tr><th>연간 자동차세 (할인 전)</th><td id="res-car-annual">${Calc.formatWon(res.annualCarTax)}</td></tr>
                <tr><th>연납 할인액 (5%)</th><td id="res-car-prepay">${negWon(res.prepayDiscount)}</td></tr>
                <tr><th>차량 취득세 (감면 전)</th><td id="res-car-acq-raw">${Calc.formatWon(res.rawAcqTax)}</td></tr>
                <tr><th>경차·전기차 취득세 감면</th><td id="res-car-acq-relief">${negWon(res.acqRelief)}</td></tr>
                <tr class="total-row"><th>최종 차량 취득세</th><td id="res-car-acq-final">${Calc.formatWon(res.finalAcqTax)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("car")}
          </div>
        </section>
      `;
    }

    const matrixLinks = (current) => `
      <section class="section-block">
        <h2>배기량 · 차종별 자동차세 바로가기</h2>
        <div class="link-matrix">
          ${carPresets.map((c) => `<a class="matrix-pill ${current === c.slug ? "current" : ""}" href="/car-tax/${c.slug}/">${c.label}</a>`).join("")}
        </div>
      </section>
    `;

    const faqs = [
      {
        q: "2026년 자동차세 1월 연납 할인율은 얼마인가요?",
        a: "2026년에도 연납 공제율 5%가 유지됩니다. 1월 연납 시 2~12월분(11개월)에 5%가 공제되어 연세액 대비 실질 약 4.58%를 아낄 수 있습니다."
      },
      {
        q: "전기차 자동차세와 취득세 감면 한도는 얼마인가요?",
        a: "전기차는 배기량이 없어 크기에 상관없이 본세 10만 원 + 지방교육세 3만 원 = 연 13만 원 고정이며, 2026년 기준 차량 취득세(7%)에서 최대 140만 원까지 감면됩니다."
      }
    ];

    writePage(
      "/car-tax/",
      renderLayout({
        routePath: "/car-tax/",
        title: `${DATA.year} 자동차세 · 차량 취득세 계산기 (배기량·차령·1월 연납·전기차)`,
        description: "배기량(cc), 차령 경감(최대 50%), 2026년 연납 5% 할인, 전기차 정액 13만 원 및 차량 취득세(경차 75만·전기차 140만 감면)를 한 번에 계산합니다.",
        activeNav: "car-tax",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "자동차세·취득세", href: "/car-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${DATA.year} 자동차세 · 차량 취득세 계산기</h1>
            <p class="subtitle">배기량·연식별 연간 자동차세(연납 할인 포함)와 신차·중고차 취득세를 계산합니다.</p>
          </header>
          ${renderWidget("passenger", 1998, 3800)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("carTax")}
          ${renderAffiliateCard("carTax")}
          ${renderOfficialLinks("carTax")}
          ${matrixLinks(null)}
          ${renderFaqSection(faqs)}
        `
      })
    );

    carPresets.forEach((c, idx) => {
      const r1 = Calc.calcCarTax({ carType: c.type, cc: c.cc, carAge: 1, prepayMonth: 1, carPrice: c.price * 10000 });
      const prev = idx > 0 ? { href: `/car-tax/${carPresets[idx - 1].slug}/`, label: carPresets[idx - 1].label } : null;
      const next = idx < carPresets.length - 1 ? { href: `/car-tax/${carPresets[idx + 1].slug}/`, label: carPresets[idx + 1].label } : null;
      const ageRows = [1, 3, 5, 8, 12].map((age) => {
        const x = Calc.calcCarTax({ carType: c.type, cc: c.cc, carAge: age, prepayMonth: 1, carPrice: c.price * 10000 });
        return {
          current: age === 1,
          cells: [`${age}년 차${age >= 12 ? " 이상" : ""}`, `${Math.round(x.ageDiscountRate * 100)}%`, Calc.formatWon(x.annualCarTax), Calc.formatWon(x.finalCarTax)]
        };
      });
      const cmp = renderCompareTable({
        title: `${c.label} 연식(차령)별 자동차세 비교`,
        subtitle: "지방교육세 30% 포함 금액이며, 1월 연납 시 약 4.58%가 추가 할인됩니다.",
        headers: [
          { label: "차령" },
          { label: "차령 경감", num: true },
          { label: "연간 자동차세", num: true },
          { label: "1월 연납 최종액", num: true }
        ],
        rows: ageRows
      });
      writePage(
        `/car-tax/${c.slug}/`,
        renderLayout({
          routePath: `/car-tax/${c.slug}/`,
          title: `${c.label} 자동차세 · 취득세 (연 ${Calc.formatWon(r1.annualCarTax)})`,
          description: `${c.label} 신차 기준 연간 자동차세는 ${Calc.formatWon(r1.annualCarTax)}, 1월 연납 시 ${Calc.formatWon(r1.finalCarTax)}입니다.`,
          activeNav: "car-tax",
          priority: "0.75",
          breadcrumbs: [
            { label: "홈", href: "/" },
            { label: "자동차세", href: "/car-tax/" },
            { label: c.label, href: `/car-tax/${c.slug}/` }
          ],
          faqs,
          bodyHtml: `
            <header class="page-head">
              <h1>${c.label} 자동차세 · 취득세</h1>
              <p class="subtitle">신차 기준 연간 자동차세는 <strong>${Calc.formatWon(r1.annualCarTax)}</strong>, 1월 연납 시 <strong>${Calc.formatWon(r1.finalCarTax)}</strong>입니다.</p>
            </header>
            ${renderWidget(c.type, c.cc, c.price)}
            ${renderAdSlot("pseoMid")}
            ${cmp}
            ${renderTaxTipsSection("carTax")}
            ${renderAffiliateCard("carTax")}
            ${renderOfficialLinks("carTax")}
            ${renderPrevNext(prev, next)}
            ${matrixLinks(c.slug)}
          `
        })
      );
    });
  }

  /* 18. 기타소득세(8.8%) 계산기 */
  function buildOtherIncomePage() {
    const res = Calc.calcOtherIncomeTax({ gross: 100 * 10000, expenseRatePct: 60 });
    const faqs = [
      {
        q: "강연료·원고료에서 왜 8.8%를 떼나요?",
        a: "일시적 인적용역 기타소득은 지급액의 60%를 필요경비로 인정하고 나머지 40%에 22%(소득세 20% + 지방소득세 2%)를 매기므로 전체 지급액의 8.8%가 원천징수됩니다."
      },
      {
        q: "기타소득이 얼마 이하이면 세금을 안 내나요?",
        a: "건별 기타소득금액(필요경비 차감 후)이 5만 원 이하이면 과세최저한으로 세금이 0원입니다. 필요경비 60% 기준 지급액 12만 5,000원 이하가 비과세입니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "프리랜서 3.3% 계산기", desc: "계속·반복적 사업소득(3.3%)과 실수령 비교", href: "/freelancer/" },
      { title: "종합소득세 계산기", desc: "연 300만 원 초과 시 5월 합산 세액 확인", href: "/business-tax/" }
    ]);

    writePage(
      "/other-income/",
      renderLayout({
        routePath: "/other-income/",
        title: `${DATA.year} 기타소득세(8.8%) 계산기 (강연료 · 원고료 · 상금 실수령액)`,
        description: "일시적 강연료·원고료·자문료(8.8%), 공익상(4.4%), 경품·상금(22%)의 원천징수 세액과 실수령액, 300만 원 분리과세 여부를 계산합니다.",
        activeNav: "other-income",
        priority: "0.85",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "기타소득세 8.8%", href: "/other-income/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${DATA.year} 기타소득세(8.8%) 계산기</h1>
            <p class="subtitle">강연료·원고료·심사료·상금의 필요경비 공제 후 원천징수 세액과 실수령액을 계산합니다.</p>
          </header>
          <section class="calc-grid">
            <div class="sheet">
              <h2 class="sheet-title">지급액 및 소득 유형</h2>
              <div class="field">
                <label for="oth-gross">지급 금액 (세전)</label>
                <div class="input-wrap"><input id="oth-gross" type="number" min="0" step="10" value="100" /><span class="input-unit">만 원</span></div>
                <div class="preset-row" id="oth-presets">
                  <button type="button" class="chip-btn" data-preset="30">30만</button>
                  <button type="button" class="chip-btn" data-preset="100">100만</button>
                  <button type="button" class="chip-btn" data-preset="300">300만</button>
                  <button type="button" class="chip-btn" data-preset="500">500만</button>
                </div>
              </div>
              <div class="field">
                <label for="oth-exp-rate">소득 유형 (필요경비율)</label>
                <select id="oth-exp-rate">
                  <option value="60" selected>강연료 · 원고료 · 자문료 · 심사료 (경비 60% → 8.8%)</option>
                  <option value="80">공익·학술상 · 다수 경쟁 상금 (경비 80% → 4.4%)</option>
                  <option value="0">경품 · 이벤트 당첨 · 위약금 (경비 0% → 22%)</option>
                </select>
              </div>
            </div>
            <div class="sheet receipt">
              <h2 class="sheet-title">기타소득세 산출 내역</h2>
              <div class="result-summary">
                <div class="result-label">예상 실수령액</div>
                <div class="result-main num" id="res-oth-main">${Calc.formatWon(res.net)}</div>
                <div class="result-sub num" id="res-oth-sub">원천징수 ${Calc.formatWon(res.totalTax)} (실효세율 ${Calc.formatPercent(res.effectiveRate, 1)})</div>
                <p class="result-note" id="res-oth-note"></p>
              </div>
              <table class="breakdown-table">
                <tbody>
                  <tr><th>세전 지급액</th><td id="res-oth-gross">${Calc.formatWon(res.gross)}</td></tr>
                  <tr><th>필요경비 공제</th><td id="res-oth-exp">${negWon(res.expenseAmount)} (60%)</td></tr>
                  <tr><th>기타소득금액 (과표)</th><td id="res-oth-income">${Calc.formatWon(res.otherIncome)}</td></tr>
                  <tr><th>기타소득세 (20%)</th><td id="res-oth-inc-tax">${Calc.formatWon(res.incomeTax)}</td></tr>
                  <tr><th>지방소득세 (2%)</th><td id="res-oth-loc-tax">${Calc.formatWon(res.localTax)}</td></tr>
                  <tr class="total-row"><th>원천징수 세액 합계</th><td id="res-oth-total-tax">${negWon(res.totalTax)}</td></tr>
                </tbody>
              </table>
              ${renderResultActions("oth")}
            </div>
          </section>
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("otherIncome")}
          ${renderAffiliateCard("otherIncome")}
          ${renderOfficialLinks("otherIncome")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  /* 19. 보유세(재산세 · 종합부동산세) 계산기 */
  function buildHoldingTaxPages() {
    const prices = [6, 9, 12, 15, 20, 30];

    function renderWidget(defEok) {
      const res = Calc.calcHoldingTax({ officialPrice: defEok * 100000000, isOneHome: true, ownerAge: 45, holdYears: 5 });
      return `
        <section class="calc-grid">
          <div class="sheet">
            <h2 class="sheet-title">주택 공시가격 및 보유 조건</h2>
            <div class="field">
              <label for="hold-price">주택 공시가격 합계 (시세 아님)</label>
              <div class="input-wrap"><input id="hold-price" type="number" min="0" step="1" value="${defEok}" /><span class="input-unit">억 원</span></div>
              <div class="preset-row" id="hold-presets">
                <button type="button" class="chip-btn" data-preset="6">6억</button>
                <button type="button" class="chip-btn" data-preset="9">9억</button>
                <button type="button" class="chip-btn" data-preset="12">12억</button>
                <button type="button" class="chip-btn" data-preset="15">15억</button>
                <button type="button" class="chip-btn" data-preset="20">20억</button>
              </div>
            </div>
            <div class="field">
              <label class="checkbox-row"><input id="hold-onehome" type="checkbox" checked /><span>1세대 1주택 단독명의 (종부세 12억 공제 · 재산세 43~45% 특례)</span></label>
              <div id="hold-three-field" hidden>
                <label class="checkbox-row"><input id="hold-threeplus" type="checkbox" /><span>3주택 이상 보유 (종부세 중과세율 적용)</span></label>
              </div>
            </div>
            <div class="field-row">
              <div class="field">
                <label for="hold-age">소유자 연령 (만 60세+ 공제)</label>
                <div class="input-wrap"><input id="hold-age" type="number" min="20" max="100" step="1" value="45" /><span class="input-unit">세</span></div>
              </div>
              <div class="field">
                <label for="hold-years">주택 보유기간 (5년+ 공제)</label>
                <div class="input-wrap"><input id="hold-years" type="number" min="0" max="40" step="1" value="5" /><span class="input-unit">년</span></div>
              </div>
            </div>
            <p class="calc-note">2026년 1주택 재산세 공정시장가액비율(43~45%), 종부세 기본공제(1주택 12억 / 일반 9억, 공정시장 60%) 기준 추정치입니다.</p>
          </div>
          <div class="sheet receipt">
            <h2 class="sheet-title">연간 보유세 (재산세 + 종부세)</h2>
            <div class="result-summary">
              <div class="result-label">예상 연간 총 보유세</div>
              <div class="result-main num" id="res-hold-main">${Calc.formatWon(res.totalHoldingTax)}</div>
              <div class="result-sub num" id="res-hold-sub">재산세 등 ${Calc.formatWon(res.totalPropertyTax)} + 종부세 등 ${Calc.formatWon(res.totalJongbuTax)}</div>
            </div>
            <table class="breakdown-table">
              <tbody>
                <tr><th>재산세 과세표준</th><td id="res-hold-prop-base">${Calc.formatWon(res.propBase)}</td></tr>
                <tr><th>재산세 본세</th><td id="res-hold-prop">${Calc.formatWon(res.propertyTax)}</td></tr>
                <tr><th>도시지역분 + 지방교육세</th><td id="res-hold-urban">${Calc.formatWon(res.urbanTax + res.propEduTax)}</td></tr>
                <tr><th>종부세 과세표준</th><td id="res-hold-jb-base">${Calc.formatWon(res.jongbuBase)}</td></tr>
                <tr><th>고령자·장기보유 세액공제</th><td id="res-hold-jb-credit">${res.creditRate > 0 ? Math.round(res.creditRate * 100) + "% 적용" : "해당 없음"}</td></tr>
                <tr><th>종합부동산세 + 농특세</th><td id="res-hold-jb">${Calc.formatWon(res.totalJongbuTax)}</td></tr>
                <tr class="total-row"><th>연간 총 보유세 합계</th><td id="res-hold-total">${Calc.formatWon(res.totalHoldingTax)}</td></tr>
              </tbody>
            </table>
            ${renderResultActions("hold")}
          </div>
        </section>
      `;
    }

    const matrixLinks = (current) => `
      <section class="section-block">
        <h2>공시가격별 보유세 계산</h2>
        <div class="link-matrix">
          ${prices.map((p) => `<a class="matrix-pill ${current === p ? "current" : ""}" href="/holding-tax/${p}-eok/">공시가 ${p}억 원</a>`).join("")}
        </div>
      </section>
    `;

    const faqs = [
      {
        q: "종합부동산세는 공시가격이 얼마를 넘어야 나오나요?",
        a: "2026년 기준 1세대 1주택 단독명의는 공시가격 12억 원 초과, 다주택자 또는 일반 개인은 공시가격 합계 9억 원 초과(부부 공동명의는 각 9억씩 18억 초과)부터 종부세가 부과됩니다."
      },
      {
        q: "재산세와 종부세는 언제 납부하나요?",
        a: "매년 6월 1일 소유자를 기준으로 재산세는 7월과 9월에 절반씩 나누어 내고, 종합부동산세는 12월 1일~15일에 납부합니다."
      }
    ];

    const related = renderRelatedCalcs([
      { title: "주택 취등록세", desc: "주택 매수 시 취등록세 계산", href: "/real-estate/" },
      { title: "부동산 양도세", desc: "주택 매도 시 양도소득세 계산", href: "/transfer-tax/" }
    ]);

    writePage(
      "/holding-tax/",
      renderLayout({
        routePath: "/holding-tax/",
        title: `${DATA.year} 보유세 계산기 (재산세 · 종합부동산세 1주택 12억 공제)`,
        description: "주택 공시가격으로 2026년 재산세(1주택 43~45% 공정시장가액비율)와 종합부동산세(12억/9억 공제·고령자·장기보유 공제)를 계산합니다.",
        activeNav: "holding-tax",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "보유세(재산세·종부세)", href: "/holding-tax/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <h1>${DATA.year} 보유세 (재산세 · 종부세) 계산기</h1>
            <p class="subtitle">주택 공시가격과 1주택·연령·보유기간으로 7·9월 재산세와 12월 종부세를 계산합니다.</p>
          </header>
          ${renderWidget(15)}
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("holdingTax")}
          ${renderAffiliateCard("holdingTax")}
          ${renderOfficialLinks("holdingTax")}
          ${related}
          ${matrixLinks(null)}
          ${renderFaqSection(faqs)}
        `
      })
    );

    prices.forEach((p, idx) => {
      const r1 = Calc.calcHoldingTax({ officialPrice: p * 1e8, isOneHome: true, ownerAge: 45, holdYears: 5 });
      const rMulti = Calc.calcHoldingTax({ officialPrice: p * 1e8, isOneHome: false, isThreePlus: false });
      const prev = idx > 0 ? { href: `/holding-tax/${prices[idx - 1]}-eok/`, label: `공시가 ${prices[idx - 1]}억 원` } : null;
      const next = idx < prices.length - 1 ? { href: `/holding-tax/${prices[idx + 1]}-eok/`, label: `공시가 ${prices[idx + 1]}억 원` } : null;
      const cmp = renderCompareTable({
        title: `공시가격 ${p}억 원 1주택 vs 다주택 보유세 비교`,
        subtitle: "2026년 1주택 재산세 특례(43~45%)와 종부세 12억·9억 기본공제 기준입니다.",
        headers: [
          { label: "보유 조건" },
          { label: "재산세 등", num: true },
          { label: "종부세 등", num: true },
          { label: "연간 총 보유세", num: true }
        ],
        rows: [
          { current: true, cells: ["1세대 1주택 (5년 보유)", Calc.formatWon(r1.totalPropertyTax), Calc.formatWon(r1.totalJongbuTax), Calc.formatWon(r1.totalHoldingTax)] },
          { current: false, cells: ["일반 2주택 (공제 9억)", Calc.formatWon(rMulti.totalPropertyTax), Calc.formatWon(rMulti.totalJongbuTax), Calc.formatWon(rMulti.totalHoldingTax)] }
        ]
      });
      writePage(
        `/holding-tax/${p}-eok/`,
        renderLayout({
          routePath: `/holding-tax/${p}-eok/`,
          title: `공시가격 ${p}억 원 보유세 (재산세·종부세 ${Calc.formatWon(r1.totalHoldingTax)})`,
          description: `공시가격 ${p}억 원 1세대 1주택(5년 보유) 기준 예상 보유세는 연 ${Calc.formatWon(r1.totalHoldingTax)}(재산세 ${Calc.formatWon(r1.totalPropertyTax)} + 종부세 ${Calc.formatWon(r1.totalJongbuTax)})입니다.`,
          activeNav: "holding-tax",
          priority: "0.75",
          breadcrumbs: [
            { label: "홈", href: "/" },
            { label: "보유세", href: "/holding-tax/" },
            { label: `공시가 ${p}억 원`, href: `/holding-tax/${p}-eok/` }
          ],
          faqs,
          bodyHtml: `
            <header class="page-head">
              <h1>공시가격 ${p}억 원 보유세 (재산세·종부세)</h1>
              <p class="subtitle">1세대 1주택(5년 보유) 기준 연간 예상 보유세는 <strong>${Calc.formatWon(r1.totalHoldingTax)}</strong>입니다.</p>
            </header>
            ${renderWidget(p)}
            ${renderAdSlot("pseoMid")}
            ${cmp}
            ${renderTaxTipsSection("holdingTax")}
            ${renderAffiliateCard("holdingTax")}
            ${renderOfficialLinks("holdingTax")}
            ${related}
            ${renderPrevNext(prev, next)}
            ${matrixLinks(p)}
          `
        })
      );
    });
  }

  /* 20. 근로장려금 · 자녀장려금 계산기 */
  function buildEitcPage() {
    const res = Calc.calcEitc({ household: "single", income: 1200 * 10000, children: 0, assets: 1 * 100000000 });
    const faqs = [
      {
        q: "2026년 근로장려금 소득 기준과 최대 지급액은 얼마인가요?",
        a: "단독가구 연 2,200만 원 미만(최대 165만 원), 홑벌이가구 3,200만 원 미만(최대 285만 원), 맞벌이가구 4,400만 원 미만(최대 330만 원)이며, 가구 재산 합계가 2억 4,000만 원 미만이어야 합니다."
      },
      {
        q: "자녀장려금은 근로장려금과 중복해서 받을 수 있나요?",
        a: "네, 18세 미만 부양자녀가 있고 부부합산 소득이 7,000만 원 미만·재산 2억 4,000만 원 미만이면 근로장려금과 별도로 자녀 1인당 50만~100만 원을 함께 받을 수 있습니다."
      }
    ];
    const related = renderRelatedCalcs([
      { title: "주휴수당 계산기", desc: "2026·2027 최저시급 기준 월급 환산", href: "/weekly-holiday/" },
      { title: "연말정산 계산기", desc: "근로소득세 예상 환급액 계산", href: "/year-end-tax/" }
    ]);

    writePage(
      "/eitc/",
      renderLayout({
        routePath: "/eitc/",
        title: `${DATA.year} 근로장려금 · 자녀장려금 계산기 (맞벌이 4,400만 원 기준)`,
        description: "가구 유형(단독·홑벌이·맞벌이), 연간 총소득, 자녀 수, 재산 합계로 2026년 근로장려금과 자녀장려금 자격 및 예상 수령액을 계산합니다.",
        activeNav: "eitc",
        priority: "0.9",
        breadcrumbs: [{ label: "홈", href: "/" }, { label: "근로·자녀장려금", href: "/eitc/" }],
        faqs,
        bodyHtml: `
          <header class="page-head">
            <div class="page-head-row">
              <h1>${DATA.year} 근로장려금 · 자녀장려금 계산기</h1>
              <span class="meta-tag">맞벌이 4,400만 확대 반영</span>
            </div>
            <p class="subtitle">가구 유형과 연 소득·재산 기준으로 예상 근로장려금과 자녀장려금을 바로 확인합니다.</p>
          </header>
          <section class="calc-grid">
            <div class="sheet">
              <h2 class="sheet-title">가구 · 소득 · 재산 입력</h2>
              <div class="field">
                <label for="eitc-household">가구 유형</label>
                <select id="eitc-household">
                  <option value="single" selected>단독가구 (배우자·부양자녀 없음 · 2,200만 미만)</option>
                  <option value="singleEarner">홑벌이가구 (외벌이·부양가족 있음 · 3,200만 미만)</option>
                  <option value="dualEarner">맞벌이가구 (부부 각 300만 이상 · 4,400만 미만)</option>
                </select>
              </div>
              <div class="field">
                <label for="eitc-income">연간 부부합산 총소득</label>
                <div class="input-wrap"><input id="eitc-income" type="number" min="0" step="100" value="1200" /><span class="input-unit">만 원</span></div>
                <div class="preset-row" id="eitc-presets">
                  <button type="button" class="chip-btn" data-preset="800">800만</button>
                  <button type="button" class="chip-btn" data-preset="1500">1,500만</button>
                  <button type="button" class="chip-btn" data-preset="2500">2,500만</button>
                  <button type="button" class="chip-btn" data-preset="3800">3,800만</button>
                </div>
              </div>
              <div class="field-row">
                <div class="field" id="eitc-child-field" hidden>
                  <label for="eitc-children">18세 미만 부양자녀 수</label>
                  <div class="input-wrap"><input id="eitc-children" type="number" min="0" max="10" step="1" value="0" /><span class="input-unit">명</span></div>
                </div>
                <div class="field">
                  <label for="eitc-assets">가구 재산 합계 (부채 미차감)</label>
                  <div class="input-wrap"><input id="eitc-assets" type="number" min="0" step="0.1" value="1" /><span class="input-unit">억 원</span></div>
                </div>
              </div>
              <p class="calc-note">재산 합계가 1억 7,000만 원 이상~2억 4,000만 원 미만이면 산정액의 50%가 감액되며, 2억 4,000만 원 이상은 제외됩니다.</p>
            </div>
            <div class="sheet receipt">
              <h2 class="sheet-title">예상 장려금 산출</h2>
              <div class="result-summary">
                <div class="result-label">예상 근로·자녀장려금 합계</div>
                <div class="result-main num" id="res-eitc-main">${Calc.formatWon(res.totalBenefit)}</div>
                <div class="result-sub num" id="res-eitc-sub">근로장려금 ${Calc.formatWon(res.eitc)} + 자녀장려금 ${Calc.formatWon(res.ctc)}</div>
                <p class="result-note" id="res-eitc-note" ${res.statusNote ? "" : "hidden"}>${res.statusNote || ""}</p>
              </div>
              <table class="breakdown-table">
                <tbody>
                  <tr><th>근로장려금 소득 상한</th><td id="res-eitc-limit">${Calc.formatWon(res.maxIncomeLimit)} 미만</td></tr>
                  <tr><th>재산 요건 (2.4억 미만)</th><td id="res-eitc-asset">충족 (100% 지급)</td></tr>
                  <tr><th>예상 근로장려금</th><td id="res-eitc-work">${Calc.formatWon(res.eitc)}</td></tr>
                  <tr class="total-row"><th>예상 자녀장려금</th><td id="res-eitc-child">${Calc.formatWon(res.ctc)}</td></tr>
                </tbody>
              </table>
              ${renderResultActions("eitc")}
            </div>
          </section>
          ${renderAdSlot("calcMid")}
          ${renderTaxTipsSection("eitc")}
          ${renderAffiliateCard("eitc")}
          ${renderOfficialLinks("eitc")}
          ${related}
          ${renderFaqSection(faqs)}
        `
      })
    );
  }

  buildYearEndTaxPages();
  buildCoupleTaxPage();
  buildBusinessTaxPages();
  buildInheritanceTaxPages();
  buildTransferTaxPages();
  buildVatPage();
  buildFinancialTaxPage();
  buildCarTaxPages();
  buildOtherIncomePage();
  buildHoldingTaxPages();
  buildEitcPage();
};
