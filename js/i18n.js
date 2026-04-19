export const translations = {
  zh: {
    title: "App Store 优化一键搞定",
    subtitle: "输入 App Store 链接，获取可直接复制粘贴的完整 ASO 优化方案",
    urlPlaceholder: "粘贴 App Store 链接 (https://apps.apple.com/...)",
    submit: "开始优化分析",
    processing: "正在分析中...",
    socialProof: "已为 1,200+ 款 App 生成优化方案",
    urlError: "仅支持 apps.apple.com 的 App Store 链接",
    urlHint:
      "只接受 apps.apple.com 的链接。输出语言跟随商店地区：/cn/ → 中文，/us/ 等其他地区 → 英文。",

    step1: "正在获取 App 信息...",
    step2: "正在生成 ASO 优化方案...",

    sectionTitle: "主标题",
    sectionSubtitle: "副标题",
    sectionKeywords: "关键词",
    sectionDescription: "应用描述",
    fieldOriginal: "原值",
    fieldReason: "修改原因",
    fieldRecommended: "推荐值",
    copyText: "复制",
    copiedText: "已复制！",
    copyAll: "复制全部内容",
    startNew: "分析其他 App",

    shareTitle: "分享你的 ASO 方案",
    shareText: "我刚用 AI 为我的 App 生成了 ASO 优化方案，你也来试试！",
    copyLink: "复制链接",
    copied: "已复制！",

    settings: "设置",
    settingsTitle: "OpenRouter 配置",
    settingsHint:
      "静态版需要你自己的 OpenRouter API Key 来调用模型。填入后保存在浏览器本地。",
    apiKeyLabel: "OpenRouter API Key",
    modelLabel: "模型 (OpenRouter model id)",
    proxyLabel: "CORS 代理前缀 (用于抓取 App Store 页面副标题)",
    proxyHint:
      "示例：https://corsproxy.io/?  或  https://api.allorigins.win/raw?url= — 留空则跳过副标题抓取。",
    cancel: "取消",
    save: "保存",
    missingKey: "请先在「设置」中填入 OpenRouter API Key。",
    fetchFail: "无法获取 App 信息，请检查链接或 CORS 代理设置。",
    llmFail: "模型生成失败：",
    parseFail: "模型返回格式无法解析，请重试或更换模型。",
    reasoningHeader: "模型思考过程：\n",
    fieldMarkerTitle: "\n→ 正在生成主标题...\n",
    fieldMarkerSubtitle: "\n→ 正在生成副标题...\n",
    fieldMarkerKeywords: "\n→ 正在生成关键词...\n",
    fieldMarkerDescription: "\n→ 正在生成应用描述...\n",
    fetchSummary:
      "已获取 App 信息\n• 标题：{title}\n• 副标题：{subtitle}\n• 开发者：{developer}\n• 类别：{category}",
  },
  en: {
    title: "App Store Optimization in One Click",
    subtitle:
      "Paste your App Store link, get a complete copy-paste ready ASO package",
    urlPlaceholder: "Paste App Store link (https://apps.apple.com/...)",
    submit: "Analyze & Optimize",
    processing: "Analyzing...",
    socialProof: "ASO packages generated for 1,200+ apps",
    urlError: "Only apps.apple.com App Store links are supported",
    urlHint:
      "Only apps.apple.com links are accepted. Output language follows the store region: /cn/ → Chinese, /us/ and other regions → English.",

    step1: "Fetching app information...",
    step2: "Generating ASO optimization package...",

    sectionTitle: "Title",
    sectionSubtitle: "Subtitle",
    sectionKeywords: "Keywords",
    sectionDescription: "Description",
    fieldOriginal: "Original",
    fieldReason: "Reason",
    fieldRecommended: "Recommended",
    copyText: "Copy",
    copiedText: "Copied!",
    copyAll: "Copy All Content",
    startNew: "Analyze Another App",

    shareTitle: "Share Your ASO Package",
    shareText:
      "I just got an AI-powered ASO optimization package for my app. Try it free!",
    copyLink: "Copy Link",
    copied: "Copied!",

    settings: "Settings",
    settingsTitle: "OpenRouter Configuration",
    settingsHint:
      "The static build calls OpenRouter directly from your browser. Your key stays in localStorage.",
    apiKeyLabel: "OpenRouter API Key",
    modelLabel: "Model (OpenRouter model id)",
    proxyLabel: "CORS proxy prefix (for App Store subtitle scrape)",
    proxyHint:
      "e.g. https://corsproxy.io/?  or  https://api.allorigins.win/raw?url= — leave blank to skip subtitle scraping.",
    cancel: "Cancel",
    save: "Save",
    missingKey: "Open Settings and add your OpenRouter API key first.",
    fetchFail: "Could not fetch app info. Check the link or your CORS proxy.",
    llmFail: "Model generation failed: ",
    parseFail:
      "Could not parse the model output. Try again or switch models.",
    reasoningHeader: "Model reasoning:\n",
    fieldMarkerTitle: "\n→ Writing title...\n",
    fieldMarkerSubtitle: "\n→ Writing subtitle...\n",
    fieldMarkerKeywords: "\n→ Writing keywords...\n",
    fieldMarkerDescription: "\n→ Writing description...\n",
    fetchSummary:
      "App info loaded\n• Title: {title}\n• Subtitle: {subtitle}\n• Developer: {developer}\n• Category: {category}",
  },
};

export function detectLocale() {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language || "";
  return lang.startsWith("zh") ? "zh" : "en";
}

export function t(locale, key) {
  return (
    (translations[locale] && translations[locale][key]) ||
    translations.en[key] ||
    key
  );
}
