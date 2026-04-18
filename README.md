# Dino & Critter Colors

A simple Node.js + Express website that generates printable coloring pages for kids with the Gemini API.

## Features

- Dinosaurs, animals, and free custom themes
- Complete scene prompts instead of isolated sticker-style characters
- Style, age, line thickness, background amount, character count, and page count controls
- PNG download for each page
- Batch PDF download
- Railway-ready deployment

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Add your Gemini API key:

   ```bash
   GEMINI_API_KEY=your_key_here
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

5. Open:

   ```text
   http://localhost:3000
   ```

## Railway Deployment

1. Push this project to GitHub.
2. Create a new Railway project from the repository.
3. Add the environment variable `GEMINI_API_KEY`.
4. Deploy. Railway will run `npm start`.

## Notes

- The default image model is `imagen-4.0-generate-001`.
- You can override it with `GEMINI_IMAGE_MODEL`.
- Imagen can return up to 4 images per request, so the server batches 5-page and 10-page jobs automatically.
