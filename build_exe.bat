@echo off
chcp 65001 >nul
REM ========================================
REM Prompt Tool - Windows EXE 打包脚本
REM 使用官方 Python 打包（避免 DLL 依赖）
REM ========================================

echo ========================================
echo Prompt Tool - Windows EXE Builder
echo ========================================
echo.

REM 检查官方 Python (通过 py launcher)
py -0 >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请从 python.org 安装
    pause
    exit /b 1
)

echo 检测到的 Python 版本:
py -0
echo.

REM 使用 Python 3.10（如果可用）或最新的 3.x
py -3.10 --version >nul 2>&1
if not errorlevel 1 (
    set PYTHON_CMD=py -3.10
    echo 使用 Python 3.10
) else (
    set PYTHON_CMD=py -3
    echo 使用默认 Python 3.x
)
echo.

REM 创建构建环境
echo 创建构建环境...
if exist build_env rmdir /s /q build_env
%PYTHON_CMD% -m venv build_env
if errorlevel 1 (
    echo [错误] 创建虚拟环境失败
    pause
    exit /b 1
)

REM 安装依赖
echo.
echo 安装依赖...
build_env\Scripts\pip install --quiet -r requirements.txt pyinstaller

REM 清理旧构建
echo.
echo 清理旧构建文件...
if exist build rmdir /s /q build
if exist dist rmdir /s /q dist

REM 打包
echo.
echo 开始打包...
build_env\Scripts\pyinstaller --clean --noconfirm prompt_tool.spec

if errorlevel 1 (
    echo.
    echo [错误] 打包失败！
    pause
    exit /b 1
)

echo.
echo ========================================
echo 打包成功！
echo ========================================
echo.

REM 显示结果
dir dist\PromptTool\PromptTool.exe
echo.
echo 输出目录: dist\PromptTool\
echo 大小:
for /f "tokens=3" %%a in ('dir /s dist\PromptTool ^| findstr "个文件"') do echo   %%a 字节
echo.
echo 可以直接分发，无需 Python 环境或额外 DLL
echo.

pause