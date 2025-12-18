import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  try {
    const filename = `video-${Date.now()}.mp4`;
    const fullPath = path.join(outputPath, filename);

    const command = `yt-dlp -f "best[ext=mp4]/best" --no-playlist --output "${fullPath}" "${url}"`;
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 1024 * 1024 * 10,
    });

    if (stderr && !stderr.includes('WARNING')) {
      console.error('yt-dlp stderr:', stderr);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error('Video file was not created');
    }

    return fullPath;
  } catch (error) {
    console.error('Video download error:', error);
    throw error;
  }
}

export async function checkYtDlpInstalled(): Promise<boolean> {
  try {
    await execAsync('yt-dlp --version');
    return true;
  } catch (error) {
    return false;
  }
}
