@echo off
echo ========================================================
echo   Pushing PulsePoll to GitHub:
echo   https://github.com/gowthamgopalakrishnan/pulsepoll
echo ========================================================
echo.

set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%"
git push -u origin main

echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo   SUCCESS! Pushed to https://github.com/gowthamgopalakrishnan/pulsepoll
) else (
    echo   Push encountered an error. Check the messages above.
)
echo ========================================================
pause
