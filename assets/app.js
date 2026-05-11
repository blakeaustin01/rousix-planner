const TIERS = [
  { id: "basic", name: "Rousix Basic Tablet", shortName: "Basic Tablet", price: 1250, detail: "Secure participation device" },
  { id: "standard", name: "Rousix Standard", shortName: "Standard", price: 4100, detail: "Sufficient mining capacity / 1× baseline" },
  { id: "standardPlus", name: "Rousix Standard Plus", shortName: "Standard Plus", price: 8250, detail: "Double mining capacity / 2×" },
  { id: "premium", name: "Rousix Premium", shortName: "Premium", price: 12450, detail: "Triple mining capacity / 3×" },
  { id: "titan", name: "Rousix Titan", shortName: "Titan", price: 75000, detail: "Enterprise mining workstation" },
  { id: "colossus", name: "Rousix Colossus", shortName: "Colossus", price: 150000, detail: "Cluster array system" },
  { id: "olympus", name: "Rousix Olympus", shortName: "Olympus", price: 300000, detail: "Data center in a box" }
];

// Replace these placeholder URLs with hosted checkout links from Stripe Payment Links.
// Do not collect card numbers inside a GitHub Pages site.
const PAYMENT_LINKS = {
  deposit: "https://buy.stripe.com/REPLACE_WITH_1_DOLLAR_PLANNING_DEPOSIT_LINK",
  starter: "https://buy.stripe.com/REPLACE_WITH_5_DOLLAR_OR_CUSTOM_ONE_TIME_LINK",
  monthly: "https://buy.stripe.com/REPLACE_WITH_1_DOLLAR_MONTHLY_SUBSCRIPTION_LINK"
};

