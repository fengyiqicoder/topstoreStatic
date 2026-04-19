import { t, detectLocale } from "./i18n.js";
import { loadConfig, saveConfig } from "./config.js";
import {
  isAppStoreUrl,
  extractCountryCode,
  localeFromCountry,
} from "./scraper.js";
import { runASOChain } from "./chain.js";

const LOCALE_KEY = "getappusernow-locale";

const state = {
  locale: "en",
  appState: "idle", // idle | processing | results
  steps: [
    { step: 1, name: "fetch_app_info", label: "", status: "pending", content: "" },
    { step: 2, name: "aso_optimization", label: "", status: "pending", content: "" },
  ],
  currentStep: 0,
  asoResult: null,
  sessionId: null,
};

function $(id) {
  return document.getElementById(id);
}

function setLocale(locale) {
  state.locale = locale;
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.title = "TopStore";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(locale, key);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const raw = el.getAttribute("data-i18n-attr");
    const [attr, key] = raw.split(":");
    el.setAttribute(attr, t(locale, key));
  });
}

function initLocale() {
  const saved = localStorage.getItem(LOCALE_KEY);
  const locale = saved === "zh" || saved === "en" ? saved : detectLocale();
  localStorage.setItem(LOCALE_KEY, locale);
  setLocale(locale);
}

function render() {
  const hero = $("hero");
  const progress = $("progress");
  const results = $("results");

  hero.classList.toggle("hidden", state.appState !== "idle");
  progress.classList.toggle("hidden", state.appState !== "processing");
  results.classList.toggle("hidden", state.appState !== "results");

  if (state.appState === "processing") renderSteps();
  if (state.appState === "results") renderResults();
}

function renderSteps() {
  const totalSteps = state.steps.length;
  const done = state.steps.filter((s) => s.status === "done").length;
  const pct = Math.round((done / totalSteps) * 100);
  $("progress-count").textContent = `${done}/${totalSteps}`;
  $("progress-pct").textContent = `${pct}%`;
  $("progress-bar").style.width = `${pct}%`;

  const stepKeys = ["step1", "step2"];
  const container = $("steps");
  const existing = new Map();
  container.querySelectorAll("[data-step]").forEach((el) => {
    existing.set(Number(el.dataset.step), el);
  });

  state.steps.forEach((step, i) => {
    const isActive = step.step === state.currentStep;
    const isDone = step.status === "done";
    const isPending = step.status === "pending";
    const baseClass =
      "rounded-xl border transition-all slide-up " +
      (isActive
        ? "border-blue-200 bg-blue-50/50 shadow-sm"
        : isDone
        ? "border-green-100 bg-green-50/30"
        : "border-gray-100 bg-gray-50/50 opacity-50");

    let indicator = "";
    if (isDone) {
      indicator = `
        <div class="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
          <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>`;
    } else if (isActive) {
      indicator = `
        <div class="w-6 h-6 rounded-full bg-blue-500 relative">
          <div class="absolute inset-0 rounded-full bg-blue-500 ping-ring opacity-40"></div>
          <div class="absolute inset-1 rounded-full bg-white"></div>
          <div class="absolute inset-1.5 rounded-full bg-blue-500"></div>
        </div>`;
    } else {
      indicator = `<div class="w-6 h-6 rounded-full bg-gray-200"></div>`;
    }

    const label = escapeHTML(step.label || t(state.locale, stepKeys[i]));
    const labelColor = isPending ? "text-gray-400" : "text-gray-700";

    let contentBlock = "";
    if ((isActive || isDone) && step.content) {
      const displayContent = isActive
        ? step.content
        : step.content.slice(0, 200) +
          (step.content.length > 200 ? "..." : "");
      contentBlock = `
        <div class="px-4 pb-3 ${isDone && !isActive ? "max-h-20 overflow-hidden relative" : ""}">
          <div class="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">${escapeHTML(displayContent)}</div>
          ${
            isDone && !isActive && step.content.length > 200
              ? `<div class="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-green-50/80 to-transparent"></div>`
              : ""
          }
        </div>`;
    }

    const html = `
      <div data-step="${step.step}" class="${baseClass}">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="flex-shrink-0">${indicator}</div>
          <div class="flex-1 min-w-0">
            <span class="text-sm font-medium ${labelColor}">${label}</span>
          </div>
          <span class="text-xs text-gray-300 font-mono">${step.step}/${totalSteps}</span>
        </div>
        ${contentBlock}
      </div>`;

    const el = existing.get(step.step);
    if (el) {
      el.outerHTML = html;
    } else {
      container.insertAdjacentHTML("beforeend", html);
    }
  });

  $("progress-bottom").scrollIntoView({ behavior: "smooth", block: "end" });
}

