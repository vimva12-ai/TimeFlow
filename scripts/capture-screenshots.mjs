/**
 * TimeFlow 화면 자동 캡처 스크립트
 *
 * ▶ 실행 방법 (PowerShell 또는 명령 프롬프트에서):
 *   cd C:\Users\vimva\Desktop\claude-code-folder\TimeFlow
 *   node capture-screenshots.mjs
 *
 * ▶ 실행 후 순서:
 *   1. Chrome 브라우저가 자동으로 열립니다.
 *   2. TimeFlow 로그인 화면이 뜨면 체크박스 2개를 체크하고 Google 로그인을 완료합니다.
 *   3. /today 페이지로 이동되면 나머지 화면이 자동으로 캡처됩니다.
 *   4. 완료 후 브라우저가 자동으로 닫힙니다.
 *
 * ▶ 저장 위치: public/manual-images/
 */

import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'public', 'manual-images');
const BASE_URL = 'https://timeflow-nine-mu.vercel.app';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    console.log(`📁 폴더 생성: ${dir}`);
  }
}

async function capture(page, filename, label) {
  await page.waitForTimeout(1800);
  const outputPath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`  ✅ ${label} → ${filename}`);
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎬 TimeFlow 화면 자동 캡처 스크립트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('📌 잠시 후 Chrome이 열립니다.');
  console.log('   → 체크박스 2개 체크 후 Google 로그인을 완료해 주세요.');
  console.log('   → 로그인 완료 시 나머지 화면이 자동 캡처됩니다.');
  console.log('');

  const browser = await chromium.launch({
    headless: false,
    executablePath: CHROME_PATH,
    args: ['--window-size=1440,900'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // ─── 1. 로그인 화면 캡처 ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await capture(page, '01_login.png', '로그인 화면');
  console.log('');
  console.log('⏳ Google 로그인 대기 중... (최대 5분)');
  console.log('   Chrome 창에서 로그인을 완료해 주세요.\n');

  // ─── 2. 로그인 완료 대기 ─────────────────────────────────────────────────
  try {
    await page.waitForURL(`${BASE_URL}/today`, { timeout: 300000 });
    console.log('✅ 로그인 완료! 화면 캡처를 시작합니다.\n');
  } catch {
    console.error('❌ 5분 내에 로그인이 완료되지 않았습니다. 스크립트를 종료합니다.');
    await browser.close();
    process.exit(1);
  }

  // ─── 3. 메인 화면 (오늘 타임테이블) ─────────────────────────────────────
  await page.waitForTimeout(2500);
  await capture(page, '02_main_today.png', '메인 화면 (PLAN/ACTUAL 타임테이블)');

  // ─── 4. 할일 추가 화면 — 할일 입력창 포커스 ──────────────────────────────
  // 사이드바 To Do 입력창에 포커스하여 "추가" 상태 캡처
  const todoInput = page.locator('input[placeholder]').last();
  if (await todoInput.isVisible().catch(() => false)) {
    await todoInput.click();
    await page.waitForTimeout(400);
  }
  await capture(page, '04_todo_add.png', '할일 추가 화면 (입력창 활성)');

  // ─── 5. To Do List + 뽀모도로 전체 화면 ─────────────────────────────────
  // (사이드바가 보이는 데스크톱 뷰 — 이미 1440px)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await capture(page, '03_todo_list.png', 'To Do List 화면');

  // ─── 6. 뽀모도로 타이머 화면 ─────────────────────────────────────────────
  // 사이드바 뽀모도로 영역 스크롤하여 화면에 노출
  await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (aside) aside.scrollTop = 0;
  });
  await capture(page, '05_pomodoro.png', '뽀모도로 타이머 화면');

  // ─── 7. 주간 리포트 화면 ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/weekly`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await capture(page, '06_weekly_report.png', '주간 리포트 화면');

  // ─── 8. 설정 화면 ────────────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await capture(page, '07_settings.png', '설정 화면');

  // ─── 완료 ─────────────────────────────────────────────────────────────────
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🎉 모든 화면 캡처 완료!');
  console.log(`  📂 저장 위치: ${OUTPUT_DIR}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('  01_login.png         → 로그인 화면');
  console.log('  02_main_today.png    → 메인 화면 (PLAN/ACTUAL)');
  console.log('  03_todo_list.png     → To Do List 화면');
  console.log('  04_todo_add.png      → 할일 추가 화면');
  console.log('  05_pomodoro.png      → 뽀모도로 타이머 화면');
  console.log('  06_weekly_report.png → 주간 리포트 화면');
  console.log('  07_settings.png      → 설정 화면');
  console.log('');

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch((err) => {
  console.error('\n❌ 오류 발생:', err.message);
  process.exit(1);
});
