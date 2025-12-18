import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadBuffer } from '../services/s3Service';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'video/webm' || file.mimetype === 'video/mp4') {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (webm, mp4)'));
    }
  },
});

router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileName = req.file.originalname || `recording-${Date.now()}.webm`;
    
    const url = await uploadBuffer(req.file.buffer, fileName);

    res.json({
      success: true,
      url,
      filename: fileName,
      size: req.file.size,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload video',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
