const CART_KEY = 'museumCartV1';
const TAX_RATE = 0.102;
const MEMBER_DISCOUNT_RATE = 0.15;
const DISCOUNT_CHOICE_KEY = 'museumCartDiscountChoice';
const MEMBER_KEY = 'museumCartIsMember';
const SHIPPING_RATE = 25.00;
const VOLUME_TIERS = [
  [0.00,   49.99, 0.00],
  [50.00,  99.99, 0.05],
  [100.00, 199.99, 0.10],
  [200.00, Infinity, 0.15]
];

let itemsDiv, summaryPre, emptyMsg, memberToggle, clearBtn;
let modal, modalImg, shopImages, lastTrigger = null;

function readCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}
function writeCart(next) {
  localStorage.setItem(CART_KEY, JSON.stringify(next));
}
function money(n) {
  const sign = n < 0 ? -1 : 1;
  const s = '$' + Math.abs(n).toFixed(2);
  return sign < 0 ? '(' + s + ')' : s;
}
function volumeRate(total) {
  for (const [min, max, rate] of VOLUME_TIERS) {
    if (total >= min && total <= max) return rate;
  }
  return 0;
}
function addToCart(btn) {
  const id        = btn.dataset.id;
  const name      = btn.dataset.name;
  const unitPrice = Number(btn.dataset.price);
  const image     = btn.dataset.image;
  if (!id || !name || !unitPrice) return;

  const cart = readCart();
  const idx = cart.findIndex(it => it.id === id);
  if (idx >= 0) cart[idx].qty += 1;
  else cart.push({ id, name, unitPrice, qty: 1, image });
  writeCart(cart);

  const card = btn.closest('.souvenir-item');
  if (card) {
    const badge = card.querySelector('.qty-badge');
    if (badge) {
      const item = cart.find(it => it.id === id);
      badge.textContent = item ? `Qty: ${item.qty}` : '';
    }
  }
}
function removeItem(id) {
  const cart = readCart();
  const idx = cart.findIndex(it => it.id === id);
  if (idx >= 0) {
    cart[idx].qty -= 1;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    writeCart(cart);
  }
  render();
}
function clearCart() {
  writeCart([]);
  clearChoice();
  writeMember(false);
  if (memberToggle) memberToggle.checked = false;
  render();
}

function readChoice(){ try{return localStorage.getItem(DISCOUNT_CHOICE_KEY)||'';}catch{return '';} }
function writeChoice(v){ localStorage.setItem(DISCOUNT_CHOICE_KEY,v); }
function clearChoice(){ localStorage.removeItem(DISCOUNT_CHOICE_KEY); }
function readMember(){ try{return localStorage.getItem(MEMBER_KEY)==='1';}catch{return false;} }
function writeMember(v){ localStorage.setItem(MEMBER_KEY, v?'1':'0'); }

