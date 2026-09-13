.DEFAULT_GOAL := dev

.PHONY: install dev build test

install:
	cd web && npm install

dev:
	powershell -ExecutionPolicy Bypass -File ./run.ps1

build:
	cd web && npm run build

test:
	powershell -NoProfile -Command "$$env:GOWORK='off'; Set-Location './server'; go test ./..."