let currentPlan = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function dollars(value) {
  const clean = Number.isFinite(value) ? value : 0;
  return clean.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value) {
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`;
}

function numberFrom(id, fallback = 0) {
  const value = parseFloat($(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function tierById(id) {
  return TIERS.find((tier) => tier.id === id) || TIERS[0];
}

function recommendedStartingPoint(targetPrice, multiplier) {
  const scenarioBase = targetPrice / Math.max(multiplier, 1);
  return Math.max(5, scenarioBase / 12);
}

function suggestTier({ targetPrice, startingContribution, monthlyContribution, timelineMonths, scenarioMultiplier }) {
  const scenarioBase = targetPrice / Math.max(scenarioMultiplier, 1);
  const earlyCapacity = startingContribution + monthlyContribution * Math.min(12, timelineMonths);
  const capacityScore = Math.max(earlyCapacity, scenarioBase * 0.25);

  let suggested = TIERS[0];

  for (const tier of TIERS) {
    if (tier.price <= capacityScore) suggested = tier;
  }

  // Keep small goals from jumping into oversized enterprise tiers too quickly.
  if (targetPrice < 25000 && suggested.price > 4100) return tierById("standard");
  if (targetPrice < 75000 && suggested.price > 12450) return tierById("premium");

  return suggested;
}

function scenarioLabel(multiplier) {
  if (multiplier === 1) return "direct-contribution-only scenario";
  if (multiplier === 5) return "5x educational scenario";
  if (multiplier === 10) return "10x educational scenario";
  return `${multiplier}x advanced network-effect example`;
}

function buildPlan() {
  const personName = $("#personName").value.trim() || "Sample roadmap";
  const goalType = $("#goalType").value;
  const targetPrice = Math.max(100, numberFrom("#targetPrice", 100));
  const startingContribution = Math.max(0, numberFrom("#startingContribution", 0));
  const monthlyContribution = Math.max(0, numberFrom("#monthlyContribution", 0));
  const timelineMonths = parseInt($("#timelineMonths").value, 10);
  const scenarioMultiplier = parseInt($("#scenarioMultiplier").value, 10);
  const preferredTier = $("#tierPreference").value;

  const autoTier = suggestTier({
    targetPrice,
    startingContribution,
    monthlyContribution,
    timelineMonths,
    scenarioMultiplier
  });

  const selectedTier = preferredTier === "auto" ? autoTier : tierById(preferredTier);
  const scenarioBase = targetPrice / Math.max(scenarioMultiplier, 1);
  const directContributionTotal = startingContribution + monthlyContribution * timelineMonths;

  // Infrastructure-first rule: contributions cover the selected hardware first.
  const infrastructureCost = selectedTier.price;
  const infrastructureCoveredByStart = Math.min(startingContribution, infrastructureCost);
  const infrastructureRemainder = Math.max(0, infrastructureCost - infrastructureCoveredByStart);
  const contributionAfterInfrastructure = Math.max(0, directContributionTotal - infrastructureCost);
  const scenarioCoverageValue = contributionAfterInfrastructure * scenarioMultiplier;
  const scenarioGap = Math.max(0, targetPrice - scenarioCoverageValue);
  const contributionBaseGap = Math.max(0, scenarioBase - contributionAfterInfrastructure);

  const recommendedStart = recommendedStartingPoint(targetPrice, scenarioMultiplier);
  const monthlyNeededAfterStart = Math.max(1, (scenarioBase + infrastructureCost - startingContribution) / timelineMonths);
  const directOnlyGap = Math.max(0, targetPrice - directContributionTotal);
  const pathwayCoveragePercent = targetPrice > 0 ? (scenarioCoverageValue / targetPrice) * 100 : 0;
  const hardwareMonths = monthlyContribution > 0 ? Math.ceil(infrastructureRemainder / monthlyContribution) : Infinity;

  const warnings = [];

  if (startingContribution < 5) {
    warnings.push({ type: "danger", text: "The starting contribution should be at least $5." });
  }

  if (monthlyContribution < 1) {
    warnings.push({ type: "danger", text: "The monthly contribution should be at least $1." });
  }

  if (startingContribution < recommendedStart) {
    warnings.push({
      type: "caution",
      text: `For this goal, a more realistic starting point is about ${dollars(recommendedStart)}. The current start is below that, so this roadmap needs review.`
    });
  }

  if (monthlyContribution < monthlyNeededAfterStart) {
    warnings.push({
      type: "caution",
      text: `To stay closer to this sample path, the monthly amount would be about ${dollars(monthlyNeededAfterStart)} after the starting contribution.`
    });
  }

  if (scenarioMultiplier > 10) {
    warnings.push({
      type: "caution",
      text: "The selected network-effect scenario is aggressive. Keep it clearly labeled as an example, not an expected result."
    });
  }

  if (!$("#acknowledge").checked) {
    warnings.push({
      type: "danger",
      text: "The person should acknowledge the planning disclaimer before moving to a real next step."
    });
  }

  const status = pathwayCoveragePercent >= 100 && warnings.filter((w) => w.type === "danger").length === 0
    ? "On sample path"
    : pathwayCoveragePercent >= 70
      ? "Close, review details"
      : "Needs review";

  return {
    personName,
    goalType,
    targetPrice,
    startingContribution,
    monthlyContribution,
    timelineMonths,
    scenarioMultiplier,
    scenarioBase,
    directContributionTotal,
    selectedTier,
    autoTier,
    infrastructureCost,
    infrastructureRemainder,
    contributionAfterInfrastructure,
    scenarioCoverageValue,
    scenarioGap,
    contributionBaseGap,
    recommendedStart,
    monthlyNeededAfterStart,
    directOnlyGap,
    pathwayCoveragePercent,
    hardwareMonths,
    warnings,
    status
  };
}

function plainSummary(plan) {
  const infraSentence = plan.infrastructureRemainder > 0
    ? `The first ${dollars(plan.infrastructureCost)} is treated as the ${plan.selectedTier.shortName} infrastructure cost. Your starting amount covers ${dollars(plan.startingContribution)} of that, leaving about ${dollars(plan.infrastructureRemainder)} to be covered from monthly contributions before the rest of the plan can fully support the goal.`
    : `Your starting amount covers the ${plan.selectedTier.shortName} infrastructure cost in this sample math.`;

  const gapSentence = plan.scenarioGap > 0
    ? `After the infrastructure-first math, this pathway is still short by about ${dollars(plan.scenarioGap)} toward the ${plan.goalType.toLowerCase()} goal under the ${scenarioLabel(plan.scenarioMultiplier)}.`
    : `After the infrastructure-first math, this sample pathway reaches the goal under the ${scenarioLabel(plan.scenarioMultiplier)}.`;

  return `${plan.personName}: The goal is to own or purchase a ${plan.goalType.toLowerCase()} priced around ${dollars(plan.targetPrice)} over ${plan.timelineMonths} months. ${infraSentence} ${gapSentence} A simple next step is to review the starting amount, monthly amount, and selected tier before anyone pays or signs anything.`;
}

function renderPlan(plan) {
  currentPlan = plan;
  const summary = plainSummary(plan);

  $("#previewTitle").textContent = plan.personName;
  $("#previewTier").textContent = plan.selectedTier.shortName;
  $("#previewBase").textContent = dollars(plan.scenarioBase);
  $("#previewGap").textContent = plan.contributionBaseGap > 0 ? dollars(plan.contributionBaseGap) : "$0";
  $("#previewStatus").textContent = plan.status;
  $("#previewSummary").textContent = summary;
  $("#progressText").textContent = pct(plan.pathwayCoveragePercent);
  $("#progressBar").style.width = pct(plan.pathwayCoveragePercent);

  $("#emptyRoadmap").classList.add("hidden");
  $("#roadmapContent").classList.remove("hidden");

  $("#roadGoal").textContent = plan.goalType;
  $("#roadPrice").textContent = dollars(plan.targetPrice);
  $("#roadTimeline").textContent = `${plan.timelineMonths} months`;
  $("#roadTier").textContent = plan.selectedTier.shortName;
  $("#roadTitle").textContent = plan.personName;
  $("#roadSummary").textContent = summary;

  $("#roadInputs").textContent = `Goal: ${plan.goalType}. Price: ${dollars(plan.targetPrice)}. Starting contribution: ${dollars(plan.startingContribution)}. Monthly contribution: ${dollars(plan.monthlyContribution)}. Timeline: ${plan.timelineMonths} months.`;

  $("#roadGapExplanation").textContent = `In plain terms, the planner first subtracts the ${dollars(plan.infrastructureCost)} infrastructure cost. After that, about ${dollars(plan.contributionAfterInfrastructure)} remains in the sample contribution path. The remaining planning gap to review is ${dollars(plan.contributionBaseGap)} in contribution-base terms, or ${dollars(plan.scenarioGap)} in goal-price terms under the selected scenario.`;

  $("#roadTierExplanation").textContent = `${plan.selectedTier.name} is shown for discussion because the roadmap combines goal size, early contribution capacity, timeline, and selected scenario. ${plan.selectedTier.detail}.`;

  const warningBox = $("#roadWarnings");
  warningBox.innerHTML = "";

  plan.warnings.forEach((warning) => {
    const item = document.createElement("p");
    item.className = warning.type === "danger" ? "danger" : "";
    item.textContent = warning.text;
    warningBox.appendChild(item);
  });

  $("#tierMath").innerHTML = `
    <div><span>Auto suggestion</span><strong>${plan.autoTier.shortName}</strong></div>
    <div><span>Selected tier cost</span><strong>${dollars(plan.infrastructureCost)}</strong></div>
    <div><span>Monthly needed for sample path</span><strong>${dollars(plan.monthlyNeededAfterStart)}</strong></div>
  `;
}

function updateHints() {
  const targetPrice = Math.max(100, numberFrom("#targetPrice", 100));
  const scenarioMultiplier = parseInt($("#scenarioMultiplier").value, 10);
  const recStart = recommendedStartingPoint(targetPrice, scenarioMultiplier);

  $("#startHint").textContent = `Minimum starts at $5. For this goal and scenario, a more realistic starting point is about ${dollars(recStart)}.`;
}

function copyCurrentSummary() {
  if (!currentPlan) renderPlan(buildPlan());

  const text = plainSummary(currentPlan);

  if (!navigator.clipboard) {
    window.prompt("Copy this summary:", text);
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const original = $("#copySummary").textContent;
    $("#copySummary").textContent = "Copied";

    setTimeout(() => {
      $("#copySummary").textContent = original;
    }, 1200);
  });
}

function openPayment(type) {
  const link = PAYMENT_LINKS[type];

  if (!link || link.includes("REPLACE_WITH")) {
    alert("Add your hosted payment link in assets/app.js before using this button on the live site.");
    return;
  }

  window.open(link, "_blank", "noopener,noreferrer");
}

function setRoute() {
  const route = (window.location.hash || "#home").replace("#", "");

  $$(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.route === route);
  });

  $$(".nav a").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${route}`);
  });

  document.body.classList.remove("menu-open");
  $(".nav-toggle").setAttribute("aria-expanded", "false");

  if (route === "roadmap" && !currentPlan) {
    $("#emptyRoadmap").classList.remove("hidden");
    $("#roadmapContent").classList.add("hidden");
  }
}

function init() {
  setRoute();
  updateHints();
  renderPlan(buildPlan());

  window.addEventListener("hashchange", setRoute);

  $(".nav-toggle").addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("menu-open");
    $(".nav-toggle").setAttribute("aria-expanded", String(isOpen));
  });

  $("#plannerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    renderPlan(buildPlan());
    window.location.hash = "roadmap";
  });

  [
    "#personName",
    "#goalType",
    "#targetPrice",
    "#startingContribution",
    "#monthlyContribution",
    "#timelineMonths",
    "#scenarioMultiplier",
    "#tierPreference",
    "#acknowledge"
  ].forEach((selector) => {
    $(selector).addEventListener("input", () => {
      updateHints();
      renderPlan(buildPlan());
    });

    $(selector).addEventListener("change", () => {
      updateHints();
      renderPlan(buildPlan());
    });
  });

  $("#copySummary").addEventListener("click", copyCurrentSummary);
  $("#copyRoadmap").addEventListener("click", copyCurrentSummary);
  $("#printRoadmap").addEventListener("click", () => window.print());

  $$("[data-pay]").forEach((button) => {
    button.addEventListener("click", () => openPayment(button.dataset.pay));
  });
}

document.addEventListener("DOMContentLoaded", init);
