@echo off
chcp 65001 >nul
rem トモリ テレビ収録用の起動ファイル（ダブルクリックで使う）
rem ・この PC の中（127.0.0.1）だけで、ポート 3458 のサーバーを動かす。ほかの PC や LAN からは見えない
rem ・Python の標準機能だけを使う。パッケージのダウンロード、管理者権限、Secret、環境変数は使わない
rem ・Cloudflare や Anthropic のコマンドは実行しない
rem くわしい手順は docs\TV_RECORDING_RUNBOOK.md
setlocal
cd /d "%~dp0"

set PORT=3458
set URL=http://localhost:%PORT%/demo-world.html

echo.
echo ============================================
echo   トモリ テレビ収録用サーバー
echo ============================================
echo.

rem 1. Python があるか
python --version >nul 2>&1
if errorlevel 1 (
  echo [止まりました] Python が見つかりません。
  echo   この PC に Python が入っているか、確かめてください。
  echo.
  pause
  exit /b 1
)

rem 2. ページのファイルがあるか
if not exist "demo-world.html" (
  echo [止まりました] demo-world.html が見つかりません。
  echo   このファイルを tomori-next のフォルダの中から開いてください。
  echo.
  pause
  exit /b 1
)

rem 3. ポート 3458 がもう使われていないか
netstat -ano -p tcp | findstr /R /C:":%PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo [止まりました] ポート %PORT% は、ほかのプログラムがもう使っています。
  echo   すでにこの画面を開いていないか、確かめてください。
  echo   使っているプログラムの番号（PID）は、次の行のいちばん右の数字です。
  netstat -ano -p tcp | findstr /R /C:":%PORT% .*LISTENING"
  echo.
  pause
  exit /b 1
)

rem 4. AI スイッチの状態を見せる（ファイルを読むだけ。変更はしない）
findstr /C:"const VOCABULARY_AI_ENABLED = true;" demo-world.html >nul
if not errorlevel 1 (
  echo AI スイッチ：オン（AI の言葉を使う）
) else (
  echo AI スイッチ：オフ（AI を使わず、端末の中の言葉だけを使う）
)
echo.

echo サーバーを始めます。2秒後に、ブラウザで次のページが開きます。
echo   %URL%
echo.
echo 終わるときは、この黒い画面で Ctrl キーを押しながら C を押してください。
echo 「バッチ ジョブを終了しますか」と聞かれたら Y を押して Enter です。
echo.

rem 2秒待ってから、いつものブラウザでページを開く（サーバーの準備を待つため）
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start %URL%"

rem この PC の中（127.0.0.1）だけで待ち受ける
python -m http.server %PORT% --bind 127.0.0.1 --directory "%~dp0."

echo.
echo サーバーを止めました。
pause
