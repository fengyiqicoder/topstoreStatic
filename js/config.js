const STORAGE_KEY = "topstore-static-config";

const DEFAULTS = {
  apiKey: "",
  model: "openai/gpt-oss-120b",
  proxy: "https://corsproxy.io/?",
};

export function loadConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveConfig(next) {
  const merged = { ...loadConfig(), ...next };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  return merged;
}

export const DEFAULT_CONFIG = DEFAULTS;
