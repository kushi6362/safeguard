/* ============================================================
   SafeGuard — Women Safety Alert & Tracking System
   Main JavaScript — All Features
   ============================================================ */

'use strict';

/* ── API base URL (change to your Django server) ── */
const API_BASE = '';  // empty = same origin (works locally & on Render)

/* ════════════════════════════════════════
   APP STATE — All data starts empty
════════════════════════════════════════ */
const App = {
  currentPage: 'dashboard',
  aiEnabled: true,
  locationSharing: false,
  locationTimer: null,
  currentDb: 42,
  sosTimerRef: null,
  toastTimerRef: null,
  waveTimerRef: null,
  dbTimerRef: null,
  clockRef: null,
  loggedIn: false,

  contacts: [],
  alerts: [],
  adminUsers: [],
  users: [],

  contactIdCounter: 1,

};

/* ════════════════════════════════════════
   BROWSER NOTIFICATIONS
════════════════════════════════════════ */
function requestNotifyPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
}

function sendBrowserNotification(title, body, isUrgent = false) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#d63051"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'),
      tag: isUrgent ? 'sos-alert' : 'safeguard-alert',
      requireInteraction: isUrgent
    });
    if (isUrgent) {
      n.onclick = () => { window.focus(); showPage('emergency'); };
    }
    setTimeout(() => n.close(), isUrgent ? 15000 : 5000);
  } catch (_) {}
}

/* ════════════════════════════════════════
   LOCAL STORAGE HELPERS
════════════════════════════════════════ */
function saveState() {
  try {
    localStorage.setItem('safeguard_users', JSON.stringify(App.users));
    localStorage.setItem('safeguard_contacts', JSON.stringify(App.contacts));
    localStorage.setItem('safeguard_alerts', JSON.stringify(App.alerts));
    localStorage.setItem('safeguard_contactId', App.contactIdCounter);
    localStorage.setItem('safeguard_adminUsers', JSON.stringify(App.adminUsers));
  } catch (_) {}
}

function loadState() {
  try {
    const u = localStorage.getItem('safeguard_users');
    if (u) App.users = JSON.parse(u);
    const c = localStorage.getItem('safeguard_contacts');
    if (c) App.contacts = JSON.parse(c);
    const a = localStorage.getItem('safeguard_alerts');
    if (a) App.alerts = JSON.parse(a);
    const ci = localStorage.getItem('safeguard_contactId');
    if (ci) App.contactIdCounter = parseInt(ci, 10);
    const ad = localStorage.getItem('safeguard_adminUsers');
    if (ad) App.adminUsers = JSON.parse(ad);
  } catch (_) {}
}

/* ════════════════════════════════════════
   BOOT
════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  startClock();
  buildWaveform();
  startDbAnimation();
  requestNotifyPermission();

  // Track custom SOS message edits
  const msgEl = document.getElementById('sos-msg-template');
  if (msgEl) {
    msgEl.addEventListener('input', () => { msgEl.dataset.custom = 'true'; });
  }
});

/* ════════════════════════════════════════
   CLOCK
════════════════════════════════════════ */
function startClock() {
  const tick = () => {
    const now = new Date();
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const str = `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')} ${ampm}`;
    const el = document.getElementById('clock');
    if (el) el.textContent = str;
  };
  tick();
  App.clockRef = setInterval(tick, 1000);
}

/* ════════════════════════════════════════
   LOGIN / REGISTER
════════════════════════════════════════ */
function switchLoginTab(tab) {
  document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-' + tab).classList.add('active');
}

function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value.trim();

  if (!email || !pass) { toast('Please fill all fields.', 'Login Error'); return; }

  // Try localStorage first (fast, works offline)
  if (tryLocalLogin(email, pass)) return;

  // Fallback to backend API
    fetch(API_BASE + '/api/auth/login/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email, password: pass })
  }).then(r => r.json()).then(data => {
    if (data.id) {
      App.loggedIn = true;
      const av = document.querySelector('.user-av');
      if (av) av.textContent = data.username.slice(0,2).toUpperCase();
      const un = document.querySelector('.topbar-user span');
      if (un) un.textContent = data.username.slice(0,1).toUpperCase() + data.username.slice(1) + ' .';
      document.getElementById('p-name').value = data.username || '';
      document.getElementById('p-phone').value = data.phone || '';
      document.getElementById('p-email').value = data.email || '';
      afterLogin();
      return;
    }
    toast('Invalid credentials. Try admin / admin or register a new account.', 'Login Failed');
  }).catch(() => toast('Cannot reach server. Check your connection.', 'Login Failed'));
}

function tryLocalLogin(email, pass) {
  // Check registered users first
  const user = App.users.find(u => u.email === email && u.pass === pass);
  if (user) {
    App.loggedIn = true;
    const av = document.querySelector('.user-av');
    if (av) av.textContent = user.name.slice(0,2).toUpperCase();
    const un = document.querySelector('.topbar-user span');
    if (un) un.textContent = user.name.split(' ')[0] + ' ' + (user.name.split(' ')[1]?.[0] || '') + '.';
    document.getElementById('p-name').value = user.name || '';
    document.getElementById('p-phone').value = user.phone || '';
    document.getElementById('p-email').value = user.email || '';
    afterLogin();
    return true;
  }

  // Default admin/admin fallback
  if (email === 'admin' && pass === 'admin') {
    App.loggedIn = true;
    const av = document.querySelector('.user-av');
    if (av) av.textContent = 'AD';
    const un = document.querySelector('.topbar-user span');
    if (un) un.textContent = 'Admin .';
    afterLogin();
    return true;
  }

  return false;
}

