@echo off
REM ==============================================================================
REM  🚀 Multi-Instance Launcher for your gRPC ClusterNodes
REM  Each instance runs npm run dev with a unique PORT value.
REM  Example: PORT=50051 → gRPC :50051  and HTTP bridge :51051
REM ==============================================================================

cd /d "C:\Users\trevo\Desktop\WealthWorkshop\xrp-price"

REM --- List of ports (edit freely) ---
set PORTS=50051 50052 50053

echo.
echo ================================================================
echo   Starting gRPC Cluster servers...
echo   Each instance runs with PORT and bridge (PORT+1000)
echo ================================================================
echo.

for %%P in (%PORTS%) do (
    echo 🔹 Launching instance on port %%P ...
    start "Node %%P" cmd /k ^
        "title Node %%P && echo Running on gRPC %%P (HTTP bridge %%P+1000) && ^
         set PORT=%%P && npm run dev"
    timeout /t 1 >nul
)

echo.
echo ✅ All instances launched! You can now open the 💬 Message page
echo    and connect using local:%%P style addresses (e.g. local:50051).
echo.
pause
