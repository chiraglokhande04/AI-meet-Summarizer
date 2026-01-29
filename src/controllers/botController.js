import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;

export const startMeetingBot = async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Meeting URL is required" });
    }

    // Run the bot in the background
    runBot(url);

    res.status(200).json({ message: "Bot dispatching to meeting..." });
};

async function runBot(url) {
    let allAudioChunks = [];
    let isSaving = false;
    const meetingId = url.split('/').pop();
    const fileName = `recording-${meetingId}-${Date.now()}.wav`;

    const { browser, page } = await connect({
        headless: false,
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox'
        ],
        turnstile: true
    });

    const finalSave = async () => {
        if (isSaving) return;
        isSaving = true;

        console.log(`\n[SYSTEM] Finalizing audio for ${meetingId}...`);

        if (allAudioChunks.length > 5000) {
            try {
                const wav = new WaveFile();
                wav.fromScratch(1, 44100, '32f', allAudioChunks);
                fs.writeFileSync(fileName, wav.toBuffer());
                console.log(`✅ DONE: Saved as ${fileName}`);
            } catch (err) {
                console.error("Failed to save audio:", err);
            }
        }
        await browser.close();
    };

    // Exit Listeners
    browser.on('disconnected', () => finalSave());
    
    page.on('framenavigated', frame => {
        if (frame === page.mainFrame() && !frame.url().includes(meetingId)) {
            finalSave();
        }
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Join Logic
        const micBtn = await page.waitForSelector('[aria-label*="microphone"]');
        await micBtn.click();
        const camBtn = await page.waitForSelector('[aria-label*="camera"]');
        await camBtn.click();

        await page.type('input[type="text"]', 'AI Assistant Bot', { delay: 100 });
        await page.evaluate(() => {
            const btn = [...document.querySelectorAll('button')].find(b => /Join|Ask/i.test(b.innerText));
            if (btn) btn.click();
        });

        await new Promise(r => setTimeout(r, 10000));

        await page.exposeFunction('sendAudioChunk', (chunk) => {
            allAudioChunks.push(...Object.values(chunk));
        });

        await page.evaluate(async () => {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                let hasSound = false;
                for(let i=0; i<input.length; i++) if(Math.abs(input[i]) > 0.01) { hasSound = true; break; }
                if(hasSound) window.sendAudioChunk(input);
            };

            const hook = () => {
                document.querySelectorAll('video, audio').forEach(el => {
                    if (el.srcObject && !el.dataset.hooked) {
                        el.dataset.hooked = "true";
                        audioCtx.createMediaStreamSource(el.srcObject).connect(processor);
                    }
                });
            };
            setInterval(hook, 3000);
            if (audioCtx.state === 'suspended') await audioCtx.resume();
        });

        // Open Chat
        const chatButton = '[aria-label*="Chat with everyone"]';
        await page.waitForSelector(chatButton);
        await page.click(chatButton);

        console.log(`[RUNNING] Recording meeting: ${meetingId}`);

    } catch (err) {
        console.error("Bot Error:", err);
        await finalSave();
    }
}