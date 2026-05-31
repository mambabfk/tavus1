# Rover & Co. — Dog Leash Storefront 🐾

A self-contained, dependency-free ecommerce storefront for selling dog leashes.
**Everything lives in a single `index.html`** — markup, styles, product data, and
cart/checkout logic are all inline, so there are no external files to load and it
works offline.

## Run it

The simplest way — just **double-click `index.html`** (or drag it into a browser).

Or serve the folder:

```bash
cd shop
python3 -m http.server 8000   # then visit http://localhost:8000
# Windows: use `python -m http.server 8000`
```

## Features

- **8-product catalog** with inline SVG product art (each leash a distinct color)
- **Slide-out cart drawer** with quantity controls and a live subtotal
- **Free-shipping threshold** ($50) with an "add more to unlock" nudge
- **Mock checkout** flow (shipping + payment form → order confirmation)
- **Cart persistence** via `localStorage` (survives reloads)
- **Responsive** layout (4 → 2 → 1 column)

> Demo only — products are fictional and checkout is simulated (no real payments).
