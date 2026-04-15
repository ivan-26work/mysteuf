// ===== SUPABASE CONFIG =====
const SUPABASE_URL  = 'https://fuulsbckqjzedtbimqaq.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1dWxzYmNrcWp6ZWR0YmltcWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNzA0NTgsImV4cCI6MjA5MTc0NjQ1OH0.g0vlcB0pdQZjmw6ax69dBCE40HlSCjBjT2QXzutYuPk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ===== DOM =====
const flipCard       = document.getElementById('flipCard');
const btnGoRegister  = document.getElementById('btn-go-register');
const btnGoLogin     = document.getElementById('btn-go-login');
const btnLogin       = document.getElementById('btn-login');
const btnRegister    = document.getElementById('btn-register');
const btnForgot      = document.getElementById('btn-forgot');
const btnCloseForgot = document.getElementById('btn-close-modal');
const btnSendReset   = document.getElementById('btn-send-reset');
const modalForgot    = document.getElementById('modal-forgot');

// ===== FLIP =====
let isFlipped = false;

btnGoRegister.addEventListener('click', () => setFlip(true));
btnGoLogin.addEventListener('click',    () => setFlip(false));

function setFlip(state) {
  isFlipped = state;
  flipCard.classList.toggle('flipped', isFlipped);
}

// ===== TOGGLE PASSWORD =====
document.querySelectorAll('.toggle-eye').forEach(btn => {
  btn.addEventListener('click', () => {
    const input   = document.getElementById(btn.dataset.target);
    const eyeShow = btn.querySelector('.eye-show');
    const eyeHide = btn.querySelector('.eye-hide');
    const isText  = input.type === 'text';
    input.type            = isText ? 'password' : 'text';
    eyeShow.style.display = isText ? ''     : 'none';
    eyeHide.style.display = isText ? 'none' : '';
  });
});

// ===== PASSWORD STRENGTH =====
document.getElementById('r-pw').addEventListener('input', function () {
  checkStrength(this.value);
  checkMatch();
});

document.getElementById('r-confirm').addEventListener('input', checkMatch);

function checkStrength(pw) {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const lvls = [
    { w: '0%',   c: 'transparent', t: '' },
    { w: '25%',  c: '#ef4444',     t: '🔴 Très faible' },
    { w: '50%',  c: '#f97316',     t: '🟠 Faible' },
    { w: '75%',  c: '#eab308',     t: '🟡 Moyen' },
    { w: '100%', c: '#22c55e',     t: '🟢 Fort' },
  ];
  const lvl = pw.length === 0 ? lvls[0] : (lvls[score] || lvls[1]);
  document.getElementById('s-fill').style.width      = lvl.w;
  document.getElementById('s-fill').style.background = lvl.c;
  document.getElementById('s-label').textContent     = lvl.t;
}

function checkMatch() {
  const pw   = document.getElementById('r-pw').value;
  const cfm  = document.getElementById('r-confirm').value;
  const icon = document.getElementById('match-icon');
  if (!cfm) { icon.textContent = ''; return; }
  icon.textContent = pw === cfm ? '✅' : '❌';
}

// ===== MODAL FORGOT PASSWORD =====
btnForgot.addEventListener('click', () => openModal());
btnCloseForgot.addEventListener('click', () => closeModal());
modalForgot.addEventListener('click', e => { if (e.target === modalForgot) closeModal(); });

function openModal() {
  modalForgot.classList.add('open');
  document.getElementById('forgot-email').focus();
}

function closeModal() {
  modalForgot.classList.remove('open');
  document.getElementById('forgot-email').value = '';
  setMsg('forgot-email-msg', '');
  clearAlert('forgot-alert');
}

