const os = require("os");
const path = require("path");
const fsp = require("fs/promises");
const { spawn } = require("child_process");
const OpenAI = require("openai");
const ffmpegPath = require("ffmpeg-static");
const log = require("../utils/logger");

const MODULE = "VoiceAI";

// Speech-to-text and text-to-speech helpers for WhatsApp voice notes.
// WhatsApp voice notes are Opus-in-Ogg; OpenAI Whisper accepts Ogg/Opus
// directly, and OpenAI TTS can emit Opus directly (response_format "opus").

const TRANSCRIBE_MODEL = "whisper-1";
const TTS_MODEL = "tts-1";
// Female voice — the WhatsApp persona is "Loubna", a female clinic representative.
// OpenAI female voices: "shimmer", "nova". ("alloy" is neutral; "onyx"/"echo" are male.)
const TTS_VOICE = "shimmer";
const FFMPEG_TIMEOUT_MS = 60000;

// Async ffmpeg runner (never blocks the event loop). Resolves with stderr tail.
const runFfmpeg = (args) =>
  new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("ffmpeg binary not available"));
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
      finish(reject, new Error(`ffmpeg timed out after ${FFMPEG_TIMEOUT_MS}ms`));
    }, FFMPEG_TIMEOUT_MS);
    proc.stderr.on("data", (d) => { stderr = (stderr + d.toString()).slice(-4000); });
    proc.on("error", (err) => finish(reject, err));
    proc.on("close", (code) =>
      code === 0 ? finish(resolve, stderr) : finish(reject, new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))
    );
  });

const parseDurationSeconds = (stderr) => {
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || "");
  if (!m) return undefined;
  const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return Number.isFinite(seconds) ? Math.round(seconds) : undefined;
};

// Pick a sensible file extension from the audio mime type so Whisper detects
// the container correctly.
const extFromMime = (mimeType) => {
  const mt = String(mimeType || "").toLowerCase();
  if (mt.includes("ogg") || mt.includes("opus")) return "ogg";
  if (mt.includes("mpeg") || mt.includes("mp3")) return "mp3";
  if (mt.includes("mp4") || mt.includes("m4a") || mt.includes("aac")) return "m4a";
  if (mt.includes("wav")) return "wav";
  if (mt.includes("webm")) return "webm";
  return "ogg";
};

/**
 * Transcribe an inbound voice note to text using OpenAI Whisper.
 * @returns {Promise<string>} transcript ("" if nothing recognised).
 * @throws if no apiKey or the API call fails (caller should handle).
 */
const transcribeVoice = async ({ apiKey, buffer, mimeType }) => {
  if (!apiKey) throw new Error("No OpenAI API key for transcription");
  const openai = new OpenAI({ apiKey });
  const file = await OpenAI.toFile(buffer, `voice.${extFromMime(mimeType)}`, {
    type: mimeType || "audio/ogg",
  });
  const res = await openai.audio.transcriptions.create({ file, model: TRANSCRIBE_MODEL });
  return (res?.text || "").trim();
};

/**
 * Synthesize a spoken reply and return WhatsApp-ready Opus/Ogg audio.
 * @returns {Promise<{ buffer: Buffer, mimetype: string, seconds: number|undefined }>}
 * @throws if no apiKey or the TTS call fails.
 */
const synthesizeVoice = async ({ apiKey, text, voice = TTS_VOICE }) => {
  if (!apiKey) throw new Error("No OpenAI API key for speech synthesis");
  if (!text || !text.trim()) throw new Error("No text to synthesize");
  const openai = new OpenAI({ apiKey });

  // Ask OpenAI for Opus directly (Ogg/Opus — the WhatsApp voice-note format).
  const speech = await openai.audio.speech.create({
    model: TTS_MODEL,
    voice,
    input: text,
    response_format: "opus",
  });
  let buffer = Buffer.from(await speech.arrayBuffer());
  let seconds;

  // Best-effort: normalise to a mono 48k Opus/Ogg voice note and read duration.
  // If ffmpeg is unavailable/fails, fall back to the raw OpenAI Opus output.
  try {
    const stamp = `${Date.now()}-${process.pid}-${Math.round(Math.random() * 1e6)}`;
    const inPath = path.join(os.tmpdir(), `tts-in-${stamp}.ogg`);
    const outPath = path.join(os.tmpdir(), `tts-out-${stamp}.ogg`);
    try {
      await fsp.writeFile(inPath, buffer);
      const stderr = await runFfmpeg([
        "-y", "-i", inPath,
        "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1",
        "-f", "ogg", outPath,
      ]);
      seconds = parseDurationSeconds(stderr);
      buffer = await fsp.readFile(outPath);
    } finally {
      await Promise.all([fsp.unlink(inPath).catch(() => {}), fsp.unlink(outPath).catch(() => {})]);
    }
  } catch (err) {
    log.warn(MODULE, "synthesizeVoice:normalise", { error: err.message });
  }

  return { buffer, mimetype: "audio/ogg; codecs=opus", seconds };
};

module.exports = { transcribeVoice, synthesizeVoice };