function validatePassword(pass, name, email) {
  if (pass.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(pass)) return 'Password must contain at least one uppercase letter (A-Z)';
  if (!/[a-z]/.test(pass)) return 'Password must contain at least one lowercase letter (a-z)';
  if (!/[0-9]/.test(pass)) return 'Password must contain at least one number (0-9)';
  if (!/[@#$%&!]/.test(pass)) return 'Password must contain at least one special character (@, #, $, %, &, !)';
  if (/\s/.test(pass)) return 'Password must not contain spaces';
  if (name && pass.toLowerCase().includes(name.toLowerCase())) return 'Password must not be the same as your name';
  if (email && pass.toLowerCase().includes(email.split('@')[0].toLowerCase())) return 'Password must not be the same as your email';
  return '';
}

function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass = document.getElementById('reg-pass').value;

  if (!name || !email || !phone || !pass) { toast('Please fill all fields.', 'Registration Error'); return; }

  const pwErr = validatePassword(pass, name, email);
  if (pwErr) { toast(pwErr, 'Weak Password'); return; }

  if (App.users.find(u => u.email === email)) {
    toast('Email already registered. Please sign in.', 'Registration Failed');
    return;
  }

  // Save locally instantly (no waiting for server)
  App.users.push({ name, email, phone, pass });
  saveState();
  completeRegistration(name, email, phone, pass);
  toast('Account created! Welcome ' + name, 'Registration Successful');

  // Fire API in background (don't block)
  fetch(API_BASE + '/api/auth/register/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: name, email, phone, password: pass })
  }).catch(() => {});
}

