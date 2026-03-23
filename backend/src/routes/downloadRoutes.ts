import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  getRecipientByToken,
  getCampaign,
  getAttachment,
} from '../services/index.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('Download');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = path.join(__dirname, '../../static/uploads');

const router = Router();

// ============================================
// GET /download/:token — University-themed download portal
// ============================================
router.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const recipient = await getRecipientByToken(token);
    if (!recipient) {
      res.status(404).send('<h1>Sayfa bulunamadi</h1>');
      return;
    }

    const campaign = await getCampaign(recipient.campaignId);
    if (!campaign || !campaign.attachmentId) {
      res.status(404).send('<h1>Dosya bulunamadi</h1>');
      return;
    }

    const attachment = await getAttachment(campaign.attachmentId);
    if (!attachment) {
      res.status(404).send('<h1>Dosya bulunamadi</h1>');
      return;
    }

    const nonce = crypto.randomBytes(16).toString('base64');

    const html = getDownloadPortalHtml(
      attachment.originalName,
      attachment.size,
      attachment.mimeType,
      token,
      campaign.id,
      nonce
    );

    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; font-src 'self';`
    );
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    log.error('Error serving portal', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).send('<h1>Sunucu hatasi</h1>');
  }
});

// ============================================
// GET /download/:token/file — Actual file download
// ============================================
router.get('/:token/file', async (req: Request, res: Response) => {
  const { token } = req.params;

  try {
    const recipient = await getRecipientByToken(token);
    if (!recipient) { res.status(404).json({ success: false, error: 'Not found' }); return; }

    const campaign = await getCampaign(recipient.campaignId);
    if (!campaign || !campaign.attachmentId) { res.status(404).json({ success: false, error: 'No attachment' }); return; }

    const attachment = await getAttachment(campaign.attachmentId);
    if (!attachment) { res.status(404).json({ success: false, error: 'Attachment not found' }); return; }

    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    if (!fs.existsSync(filePath)) { res.status(404).json({ success: false, error: 'File not found on disk' }); return; }

    log.info('File streamed', { token, file: attachment.originalName });

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalName)}"`);
    res.setHeader('Content-Length', String(fs.statSync(filePath).size));
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    log.error('Download error', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// University-themed download portal HTML
// ============================================
function getDownloadPortalHtml(
  fileName: string,
  fileSize: number,
  mimeType: string,
  token: string,
  campaignId: string,
  nonce: string
): string {
  const sizeStr = fileSize > 1024 * 1024
    ? `${(fileSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(fileSize / 1024).toFixed(1)} KB`;

  const ext = fileName.split('.').pop()?.toUpperCase() || 'DOSYA';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dosya Paylasim Portali - Universite Bilgi Sistemleri</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; background: #0f172a; min-height: 100vh; display: flex; flex-direction: column; align-items: center; }
    .header { width: 100%; background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%); border-bottom: 3px solid #c41e3a; padding: 16px 32px; display: flex; align-items: center; gap: 16px; }
    .header-logo { width: 48px; height: 48px; background: #c41e3a; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #fff; font-weight: 700; }
    .header-text h1 { color: #fff; font-size: 18px; font-weight: 600; }
    .header-text p { color: #94a3b8; font-size: 12px; }
    .container { max-width: 520px; width: 100%; margin: 60px auto; padding: 0 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; text-align: center; }
    .file-icon { width: 72px; height: 72px; background: linear-gradient(135deg, #c41e3a, #991b1b); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; color: #fff; }
    .card h2 { color: #f1f5f9; font-size: 20px; margin-bottom: 8px; }
    .card .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 24px; }
    .file-info { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: left; }
    .file-info .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .file-info .label { color: #94a3b8; font-size: 13px; }
    .file-info .value { color: #e2e8f0; font-size: 13px; font-weight: 500; }
    .download-btn { width: 100%; padding: 14px 24px; background: linear-gradient(135deg, #c41e3a, #b91c36); color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; }
    .download-btn:hover { background: linear-gradient(135deg, #b91c36, #991b1b); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(196, 30, 58, 0.4); }
    .download-btn svg { width: 20px; height: 20px; }
    .security-note { margin-top: 16px; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; display: flex; align-items: flex-start; gap: 8px; }
    .security-note .lock { color: #22c55e; font-size: 16px; flex-shrink: 0; margin-top: 2px; }
    .security-note p { color: #64748b; font-size: 12px; text-align: left; line-height: 1.4; }
    .footer { margin-top: 32px; text-align: center; color: #475569; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-logo">U</div>
    <div class="header-text">
      <h1>Universite Dosya Paylasim Portali</h1>
      <p>Guvenli Dosya Transfer Sistemi</p>
    </div>
  </div>
  <div class="container">
    <div class="card">
      <div class="file-icon">${ext.substring(0, 3)}</div>
      <h2>Paylasilan Dosya</h2>
      <p class="subtitle">Bu dosya sizinle guvenli bir sekilde paylasilmistir</p>
      <div class="file-info">
        <div class="row"><span class="label">Dosya Adi</span><span class="value">${escapeHtml(fileName)}</span></div>
        <div class="row"><span class="label">Boyut</span><span class="value">${sizeStr}</span></div>
        <div class="row"><span class="label">Tur</span><span class="value">${ext}</span></div>
      </div>
      <button class="download-btn" id="download-btn" type="button">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span id="btn-text">Dosyayi Indir</span>
      </button>
      <div class="security-note">
        <span class="lock">&#x1F512;</span>
        <p>Bu dosya sifrelenmis baglanti uzerinden iletilmektedir. Indirme islemi otomatik olarak baslar.</p>
      </div>
    </div>
    <div class="footer">&copy; 2024 Universite Bilgi Islem Daire Baskanligi. Tum haklari saklidir.</div>
  </div>
  <script nonce="${nonce}">
    document.addEventListener('DOMContentLoaded', function() {
      var TOKEN = '${escapeHtml(token)}';
      var CAMPAIGN_ID = '${escapeHtml(campaignId)}';
      var btn = document.getElementById('download-btn');
      var btnText = document.getElementById('btn-text');
      var svgDownload = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
      btn.addEventListener('click', function() {
        btn.disabled = true;
        btnText.textContent = 'Indiriliyor...';
        fetch('/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'file_downloaded', recipientToken: TOKEN, campaignId: CAMPAIGN_ID })
        })
        .then(function() {
          var fileUrl = '/download/' + encodeURIComponent(TOKEN) + '/file';
          var iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = fileUrl;
          document.body.appendChild(iframe);
        })
        .catch(function() {
          var fileUrl = '/download/' + encodeURIComponent(TOKEN) + '/file';
          var iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = fileUrl;
          document.body.appendChild(iframe);
        })
        .finally(function() {
          setTimeout(function() {
            btn.disabled = false;
            btn.innerHTML = svgDownload + ' <span id="btn-text">Tekrar Indir</span>';
          }, 3000);
        });
      });
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default router;
