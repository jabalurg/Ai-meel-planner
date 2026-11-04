# MealMate

An energetic landing page concept for an AI-powered personalized meal planning service. The responsive page uses a dark charcoal and lime palette, food photography, plan previews, and a small interactive meal carousel.

## Run locally

Open `index.html` in a browser. No build tools or dependencies are required.

## Files

- `index.html` — page content and sections
- `styles.css` — responsive visual design
- `app.js` — mobile navigation and meal carousel interactions

The meal images are loaded from Unsplash and the headings use Google Fonts, so those assets need an internet connection.

## Email and password accounts

The sign-up and login forms use Supabase Auth. To connect a Supabase project:

1. In Supabase, open **Project Settings → API Keys** and copy the **Project URL** and **Publishable key**.
2. Put those values in `auth-config.js`. This file is public, so use only the publishable key; never use a `service_role` key here.
3. In Supabase **Authentication → Sign In / Providers → Email**, turn off **Confirm Email** to allow users to register and sign in without an email code.
4. Set the site's URL in Supabase Auth URL configuration to `https://jabalurg.github.io/Ai-meel-planner/`.

Supabase stores and refreshes the signed-in session. The form does not save users' passwords in the site. Turning off email confirmation means Supabase accepts an email address without verifying that the user owns it.

## Publish with GitHub Pages

The workflow in `.github/workflows/pages.yml` deploys the static site whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** if it is not already selected. After the first successful run, the site will be available at `https://jabalurg.github.io/Ai-meel-planner/`.
