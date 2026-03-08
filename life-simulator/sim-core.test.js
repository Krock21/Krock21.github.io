const test = require('node:test');
const assert = require('node:assert/strict');
const LifeSim = require('./sim-core.js');

test('employment-only scenario grows investments and keeps positive net worth', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 2, annualInflation: 2 },
    employment: { enabled: true, annualTotalCompensation: 72000, annualRaisePercent: 3, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: true, monthlyAmount: 2000 },
    rent: { enabled: true, monthlyRent: 1500 },
    investing: { enabled: true, startingBalance: 10000, annualReturnPercent: 6, capitalGainsTaxRatePercent: 20 }
  });

  const result = LifeSim.simulate(scenario);
  const finalYear = result.yearly[result.yearly.length - 1];

  assert.ok(finalYear.metrics.endingInvestments > 10000);
  assert.ok(finalYear.metrics.netWorth > 0);
  assert.equal(result.warnings.some((warning) => warning.code === 'incompatibleBlocks'), false);
});

test('rent and mortgage enabled together emit incompatibility warning', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 2 },
    employment: { enabled: true, annualTotalCompensation: 90000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: true, monthlyAmount: 1500 },
    rent: { enabled: true, monthlyRent: 1500 },
    mortgage: {
      enabled: true,
      homeValue: 500000,
      outstandingPrincipal: 300000,
      annualInterestRate: 4,
      remainingTermYears: 25,
      annualMaintenanceRatePercent: 1,
      annualHomeValueGrowth: 2.5,
      annualOwnerTaxesRatePercent: 0.1,
      effectiveTaxReturnRatePercent: 37
    },
    investing: { enabled: true, startingBalance: 0, annualReturnPercent: 0, capitalGainsTaxRatePercent: 0 }
  });

  const result = LifeSim.simulate(scenario);
  assert.ok(result.warnings.some((warning) => warning.code === 'incompatibleBlocks'));
});

test('investment flow settles directly into investments with no separate cash account', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: true, annualTotalCompensation: 120000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: true, monthlyAmount: 1000 },
    rent: { enabled: true, monthlyRent: 2000 },
    investing: { enabled: true, startingBalance: 5000, annualReturnPercent: 0, capitalGainsTaxRatePercent: 0 }
  });

  const result = LifeSim.simulate(scenario);
  const firstMonth = result.yearly[0].months[0];
  const netFlow = firstMonth.lineItems.find((item) => item.key === 'investmentNetFlow');

  assert.equal(netFlow.amount, 3300);
  assert.equal(firstMonth.endingInvestments, 8300);
  assert.equal(result.yearly[0].metrics.investmentNetFlow, 39600);
});

test('investment growth uses opening balance and excludes same-month net flow from growth', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: false },
    expenses: { enabled: false },
    rent: { enabled: false },
    mortgage: { enabled: false },
    investing: { enabled: true, startingBalance: 1200, annualReturnPercent: 12, capitalGainsTaxRatePercent: 0 }
  });

  const result = LifeSim.simulate(scenario);
  const firstMonth = result.yearly[0].months[0];
  const netFlow = firstMonth.lineItems.find((item) => item.key === 'investmentNetFlow');
  const growth = firstMonth.lineItems.find((item) => item.label === 'Gross investment growth');

  assert.equal(netFlow, undefined);
  assert.ok(growth.amount > 0);
  assert.equal(growth.inputs.openingInvestmentBalance, 1200);
  assert.ok(growth.amount < 25);
});

test('employment uses a flat effective box 1 tax rate and posts net income', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: true, annualTotalCompensation: 120000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: false },
    rent: { enabled: false },
    mortgage: { enabled: false },
    investing: { enabled: false }
  });

  const result = LifeSim.simulate(scenario);
  const year = result.yearly[0];

  assert.equal(year.metrics.employmentIncome, 75600);
  assert.equal(year.taxSummary.employmentTax, 44400);
  assert.equal(year.taxSummary.actualAnnualTax, 44400);
});

test('mortgage defaults follow the simplified home-value model', () => {
  const scenario = LifeSim.withDefaults({
    life: { annualInflation: 5 },
    mortgage: { enabled: true, homeValue: 700000 }
  });

  assert.equal(scenario.mortgage.outstandingPrincipal, 700000);
  assert.equal(scenario.mortgage.annualInterestRate, 4);
  assert.equal(scenario.mortgage.remainingTermYears, 30);
  assert.equal(scenario.mortgage.annualMaintenanceRatePercent, 1);
  assert.equal(scenario.mortgage.annualHomeValueGrowth, 5);
  assert.equal(scenario.mortgage.annualOwnerTaxesRatePercent, 0.1);
});

