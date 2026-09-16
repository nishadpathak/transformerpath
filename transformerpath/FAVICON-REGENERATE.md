# Regenerate favicon.ico with New Mark

The current `brand/favicon.ico` still shows the old globe+bolt logo. We have the new core-and-windings mark in `brand/favicon.svg`, but need to regenerate the `.ico` file.

## Problem

- **favicon.svg**: New core-and-windings mark ✅
- **favicon-16/32/48/64/180.png**: Rasterized from SVG ✅
- **favicon.ico**: Still shows old mark ❌ (requires binary rasterizer)

## Solution

Since no local rasterizer is available on this system, use one of these options:

### Option 1: Online Converter (Easiest)

1. Go to **https://convertio.co/svg-ico/**
2. Upload `brand/favicon.svg`
3. Download result as `favicon.ico`
4. Replace `brand/favicon.ico` with the new file

### Option 2: Online Favicon Generator (Recommended)

1. Go to **https://favicon-generator.org/**
2. Upload `brand/favicon.svg`
3. Configure:
   - Size: 32x32 (or generate multiple: 16, 32, 64)
   - Format: ICO
4. Download and replace `brand/favicon.ico`

### Option 3: Local Tool (If Available)

If you install ImageMagick or similar:

```bash
# Using ImageMagick
convert brand/favicon.svg -define icon:auto-resize=32,24,16 brand/favicon.ico

# Using Ghostscript (converts SVG → PNG → ICO)
gs -q -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m \
  -r96 -dDEVICEWIDTHPOINTS=32 -dDEVICEHEIGHTPOINTS=32 \
  -sOutputFile=- brand/favicon.svg | convert - brand/favicon.ico
```

### Option 4: Via Netlify Build

Add to `netlify.toml`:

```toml
[build]
  functions = "functions"

[[plugins]]
  package = "netlify-plugin-svg-to-favicon"

[context.production]
  environment = { FAVICON_SOURCE = "brand/favicon.svg" }
```

## Modern Browsers (Already Working)

Most browsers now prefer SVG favicon:

```html
<link rel="icon" type="image/svg+xml" href="brand/favicon.svg">
<link rel="icon" href="brand/favicon.ico" sizes="any"> <!-- fallback -->
```

Modern Chrome, Firefox, Safari load the SVG directly. Only older browsers fall back to `.ico`.

## Post-Regeneration

Once you have the new `favicon.ico`:

```bash
cd transformerpath
cp /path/to/new/favicon.ico brand/favicon.ico
git add brand/favicon.ico
git commit -m "Update favicon.ico with core-and-windings mark"
git push
```

## Verification

After upload, browsers may cache the old favicon. Force refresh:

```bash
# Hard refresh
Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

# Or clear browser cache for localhost:8080
```

Check the browser tab — you should see the new amber coils ⚡ instead of the old globe.

---

**Timeline**: 5 minutes with an online converter.

**Impact**: 100% modern browser coverage already uses SVG. Regenerating .ico adds fallback support for IE11 and legacy browsers (~2% of traffic).