function render() {
  itemsDiv   = itemsDiv   || document.getElementById('items');
  summaryPre = summaryPre || document.getElementById('summary');
  emptyMsg   = emptyMsg   || document.getElementById('emptyMsg');

  if (!itemsDiv || !summaryPre || !emptyMsg) return;

  const cart = readCart().filter(it => it && it.qty > 0 && it.unitPrice > 0);

  if (cart.length === 0) {
    itemsDiv.hidden = true;
    emptyMsg.hidden = false;
    summaryPre.hidden = false;
    summaryPre.textContent = `Hello Shopper, here is your Cart Summary:

${'Subtotal of Items:'.padEnd(28)}${money(0).padStart(14)}
${'Volume Discount:'.padEnd(28)}${money(0).padStart(14)}
${'Member Discount:'.padEnd(28)}${money(0).padStart(14)}
${'Shipping:'.padEnd(28)}${money(0).padStart(14)}
${'Subtotal (Taxable):'.padEnd(28)}${money(0).padStart(14)}
${'Tax Rate:'.padEnd(28)}${String((TAX_RATE*100).toFixed(2)+'%').padStart(14)}
${'Tax Amount $:'.padEnd(28)}${money(0).padStart(14)}
${'Invoice Total:'.padEnd(28)}${money(0).padStart(14)}`;
    return;
  }

  emptyMsg.hidden = true;

  const itemTotal = cart.reduce((sum, it) => sum + it.unitPrice * it.qty, 0);
  const volRate   = volumeRate(itemTotal);

  memberToggle = memberToggle || document.getElementById('memberToggle');
  const isMember = memberToggle ? memberToggle.checked : false;

  let applyMember = false, applyVolume = false;
  const saved = readChoice();

  if (isMember && volRate > 0) {
    if (saved === 'M') {
      applyMember = true;
    } else if (saved === 'V') {
      applyVolume = true;
    } else {
      const choice = (prompt("Only one discount may be applied. Type 'M' for Member or 'V' for Volume:") || '').trim().toUpperCase();
      if (choice === 'M') { applyMember = true; writeChoice('M'); }
      else { applyVolume = true; writeChoice('V'); }
    }
  } else if (isMember) {
    clearChoice();
    applyMember = true;
  } else if (volRate > 0) {
    clearChoice();
    applyVolume = true;
  } else {
    clearChoice();
  }

  const memberDiscount   = applyMember ? (itemTotal * MEMBER_DISCOUNT_RATE) : 0;
  const volumeDiscount   = applyVolume ? (itemTotal * volRate) : 0;
  const taxableSubtotal  = itemTotal - memberDiscount - volumeDiscount + SHIPPING_RATE;
  const taxAmount        = taxableSubtotal * TAX_RATE;
  const invoiceTotal     = taxableSubtotal + taxAmount;

  const linesHTML = `
    <ul class="cart-lines">
      ${cart.map(it => `
        <li class="cart-line">
          <span class="cart-line-left">${String(it.qty).padStart(2,' ')} × ${it.name}</span>
          <span class="cart-line-right">
            <span class="amount">${money(it.unitPrice * it.qty)}</span>
            <button class="remove" aria-label="Remove one ${it.name}" onclick="removeItem('${it.id}')">Remove</button>
          </span>
        </li>
      `).join('')}
    </ul>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #004753;">
    <pre class="summary" aria-live="polite">
Hello Shopper, here is your Cart Summary:

${'Subtotal of Items:'.padEnd(28,' ')}${money(itemTotal).padStart(14,' ')}
${'Volume Discount:'.padEnd(28,' ')}${money(-volumeDiscount).padStart(14,' ')}
${'Member Discount:'.padEnd(28,' ')}${money(-memberDiscount).padStart(14,' ')}
${'Shipping:'.padEnd(28,' ')}${money(SHIPPING_RATE).padStart(14,' ')}
${'Subtotal (Taxable):'.padEnd(28,' ')}${money(taxableSubtotal).padStart(14,' ')}
${'Tax Rate:'.padEnd(28,' ')}${String((TAX_RATE*100).toFixed(2)+'%').padStart(14,' ')}
${'Tax Amount $:'.padEnd(28,' ')}${money(taxAmount).padStart(14,' ')}
${'Invoice Total:'.padEnd(28,' ')}${money(invoiceTotal).padStart(14,' ')}
    </pre>
  `;

  itemsDiv.innerHTML = linesHTML;
  itemsDiv.hidden = false;
  summaryPre.hidden = true;
}

function showSection(sectionId) {
  const sections = document.querySelectorAll('.collection-section');
  sections.forEach(section => { section.style.display = 'none'; });
  const target = document.getElementById(sectionId);
  if (target) target.style.display = 'block';
}

function initCollectionsModal() {
  const colModal     = document.querySelector('.modal[role="dialog"]');
  const colModalBody = document.getElementById('modal-body');
  const closeBtn     = colModal ? colModal.querySelector('.close-modal') : null;
  if (!colModal || !colModalBody) return;

  function openFrom(selector, trigger) {
    const src = document.querySelector(selector);
    if (!src) { console.warn('Missing modal content:', selector); return; }
    colModalBody.innerHTML = src.innerHTML;
    colModal.style.display = 'flex';
    lastTrigger = trigger || null;
    (closeBtn || colModal).focus();
    document.body.style.overflow = 'hidden';
  }
  function closeColModal() {
    colModal.style.display = 'none';
    colModalBody.innerHTML = '';
    document.body.style.overflow = '';
    if (lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
  }
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-modal-target]');
    if (trigger) {
      e.preventDefault();
      openFrom(trigger.getAttribute('data-modal-target'), trigger);
      return;
    }
    if (e.target === colModal || (e.target && e.target.closest && e.target.closest('.close-modal'))) {
      closeColModal();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && colModal.style.display !== 'none') closeColModal();
  });
}

function closeShopModal() {
  if (!modal || !modalImg) return;
  modal.style.display = 'none';
  modalImg.src = '';
  modalImg.alt = '';
}

document.addEventListener('DOMContentLoaded', () => {
  memberToggle = document.getElementById('memberToggle');
  clearBtn     = document.getElementById('clearBtn');

  if (memberToggle) {
    memberToggle.checked = readMember();
    memberToggle.addEventListener('change', () => { writeMember(memberToggle.checked); render(); });
  }
  if (clearBtn) clearBtn.addEventListener('click', clearCart);

  modal      = document.getElementById('modal');
  modalImg   = document.getElementById('modalImg');
  shopImages = document.querySelectorAll('.shop-modal-image');

  if (modal && modalImg && shopImages && shopImages.length > 0) {
    shopImages.forEach(img => {
      img.addEventListener('click', () => {
        modalImg.src = img.src;
        modalImg.alt = img.alt;
        modal.style.display = 'flex';
      });
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeShopModal();
    });
  }

  initCollectionsModal();
  render();
});
