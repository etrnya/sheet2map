@echo off
title Sheet2Map - 國健署戒菸據點自動同步工具
chcp 65001 > nul
echo ==================================================
echo       Sheet2Map - 臺南戒菸機構自動同步工具
echo ==================================================
echo.
echo [1/2] 正在連線至國健署官網爬取最新 Excel 資料...
echo.
python "%~dp0scripts\sync_from_hpa.py"
echo.
echo [2/2] 數據已同步更新至 Google Sheets 試算表。
echo.
echo ==================================================
echo.
echo 💡 同步完成！請開啟您的 Google Sheets 點選：
echo    [Sheet2Map] -> [地址地理編碼 (Geocode Addresses)]
echo    以補齊最新機構的經緯度座標。
echo.
echo ==================================================
pause
