# Dino & Critter Colors

A simple Node.js + Express website that generates printable coloring pages for kids with the Gemini API.

## Features

- Dinosaurs, animals, and free custom themes
- Complete scene prompts instead of isolated sticker-style characters
- Style, age, line thickness, background amount, character count, and page count controls
- PNG download for each page
- Batch PDF download
- File-based generation cache to avoid repeated Gemini calls for the same request
- History gallery (`/api/history`) that lists every past cached batch so results survive closing the tab
- Up to 10 pages per request, generated in parallel batches
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

- The default image model is `gemini-3.1-flash-image` ("Nano Banana 2"), called via `generateContent`. The older `imagen-4.0-*` models are retired/unavailable to this project.
- You can override it with `GEMINI_IMAGE_MODEL`.
- The default image size setting is `1K` (override with `GEMINI_IMAGE_SIZE`).
- Pages are generated in parallel batches (`GEMINI_GENERATION_CONCURRENCY`, default 3) rather than fully sequentially.
- The server caches the full generated result of each request in `.cache/generated-images`.
- Repeating the same category, style, difficulty, count, page count, orientation, age, background, line thickness, theme, and extra request returns the cached result instead of calling Gemini again.
- Every cached batch is also listed by `GET /api/history` (and fetched in full by `GET /api/history/:cacheKey`) so past results stay reachable from the gallery instead of disappearing when the tab closes.