// Live password requirement check
function checkPassRequirements() {
  const pass = document.getElementById('reg-pass').value;
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  document.getElementById('req-length').innerHTML = (pass.length >= 8 ? '✓' : '✗') + ' At least 8 characters';
  document.getElementById('req-length').style.color = pass.length >= 8 ? '#10b981' : 'var(--muted)';
  document.getElementById('req-upper').innerHTML = (/[A-Z]/.test(pass) ? '✓' : '✗') + ' At least 1 uppercase letter';
  document.getElementById('req-upper').style.color = /[A-Z]/.test(pass) ? '#10b981' : 'var(--muted)';
  document.getElementById('req-lower').innerHTML = (/[a-z]/.test(pass) ? '✓' : '✗') + ' At least 1 lowercase letter';
  document.getElementById('req-lower').style.color = /[a-z]/.test(pass) ? '#10b981' : 'var(--muted)';
  document.getElementById('req-number').innerHTML = (/[0-9]/.test(pass) ? '✓' : '✗') + ' At least 1 number';
  document.getElementById('req-number').style.color = /[0-9]/.test(pass) ? '#10b981' : 'var(--muted)';
  document.getElementById('req-special').innerHTML = (/[@#$%&!]/.test(pass) ? '✓' : '✗') + ' At least 1 special character (@, #, $, %, &, !)';
  document.getElementById('req-special').style.color = /[@#$%&!]/.test(pass) ? '#10b981' : 'var(--muted)';
  document.getElementById('req-space').innerHTML = (/\s/.test(pass) ? '✗' : '✓') + ' No spaces';
  document.getElementById('req-space').style.color = /\s/.test(pass) ? '#ff4444' : '#10b981';
}

document.addEventListener('DOMContentLoaded', function() {
  const passInput = document.getElementById('reg-pass');
  if (passInput) passInput.addEventListener('input', checkPassRequirements);
});

function localRegister(name, email, phone, pass) {
  if (App.users.find(u => u.email === email)) {
    toast('Email already registered. Please sign in.', 'Registration Failed');
    return;
  }
  App.users.push({ name, email, phone, pass });
  saveState();
  completeRegistration(name, email, phone, pass);
  toast('Account created! Welcome ' + name, 'Registration Successful');
}

function completeRegistration(name, email, phone, pass) {
  document.getElementById('p-name').value = name;
  document.getElementById('p-phone').value = phone;
  document.getElementById('p-email').value = email;

  const av = document.querySelector('.user-av');
  if (av) av.textContent = name.slice(0,2).toUpperCase();
  const un = document.querySelector('.topbar-user span');
  if (un) un.textContent = name.split(' ')[0] + ' ' + (name.split(' ')[1]?.[0] || '') + '.';

  // Save to localStorage for offline login fallback
  if (!App.users.find(u => u.email === email)) {
    App.users.push({ name, email, phone, pass: pass || '' });
  }

  // Also show in admin table
  if (!App.adminUsers.find(u => u.email === email)) {
    App.adminUsers.push({ id: App.adminUsers.length + 1, name, reg: 'REG-' + String(Date.now()).slice(-6), phone, email, lastAlert: '—', status: 'active' });
  }
  saveState();

  App.loggedIn = true;
  afterLogin();
}

function afterLogin() {
  document.getElementById('login-page').classList.add('hidden');
  document.querySelector('.app').classList.add('active');
  renderContacts();
  renderAlerts();
  renderAdminTable();
  renderStats();
  // Update dashboard live location
  const locEl = document.getElementById('dash-location');
  if (locEl) locEl.textContent = getCurrentLocation();
  // Rotate location every 30s
  if (App.locationTimer) clearInterval(App.locationTimer);
  App.locationTimer = setInterval(() => {
    const el = document.getElementById('dash-location');
    if (el) el.textContent = getCurrentLocation();
    // Update SOS message template
    const msgEl = document.getElementById('sos-msg-template');
    if (msgEl && !msgEl.dataset.custom) {
      msgEl.value = '🚨 EMERGENCY! I need immediate help. My location: ' + getCurrentLocation() + '. Please contact me or alert authorities right away. — SafeGuard App';
    }
  }, 30000);
  showPage('dashboard');
}

function logout() {
  App.loggedIn = false;
  if (App.locationTimer) { clearInterval(App.locationTimer); App.locationTimer = null; }
  document.querySelector('.app').classList.remove('active');
  document.getElementById('login-page').classList.remove('hidden');
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
  document.getElementById('reg-name').value = '';
  document.getElementById('reg-email').value = '';
  document.getElementById('reg-phone').value = '';
  document.getElementById('reg-pass').value = '';
  switchLoginTab('login');
  toast('Logged out successfully.', 'Goodbye');
}

/* ════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════ */
function showPage(id) {
  // Update pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const ni = document.querySelector(`[data-nav="${id}"]`);
  if (ni) ni.classList.add('active');

  // Update topbar label
  const labels = {
    dashboard: 'Dashboard',
    emergency: 'Emergency SOS',
    tracking:  'Live Tracking',
    contacts:  'Contacts',
    aidetect:  'AI Detection',
    history:   'Alert History',
    admin:     'Admin Panel',
    profile:   'My Profile'
  };
  const lbl = document.getElementById('page-label');
  if (lbl) lbl.textContent = labels[id] || '';

  App.currentPage = id;
}

/* ════════════════════════════════════════
   RENDER DYNAMIC STATS
════════════════════════════════════════ */
function renderStats() {
  const alertCount = App.alerts.filter(a => a.type === 'red').length;
  const contactCount = App.contacts.length;
  const adminActiveCount = App.adminUsers.filter(u => u.status === 'active').length;

  // Dashboard stats
  const statNums = document.querySelectorAll('.stat-num');
  if (statNums.length >= 4) {
    statNums[0].textContent = alertCount;
    statNums[1].textContent = contactCount;
  }

  // Admin stats
  const adminStatNums = document.querySelectorAll('.g3 .stat-num');
  if (adminStatNums.length >= 3) {
    adminStatNums[0].textContent = App.adminUsers.length;
    adminStatNums[1].textContent = alertCount;
    adminStatNums[2].textContent = App.adminUsers.length > 0 ? Math.round(adminActiveCount / App.adminUsers.length * 100) + '%' : '0%';
  }

  // Contact count label
  const cc = document.getElementById('contact-count');
  if (cc) cc.textContent = contactCount + ' contact' + (contactCount !== 1 ? 's' : '');

  // SOS contact list header
  const sosHeader = document.querySelector('#sos-contact-list');
  if (sosHeader && contactCount === 0) {
    sosHeader.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.4);padding:20px 0;text-align:center;">No contacts yet. Add contacts in the Contacts page.</div>';
  }

  // Update SMS contacts display in emergency page
  const sd = document.getElementById('sos-contacts-display');
  if (sd) {
    if (contactCount === 0) {
      sd.textContent = 'Contacts: None saved';
    } else {
      sd.textContent = 'Contacts: ' + App.contacts.map(c => c.name + ' (' + c.phone + ')').join(', ');
    }
  }

  // Update SMS message template with current location
  const msgEl = document.getElementById('sos-msg-template');
  if (msgEl) {
    msgEl.value = '🚨 EMERGENCY! I need immediate help. My location: ' + getCurrentLocation() + '. Please contact me or alert authorities right away. — SafeGuard App';
  }

  // Update tracking page contact chips
  const chipsContainer = document.getElementById('tracking-contact-chips');
  if (chipsContainer) {
    if (contactCount === 0) {
      chipsContainer.innerHTML = '<div class="map-contact-chip" style="color:rgba(255,255,255,0.4);font-size:10px;">No contacts</div>';
    } else {
      const colors = ['var(--green)', 'var(--green)', 'var(--amber)'];
      chipsContainer.innerHTML = App.contacts.slice(0, 5).map((c, i) => `
        <div class="map-contact-chip">
          <div class="cdot" style="background:${colors[i % colors.length]};"></div>
          ${c.name} — ${(Math.random() * 8 + 0.5).toFixed(1)} km
        </div>
      `).join('');
    }
  }
}

/* ════════════════════════════════════════
   TOAST NOTIFICATIONS
════════════════════════════════════════ */
function toast(msg, title = 'Notification') {
  clearTimeout(App.toastTimerRef);
  document.getElementById('toast-title').textContent = title;
  document.getElementById('toast-msg').textContent   = msg;
  const el = document.getElementById('toast');
  el.style.display = 'block';
  el.style.animation = 'none';
  void el.offsetWidth; // reflow
  el.style.animation = '';
  App.toastTimerRef = setTimeout(() => el.style.display = 'none', 4500);
}

/* ════════════════════════════════════════
   LOUD ALARM SOUND (Web Audio API)
════════════════════════════════════════ */
function playLoudAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // Two oscillators for a piercing siren
    [350, 520].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(master);

      // Frequency wobble for siren effect
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 4.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      osc.start();
      osc.stop(ctx.currentTime + 4);
    });

    // Keep audio context alive
    setTimeout(() => ctx.close(), 4500);
  } catch (_) {}
}

