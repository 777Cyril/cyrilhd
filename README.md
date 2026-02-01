# cyrilhd.com

Personal website for Cyril H Dowuona - a minimalist, single-column design with automatic dark mode switching.

## Features

- Clean, minimalist design inspired by academic simplicity
- Automatic dark mode that activates at 7pm and deactivates at 7am
- Mobile-responsive layout
- Custom typography using Helvetica Now Display
- Single-column, linear content flow

## Local Development

Simply open `index.html` in your browser. No build process required.

## Deployment to Vercel

### Initial Setup

1. Initialize git repository (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create a new repository on GitHub

3. Push your code to GitHub:
   ```bash
   git remote add origin https://github.com/yourusername/cyrilhd.git
   git branch -M main
   git push -u origin main
   ```

4. Go to [Vercel](https://vercel.com) and sign in

5. Click "New Project" and import your GitHub repository

6. Vercel will automatically detect the settings - click "Deploy"

### Domain Setup (GoDaddy → Vercel)

#### Step 1: Configure DNS in GoDaddy

1. Log in to your GoDaddy account
2. Go to "My Products" and find your domain `cyrilhd.com`
3. Click "DNS" to manage DNS settings
4. Add the following records:

   **A Record:**
   - Type: `A`
   - Name: `@`
   - Value: `76.76.21.21`
   - TTL: `600` (or default)

   **CNAME Record:**
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com`
   - TTL: `600` (or default)

5. Save your changes

#### Step 2: Add Domain in Vercel

1. Go to your project in Vercel dashboard
2. Click on "Settings" → "Domains"
3. Add your custom domain: `cyrilhd.com`
4. Also add: `www.cyrilhd.com`
5. Vercel will automatically verify DNS propagation

   **Note:** DNS propagation can take up to 48 hours, but usually completes within a few hours.

#### Step 3: HTTPS Setup

- HTTPS is automatically enabled by Vercel
- SSL certificates are provisioned automatically
- No additional configuration needed

### Verifying Deployment

Once DNS has propagated:
- Visit `https://cyrilhd.com` - should load your site
- Visit `https://www.cyrilhd.com` - should redirect to `cyrilhd.com`

## Design Philosophy

This site follows a minimalist, content-first approach:
- Maximum width of 650px for optimal readability
- Generous whitespace and line spacing
- No decorative elements or complex animations
- Focus on typography and content hierarchy
- Academic simplicity with professional polish

## Technical Details

- **Font:** Helvetica Now Display (custom font included in assets)
- **Light mode background:** #F0E5D5
- **Dark mode background:** #1a1a1a
- **Dark mode activation:** Automatically at 7pm (19:00)
- **Light mode activation:** Automatically at 7am (07:00)
- **Responsive breakpoints:** 600px and 400px

## Content Updates

To update links, edit the `index.html` file and replace the placeholder hrefs:
- `#openai` → actual OpenAI link
- `#llmx` → actual LLMx link
- `#amex` → actual American Express link
- `#principles` → link to principles/books/movies
- `#philosophy` → link to philosophy document
- `#howard-talk` → link to Howard University talk
- `#resume` → link to resume
- `#songs` → link to music production
- `#dog` → link to K9 photos
- `mailto:#` → actual email address
- `#twitter` → actual X/Twitter profile

## Avatar Image

Make sure to add your avatar image at:
```
assets/Cyril Cryptopunk Avi.PNG
```

The image will be automatically cropped to a circle with 140px diameter (120px on mobile).

## License

Personal website - All rights reserved.
