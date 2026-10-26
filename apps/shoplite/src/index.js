/**
 * ShopLite — Benchmark target application for DRISHTI AI.
 *
 * A small e-commerce app with plantable bugs controlled by the BUG_SET
 * environment variable. Provides /__test/reset for state cleanup.
 *
 * Section 16.1 of the Technical Architecture.
 */

const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Parse the BUG_SET env var: "all", "none", or "B1,B2,B3"
const BUG_SET_RAW = (process.env.BUG_SET || 'all').trim().toLowerCase();
const ACTIVE_BUGS = new Set(
  BUG_SET_RAW === 'all'
    ? ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8']
    : BUG_SET_RAW === 'none'
      ? []
      : BUG_SET_RAW.split(',').map(b => b.trim().toLowerCase())
);

function hasBug(id) {
  return ACTIVE_BUGS.has(id.toLowerCase());
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// In-memory data store (reset via /__test/reset)
// ---------------------------------------------------------------------------
let store = { users: [], products: [], carts: {}, orders: [] };

function resetStore() {
  store = {
    users: [],
    products: [
      { id: 'p1', name: 'Wireless Headphones', price: 59.99, category: 'electronics', image: '🎧' },
      { id: 'p2', name: 'Running Shoes', price: 89.99, category: 'footwear', image: '👟' },
      { id: 'p3', name: 'Coffee Maker', price: 149.99, category: 'kitchen', image: '☕' },
      { id: 'p4', name: 'Backpack', price: 45.99, category: 'accessories', image: '🎒' },
      { id: 'p5', name: 'Desk Lamp', price: 34.99, category: 'home', image: '💡' },
    ],
    carts: {},
    orders: [],
  };
}

resetStore();

// Session tracking (simple cookie & header-based)
const sessions = {};

function getSessionId(req) {
  let sid = req.headers['x-session-id'] || req.query.sid;
  if (!sid && req.headers.cookie) {
    const match = req.headers.cookie.match(/sid=([^;]+)/);
    if (match) sid = match[1].trim();
  }
  return sid;
}

function getSession(req) {
  const sid = getSessionId(req);
  return sid ? sessions[sid] : null;
}

// ---------------------------------------------------------------------------
// Test reset endpoint — Section 16.1
// ---------------------------------------------------------------------------
app.post('/__test/reset', (req, res) => {
  resetStore();
  Object.keys(sessions).forEach(k => delete sessions[k]);
  res.json({ status: 'ok', message: 'Store and sessions reset.' });
});

// ---------------------------------------------------------------------------
// Routes manifest — Section 16.1
// ---------------------------------------------------------------------------
app.get('/__test/routes', (req, res) => {
  res.json(require('../routes.manifest.json'));
});

// ---------------------------------------------------------------------------
// Bug switchboard — pick which planted bugs are live, without a restart.
// Operator page for benchmarking only; DRISHTI never reads it.
// ---------------------------------------------------------------------------
const BUG_MANIFEST = require('../bugs.manifest.json');

app.get('/__bugs', (req, res) => {
  const rows = BUG_MANIFEST.map(b => {
    const id = b.id.toLowerCase();
    return `<label class="bug"><input type="checkbox" name="bugs" value="${id}" ${hasBug(id) ? 'checked' : ''}>
      <span><b>${b.id}</b> · ${b.severity} · <code>${b.route}</code><br><span class="muted">Bug: ${b.faulty}<br>Correct: ${b.expected}</span></span></label>`;
  }).join('');
  const active = [...ACTIVE_BUGS].map(b => b.toUpperCase()).join(', ') || 'none';
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ShopLite · Bug switchboard</title><style>
body{font:14px system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#171717}
.bug{display:flex;gap:.75rem;align-items:flex-start;border:1px solid #e5e5e5;border-radius:8px;padding:.75rem;margin:.5rem 0;cursor:pointer}
.muted{color:#737373;font-size:13px}code{font-size:12px}
button{background:#171717;color:#fff;border:0;border-radius:6px;padding:.55rem 1rem;font-weight:600;cursor:pointer}
.link{background:none;color:#171717;text-decoration:underline;padding:0;margin-left:1rem;font-weight:400}
</style></head><body>
<h1 style="font-size:1.4rem">Bug switchboard</h1>
<p class="muted">Tick the bugs to plant on this ShopLite (port ${PORT}), then save. Takes effect immediately. Live now: <b>${active}</b></p>
<form method="POST" action="/__bugs">${rows}
<p><button type="submit">Save planted bugs</button>
<button class="link" type="submit" name="preset" value="none">Turn all off</button>
<button class="link" type="submit" name="preset" value="all">Turn all on</button></p></form>
<p class="muted">Then run DRISHTI on <code>http://localhost:${PORT}</code>. Store data is reset on every save.</p>
</body></html>`);
});

app.post('/__bugs', (req, res) => {
  const all = BUG_MANIFEST.map(b => b.id.toLowerCase());
  let picked = req.body.preset === 'all' ? all : req.body.preset === 'none' ? [] : [].concat(req.body.bugs || []);
  picked = picked.map(b => String(b).toLowerCase()).filter(b => all.includes(b));
  ACTIVE_BUGS.clear();
  picked.forEach(b => ACTIVE_BUGS.add(b));
  resetStore();
  Object.keys(sessions).forEach(k => delete sessions[k]);
  res.redirect('/__bugs');
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

// Home
app.get('/', (req, res) => {
  res.render('index', { session: getSession(req) });
});

// Sign Up — J1
app.get('/signup', (req, res) => {
  res.render('signup', { error: null, session: null });
});

app.post('/api/signup', (req, res) => {
  const { email, password } = req.body;

  // B1: Malformed email accepted (should be rejected)
  if (!hasBug('b1')) {
    // Correct behavior: validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email' });
    }
  }
  // When B1 is active: no email validation, malformed email goes through

  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // B2: Duplicate email causes 500 (should show friendly message)
  const existing = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    if (hasBug('b2')) {
      // Bug: uncaught error → 500
      throw new Error('Duplicate key constraint violation');
    }
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const userId = uuidv4();
  store.users.push({ id: userId, email: email.toLowerCase(), password });

  const sid = uuidv4();
  sessions[sid] = { userId, email: email.toLowerCase() };

  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  res.status(201).json({ userId, sessionId: sid, redirect: '/account' });
});

// Login — J2
app.get('/login', (req, res) => {
  res.render('login', { error: null, session: null });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  // B3: Case-sensitive email matching (should be case-insensitive)
  let user;
  if (hasBug('b3')) {
    // Bug: exact match (case-sensitive)
    user = store.users.find(u => u.email === email && u.password === password);
  } else {
    // Correct: case-insensitive
    user = store.users.find(u => u.email === email.toLowerCase() && u.password === password);
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sid = uuidv4();
  sessions[sid] = { userId: user.id, email: user.email };

  res.setHeader('Set-Cookie', `sid=${sid}; Path=/; HttpOnly`);
  res.json({ sessionId: sid, redirect: '/account' });
});

// B4: Forgot password 404 (should work)
app.get('/forgot-password', (req, res) => {
  if (hasBug('b4')) {
    // Bug: returns 404
    res.status(404).send('Not Found');
  } else {
    res.render('forgot-password', { session: null });
  }
});

// Account
app.get('/account', (req, res) => {
  const session = getSession(req);
  if (!session) return res.redirect('/login');
  res.render('account', { session });
});

// Products — J3
app.get('/products', (req, res) => {
  const q = (req.query.q || '').toString();
  let filtered = store.products;

  if (q) {
    // B5: Search doesn't trim whitespace (trailing space → no results)
    const searchTerm = hasBug('b5') ? q : q.trim();
    filtered = store.products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  res.render('products', { products: filtered, query: q, session: getSession(req) });
});

app.get('/products/:id', (req, res) => {
  const product = store.products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).render('404', { session: getSession(req) });
  res.render('product-detail', { product, session: getSession(req) });
});

// Cart — J4
app.get('/cart', (req, res) => {
  const session = getSession(req);
  const sid = getSessionId(req) || 'anon';
  const cart = store.carts[sid] || [];

  const items = cart.map(ci => {
    const prod = store.products.find(p => p.id === ci.productId);
    return { ...ci, product: prod };
  });

  const subtotal = items.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);

  res.render('cart', { items, subtotal, session });
});

app.post('/api/cart/add', (req, res) => {
  const { productId, quantity } = req.body;
  const sid = getSessionId(req) || 'anon';
  const qty = parseInt(quantity, 10);

  // B6: Quantity validation bypass (0 and negative accepted)
  if (!hasBug('b6')) {
    if (!qty || qty < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
  }

  if (!store.carts[sid]) store.carts[sid] = [];

  const existing = store.carts[sid].find(i => i.productId === productId);
  if (existing) {
    existing.quantity += qty;
  } else {
    store.carts[sid].push({ productId, quantity: qty });
  }

  res.json({ message: 'Item added to cart', cart: store.carts[sid] });
});

// Checkout — J5
app.get('/checkout', (req, res) => {
  const session = getSession(req);
  const sid = getSessionId(req) || 'anon';
  const cart = store.carts[sid] || [];

  // B8: Empty cart checkout causes TypeError
  if (hasBug('b8') && cart.length === 0) {
    // Bug: tries to access properties on undefined
    res.render('checkout', { items: null, subtotal: null, session });
    return;
  }

  if (cart.length === 0) {
    return res.render('checkout-empty', { session });
  }

  const items = cart.map(ci => {
    const prod = store.products.find(p => p.id === ci.productId);
    return { ...ci, product: prod };
  });
  const subtotal = items.reduce((sum, i) => sum + (i.product?.price || 0) * i.quantity, 0);

  res.render('checkout', { items, subtotal, discount: 0, total: subtotal, coupon: null, session });
});

app.post('/api/checkout/apply-coupon', (req, res) => {
  const { coupon, subtotal } = req.body;
  const sub = parseFloat(subtotal);

  if (coupon !== 'SAVE10') {
    return res.status(400).json({ error: 'Invalid coupon code' });
  }

  const discount = sub * 0.1;

  // B7: Coupon stacks (should only apply once)
  // When B7 is active, we always apply the discount without checking if already applied
  // When B7 is not active, the frontend should track and prevent re-application

  res.json({ discount: discount.toFixed(2), total: (sub - discount).toFixed(2), coupon: 'SAVE10' });
});

app.post('/api/checkout/place-order', (req, res) => {
  const session = getSession(req);
  const sid = getSessionId(req) || 'anon';
  const cart = store.carts[sid] || [];

  if (cart.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  const orderId = uuidv4();
  store.orders.push({ id: orderId, items: [...cart], userId: session?.userId, createdAt: new Date() });
  store.carts[sid] = [];

  res.json({ orderId, redirect: `/order/${orderId}` });
});

app.get('/order/:id', (req, res) => {
  const order = store.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).render('404', { session: getSession(req) });
  res.render('order-confirmation', { order, session: getSession(req) });
});

// 404 catch-all
app.use((req, res) => {
  res.status(404).render('404', { session: getSession(req) });
});

// Error handler — B2 will hit this
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`ShopLite running on http://localhost:${PORT}`);
  console.log(`Active bugs: ${ACTIVE_BUGS.size > 0 ? [...ACTIVE_BUGS].join(', ') : 'none'}`);
});