function escapeHTML(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderResults() {
  const aso = state.asoResult;
  if (!aso) return;

  const info = aso.app_info;
  if (info) {
    $("app-info-card").classList.remove("hidden");
    $("app-info-title").textContent = info.title || "";
    const rating =
      info.rating > 0
        ? ` · ${Number(info.rating).toFixed(1)} (${Number(info.rating_count || 0).toLocaleString()})`
        : "";
    $("app-info-meta").textContent = `${info.developer || ""} · ${info.category || ""}${rating}`;
  } else {
    $("app-info-card").classList.add("hidden");
  }

  const cards = [
    {
      key: "title",
      title: t(state.locale, "sectionTitle"),
      icon: "1",
      field: aso.title,
      charLimit: 30,
    },
    {
      key: "subtitle",
      title: t(state.locale, "sectionSubtitle"),
      icon: "2",
      field: aso.subtitle,
      charLimit: 30,
    },
    {
      key: "keywords",
      title: t(state.locale, "sectionKeywords"),
      icon: "3",
      field: aso.keywords,
      charLimit: 100,
      hideOriginal: true,
    },
    {
      key: "description",
      title: t(state.locale, "sectionDescription"),
      icon: "4",
      field: aso.description,
      charLimit: 4000,
      isLongText: true,
    },
  ];

  const container = $("result-cards");
  container.innerHTML = cards
    .map((card, i) => renderCard(card, i))
    .join("");

  container.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-copy");
      navigator.clipboard
        .writeText(text)
        .then(() => {
          const orig = btn.textContent;
          btn.textContent = t(state.locale, "copiedText");
          setTimeout(() => {
            btn.textContent = orig;
          }, 2000);
        })
        .catch(() => {});
    });
  });

  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCharCount(value, limit) {
  const count = (value || "").length;
  const over = count > limit;
  return `<span class="ml-2 text-[11px] font-mono ${over ? "text-red-500" : "text-gray-400"}">${count}/${limit}</span>`;
}

function renderRow({ label, value, isLongText, charLimit, showCopy }) {
  const empty = state.locale === "zh" ? "（无）" : "(none)";
  const display = value || empty;
  const body = isLongText
    ? `<pre class="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-gray-50 rounded-md border border-gray-200 px-3 py-2 max-h-64 overflow-y-auto">${escapeHTML(display)}</pre>`
    : `<div class="font-mono text-sm text-gray-800 break-all bg-gray-50 rounded-md border border-gray-200 px-3 py-2">${escapeHTML(display)}</div>`;
  const copyBtn =
    showCopy && value
      ? `<div class="pt-5"><button data-copy="${escapeHTML(value)}" class="px-3 py-1.5 text-xs font-medium bg-primary-bg text-primary rounded-lg hover:bg-primary hover:text-white transition-colors cursor-pointer">${t(state.locale, "copyText")}</button></div>`
      : "";
  return `
    <div class="flex items-start gap-3">
      <div class="flex-1 min-w-0">
        <div class="flex items-center mb-1">
          <span class="text-xs font-medium text-gray-500">${escapeHTML(label)}</span>
          ${renderCharCount(value, charLimit)}
        </div>
        ${body}
      </div>
      ${copyBtn}
    </div>`;
}

function renderCard(card, index) {
  const field = card.field || { original: "", reason: "", recommended: "" };
  const delay = Math.min(index * 80, 500);
  return `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden slide-up" style="animation-delay:${delay}ms">
      <div class="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
        <span class="w-8 h-8 rounded-lg bg-primary-bg text-primary flex items-center justify-center text-sm font-bold">${card.icon}</span>
        <h3 class="text-lg font-bold text-foreground">${escapeHTML(card.title)}</h3>
      </div>
      <div class="px-6 py-4 space-y-4">
        ${
          card.hideOriginal
            ? ""
            : renderRow({
                label: t(state.locale, "fieldOriginal"),
                value: field.original,
                isLongText: card.isLongText,
                charLimit: card.charLimit,
              })
        }
        <div>
          <div class="text-xs font-medium text-gray-500 mb-1">${t(state.locale, "fieldReason")}</div>
          <p class="text-sm text-gray-700 leading-relaxed">${escapeHTML(field.reason || "—")}</p>
        </div>
        ${renderRow({
          label: t(state.locale, "fieldRecommended"),
          value: field.recommended,
          showCopy: true,
          isLongText: card.isLongText,
          charLimit: card.charLimit,
        })}
      </div>
    </div>`;
}

