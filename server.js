import 'dotenv/config';
import express from 'express';
import PDFDocument from 'pdfkit';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

const MAX_PAGES = 10;
const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || 'imagen-4.0-generate-001';
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Dino & Critter Colors',
    imageModel: GEMINI_MODEL,
    geminiConfigured: Boolean(ai)
  });
});

app.post('/api/generate', async (req, res) => {
  try {
    if (!ai) {
      return res.status(400).json({
        error: 'Missing GEMINI_API_KEY. Add it to your Railway variables or local .env file.'
      });
    }

    const options = sanitizeOptions(req.body);
    const pages = [];

    while (pages.length < options.pageCount) {
      const remaining = options.pageCount - pages.length;
      const batchSize = Math.min(remaining, 4);
      const prompt = buildColoringPrompt(options, pages.length);

      const response = await ai.models.generateImages({
        model: GEMINI_MODEL,
        prompt,
        config: {
          numberOfImages: batchSize,
          aspectRatio: imageAspectRatio(options.orientation),
          personGeneration: 'dont_allow'
        }
      });

      const generatedImages = response.generatedImages || [];
      for (const generatedImage of generatedImages) {
        const imageBytes = generatedImage?.image?.imageBytes;
        if (imageBytes) {
          pages.push({
            id: `page-${pages.length + 1}`,
            title: `Coloring Page ${pages.length + 1}`,
            image: `data:image/png;base64,${imageBytes}`,
            prompt
          });
        }
      }

      if (generatedImages.length === 0) {
        throw new Error('Gemini did not return an image. Try a simpler theme or request.');
      }
    }

    res.json({ pages });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || 'Unable to generate coloring pages right now.'
    });
  }
});

