import { Router, Request, Response } from 'express';
import {
  getRecipientByToken,
  updateRecipientStatus,
  getCampaign,
  getLandingPage,
  insertEvent,
} from '../services/index.js';

const router = Router();

// ============================================
// GET /t/:token — Click tracking + Landing Page
// ============================================
// When a recipient clicks the phishing link in the email,
// this endpoint logs the "clicked" event, updates the
// recipient status, and serves the campaign's landing page HTML.

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

    // 5. Fetch landing page HTML from DB
    let landingHtml: string | null = null;

    if (campaign.landingPageId) {
      const landingPage = await getLandingPage(campaign.landingPageId);
      if (landingPage) {
        landingHtml = landingPage.html;
      }
    }

    // 6. If no landing page set, serve default educational page
    if (!landingHtml) {
      landingHtml = getDefaultLandingPage();
    }

    // 7. Inject tracking data into the HTML so existing JS can read token/campaignId
    //    Uses history.replaceState to add query params without a page reload.
    //    The landing page's form-tracking JS reads these via URLSearchParams.
    const injectionScript = `<script>history.replaceState(null,'',window.location.pathname+'?token=${encodeURIComponent(token)}&campaign=${encodeURIComponent(campaign.id)}');</script>`;

    if (landingHtml.includes('</head>')) {
      landingHtml = landingHtml.replace('</head>', injectionScript + '\n</head>');
    } else {
      landingHtml = injectionScript + '\n' + landingHtml;
    }

    // 8. Serve the HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