btnSendReset.addEventListener('click', async () => {
  clearAlert('forgot-alert');
  setMsg('forgot-email-msg', '');

  const email = document.getElementById('forgot-email').value.trim();
  if (!isEmail(email)) {
    setMsg('forgot-email-msg', 'Entrez une adresse e-mail valide');
    return;
  }

  setLoading(btnSendReset, true);

  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/index.html'
  });

  setLoading(btnSendReset, false);

  if (error) {
    showAlert('forgot-alert', '❌ ' + translateError(error.message), 'error');
  } else {
    showAlert('forgot-alert', '✅ Lien envoyé ! Vérifiez votre boîte e-mail.', 'success');
    setTimeout(() => closeModal(), 3000);
  }
});

// ===== LOGIN =====
btnLogin.addEventListener('click', async () => {
  clearAlert('l-alert');
  setMsg('l-email-msg', '');
  setMsg('l-pw-msg', '');

  const email = document.getElementById('l-email').value.trim();
  const pw    = document.getElementById('l-pw').value;
  let valid   = true;

  if (!isEmail(email)) { setMsg('l-email-msg', 'E-mail invalide'); valid = false; }
  if (pw.length < 6)   { setMsg('l-pw-msg', 'Minimum 6 caractères'); valid = false; }
  if (!valid) return;

  setLoading(btnLogin, true);

  const { error } = await sb.auth.signInWithPassword({ email, password: pw });

  setLoading(btnLogin, false);

  if (error) {
    showAlert('l-alert', '❌ ' + translateError(error.message), 'error');
  } else {
    showAlert('l-alert', '✅ Connexion réussie ! Redirection...', 'success');
    setTimeout(() => window.location.href = 'index.html', 1200);
  }
});

// ===== REGISTER =====
btnRegister.addEventListener('click', async () => {
  clearAlert('r-alert');
  setMsg('r-email-msg', '');
  setMsg('r-pw-msg', '');
  setMsg('r-confirm-msg', '');

  const email   = document.getElementById('r-email').value.trim();
  const pw      = document.getElementById('r-pw').value;
  const confirm = document.getElementById('r-confirm').value;
  let valid     = true;

  if (!isEmail(email))  { setMsg('r-email-msg',   'E-mail invalide'); valid = false; }
  if (pw.length < 8)    { setMsg('r-pw-msg',      'Minimum 8 caractères'); valid = false; }
  if (pw !== confirm)   { setMsg('r-confirm-msg', 'Les mots de passe ne correspondent pas'); valid = false; }
  if (!valid) return;

  setLoading(btnRegister, true);

  const { error } = await sb.auth.signUp({ email, password: pw });

  setLoading(btnRegister, false);

  if (error) {
    showAlert('r-alert', '❌ ' + translateError(error.message), 'error');
  } else {
    showAlert('r-alert', '✅ Compte créé ! Vérifiez votre e-mail puis connectez-vous.', 'success');
    setTimeout(() => setFlip(false), 2800);
  }
});

// ===== REDIRECT IF ALREADY LOGGED IN =====
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) window.location.href = 'index.html';
})();

// ===== HELPERS =====
function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function setMsg(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className   = `alert show ${type}`;
}

function clearAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '';
  el.className   = 'alert';
}

function setLoading(btn, on) {
  const text    = btn.querySelector('.btn-text');
  const spinner = btn.querySelector('.spinner');
  btn.disabled          = on;
  text.style.display    = on ? 'none' : '';
  spinner.style.display = on ? 'inline-block' : 'none';
}

function translateError(msg) {
  const map = {
    'Invalid login credentials':        'E-mail ou mot de passe incorrect.',
    'Email not confirmed':              'Veuillez confirmer votre e-mail d\'abord.',
    'User already registered':          'Cet e-mail est déjà utilisé.',
    'Password should be at least 6':    'Le mot de passe est trop court.',
    'Unable to validate email address': 'Adresse e-mail invalide.',
    'For security purposes':            'Trop de tentatives. Attendez quelques secondes.',
  };
  for (const key in map) {
    if (msg.includes(key)) return map[key];
  }
  return msg;
}