import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { config } from '../config';

const execFileAsync = promisify(execFile);

export async function downloadVideo(url: string, outputPath: string): Promise<string> {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http(s) URLs can be downloaded.');

  const fullPath = path.join(outputPath, `video-${Date.now()}.mp4`);
  // Argument array, no shell: the URL can never be interpreted as a command.
  await execFileAsync(
    config.ytDlpPath,
    ['--js-runtimes', 'node', '-f', 'best[ext=mp4]/best', '--no-playlist', '--output', fullPath, '--', parsed.toString()],
    { maxBuffer: 10 * 1024 * 1024 }
  );

  if (!fs.existsSync(fullPath)) {
    throw new Error('Video file was not created');
  }
  return fullPath;
}

export async function checkYtDlpInstalled(): Promise<boolean> {
  try {
    await execFileAsync(config.ytDlpPath, ['--version']);
    return true;
  } catch {
    return false;
  }
}
