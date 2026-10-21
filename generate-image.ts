import { GoogleGenAI } from "@google/genai";
import fs from 'fs';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generate() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'A European fairytale town street, cozy and healing, dreamy and bright. Colorful European buildings (yellow, blue, pink, beige with red-brown tile roofs). A large number of star string lights hanging in the sky. A vintage Roman numeral clock sign. Clear and transparent blue sky, soft and warm lighting. The atmosphere is like a town in a fairytale book, clean, bright, and full of life. 16:9 aspect ratio.',
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64Data = part.inlineData.data;
        fs.writeFileSync('./public/generated-town.jpg', Buffer.from(base64Data, 'base64'));
        console.log('Image saved to public/generated-town.jpg');
        break;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
generate();
