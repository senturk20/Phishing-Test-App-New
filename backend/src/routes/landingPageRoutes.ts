import { Router, Request, Response } from 'express';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import {
  getLandingPages,
  getLandingPage,
  createLandingPage,
  updateLandingPage,
  deleteLandingPage,
} from '../services/index.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/asyncHandler.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('LandingPages');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLONES_DIR = path.join(__dirname, '../../static/clones');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

// ============================================
// VALIDATION
// ============================================

interface CreateLandingPageBody {
  name: string;
  html: string;
  slug?: string;
  originalUrl?: string;
  isCloned?: boolean;
  isDefault?: boolean;
}

function isValidLandingPageBody(body: unknown): body is CreateLandingPageBody {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    obj.name.trim().length > 0 &&
    typeof obj.html === 'string'
  );
}

// ============================================
// ROUTES
// ============================================

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const pages = await getLandingPages();
  sendSuccess(res, pages);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const page = await getLandingPage(req.params.id);
  if (!page) { sendError(res, 404, 'Landing page not found'); return; }
  sendSuccess(res, page);
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (!isValidLandingPageBody(req.body)) { sendError(res, 400, 'Invalid request body'); return; }

  const page = await createLandingPage({
    name: req.body.name.trim(),
    html: req.body.html,
    slug: req.body.slug,
    originalUrl: req.body.originalUrl,
    isCloned: req.body.isCloned,
    isDefault: req.body.isDefault,
  });

  sendSuccess(res, page, 201);
}));

router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as Partial<CreateLandingPageBody>;
  const page = await updateLandingPage(req.params.id, {
    name: body.name?.trim(),
    html: body.html,
    isDefault: body.isDefault,
  });
  if (!page) { sendError(res, 404, 'Landing page not found'); return; }
  sendSuccess(res, page);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const deleted = await deleteLandingPage(req.params.id);
  if (!deleted) { sendError(res, 404, 'Landing page not found'); return; }
  sendSuccess(res, null);
}));

// ============================================
// ZIP UPLOAD — extract, hook forms, create landing page
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
    fetch('/p/' + token, {
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

function hookFormsInHtml(html: string): string {
  html = html.replace(
    /<form([^>]*)\s+action\s*=\s*["'][^"']*["']/gi,
    '<form$1 action="/p/__TOKEN__"'
  );
  html = html.replace(
    /<form(?![^>]*action\s*=)([^>]*)>/gi,
    '<form$1 action="/p/__TOKEN__">'
  );

  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*\/?>/gi, '');
  html = html.replace(/<meta[^>]*http-equiv\s*=\s*["']X-Frame-Options["'][^>]*\/?>/gi, '');

  const hookScript = buildFormHookScript();
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, hookScript + '\n</body>');
  } else if (/<\/html>/i.test(html)) {
    html = html.replace(/<\/html>/i, hookScript + '\n</html>');
  } else {
    html += '\n' + hookScript;
  }

  return html;
}

router.post('/upload', upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) { sendError(res, 400, 'No file uploaded'); return; }

  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    sendError(res, 400, 'Only .zip files are accepted');
    return;
  }

  const pageId = crypto.randomUUID();
  const cloneDir = path.join(CLONES_DIR, pageId);
  await fs.mkdir(cloneDir, { recursive: true });

  const zip = new AdmZip(file.buffer);
  const entries = zip.getEntries();

  let indexEntry = entries.find(e => !e.isDirectory && e.entryName === 'index.html');
  if (!indexEntry) {
    indexEntry = entries.find(e => !e.isDirectory && e.entryName.endsWith('/index.html'));
  }

  if (!indexEntry) {
    await fs.rm(cloneDir, { recursive: true, force: true });
    sendError(res, 400, 'ZIP must contain an index.html file');
    return;
  }

  const indexDir = path.dirname(indexEntry.entryName);
  const stripPrefix = indexDir === '.' ? '' : indexDir + '/';

  for (const entry of entries) {
    if (entry.isDirectory) continue;

    let relativePath = entry.entryName;
    if (stripPrefix && relativePath.startsWith(stripPrefix)) {
      relativePath = relativePath.slice(stripPrefix.length);
    }

    const destPath = path.join(cloneDir, relativePath);
    const destDir = path.dirname(destPath);
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(destPath, entry.getData());
  }

  const indexPath = path.join(cloneDir, 'index.html');
  let html = await fs.readFile(indexPath, 'utf-8');

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const pageName = (req.body?.name as string)?.trim()
    || (titleMatch ? titleMatch[1].trim().replace(/\s+/g, ' ') : `Upload-${pageId.slice(0, 8)}`);

  html = hookFormsInHtml(html);
  await fs.writeFile(indexPath, html, 'utf-8');

  const landingPage = await createLandingPage({
    name: pageName,
    html,
    slug: pageName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
    originalUrl: '',
    isCloned: true,
    isDefault: false,
  });

  const finalDir = path.join(CLONES_DIR, landingPage.id);
  if (cloneDir !== finalDir) {
    try { await fs.rename(cloneDir, finalDir); } catch {
      await fs.cp(cloneDir, finalDir, { recursive: true });
      await fs.rm(cloneDir, { recursive: true, force: true });
    }
  }

  const finalIndexPath = path.join(finalDir, 'index.html');
  const baseHref = `/static/clones/${landingPage.id}/`;
  const baseTag = `<base href="${baseHref}">`;
  try {
    let finalHtml = await fs.readFile(finalIndexPath, 'utf-8');
    if (/<head[^>]*>/i.test(finalHtml)) {
      finalHtml = finalHtml.replace(/<head[^>]*>/i, (m) => m + '\n    ' + baseTag);
    } else {
      finalHtml = baseTag + '\n' + finalHtml;
    }
    await fs.writeFile(finalIndexPath, finalHtml, 'utf-8');
  } catch {
    // Non-fatal
  }

  log.info('Landing page created from ZIP', { name: pageName, files: entries.length });

  sendSuccess(res, {
    id: landingPage.id,
    name: landingPage.name,
    staticPath: `clones/${landingPage.id}`,
    fileCount: entries.filter(e => !e.isDirectory).length,
  }, 201);
}));

export default router;
