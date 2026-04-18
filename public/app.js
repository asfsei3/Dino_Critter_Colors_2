const form = document.querySelector('#generatorForm');
const statusMessage = document.querySelector('#statusMessage');
const generateButton = document.querySelector('#generateButton');
const downloadPdfButton = document.querySelector('#downloadPdfButton');
const results = document.querySelector('#results');
const template = document.querySelector('#pageTemplate');

let generatedPages = [];
let hasGeneratedOnce = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setLoading(true);
  setStatus('ぬりえを つくっています。少しだけ お待ちください。');
  clearResults();

  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.characterCount = Number(payload.characterCount);
    payload.pageCount = Number(payload.pageCount);
    payload.lessScary = payload.lessScary === 'true';

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
    setStatus('ぬりえが できました。');
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

    img.src = page.image;
    img.alt = `できあがった ぬりえ ${index + 1}`;
    title.textContent = `ぬりえ ${index + 1}`;
    link.href = page.image;
    link.download = `dino-critter-colors-page-${index + 1}.png`;

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

function toFriendlyError(message) {
  if (message.includes('GEMINI_API_KEY')) {
    return 'Gemini APIキーが まだ設定されていません。.env または Railway の環境変数に GEMINI_API_KEY を入れてください。';
  }

  if (message.includes('PDF')) {
    return 'PDFを つくれませんでした。もういちど 試してください。';
  }

  if (message.includes('Gemini did not return')) {
    return '画像を つくれませんでした。テーマを少しシンプルにして、もういちど試してください。';
  }

  return 'うまく つくれませんでした。少し待ってから、もういちど試してください。';
}
