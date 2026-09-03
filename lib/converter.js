import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import crypto from 'crypto';

ffmpeg.setFfmpegPath(ffmpegStatic);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function toAudio(buffer, ext) {
    const tmpDir = path.join(__dirname, '../temp');
    if (!fsSync.existsSync(tmpDir)) await fs.mkdir(tmpDir, { recursive: true });
    
    const id = crypto.randomBytes(8).toString('hex');
    const inputPath = path.join(tmpDir, `${id}_in.${ext}`);
    const outputPath = path.join(tmpDir, `${id}_out.mp3`);
    
    try {
        await fs.writeFile(inputPath, buffer);
        
        await new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .toFormat('mp3')
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });
        
        const outputBuffer = await fs.readFile(outputPath);
        return outputBuffer;
    } finally {
        try {
            if (fsSync.existsSync(inputPath)) await fs.unlink(inputPath);
            if (fsSync.existsSync(outputPath)) await fs.unlink(outputPath);
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
}

export default {
    toAudio
};