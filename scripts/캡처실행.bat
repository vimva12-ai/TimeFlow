@echo off
chcp 65001 > nul
title TimeFlow 화면 캡처

echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo   TimeFlow 화면 자동 캡처
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo  실행 후 Chrome 창에서:
echo  1. 체크박스 2개 체크
echo  2. Google 로그인 완료
echo  3. 로그인 되면 나머지 화면 자동 캡처
echo.
echo  저장 위치: public\manual-images\
echo.
pause

cd /d "C:\Users\vimva\Desktop\claude-code-folder\TimeFlow"
node capture-screenshots.mjs

echo.
pause