test('mortgage home value defaults from employment income when not set', () => {
  const estimatedHomeValue = LifeSim.estimateHomeValueFromEmploymentIncome(100000);
  const scenario = LifeSim.withDefaults({
    employment: { enabled: true, annualTotalCompensation: 100000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    mortgage: { enabled: true }
  });

  assert.equal(estimatedHomeValue, 467000);
  assert.equal(scenario.mortgage.homeValue, estimatedHomeValue);
  assert.equal(scenario.mortgage.outstandingPrincipal, estimatedHomeValue);
});

test('mortgage preview exposes gross payment, first-month tax return, and first-month net payment', () => {
  const preview = LifeSim.getMortgagePreview({
    life: { annualInflation: 3 },
    mortgage: {
      enabled: true,
      homeValue: 600000,
      outstandingPrincipal: 600000,
      annualInterestRate: 4,
      remainingTermYears: 30,
      annualMaintenanceRatePercent: 1,
      annualHomeValueGrowth: 3,
      annualOwnerTaxesRatePercent: 0.1,
      effectiveTaxReturnRatePercent: 37
    }
  });

  assert.ok(preview.grossMonthlyPayment > 0);
  assert.ok(preview.firstMonthTaxReturn > 0);
  assert.equal(
    preview.firstMonthNetPayment,
    Number((preview.grossMonthlyPayment + preview.firstMonthMaintenance + preview.firstMonthOwnerTaxes - preview.firstMonthTaxReturn).toFixed(2))
  );
});

test('mortgage scenario embeds tax return inside housing and reduces principal', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: true, annualTotalCompensation: 100000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: true, monthlyAmount: 1800 },
    mortgage: {
      enabled: true,
      homeValue: 650000,
      outstandingPrincipal: 400000,
      annualInterestRate: 4,
      remainingTermYears: 30,
      annualMaintenanceRatePercent: 1,
      annualHomeValueGrowth: 2,
      annualOwnerTaxesRatePercent: 0.1,
      effectiveTaxReturnRatePercent: 37
    },
    investing: { enabled: true, startingBalance: 0, annualReturnPercent: 0, capitalGainsTaxRatePercent: 0 }
  });

  const result = LifeSim.simulate(scenario);
  const firstMonth = result.yearly[0].months[0];
  const grossPayment = firstMonth.lineItems.find((item) => item.label === 'Mortgage gross payment');
  const taxReturn = firstMonth.lineItems.find((item) => item.label === 'Mortgage tax return');
  const taxSummary = result.yearly[0].taxSummary;

  assert.ok(grossPayment.inputs.principalPaid > 0);
  assert.ok(firstMonth.endingPrincipal < 400000);
  assert.ok(taxReturn.amount > 0);
  assert.ok(taxSummary.deductibleMortgageInterest > 0);
  assert.ok(taxSummary.mortgageInterestTaxReturn > 0);
});

test('negative investments produce a warning but simulation continues', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: true, annualTotalCompensation: 24000, annualRaisePercent: 0, effectiveBox1TaxRatePercent: 37 },
    expenses: { enabled: true, monthlyAmount: 3000 },
    rent: { enabled: true, monthlyRent: 1500 },
    investing: { enabled: true, startingBalance: 0, annualReturnPercent: 0, capitalGainsTaxRatePercent: 0 }
  });

  const result = LifeSim.simulate(scenario);
  assert.ok(result.warnings.some((warning) => warning.code === 'deficitInvestments'));
  assert.equal(result.yearly.length, 1);
  assert.ok(result.yearly[0].metrics.endingInvestments < 0);
});

test('investment tax uses gross annual investment gains and net growth stays after-tax', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: false },
    expenses: { enabled: false },
    rent: { enabled: false },
    mortgage: { enabled: false },
    investing: { enabled: true, startingBalance: 10000, annualReturnPercent: 12, capitalGainsTaxRatePercent: 25 }
  });

  const result = LifeSim.simulate(scenario);
  const year = result.yearly[0];

  assert.ok(year.taxSummary.annualInvestmentGain > 0);
  assert.ok(Math.abs(year.taxSummary.investmentTax - Number((year.taxSummary.annualInvestmentGain * 0.25).toFixed(2))) < 0.05);
  assert.equal(year.taxSummary.taxableInvestmentGain, year.taxSummary.annualInvestmentGain);
  assert.ok(Math.abs(year.metrics.investmentGrowth - Number((year.taxSummary.annualInvestmentGain - year.taxSummary.investmentTax).toFixed(2))) < 0.05);
});

test('disabling unrealised gains tax removes investment tax and keeps growth gross', () => {
  const scenario = LifeSim.withDefaults({
    life: { simulationYears: 1, annualInflation: 0 },
    employment: { enabled: false },
    expenses: { enabled: false },
    rent: { enabled: false },
    mortgage: { enabled: false },
    investing: { enabled: true, startingBalance: 10000, annualReturnPercent: 12, capitalGainsTaxRatePercent: 36, taxUnrealizedGains: false }
  });

  const result = LifeSim.simulate(scenario);
  const year = result.yearly[0];

  assert.ok(year.taxSummary.annualInvestmentGain > 0);
  assert.equal(year.taxSummary.taxableInvestmentGain, 0);
  assert.equal(year.taxSummary.investmentTax, 0);
  assert.equal(year.metrics.investmentGrowth, year.taxSummary.annualInvestmentGain);
  assert.equal(year.taxSummary.taxUnrealizedGains, false);
});
