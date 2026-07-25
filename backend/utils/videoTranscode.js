const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const log = require("../utils/logger");

const MODULE = "VideoTranscode";

// WhatsApp (and most chat clients) only render inline video that is an MP4 with
// H.264 video, AAC audio, yuv420p pixels and the moov atom moved to the front
// (+faststart). Arbitrary uploads (HEVC/H.265, .mov, VP9, moov-at-end, etc.) show
// "something is wrong with the video file". We normalise every video to that
// profile before sending.

const TRANSCODE_TIMEOUT_MS = 120000; // hard cap so a bad file can never hang a send

// Run ffmpeg asynchronously (never blocks the event loop) and resolve with the
// captured stderr. Rejects on non-zero exit, spawn error, or timeout.
const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    let stderr = "";
    let done = false;
    const finish = (fn, arg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(arg);
    };

    const proc = spawn(ffmpegPath, args, { windowsHide: true });
    const timer = setTimeout(() => {
      try { proc.kill("SIGKILL"); } catch { /* ignore */ }
      finish(reject, new Error(`ffmpeg timed out after ${TRANSCODE_TIMEOUT_MS}ms`));
    }, TRANSCODE_TIMEOUT_MS);

    proc.stderr.on("data", (d) => {
      // Keep only the tail — ffmpeg is very chatty.
      stderr = (stderr + d.toString()).slice(-4000);
    });
    proc.on("error", (err) => finish(reject, err));
    proc.on("close", (code) => {
      if (code === 0) finish(resolve, stderr);
      else finish(reject, new Error(`ffmpeg exited with ${code}: ${stderr.slice(-400)}`));
    });
  });

// Parse "Duration: 00:01:23.45" from ffmpeg stderr → whole seconds.
const parseDurationSeconds = (stderr) => {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || "");
  if (!m) return undefined;
  const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number.isFinite(seconds) ? Math.round(seconds) : undefined;
};

/**
 * Normalise an arbitrary video into a WhatsApp-compatible MP4. Async — spawns
 * ffmpeg without blocking the event loop (a synchronous transcode would stall
 * the Baileys WebSocket and drop the send).
 * @param {Buffer} inputBuffer Raw source video bytes.
 * @param {string} [originalName] Used only to pick the temp input extension.
 * @returns {Promise<{ buffer: Buffer, jpegThumbnail: Buffer|undefined, seconds: number|undefined }>}
 * @throws if ffmpeg is unavailable or transcoding fails (caller should fall back).
 */
const transcodeForWhatsApp = async (inputBuffer, originalName = "input") => {
  if (!ffmpegPath) throw new Error("ffmpeg binary not available");

  const stamp = `${Date.now()}-${process.pid}-${Math.round(Math.random() * 1e6)}`;
  const dir = os.tmpdir();
  const inExt = path.extname(originalName) || ".mp4";
  const inPath = path.join(dir, `wa-vid-in-${stamp}${inExt}`);
  const outPath = path.join(dir, `wa-vid-out-${stamp}.mp4`);
  const thumbPath = path.join(dir, `wa-vid-thumb-${stamp}.jpg`);

  const cleanup = async () => {
    await Promise.all(
      [inPath, outPath, thumbPath].map((p) => fs.unlink(p).catch(() => {}))
    );
  };

  try {
    await fs.writeFile(inPath, inputBuffer);

    // Transcode to the WhatsApp-safe profile.
    const stderr = await runFfmpeg([
      "-y",
      "-i", inPath,
      "-c:v", "libx264",
      "-profile:v", "baseline",
      "-level", "3.1",
      "-pix_fmt", "yuv420p",
      // Ensure even dimensions (libx264/yuv420p requirement).
      "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      outPath,
    ]);

    const seconds = parseDurationSeconds(stderr);
    const buffer = await fs.readFile(outPath);

    // Best-effort thumbnail (first frame). Failure here is non-fatal.
    let jpegThumbnail;
    try {
      await runFfmpeg(["-y", "-i", outPath, "-ss", "0", "-vframes", "1", "-vf", "scale=320:-2", thumbPath]);
      jpegThumbnail = await fs.readFile(thumbPath);
    } catch (thumbErr) {
      log.warn(MODULE, "thumbnail", { error: thumbErr.message });
    }

    return { buffer, jpegThumbnail, seconds };
  } finally {
    await cleanup();
  }
};

module.exports = { transcodeForWhatsApp };
