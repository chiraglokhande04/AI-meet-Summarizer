

import { connect } from 'puppeteer-real-browser';
import fs from 'fs';
import pkg from 'wavefile';
const { WaveFile } = pkg;

async function launchBot(url) {
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

    let allAudioChunks = [];
    let isSaving = false;
    const meetingId = url.split('/').pop();

    // --- BULLETPROOF SAVE FUNCTION ---
    const finalSave = () => {
        if (isSaving) return;
        isSaving = true;

        console.log(`\n\x1b[36m[SYSTEM]\x1b[0m AI has left. Finalizing audio...`);

        if (allAudioChunks.length > 5000) {
            try {
                const wav = new WaveFile();
                // Google Meet usually runs at 44.1k or 48k; 44100 is the safe standard
                wav.fromScratch(1, 44100, '32f', allAudioChunks);
                
                // We use Sync to ensure the file is written before the process dies
                fs.writeFileSync('meeting.wav', wav.toBuffer());
                console.log("\x1b[32m✅ DONE:\x1b[0m File saved as 'meeting.wav'");
            } catch (err) {
                console.error("Failed to save audio:", err);
            }
        } else {
            console.log("\x1b[33m[WARNING]\x1b[0m No significant audio data captured.");
        }
        process.exit();
    };

    // --- EXIT LISTENERS ---
    
    // 1. Detect if the browser window is closed manually
    browser.on('disconnected', () => {
        finalSave();
    });

    // 2. Detect if kicked (Google Meet redirects to /landing/reauth or /exit)
    page.on('framenavigated', frame => {
        if (frame === page.mainFrame()) {
            const currentUrl = frame.url();
            if (!currentUrl.includes(meetingId)) {
                console.log("\x1b[35m[EVENT]\x1b[0m Bot was kicked or redirected.");
                finalSave();
            }
        }
    });

    // 3. Detect Ctrl+C in terminal
    process.on('SIGINT', () => {
        console.log("\nStopping manually...");
        finalSave();
    });

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });

        // JOIN LOGIC
        const micBtn = await page.waitForSelector('[aria-label*="microphone"]');
        await micBtn.click();
        const camBtn = await page.waitForSelector('[aria-label*="camera"]');
        await camBtn.click();

        await page.type('input[type="text"]', 'AI Assistant Bot', { delay: 150 });
        await page.evaluate(() => {
            const btn = [...document.querySelectorAll('button')].find(b => /Join|Ask/i.test(b.innerText));
            if (btn) btn.click();
        });

        console.log("Joined! Waiting for initialization...");
        await new Promise(r => setTimeout(r, 10000));

        // EXPOSE FUNCTIONS
        await page.exposeFunction('sendAudioChunk', (chunk) => {
            const data = Object.values(chunk);
            allAudioChunks.push(...data);
            // Visual feedback that it's actually hearing sound
            if (allAudioChunks.length % 50000 === 0) process.stdout.write("🎤");
        });

        // START MONITOR
        await page.evaluate(async () => {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // This captures the meeting's output by looking for audio/video tags
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                const input = e.inputBuffer.getChannelData(0);
                // Simple noise gate: only send if there is actual sound
                let hasSound = false;
                for(let i=0; i<input.length; i++) if(Math.abs(input[i]) > 0.01) { hasSound = true; break; }
                if(hasSound) window.sendAudioChunk(input);
            };

            const hookRemoteAudio = () => {
                document.querySelectorAll('video, audio').forEach(el => {
                    if (el.srcObject && !el.dataset.hooked) {
                        el.dataset.hooked = "true";
                        audioCtx.createMediaStreamSource(el.srcObject).connect(processor);
                    }
                });
            };
            setInterval(hookRemoteAudio, 3000);
            if (audioCtx.state === 'suspended') await audioCtx.resume();
        });

        const chatButton = '[aria-label*="Chat with everyone"]';
        await page.waitForSelector(chatButton);
        await page.click(chatButton);
        console.log("\x1b[32m[RUNNING]\x1b[0m Recording live. Kick the bot to finish.");

    } catch (err) {
        console.error("Bot Error:", err);
        finalSave();
    }
}

launchBot("https://meet.google.com/qjk-iaqd-zax");