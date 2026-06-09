@echo off
call "D:\Works\MSVC\Vs\VC\Auxiliary\Build\vcvars64.bat" > nul 2>&1
cd /d D:\Works\MyProject\WoxNote
npx tauri dev
