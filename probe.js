'use strict';
// Fixed original fixtures. A matching remote manifest is checked before downloading.
const expected = [
  { path: 'images/portrait-small.jpg', mime: 'image/jpeg', width: 720, height: 1280, bytes: 332488, sha256: 'b150194e6779dcecc3a99fc7136d0332a619bc7a37ab178606a6fb20daa708cf' },
  { path: 'images/portrait-wallpaper.jpg', mime: 'image/jpeg', width: 1440, height: 3200, bytes: 2037500, sha256: '0c1421c31c22d0378381ccb26f4c539943dd9fe207b10c480d475fa8c12f34e4' },
  { path: 'images/landscape-wallpaper.jpg', mime: 'image/jpeg', width: 3840, height: 2160, bytes: 3542812, sha256: '0103acadfa9b7caa5182fe857cea2b9862fa96e7438552837aef1d3427447043' }
];
const start = document.querySelector('#start');
const status = document.querySelector('#status');
const reportElement = document.querySelector('#report');
const results = document.querySelector('#results');
const save = document.querySelector('#save');
let lastReport;

function connectionSnapshot() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  // effectiveType describes estimated speed, not whether Wi-Fi or mobile is in use.
  return c ? { type: c.type || 'not-exposed', effectiveType: c.effectiveType || null, downlinkMbps: c.downlink ?? null, rttMs: c.rtt ?? null } : null;
}

async function boundedFetch(url, limit, controller) {
  const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
  if (response.status !== 200) throw new Error('HTTP ' + response.status);
  if (!response.body) throw new Error('浏览器未提供下载流');
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    bytes += item.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new Error('图片大小超过预期'); }
    chunks.push(item.value);
  }
  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return { response, body };
}

async function imageSize(body, mime) {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('图片解码失败')); img.src = url; });
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

async function run() {
  if (start.disabled) return;
  start.disabled = true; save.disabled = true; results.replaceChildren();
  const report = { version: 1, purpose: 'GitHub Pages temporary image network test', environment: 'browser', baseUrl: new URL('.', location.href).href, startedAt: new Date().toISOString(), networkLabel: document.querySelector('#network').value, networkLabelSource: 'operator-selection', connectionStart: connectionSnapshot(), cachePolicy: 'no-store plus unique query', samples: [], passed: false, productionAppIntegrationVerified: false };
  let controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), 45000);
  try {
    if (!isSecureContext || !crypto.subtle) throw new Error('需要支持 SHA-256 的 HTTPS 浏览器');
    status.textContent = '正在检查测试文件清单…';
    const manifestResponse = await boundedFetch(new URL('manifest.json?t=' + Date.now(), location.href), 32768, controller);
    clearTimeout(timer);
    const manifest = JSON.parse(new TextDecoder().decode(manifestResponse.body));
    if (manifest.files?.length !== expected.length || !expected.every((f, i) => Object.keys(f).every(k => manifest.files[i][k] === f[k]))) throw new Error('测试文件清单与预期不一致');
    for (let i = 0; i < expected.length; i++) {
      const f = expected[i];
      const item = document.createElement('li');
      item.textContent = `${i + 1}/3：正在下载 ${f.width} × ${f.height}…`;
      results.append(item);
      status.textContent = `正在下载第 ${i + 1} 张，共 3 张…`;
      const sample = { path: f.path, expectedBytes: f.bytes, expectedSha256: f.sha256, connection: connectionSnapshot(), passed: false };
      controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 45000);
      const began = performance.now();
      try {
        const result = await boundedFetch(new URL(f.path + '?t=' + Date.now() + '-' + i, location.href), f.bytes, controller);
        sample.elapsedMs = Math.round(performance.now() - began);
        clearTimeout(timer);
        sample.httpStatus = result.response.status;
        sample.mime = (result.response.headers.get('content-type') || '').split(';')[0].trim();
        sample.bytes = result.body.byteLength;
        const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', result.body));
        sample.sha256 = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
        Object.assign(sample, await imageSize(result.body, f.mime));
        sample.passed = sample.bytes === f.bytes && sample.sha256 === f.sha256 && sample.mime === f.mime && sample.width === f.width && sample.height === f.height;
        item.textContent = `${f.width} × ${f.height}：${sample.passed ? '通过' : '校验失败'}，下载 ${(sample.elapsedMs / 1000).toFixed(2)} 秒，${(sample.bytes / 1048576).toFixed(2)} MiB。`;
      } catch (e) { sample.elapsedMs = Math.round(performance.now() - began); sample.error = e.name === 'AbortError' ? '下载超过 45 秒' : e.message; item.textContent = `${f.width} × ${f.height}：失败，${sample.error}。`; }
      finally { clearTimeout(timer); report.samples.push(sample); }
      reportElement.value = JSON.stringify(report, null, 2);
    }
    report.passed = report.samples.length === 3 && report.samples.every(s => s.passed);
    status.textContent = report.passed ? '三张图片全部下载并校验通过。此结果仅代表本次网络。' : '测试未全部通过，请查看每张图片的结果。';
  } catch (e) { report.error = e.name === 'AbortError' ? '清单请求超过 45 秒' : e.message; status.textContent = '测试失败：' + report.error; }
  finally { clearTimeout(timer); report.finishedAt = new Date().toISOString(); report.connectionEnd = connectionSnapshot(); lastReport = report; reportElement.value = JSON.stringify(report, null, 2); start.disabled = false; save.disabled = false; }
}
start.addEventListener('click', run);
save.addEventListener('click', () => {
  if (!lastReport) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(lastReport, null, 2) + '\n'], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'github-pages-download-test.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
// Explicit automation link performs one bounded run; the normal page stays idle.
const options = new URLSearchParams(location.search);
if (options.get('autorun') === '1') {
  const label = options.get('network');
  if (['wifi', 'cellular'].includes(label)) document.querySelector('#network').value = label;
  run();
}
