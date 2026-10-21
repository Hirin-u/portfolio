import fs from 'fs';
import https from 'https';

const prompt = "A European fairytale town street cozy healing dreamy bright Colorful European buildings yellow blue pink beige with red brown tile roofs star string lights hanging in the sky vintage Roman numeral clock sign Clear transparent blue sky soft warm lighting atmosphere like a town in a fairytale book clean bright full of life";
const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1920&height=1080&nologo=true&seed=42`;

https.get(url, (res) => {
  const file = fs.createWriteStream('./public/town-generated.jpg');
  res.pipe(file);
  file.on('finish', () => {
    file.close();
    console.log('Image downloaded to public/town-generated.jpg');
  });
}).on('error', (err) => {
  console.error('Error downloading image:', err);
});