function resetState() {
  state.steps = state.steps.map((s) => ({
    ...s,
    status: "pending",
    content: "",
    label: "",
  }));
  state.currentStep = 0;
  state.asoResult = null;
  state.sessionId = null;
  state.appState = "idle";
  $("steps").innerHTML = "";
  $("result-cards").innerHTML = "";
  $("app-info-card").classList.add("hidden");
  render();
}

function handleChainEvent(data) {
  if (data.session_id) state.sessionId = data.session_id;

  if (data.step && data.status === "start") {
    state.currentStep = data.step;
    const step = state.steps.find((s) => s.step === data.step);
    if (step) {
      step.status = "active";
      if (data.label) step.label = data.label;
    }
  }

  if (data.step && data.content) {
    const step = state.steps.find((s) => s.step === data.step);
    if (step) step.content += data.content;
  }

  if (data.step && data.status === "done") {
    const step = state.steps.find((s) => s.step === data.step);
    if (step) step.status = "done";
  }

  if (data.aso_result) {
    state.asoResult = data.aso_result;
  }

  if (state.appState === "processing") renderSteps();
}

async function handleSubmit() {
  const input = $("url-input");
  const url = input.value.trim();
  if (!url) return;

  if (!isAppStoreUrl(url)) {
    $("url-error").classList.remove("hidden");
    $("url-hint").classList.add("hidden");
    return;
  }
  $("url-error").classList.add("hidden");
  $("url-hint").classList.remove("hidden");

  const config = loadConfig();
  if (!config.apiKey) {
    alert(t(state.locale, "missingKey"));
    openSettings();
    return;
  }

  const country = extractCountryCode(url);
  const outputLocale = localeFromCountry(country);

  state.steps = state.steps.map((s) => ({
    ...s,
    status: "pending",
    content: "",
    label: "",
  }));
  state.currentStep = 0;
  state.asoResult = null;
  state.sessionId = `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  state.appState = "processing";
  $("steps").innerHTML = "";
  render();

  setSubmitLoading(true);
  try {
    await runASOChain({
      url,
      locale: outputLocale,
      config,
      onEvent: handleChainEvent,
    });
    state.appState = "results";
    render();
  } catch (err) {
    console.error(err);
    alert(err.message || String(err));
    state.appState = "idle";
    render();
  } finally {
    setSubmitLoading(false);
  }
}

function setSubmitLoading(loading) {
  const btn = $("submit-btn");
  btn.disabled = loading || !$("url-input").value.trim();
  $("submit-label").textContent = loading
    ? t(state.locale, "processing")
    : t(state.locale, "submit");
}

function openSettings() {
  const cfg = loadConfig();
  $("api-key-input").value = cfg.apiKey || "";
  $("model-input").value = cfg.model || "";
  $("proxy-input").value = cfg.proxy || "";
  $("settings-modal").classList.add("visible");
}

function closeSettings() {
  $("settings-modal").classList.remove("visible");
}

function saveSettings() {
  saveConfig({
    apiKey: $("api-key-input").value.trim(),
    model: $("model-input").value.trim() || "openai/gpt-oss-120b",
    proxy: $("proxy-input").value.trim(),
  });
  closeSettings();
}

function handleShareCopy() {
  const url = location.href;
  navigator.clipboard.writeText(url).then(() => {
    const btn = $("share-copy");
    const orig = btn.textContent;
    btn.textContent = t(state.locale, "copied");
    setTimeout(() => {
      btn.textContent = orig;
    }, 2000);
  });
}

function handleShareTwitter() {
  const text = t(state.locale, "shareText");
  const url = location.href;
  window.open(
    `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    "_blank"
  );
}

function handleShareLinkedIn() {
  const url = location.href;
  window.open(
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    "_blank"
  );
}

function bindEvents() {
  const input = $("url-input");
  const submit = $("submit-btn");

  input.addEventListener("input", () => {
    submit.disabled = input.value.trim().length === 0;
    if (!$("url-error").classList.contains("hidden")) {
      $("url-error").classList.add("hidden");
      $("url-hint").classList.remove("hidden");
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
  });
  submit.addEventListener("click", handleSubmit);

  $("reset-btn").addEventListener("click", resetState);

  $("settings-btn").addEventListener("click", openSettings);
  $("settings-cancel").addEventListener("click", closeSettings);
  $("settings-save").addEventListener("click", saveSettings);
  $("settings-modal").addEventListener("click", (e) => {
    if (e.target.id === "settings-modal") closeSettings();
  });

  $("share-copy").addEventListener("click", handleShareCopy);
  $("share-twitter").addEventListener("click", handleShareTwitter);
  $("share-linkedin").addEventListener("click", handleShareLinkedIn);
}

function init() {
  initLocale();
  bindEvents();
  render();
}

init();