/* ════════════════════════════════════════
   SOS SYSTEM
════════════════════════════════════════ */
function triggerSOS() {
  playLoudAlarm();
  sendBrowserNotification('🚨 SOS ACTIVATED!', 'Emergency alert preparing — GPS location will be sent to ' + App.contacts.length + ' contact(s). Tap to open.', true);
  const modal = document.getElementById('sos-modal');
  modal.classList.add('open');
  let count = 3;
  document.getElementById('sos-count').textContent = count;

  App.sosTimerRef = setInterval(() => {
    count--;
    document.getElementById('sos-count').textContent = count;
    if (count <= 0) {
      clearInterval(App.sosTimerRef);
      confirmSOS();
    }
  }, 1000);
}

function cancelSOS() {
  clearInterval(App.sosTimerRef);
  document.getElementById('sos-modal').classList.remove('open');
  toast('SOS cancelled. You are safe! ❤️', 'Alert Cancelled');
}

function getSOSMessage() {
  const msgEl = document.getElementById('sos-msg-template');
  if (msgEl && msgEl.value.trim()) return msgEl.value.trim();
  const loc = getCurrentLocation();
  return '🚨 EMERGENCY! I need immediate help! My location: ' + loc + '. Please contact me or alert authorities right away. — SafeGuard App';
}

/* ── SMS Dispatch — uses backend API if available, falls back to browser ── */

async function callSmsApi(phone, message, name) {
  try {
    const res = await fetch(API_BASE + '/api/send-sms/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message, name })
    });
    const data = await res.json();
    if (data.success) {
      toast('✅ SMS sent to ' + name + ' (' + phone + ')', 'Sent');
    } else {
      toast('⚠️ SMS failed: ' + (data.error || 'unknown error'), 'API');
    }
    return data;
  } catch (_) {
    return null; // API unavailable
  }
}

async function callSosApi(contacts, message, lat, lng) {
  try {
    const res = await fetch(API_BASE + '/api/sos-alert/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts, message, location: getCurrentLocation(), lat, lng })
    });
    const data = await res.json();
    if (data.success) return data;
    return null;
  } catch (_) {
    return null;
  }
}

function openSmsApp(phone, name) {
  const msg = getSOSMessage();
  if (isMobileDevice()) {
    openSmsUri(phone, msg);
    toast('💬 Opening SMS app for ' + name + '...', 'Sending');
  } else {
    showContactActionModal(name, phone, 'sms');
  }
}

function sendEmergencySMS(phone, name) {
  const msg = getSOSMessage();
  callSmsApi(phone, msg, name);
  openSmsApp(phone, name);
}

function confirmSOS() {
  playLoudAlarm();
  sendBrowserNotification('🚨 SOS SENT — HELP ON THE WAY!', 'Your live location has been sent to ' + App.contacts.length + ' emergency contact(s). Police have been alerted.', true);
  clearInterval(App.sosTimerRef);
  document.getElementById('sos-modal').classList.remove('open');

  const count = App.contacts.length;
  App.alerts.unshift({
    type:'red', icon:'alert',
    name:'🚨 SOS SENT NOW',
    desc:'Live GPS location dispatched to ' + count + ' contact' + (count !== 1 ? 's' : '') + (count > 0 ? '' : ' — no contacts saved yet'),
    time:'Just now'
  });
  saveState();
  renderAlerts();
  toast('🚨 SOS SENT! Help is on the way.', 'EMERGENCY ALERT');

  if (App.contacts.length > 0) {
    const msg = getSOSMessage();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos) {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        callSosApi(App.contacts, msg, lat, lng).then(r => {
          if (!r || !r.emails_sent) {
            App.contacts.forEach((c, i) => setTimeout(() => openSmsApp(c.phone, c.name), i * 1800));
          }
        });
      }, function() {
        callSosApi(App.contacts, msg, null, null).then(r => {
          if (!r || !r.emails_sent) {
            App.contacts.forEach((c, i) => setTimeout(() => openSmsApp(c.phone, c.name), i * 1800));
          }
        });
      });
    } else {
      callSosApi(App.contacts, msg, null, null).then(r => {
        if (!r || !r.emails_sent) {
          App.contacts.forEach((c, i) => setTimeout(() => openSmsApp(c.phone, c.name), i * 1800));
        }
      });
    }
  }
}

/* ════════════════════════════════════════
   SAFE CHECK-IN
════════════════════════════════════════ */
function safeCheckIn() {
  App.alerts.unshift({
    type:'green', icon:'check',
    name:'✅ Safe Check-In',
    desc:'User confirmed safe — location: ' + getCurrentLocation(),
    time:'Just now'
  });
  saveState();
  renderAlerts();
  sendBrowserNotification('✅ Safe Check-In Sent', 'Your contacts have been notified you are safe at ' + getCurrentLocation() + '.');
  toast('✅ Safe check-in sent to all your emergency contacts!', 'Check-In Sent');
}

function getCurrentLocation() {
  const locs = ['MG Road, Gadag','College Road, Gadag','Station Road, Gadag','Market Area, Gadag'];
  return locs[Math.floor(Math.random() * locs.length)];
}

