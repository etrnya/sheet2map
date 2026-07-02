@echo off
title Sheet2Map - 地圖數據更新管理中心
::  移除 chcp 65001，直接使用系統 CP950 執行
:menu
cls
echo ==================================================
echo         Sheet2Map - 地圖數據更新管理中心
echo ==================================================
echo.
echo   [1] 同步 [臺南市合約戒菸據點] (爬取官方最新數據)
echo   [2] 匯入 [臺南市公共場所 AED 據點] (解析本地 CSV)
echo   [3] 同步 [臺南市友善公廁與哺集乳室地圖] (整合下載)
echo   [4] 同步 [臺南市防災與避難收容地圖] (下載篩選)
echo   [5] 一鍵同步更新以上 [全部地圖]
echo   [0] 離開
echo.
echo ==================================================
set /p opt="請輸入您的選擇 (0-5): "

if "%opt%"=="1" goto op1
if "%opt%"=="2" goto op2
if "%opt%"=="3" goto op3
if "%opt%"=="4" goto op4
if "%opt%"=="5" goto op5
if "%opt%"=="0" goto exit
goto menu

:op1
cls
echo [1/2] 正在爬取國健署官網最新合約戒菸機構資料...
python "%~dp0scripts\sync_from_hpa.py"
echo.
pause
goto menu

:op2
cls
echo [1/2] 正在解析本地 AED20260702.csv 檔案...
python "%~dp0scripts\import_aed.py" --city 臺南市
echo.
pause
goto menu

:op3
cls
echo [1/2] 正在下載與整合臺南市公廁與哺集乳室 Open Data...
python "%~dp0scripts\import_restroom_nursing.py"
echo.
pause
goto menu

:op4
cls
echo [1/2] 正在下載消防署與篩選臺南市防災避難所 Open Data...
python "%~dp0scripts\import_disaster_shelter.py"
echo.
pause
goto menu

:op5
cls
echo ==================================================
echo              正在進行全域地圖資料同步更新
echo ==================================================
echo [1/4] 同步 臺南市合約戒菸據點...
python "%~dp0scripts\sync_from_hpa.py"
echo.
echo [2/4] 匯入 臺南市公共場所 AED...
python "%~dp0scripts\import_aed.py" --city 臺南市
echo.
echo [3/4] 同步 臺南市公廁與哺集乳室...
python "%~dp0scripts\import_restroom_nursing.py"
echo.
echo [4/4] 同步 臺南市防災與避難收容...
python "%~dp0scripts\import_disaster_shelter.py"
echo.
echo ==================================================
echo 所有地圖資料同步作業已完成！
echo.
pause
goto menu

:exit
exit
