@echo off
REM SafeGuard — Start Script
REM Usage: start.bat dev     (development server)
REM        start.bat prod    (production gunicorn)

if "%1"=="prod" goto prod
if "%1"=="gunicorn" goto prod

:dev
echo [*] Starting development server...
echo [*] Open http://127.0.0.1:8000
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
goto end

:prod
echo [*] Starting production server with gunicorn...
echo [*] Make sure .env has DEBUG=False and proper ALLOWED_HOSTS
python manage.py migrate
python manage.py collectstatic --noinput
gunicorn backend.wsgi --bind 0.0.0.0:8000 --workers 2 --timeout 120
goto end

:end
pause
