# Public Assets Directory

This directory contains static files served publicly by the server at `/public/*`.

## Contents

### `/images/`

- `logo-light.png` - Praxis Kerim logo for light mode (4500x4500px, displayed at 220x220px)
- `logo-dark.png` - Praxis Kerim logo for dark mode (4500x4500px, displayed at 220x220px)

## Usage in Email Templates

The logos are referenced with **theme-aware logic** (light/dark mode):

```javascript
// Light mode logo (default)
const logoLightUrl =
  process.env.NODE_ENV === "production"
    ? `${baseUrl}/public/images/logo-light.png`
    : `${baseUrl}/images/logo.PNG`;

// Dark mode logo
const logoDarkUrl =
  process.env.NODE_ENV === "production"
    ? `${baseUrl}/public/images/logo-dark.png`
    : `${baseUrl}/images/logo.PNG`;
```

**Dark Mode Support:** Email templates automatically switch between light and dark logos based on the user's email client theme using CSS `@media (prefers-color-scheme: dark)`.

**Why Development Uses Website URL?** Email clients (Gmail, Outlook, etc.) cannot load images from localhost URLs. In development, emails use the logo from the live website. In production, they use logos from your deployed server.

## Updating the Logos

To update the Praxis Kerim logos:

1. Replace `/public/images/logo-light.png` with your new light mode logo
2. Replace `/public/images/logo-dark.png` with your new dark mode logo
3. Source images: 4500x4500px (high resolution for email rendering)
4. Display size: Automatically scaled to 220x220px in emails
5. Keep the same filenames or update the references in `/emailTemplates/emailParts/header.js`

## Server Configuration

The public directory is served as static files in `/config/express.js`:

```javascript
app.use("/public", express.static(path.join(__dirname, "../public")));
```

This makes all files in this directory accessible at `http://your-server-url/public/`.
