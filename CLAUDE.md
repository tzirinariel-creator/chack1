# CLAUDE.md - AI Assistant Guide

## Project Overview

**Visa Cal Automation Env** - A multi-language automation project that scrapes Israeli bank/credit card transaction data and syncs it to Google Sheets.

**Repository:** `chack1`
**Author:** tzirinariel-creator

## Architecture

### Languages & Runtimes

- **Node.js 18** (primary runtime, via devcontainer base image)
- **Python 3.11** (data processing, via devcontainer feature)

### Core Dependencies

**JavaScript (npm):**
- `israeli-bank-scrapers` - scrapes transaction data from Israeli banks and credit card companies
- `puppeteer-core` - headless Chromium browser automation (used by the scraper)

**Python (pip):**
- `gspread` - Google Sheets API client
- `oauth2client` - OAuth 2.0 authentication for Google APIs
- `pandas` - data manipulation and analysis

### Data Flow (Intended)

1. Scrape bank/credit card transactions via `israeli-bank-scrapers` + Puppeteer
2. Process and transform data (Python/pandas)
3. Authenticate with Google APIs (OAuth2)
4. Write results to Google Sheets (gspread)

## Development Environment

The project uses a **VS Code devcontainer** (`.devcontainer/devcontainer.json`).

- Base image: `mcr.microsoft.com/devcontainers/javascript-node:18`
- `postCreateCommand` installs all system deps (Chromium libraries), npm packages, and pip packages automatically
- Chromium system dependencies are required for Puppeteer headless browser operation

### Setup

All dependencies are installed automatically when the devcontainer starts. No manual setup required beyond opening in a devcontainer-compatible environment.

## Repository Status

This project is in **early-stage development**. The following infrastructure is not yet set up:

- No source code files yet
- No `package.json` (deps installed globally via postCreateCommand)
- No `requirements.txt` or `pyproject.toml`
- No test framework or test files
- No linting/formatting configuration
- No CI/CD pipeline
- No `.gitignore`

## Conventions for AI Assistants

### When adding code to this project:

1. **Create a `package.json`** if adding JS files - move npm deps from postCreateCommand into it
2. **Create a `requirements.txt`** if adding Python files - move pip deps from postCreateCommand into it
3. **Add a `.gitignore`** with entries for `node_modules/`, `__pycache__/`, `.env`, `*.pyc`, and credential files
4. **Never commit credentials** - Google OAuth credentials, bank login details, and API keys must stay out of version control
5. **Use environment variables** for all secrets (bank credentials, API keys, OAuth tokens)
6. **Chromium path** - when using `puppeteer-core`, the Chromium executable path must be configured explicitly (it does not bundle Chromium like full `puppeteer`)

### Security considerations:

- This project handles **financial data and banking credentials** - treat all credential handling with extreme care
- Never log or expose bank credentials, OAuth tokens, or financial transaction details
- Ensure any credential files (JSON keys, `.env` files) are in `.gitignore`

### Code style (recommended for new files):

- JavaScript: ES modules, async/await for all async operations
- Python: Type hints, f-strings, PEP 8 formatting
- Keep scraping logic, data processing, and Google Sheets integration as separate modules
