(function () {
  'use strict';

  var STORAGE_KEY = 'life-simulator-scenario-v1';
  var VIEW_STORAGE_KEY = 'life-simulator-view-v1';
  var VERSION_COOKIE_KEY = 'life-simulator-page-version';
  var VERSION_FALLBACK_KEY = 'life-simulator-page-version-fallback';
  var PAGE_VERSION = '2026-03-09-global-defaults-2';
  var BLOCK_META = {
    life: {
      label: 'Life',
      description: 'Global assumptions such as inflation and simulation length.',
      alwaysOn: true,
      fields: [
        { key: 'simulationYears', label: 'Simulation years', type: 'number', step: '1', min: '1', help: 'Shown as Year 1, Year 2, and so on.' },
        { key: 'annualInflation', label: 'Annual inflation (%)', type: 'number', step: '0.1', help: 'Default 2.5% is a neutral long-run inflation baseline for planning. Expenses, rent, and the default mortgage home-growth assumption use this rate.' }
      ]
    },
    employment: {
      label: 'Employment',
      description: 'Income from work, expressed as total annual compensation, annual raises, and a flat effective box 1 rate.',
      fields: [
        { key: 'annualTotalCompensation', label: 'Annual total compensation (€)', type: 'number', step: '1000', help: 'Default €150,000 is the seeded planning scenario and is paid evenly across 12 months.' },
        { key: 'annualRaisePercent', label: 'Expected annual raise (%)', type: 'number', step: '0.1', help: 'Default 3% is a neutral long-run nominal wage-growth assumption, applied at the start of each new simulation year.' },
        { key: 'effectiveBox1TaxRatePercent', label: 'Effective box 1 tax rate (%)', type: 'number', step: '0.1', help: 'Editable flat income-tax assumption used for planning rather than a full legal tax table.' }
      ]
    },
    expenses: {
      label: 'Expenses',
      description: 'Living costs such as food, transportation, and health insurance.',
      fields: [
        { key: 'monthlyAmount', label: 'Monthly amount (€)', type: 'number', step: '50', help: 'Default €2,500 is a planning placeholder for recurring living costs. This grows automatically with Life inflation.' }
      ]
    },
    rent: {
      label: 'Rent',
      description: 'Monthly rent including renter insurance.',
      fields: [
        { key: 'monthlyRent', label: 'Monthly rent (€)', type: 'number', step: '50', help: 'Default €1,750 is seeded as roughly 3% annual rent on the default home value implied by the default €150,000 compensation. It then grows with Life inflation.' }
      ]
    },
    mortgage: {
      label: 'Mortgage',
      description: 'Owner-occupied home driven by home value, percentage-based upkeep, purchase/sale costs, and a flat mortgage-interest tax return rate.',
      fields: [
        { key: 'homeValue', label: 'Home value (€)', type: 'number', step: '1000', help: 'Default home value is estimated from Employment compensation and follows it until you edit home value directly.' },
        { key: 'outstandingPrincipal', label: 'Outstanding principal (€)', type: 'number', step: '1000', help: 'Defaults to home value and follows it until you edit principal directly.' },
        { key: 'annualInterestRate', label: 'Annual interest rate (%)', type: 'number', step: '0.01', help: 'Default 4% is a neutral long-run mortgage-rate planning assumption used in the gross monthly annuity payment.' },
        { key: 'remainingTermYears', label: 'Remaining term (years)', type: 'number', step: '1', help: 'Total years remaining on the mortgage.' },
        { key: 'annualMaintenanceRatePercent', label: 'Annual maintenance (% of home value)', type: 'number', step: '0.1', help: 'Default 1% is a common long-run homeowner-maintenance rule of thumb.' },
        { key: 'annualHomeValueGrowth', label: 'Annual home value growth (%)', type: 'number', step: '0.1', help: 'Defaults to Life inflation as a conservative long-run nominal home-growth assumption and follows it until you edit this field directly.' },
        { key: 'annualOwnerTaxesRatePercent', label: 'Annual owner taxes (% of home value)', type: 'number', step: '0.01', help: 'Default 0.1% is a stylized ownership-cost placeholder used to derive yearly owner taxes.' },
        { key: 'purchaseCostsRatePercent', label: 'Purchase costs (% of home value)', type: 'number', step: '0.1', help: 'Default 3% is a planning placeholder for one-time buyer closing costs and taxes.' },
        { key: 'saleCostsRatePercent', label: 'Sale costs (% of home value)', type: 'number', step: '0.1', help: 'Default 1.5% is a planning placeholder for sale friction when home equity is shown as net sale proceeds.' },
        { key: 'effectiveTaxReturnRatePercent', label: 'Effective tax return rate (%)', type: 'number', step: '0.1', help: 'Editable flat mortgage-interest tax-return assumption used for planning.' },
      ]
    },
    investing: {
      label: 'Investing',
      description: 'Investment account that also acts as the settlement balance for monthly surpluses and deficits.',
      fields: [
        { key: 'startingBalance', label: 'Starting invested balance (€)', type: 'number', step: '1000', help: 'Default €20,000 gives the seeded scenario a small existing portfolio before month 1 begins.' },
        { key: 'annualReturnPercent', label: 'Expected annual return (%)', type: 'number', step: '0.1', help: 'Default 7% is a long-run global equity-return assumption for planning, not a short-term market forecast.' },
        { key: 'capitalGainsTaxRatePercent', label: 'Capital gains tax rate (%)', type: 'number', step: '0.1', help: 'Default 36% remains editable because the tax model is simplified and jurisdiction-specific.' },
        { key: 'taxUnrealizedGains', label: 'Tax unrealised gains', type: 'checkbox', help: 'Default off to keep the baseline closer to a realized-gains-style planning model. If checked, yearly paper gains are taxed.' }
      ]
    },
    taxes: {
      label: 'Taxes',
      description: 'Read-only explanation of the tax effects already embedded into Income, Housing, and Growth.',
      alwaysOn: true,
      fields: []
    }
  };
  var SUMMARY_SECTIONS = [
    {
      rootId: 'summary-balance-grid',
      metrics: [
        { key: 'endingInvestments', label: 'Investments' },
        { key: 'endingHomeEquity', label: 'Home equity' },
        { key: 'netWorth', label: 'Net worth' }
      ]
    },
    {
      rootId: 'summary-flow-grid',
      metrics: [
        { key: 'employmentIncome', label: 'Income', source: 'metrics' },
        { key: 'livingExpenses', label: 'Living spend', source: 'metrics', absolute: true },
        { key: 'housingCosts', label: 'Housing spend', source: 'metrics', absolute: true },
        { key: 'investmentGrowth', label: 'Growth', source: 'metrics' }
      ]
    }
  ];

  ensureStorageVersion();

  var initialScenario = loadScenario();
  var state = {
    scenario: initialScenario,
    view: normalizeView(loadView()),
    result: null,
    expandedYears: Object.create(null),
    expandedBlocks: deriveExpandedBlocks(initialScenario),
    selectedDetail: null,
    isDetailOpen: false,
    isConfigOpen: false
  };
  var chartInstances = [];

  function getCookie(name) {
    var cookies = typeof document !== 'undefined' && document.cookie ? document.cookie.split('; ') : [];
    var prefix = name + '=';
    var index;
    for (index = 0; index < cookies.length; index += 1) {
      if (cookies[index].indexOf(prefix) === 0) {
        return decodeURIComponent(cookies[index].slice(prefix.length));
      }
    }
    return null;
  }

  function setCookie(name, value) {
    try {
      document.cookie = name + '=' + encodeURIComponent(value) + '; path=/; max-age=31536000; SameSite=Lax';
    } catch (error) {
      return;
    }
  }

  function getStoredPageVersion() {
    var cookieValue = getCookie(VERSION_COOKIE_KEY);
    if (cookieValue) {
      return cookieValue;
    }
    try {
      return localStorage.getItem(VERSION_FALLBACK_KEY);
    } catch (error) {
      return null;
    }
  }

  function persistPageVersion() {
    setCookie(VERSION_COOKIE_KEY, PAGE_VERSION);
    try {
      localStorage.setItem(VERSION_FALLBACK_KEY, PAGE_VERSION);
    } catch (error) {
      return;
    }
  }

  function ensureStorageVersion() {
    if (getStoredPageVersion() === PAGE_VERSION) {
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VIEW_STORAGE_KEY);
    } catch (error) {
      // Ignore storage clear failures and still advance the version marker.
    }
    persistPageVersion();
  }

  function deriveExpandedBlocks(scenario) {
    var expanded = Object.create(null);
    Object.keys(BLOCK_META).forEach(function (blockKey) {
      var meta = BLOCK_META[blockKey];
      if (meta.alwaysOn || (scenario[blockKey] && scenario[blockKey].enabled)) {
        expanded[blockKey] = true;
      }
    });
    return expanded;
  }

  function loadScenario() {
    var stored = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    if (!stored) {
      return LifeSim.defaultScenario();
    }
    try {
      return LifeSim.withDefaults(JSON.parse(stored));
    } catch (error) {
      return LifeSim.defaultScenario();
    }
  }

  function saveScenario() {
    persistPageVersion();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.scenario));
    } catch (error) {
      return;
    }
  }

  function loadView() {
    var stored = null;
    try {
      stored = localStorage.getItem(VIEW_STORAGE_KEY);
    } catch (error) {
      stored = null;
    }
    if (!stored) {
      return normalizeView({});
    }
    try {
      return normalizeView(JSON.parse(stored));
    } catch (error) {
      return normalizeView({});
    }
  }

  function normalizeView(view) {
    var source = view || {};
    return {
      useCurrentMoney: !!source.useCurrentMoney,
      autoMortgageHomeValue: source.autoMortgageHomeValue !== false,
      autoMortgagePrincipal: source.autoMortgagePrincipal !== false,
      autoMortgageGrowth: source.autoMortgageGrowth !== false
    };
  }

  function saveView() {
    persistPageVersion();
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(state.view));
    } catch (error) {
      return;
    }
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-NL', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(value);
  }

  function formatCompactCurrency(value) {
    return new Intl.NumberFormat('en-NL', {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value);
  }

  function formatPercent(value, fractionDigits) {
    var digits = fractionDigits == null ? 2 : fractionDigits;
    var normalized = Math.abs(value) <= 1 ? value * 100 : value;
    return new Intl.NumberFormat('en-NL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(normalized) + '%';
  }

  function formatNumber(value, fractionDigits) {
    var digits = fractionDigits == null ? 2 : fractionDigits;
    return new Intl.NumberFormat('en-NL', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  function roundMoney(value) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  function inflationFactorForYear(yearNumber) {
    var annualInflation = state.scenario.life ? state.scenario.life.annualInflation : 0;
    return Math.pow(1 + annualInflation / 100, Math.max(0, yearNumber - 1));
  }

  function displayMoney(value, yearNumber) {
    if (!state.view.useCurrentMoney) {
      return value;
    }
    return value / inflationFactorForYear(yearNumber || 1);
  }

  function formatMoney(value, yearNumber, absolute) {
    var adjusted = displayMoney(value, yearNumber);
    return formatCurrency(absolute ? Math.abs(adjusted) : adjusted);
  }

  function disposeCharts() {
    chartInstances.forEach(function (instance) {
      if (instance && !instance.isDisposed()) {
        instance.dispose();
      }
    });
    chartInstances = [];
  }

  function resizeCharts() {
    chartInstances.forEach(function (instance) {
      if (instance && !instance.isDisposed()) {
        instance.resize();
      }
    });
  }

  function applyDerivedScenarioLinks() {
    state.view = normalizeView(state.view);
    if (!state.scenario.mortgage) {
      return;
    }
    if (state.view.autoMortgageHomeValue && state.scenario.employment && state.scenario.employment.enabled) {
      state.scenario.mortgage.homeValue = LifeSim.estimateHomeValueFromEmploymentIncome(state.scenario.employment.annualTotalCompensation);
    }
    if (state.view.autoMortgagePrincipal) {
      state.scenario.mortgage.outstandingPrincipal = state.scenario.mortgage.homeValue;
    }
    if (state.view.autoMortgageGrowth) {
      state.scenario.mortgage.annualHomeValueGrowth = state.scenario.life.annualInflation;
    }
  }

  function getMetricValue(metric, lastYear, summary) {
    if (metric.source === 'taxSummary') {
      return lastYear.taxSummary[metric.key];
    }
    if (metric.source === 'summary') {
      return summary[metric.key];
    }
    return lastYear.metrics[metric.key];
  }

  function attachClickableCard(card, detail) {
    if (!detail) {
      return card;
    }
    card.classList.add('clickable-card');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('title', 'Click to inspect the source blocks and formula.');
    card.addEventListener('click', function () {
      openDetail(detail);
    });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail(detail);
      }
    });
    return card;
  }

  function createSummaryCard(metric, value, yearNumber, detail) {
    var template = document.getElementById('metric-card-template');
    var card = template.content.firstElementChild.cloneNode(true);
    card.querySelector('.metric-label').textContent = metric.label;
    card.querySelector('.metric-value').textContent = formatMoney(value, yearNumber, metric.absolute);
    return attachClickableCard(card, detail);
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    return values.filter(function (value) {
      if (!value || seen[value]) {
        return false;
      }
      seen[value] = true;
      return true;
    });
  }

  function getMetricLabel(metricKey) {
    var defs = LifeSim.getYearMetricDefs();
    var index;
    for (index = 0; index < defs.length; index += 1) {
      if (defs[index].key === metricKey) {
        return defs[index].label;
      }
    }
    return humanizeKey(metricKey);
  }

  function collectMetricLineItems(year, metricKey) {
    var lineItems = [];
    year.months.forEach(function (month) {
      month.lineItems.forEach(function (lineItem) {
        if (lineItem.key === metricKey) {
          lineItems.push({ monthLabel: month.monthLabel, lineItem: lineItem });
        }
      });
    });
    return lineItems;
  }

  function groupLineItemsByLabel(entries) {
    return entries.reduce(function (accumulator, entry) {
      var key = entry.lineItem.label;
      accumulator[key] = roundMoney((accumulator[key] || 0) + entry.lineItem.amount);
      return accumulator;
    }, {});
  }

  function getEmploymentYearValues(yearNumber) {
    if (!state.scenario.employment || !state.scenario.employment.enabled) {
      return null;
    }
    var raiseFactor = Math.pow(1 + state.scenario.employment.annualRaisePercent / 100, Math.max(0, yearNumber - 1));
    var annualCompensationForYear = roundMoney(state.scenario.employment.annualTotalCompensation * raiseFactor);
    return {
      baseAnnualTotalCompensation: state.scenario.employment.annualTotalCompensation,
      annualRaisePercent: state.scenario.employment.annualRaisePercent,
      annualCompensationForYear: annualCompensationForYear,
      monthlyGrossIncome: roundMoney(annualCompensationForYear / 12),
      effectiveBox1TaxRatePercent: state.scenario.employment.effectiveBox1TaxRatePercent,
      annualEmploymentTax: roundMoney(annualCompensationForYear * (state.scenario.employment.effectiveBox1TaxRatePercent / 100)),
      annualNetIncome: roundMoney(annualCompensationForYear * (1 - state.scenario.employment.effectiveBox1TaxRatePercent / 100))
    };
  }

  function getExpenseYearValues(yearNumber) {
    if (!state.scenario.expenses || !state.scenario.expenses.enabled) {
      return null;
    }
    var inflationFactor = inflationFactorForYear(yearNumber);
    return {
      baseMonthlyAmount: state.scenario.expenses.monthlyAmount,
      annualInflation: state.scenario.life.annualInflation,
      inflationFactorForYear: roundMoney(inflationFactor),
      monthlyAmountForYear: roundMoney(state.scenario.expenses.monthlyAmount * inflationFactor)
    };
  }

  function getRentYearValues(yearNumber) {
    if (!state.scenario.rent || !state.scenario.rent.enabled || (state.scenario.mortgage && state.scenario.mortgage.enabled)) {
      return null;
    }
    var inflationFactor = inflationFactorForYear(yearNumber);
    return {
      baseMonthlyRent: state.scenario.rent.monthlyRent,
      annualInflation: state.scenario.life.annualInflation,
      inflationFactorForYear: roundMoney(inflationFactor),
      monthlyRentForYear: roundMoney(state.scenario.rent.monthlyRent * inflationFactor)
    };
  }

  function getMortgageYearValues(yearNumber) {
    if (!state.scenario.mortgage || !state.scenario.mortgage.enabled) {
      return null;
    }
    var homeGrowthFactor = Math.pow(1 + state.scenario.mortgage.annualHomeValueGrowth / 100, Math.max(0, yearNumber - 1));
    var openingHomeValueForYear = roundMoney(state.scenario.mortgage.homeValue * homeGrowthFactor);
    return {
      openingHomeValueForYear: openingHomeValueForYear,
      annualMaintenanceRatePercent: state.scenario.mortgage.annualMaintenanceRatePercent,
      annualMaintenanceAmount: roundMoney(openingHomeValueForYear * (state.scenario.mortgage.annualMaintenanceRatePercent / 100)),
      annualOwnerTaxesRatePercent: state.scenario.mortgage.annualOwnerTaxesRatePercent,
      annualOwnerTaxesAmount: roundMoney(openingHomeValueForYear * (state.scenario.mortgage.annualOwnerTaxesRatePercent / 100)),
      purchaseCostsRatePercent: state.scenario.mortgage.purchaseCostsRatePercent,
      purchaseCostsAmount: roundMoney(state.scenario.mortgage.homeValue * (state.scenario.mortgage.purchaseCostsRatePercent / 100)),
      saleCostsRatePercent: state.scenario.mortgage.saleCostsRatePercent,
      annualHomeValueGrowth: state.scenario.mortgage.annualHomeValueGrowth,
      effectiveTaxReturnRatePercent: state.scenario.mortgage.effectiveTaxReturnRatePercent
    };
  }

  function buildTraceDetail(options) {
    return {
      title: options.title,
      value: options.value,
      displayYearNumber: options.displayYearNumber,
      explanation: options.explanation,
      formula: options.formula || null,
      sourceBlocks: options.sourceBlocks || [],
      inputs: options.inputs || {},
      rollupSteps: options.rollupSteps || [],
      lineItems: options.lineItems || [],
      displayValue: options.displayValue || null
    };
  }

  function summarizeWarnings(warnings) {
    return warnings.reduce(function (accumulator, warning) {
      accumulator.total += 1;
      accumulator.byCode[warning.code] = (accumulator.byCode[warning.code] || 0) + 1;
      return accumulator;
    }, { total: 0, byCode: Object.create(null) });
  }

  function buildWarningText(summary) {
    var segments = [];
    if (summary.byCode.deficitInvestments) {
      segments.push(summary.byCode.deficitInvestments + ' underfunded-investment events');
    }
    if (summary.byCode.incompatibleBlocks) {
      segments.push(summary.byCode.incompatibleBlocks + ' incompatible block combinations');
    }
    if (summary.byCode.missingEmployment) {
      segments.push(summary.byCode.missingEmployment + ' income setup issues');
    }
    if (!segments.length) {
      segments.push(summary.total + ' warning events');
    }
    return segments.join(', ') + '. Open the inspector for full detail.';
  }

  function buildWarningDetail() {
    var summary = summarizeWarnings(state.result.warnings);
    var items = state.result.warnings.map(function (warning) {
      return warning.message;
    });
    var inputs = Object.keys(summary.byCode).reduce(function (accumulator, code) {
      accumulator[code] = String(summary.byCode[code]) + ' events';
      return accumulator;
    }, {});
    return {
      title: 'Scenario warnings',
      displayValue: String(summary.total) + ' warnings',
      explanation: 'Warnings are grouped here so the default view stays readable. The simulator still completed all years.',
      inputs: inputs,
      items: items
    };
  }

  function openDetail(detail) {
    state.selectedDetail = detail;
    state.isDetailOpen = true;
    state.isConfigOpen = false;
    renderOverlays();
  }

  function closeDetail() {
    state.isDetailOpen = false;
    renderOverlays();
  }

  function openConfig() {
    state.isConfigOpen = true;
    state.isDetailOpen = false;
    renderOverlays();
  }

  function closeConfig() {
    state.isConfigOpen = false;
    renderOverlays();
  }

  function syncOverlayState() {
    document.body.classList.toggle('drawer-open', !!state.isDetailOpen || !!state.isConfigOpen);
  }

  function renderOverlays() {
    renderSideActions();
    renderConfigDrawer();
    renderDetail();
    syncOverlayState();
  }

  function setBlockEnabled(blockKey, enabled) {
    var meta = BLOCK_META[blockKey];
    if (meta.alwaysOn) {
      return;
    }
    if (!state.scenario[blockKey]) {
      state.scenario[blockKey] = {};
    }
    state.scenario[blockKey].enabled = enabled;
    if (enabled) {
      state.expandedBlocks[blockKey] = true;
    }
    if (blockKey === 'rent' && enabled && state.scenario.mortgage) {
      state.scenario.mortgage.enabled = false;
    }
    if (blockKey === 'mortgage' && enabled && state.scenario.rent) {
      state.scenario.rent.enabled = false;
    }
  }

  function getHousingMode() {
    var rentEnabled = state.scenario.rent && state.scenario.rent.enabled;
    var mortgageEnabled = state.scenario.mortgage && state.scenario.mortgage.enabled;
    if (mortgageEnabled) {
      return 'mortgage';
    }
    if (rentEnabled) {
      return 'rent';
    }
    return 'none';
  }

  function setHousingMode(mode) {
    if (!state.scenario.rent) {
      state.scenario.rent = { enabled: false };
    }
    if (!state.scenario.mortgage) {
      state.scenario.mortgage = { enabled: false };
    }
    if (mode === 'mortgage') {
      state.scenario.mortgage.enabled = true;
      state.scenario.rent.enabled = false;
      return;
    }
    if (mode === 'rent') {
      state.scenario.rent.enabled = true;
      state.scenario.mortgage.enabled = false;
      return;
    }
    state.scenario.rent.enabled = false;
    state.scenario.mortgage.enabled = false;
  }

  function buildField(blockKey, field) {
    var wrapper = document.createElement('div');
    wrapper.className = 'field-group';

    var input = document.createElement('input');
    input.id = blockKey + '-' + field.key;
    input.type = field.type;
    var value = state.scenario[blockKey][field.key];
    if (field.type === 'checkbox') {
      wrapper.classList.add('checkbox-field');
      var checkboxLabel = document.createElement('label');
      checkboxLabel.className = 'checkbox-input-label';
      checkboxLabel.setAttribute('for', input.id);
      input.checked = !!value;
      input.addEventListener('change', function () {
        state.scenario[blockKey][field.key] = input.checked;
        state.selectedDetail = null;
        state.isDetailOpen = false;
        render();
      });
      checkboxLabel.appendChild(input);
      var checkboxText = document.createElement('span');
      checkboxText.textContent = field.label;
      checkboxLabel.appendChild(checkboxText);
      wrapper.appendChild(checkboxLabel);
    } else {
      var label = document.createElement('label');
      label.setAttribute('for', blockKey + '-' + field.key);
      label.textContent = field.label;
      wrapper.appendChild(label);
      input.step = field.step || 'any';
      if (field.min != null) {
        input.min = field.min;
      }
      input.value = value == null ? '' : value;
      input.placeholder = field.optional ? 'Auto' : '';
      input.addEventListener('change', function () {
        var raw = input.value;
        state.scenario[blockKey][field.key] = field.optional && raw === '' ? null : Number(raw);
        if (blockKey === 'mortgage' && field.key === 'homeValue') {
          state.view.autoMortgageHomeValue = false;
        }
        if (blockKey === 'mortgage' && field.key === 'outstandingPrincipal') {
          state.view.autoMortgagePrincipal = false;
        }
        if (blockKey === 'mortgage' && field.key === 'annualHomeValueGrowth') {
          state.view.autoMortgageGrowth = false;
        }
        state.selectedDetail = null;
        state.isDetailOpen = false;
        render();
      });
      wrapper.appendChild(input);
    }

    if (field.help) {
      var help = document.createElement('small');
      help.textContent = field.help;
      wrapper.appendChild(help);
    }

    return wrapper;
  }

  function appendReadonlyItem(grid, labelText, valueText) {
    var item = document.createElement('div');
    item.className = 'kv-item';
    var label = document.createElement('span');
    label.textContent = labelText;
    var value = document.createElement('strong');
    value.textContent = valueText;
    item.appendChild(label);
    item.appendChild(value);
    grid.appendChild(item);
  }

  function buildMortgagePreviewContent() {
    var wrapper = document.createElement('div');
    wrapper.className = 'read-only-tax-summary';

    var intro = document.createElement('p');
    intro.className = 'block-config-status';
    intro.textContent = 'These previews are based on the current mortgage inputs. The net payment includes first-month maintenance, owner taxes, and mortgage tax return. Purchase costs hit first-month housing once, and sale costs are used when showing equity.';
    wrapper.appendChild(intro);

    var preview = LifeSim.getMortgagePreview(state.scenario);
    var grid = document.createElement('div');
    grid.className = 'kv-grid read-only-grid';
    appendReadonlyItem(grid, 'Gross monthly payment', formatCurrency(preview.grossMonthlyPayment));
    appendReadonlyItem(grid, 'First month tax return', formatCurrency(preview.firstMonthTaxReturn));
    appendReadonlyItem(grid, 'First month net payment', formatCurrency(preview.firstMonthNetPayment));
    appendReadonlyItem(grid, 'Purchase costs today', formatCurrency(preview.purchaseCosts));
    appendReadonlyItem(grid, 'Sale costs today', formatCurrency(preview.saleCosts));
    wrapper.appendChild(grid);

    var linkStatus = document.createElement('p');
    linkStatus.className = 'block-config-status';
    linkStatus.textContent = 'Home value follows Employment income: ' + (state.view.autoMortgageHomeValue ? 'Yes' : 'No') + '. Principal follows home value: ' + (state.view.autoMortgagePrincipal ? 'Yes' : 'No') + '. Home growth follows Life inflation: ' + (state.view.autoMortgageGrowth ? 'Yes' : 'No') + '.';
    wrapper.appendChild(linkStatus);

    return wrapper;
  }

  function buildTaxesReadonlyContent() {
    var wrapper = document.createElement('div');
    wrapper.className = 'read-only-tax-summary';

    var intro = document.createElement('p');
    intro.className = 'block-config-status';
    intro.textContent = 'Taxes are configured in Employment, Mortgage, and Investing. Income, Housing, and Growth already include these tax effects.';
    wrapper.appendChild(intro);

    var lastYear = state.result && state.result.yearly.length ? pickLastYear() : null;
    var ratesGrid = document.createElement('div');
    ratesGrid.className = 'kv-grid read-only-grid';
    appendReadonlyItem(
      ratesGrid,
      'Employment box 1',
      state.scenario.employment && state.scenario.employment.enabled
        ? formatPercent(state.scenario.employment.effectiveBox1TaxRatePercent, 1)
        : 'Off'
    );
    appendReadonlyItem(
      ratesGrid,
      'Mortgage tax return',
      state.scenario.mortgage && state.scenario.mortgage.enabled
        ? formatPercent(state.scenario.mortgage.effectiveTaxReturnRatePercent, 1)
        : 'Off'
    );
    appendReadonlyItem(
      ratesGrid,
      'Capital gains tax',
      state.scenario.investing && state.scenario.investing.enabled
        ? formatPercent(state.scenario.investing.capitalGainsTaxRatePercent, 1)
        : 'Off'
    );
    appendReadonlyItem(
      ratesGrid,
      'Tax unrealised gains',
      state.scenario.investing && state.scenario.investing.enabled
        ? (state.scenario.investing.taxUnrealizedGains ? 'Yes' : 'No')
        : 'Off'
    );
    wrapper.appendChild(ratesGrid);

    if (!lastYear) {
      return wrapper;
    }

    var yearLabel = document.createElement('p');
    yearLabel.className = 'block-config-status';
    yearLabel.textContent = lastYear.yearLabel + ' tax rollup';
    wrapper.appendChild(yearLabel);

    var totalsGrid = document.createElement('div');
    totalsGrid.className = 'kv-grid read-only-grid';
    appendReadonlyItem(totalsGrid, 'Embedded annual tax effect', formatMoney(lastYear.taxSummary.actualAnnualTax, lastYear.yearNumber));
    appendReadonlyItem(totalsGrid, 'Employment tax', formatMoney(lastYear.taxSummary.employmentTax, lastYear.yearNumber));
    appendReadonlyItem(totalsGrid, 'Deductible mortgage interest', formatMoney(lastYear.taxSummary.deductibleMortgageInterest, lastYear.yearNumber));
    appendReadonlyItem(totalsGrid, 'Mortgage tax return', formatMoney(-lastYear.taxSummary.mortgageInterestTaxReturn, lastYear.yearNumber));
    appendReadonlyItem(totalsGrid, 'Taxable investment gain', formatMoney(lastYear.taxSummary.taxableInvestmentGain, lastYear.yearNumber));
    appendReadonlyItem(totalsGrid, 'Investment tax', formatMoney(lastYear.taxSummary.investmentTax, lastYear.yearNumber));
    wrapper.appendChild(totalsGrid);

    return wrapper;
  }

  function buildBlockConfigCard(blockKey, meta) {
    var enabled = meta.alwaysOn || (state.scenario[blockKey] && state.scenario[blockKey].enabled);
    var expanded = !!state.expandedBlocks[blockKey];
    var card = document.createElement('section');
    card.className = 'block-config-card' + (enabled ? '' : ' is-disabled');

    var header = document.createElement('div');
    header.className = 'block-config-header';

    var toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'block-config-toggle';
    toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggleButton.addEventListener('click', function () {
      state.expandedBlocks[blockKey] = !expanded;
      renderBlockConfig();
    });

    var title = document.createElement('h3');
    title.textContent = meta.label;
    var description = document.createElement('p');
    description.textContent = meta.description;
    toggleButton.appendChild(title);
    toggleButton.appendChild(description);

    var actions = document.createElement('div');
    actions.className = 'block-config-actions';

    if (meta.alwaysOn) {
      var lockedBadge = document.createElement('span');
      lockedBadge.className = 'locked-badge';
      lockedBadge.textContent = 'Always on';
      actions.appendChild(lockedBadge);
    } else {
      var enableLabel = document.createElement('label');
      enableLabel.className = 'block-switch';
      var enableInput = document.createElement('input');
      enableInput.type = 'checkbox';
      enableInput.checked = !!enabled;
      enableInput.addEventListener('click', function (event) {
        event.stopPropagation();
      });
      enableInput.addEventListener('change', function () {
        setBlockEnabled(blockKey, enableInput.checked);
        state.selectedDetail = null;
        state.isDetailOpen = false;
        render();
      });
      var enableText = document.createElement('span');
      enableText.textContent = enabled ? 'Enabled' : 'Disabled';
      enableLabel.appendChild(enableInput);
      enableLabel.appendChild(enableText);
      actions.appendChild(enableLabel);
    }

    var expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className = 'ghost-button accordion-button';
    expandButton.textContent = expanded ? 'Collapse' : 'Expand';
    expandButton.addEventListener('click', function () {
      state.expandedBlocks[blockKey] = !expanded;
      renderBlockConfig();
    });
    actions.appendChild(expandButton);

    header.appendChild(toggleButton);
    header.appendChild(actions);
    card.appendChild(header);

    var body = document.createElement('div');
    body.className = 'block-config-body' + (expanded ? ' is-open' : '');
    if (!enabled && !meta.alwaysOn) {
      var status = document.createElement('p');
      status.className = 'block-config-status';
      status.textContent = 'Disabled blocks do not affect the simulation, but their values stay editable and are preserved.';
      body.appendChild(status);
    }
    if (blockKey === 'taxes') {
      body.appendChild(buildTaxesReadonlyContent());
    } else {
      var formGrid = document.createElement('div');
      formGrid.className = 'form-grid two-col';
      meta.fields.forEach(function (field) {
        formGrid.appendChild(buildField(blockKey, field));
      });
      body.appendChild(formGrid);
      if (blockKey === 'mortgage') {
        body.appendChild(buildMortgagePreviewContent());
      }
    }
    card.appendChild(body);

    return card;
  }

  function renderBlockConfig() {
    var container = document.getElementById('block-config-root');
    container.innerHTML = '';

    Object.keys(BLOCK_META).forEach(function (blockKey) {
      container.appendChild(buildBlockConfigCard(blockKey, BLOCK_META[blockKey]));
    });
  }

  function pickLastYear() {
    return state.result.yearly[state.result.yearly.length - 1];
  }

  function collectActualTaxDetail(year) {
    var employmentValues = getEmploymentYearValues(year.yearNumber);
    return buildTraceDetail({
      title: year.yearLabel + ' net tax',
      value: year.taxSummary.actualAnnualTax,
      displayYearNumber: year.yearNumber,
      explanation: 'Net tax is the sum of flat Employment tax and Investing tax, minus the Mortgage interest tax return.',
      formula: 'employmentTax + investmentTax - mortgageInterestTaxReturn',
      sourceBlocks: uniqueStrings([
        state.scenario.employment && state.scenario.employment.enabled ? 'Employment' : null,
        state.scenario.mortgage && state.scenario.mortgage.enabled ? 'Mortgage' : null,
        state.scenario.investing && state.scenario.investing.enabled ? 'Investing' : null,
        'Taxes'
      ]),
      inputs: {
        annualEmploymentIncome: employmentValues ? employmentValues.annualCompensationForYear : 0,
        effectiveBox1TaxRatePercent: year.taxSummary.effectiveBox1TaxRatePercent,
        employmentTax: year.taxSummary.employmentTax,
        deductibleMortgageInterest: year.taxSummary.deductibleMortgageInterest,
        effectiveTaxReturnRatePercent: year.taxSummary.effectiveTaxReturnRatePercent,
        mortgageInterestTaxReturn: year.taxSummary.mortgageInterestTaxReturn,
        annualInvestmentGain: year.taxSummary.annualInvestmentGain,
        taxableInvestmentGain: year.taxSummary.taxableInvestmentGain,
        capitalGainsTaxRatePercent: year.taxSummary.capitalGainsTaxRatePercent,
        taxUnrealizedGains: year.taxSummary.taxUnrealizedGains,
        investmentTax: year.taxSummary.investmentTax,
        actualAnnualTax: year.taxSummary.actualAnnualTax
      },
      rollupSteps: [
        'Employment applies its effective box 1 rate to the year\'s compensation.',
        'Mortgage applies its effective tax return rate to interest only, not to principal, maintenance, or owner taxes.',
        'Investing applies the capital gains tax rate to taxable annual investment gain.',
        'The three pieces are combined into one net annual tax number.'
      ],
      lineItems: []
    });
  }

  function collectSummaryMetricDetail(lastYear, metric) {
    if (metric.key === 'actualAnnualTax') {
      return collectActualTaxDetail(lastYear);
    }
    return collectYearMetricDetail(lastYear, metric.key);
  }

  function renderSummary() {
    var summary = LifeSim.summarizeResult(state.result);
    var lastYear = pickLastYear();
    SUMMARY_SECTIONS.forEach(function (section) {
      var grid = document.getElementById(section.rootId);
      grid.innerHTML = '';
      section.metrics.forEach(function (metric) {
        var value = getMetricValue(metric, lastYear, summary);
        grid.appendChild(createSummaryCard(metric, value, lastYear.yearNumber, {
          value: value,
          getDetail: function () {
            return collectSummaryMetricDetail(lastYear, metric, summary);
          }
        }));
      });
    });

    var warningList = document.getElementById('warning-summary');
    warningList.innerHTML = '';
    if (!state.result.warnings.length) {
      var okBanner = document.createElement('div');
      okBanner.className = 'ok-banner';
      var okCopy = document.createElement('div');
      okCopy.className = 'banner-copy';
      var okTitle = document.createElement('div');
      okTitle.className = 'banner-title';
      okTitle.textContent = 'No warnings in the current scenario';
      var okText = document.createElement('div');
      okText.className = 'banner-text';
      okText.textContent = 'The simulation completed without underfunded investments or incompatible block combinations.';
      okCopy.appendChild(okTitle);
      okCopy.appendChild(okText);
      okBanner.appendChild(okCopy);
      warningList.appendChild(okBanner);
      return;
    }
    var warningSummary = summarizeWarnings(state.result.warnings);
    var warningBanner = document.createElement('div');
    warningBanner.className = 'warning-banner';

    var warningCopy = document.createElement('div');
    warningCopy.className = 'banner-copy';
    var warningTitle = document.createElement('div');
    warningTitle.className = 'banner-title';
    warningTitle.textContent = warningSummary.total + ' warnings need attention';
    var warningText = document.createElement('div');
    warningText.className = 'banner-text';
    warningText.textContent = buildWarningText(warningSummary);
    warningCopy.appendChild(warningTitle);
    warningCopy.appendChild(warningText);

    var warningButton = document.createElement('button');
    warningButton.type = 'button';
    warningButton.className = 'banner-button';
    warningButton.textContent = 'Inspect warnings';
    warningButton.addEventListener('click', function () {
      openDetail({ getDetail: buildWarningDetail });
    });

    warningBanner.appendChild(warningCopy);
    warningBanner.appendChild(warningButton);
    warningList.appendChild(warningBanner);
  }

  function collectYearMetricDetail(year, metricKey) {
    var lineItems = collectMetricLineItems(year, metricKey);
    var groupedLineItems = groupLineItemsByLabel(lineItems);
    var employmentValues = getEmploymentYearValues(year.yearNumber);
    var expenseValues = getExpenseYearValues(year.yearNumber);
    var rentValues = getRentYearValues(year.yearNumber);
    var mortgageValues = getMortgageYearValues(year.yearNumber);
    var previousYear = year.yearNumber > 1 ? state.result.yearly[year.yearNumber - 2] : null;
    var endingMonth = year.months[year.months.length - 1];

    if (metricKey === 'employmentIncome') {
      if (!employmentValues) {
        return buildTraceDetail({
          title: year.yearLabel + ' income',
          value: year.metrics.employmentIncome,
          displayYearNumber: year.yearNumber,
          explanation: 'Employment is disabled in this scenario, so no income is posted.',
          formula: '0',
          sourceBlocks: ['Employment']
        });
      }
      return buildTraceDetail({
        title: year.yearLabel + ' income',
        value: year.metrics.employmentIncome,
        displayYearNumber: year.yearNumber,
        explanation: 'Income comes from the Employment block and is shown after the flat Employment tax has been withheld each month.',
        formula: 'annualCompensationForYear - annualEmploymentTax',
        sourceBlocks: ['Employment'],
        inputs: {
          baseAnnualTotalCompensation: employmentValues.baseAnnualTotalCompensation,
          annualRaisePercent: employmentValues.annualRaisePercent,
          annualCompensationForYear: employmentValues.annualCompensationForYear,
          effectiveBox1TaxRatePercent: employmentValues.effectiveBox1TaxRatePercent,
          monthlyGrossIncome: employmentValues.monthlyGrossIncome,
          annualEmploymentTax: employmentValues.annualEmploymentTax,
          annualNetIncome: employmentValues.annualNetIncome
        },
        rollupSteps: [
          'Start from Employment annual total compensation.',
          'Apply the expected annual raise for each completed prior simulation year.',
          'Calculate Employment tax using the effective box 1 rate.',
          'Post gross income and tax withholding separately each month.',
          'The yearly Income number is the net sum of those monthly postings.'
        ],
        lineItems: lineItems
      });
    }

    if (metricKey === 'livingExpenses') {
      if (!expenseValues) {
        return buildTraceDetail({
          title: year.yearLabel + ' living expenses',
          value: year.metrics.livingExpenses,
          displayYearNumber: year.yearNumber,
          explanation: 'Expenses are disabled in this scenario, so no living-cost outflows are posted.',
          formula: '0',
          sourceBlocks: ['Expenses']
        });
      }
      return buildTraceDetail({
        title: year.yearLabel + ' living expenses',
        value: year.metrics.livingExpenses,
        displayYearNumber: year.yearNumber,
        explanation: 'Living spend is taken from the Expenses block and increased once per simulation year by the Life inflation rate.',
        formula: 'inflation-adjusted monthly expenses x 12',
        sourceBlocks: ['Expenses', 'Life'],
        inputs: {
          baseMonthlyAmount: expenseValues.baseMonthlyAmount,
          annualInflation: expenseValues.annualInflation,
          inflationFactorForYear: expenseValues.inflationFactorForYear,
          monthlyAmountForYear: expenseValues.monthlyAmountForYear
        },
        rollupSteps: [
          'Start from the Expenses monthly amount.',
          'Apply Life inflation once for each completed prior simulation year.',
          'Use the resulting monthly amount for all 12 months of the selected year.',
          'Sum the 12 monthly outflows.'
        ],
        lineItems: lineItems
      });
    }

    if (metricKey === 'housingCosts') {
      if (rentValues) {
        return buildTraceDetail({
          title: year.yearLabel + ' housing',
          value: year.metrics.housingCosts,
          displayYearNumber: year.yearNumber,
          explanation: 'Housing spend comes from the Rent block in this scenario.',
          formula: 'inflation-adjusted monthly rent x 12',
          sourceBlocks: ['Rent', 'Life'],
          inputs: {
            baseMonthlyRent: rentValues.baseMonthlyRent,
            annualInflation: rentValues.annualInflation,
            inflationFactorForYear: rentValues.inflationFactorForYear,
            monthlyRentForYear: rentValues.monthlyRentForYear
          },
          rollupSteps: [
            'Start from the Rent monthly amount.',
            'Apply Life inflation once for each completed prior simulation year.',
            'Use the resulting monthly rent for the selected year.',
            'Sum the 12 rent payments.'
          ],
          lineItems: lineItems
        });
      }
      if (!mortgageValues) {
        return buildTraceDetail({
          title: year.yearLabel + ' housing',
          value: year.metrics.housingCosts,
          displayYearNumber: year.yearNumber,
          explanation: 'No housing block is enabled in this scenario.',
          formula: '0',
          sourceBlocks: ['Rent', 'Mortgage']
        });
      }
      return buildTraceDetail({
        title: year.yearLabel + ' housing',
        value: year.metrics.housingCosts,
        displayYearNumber: year.yearNumber,
        explanation: 'Housing spend comes from the Mortgage block and is shown after the mortgage interest tax return offsets part of the monthly outflow.',
        formula: 'gross mortgage payment + purchase costs + maintenance + owner taxes - mortgage tax return',
        sourceBlocks: ['Mortgage'],
        inputs: {
          openingHomeValueForYear: mortgageValues.openingHomeValueForYear,
          purchaseCostsRatePercent: mortgageValues.purchaseCostsRatePercent,
          purchaseCosts: Math.abs(groupedLineItems['Home purchase costs'] || 0),
          annualMaintenanceRatePercent: mortgageValues.annualMaintenanceRatePercent,
          annualOwnerTaxesRatePercent: mortgageValues.annualOwnerTaxesRatePercent,
          grossMortgagePayments: Math.abs(groupedLineItems['Mortgage gross payment'] || 0),
          maintenance: Math.abs(groupedLineItems['Home maintenance'] || 0),
          ownerTaxes: Math.abs(groupedLineItems['Owner taxes'] || 0),
          mortgageTaxReturn: groupedLineItems['Mortgage tax return'] || 0,
          netHousingCost: Math.abs(year.metrics.housingCosts)
        },
        rollupSteps: [
          'If this is Year 1, add one-time purchase costs in the first simulated month.',
          'Post the gross annuity mortgage payment each month and split it into interest and principal inside the trace.',
          'Add monthly maintenance and owner taxes derived from the opening home value of the year.',
          'Apply the mortgage interest tax return against the monthly interest portion only.',
          'The yearly Housing number is the net sum of those monthly postings.'
        ],
        lineItems: lineItems
      });
    }

    if (metricKey === 'investmentNetFlow') {
      return buildTraceDetail({
        title: year.yearLabel + ' investments flow',
        value: year.metrics.investmentNetFlow,
        displayYearNumber: year.yearNumber,
        explanation: (state.scenario.investing && state.scenario.investing.enabled
          ? 'Investments flow is the signed monthly residual after after-tax income, living expenses, and housing costs.'
          : 'Investing growth is disabled, but the settlement balance still absorbs monthly surpluses and deficits because the model holds no separate cash account.'),
        formula: 'sum of monthly (net income - expenses - housing costs)',
        sourceBlocks: uniqueStrings(['Investing', 'Employment', 'Expenses', state.scenario.rent && state.scenario.rent.enabled ? 'Rent' : null, state.scenario.mortgage && state.scenario.mortgage.enabled ? 'Mortgage' : null]),
        inputs: {
          netEmploymentIncome: year.metrics.employmentIncome,
          livingExpenses: Math.abs(year.metrics.livingExpenses),
          housingCosts: Math.abs(year.metrics.housingCosts),
          investmentNetFlow: year.metrics.investmentNetFlow
        },
        rollupSteps: [
          'Start from each month\'s after-tax Employment income.',
          'Subtract living expenses and housing costs for that month.',
          'Post the remaining signed balance into Investing.',
          'Sum all monthly investment deposits and withdrawals.'
        ],
        lineItems: lineItems
      });
    }

    if (metricKey === 'investmentGrowth') {
      if (!state.scenario.investing || !state.scenario.investing.enabled) {
        return buildTraceDetail({
          title: year.yearLabel + ' investment growth',
          value: year.metrics.investmentGrowth,
          displayYearNumber: year.yearNumber,
          explanation: 'Investing is disabled in this scenario, so no investment growth is posted.',
          formula: '0',
          sourceBlocks: ['Investing']
        });
      }
      return buildTraceDetail({
        title: year.yearLabel + ' investment growth',
        value: year.metrics.investmentGrowth,
        displayYearNumber: year.yearNumber,
        explanation: 'Investment growth is shown after investment tax when unrealised gains are taxed in this simplified future model.',
        formula: 'gross investment growth - investment tax',
        sourceBlocks: ['Investing'],
        inputs: {
          annualReturnPercent: state.scenario.investing ? state.scenario.investing.annualReturnPercent : 0,
          monthlyGrowthRate: state.scenario.investing ? Math.pow(1 + state.scenario.investing.annualReturnPercent / 100, 1 / 12) - 1 : 0,
          capitalGainsTaxRatePercent: state.scenario.investing ? state.scenario.investing.capitalGainsTaxRatePercent : 0,
          taxUnrealizedGains: state.scenario.investing ? state.scenario.investing.taxUnrealizedGains : false,
          grossInvestmentGrowth: groupedLineItems['Gross investment growth'] || 0,
          investmentTax: Math.abs(groupedLineItems['Investment tax'] || 0),
          netInvestmentGrowth: year.metrics.investmentGrowth
        },
        rollupSteps: [
          'Take the invested balance at the start of each month.',
          'Apply the monthly growth rate derived from the annual return assumption.',
          'If unrealised gains are taxed, apply the capital gains tax rate to each month\'s gross growth.',
          'Do not let same-month top-ups grow immediately.',
          'The yearly Growth number is the net sum of gross growth and investment tax postings.'
        ],
        lineItems: lineItems
      });
    }

    if (metricKey === 'endingInvestments') {
      return buildTraceDetail({
        title: year.yearLabel + ' ending investments',
        value: year.metrics.endingInvestments,
        displayYearNumber: year.yearNumber,
        explanation: state.scenario.investing && state.scenario.investing.enabled
          ? 'Ending investments combine the starting invested balance, the year\'s signed investment flows, and the year\'s net investment growth.'
          : 'Ending investments combine the settlement balance and the year\'s signed investment flows. Investment growth is off because the Investing block is disabled.',
        formula: 'starting investments + investments flow + net growth',
        sourceBlocks: uniqueStrings(['Investing'].concat(collectMetricLineItems(year, 'investmentNetFlow').map(function (entry) {
          return entry.lineItem.blockType;
        }))),
        inputs: {
          startingInvestmentsForYear: previousYear ? previousYear.metrics.endingInvestments : (state.scenario.investing && state.scenario.investing.enabled ? state.scenario.investing.startingBalance : 0),
          investmentNetFlow: year.metrics.investmentNetFlow,
          investmentGrowth: year.metrics.investmentGrowth,
          endingInvestments: year.metrics.endingInvestments
        },
        rollupSteps: [
          'Start from the previous year ending investment balance, or the Investing starting balance for Year 1.',
          'Apply all monthly net deposits to or withdrawals from Investing.',
          'Add all monthly net growth postings.',
          'The result is the ending invested balance.'
        ],
        lineItems: collectMetricLineItems(year, 'investmentNetFlow').concat(collectMetricLineItems(year, 'investmentGrowth'))
      });
    }

    if (metricKey === 'endingHomeEquity') {
      return buildTraceDetail({
        title: year.yearLabel + ' ending home equity',
        value: year.metrics.endingHomeEquity,
        displayYearNumber: year.yearNumber,
        explanation: 'Home equity is modeled as net sale proceeds: ending home value minus sale costs minus the ending mortgage principal.',
        formula: 'ending home value - sale costs - ending principal',
        sourceBlocks: ['Mortgage'],
        inputs: {
          endingHomeValue: endingMonth.endingHomeValue,
          saleCostsRatePercent: state.scenario.mortgage && state.scenario.mortgage.enabled ? state.scenario.mortgage.saleCostsRatePercent : 0,
          endingSaleCosts: endingMonth.endingSaleCosts || 0,
          endingPrincipal: endingMonth.endingPrincipal,
          endingHomeEquity: year.metrics.endingHomeEquity
        },
        rollupSteps: [
          'Step home value forward monthly using the home growth assumption.',
          'Reduce principal through the mortgage payment schedule.',
          'Calculate sale costs from the ending home value and the Mortgage sale-cost rate.',
          'Subtract sale costs and ending principal from ending home value.'
        ]
      });
    }

    if (metricKey === 'netWorth') {
      return buildTraceDetail({
        title: year.yearLabel + ' net worth',
        value: year.metrics.netWorth,
        displayYearNumber: year.yearNumber,
        explanation: 'Net worth is the sum of ending investments and home equity, where home equity is already shown after modeled sale costs.',
        formula: 'ending investments + ending home equity',
        sourceBlocks: ['Investing', 'Mortgage'],
        inputs: {
          endingInvestments: year.metrics.endingInvestments,
          endingHomeEquity: year.metrics.endingHomeEquity,
          netWorth: year.metrics.netWorth
        },
        rollupSteps: [
          'Add the ending invested balance.',
          'Add ending home equity if Mortgage is enabled.',
          'The sum is net worth.'
        ]
      });
    }

    return buildTraceDetail({
      title: year.yearLabel + ' ' + getMetricLabel(metricKey),
      value: year.metrics[metricKey],
      displayYearNumber: year.yearNumber,
      explanation: 'This yearly number is the sum of matching monthly ledger items.',
      formula: 'sum of matching monthly line items',
      sourceBlocks: uniqueStrings(lineItems.map(function (entry) { return entry.lineItem.blockType; })),
      inputs: {
        total: year.metrics[metricKey]
      },
      rollupSteps: [
        'Collect all monthly line items with the same metric key.',
        'Sum them to the yearly total shown in the ledger.'
      ],
      lineItems: lineItems
    });
  }

  function collectMonthMetricDetail(year, month, metricKey) {
    if (metricKey === 'endingInvestments' || metricKey === 'endingHomeEquity' || metricKey === 'netWorth') {
      return buildTraceDetail({
        title: year.yearLabel + ' ' + month.monthLabel + ' ' + getMetricLabel(metricKey),
        value: metricKey === 'endingInvestments'
          ? month.endingInvestments
          : metricKey === 'endingHomeEquity'
            ? month.endingHomeValue - (month.endingSaleCosts || 0) - month.endingPrincipal
            : month.endingInvestments + (month.endingHomeValue - (month.endingSaleCosts || 0) - month.endingPrincipal),
        displayYearNumber: year.yearNumber,
        explanation: 'This ending balance reflects the selected month after all first-day settlement flows and any month-end growth have been applied.',
        formula: metricKey === 'netWorth'
          ? 'ending investments + ending home equity'
          : metricKey === 'endingHomeEquity'
            ? 'ending home value - sale costs - ending principal'
            : 'ending balance after monthly postings',
        sourceBlocks: uniqueStrings(month.lineItems.map(function (lineItem) { return lineItem.blockType; })),
        inputs: {
          endingInvestments: month.endingInvestments,
          endingSaleCosts: month.endingSaleCosts || 0,
          endingPrincipal: month.endingPrincipal,
          endingHomeValue: month.endingHomeValue
        }
      });
    }

    var matching = month.lineItems.filter(function (lineItem) {
      return lineItem.key === metricKey;
    });
    var total = matching.reduce(function (acc, item) {
      return acc + item.amount;
    }, 0);
    return buildTraceDetail({
      title: year.yearLabel + ' ' + month.monthLabel + ' ' + getMetricLabel(metricKey),
      value: total,
      displayYearNumber: year.yearNumber,
      explanation: matching.length ? matching[0].explanation : 'No recorded line item for this metric in the selected month.',
      formula: matching.length === 1 ? matching[0].formula : 'sum of matching monthly line items',
      sourceBlocks: uniqueStrings(matching.map(function (lineItem) { return lineItem.blockType; })),
      inputs: matching.length === 1 ? matching[0].inputs : { total: total, contributingItems: matching.length },
      rollupSteps: matching.map(function (lineItem) {
        return lineItem.label + ': ' + lineItem.formula;
      }),
      lineItems: matching.map(function (lineItem) {
        return { monthLabel: month.monthLabel, lineItem: lineItem };
      })
    });
  }

  function renderChart() {
    var chartArea = document.getElementById('chart-area');
    var panels = [];
    var rentComparisonResult;
    var mortgageComparisonResult;
    disposeCharts();
    chartArea.innerHTML = '';
    if (!state.result.yearly.length) {
      return;
    }
    panels.push(buildChartPanel({
      title: 'Trajectory',
      subtitle: 'Ending balances by simulation year.',
      series: [
        { label: 'Net worth', color: '#0d6b62', values: buildMetricSeries(state.result, 'netWorth') },
        { label: 'Ending investments', color: '#b84f2c', values: buildMetricSeries(state.result, 'endingInvestments') },
        { label: 'Home equity', color: '#1f3f59', values: buildMetricSeries(state.result, 'endingHomeEquity') }
      ]
    }));

    rentComparisonResult = buildHousingComparisonResult('rent');
    mortgageComparisonResult = buildHousingComparisonResult('mortgage');

    panels.push(buildChartPanel({
      title: 'Rent vs Mortgage',
      subtitle: 'Net worth using each saved housing setup.',
      series: [
        { label: 'Renter net worth', color: '#b84f2c', values: buildMetricSeries(rentComparisonResult, 'netWorth') },
        { label: 'Mortgage net worth', color: '#0d6b62', values: buildMetricSeries(mortgageComparisonResult, 'netWorth') }
      ]
    }));

    panels.push(buildChartPanel({
      title: 'Rent vs Mortgage difference',
      subtitle: 'Mortgage net worth minus renter net worth.',
      optionConfig: {
        emphasizeZeroLine: true,
        tooltipFormatter: buildDifferenceTooltipFormatter
      },
      series: [
        { label: 'Difference', color: '#7a5a16', values: buildHousingDifferenceSeries(rentComparisonResult, mortgageComparisonResult) }
      ]
    }));

    panels.forEach(function (entry) {
      chartArea.appendChild(entry.panel);
      initializeChartHost(entry.host, entry.series, entry.optionConfig);
    });
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ensureHousingScenario(baseScenario) {
    var scenario = cloneData(baseScenario);
    var defaults = LifeSim.defaultScenario();
    if (!scenario.rent) {
      scenario.rent = cloneData(defaults.rent);
    }
    if (!scenario.mortgage) {
      scenario.mortgage = cloneData(defaults.mortgage);
    }
    return scenario;
  }

  function buildHousingComparisonResult(mode) {
    var comparisonScenario = ensureHousingScenario(state.scenario);
    comparisonScenario.rent.enabled = mode === 'rent';
    comparisonScenario.mortgage.enabled = mode === 'mortgage';
    return LifeSim.simulate(comparisonScenario);
  }

  function buildMetricSeries(result, metricKey) {
    return result.yearly.map(function (year) {
      return {
        yearNumber: year.yearNumber,
        value: year.metrics[metricKey]
      };
    });
  }

  function buildHousingDifferenceSeries(rentResult, mortgageResult) {
    var rentSeries = buildMetricSeries(rentResult, 'netWorth').reduce(function (acc, point) {
      acc[point.yearNumber] = point.value;
      return acc;
    }, Object.create(null));

    return buildMetricSeries(mortgageResult, 'netWorth').map(function (point) {
      var rentValue = rentSeries[point.yearNumber] || 0;
      return {
        yearNumber: point.yearNumber,
        value: point.value - rentValue,
        mortgageValue: point.value,
        rentValue: rentValue
      };
    });
  }

  function buildChartPanel(options) {
    var panel = document.createElement('section');
    panel.className = 'chart-panel';

    var heading = document.createElement('div');
    heading.className = 'chart-panel-heading';
    var title = document.createElement('h3');
    title.textContent = options.title;
    var subtitle = document.createElement('p');
    subtitle.textContent = options.subtitle;
    heading.appendChild(title);
    heading.appendChild(subtitle);
    panel.appendChild(heading);
    var chartShell = buildInteractiveChart();
    panel.appendChild(chartShell.shell);

    return {
      panel: panel,
      host: chartShell.host,
      series: options.series,
      optionConfig: options.optionConfig || null
    };
  }

  function buildInteractiveChart() {
    var shell = document.createElement('div');
    shell.className = 'chart-shell';

    var host = document.createElement('div');
    host.className = 'chart-host';
    shell.appendChild(host);

    return {
      shell: shell,
      host: host
    };
  }

  function initializeChartHost(host, series, optionConfig) {
    if (typeof echarts === 'undefined') {
      var fallback = document.createElement('div');
      fallback.className = 'chart-fallback';
      fallback.textContent = 'Chart library failed to load.';
      host.replaceWith(fallback);
      return;
    }

    var instance = echarts.init(host, null, { renderer: 'canvas' });
    chartInstances.push(instance);
    instance.setOption(buildChartOption(series, optionConfig), true);
  }

  function buildTooltipRowHtml(markerHtml, label, value) {
    return '<div class="chart-tooltip-row"><span class="chart-tooltip-label">' + markerHtml + label + '</span><strong>' + value + '</strong></div>';
  }

  function defaultChartTooltipFormatter(params) {
    if (!params || !params.length) {
      return '';
    }
    return [
      '<div class="chart-tooltip-title">Year ' + params[0].data.yearNumber + '</div>'
    ].concat(params.map(function (param) {
      return buildTooltipRowHtml(param.marker, param.seriesName, formatCurrency(param.data.displayValue));
    })).join('');
  }

  function buildDifferenceTooltipFormatter(params) {
    if (!params || !params.length) {
      return '';
    }
    var point = params[0].data;
    return [
      '<div class="chart-tooltip-title">Year ' + point.yearNumber + '</div>',
      buildTooltipRowHtml(params[0].marker, 'Difference', formatCurrency(point.displayValue)),
      buildTooltipRowHtml('<span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#0d6b62;"></span>', 'Mortgage net worth', formatCurrency(displayMoney(point.mortgageValue, point.yearNumber))),
      buildTooltipRowHtml('<span style="display:inline-block;width:10px;height:10px;border-radius:999px;background:#b84f2c;"></span>', 'Renter net worth', formatCurrency(displayMoney(point.rentValue, point.yearNumber)))
    ].join('');
  }

  function buildChartOption(series, optionConfig) {
    var years = series[0] ? series[0].values.map(function (point) { return point.yearNumber; }) : [];
    var config = optionConfig || {};
    return {
      animation: false,
      textStyle: {
        fontFamily: 'Georgia, "Times New Roman", serif'
      },
      color: series.map(function (entry) { return entry.color; }),
      grid: {
        left: 18,
        right: 20,
        top: 56,
        bottom: 26,
        containLabel: true
      },
      legend: {
        top: 10,
        left: 12,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          color: '#625749',
          fontSize: 12
        }
      },
      tooltip: {
        trigger: 'axis',
        confine: true,
        backgroundColor: 'rgba(255, 251, 244, 0.96)',
        borderColor: 'rgba(29, 26, 22, 0.14)',
        borderWidth: 1,
        textStyle: {
          color: '#1d1a16',
          fontSize: 13
        },
        extraCssText: 'box-shadow: 0 16px 32px rgba(29, 26, 22, 0.12); border-radius: 14px; padding: 12px 14px;',
        axisPointer: {
          type: 'cross',
          label: {
            show: false
          },
          lineStyle: {
            color: 'rgba(29, 26, 22, 0.28)',
            width: 1.5
          },
          crossStyle: {
            color: 'rgba(29, 26, 22, 0.28)',
            width: 1.5
          }
        },
        formatter: config.tooltipFormatter || defaultChartTooltipFormatter
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: years,
        axisLine: {
          lineStyle: {
            color: 'rgba(29, 26, 22, 0.18)'
          }
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#625749',
          fontSize: 11,
          formatter: function (value) {
            return 'Year ' + value;
          }
        }
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitNumber: 4,
        axisLine: {
          show: false
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#625749',
          fontSize: 11,
          formatter: function (value) {
            return formatCompactCurrency(value);
          }
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(29, 26, 22, 0.12)',
            type: 'dashed'
          }
        }
      },
      series: series.map(function (entry, index) {
        var chartSeries = {
          name: entry.label,
          type: 'line',
          smooth: false,
          symbol: 'circle',
          showSymbol: false,
          symbolSize: 7,
          emphasis: {
            focus: 'series',
            scale: true
          },
          lineStyle: {
            width: 3,
            cap: 'round',
            join: 'round'
          },
          itemStyle: {
            color: entry.color,
            borderColor: 'rgba(255,255,255,0.95)',
            borderWidth: 2
          },
          data: entry.values.map(function (point) {
            return {
              value: displayMoney(point.value, point.yearNumber),
              displayValue: displayMoney(point.value, point.yearNumber),
              rawValue: point.value,
              yearNumber: point.yearNumber,
              mortgageValue: point.mortgageValue,
              rentValue: point.rentValue
            };
          })
        };

        if (config.emphasizeZeroLine && index === 0) {
          chartSeries.markLine = {
            silent: true,
            symbol: ['none', 'none'],
            label: {
              show: false
            },
            lineStyle: {
              color: 'rgba(29, 26, 22, 0.26)',
              width: 1.5,
              type: 'solid'
            },
            data: [{ yAxis: 0 }]
          };
        }

        return chartSeries;
      })
    };
  }

  function metricClass(value) {
    if (value > 0) {
      return 'positive';
    }
    if (value < 0) {
      return 'negative';
    }
    return '';
  }

  function createMetricButton(text, detail) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'metric-button ' + metricClass(detail.value);
    button.textContent = text;
    button.addEventListener('click', function () {
      openDetail(detail);
    });
    return button;
  }

  function getLedgerLayout(metricCount) {
    var periodWidth = 124;
    var metricMinWidth = 68;
    return {
      periodWidth: periodWidth,
      metricMinWidth: metricMinWidth,
      minTotalWidth: periodWidth + metricMinWidth * metricCount,
      rowTemplate: periodWidth + 'px repeat(' + metricCount + ', minmax(' + metricMinWidth + 'px, 1fr))',
      trackTemplate: 'repeat(' + metricCount + ', minmax(' + metricMinWidth + 'px, 1fr))'
    };
  }

  function renderLedger() {
    var root = document.getElementById('ledger-root');
    root.innerHTML = '';
    var metricDefs = LifeSim.getYearMetricDefs();
    var layout = getLedgerLayout(metricDefs.length);
    var periodWidth = layout.periodWidth;
    var stickyHead = document.createElement('div');
    stickyHead.className = 'ledger-sticky-head';
    stickyHead.appendChild(buildLedgerHeader(metricDefs, layout));
    root.appendChild(stickyHead);

    var scroll = document.createElement('div');
    scroll.className = 'ledger-scroll';

    var body = document.createElement('div');
    body.className = 'ledger-body';
    body.style.width = '100%';
    body.style.minWidth = layout.minTotalWidth + 'px';

    state.result.yearly.forEach(function (year) {
      var yearRow = document.createElement('div');
      yearRow.className = 'year-row';

      var labelCell = document.createElement('div');
      labelCell.className = 'ledger-grid-cell ledger-period-cell';
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'expand-button';
      toggle.textContent = state.expandedYears[year.yearNumber] ? '−' : '+';
      toggle.addEventListener('click', function () {
        state.expandedYears[year.yearNumber] = !state.expandedYears[year.yearNumber];
        renderLedger();
      });
      labelCell.appendChild(toggle);
      labelCell.appendChild(document.createTextNode(year.yearLabel));
      yearRow.appendChild(labelCell);

      metricDefs.forEach(function (metric) {
        var cell = document.createElement('div');
        cell.className = 'ledger-grid-cell';
        cell.appendChild(createMetricButton(formatMoney(year.metrics[metric.key], year.yearNumber), {
          kind: 'year',
          yearNumber: year.yearNumber,
          metricKey: metric.key,
          value: year.metrics[metric.key],
          getDetail: function () {
            return collectYearMetricDetail(year, metric.key);
          }
        }));
        yearRow.appendChild(cell);
      });

      body.appendChild(wrapLedgerRow(yearRow, layout.rowTemplate));

      if (state.expandedYears[year.yearNumber]) {
        year.months.forEach(function (month) {
          var monthRow = document.createElement('div');
          monthRow.className = 'month-row';

          var monthLabel = document.createElement('div');
          monthLabel.className = 'ledger-grid-cell ledger-period-cell month-label';
          monthLabel.textContent = month.monthLabel;
          monthRow.appendChild(monthLabel);

          metricDefs.forEach(function (metric) {
            var total = month.lineItems.reduce(function (acc, item) {
              if (item.key !== metric.key) {
                return acc;
              }
              return acc + item.amount;
            }, 0);

            if (metric.key === 'endingInvestments') {
              total = month.endingInvestments;
            } else if (metric.key === 'endingHomeEquity') {
              total = month.endingHomeValue - (month.endingSaleCosts || 0) - month.endingPrincipal;
            } else if (metric.key === 'netWorth') {
              total = month.endingInvestments + (month.endingHomeValue - (month.endingSaleCosts || 0) - month.endingPrincipal);
            }

            var cell = document.createElement('div');
            cell.className = 'ledger-grid-cell';
            cell.appendChild(createMetricButton(formatMoney(total, year.yearNumber), {
              kind: 'month',
              yearNumber: year.yearNumber,
              monthLabel: month.monthLabel,
              metricKey: metric.key,
              value: total,
              getDetail: function () {
                return collectMonthMetricDetail(year, month, metric.key);
              }
            }));
            monthRow.appendChild(cell);
          });

          body.appendChild(wrapLedgerRow(monthRow, layout.rowTemplate));
        });
      }
    });
    scroll.appendChild(body);
    root.appendChild(scroll);
    syncLedgerHeaderScroll(scroll, stickyHead.querySelector('.ledger-head-metrics-track'));
  }

  function buildLedgerHeader(metricDefs, layout) {
    var shell = document.createElement('div');
    shell.className = 'ledger-head-shell';

    var periodCell = document.createElement('div');
    periodCell.className = 'ledger-head-period';
    periodCell.textContent = 'Period';
    periodCell.style.width = layout.periodWidth + 'px';
    shell.appendChild(periodCell);

    var viewport = document.createElement('div');
    viewport.className = 'ledger-head-metrics-viewport';

    var track = document.createElement('div');
    track.className = 'ledger-head-metrics-track';
    track.style.width = '100%';
    track.style.minWidth = metricDefs.length * layout.metricMinWidth + 'px';
    track.style.gridTemplateColumns = layout.trackTemplate;

    metricDefs.forEach(function (metric) {
      var cell = document.createElement('div');
      cell.className = 'ledger-head-metric-cell';
      cell.textContent = metric.label;
      track.appendChild(cell);
    });

    viewport.appendChild(track);
    shell.appendChild(viewport);
    return shell;
  }

  function wrapLedgerRow(content, rowTemplate) {
    var row = document.createElement('div');
    row.className = 'ledger-grid-row ' + content.className;
    row.style.gridTemplateColumns = rowTemplate;
    while (content.firstChild) {
      row.appendChild(content.firstChild);
    }
    return row;
  }

  function syncLedgerHeaderScroll(scroll, track) {
    function applySync() {
      track.style.transform = 'translateX(' + (-scroll.scrollLeft) + 'px)';
    }
    scroll.addEventListener('scroll', applySync);
    applySync();
  }

  function renderSideActions() {
    var rail = document.getElementById('side-actions');
    var configTrigger = document.getElementById('open-config');
    var housingTrigger = document.getElementById('toggle-housing-mode');
    var moneyTrigger = document.getElementById('toggle-current-money');
    var housingMode = getHousingMode();
    rail.classList.toggle('is-drawer-open', !!state.isConfigOpen);
    configTrigger.setAttribute('aria-expanded', state.isConfigOpen ? 'true' : 'false');
    configTrigger.classList.toggle('is-hidden', !!state.isConfigOpen);
    housingTrigger.textContent = housingMode === 'mortgage' ? 'Use rent' : 'Use mortgage';
    housingTrigger.setAttribute('aria-pressed', housingMode === 'mortgage' ? 'true' : 'false');
    housingTrigger.classList.toggle('is-active', housingMode === 'mortgage');
    moneyTrigger.setAttribute('aria-pressed', state.view.useCurrentMoney ? 'true' : 'false');
    moneyTrigger.classList.toggle('is-active', !!state.view.useCurrentMoney);
  }

  function renderConfigDrawer() {
    var drawer = document.getElementById('config-drawer');
    var backdrop = document.getElementById('config-backdrop');
    drawer.classList.toggle('is-open', !!state.isConfigOpen);
    drawer.setAttribute('aria-hidden', state.isConfigOpen ? 'false' : 'true');
    backdrop.classList.toggle('is-open', !!state.isConfigOpen);
    backdrop.hidden = !state.isConfigOpen;
  }

  function renderDetail() {
    var drawer = document.getElementById('detail-drawer');
    var backdrop = document.getElementById('detail-backdrop');
    var root = document.getElementById('detail-root');
    drawer.classList.toggle('is-open', !!state.isDetailOpen);
    drawer.setAttribute('aria-hidden', state.isDetailOpen ? 'false' : 'true');
    backdrop.classList.toggle('is-open', !!state.isDetailOpen);
    backdrop.hidden = !state.isDetailOpen;
    root.innerHTML = '';

    if (!state.selectedDetail) {
      var empty = document.createElement('p');
      empty.className = 'detail-empty';
      empty.textContent = 'Select any yearly or monthly metric to inspect formulas, tax assumptions, and contributing line items.';
      root.appendChild(empty);
      return;
    }

    var detail = state.selectedDetail.getDetail();
    var card = document.createElement('article');
    card.className = 'detail-card';

    var title = document.createElement('h3');
    title.textContent = detail.title;
    card.appendChild(title);

    var value = document.createElement('p');
    value.className = 'detail-value';
    value.innerHTML = '<strong>' + (detail.displayValue || formatMoney(detail.value, detail.displayYearNumber)) + '</strong>';
    card.appendChild(value);

    var explanation = document.createElement('p');
    explanation.textContent = state.view.useCurrentMoney
      ? detail.explanation + ' Values are shown in current purchasing power by discounting each simulation year with Life inflation.'
      : detail.explanation;
    card.appendChild(explanation);

    if (state.view.useCurrentMoney && !detail.displayValue && typeof detail.value === 'number') {
      var nominalNote = document.createElement('p');
      nominalNote.className = 'detail-note';
      nominalNote.textContent = 'Nominal amount before the current-purchasing-power adjustment: ' + formatCurrency(detail.value) + '.';
      card.appendChild(nominalNote);
    }

    if (detail.sourceBlocks && detail.sourceBlocks.length) {
      var sourceSection = document.createElement('section');
      sourceSection.className = 'detail-section';
      var sourceTitle = document.createElement('h4');
      sourceTitle.textContent = 'Source blocks';
      sourceSection.appendChild(sourceTitle);
      var chips = document.createElement('div');
      chips.className = 'detail-chip-list';
      detail.sourceBlocks.forEach(function (blockName) {
        var chip = document.createElement('span');
        chip.className = 'detail-chip';
        chip.textContent = blockName;
        chips.appendChild(chip);
      });
      sourceSection.appendChild(chips);
      card.appendChild(sourceSection);
    }

    if (detail.formula) {
      var formulaSection = document.createElement('section');
      formulaSection.className = 'detail-section';
      var formulaTitle = document.createElement('h4');
      formulaTitle.textContent = 'Formula';
      formulaSection.appendChild(formulaTitle);
      var formulaText = document.createElement('code');
      formulaText.className = 'detail-formula';
      formulaText.textContent = detail.formula;
      formulaSection.appendChild(formulaText);
      card.appendChild(formulaSection);
    }

    var kvGrid = document.createElement('div');
    kvGrid.className = 'kv-grid';
    Object.keys(detail.inputs || {}).forEach(function (key) {
      var item = document.createElement('div');
      item.className = 'kv-item';
      var label = document.createElement('span');
      label.textContent = humanizeKey(key);
      var amount = document.createElement('strong');
      amount.textContent = formatDetailValue(key, detail.inputs[key], detail.displayYearNumber);
      item.appendChild(label);
      item.appendChild(amount);
      kvGrid.appendChild(item);
    });
    if (kvGrid.childElementCount) {
      card.appendChild(kvGrid);
    }

    if (detail.items && detail.items.length) {
      var itemList = document.createElement('ul');
      itemList.className = 'detail-items';
      detail.items.forEach(function (itemText) {
        var item = document.createElement('li');
        item.textContent = itemText;
        itemList.appendChild(item);
      });
      card.appendChild(itemList);
    }

    if (detail.rollupSteps && detail.rollupSteps.length) {
      var rollupSection = document.createElement('section');
      rollupSection.className = 'detail-section';
      var rollupTitle = document.createElement('h4');
      rollupTitle.textContent = 'How it is calculated';
      rollupSection.appendChild(rollupTitle);
      var rollupList = document.createElement('ol');
      rollupList.className = 'detail-items';
      detail.rollupSteps.forEach(function (step) {
        var item = document.createElement('li');
        item.textContent = step;
        rollupList.appendChild(item);
      });
      rollupSection.appendChild(rollupList);
      card.appendChild(rollupSection);
    }

    if (detail.lineItems && detail.lineItems.length) {
      var lineItemSection = document.createElement('section');
      lineItemSection.className = 'detail-section';
      var lineItemTitle = document.createElement('h4');
      lineItemTitle.textContent = 'Contributing postings';
      lineItemSection.appendChild(lineItemTitle);
      var list = document.createElement('ul');
      list.className = 'trace-line-item-list';
      detail.lineItems.forEach(function (entry) {
        var li = document.createElement('li');
        li.className = 'trace-line-item';
        var heading = document.createElement('div');
        heading.className = 'trace-line-item-head';
        var label = document.createElement('strong');
        label.textContent = entry.monthLabel + ': ' + entry.lineItem.label;
        var amount = document.createElement('span');
        amount.className = metricClass(entry.lineItem.amount);
        amount.textContent = formatMoney(entry.lineItem.amount, detail.displayYearNumber);
        heading.appendChild(label);
        heading.appendChild(amount);
        li.appendChild(heading);

        var meta = document.createElement('div');
        meta.className = 'trace-line-item-meta';
        meta.textContent = entry.lineItem.blockType + ' block' + (entry.lineItem.formula ? ' | ' + entry.lineItem.formula : '');
        li.appendChild(meta);

        if (entry.lineItem.explanation) {
          var lineExplanation = document.createElement('div');
          lineExplanation.className = 'trace-line-item-meta';
          lineExplanation.textContent = entry.lineItem.explanation;
          li.appendChild(lineExplanation);
        }
        list.appendChild(li);
      });
      lineItemSection.appendChild(list);
      card.appendChild(lineItemSection);
    }

    root.appendChild(card);
  }

  function humanizeKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, function (char) { return char.toUpperCase(); });
  }

  function formatDetailValue(key, rawValue, yearNumber) {
    var lowerKey = String(key || '').toLowerCase();
    if (rawValue == null) {
      return '—';
    }
    if (typeof rawValue === 'boolean') {
      return rawValue ? 'Yes' : 'No';
    }
    if (typeof rawValue === 'string') {
      return rawValue;
    }
    if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
      return String(rawValue);
    }
    if (lowerKey.indexOf('yearnumber') >= 0) {
      return 'Year ' + Math.round(rawValue);
    }
    if (lowerKey.indexOf('monthnumber') >= 0 || lowerKey.indexOf('simulationyears') >= 0 || lowerKey.indexOf('remainingtermyears') >= 0 || lowerKey.indexOf('contributingitems') >= 0) {
      return formatNumber(rawValue, 0);
    }
    if (lowerKey.indexOf('factor') >= 0) {
      return formatNumber(rawValue, 4) + 'x';
    }
    if (lowerKey === 'annualhomevaluegrowth') {
      return formatPercent(rawValue, 1);
    }
    if (lowerKey.indexOf('percent') >= 0 || lowerKey.indexOf('rate') >= 0 || lowerKey.indexOf('inflation') >= 0) {
      return formatPercent(rawValue, lowerKey.indexOf('monthly') >= 0 ? 3 : 1);
    }
    return formatMoney(rawValue, yearNumber);
  }

  function runSimulation() {
    state.result = LifeSim.simulate(state.scenario);
  }

  function updateStickyOffsets() {
    document.documentElement.style.setProperty('--sticky-toolbar-height', '0px');
  }

  function render(persist) {
    state.scenario = LifeSim.withDefaults(state.scenario);
    applyDerivedScenarioLinks();
    state.scenario = LifeSim.withDefaults(state.scenario);
    if (persist !== false) {
      saveScenario();
    }
    saveView();
    runSimulation();
    renderBlockConfig();
    renderSummary();
    renderChart();
    renderLedger();
    renderOverlays();
    updateStickyOffsets();
  }

  function attachActions() {
    document.getElementById('reset-scenario').addEventListener('click', function () {
      state.scenario = LifeSim.defaultScenario();
      state.view.autoMortgageHomeValue = true;
      state.view.autoMortgagePrincipal = true;
      state.view.autoMortgageGrowth = true;
      state.expandedYears = Object.create(null);
      state.expandedBlocks = deriveExpandedBlocks(state.scenario);
      state.selectedDetail = null;
      state.isDetailOpen = false;
      render();
    });

    document.getElementById('open-config').addEventListener('click', function () {
      if (state.isConfigOpen) {
        closeConfig();
        return;
      }
      openConfig();
    });
    document.getElementById('toggle-housing-mode').addEventListener('click', function () {
      setHousingMode(getHousingMode() === 'mortgage' ? 'rent' : 'mortgage');
      state.selectedDetail = null;
      state.isDetailOpen = false;
      render();
    });
    document.getElementById('close-config').addEventListener('click', closeConfig);
    document.getElementById('config-backdrop').addEventListener('click', closeConfig);
    var moneyToggle = document.getElementById('toggle-current-money');
    moneyToggle.setAttribute('aria-pressed', state.view.useCurrentMoney ? 'true' : 'false');
    moneyToggle.addEventListener('click', function () {
      state.view.useCurrentMoney = !state.view.useCurrentMoney;
      saveView();
      render(false);
    });
    document.getElementById('close-detail').addEventListener('click', closeDetail);
    document.getElementById('detail-backdrop').addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') {
        return;
      }
      if (state.isDetailOpen) {
        closeDetail();
        return;
      }
      if (state.isConfigOpen) {
        closeConfig();
      }
    });
    window.addEventListener('resize', function () {
      updateStickyOffsets();
      resizeCharts();
      renderLedger();
    });
  }

  attachActions();
  render();
}());
