const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";

const ZH_COUNTRIES = new Set(["cn", "tw", "hk", "mo"]);

export function extractAppId(url) {
  const m = /id(\d+)/.exec(url);
  return m ? m[1] : null;
}

export function extractCountryCode(url) {
  const m = /apps\.apple\.com\/(\w{2})\//i.exec(url);
  return m ? m[1].toLowerCase() : "us";
}

export function localeFromCountry(country) {
  return ZH_COUNTRIES.has((country || "").toLowerCase()) ? "zh" : "en";
}

export function isAppStoreUrl(url) {
  const trimmed = (url || "").trim();
  if (!/^https?:\/\/apps\.apple\.com\/\w{2}\/app\//i.test(trimmed)) return false;
  return Boolean(extractAppId(trimmed));
}

async function fetchItunesLookup(appId, country) {
  const params = new URLSearchParams({ id: appId, country });
  const resp = await fetch(`${ITUNES_LOOKUP_URL}?${params.toString()}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data || !Array.isArray(data.results) || data.results.length === 0)
    return null;
  return data.results[0];
}

async function fetchTitleAndSubtitle(url, proxyPrefix) {
  if (!proxyPrefix) return { title: "", subtitle: "" };
  try {
    const proxied = proxyPrefix + encodeURIComponent(url);
    const resp = await fetch(proxied);
    if (!resp.ok) return { title: "", subtitle: "" };
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const sections = doc.querySelectorAll("section");
    for (const section of sections) {
      const h1 = section.querySelector("h1");
      const sub = section.querySelector("p.subtitle");
      if (h1 && sub) {
        return {
          title: h1.textContent.trim(),
          subtitle: sub.textContent.trim(),
        };
      }
    }
    const h1 = doc.querySelector("h1");
    return {
      title: h1 ? h1.textContent.trim() : "",
      subtitle: "",
    };
  } catch (err) {
    console.warn("[scraper] HTML fetch failed", err);
    return { title: "", subtitle: "" };
  }
}

export async function getAppMetadata(url, proxyPrefix) {
  const appId = extractAppId(url);
  if (!appId) throw new Error(`Could not extract app ID from URL: ${url}`);
  const country = extractCountryCode(url);

  const itunes = await fetchItunesLookup(appId, country);
  if (!itunes) {
    throw new Error(`iTunes API returned no results for app ID: ${appId}`);
  }

  const metadata = {
    app_id: appId,
    title: itunes.trackName || "",
    subtitle: "",
    developer: itunes.artistName || "",
    description: itunes.description || "",
    category: itunes.primaryGenreName || "",
    categories: itunes.genres || [],
    price: (itunes.price || 0) === 0 ? "Free" : `$${itunes.price}`,
    rating: itunes.averageUserRating || 0,
    rating_count: itunes.userRatingCount || 0,
    current_version: itunes.version || "",
    content_rating: itunes.contentAdvisoryRating || "",
    languages: itunes.languageCodesISO2A || [],
    size_bytes: itunes.fileSizeBytes || "0",
    screenshots_count: (itunes.screenshotUrls || []).length,
    ipad_screenshots_count: (itunes.ipadScreenshotUrls || []).length,
    minimum_os: itunes.minimumOsVersion || "",
    release_date: itunes.releaseDate || "",
    current_release_date: itunes.currentVersionReleaseDate || "",
    release_notes: itunes.releaseNotes || "",
    seller_url: itunes.sellerUrl || "",
    country,
    app_store_url: url,
  };

  const scraped = await fetchTitleAndSubtitle(url, proxyPrefix);
  if (scraped.title) metadata.title = scraped.title;
  if (scraped.subtitle) metadata.subtitle = scraped.subtitle;

  return metadata;
}

export function formatMetadataForLLM(metadata) {
  const parts = [
    `App Name: ${metadata.title}`,
    `Developer: ${metadata.developer}`,
    `Category: ${metadata.category}`,
    `Price: ${metadata.price}`,
    `Rating: ${Number(metadata.rating || 0).toFixed(1)} (${Number(
      metadata.rating_count || 0
    ).toLocaleString()} ratings)`,
    `Current Version: ${metadata.current_version}`,
    `Content Rating: ${metadata.content_rating}`,
    `Languages: ${(metadata.languages || []).slice(0, 10).join(", ")}`,
    `Screenshots: ${metadata.screenshots_count} iPhone, ${metadata.ipad_screenshots_count} iPad`,
    `Country/Region: ${(metadata.country || "").toUpperCase()}`,
  ];
  if (metadata.subtitle) {
    parts.splice(1, 0, `Subtitle: ${metadata.subtitle}`);
  }
  if (metadata.release_notes) {
    parts.push(
      `\nRelease Notes (latest):\n${String(metadata.release_notes).slice(0, 500)}`
    );
  }
  parts.push(`\nFull App Description:\n${metadata.description || ""}`);
  return parts.join("\n");
}
