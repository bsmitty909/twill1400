import { Router, Request, Response } from 'express';
import { downloadVideo, checkYtDlpInstalled } from '../services/videoDownloader';
import { uploadToB2 } from '../services/s3Service';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

const TEMP_DIR = path.join(__dirname, '../../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

router.post('/download', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const ytDlpInstalled = await checkYtDlpInstalled();
    if (!ytDlpInstalled) {
      return res.status(500).json({
        error: 'yt-dlp not installed',
        message: 'Please install yt-dlp: brew install yt-dlp',
      });
    }

    const videoPath = await downloadVideo(url, TEMP_DIR);
    
    const fileName = path.basename(videoPath);
    const b2Url = await uploadToB2(videoPath, fileName);

    fs.unlinkSync(videoPath);

    res.json({
      success: true,
      url: b2Url,
      filename: fileName,
    });
  } catch (error) {
    console.error('Download/upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download and upload video',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/check-ytdlp', async (req: Request, res: Response) => {
  const installed = await checkYtDlpInstalled();
  res.json({ installed });
});

export default router;
