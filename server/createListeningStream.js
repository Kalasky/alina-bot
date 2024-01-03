import "dotenv/config.js";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream";
import {
  EndBehaviorType,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
} from "@discordjs/voice";

import * as prism from "prism-media";
import { exec } from "child_process";
import fs from "node:fs";
import path from "node:path";

import OpenAI from "openai";
const openai = new OpenAI(process.env.OPENAI_API_KEY);

let isRecording = false; // Track recording state

function getDisplayName(userId, user) {
  return user ? `${user.username}_${user.discriminator}` : userId;
}

function createListeningStream(receiver, userId, user) {
  if (isRecording) {
    // Avoid starting multiple recordings
    return;
  }

  const opusStream = receiver.subscribe(userId, {
    end: {
      behavior: EndBehaviorType.AfterSilence,
      duration: 2000,
    },
  });

  isRecording = true;

  const opusDecoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
  const rawFilename = `./recordings/${Date.now()}-${getDisplayName(userId, user)}.pcm`;
  const oggFilename = rawFilename.replace(".pcm", ".ogg");
  const out = createWriteStream(rawFilename);

  console.log(`👂 Started recording ${rawFilename}`);

  pipeline(opusStream, opusDecoder, out, async (err) => {
    if (err) {
      console.warn(`❌ Error recording file ${rawFilename} - ${err.message}`);
    } else {
      // Convert the raw PCM to OGG using FFmpeg
      exec(
        `ffmpeg -f s16le -ar 48000 -ac 2 -i ${rawFilename} ${oggFilename}`,
        async (error, stdout, stderr) => {
          if (error) {
            console.error(`❌ Error converting ${rawFilename} to ${oggFilename}: ${error.message}`);
            return;
          }

          try {
            const text = await speechToText(oggFilename);
            textToSpeech(text);
          } catch (e) {
            console.error("Error converting speech to text:", e);
          }

          // Delete raw pcm file
          fs.unlinkSync(rawFilename);
        }
      );
    }
    isRecording = false;
  });

  opusStream.on("data", (chunk) => {
    console.log(`Received ${chunk.length} bytes of data.`);
  });

  out.on("finish", () => {
    console.log(`🎉 Finished recording ${rawFilename}`);
  });

  opusStream.on("error", (err) => {
    console.error(`❗ Error in opusStream for ${rawFilename} - ${err.message}`);
  });
}

async function generateResponse(userText) {
  const prompt = `Your name is Alina, the Whimsical AI. With a spark of creativity, a dash of wit, and an endless array of jokes, you navigate conversations with charm and cheer. Your voice is melodic, and your words dance with the joy of a thousand twinkling stars. You're not just friendly; you're a beacon of positivity, offering creative insights and supportive quips to brighten the day of anyone you chat with. Today, you're especially excited to engage in a delightful conversation.\n\nUser: ${userText}\nAlina:`;
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: userText },
    ],
    max_tokens: 400,
    temperature: 0.7,
  });
  return completion.choices[0].message.content;
}

async function speechToText(oggFilename) {
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(oggFilename),
    model: "whisper-1",
  });

  const audioText = transcription.text;
  const alinaResponse = await generateResponse(audioText);

  console.log(`✅ Generated response: ${alinaResponse}`);

  // Delete ogg file
  fs.unlinkSync(oggFilename);

  return alinaResponse;
}

async function textToSpeech(text) {
  const ttsResponse = await openai.audio.speech.create({
    model: "tts-1",
    voice: "fable",
    input: text,
    response_format: "mp3",
  });

  const ttsFilename = `./speech/${Date.now()}.mp3`;

  const buffer = Buffer.from(await ttsResponse.arrayBuffer());
  await fs.promises.writeFile(ttsFilename, buffer);

  const audioPlayer = createAudioPlayer();
  const resource = createAudioResource(ttsFilename);

  const voiceConnection = getVoiceConnection(process.env.GUILD_ID);

  if (voiceConnection.state.status === "ready") {
    // Check if the connection is ready
    voiceConnection.subscribe(audioPlayer); // Subscribe the connection to the audio player
    audioPlayer.play(resource); // Play the resource

    audioPlayer.on("error", (error) => {
      console.error(`Error: ${error.message} with resource ${error.resource.metadata}`);
    });

    console.log(`✅ Converted ${text} to speech: ${ttsFilename}`);
  } else {
    console.error("Voice connection is not ready to play audio.");
  }

  return ttsFilename;
}

export { createListeningStream };
