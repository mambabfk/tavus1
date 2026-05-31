# Rover & Co. — Dog Leash Storefront 🐾

A self-contained, dependency-free ecommerce storefront for selling dog leashes.
Pure HTML/CSS/JS — no build step, no backend, no external assets (works offline).

## Features

- **8-product catalog** with inline SVG product art (renders offline)
- **Slide-out cart drawer** with quantity controls and live subtotal
- **Free-shipping threshold** ($50) with an "add more to unlock" nudge
- **Mock checkout** flow (shipping + payment form → order confirmation)
- **Cart persistence** via `localStorage` (survives reloads)
- **Responsive** layout (4 → 2 → 1 column)

## Run it

It's a static site — just open the file, or serve the folder:

```bash
cd shop
python3 -m http.server 8000
# then visit http://localhost:8000
```

Or simply open `shop/index.html` in a browser.

## Files

| File           | Purpose                                  |
| -------------- | ---------------------------------------- |
| `index.html`   | Page shell, hero, cart drawer markup     |
| `styles.css`   | All styling                              |
| `products.js`  | Product catalog data + SVG art generator |
| `app.js`       | Cart state, rendering, checkout logic    |

> Demo only — products are fictional and checkout is simulated (no real payments).
