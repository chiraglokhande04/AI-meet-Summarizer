import { connect } from "puppeteer-real-browser";
import pkg from "wavefile";
import { v2 as cloudinary } from "cloudinary";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import Meeting from "../models/meeting.models.js";
import { createClient } from "@deepgram/sdk";
import { Readable } from "stream";
import env from "../utility/env.js";

dotenv.config();
const { WaveFile } = pkg;

// --- CONFIGURATION ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deepgram = createClient(env.DEEPGRAM_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// =========================================================
// HELPER 1: Stream Upload to Cloudinary
// =========================================================
const uploadStreamToCloudinary = (buffer, folder, resourceType, publicId) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: folder,
        public_id: publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    bufferStream.pipe(stream);
  });
};

// =========================================================
// HELPER 2: AI Analysis
// =========================================================
async function generateMeetingAnalysis(transcriptText) {
  console.log(`[AI] 🧠 Analyzing transcript...`);
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a meeting analyst. 
          TRANSCRIPT LABELS: "Speaker 0", "Speaker 1".
          TASK 1: Identity Matching. If Speaker 0 says "I am Aditya", label them Aditya.
          TASK 2: JSON Output:
             - "summary": concise summary.
             - "actionItems": [{ "task": string, "assignee": string, "deadline": string }].
             - "sentiment": { "positive": int, "neutral": int, "negative": int }.
          Output strictly JSON.`,
        },
        { role: "user", content: transcriptText },
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });
    return JSON.parse(completion.choices[0].message.content);
  } catch (err) {
    console.error("[AI] ❌ Analysis failed:", err.message);
    return {
      summary: "Analysis failed.",
      actionItems: [],
      sentiment: { positive: 0, neutral: 100, negative: 0 },
    };
  }
}

// =========================================================
// HELPER 3: Transcribe (FIXED DEEPGRAM CALL)
// =========================================================
async function processTranscription(audioBuffer) {
  console.log(`[TRANSCRIPT] ⚡ Sending audio buffer to Deepgram...`);
  try {
    // FIX IS HERE: Pass audioBuffer DIRECTLY as the first argument.
    // Do NOT wrap it in { buffer: ... } for the Node SDK.
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-2",
        smart_format: true,
        diarize: true,
        language: "en",
        mimetype: "audio/wav", // Pass mimetype here in options
      }
    );

    if (error) throw error;

    const paragraphs = result.results.channels[0].alternatives[0].paragraphs;
    let formattedTranscript = "";

    if (paragraphs && paragraphs.transcript) {
      if (paragraphs.paragraphs) {
        formattedTranscript = paragraphs.paragraphs
          .map(
            (p) =>
              `Speaker ${p.speaker}: ${p.sentences
                .map((s) => s.text)
                .join(" ")}`
          )
          .join("\n\n");
      } else {
        formattedTranscript = paragraphs.transcript;
      }
    } else {
      formattedTranscript =
        result.results.channels[0].alternatives[0].transcript;
    }

    return formattedTranscript;
  } catch (err) {
    console.error(`[TRANSCRIPT] ❌ Deepgram Failed: ${err.message}`);
    return "";
  }
}

// =========================================================
// CORE BOT LOGIC
// =========================================================
async function launchBot(url, userId) {
  let allAudioChunks = [];
  let isSaving = false;
  let capturedSampleRate = 48000;

  const meetingId = url.split("/").pop().split("?")[0];
  console.log(`\n[LAUNCH] 🚀 Initializing bot for User: ${userId}`);

  const { browser, page } = await connect({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--window-size=1280,720",
      "--disable-blink-features=AutomationControlled",
    ],
    turnstile: true,
  });

  const finalSave = async () => {
    if (isSaving) return;
    isSaving = true;
    console.log(`\n[SYSTEM] 🛑 Meeting ended. STARTING PARALLEL PROCESSING...`);

    try {
      await browser.close();
    } catch (e) {}

    if (allAudioChunks.length > 0) {
      try {
        // 1. Create WAV Buffer
        const wav = new WaveFile();
        wav.fromScratch(1, capturedSampleRate, "32f", allAudioChunks);
        const wavBuffer = Buffer.from(wav.toBuffer());

        console.log(
          `[PERFORMANCE] 🏎️  Starting Upload & Intelligence tasks concurrently...`
        );

        // 2. Task A: Upload Audio
        const audioUploadPromise = uploadStreamToCloudinary(
          wavBuffer,
          "meeting_bot_recordings",
          "video",
          `meet_${meetingId}_${Date.now()}`
        );

        // 3. Task B: Intelligence Chain
        const intelligencePromise = (async () => {
          // B1. Transcribe (Will work now with the fix)
          const text = await processTranscription(wavBuffer);

          let transcriptUrl = null;
          let analysis = {
            summary: "No audio.",
            actionItems: [],
            sentiment: {},
          };

          // B2. Only Upload Text & Analyze IF transcript exists
          if (text && text.trim().length > 0) {
            // Start Text Upload (Background)
            const textUploadPromise = uploadStreamToCloudinary(
              Buffer.from(text),
              "meeting_bot_recordings",
              "raw",
              `meet_${meetingId}_transcript`
            );

            // Run Analysis
            analysis = await generateMeetingAnalysis(text);

            // Wait for text upload
            try {
              const textResult = await textUploadPromise;
              transcriptUrl = textResult.secure_url;
            } catch (e) {
              console.error("Text upload failed:", e);
            }
          }

          return { text, analysis, transcriptUrl };
        })();

        // 4. Wait for both branches
        const [audioResult, intelligenceResult] = await Promise.all([
          audioUploadPromise,
          intelligencePromise,
        ]);

        // 5. Save to DB
        console.log(`[DB] 💾 Saving to database...`);
        await Meeting.create({
          user: userId,
          title: `Meeting ${meetingId}`,
          transcript: intelligenceResult.text || "No transcript generated.",
          summary: intelligenceResult.analysis.summary,
          actionItems: intelligenceResult.analysis.actionItems,
          sentiment: intelligenceResult.analysis.sentiment,
          duration: "Unknown",
          audioSource: audioResult.secure_url,
        });

        console.log(`\n✅ COMPLETE: Saved to User History.`);
      } catch (err) {
        console.error("❌ Save flow failed:", err);
      }
    } else {
      console.log("⚠️ No audio data captured.");
    }
  };

  browser.on("disconnected", finalSave);
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && !frame.url().includes(meetingId))
      finalSave();
  });

  try {
    await page.goto(url, { waitUntil: "networkidle2" });

    // --- JOIN LOGIC ---
    try {
      const micBtn = await page.waitForSelector('[aria-label*="microphone"]', {
        timeout: 8000,
      });
      await micBtn.click();
      const camBtn = await page.waitForSelector('[aria-label*="camera"]', {
        timeout: 8000,
      });
      await camBtn.click();
    } catch (e) {}

    try {
      await page.waitForSelector('input[type="text"]', { timeout: 5000 });
      await page.type('input[type="text"]', "AI Note Taker", { delay: 100 });
    } catch (e) {}

    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const joinBtn = btns.find(
        (b) =>
          b.innerText.includes("Join") || b.innerText.includes("Ask to join")
      );
      if (joinBtn) joinBtn.click();
    });

    const chatSelector = '[aria-label*="Chat with everyone"]';
    await page.waitForSelector(chatSelector, { timeout: 60000 });
    console.log("[STATUS] 🟢 Joined Meeting!");

    // --- AUDIO CAPTURE ---
    await page.exposeFunction("setSampleRate", (rate) => {
      capturedSampleRate = rate;
    });
    await page.exposeFunction("sendAudioChunk", (chunk) => {
      const values = Object.values(chunk);
      for (let i = 0; i < values.length; i++) {
        allAudioChunks.push(values[i]);
      }
    });

    await page.evaluate(async () => {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      window.setSampleRate(audioCtx.sampleRate);
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 2.0;

      const blob = new Blob(
        [
          `
        class RecorderProcessor extends AudioWorkletProcessor {
          process(inputs) {
            if (inputs[0] && inputs[0].length > 0) {
              this.port.postMessage(inputs[0][0]);
            }
            return true;
          }
        }
        registerProcessor('recorder-processor', RecorderProcessor);
      `,
        ],
        { type: "application/javascript" }
      );

      await audioCtx.audioWorklet.addModule(URL.createObjectURL(blob));
      const recorder = new AudioWorkletNode(audioCtx, "recorder-processor");
      recorder.port.onmessage = (e) => window.sendAudioChunk(e.data);

      const hookAudio = () => {
        document.querySelectorAll("video, audio").forEach((el) => {
          if (el.srcObject && !el.dataset.hooked) {
            el.dataset.hooked = "true";
            const source = audioCtx.createMediaStreamSource(el.srcObject);
            source.connect(gainNode);
            gainNode.connect(recorder);
          }
        });
      };
      setInterval(hookAudio, 3000);
      if (audioCtx.state === "suspended") await audioCtx.resume();
    });

    // --- AUTO EXIT ---
    await page.exposeFunction("notifyMeetingEnded", () =>
      browser.emit("disconnected")
    );
    await page.evaluate(() => {
      setInterval(() => {
        const text = document.body.innerText;
        if (
          text.includes("You left") ||
          text.includes("Return to home") ||
          text.includes("only one here")
        ) {
          window.notifyMeetingEnded();
        }
      }, 5000);
    });

    await page.click(chatSelector);
  } catch (err) {
    console.error("❌ Bot runtime error:", err);
    await finalSave();
  }
}

// =========================================================
// MAIN API CONTROLLER
// =========================================================
export const startMeetingBot = async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Meeting URL is required" });

  const userId = req.user ? req.user.id : null;
  if (!userId)
    return res.status(401).json({ error: "Unauthorized. User ID missing." });

  console.log(`[API] 🟢 Bot requested for: ${url} by User: ${userId}`);

  launchBot(url, userId).catch((err) => console.error("Bot crash:", err));

  res.status(200).json({
    message: "Bot dispatched. Check history when meeting ends.",
    url,
  });
};
