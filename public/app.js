const form = document.querySelector('#generatorForm');
const statusMessage = document.querySelector('#statusMessage');
const generateButton = document.querySelector('#generateButton');
const downloadPdfButton = document.querySelector('#downloadPdfButton');
const results = document.querySelector('#results');
const template = document.querySelector('#pageTemplate');
const historyList = document.querySelector('#historyList');

const categoryLabels = {
  dinosaurs: 'きょうりゅう',
  animals: 'どうぶつ',
  vehicles: 'のりもの',
  nature: 'はな・しぜん',
  sea: 'うみのいきもの',
  princess: 'おひめさま・おしろ',
  free: 'じゆう'
};

let generatedPages = [];
let hasGeneratedOnce = false;
let lastOrientation = 'portrait';

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(true);
  setStatus('ぬりえを つくっています。少しだけ お待ちください。');
  clearResults();

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.characterCount = Number(payload.characterCount);
    payload.pageCount = Number(payload.pageCount);
    lastOrientation = payload.orientation || 'portrait';

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(toFriendlyError(data.error || 'Generation failed.'));
    }

    generatedPages = data.pages || [];
    renderPages(generatedPages);
    hasGeneratedOnce = true;
    setStatus(`${generatedPages.length}まいの ぬりえが できました。`);
    loadHistory();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setLoading(false);
  }
});

downloadPdfButton.addEventListener('click', async () => {
  if (generatedPages.length === 0) return;

  downloadPdfButton.disabled = true;
  setStatus('PDFを つくっています。');

  try {
    const response = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: generatedPages.map((page) => page.image) })
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(toFriendlyError(data.error || 'Unable to create PDF.'));
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'dino-critter-colors.pdf');
    URL.revokeObjectURL(url);
    setStatus('PDFを ほぞんできます。');
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    downloadPdfButton.disabled = generatedPages.length === 0;
  }
});

function renderPages(pages) {
  results.classList.remove('results-empty');
  results.innerHTML = '';

  pages.forEach((page, index) => {
    const node = template.content.cloneNode(true);
    const img = node.querySelector('img');
    const title = node.querySelector('strong');
    const link = node.querySelector('a');
    const card = node.querySelector('.page-card');

    img.src = page.image;
    img.alt = `できあがった ぬりえ ${index + 1}`;
    title.textContent = `ぬりえ ${index + 1}`;
    link.href = page.image;
    link.download = `dino-critter-colors-page-${index + 1}.png`;
    card.classList.toggle('landscape', lastOrientation === 'landscape');

    results.appendChild(node);
  });

  downloadPdfButton.disabled = pages.length === 0;
}

function clearResults() {
  generatedPages = [];
  downloadPdfButton.disabled = true;
  results.classList.add('results-empty');
  results.innerHTML = `
    <div class="empty-state">
      <span aria-hidden="true">🖼️</span>
      <p>ここに ぬりえが ならびます</p>
      <small>つくったあと、PNGやPDFでほぞんできます</small>
    </div>
  `;
}

function setLoading(isLoading) {
  generateButton.disabled = isLoading;
  generateButton.innerHTML = isLoading
    ? '<span aria-hidden="true">...</span> つくっています'
    : hasGeneratedOnce
      ? '<span aria-hidden="true">🖍️</span> もういちど つくる'
      : '<span aria-hidden="true">🖍️</span> ぬりえを つくる！';
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('error', isError);
}

function triggerDownload(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function loadHistory() {
  try {
    const response = await fetch('/api/history');
    const data = await response.json();
    renderHistory(data.entries || []);
  } catch (error) {
    // History is a convenience feature; failing to load it should not block the app.
    console.warn('Unable to load history', error);
  }
}

function renderHistory(entries) {
  historyList.innerHTML = '';

  entries.forEach((entry) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'history-card';

    const img = document.createElement('img');
    img.src = entry.thumbnail || '';
    img.alt = entry.theme || entry.category || 'ぬりえ';
    card.appendChild(img);

    const label = document.createElement('small');
    const categoryLabel = categoryLabels[entry.category] || entry.category || '';
    const dateLabel = entry.createdAt ? new Date(entry.createdAt).toLocaleString('ja-JP') : '';
    label.textContent = `${categoryLabel} ${entry.pageCount}まい\n${dateLabel}`;
    card.appendChild(label);

    card.addEventListener('click', () => loadHistoryEntry(entry.cacheKey));
    historyList.appendChild(card);
  });
}

async function loadHistoryEntry(cacheKey) {
  setStatus('きろくを よみこんでいます。');

  try {
    const response = await fetch(`/api/history/${cacheKey}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(toFriendlyError(data.error || 'Unable to load history entry.'));
    }

    generatedPages = data.pages || [];
    renderPages(generatedPages);
    hasGeneratedOnce = true;
    setLoading(false);
    setStatus(`きろくから ${generatedPages.length}まい よみこみました。`);
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    setStatus(error.message, true);
  }
}

loadHistory();

function toFriendlyError(message) {
  if (message.includes('GEMINI_API_KEY')) {
    return 'Gemini APIキーが まだ設定されていません。.env または Railway の環境変数に GEMINI_API_KEY を入れてください。';
  }

  if (message.includes('PDF')) {
    return 'PDFを つくれませんでした。もういちど 試してください。';
  }

  if (message.includes('Gemini did not return')) {
    return '画像を つくれませんでした。てーまを少し かんたんにして、もういちど試してください。';
  }

  return 'うまく つくれませんでした。少し待ってから、もういちど試してください。';
}
