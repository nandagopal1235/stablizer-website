/* ============================================================
   ESSPEE ELECTRO POWER PRODUCTS – SCRIPT.JS
   Cart management, checkout, WhatsApp deep-link, email mailto
   ============================================================ */

'use strict';

/* ── CONSTANTS ── */
const WA_NUMBER   = '919025059689';
const EMAIL_TO    = 'esspeeelectropowerproducts@gmail.com';
const COMPANY     = 'ESSPEE Electro Power Products';

/* PASTE your Google Apps Script Web App URL here after deploying it.
   Instructions are in SETUP-GUIDE.md */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby8cjrVfnGqE5vMvtCwav-xs6-RMpXRlnKSHfsqXoQv42G_0GBosdNm66qCRybpU87C/exec';

/* ── STATE ── */
let cart = []; // { id, name, price, qty }
let screenshotFile = null;
let screenshotBase64 = null; // full data URL, e.g. "data:image/png;base64,...."

/* ════════════════════════════════════════
   NAVBAR – Scroll & Hamburger
════════════════════════════════════════ */
const navbar    = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobileNav');

window.addEventListener('scroll', () => {
  // Navbar always black (already dark), just keep reference if needed
}, { passive: true });

hamburger.addEventListener('click', () => {
  const isOpen = mobileNav.classList.toggle('open');
  hamburger.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen.toString());
});

function closeMobileNav() {
  mobileNav.classList.remove('open');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
}

/* ════════════════════════════════════════
   SMOOTH SCROLL (respects nav height)
════════════════════════════════════════ */
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 68;
    const top = target.getBoundingClientRect().top + window.scrollY - navH;
    window.scrollTo({ top, behavior: 'smooth' });
    closeMobileNav();
  });
});

/* ════════════════════════════════════════
   SCROLL REVEAL
════════════════════════════════════════ */
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.product-card, .service-card, .shipping-card, .section-header, .contact-item')
  .forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });

/* ════════════════════════════════════════
   CART LOGIC
════════════════════════════════════════ */

/**
 * Add product to cart from product card button
 */
function addToCart(btn) {
  const id    = btn.dataset.id;
  const name  = btn.dataset.name;
  const price = parseInt(btn.dataset.price);

  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, qty: 1 });
  }

  updateCartUI();
  openCart();

  // Animate badge
  const badge = document.getElementById('cartBadge');
  badge.classList.remove('bump');
  requestAnimationFrame(() => badge.classList.add('bump'));
  setTimeout(() => badge.classList.remove('bump'), 300);

  // Button feedback
  const orig = btn.textContent;
  btn.textContent = '✓ Added!';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
  }, 1000);
}

/**
 * Update quantity from cart item
 */
function changeCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

/**
 * Remove item from cart
 */
function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

/**
 * Re-render cart sidebar
 */
function updateCartUI() {
  const badge      = document.getElementById('cartBadge');
  const cartItems  = document.getElementById('cartItems');
  const cartEmpty  = document.getElementById('cartEmpty');
  const cartFooter = document.getElementById('cartFooter');
  const cartTotal  = document.getElementById('cartTotal');

  const totalQty    = cart.reduce((s, i) => s + i.qty, 0);
  const totalAmount = cart.reduce((s, i) => s + i.price * i.qty, 0);

  badge.textContent = totalQty;

  if (cart.length === 0) {
    cartEmpty.style.display  = 'flex';
    cartItems.innerHTML      = '';
    cartFooter.style.display = 'none';
  } else {
    cartEmpty.style.display  = 'none';
    cartFooter.style.display = 'block';
    cartTotal.textContent    = '₹' + totalAmount.toLocaleString('en-IN');

    cartItems.innerHTML = cart.map(item => `
      <li class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${escHtml(item.name)}</div>
          <div class="ci-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
          <div class="ci-qty-row">
            <button class="ci-qty-btn" onclick="changeCartQty('${item.id}', -1)" aria-label="Decrease quantity">−</button>
            <span class="ci-qty-val">${item.qty}</span>
            <button class="ci-qty-btn" onclick="changeCartQty('${item.id}', 1)" aria-label="Increase quantity">+</button>
            <span style="font-size:0.75rem;color:var(--grey);margin-left:4px">× ₹${item.price.toLocaleString('en-IN')}</span>
          </div>
        </div>
        <button class="ci-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove ${escHtml(item.name)}">✕</button>
      </li>
    `).join('');
  }
}

