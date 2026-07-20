@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "VENV_DIR=%SCRIPT_DIR%.venv"
set "PYTHON_BIN=%VENV_DIR%\Scripts\python.exe"
set "REQUIREMENTS_FILE=%SCRIPT_DIR%requirements.txt"
set "REQUIREMENTS_MARKER=%VENV_DIR%\.magic-data-requirements.txt"

if not exist "%PYTHON_BIN%" (
    py -m venv "%VENV_DIR%" || goto :error
)

if not exist "%REQUIREMENTS_MARKER%" goto :install_requirements
fc /b "%REQUIREMENTS_FILE%" "%REQUIREMENTS_MARKER%" >nul || goto :install_requirements
goto :run

:install_requirements
"%PYTHON_BIN%" -m pip install --disable-pip-version-check -r "%REQUIREMENTS_FILE%" || goto :error
copy /y "%REQUIREMENTS_FILE%" "%REQUIREMENTS_MARKER%" >nul || goto :error

:run
"%PYTHON_BIN%" "%SCRIPT_DIR%app\run.py"
goto :end

:error
echo.
echo Magic-data could not be started.
pause

:end
endlocal
