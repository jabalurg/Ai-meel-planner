# MealMate

An energetic landing page concept for an AI-powered personalized meal planning service. The responsive page uses a dark charcoal and lime palette, food photography, plan previews, and a small interactive meal carousel.

## Run locally

Open `index.html` in a browser. No build tools or dependencies are required. If your browser blocks the Web Crypto API on a `file://` page, open it through localhost or the HTTPS GitHub Pages site instead.

## Files

- `index.html` — page content and sections
- `styles.css` — responsive visual design
- `app.js` — mobile navigation and meal carousel interactions

The meal images are loaded from Unsplash and the headings use Google Fonts, so those assets need an internet connection.

## Local account prototype

Sign-up and login use an account ID (or email) and password, stored only in this browser. Passwords are hashed with a unique salt using PBKDF2 via the Web Crypto API; plain-text passwords are not stored. There is no email verification or remote account service. Accounts do not sync to another browser or device and can be removed by clearing this site's browser storage. This is a local prototype, not production account security.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the static site whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected. After the first successful run, the site will be available at `https://jabalurg.github.io/Ai-meel-planner/`.
## Run the AI planner on Windows

1. Open PowerShell in this project folder.
2. Run `.\start-with-ai.ps1`. Enter your Gemini API key at the hidden prompt for AI menus, or press Enter to use the free local recipe planner. The key is not saved in this repository.
3. Keep that PowerShell window open and open `http://localhost:4173/`.

The planner estimates daily calories with an adult Mifflin–St Jeor calculation and sends profile fields to the Gemini API only when the user requests an AI menu. The account ID and password are not sent. The profile is saved in that browser's local storage. The API route has per-IP and daily generation limits, which reset when the server restarts.

GitHub Pages can publish the static interface, but it cannot run the private API route. Menu generation works when the site is served by this local Node server (including through the PC's tunnel URL). Without an API key or available API credits, the server returns a local recipe based plan instead.

This local account system is for a prototype, not secure multi-user authentication. Avoid entering sensitive health information. Calorie estimates and generated menus are approximate and are not medical advice.
