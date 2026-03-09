import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { mirrorSite, createLandingPage } from '../services/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLONES_DIR = path.join(__dirname, '../../static/clones');

const router = Router();

// ============================================
// POST /clone  — Mirror a site statically & auto-create landing page
// ============================================

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.body as { url?: string };

    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'A valid URL is required' });
      return;
    }

    // Generate a temporary page ID for mirroring
    const tempId = crypto.randomUUID();

    // Mirror the site — downloads all assets locally
    const result = await mirrorSite(url, tempId);

    // Auto-create a landing page record in the DB
    const landingPage = await createLandingPage({
      name: result.title || new URL(url).hostname,
      html: result.html,
      slug: result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
      originalUrl: result.originalUrl,
      isCloned: true,
      isDefault: false,
    });

    // Rename the clone folder to match the DB record ID
    const tempDir = path.join(CLONES_DIR, tempId);
    const finalDir = path.join(CLONES_DIR, landingPage.id);
    if (tempDir !== finalDir) {
      try { await fs.rename(tempDir, finalDir); } catch {
        await fs.cp(tempDir, finalDir, { recursive: true });
        await fs.rm(tempDir, { recursive: true, force: true });
      }

      // Rewrite asset paths in index.html from tempId to the DB id
      const indexPath = path.join(finalDir, 'index.html');
      try {
        let html = await fs.readFile(indexPath, 'utf-8');
        html = html.split(`/static/clones/${tempId}/`).join(`/static/clones/${landingPage.id}/`);
        await fs.writeFile(indexPath, html, 'utf-8');
      } catch {
        // Non-fatal
      }
    }

    res.json({
      id: landingPage.id,
      title: result.title,
      originalUrl: result.originalUrl,
      staticPath: `clones/${landingPage.id}`,
      assetCount: result.assetCount,
    });
  } catch (err) {
    if (err instanceof Error && (
      err.message.includes('Invalid URL') ||
      err.message.includes('Only HTTP') ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('did not return')
    )) {
      res.status(400).json({ error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
