// Rover & Co. storefront logic: catalog rendering, cart, and a mock checkout.
// State is persisted to localStorage so the cart survives page reloads.

const CART_KEY = "rover_cart_v1";
const money = (n) => "$" + n.toFixed(2);

let cart = loadCart();

function loadCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || {};
  } catch {
    return {};
  }
}
function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function productById(id) {
  return PRODUCTS.find((p) => p.id === id);
}

/* ---------- Render catalog ---------- */
function renderGrid() {
  const grid = document.getElementById("grid");
  grid.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="card">
      <div class="thumb">
        ${p.art}
        <span class="tag">${p.tag}</span>
      </div>
      <div class="body">
        <h3>${p.name}</h3>
        <p class="blurb">${p.blurb}</p>
        <div class="row">
          <span class="price">${money(p.price)}</span>
          <button class="add" data-add="${p.id}">Add to cart</button>
        </div>
      </div>
    </article>`
  ).join("");
}

/* ---------- Cart operations ---------- */
function addToCart(id) {
  cart[id] = (cart[id] || 0) + 1;
  saveCart();
  updateCartUI();
}
function setQty(id, qty) {
  if (qty <= 0) delete cart[id];
  else cart[id] = qty;
  saveCart();
  updateCartUI();
  renderDrawerItems();
}
function cartCount() {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}
function subtotal() {
  return Object.entries(cart).reduce(
    (sum, [id, q]) => sum + (productById(id)?.price || 0) * q,
    0
  );
}

function updateCartUI() {
  const count = cartCount();
  const badge = document.getElementById("cart-count");
  badge.textContent = count;
  badge.style.display = count ? "grid" : "none";
}

/* ---------- Drawer ---------- */
function openDrawer() {
  document.getElementById("overlay").classList.add("open");
  document.getElementById("drawer").classList.add("open");
  showCartView();
}
function closeDrawer() {
  document.getElementById("overlay").classList.remove("open");
  document.getElementById("drawer").classList.remove("open");
}

function renderDrawerItems() {
  const wrap = document.getElementById("items");
  const ids = Object.keys(cart);
  if (!ids.length) {
    wrap.innerHTML = `<div class="empty">Your cart is empty.<br>Find the perfect leash above! 🦮</div>`;
  } else {
    wrap.innerHTML = ids
      .map((id) => {
        const p = productById(id);
        const q = cart[id];
        return `
        <div class="line">
          <div class="mini">${p.art}</div>
          <div>
            <div class="name">${p.name}</div>
            <div class="meta">${money(p.price)} each</div>
            <div class="qty">
              <button data-dec="${id}" aria-label="Decrease">−</button>
              <span>${q}</span>
              <button data-inc="${id}" aria-label="Increase">+</button>
            </div>
          </div>
          <div>
            <div class="lp">${money(p.price * q)}</div>
            <button class="rm" data-rm="${id}">Remove</button>
          </div>
        </div>`;
      })
      .join("");
  }
  renderSummary();
}

function renderSummary() {
  const sub = subtotal();
  const shipping = sub > 0 && sub < 50 ? 5 : 0;
  const total = sub + shipping;
  const el = document.getElementById("summary");
  el.innerHTML = `
    <div class="ln"><span>Subtotal</span><span>${money(sub)}</span></div>
    <div class="ln"><span>Shipping</span><span>${
      shipping === 0 ? (sub > 0 ? "FREE" : money(0)) : money(shipping)
    }</span></div>
    <div class="ln total"><span>Total</span><span>${money(total)}</span></div>
    ${sub > 0 && sub < 50 ? `<div class="meta" style="color:var(--muted);font-size:13px;margin-bottom:8px">Add ${money(50 - sub)} more for free shipping 🚚</div>` : ""}
    <button class="checkout" id="go-checkout" ${sub === 0 ? "disabled" : ""}>Checkout</button>
  `;
  const go = document.getElementById("go-checkout");
  if (go) go.onclick = showCheckoutView;
}

/* ---------- Views inside the drawer ---------- */
function showCartView() {
  document.getElementById("drawer-title").textContent = "Your Cart";
  document.getElementById("items").style.display = "";
  document.getElementById("summary").style.display = "";
  document.getElementById("checkout-view").style.display = "none";
  renderDrawerItems();
}

function showCheckoutView() {
  document.getElementById("drawer-title").textContent = "Checkout";
  document.getElementById("items").style.display = "none";
  document.getElementById("summary").style.display = "none";
  const view = document.getElementById("checkout-view");
  view.style.display = "";
  const total = subtotal() + (subtotal() < 50 ? 5 : 0);
  view.innerHTML = `
    <button class="back-link" id="back-cart">← Back to cart</button>
    <form id="pay-form">
      <label>Email</label>
      <input type="email" required placeholder="you@example.com" />
      <label>Full name</label>
      <input type="text" required placeholder="Jamie Rivera" />
      <label>Shipping address</label>
      <input type="text" required placeholder="123 Bark Lane" />
      <div class="two">
        <div><label>City</label><input type="text" required placeholder="Portland" /></div>
        <div><label>ZIP</label><input type="text" required placeholder="97201" /></div>
      </div>
      <label>Card number</label>
      <input type="text" required placeholder="4242 4242 4242 4242" inputmode="numeric" />
      <div class="two">
        <div><label>Expiry</label><input type="text" required placeholder="MM/YY" /></div>
        <div><label>CVC</label><input type="text" required placeholder="123" inputmode="numeric" /></div>
      </div>
      <button type="submit" class="checkout" style="margin-top:18px">Pay ${money(total)}</button>
    </form>`;
  document.getElementById("back-cart").onclick = showCartView;
  document.getElementById("pay-form").onsubmit = (e) => {
    e.preventDefault();
    placeOrder();
  };
}

function placeOrder() {
  cart = {};
  saveCart();
  updateCartUI();
  const view = document.getElementById("checkout-view");
  document.getElementById("drawer-title").textContent = "Order Confirmed";
  view.innerHTML = `
    <div class="success">
      <div class="check">✅</div>
      <h2>You're all set!</h2>
      <p>Your new leash is on its way. We emailed a receipt and tracking link.</p>
      <p>Order #${Math.floor(100000 + Math.random() * 900000)}</p>
      <button class="checkout" id="keep-shopping" style="margin-top:18px">Keep shopping</button>
    </div>`;
  document.getElementById("keep-shopping").onclick = closeDrawer;
}

/* ---------- Wire up ---------- */
document.addEventListener("DOMContentLoaded", () => {
  renderGrid();
  updateCartUI();

  document.getElementById("cart-open").onclick = openDrawer;
  document.getElementById("overlay").onclick = closeDrawer;
  document.getElementById("drawer-close").onclick = closeDrawer;
  document.getElementById("shop-now").onclick = () =>
    document.getElementById("shop").scrollIntoView({ behavior: "smooth" });

  // Delegated clicks for add-to-cart and quantity controls.
  document.body.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add]");
    if (add) {
      addToCart(add.dataset.add);
      add.textContent = "Added ✓";
      add.classList.add("added");
      setTimeout(() => {
        add.textContent = "Add to cart";
        add.classList.remove("added");
      }, 1000);
      return;
    }
    const inc = e.target.closest("[data-inc]");
    if (inc) return setQty(inc.dataset.inc, cart[inc.dataset.inc] + 1);
    const dec = e.target.closest("[data-dec]");
    if (dec) return setQty(dec.dataset.dec, cart[dec.dataset.dec] - 1);
    const rm = e.target.closest("[data-rm]");
    if (rm) return setQty(rm.dataset.rm, 0);
  });
});