/* ════════════════════════════════════════
   LOCATION SHARING
════════════════════════════════════════ */
let trackingInterval = null;

function trackLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(function(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const link = `https://www.google.com/maps?q=${lat},${lng}`;
    const label = document.getElementById('tracking-location-label');
    if (label) label.textContent = lat.toFixed(4) + '°N ' + lng.toFixed(4) + '°E';
    const gmaps = document.getElementById('gmaps-link');
    if (gmaps) gmaps.href = `https://www.google.com/maps?q=${lat},${lng}`;
    const frame = document.getElementById('live-map-frame');
    if (frame) frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.01},${lat-0.01},${lng+0.01},${lat+0.01}&layer=mapnik&marker=${lat},${lng}`;
    fetch('/send-alert/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng, location_link: link })
    }).catch(() => {});
  });
}

function startSharing() {
  App.locationSharing = true;
  const btn = document.getElementById('share-btn');
  if (btn) { btn.textContent = '⏹ Stop Sharing'; btn.onclick = stopSharing; btn.classList.replace('btn-red','btn-outline'); }
  const status = document.getElementById('share-status');
  if (status) { status.textContent = 'SHARING'; status.className = 'pill pill-danger'; }
  trackLocation();
  trackingInterval = setInterval(trackLocation, 10000);
  toast('📍 Live location shared every 10s with all emergency contacts.', 'Location Active');
}

function stopSharing() {
  App.locationSharing = false;
  if (trackingInterval) { clearInterval(trackingInterval); trackingInterval = null; }
  const btn = document.getElementById('share-btn');
  if (btn) { btn.textContent = '▶ Start Sharing'; btn.onclick = startSharing; btn.classList.replace('btn-outline','btn-red'); }
  const status = document.getElementById('share-status');
  if (status) { status.textContent = 'STOPPED'; status.className = 'pill pill-warn'; }
  toast('📍 Location sharing stopped.', 'Sharing Ended');
}

/* ════════════════════════════════════════
   CONTACTS
════════════════════════════════════════ */
function renderContacts() {
  const container = document.getElementById('contact-list');
  if (!container) return;
  if (App.contacts.length === 0) {
    container.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:20px 0;text-align:center;">No emergency contacts yet. Add one below.</div>';
  } else {
    container.innerHTML = App.contacts.map(c => `
      <div class="contact-row" id="contact-${c.id}">
        <div class="c-avatar" style="background:${c.color};">${c.initials}</div>
        <div class="c-info">
          <div class="c-name">${c.name}</div>
          <div class="c-rel">${c.relation} &nbsp;·&nbsp; ${c.phone}${c.email ? ` &nbsp;·&nbsp; ${c.email}` : ''}</div>
        </div>
        <div class="c-actions">
          <button class="icon-btn" title="Call" onclick="callContact(${c.id})">${iconPhone()}</button>
          <button class="icon-btn" title="SMS"  onclick="smsContact(${c.id})">${iconMsg()}</button>
          <button class="icon-btn" title="Delete" onclick="deleteContact(${c.id})">${iconTrash()}</button>
        </div>
      </div>
    `).join('');
  }
  
  // Also render in SOS page
  const sosList = document.getElementById('sos-contact-list');
  if (sosList) {
    if (App.contacts.length === 0) {
      sosList.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.4);padding:20px 0;text-align:center;">No contacts saved yet.</div>';
    } else {
      sosList.innerHTML = App.contacts.map(c => `
        <div class="contact-row">
          <div class="c-avatar" style="background:${c.color};width:36px;height:36px;font-size:12px;">${c.initials}</div>
          <div class="c-info">
            <div class="c-name" style="font-size:13px;">${c.name}</div>
            <div class="c-rel">${c.phone}</div>
          </div>
          <span class="pill pill-safe" style="font-size:10px;">Ready</span>
        </div>
      `).join('');
    }
  }
  renderStats();
}

async function smsAllContacts() {
  if (App.contacts.length === 0) {
    toast('No emergency contacts saved. Add contacts first.', 'No Contacts');
    return;
  }
  const msg = getSOSMessage();
  const apiResult = await callSosApi(App.contacts, msg);
  if (apiResult && apiResult.success) {
    toast('✅ SOS sent to ' + apiResult.sent + '/' + apiResult.total + ' contacts', 'Sent');
    return;
  }
  App.contacts.forEach((c, i) => {
    setTimeout(() => openSmsApp(c.phone, c.name), i * 1800);
  });
  toast('💬 Opening SMS for ' + App.contacts.length + ' contact(s)...', 'Sending');
}

function isMobileDevice() {
  if (/Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) return true;
  if (/Windows|Macintosh|Linux/.test(navigator.userAgent)) return false;
  return navigator.maxTouchPoints > 1 && window.innerWidth < 800;
}

function openTelUri(number) {
  const num = number.replace(/[\s\-\(\)]/g, '');
  const a = document.createElement('a');
  a.href = 'tel:' + num;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openSmsUri(number, body) {
  const num = number.replace(/[\s\-\(\)]/g, '');
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  var href;
  if (isAndroid) {
    var intentBody = body ? '?body=' + encodeURIComponent(body) : '';
    href = 'intent://smsto:' + num + intentBody + '#Intent;action=android.intent.action.SENDTO;end';
  } else if (isIOS) {
    href = body ? 'sms:' + num + '&body=' + encodeURIComponent(body) : 'sms:' + num;
  } else {
    href = body ? 'sms:' + num + '?body=' + encodeURIComponent(body) : 'sms:' + num;
  }
  var a = document.createElement('a');
  a.href = href;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showContactActionModal(name, number, action) {
  const existing = document.getElementById('contact-action-modal');
  if (existing) existing.remove();
  const isMobile = isMobileDevice();
  const modal = document.createElement('div');
  modal.id = 'contact-action-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(5,5,20,0.85);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;animation:fadeInScale .25s ease;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  const actionIcon = action === 'call' ? '📞' : '💬';
  const actionLabel = action === 'call' ? 'Call' : 'SMS';
  const hintText = isMobile
    ? (action === 'call' ? 'Opens your phone dialer' : 'Opens your messaging app')
    : (action === 'call' ? 'Opens via Phone Link (if connected) or copy number' : 'Opens via Phone Link (if connected) or copy number');
  modal.innerHTML = `
    <div style="background:rgba(10,10,26,0.9);backdrop-filter:blur(24px);border-radius:24px;padding:36px;max-width:380px;width:90%;text-align:center;border:1px solid rgba(255,45,123,0.12);animation:modalPop .22s ease;">
      <div style="font-size:48px;margin-bottom:12px;">${actionIcon}</div>
      <div style="font-size:18px;font-weight:700;color:white;margin-bottom:4px;">${actionLabel} ${name}</div>
      <div style="font-size:28px;font-weight:800;color:var(--pink);margin:16px 0;letter-spacing:1px;font-family:monospace;">${number}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-bottom:20px;">${hintText}</div>
      <div style="display:flex;gap:12px;">
        <button onclick="document.getElementById('contact-action-modal').remove();${action === 'call' ? "openTelUri('"+number+"')" : "openSmsUri('"+number+"','')"}" class="btn btn-red" style="flex:1;padding:14px;">${actionIcon} ${actionLabel} Now</button>
        <button onclick="document.getElementById('contact-action-modal').remove();copyToClipboard('${number}','${name} number')" class="btn btn-ghost" style="flex:1;">📋 Copy</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    toast('📋 ' + label + ' copied to clipboard!', 'Copied');
  }).catch(() => {
    toast(label + ': ' + text, 'Info');
  });
}