/* ── Cart toggle ── */
function openCart() {
  document.getElementById('cartSidebar').classList.add('open');
  document.getElementById('cartBackdrop').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartSidebar').classList.remove('open');
  document.getElementById('cartBackdrop').classList.remove('active');
  document.body.style.overflow = '';
}

function toggleCart() {
  const isOpen = document.getElementById('cartSidebar').classList.contains('open');
  isOpen ? closeCart() : openCart();
}

/* ── Preselect product when clicking card's Order Now ── */
function preselectProduct(name) {
  // No-op: products handled via cart in this flow
}

/* ════════════════════════════════════════
   CHECKOUT MODAL
════════════════════════════════════════ */
function showCheckout() {
  if (cart.length === 0) return;
  closeCart();

  // Populate order summary
  const summaryEl = document.getElementById('checkoutSummary');
  const totalAmt  = cart.reduce((s, i) => s + i.price * i.qty, 0);

  summaryEl.innerHTML = `
    <div class="cos-title">🛒 Order Summary</div>
    ${cart.map(item => `
      <div class="cos-item">
        <span>${escHtml(item.name)} × ${item.qty}</span>
        <strong>₹${(item.price * item.qty).toLocaleString('en-IN')}</strong>
      </div>
    `).join('')}
    <div class="cos-item" style="margin-top:4px;font-weight:700">
      <span>Products Total</span>
      <strong style="color:var(--red)">₹${totalAmt.toLocaleString('en-IN')}</strong>
    </div>
  `;

  // Update total displays
  document.getElementById('checkoutTotalDisplay').textContent = '₹' + totalAmt.toLocaleString('en-IN');
  document.getElementById('gpayPayAmount').textContent = '₹' + totalAmt.toLocaleString('en-IN');
  document.getElementById('gpayInstructionText').innerHTML =
    `Please pay the total amount of <strong>₹${totalAmt.toLocaleString('en-IN')}</strong> via GPay to <strong>9025059689</strong>. Once paid, upload a screenshot of your payment confirmation below to finalise your order.`;

  // Reset form fields
  document.getElementById('checkoutForm').reset();
  document.getElementById('shippingNote').textContent = '';
  document.getElementById('shippingNote').className   = 'shipping-note';
  document.getElementById('checkoutDeliveryNote').textContent = 'Select shipping location above';
  screenshotFile = null;
  screenshotBase64 = null;
  document.getElementById('filePreviewWrap').style.display = 'none';
  document.getElementById('fileUploadArea').querySelector('.file-upload-ui').style.display = 'flex';
  const statusEl = document.getElementById('orderStatus');
  statusEl.style.display = 'none';
  statusEl.className = 'order-status';

  // Show modal via class (CSS handles display)
  document.getElementById('checkoutModal').classList.add('active');
  document.getElementById('checkoutBackdrop').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Scroll modal to top
  document.getElementById('checkoutModal').scrollTop = 0;
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('active');
  document.getElementById('checkoutBackdrop').classList.remove('active');
  document.body.style.overflow = '';
}

/* ── Shipping note update ── */
function updateShippingNote() {
  const val   = document.getElementById('c-shipping').value;
  const note  = document.getElementById('shippingNote');
  const dnote = document.getElementById('checkoutDeliveryNote');

  if (val === 'chennai') {
    note.textContent  = '✅ Free delivery within Chennai. No extra charge!';
    note.className    = 'shipping-note free';
    dnote.textContent = '✅ Free Delivery Included';
  } else if (val === 'outside') {
    note.textContent  = '📦 Delivery charges apply based on distance. Pay at doorstep only upon delivery.';
    note.className    = 'shipping-note paid';
    dnote.textContent = '📦 Delivery charges payable at doorstep upon delivery';
  } else {
    note.textContent  = '';
    note.className    = 'shipping-note';
    dnote.textContent = 'Select shipping location above';
  }
}

/* ── Screenshot upload ── */
function handleScreenshot(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('File too large. Please upload an image under 5MB.');
    input.value = '';
    return;
  }
  screenshotFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    screenshotBase64 = e.target.result;
    document.getElementById('filePreviewImg').src = e.target.result;
    document.getElementById('filePreviewWrap').style.display = 'block';
    document.getElementById('fileUploadArea').querySelector('.file-upload-ui').style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function removeScreenshot() {
  screenshotFile = null;
  screenshotBase64 = null;
  document.getElementById('c-screenshot').value = '';
  document.getElementById('filePreviewWrap').style.display = 'none';
  document.getElementById('fileUploadArea').querySelector('.file-upload-ui').style.display = 'flex';
}

