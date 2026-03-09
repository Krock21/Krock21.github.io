(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LifeSim = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var YEAR_METRIC_DEFS = [
    { key: 'employmentIncome', label: 'Income' },
    { key: 'livingExpenses', label: 'Expenses' },
    { key: 'housingCosts', label: 'Housing' },
    { key: 'investmentNetFlow', label: 'Investments flow' },
    { key: 'investmentGrowth', label: 'Growth' },
    { key: 'endingInvestments', label: 'End invest.' },
    { key: 'endingHomeEquity', label: 'Home equity' },
    { key: 'netWorth', label: 'Net worth' }
  ];

  function round2(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toNumber(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function toBoolean(value, fallback) {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value == null) {
      return fallback;
    }
    if (typeof value === 'string') {
      if (value.toLowerCase() === 'true') {
        return true;
      }
      if (value.toLowerCase() === 'false') {
        return false;
      }
    }
    return Boolean(value);
  }

  function monthlyRateFromAnnualPercent(annualPercent) {
    return Math.pow(1 + annualPercent / 100, 1 / 12) - 1;
  }

  function annualizeMonthlyGrowth(monthlyRate) {
    return Math.pow(1 + monthlyRate, 12) - 1;
  }

  function computeMonthlyMortgagePayment(principal, annualRatePercent, totalMonths) {
    if (principal <= 0 || totalMonths <= 0) {
      return 0;
    }
    var monthlyRate = annualRatePercent / 100 / 12;
    if (monthlyRate === 0) {
      return round2(principal / totalMonths);
    }
    var payment = principal * (monthlyRate / (1 - Math.pow(1 + monthlyRate, -totalMonths)));
    return round2(payment);
  }

  function estimateHomeValueFromEmploymentIncome(annualTotalCompensation) {
    var income = Math.max(0, toNumber(annualTotalCompensation, 0));
    if (income <= 0) {
      return 0;
    }
    var baseMortgage = income * 4.5;
    var singleBorrowerExtra = income >= 28000 ? 17000 : 0;
    return Math.round((baseMortgage + singleBorrowerExtra) / 1000) * 1000;
  }

  var DEFAULT_ANNUAL_INFLATION = 2.5;
  var DEFAULT_ANNUAL_TOTAL_COMPENSATION = 150000;
  var DEFAULT_HOME_VALUE = estimateHomeValueFromEmploymentIncome(DEFAULT_ANNUAL_TOTAL_COMPENSATION);
  var DEFAULT_MONTHLY_RENT = Math.round((DEFAULT_HOME_VALUE * 0.03 / 12) / 50) * 50;

  function cloneScenario(input) {
    return JSON.parse(JSON.stringify(input || {}));
  }

  function withDefaults(scenario) {
    var data = cloneScenario(scenario || {});
    data.life = data.life || {};

    data.life.simulationYears = clamp(Math.round(toNumber(data.life.simulationYears, 30)), 1, 80);
    data.life.annualInflation = toNumber(data.life.annualInflation, DEFAULT_ANNUAL_INFLATION);

    if (data.employment) {
      data.employment.enabled = data.employment.enabled !== false;
      data.employment.annualTotalCompensation = Math.max(0, toNumber(data.employment.annualTotalCompensation, DEFAULT_ANNUAL_TOTAL_COMPENSATION));
      data.employment.annualRaisePercent = toNumber(data.employment.annualRaisePercent, 3);
      data.employment.effectiveBox1TaxRatePercent = Math.max(0, toNumber(data.employment.effectiveBox1TaxRatePercent, 37));
    }

    if (data.expenses) {
      data.expenses.enabled = data.expenses.enabled !== false;
      data.expenses.monthlyAmount = Math.max(0, toNumber(data.expenses.monthlyAmount, 2500));
    }

    if (data.rent) {
      data.rent.enabled = data.rent.enabled !== false;
      data.rent.monthlyRent = Math.max(0, toNumber(data.rent.monthlyRent, DEFAULT_MONTHLY_RENT));
    }

    if (data.mortgage) {
      data.mortgage.enabled = data.mortgage.enabled !== false;
      data.mortgage.homeValue = Math.max(0, toNumber(
        data.mortgage.homeValue,
        data.employment && data.employment.enabled
          ? estimateHomeValueFromEmploymentIncome(data.employment.annualTotalCompensation)
          : DEFAULT_HOME_VALUE
      ));
      data.mortgage.outstandingPrincipal = Math.max(0, toNumber(data.mortgage.outstandingPrincipal, data.mortgage.homeValue));
      data.mortgage.annualInterestRate = Math.max(0, toNumber(data.mortgage.annualInterestRate, 4));
      data.mortgage.remainingTermYears = Math.max(0, toNumber(data.mortgage.remainingTermYears, 30));
      data.mortgage.annualMaintenanceRatePercent = Math.max(0, toNumber(data.mortgage.annualMaintenanceRatePercent, 1));
      data.mortgage.annualHomeValueGrowth = toNumber(data.mortgage.annualHomeValueGrowth, data.life.annualInflation);
      data.mortgage.annualOwnerTaxesRatePercent = Math.max(0, toNumber(data.mortgage.annualOwnerTaxesRatePercent, 0.1));
      data.mortgage.purchaseCostsRatePercent = Math.max(0, toNumber(data.mortgage.purchaseCostsRatePercent, 3));
      data.mortgage.saleCostsRatePercent = Math.max(0, toNumber(data.mortgage.saleCostsRatePercent, 1.5));
      data.mortgage.effectiveTaxReturnRatePercent = Math.max(0, toNumber(
        data.mortgage.effectiveTaxReturnRatePercent,
        data.employment && data.employment.enabled ? data.employment.effectiveBox1TaxRatePercent : 37
      ));
    }

    if (data.investing) {
      data.investing.enabled = data.investing.enabled !== false;
      data.investing.startingBalance = Math.max(0, toNumber(data.investing.startingBalance, 20000));
      data.investing.annualReturnPercent = toNumber(data.investing.annualReturnPercent, 7);
      if (data.investing.capitalGainsTaxRatePercent == null && data.investing.effectiveAnnualTaxPercent != null) {
        data.investing.capitalGainsTaxRatePercent = data.investing.effectiveAnnualTaxPercent;
      }
      data.investing.capitalGainsTaxRatePercent = Math.max(0, toNumber(data.investing.capitalGainsTaxRatePercent, 36));
      data.investing.taxUnrealizedGains = toBoolean(data.investing.taxUnrealizedGains, false);
    }

    return data;
  }

  function computeProjectedMortgageInterest(principal, annualInterestRate, remainingMonths, monthsToSimulate) {
    var balance = principal;
    var monthlyRate = annualInterestRate / 100 / 12;
    var payment = computeMonthlyMortgagePayment(balance, annualInterestRate, remainingMonths);
    var totalInterest = 0;
    var months = Math.min(remainingMonths, monthsToSimulate);
    var monthIndex;
    for (monthIndex = 0; monthIndex < months; monthIndex += 1) {
      if (balance <= 0) {
        break;
      }
      var interest = round2(balance * monthlyRate);
      var principalPaid = round2(Math.min(balance, Math.max(0, payment - interest)));
      balance = round2(Math.max(0, balance - principalPaid));
      totalInterest += interest;
    }
    return round2(totalInterest);
  }

  function computeTaxes(args) {
    var employmentIncome = args.employmentIncome;
    var deductibleInterest = args.deductibleInterest;
    var effectiveBox1TaxRatePercent = args.effectiveBox1TaxRatePercent;
    var effectiveTaxReturnRatePercent = args.effectiveTaxReturnRatePercent;
    var annualInvestmentGain = args.annualInvestmentGain;
    var capitalGainsTaxRatePercent = args.capitalGainsTaxRatePercent;
    var taxUnrealizedGains = args.taxUnrealizedGains;

    var employmentTax = round2(Math.max(0, employmentIncome) * (effectiveBox1TaxRatePercent / 100));
    var mortgageInterestTaxReturn = round2(Math.max(0, deductibleInterest) * (effectiveTaxReturnRatePercent / 100));
    var taxableInvestmentGain = taxUnrealizedGains ? Math.max(0, annualInvestmentGain) : 0;
    var investmentTax = round2(taxableInvestmentGain * (capitalGainsTaxRatePercent / 100));

    return {
      employmentTax: employmentTax,
      mortgageInterestTaxReturn: mortgageInterestTaxReturn,
      investmentTax: investmentTax,
      totalTax: round2(employmentTax + investmentTax - mortgageInterestTaxReturn),
      taxableInvestmentGain: round2(taxableInvestmentGain),
      taxUnrealizedGains: !!taxUnrealizedGains
    };
  }

  function getMortgagePreview(inputScenario) {
    var scenario = withDefaults(inputScenario);
    if (!scenario.mortgage) {
      return {
        grossMonthlyPayment: 0,
        firstMonthInterest: 0,
        firstMonthPrincipalPaid: 0,
        firstMonthMaintenance: 0,
        firstMonthOwnerTaxes: 0,
        firstMonthTaxReturn: 0,
        firstMonthNetPayment: 0,
        purchaseCosts: 0,
        saleCosts: 0
      };
    }

    var principal = scenario.mortgage.outstandingPrincipal;
    var remainingMonths = Math.round(scenario.mortgage.remainingTermYears * 12);
    var grossMonthlyPayment = computeMonthlyMortgagePayment(principal, scenario.mortgage.annualInterestRate, remainingMonths);
    var firstMonthInterest = remainingMonths > 0 && principal > 0
      ? round2(principal * (scenario.mortgage.annualInterestRate / 100 / 12))
      : 0;
    var firstMonthPrincipalPaid = round2(Math.min(principal, Math.max(0, grossMonthlyPayment - firstMonthInterest)));
    var firstMonthMaintenance = round2((scenario.mortgage.homeValue * (scenario.mortgage.annualMaintenanceRatePercent / 100)) / 12);
    var firstMonthOwnerTaxes = round2((scenario.mortgage.homeValue * (scenario.mortgage.annualOwnerTaxesRatePercent / 100)) / 12);
    var firstMonthTaxReturn = round2(firstMonthInterest * (scenario.mortgage.effectiveTaxReturnRatePercent / 100));
    var purchaseCosts = round2(scenario.mortgage.homeValue * (scenario.mortgage.purchaseCostsRatePercent / 100));
    var saleCosts = round2(scenario.mortgage.homeValue * (scenario.mortgage.saleCostsRatePercent / 100));

    return {
      grossMonthlyPayment: grossMonthlyPayment,
      firstMonthInterest: firstMonthInterest,
      firstMonthPrincipalPaid: firstMonthPrincipalPaid,
      firstMonthMaintenance: firstMonthMaintenance,
      firstMonthOwnerTaxes: firstMonthOwnerTaxes,
      firstMonthTaxReturn: firstMonthTaxReturn,
      firstMonthNetPayment: round2(grossMonthlyPayment + firstMonthMaintenance + firstMonthOwnerTaxes - firstMonthTaxReturn),
      purchaseCosts: purchaseCosts,
      saleCosts: saleCosts
    };
  }

  function defaultScenario() {
    return withDefaults({
      life: {
        simulationYears: 30,
        annualInflation: DEFAULT_ANNUAL_INFLATION
      },
      employment: {
        enabled: true,
        annualTotalCompensation: DEFAULT_ANNUAL_TOTAL_COMPENSATION,
        annualRaisePercent: 3,
        effectiveBox1TaxRatePercent: 37
      },
      expenses: {
        enabled: true,
        monthlyAmount: 2500
      },
      rent: {
        enabled: true,
        monthlyRent: DEFAULT_MONTHLY_RENT
      },
      mortgage: {
        enabled: false,
        homeValue: DEFAULT_HOME_VALUE,
        outstandingPrincipal: DEFAULT_HOME_VALUE,
        annualInterestRate: 4,
        remainingTermYears: 30,
        annualMaintenanceRatePercent: 1,
        annualHomeValueGrowth: DEFAULT_ANNUAL_INFLATION,
        annualOwnerTaxesRatePercent: 0.1,
        purchaseCostsRatePercent: 3,
        saleCostsRatePercent: 1.5,
        effectiveTaxReturnRatePercent: 37
      },
      investing: {
        enabled: true,
        startingBalance: 20000,
        annualReturnPercent: 7,
        capitalGainsTaxRatePercent: 36,
        taxUnrealizedGains: false
      }
    });
  }

  function validateScenario(scenario) {
    var warnings = [];
    if (scenario.rent && scenario.rent.enabled && scenario.mortgage && scenario.mortgage.enabled) {
      warnings.push({
        code: 'incompatibleBlocks',
        message: 'Rent and Mortgage cannot both be enabled in v1. Mortgage is used and Rent is ignored.'
      });
    }
    if (!scenario.employment || !scenario.employment.enabled) {
      warnings.push({
        code: 'missingEmployment',
        message: 'Employment is disabled. The simulation will run without income unless investments cover outflows.'
      });
    }
    return warnings;
  }

  function simulate(inputScenario) {
    var scenario = withDefaults(inputScenario);
    var warnings = validateScenario(scenario);
    var monthlyInvestmentRate = scenario.investing && scenario.investing.enabled
      ? monthlyRateFromAnnualPercent(scenario.investing.annualReturnPercent)
      : 0;
    var monthlyHomeGrowthRate = scenario.mortgage && scenario.mortgage.enabled
      ? monthlyRateFromAnnualPercent(scenario.mortgage.annualHomeValueGrowth)
      : 0;

    var investmentBalance = scenario.investing && scenario.investing.enabled ? scenario.investing.startingBalance : 0;
    var mortgageBalance = scenario.mortgage && scenario.mortgage.enabled ? scenario.mortgage.outstandingPrincipal : 0;
    var mortgageRemainingMonths = scenario.mortgage && scenario.mortgage.enabled ? Math.round(scenario.mortgage.remainingTermYears * 12) : 0;
    var homeValue = scenario.mortgage && scenario.mortgage.enabled ? scenario.mortgage.homeValue : 0;
    var purchaseCosts = scenario.mortgage && scenario.mortgage.enabled
      ? round2(scenario.mortgage.homeValue * (scenario.mortgage.purchaseCostsRatePercent / 100))
      : 0;
    var purchaseCostsPosted = false;

    var annualCompensation = scenario.employment && scenario.employment.enabled ? scenario.employment.annualTotalCompensation : 0;
    var annualRaisePercent = scenario.employment && scenario.employment.enabled ? scenario.employment.annualRaisePercent : 0;
    var monthlyExpenses = scenario.expenses && scenario.expenses.enabled ? scenario.expenses.monthlyAmount : 0;
    var monthlyRent = scenario.rent && scenario.rent.enabled && !(scenario.mortgage && scenario.mortgage.enabled) ? scenario.rent.monthlyRent : 0;

    var yearly = [];
    var yearIndex;
    for (yearIndex = 0; yearIndex < scenario.life.simulationYears; yearIndex += 1) {
      if (yearIndex > 0) {
        annualCompensation = round2(annualCompensation * (1 + annualRaisePercent / 100));
        monthlyExpenses = round2(monthlyExpenses * (1 + scenario.life.annualInflation / 100));
        monthlyRent = round2(monthlyRent * (1 + scenario.life.annualInflation / 100));
      }

      var yearNumber = yearIndex + 1;
      var openingHomeValueForYear = homeValue;
      var annualMaintenanceAmount = scenario.mortgage && scenario.mortgage.enabled
        ? round2(openingHomeValueForYear * (scenario.mortgage.annualMaintenanceRatePercent / 100))
        : 0;
      var annualOwnerTaxesAmount = scenario.mortgage && scenario.mortgage.enabled
        ? round2(openingHomeValueForYear * (scenario.mortgage.annualOwnerTaxesRatePercent / 100))
        : 0;

      var year = {
        yearNumber: yearNumber,
        yearLabel: 'Year ' + yearNumber,
        metrics: {
          employmentIncome: 0,
          livingExpenses: 0,
          housingCosts: 0,
          investmentNetFlow: 0,
          investmentGrowth: 0,
          endingInvestments: 0,
          endingHomeEquity: 0,
          netWorth: 0
        },
        months: [],
        taxSummary: null
      };

      var totalGrossEmploymentIncome = 0;
      var totalEmploymentTax = 0;
      var totalDeductibleInterest = 0;
      var totalMortgageInterestTaxReturn = 0;
      var totalGrossInvestmentGrowth = 0;
      var totalInvestmentTax = 0;

      var monthIndex;
      for (monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        var monthLabel = MONTH_NAMES[monthIndex];
        var lineItems = [];
        var monthlyInvestmentNetFlow = 0;
        var openingInvestmentBalance = investmentBalance;
        var salaryGross = round2(annualCompensation / 12);
        var salaryTax = round2(salaryGross * ((scenario.employment && scenario.employment.enabled ? scenario.employment.effectiveBox1TaxRatePercent : 0) / 100));
        var salaryNet = round2(salaryGross - salaryTax);
        var expenses = round2(monthlyExpenses);
        var rent = round2(monthlyRent);
        var ownerTaxes = round2(annualOwnerTaxesAmount / 12);
        var maintenance = round2(annualMaintenanceAmount / 12);
        var mortgagePayment = 0;
        var mortgageInterest = 0;
        var mortgagePrincipalPaid = 0;
        var mortgageTaxReturn = 0;

        if (scenario.employment && scenario.employment.enabled && salaryGross > 0) {
          monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow + salaryNet);
          totalGrossEmploymentIncome = round2(totalGrossEmploymentIncome + salaryGross);
          totalEmploymentTax = round2(totalEmploymentTax + salaryTax);
          year.metrics.employmentIncome = round2(year.metrics.employmentIncome + salaryNet);
          lineItems.push({
            key: 'employmentIncome',
            label: 'Employment gross income',
            amount: salaryGross,
            blockType: 'Employment',
            formula: 'annualTotalCompensationForYear / 12',
            explanation: 'Gross salary is taken from the Employment block, adjusted by the expected annual raise, and paid evenly each month.',
            inputs: {
              baseAnnualTotalCompensation: scenario.employment.annualTotalCompensation,
              annualRaisePercent: scenario.employment.annualRaisePercent,
              annualTotalCompensationForYear: annualCompensation,
              monthlyGrossIncome: salaryGross,
              yearNumber: yearNumber
            }
          });
          if (salaryTax > 0) {
            lineItems.push({
              key: 'employmentIncome',
              label: 'Employment tax',
              amount: -salaryTax,
              blockType: 'Employment',
              formula: 'monthlyGrossIncome * effectiveBox1TaxRatePercent',
              explanation: 'Employment tax is applied as a flat effective box 1 rate to this month\'s gross salary.',
              inputs: {
                monthlyGrossIncome: salaryGross,
                effectiveBox1TaxRatePercent: scenario.employment.effectiveBox1TaxRatePercent,
                monthlyEmploymentTax: salaryTax,
                monthlyNetIncome: salaryNet
              }
            });
          }
        }

        if (scenario.expenses && scenario.expenses.enabled && expenses > 0) {
          monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - expenses);
          year.metrics.livingExpenses = round2(year.metrics.livingExpenses - expenses);
          lineItems.push({
            key: 'livingExpenses',
            label: 'Living expenses',
            amount: -expenses,
            blockType: 'Expenses',
            formula: 'baseMonthlyAmount * inflationFactorForYear',
            explanation: 'Expenses are taken from the Expenses block and increased once per simulation year by the Life inflation rate.',
            inputs: {
              baseMonthlyAmount: scenario.expenses.monthlyAmount,
              annualInflation: scenario.life.annualInflation,
              inflationFactorForYear: Math.pow(1 + scenario.life.annualInflation / 100, Math.max(0, yearNumber - 1)),
              monthlyAmountForYear: monthlyExpenses,
              yearNumber: yearNumber
            }
          });
        }

        if (scenario.rent && scenario.rent.enabled && !(scenario.mortgage && scenario.mortgage.enabled) && rent > 0) {
          monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - rent);
          year.metrics.housingCosts = round2(year.metrics.housingCosts - rent);
          lineItems.push({
            key: 'housingCosts',
            label: 'Rent',
            amount: -rent,
            blockType: 'Rent',
            formula: 'baseMonthlyRent * inflationFactorForYear',
            explanation: 'Rent is taken from the Rent block, includes renter insurance, and rises once per simulation year by the Life inflation rate.',
            inputs: {
              baseMonthlyRent: scenario.rent.monthlyRent,
              annualInflation: scenario.life.annualInflation,
              inflationFactorForYear: Math.pow(1 + scenario.life.annualInflation / 100, Math.max(0, yearNumber - 1)),
              monthlyRentForYear: monthlyRent,
              yearNumber: yearNumber
            }
          });
        }

        if (scenario.mortgage && scenario.mortgage.enabled) {
          if (!purchaseCostsPosted && purchaseCosts > 0) {
            monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - purchaseCosts);
            year.metrics.housingCosts = round2(year.metrics.housingCosts - purchaseCosts);
            lineItems.push({
              key: 'housingCosts',
              label: 'Home purchase costs',
              amount: -purchaseCosts,
              blockType: 'Mortgage',
              formula: 'homeValue * purchaseCostsRatePercent',
              explanation: 'Purchase costs are posted once in the first simulated month as part of housing spend.',
              inputs: {
                homeValue: scenario.mortgage.homeValue,
                purchaseCostsRatePercent: scenario.mortgage.purchaseCostsRatePercent,
                purchaseCosts: purchaseCosts
              }
            });
            purchaseCostsPosted = true;
          }
          var mortgageRate = scenario.mortgage.annualInterestRate / 100 / 12;
          if (mortgageRemainingMonths > 0 && mortgageBalance > 0) {
            mortgagePayment = computeMonthlyMortgagePayment(mortgageBalance, scenario.mortgage.annualInterestRate, mortgageRemainingMonths);
            mortgageInterest = round2(mortgageBalance * mortgageRate);
            mortgagePrincipalPaid = round2(Math.min(mortgageBalance, Math.max(0, mortgagePayment - mortgageInterest)));
            mortgageTaxReturn = round2(mortgageInterest * (scenario.mortgage.effectiveTaxReturnRatePercent / 100));
            mortgageBalance = round2(Math.max(0, mortgageBalance - mortgagePrincipalPaid));
            mortgageRemainingMonths -= 1;
            totalDeductibleInterest = round2(totalDeductibleInterest + mortgageInterest);
            totalMortgageInterestTaxReturn = round2(totalMortgageInterestTaxReturn + mortgageTaxReturn);
            monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - mortgagePayment + mortgageTaxReturn);
            year.metrics.housingCosts = round2(year.metrics.housingCosts - mortgagePayment + mortgageTaxReturn);
            lineItems.push({
              key: 'housingCosts',
              label: 'Mortgage gross payment',
              amount: -mortgagePayment,
              blockType: 'Mortgage',
              formula: 'annuity payment = interest + principal',
              explanation: 'The gross mortgage payment is posted on the 1st day of the month and split into interest and principal.',
              inputs: {
                grossMonthlyPayment: mortgagePayment,
                firstMonthInterest: mortgageInterest,
                principalPaid: mortgagePrincipalPaid,
                outstandingPrincipalAfterPayment: mortgageBalance
              }
            });
            if (mortgageTaxReturn > 0) {
              lineItems.push({
                key: 'housingCosts',
                label: 'Mortgage tax return',
                amount: mortgageTaxReturn,
                blockType: 'Mortgage',
                formula: 'monthlyMortgageInterest * effectiveTaxReturnRatePercent',
                explanation: 'The mortgage tax return applies only to the interest part of this month\'s mortgage payment.',
                inputs: {
                  monthlyMortgageInterest: mortgageInterest,
                  effectiveTaxReturnRatePercent: scenario.mortgage.effectiveTaxReturnRatePercent,
                  monthlyMortgageTaxReturn: mortgageTaxReturn
                }
              });
            }
          }

          if (maintenance > 0) {
            monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - maintenance);
            year.metrics.housingCosts = round2(year.metrics.housingCosts - maintenance);
            lineItems.push({
              key: 'housingCosts',
              label: 'Home maintenance',
              amount: -maintenance,
              blockType: 'Mortgage',
              formula: 'openingHomeValueForYear * annualMaintenanceRatePercent / 12',
              explanation: 'Maintenance is modeled as a yearly percentage of the opening home value and then spread evenly across the year.',
              inputs: {
                openingHomeValueForYear: openingHomeValueForYear,
                annualMaintenanceRatePercent: scenario.mortgage.annualMaintenanceRatePercent,
                annualMaintenanceAmount: annualMaintenanceAmount,
                monthlyMaintenance: maintenance
              }
            });
          }

          if (ownerTaxes > 0) {
            monthlyInvestmentNetFlow = round2(monthlyInvestmentNetFlow - ownerTaxes);
            year.metrics.housingCosts = round2(year.metrics.housingCosts - ownerTaxes);
            lineItems.push({
              key: 'housingCosts',
              label: 'Owner taxes',
              amount: -ownerTaxes,
              blockType: 'Mortgage',
              formula: 'openingHomeValueForYear * annualOwnerTaxesRatePercent / 12',
              explanation: 'Owner taxes are modeled as a yearly percentage of the opening home value and then spread evenly across the year.',
              inputs: {
                openingHomeValueForYear: openingHomeValueForYear,
                annualOwnerTaxesRatePercent: scenario.mortgage.annualOwnerTaxesRatePercent,
                annualOwnerTaxesAmount: annualOwnerTaxesAmount,
                monthlyOwnerTaxes: ownerTaxes
              }
            });
          }
        }

        investmentBalance = round2(investmentBalance + monthlyInvestmentNetFlow);
        year.metrics.investmentNetFlow = round2(year.metrics.investmentNetFlow + monthlyInvestmentNetFlow);
        if (monthlyInvestmentNetFlow !== 0) {
          lineItems.push({
            key: 'investmentNetFlow',
            label: monthlyInvestmentNetFlow >= 0 ? 'Net flow into investments' : 'Net withdrawal from investments',
            amount: monthlyInvestmentNetFlow,
            blockType: 'Investing',
            formula: 'net income - expenses - housing costs',
            explanation: 'All monthly net inflows and outflows settle directly into the investment balance because the model holds no separate cash account.',
            inputs: {
              monthlyNetIncome: salaryNet,
              monthlyExpenses: expenses,
              monthlyHousingCost: round2(lineItems.reduce(function (accumulator, item) {
                return item.key === 'housingCosts' ? accumulator + item.amount : accumulator;
              }, 0)),
              monthlyInvestmentNetFlow: monthlyInvestmentNetFlow,
              endingInvestmentsAfterFlow: investmentBalance
            }
          });
        }

        if (scenario.investing && scenario.investing.enabled && openingInvestmentBalance > 0) {
          var grossGrowth = round2(openingInvestmentBalance * monthlyInvestmentRate);
          var investmentTax = scenario.investing.taxUnrealizedGains
            ? round2(grossGrowth * (scenario.investing.capitalGainsTaxRatePercent / 100))
            : 0;
          var netGrowth = round2(grossGrowth - investmentTax);
          investmentBalance = round2(investmentBalance + netGrowth);
          totalGrossInvestmentGrowth = round2(totalGrossInvestmentGrowth + grossGrowth);
          totalInvestmentTax = round2(totalInvestmentTax + investmentTax);
          year.metrics.investmentGrowth = round2(year.metrics.investmentGrowth + netGrowth);
          lineItems.push({
            key: 'investmentGrowth',
            label: 'Gross investment growth',
            amount: grossGrowth,
            blockType: 'Investing',
            formula: 'openingInvestmentBalance * monthlyGrowthRate',
            explanation: 'Gross growth is applied on the last day of the month to the opening invested balance only.',
            inputs: {
              openingInvestmentBalance: openingInvestmentBalance,
              monthlyGrowthRate: monthlyInvestmentRate,
              annualReturnPercent: scenario.investing.annualReturnPercent,
              grossInvestmentGrowth: grossGrowth
            }
          });
          if (investmentTax > 0) {
            lineItems.push({
              key: 'investmentGrowth',
              label: 'Investment tax',
              amount: -investmentTax,
              blockType: 'Investing',
              formula: 'grossInvestmentGrowth * capitalGainsTaxRatePercent',
              explanation: 'Investment tax is applied to gross monthly growth when unrealised gains are taxed in this simplified future box 3 approximation.',
              inputs: {
                grossInvestmentGrowth: grossGrowth,
                capitalGainsTaxRatePercent: scenario.investing.capitalGainsTaxRatePercent,
                monthlyInvestmentTax: investmentTax,
                taxUnrealizedGains: scenario.investing.taxUnrealizedGains,
                netInvestmentGrowth: netGrowth
              }
            });
          }
        }

        if (scenario.mortgage && scenario.mortgage.enabled && homeValue > 0) {
          homeValue = round2(homeValue * (1 + monthlyHomeGrowthRate));
        }

        if (investmentBalance < 0) {
          warnings.push({
            code: 'deficitInvestments',
            message: year.yearLabel + ' ' + monthLabel + ': investments fall below zero. The simulator continues to show the underfunded path.'
          });
        }

        year.months.push({
          monthNumber: monthIndex + 1,
          monthLabel: monthLabel,
          lineItems: lineItems,
          endingInvestments: round2(investmentBalance),
          endingPrincipal: round2(mortgageBalance),
          endingHomeValue: round2(homeValue),
          endingSaleCosts: scenario.mortgage && scenario.mortgage.enabled
            ? round2(homeValue * (scenario.mortgage.saleCostsRatePercent / 100))
            : 0
        });
      }

      var actualTaxes = computeTaxes({
        employmentIncome: round2(totalGrossEmploymentIncome),
        deductibleInterest: round2(totalDeductibleInterest),
        effectiveBox1TaxRatePercent: scenario.employment && scenario.employment.enabled ? scenario.employment.effectiveBox1TaxRatePercent : 0,
        effectiveTaxReturnRatePercent: scenario.mortgage && scenario.mortgage.enabled ? scenario.mortgage.effectiveTaxReturnRatePercent : 0,
        annualInvestmentGain: round2(totalGrossInvestmentGrowth),
        capitalGainsTaxRatePercent: scenario.investing && scenario.investing.enabled ? scenario.investing.capitalGainsTaxRatePercent : 0,
        taxUnrealizedGains: scenario.investing && scenario.investing.enabled ? scenario.investing.taxUnrealizedGains : false
      });
      var actualAnnualTax = round2(totalEmploymentTax + totalInvestmentTax - totalMortgageInterestTaxReturn);

      year.taxSummary = {
        actualAnnualTax: actualAnnualTax,
        employmentTax: round2(totalEmploymentTax),
        mortgageInterestTaxReturn: round2(totalMortgageInterestTaxReturn),
        investmentTax: round2(totalInvestmentTax),
        deductibleMortgageInterest: round2(totalDeductibleInterest),
        taxableInvestmentGain: actualTaxes.taxableInvestmentGain,
        annualInvestmentGain: round2(totalGrossInvestmentGrowth),
        effectiveBox1TaxRatePercent: scenario.employment && scenario.employment.enabled ? scenario.employment.effectiveBox1TaxRatePercent : 0,
        effectiveTaxReturnRatePercent: scenario.mortgage && scenario.mortgage.enabled ? scenario.mortgage.effectiveTaxReturnRatePercent : 0,
        capitalGainsTaxRatePercent: scenario.investing && scenario.investing.enabled ? scenario.investing.capitalGainsTaxRatePercent : 0,
        taxUnrealizedGains: scenario.investing && scenario.investing.enabled ? scenario.investing.taxUnrealizedGains : false
      };

      year.metrics.endingInvestments = round2(investmentBalance);
      year.metrics.endingHomeEquity = scenario.mortgage && scenario.mortgage.enabled
        ? round2(homeValue - round2(homeValue * (scenario.mortgage.saleCostsRatePercent / 100)) - mortgageBalance)
        : 0;
      year.metrics.netWorth = round2(investmentBalance + year.metrics.endingHomeEquity);

      yearly.push(year);
    }

    return {
      scenario: scenario,
      yearly: yearly,
      warnings: dedupeWarnings(warnings),
      yearMetricDefs: YEAR_METRIC_DEFS
    };
  }

  function dedupeWarnings(warnings) {
    var seen = Object.create(null);
    return warnings.filter(function (warning) {
      var key = warning.code + '|' + warning.message;
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  function summarizeResult(result) {
    var lastYear = result.yearly[result.yearly.length - 1];
    return {
      finalYear: lastYear ? lastYear.yearLabel : 'Year 0',
      endingInvestments: lastYear ? lastYear.metrics.endingInvestments : 0,
      endingHomeEquity: lastYear ? lastYear.metrics.endingHomeEquity : 0,
      netWorth: lastYear ? lastYear.metrics.netWorth : 0,
      warnings: result.warnings.length
    };
  }

  function getYearMetricDefs() {
    return YEAR_METRIC_DEFS.slice();
  }

  return {
    defaultScenario: defaultScenario,
    simulate: simulate,
    summarizeResult: summarizeResult,
    getYearMetricDefs: getYearMetricDefs,
    annualizeMonthlyGrowth: annualizeMonthlyGrowth,
    computeTaxes: computeTaxes,
    computeMonthlyMortgagePayment: computeMonthlyMortgagePayment,
    computeProjectedMortgageInterest: computeProjectedMortgageInterest,
    estimateHomeValueFromEmploymentIncome: estimateHomeValueFromEmploymentIncome,
    getMortgagePreview: getMortgagePreview,
    withDefaults: withDefaults
  };
}));
