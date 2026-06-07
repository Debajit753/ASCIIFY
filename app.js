/* ============================================================
   ASCIIFY — app logic (vanilla JS, no dependencies)
   ============================================================ */

const CONFIG = {
  REPO_URL:    "https://github.com/Debajit753/ASCIIFY",   // ← your repository URL
  AUTHOR_NAME: "Debajit",                                  // ← shown in the credit line
  AUTHOR_URL:  "https://github.com/Debajit753"            // ← your GitHub profile
};
/* ════════════════════════════════════════════════════════════════════ */

(() => {
  "use strict";
  const $ = id => document.getElementById(id);

  // ---------- shell refs ----------
  const homeEmpty = $('home-empty'), homePlayer = $('home-player');
  const drop = $('drop'), dropTitle = $('dropTitle'), browseBtn = $('browseBtn'), fileInput = $('file');
  const urlInput = $('urlInput'), urlBtn = $('urlBtn'), err = $('err');

  // ---------- player refs ----------
  const stage = $('stage'), canvasFrame = $('canvasFrame');
  const video = $('orig'), canvas = $('ascii');
  const loadOverlay = $('loadOverlay'), decDots = $('decDots');
  const errOverlay = $('errOverlay'), errMsg = $('errMsg'), errRetry = $('errRetry');
  const playBtn = $('playBtn'), seek = $('seek'), timeEl = $('time'), vol = $('vol');

  const density = $('density'), densVal = $('densVal');
  const thresholdEl = $('threshold'), threshVal = $('threshVal');
  const fontFactorEl = $('fontFactor'), fontVal = $('fontVal');
  const charset = $('charset'), customRampInput = $('customRamp');
  const colorSeg = $('colorSeg'), viewSeg = $('viewSeg');
  const exportBtn = $('exportBtn'), exportVideoBtn = $('exportVideoBtn'), newBtn = $('newBtn');
  const stDot = $('stDot'), stState = $('stState'), stFile = $('stFile'), stMeta = $('stMeta');

  const dctx = canvas.getContext('2d');
  const sample = document.createElement('canvas');
  const sctx = sample.getContext('2d', { willReadFrequently: true });

  // ---------- character ramps ----------
  const RAMPS = {
    standard: " .:-=+*#%@",
    detailed: " .,:;i1tfLCG08@",
    minimal:  " .*#",
    blocks:   " ░▒▓█",
    fine:     " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
  };

  // ---------- settings (persisted in localStorage) ----------
  const LS_KEY = 'asciify_settings';
  const DEFAULTS = { density: 80, charSet: 'standard', viewMode: 'ascii', colorMode: 'color', customRamp: '', threshold: 0, fontSizeFactor: 1.0 };
  function loadSettings() {
    let s = { ...DEFAULTS };
    try { const raw = localStorage.getItem(LS_KEY); if (raw) s = { ...s, ...JSON.parse(raw) }; } catch (e) {}
    if (s.colorMode === 'inverted') s.colorMode = 'invert';
    if (!['color', 'mono', 'invert'].includes(s.colorMode)) s.colorMode = 'color';
    if (!['ascii', 'original'].includes(s.viewMode)) s.viewMode = 'ascii';
    if (!(s.charSet in RAMPS) && s.charSet !== 'custom') s.charSet = 'standard';
    s.density = Math.min(200, Math.max(20, +s.density || 80));
    s.threshold = Math.min(128, Math.max(0, +s.threshold || 0));
    s.fontSizeFactor = Math.min(2, Math.max(0.5, +s.fontSizeFactor || 1));
    return s;
  }
  function saveSettings() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
  const S = loadSettings();

  // ---------- runtime state ----------
  let objectURL = null, currentName = '', loaded = false, isRecording = false;
  let rafId = null, rvfcId = null, dotsTimer = null;
  let fpsCount = 0, fpsTimer = performance.now(), fps = 0;
  let vW = 0, vH = 0, vAR = 0;
  let grid = { cols: 0, rows: 0 };
  let mediaRecorder = null, recordedChunks = [];

  // ---------- helpers ----------
  function fmt(s) {
    if (!isFinite(s)) s = 0;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
    const p = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
  }
  function setState(txt, color) { stState.textContent = txt; stDot.style.background = color || 'var(--amber)'; }
  function updateMeta() { stMeta.textContent = vW > 0 ? `${vW}×${vH} · ${grid.cols}×${grid.rows} · ${fps} fps` : '—'; }
  function activateSeg(seg, attr, val) { [...seg.children].forEach(b => b.classList.toggle('active', b.dataset[attr] === val)); }
  function showLoading(on) {
    loadOverlay.hidden = !on;
    if (on && !dotsTimer) { decDots.textContent = ''; dotsTimer = setInterval(() => { decDots.textContent = decDots.textContent.length >= 3 ? '' : decDots.textContent + '.'; }, 400); }
    if (!on && dotsTimer) { clearInterval(dotsTimer); dotsTimer = null; }
  }
  function showError(msg) { showLoading(false); errMsg.textContent = msg; errOverlay.hidden = false; }
  function hideError() { errOverlay.hidden = true; }

  // ---------- routing + GitHub links (shell) ----------
  function show(page) {
    $('page-home').hidden = page !== 'home';
    $('page-about').hidden = page !== 'about';
    document.querySelectorAll('.navlink').forEach(a => a.classList.toggle('active', a.dataset.page === page));
    if (page === 'home') syncHome();
  }
  function syncHome() { homeEmpty.hidden = loaded; homePlayer.hidden = !loaded; }
  function route() { const h = (location.hash || '#home').replace('#', ''); show(h === 'about' ? 'about' : 'home'); }
  window.addEventListener('hashchange', route);
  route();

  document.querySelectorAll('[data-repo]').forEach(a => a.href = CONFIG.REPO_URL);
  document.querySelectorAll('[data-issues]').forEach(a => a.href = CONFIG.REPO_URL.replace(/\/+$/, '') + '/issues');
  document.querySelectorAll('[data-author]').forEach(a => { a.href = CONFIG.AUTHOR_URL; a.textContent = CONFIG.AUTHOR_NAME; });
  { const gh = $('ghNav'); if (gh) gh.href = CONFIG.REPO_URL; }

  // ---------- clicking the logo always returns to the home / upload screen ----------
  { const logo = document.querySelector('.logo'); if (logo) logo.addEventListener('click', e => { e.preventDefault(); if (location.hash && location.hash !== '#home') location.hash = '#home'; resetToHome(); }); }

  // ---------- init UI from saved settings ----------
  density.value = S.density;            densVal.textContent = S.density;
  thresholdEl.value = S.threshold;      threshVal.textContent = Math.round(S.threshold / 128 * 100);
  fontFactorEl.value = S.fontSizeFactor; fontVal.textContent = Number(S.fontSizeFactor).toFixed(2);
  charset.value = S.charSet;
  customRampInput.value = S.customRamp;
  customRampInput.hidden = S.charSet !== 'custom';
  activateSeg(colorSeg, 'mode', S.colorMode);
  activateSeg(viewSeg, 'view', S.viewMode);

  // ---------- file validation ----------
  const SUPPORTED_MIME = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo'];
  const SUPPORTED_EXT = /\.(mp4|webm|ogg|mov|avi|mkv)$/i;
  function isVideoFile(f) {
    if (!f) return false;
    if (SUPPORTED_MIME.includes(f.type)) return true;
    if (SUPPORTED_EXT.test(f.name || '')) return true;
    return document.createElement('video').canPlayType(f.type || '') !== '';
  }
  function validateFile(f) {
    if (!f) return 'no file selected.';
    if (f.size === 0) return 'file is empty or corrupt.';
    if (!isVideoFile(f)) return `unsupported format "${f.type || (f.name || '').split('.').pop()}" — try MP4 or WebM.`;
    return null;
  }

  // ---------- loading ----------
  function loadFromFile(file) {
    const v = validateFile(file);
    if (v) { err.textContent = '! ' + v; return; }
    err.textContent = file.size > 500 * 1024 * 1024 ? `note: large file (${Math.round(file.size / 1048576)} MB) — may be slow.` : '';
    startVideo(file, file.name);
  }

  async function loadFromURL(url) {
    url = (url || '').trim();
    if (!url) return;
    err.textContent = ''; urlBtn.textContent = '···'; urlBtn.disabled = true;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const blob = await res.blob();
      const clean = url.split('?')[0];
      const ext = (clean.split('.').pop() || 'mp4').toLowerCase();
      const name = clean.split('/').pop() || ('video.' + ext);
      startVideo(new File([blob], name, { type: blob.type || ('video/' + ext) }), name);
    } catch (e) {
      err.textContent = '! could not load URL — the server must allow cross-origin (CORS). YouTube will not work.';
    } finally {
      urlBtn.textContent = 'LOAD'; urlBtn.disabled = false;
    }
  }

  function startVideo(blob, name) {
    stopRecordingIfAny();
    if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(blob);
    currentName = name;
    loaded = true;
    vW = vH = vAR = 0; grid = { cols: 0, rows: 0 };
    hideError();
    playBtn.textContent = '▶'; seek.value = 0; timeEl.textContent = '0:00 / 0:00';
    location.hash = '#home';
    show('home');               // reveals the player (loaded === true)
    showLoading(true);
    setState('DECODING…');
    stFile.textContent = name; stMeta.textContent = '—';
    video.src = objectURL;
    video.load();
  }

  // ---------- input events ----------
  browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFromFile(f); e.target.value = ''; });
  urlBtn.addEventListener('click', () => loadFromURL(urlInput.value));
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadFromURL(urlInput.value); });

  function setDropTitle(t) { if (dropTitle) dropTitle.textContent = t; }
  ['dragenter', 'dragover'].forEach(ev => window.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('armed'); setDropTitle('RELEASE TO DROP'); }));
  window.addEventListener('dragleave', e => { e.preventDefault(); if (!e.relatedTarget) { drop.classList.remove('armed'); setDropTitle('DRAG VIDEO HERE'); } });
  window.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('armed'); setDropTitle('DRAG VIDEO HERE');
    const files = [...(e.dataTransfer ? e.dataTransfer.files : [])];
    const f = files.find(isVideoFile) || files[0];
    if (f) loadFromFile(f);
  });

  // ---------- canvas sizing (aspect-ratio aware) ----------
  function applyCanvasSize() {
    if (!stage || !canvasFrame || !canvas) return;
    const cW = stage.clientWidth, cH = stage.clientHeight;
    let w = cW, h = cH;
    if (vAR > 0) {
      h = cW / vAR;
      if (h > cH) { h = cH; w = cH * vAR; }
      w = Math.round(w); h = Math.round(h);
    }
    canvasFrame.style.width = w + 'px';
    canvasFrame.style.height = h + 'px';
    canvasFrame.style.left = Math.round((cW - w) / 2) + 'px';
    canvasFrame.style.top = Math.round((cH - h) / 2) + 'px';
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
  }
  const ro = new ResizeObserver(() => { applyCanvasSize(); render(); });
  ro.observe(stage);

  // ---------- the render (luminance → glyph, tinted) ----------
  function render() {
    if (video.readyState < 2) return;
    const W = canvas.width, H = canvas.height;
    if (W === 0 || H === 0) return;

    if (S.viewMode === 'original') { dctx.drawImage(video, 0, 0, W, H); return; }

    const ramp = (S.charSet === 'custom' && S.customRamp) ? S.customRamp : (RAMPS[S.charSet] || RAMPS.standard);
    const last = ramp.length - 1;
    const cols = Math.max(4, Math.min(S.density, Math.floor(W / 4)));
    const charW = W / cols;
    const lineH = charW / 0.601;                 // JetBrains Mono advance ratio
    const fontSize = lineH * S.fontSizeFactor;
    const rows = Math.max(1, Math.floor(H / lineH));
    grid = { cols, rows };

    if (sample.width !== cols || sample.height !== rows) { sample.width = cols; sample.height = rows; }
    sctx.drawImage(video, 0, 0, cols, rows);
    const data = sctx.getImageData(0, 0, cols, rows).data;

    dctx.fillStyle = '#000'; dctx.fillRect(0, 0, W, H);
    dctx.font = `${fontSize}px "JetBrains Mono","IBM Plex Mono",monospace`;
    dctx.textBaseline = 'top';

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const idx = (row * cols + col) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2];
        const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) | 0;     // Rec.709
        if (L < S.threshold) continue;
        const mappedL = S.colorMode === 'invert' ? 255 - L : L;
        const glyph = ramp[Math.min((mappedL / 255 * last) | 0, last)];
        if (glyph === ' ') continue;

        if (S.colorMode === 'mono') {
          dctx.fillStyle = '#00FF41';
        } else {
          const rn = r / 255, gn = g / 255, bn = b / 255;
          const cmax = Math.max(rn, gn, bn), cmin = Math.min(rn, gn, bn), delta = cmax - cmin;
          let hue = 0;
          if (delta > 0.001) {
            if (cmax === rn)      hue = (((gn - bn) / delta) % 6 + 6) % 6;
            else if (cmax === gn) hue = (bn - rn) / delta + 2;
            else                  hue = (rn - gn) / delta + 4;
          }
          const sat = delta < 0.001 ? 0 : delta / (1 - Math.abs(cmax + cmin - 1));
          const dS = Math.min(100, sat * 140) | 0;
          const dL = S.colorMode === 'invert' ? (85 - (L / 255) * 60) | 0 : (25 + (L / 255) * 60) | 0;
          dctx.fillStyle = `hsl(${(hue / 6 * 360) | 0},${dS}%,${dL}%)`;
        }
        dctx.fillText(glyph, col * charW, row * lineH);
      }
    }

    fpsCount++;
    const now = performance.now(), el = now - fpsTimer;
    if (el >= 1000) { fps = Math.round(fpsCount * 1000 / el); fpsCount = 0; fpsTimer = now; updateMeta(); }
  }

  // ---------- render loop (requestVideoFrameCallback + rAF fallback) ----------
  function frameTick() {
    render();
    if (!video.paused && !video.ended) { seek.value = video.currentTime; timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration); }
  }
  function startLoop() {
    stopLoop();
    if ('requestVideoFrameCallback' in video) {
      const cb = () => { frameTick(); rvfcId = (!video.paused && !video.ended) ? video.requestVideoFrameCallback(cb) : null; };
      rvfcId = video.requestVideoFrameCallback(cb);
    } else {
      const cb = () => { frameTick(); rafId = (!video.paused && !video.ended) ? requestAnimationFrame(cb) : null; };
      rafId = requestAnimationFrame(cb);
    }
  }
  function stopLoop() {
    if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    if (rvfcId != null && video.cancelVideoFrameCallback) { video.cancelVideoFrameCallback(rvfcId); rvfcId = null; }
  }

  // ---------- video events ----------
  video.addEventListener('loadedmetadata', () => {
    vW = video.videoWidth; vH = video.videoHeight;
    vAR = (vW > 0 && vH > 0) ? vW / vH : 0;
    seek.max = video.duration || 1;
    timeEl.textContent = '0:00 / ' + fmt(video.duration);
    stFile.textContent = currentName;
    applyCanvasSize();
    updateMeta();
  });
  video.addEventListener('canplay', () => { showLoading(false); render(); setState('READY'); });
  video.addEventListener('play', () => { playBtn.textContent = '❚❚'; setState('PLAYING'); startLoop(); });
  video.addEventListener('pause', () => { playBtn.textContent = '▶'; setState('PAUSED'); stopLoop(); render(); });
  video.addEventListener('ended', () => { playBtn.textContent = '▶'; setState('READY'); stopLoop(); });
  video.addEventListener('seeked', render);
  video.addEventListener('timeupdate', () => { seek.value = video.currentTime; timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration); });
  video.addEventListener('volumechange', () => { vol.value = video.muted ? 0 : video.volume; });
  video.addEventListener('error', () => {
    const code = video.error && video.error.code;
    const msgs = { 1: 'Playback aborted.', 2: 'Network error — for a URL the host must allow CORS.', 3: 'Decoding failed. Try MP4 (H.264) or WebM.', 4: 'Unsupported format. Try MP4 or WebM.' };
    showError(msgs[code] || 'Could not load this video.');
    setState('ERROR', '#ff6b5e');
  });

  // ---------- transport ----------
  playBtn.addEventListener('click', () => { video.paused ? video.play() : video.pause(); });
  seek.addEventListener('input', () => { video.currentTime = parseFloat(seek.value); timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(video.duration); });
  vol.addEventListener('input', () => { video.volume = parseFloat(vol.value); video.muted = false; });

  // ---------- parameters ----------
  density.addEventListener('input', () => { S.density = +density.value; densVal.textContent = S.density; saveSettings(); render(); updateMeta(); });
  thresholdEl.addEventListener('input', () => { S.threshold = +thresholdEl.value; threshVal.textContent = Math.round(S.threshold / 128 * 100); saveSettings(); render(); });
  fontFactorEl.addEventListener('input', () => { S.fontSizeFactor = +fontFactorEl.value; fontVal.textContent = S.fontSizeFactor.toFixed(2); saveSettings(); render(); });
  charset.addEventListener('change', () => { S.charSet = charset.value; customRampInput.hidden = S.charSet !== 'custom'; saveSettings(); render(); });
  customRampInput.addEventListener('input', () => { S.customRamp = customRampInput.value; saveSettings(); render(); });
  colorSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.colorMode = b.dataset.mode; activateSeg(colorSeg, 'mode', S.colorMode); saveSettings(); render(); });
  viewSeg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.viewMode = b.dataset.view; activateSeg(viewSeg, 'view', S.viewMode); saveSettings(); render(); });

  // ---------- export: PNG frame ----------
  exportBtn.addEventListener('click', () => {
    if (!canvas.width) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'asciify-frame-' + Math.floor(video.currentTime || 0) + 's.png';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  // ---------- export: WebM video (canvas stream + source audio) ----------
  function setRecUI(on) {
    exportVideoBtn.classList.toggle('recording', on);
    exportVideoBtn.textContent = on ? '■ STOP & SAVE' : '● EXPORT VIDEO (WEBM)';
    exportBtn.disabled = on;
  }
  function stopRecordingIfAny() {
    if (isRecording && mediaRecorder && mediaRecorder.state !== 'inactive') { try { mediaRecorder.stop(); } catch (e) {} }
  }
  exportVideoBtn.addEventListener('click', () => {
    if (isRecording) { if (mediaRecorder) mediaRecorder.stop(); return; }
    if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) { showError('Video export is not supported in this browser.'); return; }
    try {
      const stream = canvas.captureStream(30);
      const src = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
      if (src) src.getAudioTracks().forEach(t => stream.addTrack(t));

      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
      const mimeType = candidates.find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunks = [];
      rec.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
      const stopOnEnd = () => { if (rec.state !== 'inactive') rec.stop(); };
      rec.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'asciify-' + (currentName.replace(/\.[^.]+$/, '') || 'video') + '.webm';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
        recordedChunks = []; isRecording = false; setRecUI(false);
        video.removeEventListener('ended', stopOnEnd);
      };
      video.addEventListener('ended', stopOnEnd);
      mediaRecorder = rec;
      video.currentTime = 0;
      video.play();
      rec.start(250);
      isRecording = true; setRecUI(true);
    } catch (e) {
      showError('Could not start video recording.');
    }
  });

  // ---------- new video / reset ----------
  function resetToHome() {
    stopRecordingIfAny();
    video.pause(); stopLoop();
    if (objectURL) { URL.revokeObjectURL(objectURL); objectURL = null; }
    video.removeAttribute('src'); video.load();
    loaded = false; currentName = ''; vW = vH = vAR = 0; grid = { cols: 0, rows: 0 };
    showLoading(false); hideError();
    S.viewMode = 'ascii'; activateSeg(viewSeg, 'view', 'ascii'); saveSettings();
    urlInput.value = ''; err.textContent = '';
    playBtn.textContent = '▶'; seek.value = 0; timeEl.textContent = '0:00 / 0:00';
    stFile.textContent = 'no file loaded'; stMeta.textContent = '—'; setState('READY');
    show('home');
  }
  newBtn.addEventListener('click', resetToHome);
  errRetry.addEventListener('click', resetToHome);

  // ---------- keyboard ----------
  window.addEventListener('keydown', e => {
    if (!loaded || homePlayer.hidden) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    switch (e.code) {
      case 'Space': case 'KeyK': e.preventDefault(); video.paused ? video.play() : video.pause(); break;
      case 'ArrowLeft':  e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); break;
      case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); break;
      case 'KeyJ': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
      case 'KeyL': e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 10); break;
      case 'ArrowUp':   e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); video.muted = false; break;
      case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
    }
  });

  // ---------- pause the loop when the tab is hidden ----------
  document.addEventListener('visibilitychange', () => {
    if (!loaded) return;
    if (document.visibilityState === 'hidden') stopLoop();
    else if (!video.paused && !video.ended) startLoop();
  });
})();