/* ── Copy UPI ── */
function copyUPI(num, btn) {
  navigator.clipboard.writeText(num).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.background = '#22C55E';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
    }, 1800);
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = num;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  });
}

/* ════════════════════════════════════════
   PLACE ORDER → Backend (email + sheet log) + WhatsApp
════════════════════════════════════════ */
async function placeOrder() {
  /* ── Validation ── */
  const name     = document.getElementById('c-name').value.trim();
  const email    = document.getElementById('c-email').value.trim();
  const phone    = document.getElementById('c-phone').value.trim();
  const address  = document.getElementById('c-address').value.trim();
  const shipping = document.getElementById('c-shipping').value;
  const utr      = document.getElementById('c-utr').value.trim();

  const errors = [];
  if (!name)     errors.push('Full Name');
  if (!email)    errors.push('Email Address');
  if (!phone)    errors.push('Phone Number');
  if (!address)  errors.push('Delivery Address');
  if (!shipping) errors.push('Shipping Location');
  if (!screenshotFile || !screenshotBase64) errors.push('Payment Screenshot');

  if (errors.length) {
    alert('⚠️ Please fill in the following required fields:\n\n• ' + errors.join('\n• '));
    return;
  }

  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.indexOf('PASTE_YOUR') === 0) {
    alert('⚠️ Order backend is not connected yet. Please add your Apps Script URL in script.js (see SETUP-GUIDE.md).');
    return;
  }

  const totalAmt = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shippingLabel = shipping === 'chennai'
    ? 'Within Chennai (Free Delivery)'
    : 'Outside Chennai (Delivery Charge at Doorstep)';

  const btn = document.getElementById('placeOrderBtn');
  const origBtnText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Submitting Order...';
  showOrderStatus('⏳ Submitting your order, please wait…', 'loading');

  const payload = {
    name, email, phone, address, shipping, utr,
    items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
    totalAmount: totalAmt,
    screenshotBase64,
    screenshotType: screenshotFile.type,
    screenshotName: screenshotFile.name
  };

  try {
    const resp = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      // text/plain avoids a CORS preflight that Apps Script can't handle;
      // the backend still parses this as JSON.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const result = await resp.json();
    if (!result.success) {
      throw new Error(result.error || 'Something went wrong on the server.');
    }

    /* ── Order confirmed: open WhatsApp for instant contact ── */
    const itemLines = cart.map(item =>
      `  • ${item.name} × ${item.qty} = ₹${(item.price * item.qty).toLocaleString('en-IN')}`
    ).join('\n');

    const waMsg =
`🔴 NEW ORDER PLACED - ESSPEE
━━━━━━━━━━━━━━━━━━━━━━
👤 *Customer Details*
   Name    : ${name}
   Email   : ${email}
   Phone   : ${phone}
   Address : ${address}
   Shipping: ${shippingLabel}

📦 *Items Ordered*
${itemLines}

💰 *Payment Summary*
   Products Total : ₹${totalAmt.toLocaleString('en-IN')}
   Delivery       : ${shipping === 'chennai' ? 'FREE' : 'Pay at Doorstep'}
   *Amount Paid   : ₹${totalAmt.toLocaleString('en-IN')}*
   ${utr ? `UTR / Ref ID   : ${utr}` : ''}

✅ *Payment screenshot + confirmation already emailed automatically.*

📌 Please confirm this order and share delivery details.
━━━━━━━━━━━━━━━━━━━━━━
${COMPANY}`;

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`, '_blank');

    showOrderStatus('✅ Order placed! A confirmation email is on its way to ' + email + '.', 'success');

    setTimeout(() => {
      closeCheckout();
      cart = [];
      screenshotFile = null;
      screenshotBase64 = null;
      updateCartUI();
    }, 2200);

  } catch (err) {
    showOrderStatus('❌ ' + err.message + ' — please try again, or WhatsApp us directly at 9025059689.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = origBtnText;
  }
}

function showOrderStatus(message, type) {
  const el = document.getElementById('orderStatus');
  el.textContent = message;
  el.className = 'order-status ' + type;
  el.style.display = 'block';
}

/* ════════════════════════════════════════
   UTILITY
════════════════════════════════════════ */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Keyboard: close modals on Escape ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('checkoutModal').style.display !== 'none') {
      closeCheckout();
    } else {
      closeCart();
    }
    closeMobileNav();
  }
});

/* ── Init ── */
updateCartUI();