app.post('/api/pdf', (req, res) => {
  const images = Array.isArray(req.body?.images) ? req.body.images : [];

  if (images.length === 0) {
    return res.status(400).json({ error: 'No images were provided for the PDF.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="dino-critter-colors.pdf"');

  const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
  doc.pipe(res);

  images.forEach((image, index) => {
    if (index > 0) doc.addPage();

    const dataUrl = String(image);
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    doc
      .fontSize(13)
      .fillColor('#1f2937')
      .text(`Dino & Critter Colors - Page ${index + 1}`, { align: 'center' });

    doc.image(buffer, 54, 72, {
      fit: [504, 684],
      align: 'center',
      valign: 'center'
    });
  });

  doc.end();
});

app.listen(port, host, (error) => {
  if (error) {
    console.error(`Unable to start Dino & Critter Colors on ${host}:${port}:`, error.message);
    process.exit(1);
  }

  console.log(`Dino & Critter Colors is running on ${host}:${port}`);
});

function sanitizeOptions(body = {}) {
  const allowedCategories = ['dinosaurs', 'animals', 'vehicles', 'nature', 'sea', 'princess', 'free'];
  const allowedStyles = ['Realistic', 'Storybook style', 'Simple line art', 'Cute style', 'Encyclopedia style'];
  const allowedCounts = [3, 6, 10, 15];
  const allowedPages = [1, 3, 5];
  const allowedLineThickness = ['Thick', 'Normal', 'Thin'];
  const allowedBackgrounds = ['None', 'Light', 'Rich'];
  const allowedAges = ['0-2 years old', '3-4 years old', '5-6 years old', '7+ years old', 'Adults'];
  const allowedDifficulties = ['easy', 'normal', 'detailed'];
  const allowedStoryModes = ['none', 'gentle', 'adventure'];
  const allowedOrientations = ['portrait', 'landscape'];

  const category = pick(allowedCategories, body.category, 'dinosaurs');
  const characterCount = Number(body.characterCount);
  const pageCount = Number(body.pageCount);
  const theme = cleanText(body.theme, '') || defaultThemeForCategory(category);

  return {
    category,
    theme,
    style: pick(allowedStyles, body.style, 'Storybook style'),
    extraRequest: cleanText(body.extraRequest, ''),
    characterCount: allowedCounts.includes(characterCount) ? characterCount : 3,
    pageCount: allowedPages.includes(pageCount) ? Math.min(pageCount, MAX_PAGES) : 1,
    lineThickness: pick(allowedLineThickness, body.lineThickness, 'Thick'),
    backgroundAmount: pick(allowedBackgrounds, body.backgroundAmount, 'Rich'),
    ageLevel: pick(allowedAges, body.ageLevel, '3-4 years old'),
    difficulty: pick(allowedDifficulties, body.difficulty, 'easy'),
    storyMode: pick(allowedStoryModes, body.storyMode, 'none'),
    orientation: pick(allowedOrientations, body.orientation, 'portrait')
  };
}

function pick(allowed, value, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function cleanText(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, 300) || fallback;
}

function defaultThemeForCategory(category) {
  const themes = {
    dinosaurs: 'friendly dinosaur family in a prehistoric landscape',
    animals: 'friendly animals in a forest',
    vehicles: 'cheerful vehicles on a town road',
    nature: 'flowers, trees, clouds, and small nature friends in a garden',
    sea: 'friendly sea creatures swimming near coral and sea plants',
    princess: 'gentle princess and castle garden scene',
    free: 'happy imaginative coloring page scene for children'
  };

  return themes[category] || themes.free;
}

function imageAspectRatio(orientation) {
  return orientation === 'landscape' ? '4:3' : '3:4';
}

function buildColoringPrompt(options, offset) {
  const categoryGuidance = {
    dinosaurs:
      'Use dinosaurs as the main subject. Include natural prehistoric scene elements such as volcanoes, jungle plants, rivers, rocks, eggs, cliffs, trees, ferns, clouds, and footprints when appropriate.',
    animals:
      'Use animals as the main subject. Include natural scene elements such as forests, flowers, grass, clouds, rivers, trees, hills, stones, nests, and sunny open spaces when appropriate.',
    vehicles:
      'Use vehicles as the main subject. Include a complete child-friendly scene such as roads, stations, garages, bridges, town buildings, trees, clouds, signs without readable text, and safe travel details.',
    nature:
      'Use flowers and nature as the main subject. Include a complete gentle outdoor scene with flowers, trees, leaves, clouds, butterflies, garden paths, hills, and other calm natural details.',
    sea:
      'Use sea creatures as the main subject. Include a complete underwater or seaside scene with coral, sea plants, bubbles, rocks, shells, waves, and friendly ocean life.',
    princess:
      'Use a gentle princess and castle theme as the main subject. Include a complete storybook scene with a castle, garden, flowers, clouds, paths, friendly details, and no scary villains.',
    free:
      'Use the requested theme as the main subject. Build a complete connected scene with foreground, middle ground, and background details.'
  };

  const backgroundGuidance = {
    None: 'Use almost no background: only a ground line and one or two tiny context elements.',
    Light: 'Use a light background with a few clear environmental elements and plenty of open white space.',
    Rich: 'Use a rich complete scene with many colorable background details, while keeping shapes easy to color.'
  };

  const ageGuidance = {
    '0-2 years old': 'extremely large simple shapes, very thick outlines, almost no small details, very wide coloring spaces',
    '3-4 years old': 'large simple shapes, few small details, clear open spaces, easy-to-color forms',
    '5-6 years old': 'simple friendly shapes with moderate detail and readable outlines',
    '7+ years old': 'more detail and variety, but still clean and readable',
    Adults: 'intricate details, balanced composition, relaxing coloring-book complexity'
  };

  const difficultyGuidance = {
    easy:
      'Difficulty: very easy and easy to color. Use very thick bold outlines, much fewer tiny details, very large coloring spaces, simple scene composition, large rounded shapes, less busy background, and only a few clear scene elements. Avoid small textures, dense patterns, crowded objects, and complicated overlapping forms. This easy mode should visibly look simpler, cleaner, and more spacious than normal mode. If line thickness or background settings conflict, prioritize easy coloring, thick lines, and a less busy scene.',
    normal:
      'Difficulty: normal and balanced. Use medium-thick readable outlines, balanced detail, clear shapes, moderate coloring spaces, and a comfortable number of scene elements.',
    detailed:
      'Difficulty: detailed. Use thinner clean outlines, richer colorable details, more scene elements, varied textures, smaller parts are allowed, and the background can be more complex. This detailed mode should visibly look richer and more intricate than normal mode, while still staying printable and not cluttered. If line thickness or background settings conflict, allow finer lines and richer details for this mode.'
  };

  const storyGuidance = {
    none: '',
    gentle:
      'Story mode: gentle story. Make the scene feel like a calm warm picture-book moment, such as family, friends, nesting, playing gently, resting together, sharing, or helping each other.',
    adventure:
      'Story mode: safe adventure. Make the scene feel adventurous but child-safe, such as exploring a jungle, crossing a shallow river, discovering eggs, following footprints, or walking through a forest. Keep all action friendly and non-dangerous.'
  };

  const orientationGuidance = {
    portrait:
      'Orientation: portrait vertical page layout. Compose the scene taller than wide, suitable for a vertical printable coloring sheet.',
    landscape:
      'Orientation: landscape horizontal page layout. Compose the scene wider than tall, suitable for a horizontal printable coloring sheet.'
  };

  const safetyGuidance =
    'Always make the page child-safe, friendly, and not scary. Use gentle expressions, non-threatening faces, soft safe atmosphere, no aggressive poses, no horror feeling, no angry faces, no danger, and do not emphasize sharp scary teeth or claws. This applies to every category, especially dinosaurs, wild animals, sea creatures, and adventure scenes.';

  return [
    'Create a black and white printable coloring book page for kids.',
    `Theme: ${options.theme}.`,
    `Category: ${options.category}. ${categoryGuidance[options.category]}`,
    `Main character count: exactly ${options.characterCount} important colorable main subjects in the scene.`,
    `Page variation number: ${offset + 1}. Make this page composition distinct from the others.`,
    `Art style: ${options.style}.`,
    `Line thickness: ${options.lineThickness}.`,
    `Background amount: ${options.backgroundAmount}. ${backgroundGuidance[options.backgroundAmount]}`,
    `Age level: ${options.ageLevel}; use ${ageGuidance[options.ageLevel]}.`,
    difficultyGuidance[options.difficulty],
    orientationGuidance[options.orientation],
    storyGuidance[options.storyMode],
    safetyGuidance,
    options.extraRequest ? `Additional request: ${options.extraRequest}.` : '',
    'The result must be one complete cohesive scene, not isolated stickers, not clip art, not a collage, not comic panels.',
    'Use clean bold outlines, white fill areas, no gray shading, no color, no text, no letters, no watermark, no frame, no cropped main subjects.',
    'Make the scene happy, gentle, safe, and suitable for children.'
  ]
    .filter(Boolean)
    .join(' ');
}
