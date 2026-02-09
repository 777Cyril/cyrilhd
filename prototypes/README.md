# Quietly Interesting Prototypes

Interactive website features that add delight without distraction.

## 🎯 Design Philosophy

These prototypes explore subtle, discoverable interactions that enhance the website experience while maintaining its minimalist aesthetic. Each feature is "quietly interesting" — something you notice and appreciate rather than being hit over the head with.

## 🎨 Prototypes

### 1. Song Carousel
**Location:** `song-carousel/`

Displays "you are now listening to [song name]" in a contained carousel with a sunset-style animation (slides from right to left).

**Features:**
- Constrained width (adjustable 300-600px)
- Smooth horizontal scroll animation
- Integrates with existing music player
- Dark mode support
- Configurable animation speed

**Demo:** Open `song-carousel/carousel.html`

---

### 2. Time-of-Day Greeting
**Location:** `time-greeting/`

Shows a personalized greeting on page load using the existing typewriter effect. Smart session management prevents repetition on quick refreshes.

**Features:**
- Typewriter animation (matches music player style)
- Time-based greetings:
  - 5am-12pm: "good morning"
  - 12pm-6pm: "good afternoon"
  - 6pm-10pm: "good evening"
  - 10pm-5am: "burning the midnight oil"
- Only shows once per 30-minute session
- Auto-fades after ~3 seconds

**Demo:** Open `time-greeting/greeting.html`

---

### 3. Link Preview Whispers
**Location:** `link-whispers/`

Tiny preview cards that appear when hovering over links with a 500ms delay to avoid being intrusive.

**Features:**
- Minimal, clean design
- Smart positioning (stays within viewport)
- Uses data attributes for content:
  - `data-preview-title`: Link title
  - `data-preview-desc`: Description
  - `data-preview-type`: Category (project/work/article/internal)
- Configurable hover delay
- Multiple slide directions

**Demo:** Open `link-whispers/whispers.html`

**Usage Example:**
```html
<a href="https://example.com"
   data-preview-title="Project Name"
   data-preview-desc="Brief description"
   data-preview-type="project">Link Text</a>
```

---

### 4. Hidden Keystroke Patterns
**Location:** `keystroke-pattern/`

Easter eggs triggered by typing "777" or "brr" anywhere on the page.

**Features:**
- Pattern detection for "777" and "brr"
- Multiple animation options:
  - **777**: Falling numbers (Matrix-style), avatar spin, page flash
  - **brr**: Sliding text, shiver animation
- 3-second cooldown to prevent spam
- Doesn't interfere with form inputs
- Visual buffer display for debugging

**Demo:** Open `keystroke-pattern/pattern.html`

---

## 🚀 Testing the Prototypes

### Option 1: Direct File Opening
Open any of the HTML files directly in your browser:
- `prototypes/song-carousel/carousel.html`
- `prototypes/time-greeting/greeting.html`
- `prototypes/link-whispers/whispers.html`
- `prototypes/keystroke-pattern/pattern.html`

### Option 2: Main Index
Open `prototypes/index.html` for a central hub with links to all prototypes.

### Option 3: Local Server
For best results (especially if integrating with the main site), run a local server:

```bash
cd /home/user/cyrilhd
python3 -m http.server 8000
# Then visit http://localhost:8000/prototypes/
```

---

## 🔧 Integration Guide

### Song Carousel Integration

1. Add to `index.html` between avatar and "hi":
```html
<div class="song-carousel" id="songCarousel">
    <div class="carousel-track" id="carouselTrack">
        <span class="carousel-text">you are now listening to <strong id="songName"></strong></span>
    </div>
</div>
```

2. Copy styles from `song-carousel/carousel.css` to `style.css`

3. Copy JavaScript from `song-carousel/carousel.js` to `scripts.js` and integrate with existing music player

### Time Greeting Integration

1. Add element in same position as carousel
2. Copy typewriter logic (already exists in your codebase!)
3. Add session management with localStorage
4. Integrate with existing `updateDarkMode()` time logic

### Link Whispers Integration

1. Add preview card HTML to `index.html`
2. Copy styles from `link-whispers/whispers.css`
3. Copy JavaScript from `link-whispers/whispers.js`
4. Add data attributes to links you want previews for

### Keystroke Pattern Integration

1. Copy styles from `keystroke-pattern/pattern.css`
2. Copy JavaScript from `keystroke-pattern/pattern.js`
3. Add overlay container to body
4. Customize animations to match your preferences

---

## 🎛️ Configuration Options

Each prototype has configurable options demonstrated in the demo pages:

- **Song Carousel**: Animation speed, carousel width
- **Time Greeting**: Cooldown period, greeting messages
- **Link Whispers**: Hover delay, slide direction
- **Keystroke Pattern**: Which patterns to detect, animation styles

---

## 💡 Tips

1. **Test individually first** - Each prototype is standalone and fully functional
2. **Consider combinations** - Song carousel OR time greeting (they use the same position)
3. **Customize timing** - All animations can be adjusted for your preferences
4. **Mobile considerations** - Link whispers may need touch event handling
5. **Performance** - All features are lightweight (<5KB each)

---

## 📝 Next Steps

1. Test each prototype
2. Choose which features to integrate
3. Customize animations and timing
4. Consider which features work well together
5. Integrate into main site

---

## 🎨 Color Palette

These prototypes use your existing color scheme:
- Primary pink: `#CF8BA9`
- Light background: `#F0E5D5`
- Dark background: `#1a1a1a`
- Light text: `#2c2c2c`
- Dark text: `#e0e0e0`

---

Built for **cyrilhd.com** — Making compute go brr 🚀
