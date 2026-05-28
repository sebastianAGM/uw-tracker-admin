import fs from "fs";
import sharp from "sharp";

const input = "src/assets/logo.png";
const outDir = "public/icons";

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function make(size) {
  const padding = Math.round(size * 0.22); // margen ideal para logo ancho
  const inner = size - padding * 2;

  const logo = await sharp(input)
    .resize(inner, inner, { fit: "contain" }) // NO deforma
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }, // fondo blanco
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${outDir}/icon-${size}.png`);
}

await make(512);
await make(192);

console.log("✅ Icons generated in public/icons/");
