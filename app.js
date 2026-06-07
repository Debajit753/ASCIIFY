/* ============================================================
   ASCIIFY — app logic (vanilla JS, no dependencies)
   ============================================================ */

/* ══════════════════════════════════════════════════════════════════════
   ⚙  CONFIG  —  EDIT THIS AFTER YOU CREATE YOUR GITHUB REPO
   ----------------------------------------------------------------------
   This is the ONLY place you need to change. Replace the placeholders
   below with your repository + profile URLs. Every GitHub link on the
   page (the "GITHUB ↗" nav link and the buttons at the bottom of the
   About page) is wired from these values automatically.
   ══════════════════════════════════════════════════════════════════════ */
const CONFIG = {
  REPO_URL:    "https://github.com/Debajit753/ASCIIFY",   // ← your repository URL
  AUTHOR_NAME: "Debajit",                                  // ← shown in the credit line
  AUTHOR_URL:  "https://github.com/Debajit753"            // ← your GitHub profile
};
/* ════════════════════════════════════════════════════════════════════ */

(() => {
  // ---------- refs ----------
  const $ = id => document.getElementById(id);
  const homeEmpty = $('home-empty'), homePlayer = $('home-player');
  const drop = $('drop'), browseBtn = $('browseBtn'), fileInput = $('file');
  const urlInput = $('urlInput'), urlBtn = $('urlBtn'), err = $('err');

  const video = $('orig'), canvas = $('ascii'), ctx = canvas.getContext('2d');
  const playBtn = $('playBtn'), seek = $('seek'), timeEl = $('time'), vol = $('vol');

  const density = $('density'), densVal = $('densVal');
  const thresholdEl = $('threshold'), threshVal = $('threshVal');
  const fontFactorEl = $('fontFactor'), fontVal = $('fontVal');
  const charset = $('charset'), colorSeg = $('colorSeg'), viewSeg = $('viewSeg');
  const exportBtn = $('exportBtn'), newBtn = $('newBtn');
  const stDot = $('stDot'), stState = $('stState'), stFile = $('stFile'), stMeta = $('stMeta');

  // offscreen sampling canvas
  const sample = document.createElement('canvas');
  const sctx = sample.getContext('2d', { willReadFrequently: true });

  // ---------- state ----------
  const RAMPS = {
    standard: " .:-=+*#%@",
    fine: " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
    detailed: " .,:;i1tfLCG08@",
    minimal: " .*#",
    blocks: " ░▒▓█"
  };
  let cols = 90, rows = 0, cellW = 7, cellH = 12;
  let ramp = RAMPS.standard;
  let threshold = 0;        // 0..255 luminance floor
  let fontFactor = 1;       // glyph size relative to cell
  let colorMode = 'color';  // color | mono | invert
  let view = 'ascii';       // ascii | original
  let objectURL = null, currentName = '', loaded = false;
  let frames = 0, fpsT = performance.now(), fps = 0;

  // ---------- helpers ----------
  const fmt = t => { if (!isFinite(t)) t = 0; const m = Math.floor(t/60), s = Math.floor(t%60); return m + ':' + String(s).padStart(2,'0'); };
  const setState = (txt, color) => { stState.textContent = txt; stDot.style.background = color || 'var(--amber)'; };
  function updateMeta(){
    stMeta.textContent = (video.videoWidth||0) + '×' + (video.videoHeight||0) + ' · ' + cols + '×' + rows + ' grid · ' + fps + ' fps';
  }

  // ---------- routing ----------
  function show(page){
    $('page-home').hidden = page !== 'home';
    $('page-about').hidden = page !== 'about';
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    if (page === 'home') syncHome();
  }
  function syncHome(){ homeEmpty.hidden = loaded; homePlayer.hidden = !loaded; }
  function route(){ const h = (location.hash || '#home').replace('#',''); show(h === 'about' ? 'about' : 'home'); }
  window.addEventListener('hashchange', route);
  route();

  // ---------- wire every GitHub link from CONFIG (one source of truth) ----------
  document.querySelectorAll('[data-repo]').forEach(a => a.href = CONFIG.REPO_URL);
  document.querySelectorAll('[data-issues]').forEach(a => a.href = CONFIG.REPO_URL.replace(/\/+$/,'') + '/issues');
  document.querySelectorAll('[data-author]').forEach(a => { a.href = CONFIG.AUTHOR_URL; a.textContent = CONFIG.AUTHOR_NAME; });
  { const gh = document.getElementById('ghNav'); if (gh) gh.href = CONFIG.REPO_URL; }

  // ---------- loading ----------
  function loadFile(file){
    err.textContent = '';
    if (!file || !file.type.startsWith('video/')) { err.textContent = '! please drop a valid video file (MP4 or WebM)'; return; }
    if (objectURL) URL.revokeObjectURL(objectURL);
    video.crossOrigin = null;
    objectURL = URL.createObjectURL(file);    // streamed from disk, never uploaded
    currentName = file.name;
    setState('DECODING…');
    video.src = objectURL; video.load();
  }
  function loadURL(url){
    err.textContent = '';
    url = (url || '').trim(); if (!url) return;
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
    video.crossOrigin = 'anonymous';          // REQUIRED or the canvas is tainted and getImageData() throws
    currentName = url.split('/').pop() || url;
    setState('DECODING…');
    video.src = url; video.load();
  }

  browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => loadFile(e.target.files[0]));
  urlBtn.addEventListener('click', () => loadURL(urlInput.value));
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadURL(urlInput.value); });

  ['dragenter','dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('armed'); }));
  ['dragleave','drop'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); if (ev==='dragleave' && e.relatedTarget) return; drop.classList.remove('armed'); }));
  window.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('armed'); if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]); });

  video.addEventListener('loadedmetadata', () => {
    loaded = true;
    if (location.hash && location.hash !== '#home') location.hash = '#home'; else { show('home'); }
    computeGrid();
    seek.max = video.duration;
    timeEl.textContent = '0:00 / ' + fmt(video.duration);
    stFile.textContent = currentName;
    setState('READY');
    updateMeta();
    drawFrame();
  });
  video.addEventListener('error', () => {
    err.textContent = '! could not load this video. for a URL the server must send CORS headers (YouTube will not work) — otherwise try an MP4 (H.264) or WebM file.';
    setState('ERROR', '#ff6b5e');
  });

  // ---------- engine ----------
  function computeGrid(){
    cols = parseInt(density.value, 10);
    const ar = (video.videoHeight / video.videoWidth) || 0.5625;
    rows = Math.max(1, Math.round(cols * ar * 0.5));   // chars are ~2× taller than wide
    sample.width = cols; sample.height = rows;
    const maxW = 1200;
    cellW = Math.max(3, Math.floor(maxW / cols));
    cellH = Math.round(cellW * 1.8);
    canvas.width = cols * cellW; canvas.height = rows * cellH;
    ctx.font = Math.max(2, Math.round(cellH * fontFactor)) + "px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textBaseline = 'top';
  }

  function drawFrame(){
    if (video.readyState < 2 || !canvas.width) return;
    sctx.drawImage(video, 0, 0, cols, rows);
    const data = sctx.getImageData(0, 0, cols, rows).data;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const last = ramp.length - 1;
    for (let y = 0; y < rows; y++){
      for (let x = 0; x < cols; x++){
        const i = (y * cols + x) * 4;
        let r = data[i], g = data[i+1], b = data[i+2];
        if (colorMode === 'invert') { r = 255 - r; g = 255 - g; b = 255 - b; }
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;   // Rec.709
        if (lum < threshold) continue;                       // clip shadows
        const ch = ramp[Math.round((lum / 255) * last)];
        if (ch === ' ') continue;
        if (colorMode === 'mono')
          ctx.fillStyle = 'rgb(' + ((lum*0.18)|0) + ',' + (lum|0) + ',' + ((lum*0.5)|0) + ')';  // phosphor green
        else
          ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        ctx.fillText(ch, x * cellW, y * cellH);
      }
    }
  }

  function loop(){
    if (video.paused || video.ended) return;
    drawFrame();
    if (view === 'ascii') {
      seek.value = video.currentTime;
      timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration);
    }
    frames++;
    const now = performance.now();
    if (now - fpsT >= 500){ fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now; updateMeta(); }
    requestAnimationFrame(loop);
  }

  // ---------- transport ----------
  const togglePlay = () => { if (video.paused) video.play(); else video.pause(); };
  playBtn.addEventListener('click', togglePlay);
  video.addEventListener('play', () => { playBtn.textContent = '❚❚'; setState('PLAYING'); requestAnimationFrame(loop); });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; setState('PAUSED'); });
  video.addEventListener('ended', () => { playBtn.textContent = '▶'; setState('READY'); });
  seek.addEventListener('input', () => { video.currentTime = parseFloat(seek.value); timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration); });
  video.addEventListener('seeked', drawFrame);
  vol.addEventListener('input', () => { video.volume = parseFloat(vol.value); });

  // ---------- parameters ----------
  density.addEventListener('input', () => { densVal.textContent = density.value; computeGrid(); drawFrame(); updateMeta(); });
  thresholdEl.addEventListener('input', () => { threshold = parseInt(thresholdEl.value,10) * 2.55; threshVal.textContent = thresholdEl.value; drawFrame(); });
  fontFactorEl.addEventListener('input', () => { fontFactor = parseFloat(fontFactorEl.value); fontVal.textContent = fontFactor.toFixed(2); computeGrid(); drawFrame(); });
  charset.addEventListener('change', () => { ramp = RAMPS[charset.value]; drawFrame(); });

  colorSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    colorMode = b.dataset.mode;
    [...colorSeg.children].forEach(c => c.classList.toggle('active', c === b));
    drawFrame();
  });
  viewSeg.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    view = b.dataset.view;
    [...viewSeg.children].forEach(c => c.classList.toggle('active', c === b));
    const original = view === 'original';
    video.style.display = original ? 'block' : 'none';
    canvas.style.display = original ? 'none' : 'block';
  });

  exportBtn.addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = (currentName ? currentName.replace(/\.[^.]+$/, '') : 'asciify') + '-frame.png';
    a.href = canvas.toDataURL('image/png'); a.click();
  });

  newBtn.addEventListener('click', () => {
    video.pause();
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
    video.removeAttribute('src'); video.load();
    loaded = false; currentName = '';
    view = 'ascii'; video.style.display = 'none'; canvas.style.display = 'block';
    [...viewSeg.children].forEach((c,i) => c.classList.toggle('active', i === 0));
    urlInput.value = ''; err.textContent = '';
    stFile.textContent = 'no file loaded'; stMeta.textContent = '—'; setState('READY');
    show('home');
  });

  // ---------- keyboard ----------
  window.addEventListener('keydown', e => {
    if (!loaded || homePlayer.hidden) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.code === 'ArrowRight') video.currentTime = Math.min(video.duration, video.currentTime + 5);
    else if (e.code === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
  });
})();
