// ===== auth.js =====
// Version CORRIGÉE - Redirection après inscription vers formulaire de connexion

(function() {
  // ---------------------------------------------
  // CONFIGURATION SUPABASE
  // ---------------------------------------------
  const SUPABASE_URL = 'https://tzavppzbxlzpprxfwpxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YXZwcHpieGx6cHByeGZ3cHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDIxNzksImV4cCI6MjA4OTAxODE3OX0.wU_-9UeAkKLO6HpESMt7ZRJVUrTq0Lk3sjDzOYLjUhg';

  // ---------------------------------------------
  // ÉTAT INTERNE
  // ---------------------------------------------
  let supabase = null;
  let currentMode = 'login';

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const tabLogin = document.getElementById('tabLogin');
  const tabSignup = document.getElementById('tabSignup');
  const formLogin = document.getElementById('formLogin');
  const formSignup = document.getElementById('formSignup');
  const forgotLink = document.getElementById('forgotPassword');
  const forgotModal = document.getElementById('forgotModal');
  const cancelReset = document.getElementById('cancelReset');
  const sendReset = document.getElementById('sendReset');
  const resetEmail = document.getElementById('resetEmail');

  // ---------------------------------------------
  // INITIALISATION
  // ---------------------------------------------
  async function init() {
    try {
      // Attendre le chargement du DOM
      await waitForDom();
      
      // Initialiser Supabase
      await initSupabase();
      
      // Vérifier session existante
      await checkExistingSession();

      // Initialiser les événements
      setupEventListeners();

    } catch (error) {
      console.warn('Mode démo - Supabase non disponible');
      // Continuer en mode démo
      setupEventListeners();
    }
  }

  // ---------------------------------------------
  // ATTENDRE QUE LE DOM SOIT PRÊT
  // ---------------------------------------------
  function waitForDom() {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  // ---------------------------------------------
  // INITIALISATION SUPABASE
  // ---------------------------------------------
  async function initSupabase() {
    // Vérifier si Supabase est déjà disponible
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return;
    }

    // Sinon, charger le script
    await loadSupabaseScript();
    
    // Vérifier que le chargement a fonctionné
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase non disponible');
    }
    
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  // ---------------------------------------------
  // CHARGEMENT DYNAMIQUE SUPABASE
  // ---------------------------------------------
  function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      // Éviter les doublons
      if (document.querySelector('script[src*="supabase"]')) {
        // Attendre que le script existant soit chargé
        const checkInterval = setInterval(() => {
          if (window.supabase) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        
        // Timeout après 5 secondes
        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error('Timeout chargement Supabase'));
        }, 5000);
        
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => {
        // Vérifier que le script a bien chargé la librairie
        if (window.supabase) {
          resolve();
        } else {
          reject(new Error('Supabase chargé mais non disponible'));
        }
      };
      script.onerror = () => reject(new Error('Erreur chargement Supabase'));
      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------
  // VÉRIFICATION SESSION EXISTANTE
  // ---------------------------------------------
  async function checkExistingSession() {
    if (!supabase) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Si déjà connecté, rediriger vers index.html (connecté)
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.log('Pas de session active');
    }
  }

  // ---------------------------------------------
  // INITIALISATION ÉCOUTEURS
  // ---------------------------------------------
  function setupEventListeners() {
    // Vérifier que les éléments existent
    if (!tabLogin || !tabSignup || !formLogin || !formSignup) {
      console.error('Éléments DOM manquants');
      return;
    }

    tabLogin.addEventListener('click', () => switchTab('login'));
    tabSignup.addEventListener('click', () => switchTab('signup'));

    formLogin.addEventListener('submit', handleLogin);
    formSignup.addEventListener('submit', handleSignup);

    if (forgotLink) {
      forgotLink.addEventListener('click', openForgotModal);
    }

    if (cancelReset) {
      cancelReset.addEventListener('click', closeForgotModal);
    }

    if (sendReset) {
      sendReset.addEventListener('click', handlePasswordReset);
    }

    if (forgotModal) {
      // Fermer avec Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !forgotModal.classList.contains('hidden')) {
          closeForgotModal();
        }
      });

      // Fermer en cliquant dehors
      forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) {
          closeForgotModal();
        }
      });
    }

    // Vérifier les paramètres URL
    checkUrlParams();
  }

  // ---------------------------------------------
  // CHANGEMENT D'ONGLET
  // ---------------------------------------------
  function switchTab(mode) {
    currentMode = mode;
    
    if (mode === 'login') {
      tabLogin.classList.add('active');
      tabSignup.classList.remove('active');
      formLogin.classList.remove('hidden');
      formSignup.classList.add('hidden');
    } else {
      tabSignup.classList.add('active');
      tabLogin.classList.remove('active');
      formSignup.classList.remove('hidden');
      formLogin.classList.add('hidden');
    }
  }

  // ---------------------------------------------
  // VALIDATION EMAIL
  // ---------------------------------------------
  function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // ---------------------------------------------
  // GESTION ERREURS
  // ---------------------------------------------
  function showError(element, message) {
    clearError(element);
    
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    errorEl.style.color = '#ff7e9f';
    errorEl.style.fontSize = '0.8rem';
    errorEl.style.marginTop = '0.3rem';
    errorEl.style.paddingLeft = '1rem';
    
    element.parentElement.appendChild(errorEl);
  }

  function clearError(element) {
    const errorEl = element.parentElement.querySelector('.error-message');
    if (errorEl) {
      errorEl.remove();
    }
  }

  // ---------------------------------------------
  // CONNEXION
  // ---------------------------------------------
  async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail');
    const password = document.getElementById('loginPassword');

    if (!email || !password) return;

    clearError(email);
    clearError(password);

    // Validation
    let hasError = false;

    if (!email.value.trim()) {
      showError(email, 'Email requis');
      hasError = true;
    } else if (!isValidEmail(email.value.trim())) {
      showError(email, 'Email invalide');
      hasError = true;
    }

    if (!password.value) {
      showError(password, 'Mot de passe requis');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Connexion...';

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.value.trim(),
          password: password.value
        });

        if (error) throw error;
        
        // Succès → rediriger vers index.html (mode connecté)
        window.location.href = 'index.html';
      } else {
        // Mode démo
        setTimeout(() => {
          alert('Mode démo: Connexion réussie');
          window.location.href = 'index.html';
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur connexion:', error);
      showError(password, 'Email ou mot de passe incorrect');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // INSCRIPTION
  // ---------------------------------------------
  async function handleSignup(e) {
    e.preventDefault();

    const firstname = document.getElementById('signupFirstname');
    const lastname = document.getElementById('signupLastname');
    const email = document.getElementById('signupEmail');
    const password = document.getElementById('signupPassword');
    const confirm = document.getElementById('signupConfirm');
    const terms = document.getElementById('acceptTerms');

    [firstname, lastname, email, password, confirm].forEach(field => {
      if (field) clearError(field);
    });

    let hasError = false;

    if (firstname && !firstname.value.trim()) {
      showError(firstname, 'Prénom requis');
      hasError = true;
    }

    if (lastname && !lastname.value.trim()) {
      showError(lastname, 'Nom requis');
      hasError = true;
    }

    if (email && !email.value.trim()) {
      showError(email, 'Email requis');
      hasError = true;
    } else if (email && !isValidEmail(email.value.trim())) {
      showError(email, 'Email invalide');
      hasError = true;
    }

    if (password && !password.value) {
      showError(password, 'Mot de passe requis');
      hasError = true;
    }

    if (password && confirm && password.value !== confirm.value) {
      showError(confirm, 'Les mots de passe ne correspondent pas');
      hasError = true;
    }

    if (terms && !terms.checked) {
      alert('Vous devez accepter les conditions d\'utilisation');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création...';

    try {
      if (supabase) {
        const { error } = await supabase.auth.signUp({
          email: email.value.trim(),
          password: password.value,
          options: {
            data: {
              first_name: firstname?.value.trim() || '',
              last_name: lastname?.value.trim() || ''
            }
          }
        });

        if (error) throw error;

        // ✅ NOUVEAU COMPORTEMENT :
        // Afficher un message invitant à vérifier ses emails
        alert('✅ Compte créé avec succès ! Un email de vérification vous a été envoyé. Veuillez vérifier votre boîte de réception puis vous connecter.');
        
        // Basculer vers l'onglet de connexion
        switchTab('login');
        
        // Pré-remplir l'email pour faciliter la connexion
        const loginEmail = document.getElementById('loginEmail');
        if (loginEmail && email) {
          loginEmail.value = email.value.trim();
        }
        
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        
      } else {
        // Mode démo
        setTimeout(() => {
          alert('Mode démo: Inscription réussie (sans vérification email)');
          window.location.href = 'index.html';
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur inscription:', error);
      if (email) showError(email, error.message || 'Erreur inscription');
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // MODALE RÉINITIALISATION
  // ---------------------------------------------
  function openForgotModal(e) {
    e.preventDefault();
    if (forgotModal) {
      forgotModal.classList.remove('hidden');
      setTimeout(() => resetEmail?.focus(), 100);
    }
  }

  function closeForgotModal() {
    if (forgotModal) {
      forgotModal.classList.add('hidden');
      if (resetEmail) {
        resetEmail.value = '';
        clearError(resetEmail);
      }
    }
  }

  async function handlePasswordReset() {
    if (!resetEmail) return;

    clearError(resetEmail);

    if (!resetEmail.value.trim()) {
      showError(resetEmail, 'Email requis');
      return;
    }

    if (!isValidEmail(resetEmail.value.trim())) {
      showError(resetEmail, 'Email invalide');
      return;
    }

    const originalText = sendReset.textContent;
    sendReset.disabled = true;
    sendReset.textContent = 'Envoi...';

    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(
          resetEmail.value.trim()
        );

        if (error) throw error;

        alert('Email de réinitialisation envoyé ! Vérifiez votre boîte de réception.');
        closeForgotModal();
      } else {
        // Mode démo
        setTimeout(() => {
          alert('Mode démo: Email de réinitialisation envoyé');
          closeForgotModal();
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur:', error);
      showError(resetEmail, error.message || 'Erreur envoi');
      sendReset.disabled = false;
      sendReset.textContent = originalText;
    }
  }

  // ---------------------------------------------
  // PARAMÈTRES URL
  // ---------------------------------------------
  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'login') {
      switchTab('login');
    } else if (mode === 'signup') {
      switchTab('signup');
    }
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();