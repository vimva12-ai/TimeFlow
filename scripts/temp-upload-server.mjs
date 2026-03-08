/**
 * 임시 스크린샷 업로드 서버
 * 브라우저에서 이미지를 업로드받아 public/manual-images/ 폴더에 저장
 */
import http from 'http';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'manual-images');
const PORT = 3456;

// 출력 폴더 생성
if (!existsSync(OUTPUT_DIR)) {
  await mkdir(OUTPUT_DIR, { recursive: true });
}

// 업로드 폼 HTML
const HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>Screenshot Saver</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f5f5f5; }
    .container { background: white; padding: 20px; border-radius: 8px; max-width: 500px; }
    input[type=file] { display: block; margin: 10px 0; }
    input[type=text] { width: 300px; padding: 6px; margin: 6px 0; }
    button { padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; }
    #status { margin-top: 10px; padding: 8px; background: #f0f9ff; border-radius: 4px; }
  </style>
</head>
<body>
<div class="container">
  <h2>Screenshot Saver</h2>
  <input type="file" id="fileInput" accept="image/*">
  <input type="text" id="filename" placeholder="파일명 (예: 02_main_today.png)" value="screenshot.png">
  <button onclick="saveFile()">저장</button>
  <div id="status">파일을 선택한 후 저장 버튼을 클릭하세요.</div>
</div>
<script>
  // 파일 선택 시 자동으로 파일명 표시
  document.getElementById('fileInput').onchange = function() {
    const f = this.files[0];
    if (f) document.getElementById('status').textContent = '선택됨: ' + f.name + ' (' + Math.round(f.size/1024) + 'KB)';
  };

  async function saveFile() {
    const fileInput = document.getElementById('fileInput');
    const filename = document.getElementById('filename').value.trim();
    const file = fileInput.files[0];
    if (!file) { alert('파일을 선택해주세요'); return; }
    if (!filename) { alert('파일명을 입력해주세요'); return; }

    // 파일을 base64로 읽어서 서버에 전송
    const reader = new FileReader();
    reader.onload = async function(e) {
      const base64 = e.target.result.split(',')[1];
      const res = await fetch('/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, data: base64 })
      });
      const text = await res.text();
      document.getElementById('status').textContent = text;
    };
    reader.readAsDataURL(file);
  }
</script>
</body>
</html>`;

// HTTP 서버 생성
const server = http.createServer(async (req, res) => {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // GET / → 업로드 폼 반환
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
    return;
  }

  // POST /save → base64 이미지 저장
  if (req.method === 'POST' && req.url === '/save') {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString());
        const { filename, data } = body;
        if (!filename || !data) {
          res.writeHead(400);
          res.end('filename과 data가 필요합니다');
          return;
        }
        const buf = Buffer.from(data, 'base64');
        const savePath = path.join(OUTPUT_DIR, filename);
        await writeFile(savePath, buf);
        console.log(`✅ 저장됨: ${filename} (${Math.round(buf.length / 1024)}KB)`);
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`✅ 저장 완료: ${savePath}`);
      } catch (e) {
        res.writeHead(500);
        res.end('오류: ' + e.message);
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`🚀 업로드 서버 실행 중: http://localhost:${PORT}`);
  console.log(`📂 저장 위치: ${OUTPUT_DIR}`);
});
