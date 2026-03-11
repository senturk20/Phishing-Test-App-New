import { Router, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import {
  getRecipientByToken,
  updateRecipientStatus,
  getCampaign,
  getLandingPage,
  insertEvent,
} from '../services/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLONES_DIR = path.join(__dirname, '../../static/clones');

const router = Router();

// ============================================
// GET /t/:token — Click tracking + Landing Page
// ============================================
// When a recipient clicks the phishing link in the email,
// this endpoint:
//   1. Logs the "clicked" event
//   2. Updates the recipient status
//   3. Serves the campaign's landing page HTML
//
// For CLONED pages, we read from disk (not DB) because:
//   - The on-disk HTML has correct asset paths after the rename
//   - We inject a <base> tag dynamically so relative CSS/JS/images resolve
//   - Form actions use ABSOLUTE paths (/p/:token) so <base> doesn't break them
//   - We replace the __TOKEN__ placeholder with the real recipient token

router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    // 1. Look up recipient by token
    const recipient = await getRecipientByToken(token);
    if (!recipient) {
      res.status(404).send('<h1>Sayfa bulunamadi</h1>');
      return;
    }

    // 2. Look up campaign
    const campaign = await getCampaign(recipient.campaignId);
    if (!campaign) {
      res.status(404).send('<h1>Sayfa bulunamadi</h1>');
      return;
    }

    // 3. Log "clicked" event
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    await insertEvent('clicked', campaign.id, token, ipAddress, userAgent);

    // 4. Update recipient status to "clicked" (only if currently "sent")
    if (recipient.status === 'sent') {
      await updateRecipientStatus(token, 'clicked');
    }

    console.log(`[Tracking] Click recorded: token=${token}, campaign=${campaign.id}`);

    // 5. Resolve landing page HTML
    let landingHtml: string | null = null;

    if (campaign.landingPageId) {
      const landingPage = await getLandingPage(campaign.landingPageId);

      if (landingPage && landingPage.isCloned) {
        // ── CLONED PAGE: read from disk (authoritative source) ──
        const cloneIndexPath = path.join(CLONES_DIR, landingPage.id, 'index.html');
        try {
          landingHtml = await fs.readFile(cloneIndexPath, 'utf-8');
        } catch {
          // Disk file missing — fall back to DB HTML
          landingHtml = landingPage.html;
        }

        if (landingHtml) {
          // Ensure a <base> tag exists so relative asset URLs resolve correctly.
          // The cloner may have already injected one; if not, add it.
          const baseHref = `/static/clones/${landingPage.id}/`;
          if (!landingHtml.includes('<base ')) {
            if (/<head[^>]*>/i.test(landingHtml)) {
              landingHtml = landingHtml.replace(/<head[^>]*>/i, (m) => m + `\n    <base href="${baseHref}">`);
            } else {
              landingHtml = `<base href="${baseHref}">\n` + landingHtml;
            }
          }

          // Migrate legacy clones: /api/p/ → /p/ (clones created before the route fix)
          landingHtml = landingHtml.split('/api/p/').join('/p/');

          // Replace __TOKEN__ placeholder with the real recipient token
          landingHtml = landingHtml.split('__TOKEN__').join(encodeURIComponent(token));
        }
      } else if (landingPage) {
        // ── MANUAL PAGE: use DB HTML directly ──
        landingHtml = landingPage.html;
      }
    }

    // 6. If no landing page set, serve default educational page
    if (!landingHtml) {
      landingHtml = getDefaultLandingPage();
    }

    // 7. Inject tracking data so the hook script can read token/campaignId.
    //    Uses history.replaceState to add query params without a reload.
    const injectionScript = `<script>history.replaceState(null,'',window.location.pathname+'?token=${encodeURIComponent(token)}&campaign=${encodeURIComponent(campaign.id)}');</script>`;

    if (landingHtml.includes('</head>')) {
      landingHtml = landingHtml.replace('</head>', injectionScript + '\n</head>');
    } else {
      landingHtml = injectionScript + '\n' + landingHtml;
    }

    // 8. Serve the HTML with permissive headers (no CSP/frame restrictions)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; frame-src *; connect-src *;");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('X-Content-Type-Options');
    res.send(landingHtml);
  } catch (error) {
    console.error('[Tracking] Error:', error);
    res.status(500).send('<h1>Sunucu hatasi</h1>');
  }
});

// ============================================
// DEFAULT LANDING PAGE (educational)
// ============================================

function getDefaultLandingPage(): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guvenlik Testi</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      background: #f8f9fa;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      color: #333;
    }
    .container {
      max-width: 600px;
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      padding: 40px;
      margin: 20px;
      text-align: center;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h2 { color: #dc2626; margin-bottom: 12px; font-size: 24px; }
    p { margin-bottom: 12px; line-height: 1.6; }
    .tips {
      text-align: left;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 16px 24px;
      margin-top: 20px;
    }
    .tips h3 { margin-bottom: 8px; color: #0369a1; }
    .tips li { margin-bottom: 6px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#9888;&#65039;</div>
    <h2>Phishing Simulasyonu</h2>
    <p>Bu bir guvenlik farkindalik testidir.</p>
    <p>Gercek bir saldiri olsaydi, bilgileriniz ele gecirilmis olacakti.</p>
    <div class="tips">
      <h3>Guvenlik Ipuclari:</h3>
      <ul>
        <li>URL adresini her zaman kontrol edin</li>
        <li>Supheli e-postalardaki linklere tiklamayin</li>
        <li>Resmi kanallari kullanarak dogrulayin</li>
        <li>Sifrelerinizi asla paylasmayın</li>
      </ul>
    </div>
  </div>
</body>
</html>`;
}

export default router;
