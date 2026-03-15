// ===== index.js =====
// VERSION FINALE - Toutes les corrections appliquées

(function() {
  // ---------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------
  const SUPABASE_URL = 'https://tzavppzbxlzpprxfwpxx.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YXZwcHpieGx6cHByeGZ3cHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDIxNzksImV4cCI6MjA4OTAxODE3OX0.wU_-9UeAkKLO6HpESMt7ZRJVUrTq0Lk3sjDzOYLjUhg';

  // ---------------------------------------------
  // ÉTAT INTERNE
  // ---------------------------------------------
  let currentUser = null;
  let allFiles = [];
  let supabase = null;
  let favorisList = [];
  let currentPreviewFile = null;
  let deleteInProgress = false;
  
  // État multi-sélection
  let selectionMode = false;
  let selectedFiles = new Set();
  let longPressTimer = null;
  const LONG_PRESS_DELAY = 1000; // 1 seconde
  
  // Cache session
  let sessionCache = {
    timestamp: null,
    user: null
  };
  
  let activeFilters = {
    audio: false, image: false, video: false, pdf: false,
    word: false, excel: false, powerpoint: false, texte: false,
    html: false, css: false, javascript: false, php: false,
    python: false, java: false, ruby: false, json: false,
    sql: false, archive: false, autre: false
  };
  
  let uploadState = {
    active: false,
    totalFiles: 0,
    completedFiles: 0,
    totalSize: 0,
    uploadedSize: 0,
    startTime: null,
    speeds: [],
    failedFiles: []
  };

  // ---------------------------------------------
  // ÉLÉMENTS DOM
  // ---------------------------------------------
  const loadingOverlay = document.getElementById('loadingOverlay');
  const syncLoader = document.getElementById('syncLoader');
  const deleteLoader = document.getElementById('deleteLoader');
  const mainContent = document.getElementById('mainContent');
  const searchContainer = document.getElementById('searchContainer');
  const searchInput = document.getElementById('searchInput');
  const multiSelectActions = document.getElementById('multiSelectActions');
  const selectCount = document.getElementById('selectCount');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
  const cancelSelectBtn = document.getElementById('cancelSelectBtn');
  const logoLink = document.getElementById('logoLink');
  const settingsBtn = document.getElementById('settingsBtn');
  const fabContainer = document.getElementById('fabContainer');
  const uploadBtn = document.getElementById('uploadBtn');
  const authButtons = document.getElementById('authButtons');
  const statsRow = document.getElementById('statsRow');
  
  // Overlay
  const fileOverlay = document.getElementById('fileOverlay');
  const overlayBackdrop = document.getElementById('overlayBackdrop');
  const overlayFilename = document.getElementById('overlayFilename');
  const overlayContent = document.getElementById('overlayContent');
  const overlayMetadata = document.getElementById('overlayMetadata');
  const overlayDownload = document.getElementById('overlayDownload');
  const overlayFavorite = document.getElementById('overlayFavorite');
  const overlayShare = document.getElementById('overlayShare');
  const overlayDelete = document.getElementById('overlayDelete');
  const overlayFullscreen = document.getElementById('overlayFullscreen');
  const overlayClose = document.getElementById('overlayClose');
  
  // ---------------------------------------------
// PARTAGE DE FICHIER (AVEC SQL)
// ---------------------------------------------
// Remplacer ta fonction shareFile par :

async function shareFile(file) {
    // Utiliser notre nouvelle fonction de partage
    await window.shortlink.partagerFichier(file);
}
// ============================================
// GÉNÉRATION DE LIENS COURTS
// ============================================

// Générer un ID court aléatoire
function genererIdCourt(longueur = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < longueur; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Créer un lien court pour un fichier
async function creerLienCourt(file, options = {}) {
  try {
    const {
      expirationHeures = null,
      maxVues = null,
      longueurCode = 6
    } = options

    // Générer un ID unique (vérifier qu'il n'existe pas)
    let idCourt
    let existe = true
    
    while (existe) {
      idCourt = genererIdCourt(longueurCode)
      const { data } = await supabase
        .from('liens_courts')
        .select('id')
        .eq('id', idCourt)
        .single()
      
      existe = !!data
    }

    // Calculer date d'expiration si demandée
    let dateExpiration = null
    if (expirationHeures) {
      dateExpiration = new Date()
      dateExpiration.setHours(dateExpiration.getHours() + expirationHeures)
    }

    // Insérer dans la base
    const { error } = await supabase
      .from('liens_courts')
      .insert({
        id: idCourt,
        chemin_storage: file.chemin_storage,
        nom_fichier: file.nom,
        user_id: currentUser?.id,
        date_expiration: dateExpiration,
        max_vues: maxVues,
        vues: 0,
        actif: true
      })

    if (error) throw error

    // URL du lien court
    const lienCourt = `${window.location.origin}/lien/${idCourt}`
    
    return {
      success: true,
      id: idCourt,
      url: lienCourt,
      expiration: dateExpiration,
      maxVues
    }

  } catch (error) {
    console.error('Erreur création lien court:', error)
    return { success: false, error: error.message }
  }
}

// Modifier la fonction shareFile pour proposer les liens courts
async function shareFile(file) {
  try {
    // Demander à l'utilisateur les options
    const useShortLink = confirm('🔗 Créer un lien court sécurisé ?\n\nOK = Lien court sécurisé\nAnnuler = Partage direct')
    
    if (useShortLink) {
      // Options du lien
      const heures = prompt('Durée de validité en heures (laisser vide pour illimité) :', '24')
      const maxVues = prompt('Nombre max de vues (laisser vide pour illimité) :', '')
      
      const result = await creerLienCourt(file, {
        expirationHeures: heures ? parseInt(heures) : null,
        maxVues: maxVues ? parseInt(maxVues) : null
      })
      
      if (!result.success) throw new Error(result.error)
      
      // Partage du lien court
      if (navigator.share) {
        await navigator.share({
          title: file.nom,
          text: `📁 Fichier partagé (lien sécurisé)`,
          url: result.url
        })
      } else {
        await navigator.clipboard.writeText(result.url)
        alert(`✅ Lien court copié !\n\n${result.url}\n\nValide pour ${heures || 'illimité'}h, ${maxVues || 'illimité'} vues`)
      }
      
    } else {
      // Partage direct (méthode actuelle)
      const { publicUrl } = supabase.storage
        .from(file.bucket || 'fichiers')
        .getPublicUrl(file.chemin_storage).data
      
      if (navigator.share) {
        await navigator.share({
          title: file.nom,
          text: 'Fichier partagé depuis Mégane Cloud',
          url: publicUrl
        })
      } else {
        await navigator.clipboard.writeText(publicUrl)
        alert('✅ Lien copié !')
      }
    }
    
  } catch (error) {
    console.error('Erreur partage:', error)
    alert('❌ Erreur lors du partage')
  }
}
  // ---------------------------------------------
  // INITIALISATION ACCÉLÉRÉE
  // ---------------------------------------------
  async function init() {
    try {
      await waitForDom();
      
      // Vérification session avec timeout
      const sessionPromise = initSupabase().then(() => checkSession());
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));
      
      await Promise.race([sessionPromise, timeoutPromise]);
      
      setupOverlayListeners();
      setupMultiSelectListeners();
      
    } catch (error) {
      console.warn('Mode démo - Affichage invité');
      updateHeaderForGuest();
      renderGuestMode();
    } finally {
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
      }, 300);
    }
  }

  function waitForDom() {
    return new Promise(resolve => {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', resolve);
      } else {
        resolve();
      }
    });
  }

  async function initSupabase() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return;
    }
    await loadSupabaseScript();
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      throw new Error('Supabase non disponible');
    }
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  function loadSupabaseScript() {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="supabase"]')) {
        const checkInterval = setInterval(() => {
          if (window.supabase) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 50);
        setTimeout(() => reject(new Error('Timeout')), 5000);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = () => window.supabase ? resolve() : reject();
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // ---------------------------------------------
  // GESTION HEADER
  // ---------------------------------------------
  function updateHeaderForGuest() {
    if (searchContainer) searchContainer.style.display = 'none';
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (authButtons) authButtons.style.display = 'flex';
    if (fabContainer) fabContainer.style.display = 'none';
  }

  function updateHeaderForConnected() {
    if (searchContainer) searchContainer.style.display = 'block';
    if (settingsBtn) settingsBtn.style.display = 'flex';
    if (authButtons) authButtons.style.display = 'none';
    if (fabContainer) fabContainer.style.display = 'flex';
  }

  // ---------------------------------------------
  // VÉRIFICATION SESSION (accélérée)
  // ---------------------------------------------
  async function checkSession() {
    try {
      if (!supabase) throw new Error('Supabase non initialisé');
      
      // Vérifier le cache
      if (sessionCache.timestamp && (Date.now() - sessionCache.timestamp < 30000)) {
        currentUser = sessionCache.user;
        if (currentUser) {
          updateHeaderForConnected();
          loadUserFiles();
          loadFavoris();
          return;
        }
      }
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      currentUser = user;
      sessionCache = {
        timestamp: Date.now(),
        user: user
      };
      
      if (currentUser) {
        updateHeaderForConnected();
        await Promise.all([loadUserFiles(), loadFavoris()]);
      } else {
        updateHeaderForGuest();
        renderGuestMode();
      }
    } catch (error) {
      console.error('Erreur session:', error);
      updateHeaderForGuest();
      renderGuestMode();
    }
  }

  // ---------------------------------------------
  // FAVORIS PERSISTANTS
  // ---------------------------------------------
  async function loadFavoris() {
    if (!currentUser || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('favoris')
        .select('fichier_id')
        .eq('user_id', currentUser.id);
      if (error) throw error;
      favorisList = data.map(f => f.fichier_id);
    } catch (error) {
      console.error('Erreur chargement favoris:', error);
      favorisList = [];
    }
  }

  async function toggleFavorite(file) {
    try {
      const estFavori = favorisList.includes(file.id);
      
      if (estFavori) {
        const { error } = await supabase
          .from('favoris')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('fichier_id', file.id);
        if (error) throw error;
        favorisList = favorisList.filter(id => id !== file.id);
      } else {
        const { error } = await supabase
          .from('favoris')
          .insert({ user_id: currentUser.id, fichier_id: file.id });
        if (error) throw error;
        favorisList.push(file.id);
      }
      
      // Mise à jour de l'overlay si ouvert
      if (currentPreviewFile && currentPreviewFile.id === file.id) {
        updateOverlayFavoriteButton(!estFavori);
      }
      
      renderConnectedMode();
    } catch (error) {
      console.error('Erreur favori:', error);
      alert('Erreur lors de la mise à jour du favori');
    }
  }

  function updateOverlayFavoriteButton(isFavori) {
    if (overlayFavorite) {
      overlayFavorite.innerHTML = `<i class="fas ${isFavori ? 'fa-star' : 'fa-star'}"></i>`;
      overlayFavorite.style.color = isFavori ? '#ff7e9f' : '';
      overlayFavorite.title = isFavori ? 'Retirer des favoris' : 'Ajouter aux favoris';
    }
  }

  // ---------------------------------------------
  // TÉLÉCHARGEMENT FORCÉ (BLOB)
  // ---------------------------------------------
  async function forceDownload(file) {
    if (!file) return;
    
    try {
      showNotification(`Préparation de ${file.nom}...`);
      
      const { data: urlData } = supabase.storage
        .from(file.bucket || 'fichiers')
        .getPublicUrl(file.chemin_storage);
      
      const response = await fetch(urlData.publicUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.nom;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
      
    } catch (error) {
      console.error('Erreur téléchargement:', error);
      alert(`Erreur lors du téléchargement de ${file.nom}`);
    }
  }

  // ---------------------------------------------
  // SÉLECTION MULTIPLE
  // ---------------------------------------------
  function enterSelectionMode(fileId) {
    if (selectionMode) return;
    
    selectionMode = true;
    selectedFiles.clear();
    selectedFiles.add(fileId);
    
    // Masquer recherche, afficher barre multi-sélection
    if (searchContainer) searchContainer.classList.add('hidden');
    if (multiSelectActions) {
      multiSelectActions.classList.remove('hidden');
      updateSelectCount();
    }
    
    updateSelectedFilesUI();
  }

  function exitSelectionMode() {
    selectionMode = false;
    selectedFiles.clear();
    
    // Réafficher recherche, cacher barre multi-sélection
    if (searchContainer) searchContainer.classList.remove('hidden');
    if (multiSelectActions) multiSelectActions.classList.add('hidden');
    
    updateSelectedFilesUI();
  }

  function toggleSelectFile(fileId) {
    if (!selectionMode) return;
    
    if (selectedFiles.has(fileId)) {
      selectedFiles.delete(fileId);
    } else {
      selectedFiles.add(fileId);
    }
    
    updateSelectCount();
    updateSelectedFilesUI();
    
    // Sortir si plus rien sélectionné
    if (selectedFiles.size === 0) {
      exitSelectionMode();
    }
  }

  function updateSelectCount() {
    if (selectCount) {
      const count = selectedFiles.size;
      selectCount.textContent = count === 1 ? '1 sélectionné' : `${count} sélectionnés`;
    }
  }

  function updateSelectedFilesUI() {
    document.querySelectorAll('.file-item').forEach(item => {
      const fileId = item.dataset.id;
      if (selectionMode && selectedFiles.has(fileId)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  async function downloadSelected() {
    if (selectedFiles.size === 0) return;
    
    for (const fileId of selectedFiles) {
      const file = allFiles.find(f => f.id === fileId);
      if (file) await forceDownload(file);
    }
    
    exitSelectionMode();
  }

  async function deleteSelected() {
    if (selectedFiles.size === 0) return;
    
    const confirmMsg = selectedFiles.size === 1 
      ? 'Supprimer ce fichier ?' 
      : `Supprimer ces ${selectedFiles.size} fichiers ?`;
    
    if (!confirm(confirmMsg)) return;
    
    showDeleteLoader(`${selectedFiles.size} fichiers`);
    
    for (const fileId of selectedFiles) {
      const file = allFiles.find(f => f.id === fileId);
      if (file) {
        try {
          await supabase
            .from('fichiers')
            .update({ statut: 'corbeille' })
            .eq('id', file.id);
        } catch (error) {
          console.error('Erreur suppression:', file.nom, error);
        }
      }
    }
    
    hideDeleteLoader();
    
    // Recharger les fichiers
    allFiles = allFiles.filter(f => !selectedFiles.has(f.id));
    renderConnectedMode();
    exitSelectionMode();
  }

  function setupMultiSelectListeners() {
    if (downloadSelectedBtn) {
      downloadSelectedBtn.addEventListener('click', downloadSelected);
    }
    
    if (deleteSelectedBtn) {
      deleteSelectedBtn.addEventListener('click', deleteSelected);
    }
    
    if (cancelSelectBtn) {
      cancelSelectBtn.addEventListener('click', exitSelectionMode);
    }
    
    if (logoLink) {
      logoLink.addEventListener('click', (e) => {
        if (selectionMode) {
          e.preventDefault();
          exitSelectionMode();
        }
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && selectionMode) {
        exitSelectionMode();
      }
    });
  }

  // ---------------------------------------------
  // LOADER SUPPRESSION
  // ---------------------------------------------
  function showDeleteLoader(filename) {
    const loader = document.getElementById('deleteLoader');
    const textEl = loader?.querySelector('.delete-loader-text');
    if (textEl) textEl.textContent = `Suppression ${filename}...`;
    if (loader) loader.classList.remove('hidden');
  }

  function hideDeleteLoader() {
    const loader = document.getElementById('deleteLoader');
    if (loader) loader.classList.add('hidden');
  }

  // ---------------------------------------------
  // NOTIFICATION
  // ---------------------------------------------
  function showNotification(message) {
    let notif = document.getElementById('temp-notification');
    if (!notif) {
      notif = document.createElement('div');
      notif.id = 'temp-notification';
      notif.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 10px 20px;
        border-radius: 30px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        z-index: 10000;
        border: 2px solid #ff7e9f;
      `;
      document.body.appendChild(notif);
    }
    notif.innerHTML = `<i class="fas fa-download" style="color:#ff7e9f"></i> ${message}`;
    setTimeout(() => notif.remove(), 2000);
  }

  // ---------------------------------------------
  // CHARGEMENT FICHIERS
  // ---------------------------------------------
  async function loadUserFiles() {
    if (!mainContent || !currentUser || !supabase) return;
    try {
      if (loadingOverlay) loadingOverlay.classList.remove('hidden');
      const { data: files, error } = await supabase
        .from('fichiers')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('statut', 'actif')
        .order('date_upload', { ascending: false });
      if (error) throw error;
      allFiles = files || [];
      resetFilters();
      renderConnectedMode();
    } catch (error) {
      console.error('Erreur chargement:', error);
      mainContent.innerHTML = '<div class="error-message">Erreur de chargement</div>';
    } finally {
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  }

  function resetFilters() {
    activeFilters = {
      audio: false, image: false, video: false, pdf: false,
      word: false, excel: false, powerpoint: false, texte: false,
      html: false, css: false, javascript: false, php: false,
      python: false, java: false, ruby: false, json: false,
      sql: false, archive: false, autre: false
    };
  }

  // ---------------------------------------------
  // TYPE DE FICHIER
  // ---------------------------------------------
  function getFileType(file) {
    const mime = file.type_mime || '';
    const ext = file.nom?.split('.').pop()?.toLowerCase() || '';
    
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return 'video';
    if (mime.includes('pdf') || ext === 'pdf') return 'pdf';
    if (mime.includes('word') || ['doc', 'docx'].includes(ext)) return 'word';
    if (mime.includes('sheet') || mime.includes('excel') || ['xls', 'xlsx'].includes(ext)) return 'excel';
    if (mime.includes('presentation') || ['ppt', 'pptx'].includes(ext)) return 'powerpoint';
    if (mime.includes('text') || ['txt', 'md', 'rtf'].includes(ext)) return 'texte';
    if (ext === 'html' || ext === 'htm') return 'html';
    if (ext === 'css') return 'css';
    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) return 'javascript';
    if (ext === 'php') return 'php';
    if (ext === 'py') return 'python';
    if (ext === 'java') return 'java';
    if (ext === 'rb') return 'ruby';
    if (ext === 'json') return 'json';
    if (ext === 'sql') return 'sql';
    if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(ext)) return 'archive';
    return 'autre';
  }

  // ---------------------------------------------
  // STATS
  // ---------------------------------------------
  function calculateStats() {
    const stats = {
      audio: 0, image: 0, video: 0, pdf: 0, word: 0, excel: 0,
      powerpoint: 0, texte: 0, html: 0, css: 0, javascript: 0,
      php: 0, python: 0, java: 0, ruby: 0, json: 0, sql: 0,
      archive: 0, autre: 0
    };
    allFiles.forEach(file => {
      const type = getFileType(file);
      if (stats.hasOwnProperty(type)) stats[type]++; else stats.autre++;
    });
    return stats;
  }

  function renderStats(stats) {
    if (!statsRow) return;
    const statsConfig = [
      { type: 'audio', icon: 'fa-music' }, { type: 'image', icon: 'fa-image' },
      { type: 'video', icon: 'fa-video' }, { type: 'pdf', icon: 'fa-file-pdf' },
      { type: 'word', icon: 'fa-file-word' }, { type: 'excel', icon: 'fa-file-excel' },
      { type: 'powerpoint', icon: 'fa-file-powerpoint' }, { type: 'texte', icon: 'fa-file-lines' },
      { type: 'html', icon: 'fa-code' }, { type: 'css', icon: 'fa-css3' },
      { type: 'javascript', icon: 'fa-js' }, { type: 'php', icon: 'fa-php' },
      { type: 'python', icon: 'fa-python' }, { type: 'java', icon: 'fa-java' },
      { type: 'ruby', icon: 'fa-gem' }, { type: 'json', icon: 'fa-brackets-curly' },
      { type: 'sql', icon: 'fa-database' }, { type: 'archive', icon: 'fa-file-zipper' },
      { type: 'autre', icon: 'fa-file' }
    ];
    statsRow.innerHTML = statsConfig
      .filter(cfg => stats[cfg.type] > 0)
      .map(cfg => `
        <div class="stat-item ${activeFilters[cfg.type] ? 'active' : ''}" data-filter="${cfg.type}">
          <i class="fas ${cfg.icon}"></i><span class="stat-count">${stats[cfg.type]}</span>
        </div>
      `).join('');
    document.querySelectorAll('.stat-item').forEach(item => {
      item.addEventListener('click', () => toggleFilter(item.dataset.filter));
    });
  }

  function toggleFilter(type) {
    activeFilters[type] = !activeFilters[type];
    renderConnectedMode();
  }

  function getFilteredFiles() {
    const hasActiveFilter = Object.values(activeFilters).some(v => v);
    let filtered = allFiles;
    if (hasActiveFilter) {
      filtered = allFiles.filter(file => activeFilters[getFileType(file)] === true);
    }
    const term = searchInput?.value.toLowerCase().trim();
    if (term) filtered = filtered.filter(f => f.nom?.toLowerCase().includes(term));
    return filtered;
  }

  // ---------------------------------------------
  // RENDU CONNECTÉ
  // ---------------------------------------------
  // ---------------------------------------------
// RENDU MODE CONNECTÉ - VERSION CORRIGÉE
// ---------------------------------------------
function renderConnectedMode() {
  const stats = calculateStats();
  const filteredFiles = getFilteredFiles();
  const displayFiles = filteredFiles.length > 0 ? filteredFiles.slice(0, 20) : [];
  
  renderStats(stats);
  
  mainContent.innerHTML = `<div class="files-grid">${renderFilesGrid(displayFiles)}</div>`;
  
  // ✅ FORCER L'APPLICATION DES FAVORIS APRÈS RENDU
  setTimeout(() => {
    document.querySelectorAll('.file-item').forEach(item => {
      const fileId = item.dataset.id;
      if (favorisList.includes(fileId)) {
        item.classList.add('favori');
      }
    });
  }, 50);
  
  setupFileClickListeners();
  setupLongPressListeners();
}

  function renderFilesGrid(files) {
    if (!files.length) return '<div class="empty-state">Aucun fichier trouvé</div>';
    return files.map(file => {
      const estFavori = favorisList.includes(file.id);
      const { publicUrl } = supabase.storage
        .from(file.bucket || 'fichiers')
        .getPublicUrl(file.chemin_storage).data;
      return `
        <div class="file-item ${estFavori ? 'favori' : ''}" data-id="${file.id}" data-file='${JSON.stringify(file).replace(/'/g, "&apos;")}'>
          <div class="file-name-row" title="${file.nom}">${truncateName(file.nom)}</div>
          <div class="file-image-row">
            <div class="file-thumbnail-container">${getFileThumbnail(file, publicUrl)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function getFileThumbnail(file, url) {
    const type = getFileType(file);
    if (type === 'image') return `<img src="${url}" class="file-thumbnail" loading="lazy">`;
    if (type === 'video') return `
      <div class="video-thumbnail-wrapper">
        <video class="file-thumbnail" src="${url}" preload="metadata"></video>
        <div class="video-play-icon">▶</div>
      </div>`;
    const icon = getFileIcon(file);
    return `<i class="fas ${icon}"></i>`;
  }

  function getFileIcon(file) {
    const map = {
      'audio': 'fa-file-audio', 'image': 'fa-file-image', 'video': 'fa-file-video',
      'pdf': 'fa-file-pdf', 'word': 'fa-file-word', 'excel': 'fa-file-excel',
      'powerpoint': 'fa-file-powerpoint', 'texte': 'fa-file-lines', 'html': 'fa-code',
      'css': 'fa-css3', 'javascript': 'fa-js', 'php': 'fa-php', 'python': 'fa-python',
      'java': 'fa-java', 'ruby': 'fa-gem', 'json': 'fa-brackets-curly',
      'sql': 'fa-database', 'archive': 'fa-file-zipper'
    };
    return map[getFileType(file)] || 'fa-file';
  }

  // ---------------------------------------------
  // APPUI LONG POUR SÉLECTION MULTIPLE
  // ---------------------------------------------
  function setupLongPressListeners() {
    document.querySelectorAll('.file-item').forEach(item => {
      let pressTimer;
      
      item.addEventListener('mousedown', (e) => {
        if (e.button === 2 || selectionMode) return;
        pressTimer = setTimeout(() => {
          const fileId = item.dataset.id;
          enterSelectionMode(fileId);
        }, LONG_PRESS_DELAY);
      });
      
      item.addEventListener('mouseup', () => clearTimeout(pressTimer));
      item.addEventListener('mouseleave', () => clearTimeout(pressTimer));
      
      item.addEventListener('touchstart', (e) => {
        if (selectionMode) return;
        pressTimer = setTimeout(() => {
          const fileId = item.dataset.id;
          enterSelectionMode(fileId);
          if (navigator.vibrate) navigator.vibrate(50);
        }, LONG_PRESS_DELAY);
      }, { passive: true });
      
      item.addEventListener('touchend', () => clearTimeout(pressTimer));
      item.addEventListener('touchcancel', () => clearTimeout(pressTimer));
      item.addEventListener('touchmove', () => clearTimeout(pressTimer));
    });
  }

  function setupFileClickListeners() {
    document.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (selectionMode) {
          const fileId = item.dataset.id;
          toggleSelectFile(fileId);
        } else {
          const fileData = JSON.parse(item.dataset.file.replace(/&apos;/g, "'"));
          openFilePreview(fileData);
        }
      });
    });
  }

  // ---------------------------------------------
  // OVERLAY
  // ---------------------------------------------
  function openFilePreview(file) {
    currentPreviewFile = file;
    const estFavori = favorisList.includes(file.id);
    const { publicUrl } = supabase.storage
      .from(file.bucket || 'fichiers')
      .getPublicUrl(file.chemin_storage).data;
    
    overlayFilename.textContent = file.nom;
    renderPreviewContent(file, publicUrl);
    
    const date = new Date(file.date_upload);
    overlayMetadata.innerHTML = `
      <span><i class="fas fa-calendar"></i> ${date.toLocaleDateString('fr-FR')}</span>
      <span class="separator">•</span>
      <span><i class="fas fa-clock"></i> ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span class="separator">•</span>
      <span><i class="fas fa-weight-hanging"></i> ${formatFileSize(file.taille)}</span>
    `;
    
    updateOverlayFavoriteButton(estFavori);
    fileOverlay.classList.remove('hidden');
  }

  function renderPreviewContent(file, url) {
    const type = getFileType(file);
    let content = '';
    if (type === 'image') content = `<img src="${url}" class="overlay-image-preview">`;
    else if (type === 'video') content = `<video src="${url}" class="overlay-video-preview" controls autoplay></video>`;
    else if (type === 'audio') content = `<audio src="${url}" class="overlay-audio-preview" controls autoplay></audio>`;
    else if (type === 'pdf') content = `<iframe src="https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true" class="overlay-pdf-preview"></iframe>`;
    else content = `<i class="fas ${getFileIcon(file)} overlay-icon-preview"></i>`;
    overlayContent.innerHTML = content;
  }

  function closePreview() {
    fileOverlay.classList.add('hidden');
    overlayContent.innerHTML = '';
    currentPreviewFile = null;
  }

  function setupOverlayListeners() {
    if (overlayClose) overlayClose.addEventListener('click', closePreview);
    if (overlayBackdrop) overlayBackdrop.addEventListener('click', closePreview);
    
    if (overlayDownload) {
      overlayDownload.addEventListener('click', () => {
        if (currentPreviewFile) forceDownload(currentPreviewFile);
      });
    }
    
    if (overlayFavorite) {
      overlayFavorite.addEventListener('click', async () => {
        if (currentPreviewFile) await toggleFavorite(currentPreviewFile);
      });
    }
    
    if (overlayShare) {
      overlayShare.addEventListener('click', () => {
        if (currentPreviewFile) {
          const { publicUrl } = supabase.storage
            .from(currentPreviewFile.bucket || 'fichiers')
            .getPublicUrl(currentPreviewFile.chemin_storage).data;
          if (navigator.share) {
            navigator.share({ title: currentPreviewFile.nom, url: publicUrl }).catch(console.error);
          } else {
            navigator.clipboard.writeText(publicUrl);
            alert('Lien copié !');
          }
        }
      });
    }
    
    if (overlayDelete) {
      overlayDelete.addEventListener('click', async () => {
        if (currentPreviewFile && confirm(`Supprimer "${currentPreviewFile.nom}" ?`)) {
          showDeleteLoader(currentPreviewFile.nom);
          closePreview();
          try {
            await supabase
              .from('fichiers')
              .update({ statut: 'corbeille' })
              .eq('id', currentPreviewFile.id);
            allFiles = allFiles.filter(f => f.id !== currentPreviewFile.id);
            renderConnectedMode();
          } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Erreur lors de la suppression');
          } finally {
            hideDeleteLoader();
          }
        }
      });
    }
    
    if (overlayFullscreen) {
      overlayFullscreen.addEventListener('click', () => {
        if (currentPreviewFile) {
          const { publicUrl } = supabase.storage
            .from(currentPreviewFile.bucket || 'fichiers')
            .getPublicUrl(currentPreviewFile.chemin_storage).data;
          window.open(publicUrl, '_blank');
        }
      });
    }
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !fileOverlay.classList.contains('hidden')) closePreview();
    });
  }

  // ---------------------------------------------
  // UPLOAD
  // ---------------------------------------------
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '*/*';
      input.onchange = async (e) => {
        if (!currentUser) return alert('Connectez-vous');
        const files = Array.from(e.target.files);
        if (!files.length) return;
        
        uploadState = {
          active: true, totalFiles: files.length, completedFiles: 0,
          totalSize: files.reduce((a, f) => a + f.size, 0), uploadedSize: 0,
          startTime: Date.now(), speeds: [], failedFiles: []
        };
        
        if (syncLoader) syncLoader.classList.remove('hidden');
        
        for (const file of files) {
          try {
            const path = `${currentUser.id}/${Date.now()}_${file.name}`;
            await supabase.storage.from('fichiers').upload(path, file);
            await supabase.from('fichiers').insert({
              user_id: currentUser.id, nom: file.name,
              type_mime: file.type || 'application/octet-stream',
              taille: file.size, chemin_storage: path, bucket: 'fichiers', statut: 'actif'
            });
            uploadState.completedFiles++;
            uploadState.uploadedSize += file.size;
          } catch (error) {
            console.error('Erreur upload:', file.name, error);
            uploadState.completedFiles++;
            uploadState.failedFiles.push(file.name);
          }
        }
        
        if (syncLoader) syncLoader.classList.add('hidden');
        await loadUserFiles();
        await loadFavoris();
        if (uploadState.failedFiles.length) {
          alert(`${uploadState.failedFiles.length} fichier(s) en échec`);
        }
      };
      input.click();
    });
  }

  // ---------------------------------------------
  // RECHERCHE
  // ---------------------------------------------
  if (searchInput) {
    let timeout;
    searchInput.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => renderConnectedMode(), 300);
    });
  }

  // ---------------------------------------------
  // MODE INVITÉ
  // ---------------------------------------------
  function renderGuestMode() {
    if (statsRow) statsRow.innerHTML = '';
    mainContent.innerHTML = `
      <div class="guest-hero">
        <h1 class="guest-title">Mégane Cloud</h1>
        <p class="guest-subtitle">Votre coffre-fort numérique</p>
        <div class="guest-cta">
          <a href="auth.html?mode=signup" class="btn btn-primary">Créer un compte</a>
          <a href="auth.html?mode=login" class="btn btn-secondary">Se connecter</a>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------
  // UTILITAIRES
  // ---------------------------------------------
  function truncateName(name, max = 15) {
    if (!name || name.length <= max) return name;
    const dot = name.lastIndexOf('.');
    if (dot === -1) return name.slice(0, max - 3) + '...';
    const ext = name.slice(dot);
    const base = name.slice(0, dot);
    return base.slice(0, max - 3 - ext.length) + '...' + ext;
  }

  function formatFileSize(bytes) {
    if (!bytes) return '?';
    const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // ---------------------------------------------
  // DÉMARRAGE
  // ---------------------------------------------
  init();
})();