#!/usr/bin/env node
"use strict";

const assert = require("assert");
const Calc = require("../src/calculators");

function runTests() {
  // 1. Salary Calculator
  const s5000 = Calc.calcSalary(50000000, 200000, 1);
  assert.strictEqual(s5000.monthlyGross, Math.round(50000000 / 12));
  assert(s5000.monthlyNet > 3400000 && s5000.monthlyNet < 3700000, `Unexpected 5000만 net: ${s5000.monthlyNet}`);
  assert(s5000.nationalPension > 0 && s5000.healthInsurance > 0);

  const sZero = Calc.calcSalary(0, 200000, 1);
  assert.strictEqual(sZero.monthlyNet, 0);
  assert.strictEqual(sZero.totalDeduction, 0);

  // National pension cap check at 1.5억
  const sHigh = Calc.calcSalary(150000000, 200000, 1);
  assert.strictEqual(sHigh.nationalPension, Math.floor((6170000 * 0.045) / 10) * 10);

  // 2. Freelancer 3.3%
  const f100 = Calc.calcFreelancer(1000000, "grossToNet");
  assert.strictEqual(f100.incomeTax, 30000);
  assert.strictEqual(f100.localTax, 3000);
  assert.strictEqual(f100.net, 967000);

  const fRev = Calc.calcFreelancer(967000, "netToGross");
  assert.strictEqual(fRev.gross, 1000000);
  assert.strictEqual(fRev.net, 967000);

  // 3. Overseas Stock Capital Gains Tax
  const stUnder = Calc.calcOverseasStockTax(2500000, 0);
  assert.strictEqual(stUnder.totalTax, 0);
  assert.strictEqual(stUnder.afterTaxProfit, 2500000);

  const st1000 = Calc.calcOverseasStockTax(10000000, 2000000);
  // netProfit = 8,000,000 -> taxableBase = 5,500,000 -> 22% = 1,210,000
  assert.strictEqual(st1000.taxableBase, 5500000);
  assert.strictEqual(st1000.totalTax, 1210000);
  assert.strictEqual(st1000.afterTaxProfit, 6790000);

  // 4. Real Estate Acquisition Tax
  const re5 = Calc.calcAcquisitionTax(500000000, 1, false);
  assert.strictEqual(re5.acquisitionTax, 5000000);
  assert.strictEqual(re5.localEducationTax, 500000);
  assert.strictEqual(re5.ruralSpecialTax, 0);
  assert.strictEqual(re5.totalTax, 5500000);

  const re10Over85 = Calc.calcAcquisitionTax(1000000000, 1, true);
  assert.strictEqual(re10Over85.acquisitionTax, 30000000);
  assert.strictEqual(re10Over85.localEducationTax, 3000000);
  assert.strictEqual(re10Over85.ruralSpecialTax, 2000000);
  assert.strictEqual(re10Over85.totalTax, 35000000);

  // 5. Jeonse to Wolse
  const jw = Calc.calcJeonseToWolse(300000000, 100000000, 6.0);
  // diff = 200,000,000 * 6% = 12,000,000 / 12 = 1,000,000
  assert.strictEqual(jw.monthlyRent, 1000000);
  assert.strictEqual(jw.yearlyRent, 12000000);

  // 6. Severance
  const sev = Calc.calcSeverance(4000000, 5);
  assert.strictEqual(sev.gross, 20000000);
  assert.strictEqual(sev.eligible, true);
  assert(sev.net > 19000000 && sev.net <= 20000000);
  const sevShort = Calc.calcSeverance(4000000, 0.5);
  assert.strictEqual(sevShort.eligible, false);
  assert.strictEqual(sevShort.gross, 0);

  // 7. Unemployment
  const unemp = Calc.calcUnemployment(4000000, false, 4);
  assert.strictEqual(unemp.dailyBenefit, 66000);
  assert.strictEqual(unemp.benefitDays, 180);
  assert.strictEqual(unemp.totalBenefit, 66000 * 180);

  // 8. Weekly Holiday Pay
  const wh40 = Calc.calcWeeklyHoliday(10030, 40);
  assert.strictEqual(wh40.eligible, true);
  assert.strictEqual(wh40.holidayHours, 8);
  assert.strictEqual(wh40.holidayPay, 80240);
  const wh10 = Calc.calcWeeklyHoliday(10030, 10);
  assert.strictEqual(wh10.eligible, false);
  assert.strictEqual(wh10.holidayPay, 0);

  // 9. Gift Tax
  const gift = Calc.calcGiftTax(100000000, "adultChild");
  // deduction 50M -> taxBase 50M -> 10% = 5M -> 3% voluntary credit = 150,000 -> final = 4,850,000
  assert.strictEqual(gift.taxBase, 50000000);
  assert.strictEqual(gift.calculatedTax, 5000000);
  assert.strictEqual(gift.voluntaryCredit, 150000);
  assert.strictEqual(gift.finalTax, 4850000);

  console.log("All 9 calculator unit tests passed!");
}

runTests();