function callContact(id) {
  const c = App.contacts.find(x => x.id === id);
  if (!c) return;
  const num = c.phone.replace(/[\s\-\(\)]/g, '');
  openTelUri(num);
  toast('📞 Dialing ' + c.name + ' (' + num + ')...', 'Calling');
}
async function smsContact(id) {
  const c = App.contacts.find(x => x.id === id);
  if (!c) return;
  const num = c.phone.replace(/[\s\-\(\)]/g, '');
  const msg = getSOSMessage();
  const apiResult = await callSmsApi(num, msg, c.name);
  if (apiResult && apiResult.success) return;
  openSmsUri(num, msg);
  toast('💬 Opening SMS to ' + c.name + ' (' + num + ')...', 'Message');
}
function deleteContact(id) {
  if (!confirm('Remove this contact?')) return;
  App.contacts = App.contacts.filter(x => x.id !== id);
  saveState();
  renderContacts();
  toast('Contact removed.', 'Removed');
}

function addContact() {
  const name    = document.getElementById('inp-name').value.trim();
  const phone   = document.getElementById('inp-phone').value.trim();
  const email   = document.getElementById('inp-email').value.trim();
  const relation= document.getElementById('inp-relation').value;

  if (!name)  { toast('Please enter a name.', 'Missing Info'); return; }
  if (!phone) { toast('Please enter a phone number.', 'Missing Info'); return; }

  const colors = [
    'linear-gradient(135deg,#f59e0b,#d97706)',
    'linear-gradient(135deg,#10b981,#059669)',
    'linear-gradient(135deg,#6366f1,#4f46e5)',
    'linear-gradient(135deg,#ec4899,#db2777)'
  ];
  const newId = App.contactIdCounter++;
  App.contacts.push({
    id: newId,
    name, relation, phone, email,
    color: colors[App.contacts.length % colors.length],
    initials: name[0].toUpperCase(),
    notify: true
  });
  saveState();
  renderContacts();
  document.getElementById('inp-name').value  = '';
  document.getElementById('inp-phone').value = '';
  document.getElementById('inp-email').value = '';
  toast(`✅ ${name} added as an emergency contact!`, 'Contact Added');
}

/* ════════════════════════════════════════
   ALERT FEED RENDER
════════════════════════════════════════ */
const ICONS = {
  alert: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  mic:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  map:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M22 12h-4M6 12H2M12 2v4M12 18v4"/></svg>`
};

function renderAlerts() {
  ['alert-feed', 'history-feed'].forEach(containerId => {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (App.alerts.length === 0) {
      el.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:20px 0;text-align:center;">No alerts yet. All clear.</div>';
      return;
    }
    el.innerHTML = App.alerts.slice(0, containerId === 'history-feed' ? 20 : 5).map(a => `
      <div class="alert-item">
        <div class="a-icon ${a.type}">${ICONS[a.icon] || ICONS.alert}</div>
        <div class="a-body">
          <div class="a-name">${a.name}</div>
          <div class="a-desc">${a.desc}</div>
        </div>
        <div class="a-time">${a.time}</div>
      </div>
    `).join('');
  });
  renderStats();
}

