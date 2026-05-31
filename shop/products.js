// Product catalog for Rover & Co. — premium dog leashes.
// Each product carries a small inline SVG illustration so the store
// renders fully offline with no external image dependencies.

const swatch = (a, b) =>
  `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Dog leash">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
      </linearGradient>
    </defs>
    <rect width="400" height="300" fill="url(#g)"/>
    <path d="M70 60 q60 80 130 90 q80 12 130 90" fill="none"
      stroke="rgba(255,255,255,.85)" stroke-width="14" stroke-linecap="round"/>
    <circle cx="70" cy="60" r="22" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="12"/>
    <rect x="318" y="232" width="34" height="22" rx="6" fill="rgba(0,0,0,.25)"/>
  </svg>`;

const PRODUCTS = [
  {
    id: "trailblazer",
    name: "Trailblazer Hiking Leash",
    price: 38,
    tag: "Bestseller",
    blurb: "Rugged 6ft climbing-grade rope leash with a padded handle for long trail days.",
    colors: ["Forest", "Slate", "Sunset"],
    art: swatch("#2f7d4f", "#173d27"),
  },
  {
    id: "city-strider",
    name: "City Strider Leather Lead",
    price: 52,
    tag: "Premium",
    blurb: "Full-grain vegetable-tanned leather that softens beautifully with every walk.",
    colors: ["Tan", "Espresso", "Black"],
    art: swatch("#9b6a3b", "#5a3a1c"),
  },
  {
    id: "reflect-pro",
    name: "Reflect Pro Night Leash",
    price: 34,
    tag: "Safety",
    blurb: "High-visibility reflective weave keeps your pup seen on early-morning walks.",
    colors: ["Hi-Vis Yellow", "Orange", "Silver"],
    art: swatch("#caa53a", "#7a5e10"),
  },
  {
    id: "hands-free",
    name: "Hands-Free Runner's Belt",
    price: 45,
    tag: "Active",
    blurb: "Bungee waist leash with a shock-absorbing section — perfect for jogging together.",
    colors: ["Charcoal", "Teal", "Coral"],
    art: swatch("#2b7e87", "#16434a"),
  },
  {
    id: "puppy-soft",
    name: "Puppy Soft Starter",
    price: 24,
    tag: "New",
    blurb: "Lightweight, gentle nylon lead sized just right for training young pups.",
    colors: ["Sky", "Bubblegum", "Mint"],
    art: swatch("#5fa8e8", "#2b5f99"),
  },
  {
    id: "double-trouble",
    name: "Double Trouble Coupler",
    price: 41,
    tag: "Two dogs",
    blurb: "Tangle-free dual coupler so you can walk two best friends on one handle.",
    colors: ["Plum", "Graphite", "Berry"],
    art: swatch("#8e5aa6", "#4d2c5e"),
  },
  {
    id: "waterproof",
    name: "Waterproof Coastal Lead",
    price: 36,
    tag: "All-weather",
    blurb: "Odor-proof coated webbing that rinses clean after beach and lake adventures.",
    colors: ["Wave Blue", "Sea Green", "Sand"],
    art: swatch("#3a93b8", "#1d5670"),
  },
  {
    id: "heritage",
    name: "Heritage Waxed Cotton Lead",
    price: 58,
    tag: "Limited",
    blurb: "Heirloom waxed cotton with solid brass hardware and a lifetime guarantee.",
    colors: ["Olive", "Navy", "Oxblood"],
    art: swatch("#6b7340", "#3a401f"),
  },
];

if (typeof module !== "undefined") module.exports = PRODUCTS;
