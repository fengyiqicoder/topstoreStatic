export const CONFIG = {
  apiKey: "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",
  model: "openai/gpt-oss-120b",
  proxy: "https://corsproxy.io/?",
};

export function loadConfig() {
  return { ...CONFIG };
}