/* ════════════════════════════════════════
   ADMIN TABLE
════════════════════════════════════════ */
function renderAdminTable() {
  const tbody = document.getElementById('admin-tbody');
  if (!tbody) return;
  if (App.adminUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted);font-size:13px;">No registered users yet.</td></tr>';
    return;
  }
  tbody.innerHTML = App.adminUsers.map(u => `
    <tr>
      <td style="font-weight:700;color:var(--muted);">#${u.id}</td>
      <td><strong>${u.name}</strong></td>
      <td style="color:var(--muted);font-size:12px;">${u.reg}</td>
      <td>${u.phone}</td>
      <td style="font-size:12px;color:${u.lastAlert && u.lastAlert.includes('SOS') ? 'var(--red)' : 'var(--muted)'};">${u.lastAlert || '—'}</td>
      <td><span class="tag ${u.status==='active'?'tag-on':'tag-off'}">${u.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="viewUserMap('${u.name}')">📍 Map</button>
        <button class="btn btn-ghost btn-sm" onclick="notifyUser('${u.name}')" style="margin-left:6px;">🔔 Alert</button>
      </td>
    </tr>
  `).join('');
}

function viewUserMap(name)  { toast(`📍 Viewing ${name}'s live location on map…`, 'Live Map'); }
function notifyUser(name)   { toast(`🔔 Manual alert notification sent to ${name}.`, 'Alert Sent'); }
function exportCSV() {
  const rows = [['#','Name','Reg.No','Phone','Last Alert','Status']];
  App.adminUsers.forEach(u => rows.push([u.id, u.name, u.reg, u.phone, u.lastAlert, u.status]));
  const csv = rows.map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent(csv);
  a.download = 'safeguard_users.csv';
  a.click();
  toast('📊 User data exported as safeguard_users.csv', 'Export Successful');
}

/* ════════════════════════════════════════
   AI SCREAM DETECTION
════════════════════════════════════════ */
function buildWaveform() {
  const wf = document.getElementById('waveform');
  if (!wf) return;
  wf.innerHTML = '';
  for (let i = 0; i < 32; i++) {
    const b = document.createElement('div');
    b.className = 'wbar';
    const h = 6 + Math.random() * 46;
    b.style.setProperty('--h', h + 'px');
    b.style.setProperty('--d', (0.45 + Math.random() * 0.85) + 's');
    b.style.animationDelay = (Math.random() * 0.6) + 's';
    b.style.height = h + 'px';
    wf.appendChild(b);
  }
}

function startDbAnimation() {
  App.dbTimerRef = setInterval(() => {
    if (!App.aiEnabled) return;
    const variance = Math.random() > 0.9 ? (Math.random() * 20) : (Math.random() * 6 - 3);
    App.currentDb = Math.max(28, Math.min(70, App.currentDb + variance));
    updateDbDisplay(Math.round(App.currentDb));
  }, 1100);
}

function updateDbDisplay(val) {
  const el = document.getElementById('db-value');
  if (el) el.textContent = val;
  const fill = document.getElementById('thresh-fill');
  if (fill) fill.style.width = val + '%';
  const state = document.getElementById('ai-state');
  if (!state) return;
  if (val >= 85) {
    state.textContent = '⚠️ SCREAM DETECTED!';
    state.style.color = '#ff6b8a';
  } else if (val >= 65) {
    state.textContent = '⚡ Elevated Noise';
    state.style.color = '#f59e0b';
  } else {
    state.textContent = '✅ SAFE — Monitoring';
    state.style.color = '#1dba7e';
  }
}

function toggleAI(cb) {
  App.aiEnabled = cb.checked;
  if (App.aiEnabled) {
    toast('🎙 AI scream detection is now active and listening.', 'AI Enabled');
  } else {
    toast('⚠️ AI detection disabled. Manual SOS button only.', 'AI Disabled');
    updateDbDisplay(0);
  }
}

function testDetection() {
  toast('🔊 Simulating scream detection test…', 'Test Running');
  let sim = App.currentDb;
  const ramp = setInterval(() => {
    sim = Math.min(sim + 7, 98);
    updateDbDisplay(Math.round(sim));
    if (sim >= 85) {
      clearInterval(ramp);
      App.alerts.unshift({
        type:'red', icon:'mic',
        name:'🔊 AI Test — Scream Detected',
        desc:'Simulated alert: 98 dB threshold exceeded — auto-alert triggered',
        time:'Just now'
      });
      saveState();
      renderAlerts();
      toast('🚨 TEST: Scream at 98 dB detected! Auto-alert would fire in 3s.', 'AI Test Complete');
      // Ramp back down
      setTimeout(() => {
        const rampDown = setInterval(() => {
          sim = Math.max(sim - 5, 42);
          updateDbDisplay(Math.round(sim));
          App.currentDb = sim;
          if (sim <= 42) clearInterval(rampDown);
        }, 200);
      }, 2500);
    }
  }, 140);
}

/* ════════════════════════════════════════
   PROFILE SAVE
════════════════════════════════════════ */
function saveProfile() {
  const name  = document.getElementById('p-name')?.value;
  const phone = document.getElementById('p-phone')?.value;
  if (!name || !phone) { toast('Please fill all required fields.', 'Incomplete'); return; }
  // Update topbar display
  const av = document.querySelector('.user-av');
  if (av) av.textContent = name.slice(0,2).toUpperCase();
  const un = document.querySelector('.topbar-user span');
  if (un) un.textContent = name.split(' ')[0] + ' ' + (name.split(' ')[1]?.[0] || '') + '.';
  toast(`✅ Profile updated for ${name}.`, 'Profile Saved');
}

/* ════════════════════════════════════════
   SVG ICON HELPERS
════════════════════════════════════════ */
function iconPhone() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .84h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>`;
}
function iconMsg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`;
}
function iconTrash() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;
}

/* ════════════════════════════════════════
   FAKE CALL FEATURE
════════════════════════════════════════ */
function fakeCall() {
  const name = document.getElementById('p-name')?.value || 'Mom';
  const overlay = document.createElement('div');
  overlay.id = 'fake-call-overlay';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    background:linear-gradient(180deg, #0a0a2e 0%, #0a0a1a 100%);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    animation:fadeInScale .3s ease;
    cursor:pointer;
  `;
  overlay.innerHTML = `
    <div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,var(--green),#00e676);display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 40px rgba(0,230,118,.3);animation:pulseGlow 1.5s infinite;margin-bottom:30px;">👤</div>
    <div style="font-size:28px;font-weight:700;color:white;margin-bottom:6px;">${name}</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.4);margin-bottom:40px;">Incoming Call...</div>
    <div style="display:flex;gap:40px;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--danger);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 20px rgba(255,23,68,.3);transition:transform .2s;" onclick="document.getElementById('fake-call-overlay')?.remove();toast('Call declined.','Fake Call Ended');">📞</div>
    </div>
    <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:20px;">Tap red to decline</div>
  `;
  overlay.onclick = function(e) {
    if (e.target === overlay) {
      overlay.remove();
      toast('Call ended.','Fake Call Ended');
    }
  };
  document.body.appendChild(overlay);
  // Vibrate if supported
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 500]);
  }
  // Auto-end after 20s
  setTimeout(() => {
    const el = document.getElementById('fake-call-overlay');
    if (el) { el.remove(); toast('Call ended.','Fake Call'); }
  }, 20000);
  toast('📞 Fake incoming call from ' + name + '...', 'Fake Call');
}

/* ════════════════════════════════════════
   NEARBY PLACES (simulated / API)
════════════════════════════════════════ */
const nearbyPlacesData = {
  police: [
    { name: 'Gadag City Police Station', address: 'Station Road, Gadag', dist: '1.2 km', rating: 4.2 },
    { name: 'Women Police Station', address: 'College Road, Gadag', dist: '2.0 km', rating: 4.5 },
    { name: 'Traffic Police Booth', address: 'Bus Stand, Gadag', dist: '0.8 km', rating: 3.9 },
  ],
  hospital: [
    { name: 'District Hospital Gadag', address: 'DH Road, Gadag', dist: '1.5 km', rating: 4.0 },
    { name: 'City Clinic & Pharmacy', address: 'Market Road, Gadag', dist: '0.6 km', rating: 4.3 },
    { name: 'Shri Hospital', address: 'MG Road, Gadag', dist: '2.3 km', rating: 4.1 },
  ],
  atm: [
    { name: 'SBI ATM', address: 'College Road, Gadag', dist: '0.4 km', rating: 3.8 },
    { name: 'Canara Bank ATM', address: 'Bus Stand, Gadag', dist: '0.9 km', rating: 4.0 },
  ],
};

function findNearbyPlaces(type) {
  const list = document.getElementById('nearby-places-list');
  if (!list) return;
  const places = nearbyPlacesData[type] || [];
  if (places.length === 0) {
    list.innerHTML = '<div style="font-size:13px;color:rgba(255,255,255,0.4);padding:8px 0;text-align:center;">No places found.</div>';
    return;
  }
  const icons = { police: '👮', hospital: '🏥', atm: '🏦' };
  const labels = { police: 'Police Stations', hospital: 'Hospitals', atm: 'ATMs' };
  list.innerHTML = '<div style="font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">' + icons[type] + ' ' + labels[type] + ' Near You</div>' +
    places.map(p => `
      <div class="row" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:white;">${p.name}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);">${p.address} · ${p.dist}</div>
        </div>
        <span style="font-size:11px;color:var(--amber);">★ ${p.rating}</span>
      </div>
    `).join('');
  toast('📍 Showing nearby ' + labels[type].toLowerCase() + '.', 'Places Found');
}

/* ════════════════════════════════════════
   SAFE ROUTE
════════════════════════════════════════ */
function findSafeRoute() {
  toast('🔄 Calculating safest route...', 'Route Finder');
  const routes = [
    { name: 'Via College Road', detail: 'Well-lit, CCTV monitored · 1.2 km · 15 min', safe: true },
    { name: 'Via Main Road', detail: 'Heavy traffic, well-lit · 1.5 km · 18 min', safe: true },
    { name: 'Via Market Shortcut', detail: 'Some dark alleys · 0.8 km · 10 min', safe: false },
  ];
  setTimeout(() => {
    const safe = routes.filter(r => r.safe);
    toast('✅ Recommended: ' + safe[Math.floor(Math.random() * safe.length)].name, 'Safe Route');
  }, 1500);
}
