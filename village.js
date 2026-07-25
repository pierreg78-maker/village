/**
 * Village.js — boîte à outils commune du Village enchanté
 * Version 0.1.0
 *
 * Usage :
 * <script src="https://raw.githubusercontent.com/pierreg78-maker/village/main/village.js"></script>
 *
 * Puis :
 * await Village.or.crediter(5, 'Blackjack');
 */
(function (global) {
  'use strict';

  const VERSION = '0.1.0';

  const config = {
    apiUrl: 'https://script.google.com/macros/s/AKfycbyh1LbQNETMy0GS7A5SzACTPMYlFEal9W3-XZozkwzIkAAUhlo_InN-5FOrI9eEqPoEeA/exec',
    villageUrl: 'https://pierreg78-maker.github.io/village/',
    cleProfil: 'vitrineProfilActif',
    dureeNotification: 3200,
    debug: false,
    sons: {}
  };

  function journal(...messages) {
    if (config.debug) console.log('[Village]', ...messages);
  }

  function entier(valeur, valeurParDefaut = 0) {
    const nombre = Number(valeur);
    return Number.isFinite(nombre) ? Math.trunc(nombre) : valeurParDefaut;
  }

  function texteNonVide(valeur, valeurParDefaut = '') {
    return typeof valeur === 'string' && valeur.trim()
      ? valeur.trim()
      : valeurParDefaut;
  }

  function formaterPieces(nombre) {
    const total = entier(nombre);
    return `${total} ${total === 1 ? 'pièce d’or' : 'pièces d’or'}`;
  }

  function attendre(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function lireProfilLocal() {
    try {
      const brut = localStorage.getItem(config.cleProfil);
      if (!brut) return null;

      const profil = JSON.parse(brut);
      if (!profil || !profil.id || !profil.prenom) return null;

      return {
        ...profil,
        piecesOr: entier(profil.piecesOr ?? profil.solde)
      };
    } catch (erreur) {
      journal('Profil local illisible :', erreur);
      try { localStorage.removeItem(config.cleProfil); } catch (_) {}
      return null;
    }
  }

  function sauvegarderProfilLocal(profil) {
    if (!profil || !profil.id || !profil.prenom) {
      throw new Error('Profil invalide.');
    }

    const profilLocal = {
      id: profil.id,
      prenom: profil.prenom,
      piecesOr: entier(profil.piecesOr ?? profil.solde),
      derniereMiseAJour: new Date().toISOString()
    };

    localStorage.setItem(config.cleProfil, JSON.stringify(profilLocal));
    emettre('village:profil', profilLocal);
    return profilLocal;
  }

  function mettreAJourSoldeLocal(nouveauSolde) {
    const profil = lireProfilLocal();
    if (!profil) return null;

    profil.piecesOr = entier(nouveauSolde);
    profil.derniereMiseAJour = new Date().toISOString();
    localStorage.setItem(config.cleProfil, JSON.stringify(profil));
    emettre('village:solde', profil);
    return profil;
  }

  function emettre(nom, detail) {
    try {
      document.dispatchEvent(new CustomEvent(nom, { detail }));
    } catch (_) {}
  }

  async function requeteGet(action, parametres = {}) {
    const url = new URL(config.apiUrl);
    url.searchParams.set('action', action);

    Object.entries(parametres).forEach(([cle, valeur]) => {
      if (valeur !== undefined && valeur !== null) {
        url.searchParams.set(cle, String(valeur));
      }
    });

    const reponse = await fetch(url, {
      method: 'GET',
      cache: 'no-store'
    });

    if (!reponse.ok) {
      throw new Error(`Serveur indisponible (${reponse.status}).`);
    }

    return reponse.json();
  }

  async function requetePost(donnees) {
    const reponse = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(donnees)
    });

    if (!reponse.ok) {
      throw new Error(`Serveur indisponible (${reponse.status}).`);
    }

    return reponse.json();
  }

  function verifierResultat(resultat, messageParDefaut) {
    if (!resultat || resultat.ok === false) {
      throw new Error(
        resultat?.erreur || resultat?.message || messageParDefaut
      );
    }
    return resultat;
  }

  function extraireSolde(resultat, profilActuel = null) {
    const candidats = [
      resultat?.piecesOr,
      resultat?.solde,
      resultat?.nouveauSolde,
      resultat?.profil?.piecesOr,
      resultat?.profil?.solde
    ];

    const trouve = candidats.find(valeur => Number.isFinite(Number(valeur)));
    if (trouve !== undefined) return entier(trouve);
    return profilActuel ? entier(profilActuel.piecesOr) : null;
  }

  function injecterStyles() {
    if (document.getElementById('village-js-styles')) return;

    const style = document.createElement('style');
    style.id = 'village-js-styles';
    style.textContent = `
      .village-notifications {
        position: fixed;
        z-index: 99999;
        top: 16px;
        left: 50%;
        width: min(420px, calc(100% - 24px));
        transform: translateX(-50%);
        display: grid;
        gap: 10px;
        pointer-events: none;
      }
      .village-notification {
        padding: 13px 16px;
        border-radius: 15px;
        color: #fff;
        font: 700 1rem/1.35 Arial, sans-serif;
        text-align: center;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        animation: village-entree .22s ease-out;
        pointer-events: auto;
      }
      .village-notification--info { background: #2d73c7; }
      .village-notification--succes { background: #2f7d50; }
      .village-notification--erreur { background: #b83b3b; }
      .village-notification--attente { background: #7a5c34; }
      .village-notification--sortie {
        opacity: 0;
        transform: translateY(-8px);
        transition: opacity .2s ease, transform .2s ease;
      }
      .village-retour {
        position: fixed;
        z-index: 9990;
        top: 12px;
        left: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 46px;
        padding: 8px 14px;
        border: 2px solid rgba(255,255,255,.7);
        border-radius: 999px;
        background: linear-gradient(#2d73c7, #1b4f97);
        color: #fff;
        text-decoration: none;
        font: 800 .92rem/1.1 Arial, sans-serif;
        box-shadow: 0 5px 14px rgba(0,0,0,.25);
      }
      .village-pluie-piece {
        position: fixed;
        z-index: 99998;
        top: -50px;
        pointer-events: none;
        font-size: 30px;
        animation: village-piece-tombe var(--duree, 1100ms) ease-in forwards;
      }
      @keyframes village-entree {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes village-piece-tombe {
        0% { transform: translateY(0) rotate(0); opacity: 0; }
        12% { opacity: 1; }
        100% { transform: translateY(calc(100vh + 100px)) rotate(540deg); opacity: 0; }
      }
      @media (max-width: 520px) {
        .village-retour {
          min-height: 42px;
          padding: 7px 11px;
          font-size: .82rem;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .village-notification,
        .village-pluie-piece { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function conteneurNotifications() {
    injecterStyles();
    let conteneur = document.querySelector('.village-notifications');
    if (!conteneur) {
      conteneur = document.createElement('div');
      conteneur.className = 'village-notifications';
      conteneur.setAttribute('aria-live', 'polite');
      conteneur.setAttribute('aria-atomic', 'true');
      document.body.appendChild(conteneur);
    }
    return conteneur;
  }

  function notifier(message, type = 'info', options = {}) {
    const texte = texteNonVide(message);
    if (!texte) return null;

    const element = document.createElement('div');
    element.className = `village-notification village-notification--${type}`;
    element.textContent = texte;
    element.setAttribute('role', type === 'erreur' ? 'alert' : 'status');

    const conteneur = conteneurNotifications();
    conteneur.appendChild(element);

    const duree = entier(options.duree, config.dureeNotification);
    if (duree > 0) {
      setTimeout(() => fermerNotification(element), duree);
    }

    return {
      element,
      fermer: () => fermerNotification(element),
      modifier: nouveauMessage => {
        element.textContent = texteNonVide(nouveauMessage, element.textContent);
      }
    };
  }

  function fermerNotification(element) {
    if (!element || !element.isConnected) return;
    element.classList.add('village-notification--sortie');
    setTimeout(() => element.remove(), 220);
  }

  function ajouterBoutonRetour(options = {}) {
    injecterStyles();

    const id = options.id || 'village-retour';
    const existant = document.getElementById(id);
    if (existant) return existant;

    const lien = document.createElement('a');
    lien.id = id;
    lien.className = options.classe || 'village-retour';
    lien.href = options.url || config.villageUrl;
    lien.textContent = options.texte || '🏘️ Retour au village';
    lien.setAttribute('aria-label', options.ariaLabel || 'Retour au village');

    (options.parent || document.body).appendChild(lien);
    return lien;
  }

  async function confirmer(message, options = {}) {
    const texte = texteNonVide(message, 'Confirmer cette action ?');
    if (typeof options.personnalisee === 'function') {
      return Boolean(await options.personnalisee(texte));
    }
    return global.confirm(texte);
  }

  const lecteursAudio = new Map();

  function enregistrerSon(nom, url) {
    const cle = texteNonVide(nom);
    const adresse = texteNonVide(url);
    if (!cle || !adresse) throw new Error('Nom ou URL de son invalide.');
    config.sons[cle] = adresse;
    lecteursAudio.delete(cle);
  }

  async function jouerSon(nom, options = {}) {
    const cle = texteNonVide(nom);
    const url = config.sons[cle];
    if (!url) {
      journal(`Son non configuré : ${cle}`);
      return false;
    }

    let audio = lecteursAudio.get(cle);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = 'auto';
      lecteursAudio.set(cle, audio);
    }

    audio.pause();
    audio.currentTime = 0;
    audio.volume = Math.max(0, Math.min(1, Number(options.volume ?? 1)));

    try {
      await audio.play();
      return true;
    } catch (erreur) {
      journal('Lecture audio bloquée :', erreur);
      return false;
    }
  }

  async function pluiePieces(nombre = 10, options = {}) {
    injecterStyles();
    const total = Math.max(1, Math.min(40, entier(nombre, 10)));
    const delai = entier(options.delai, 70);

    for (let i = 0; i < total; i += 1) {
      const piece = document.createElement('span');
      piece.className = 'village-pluie-piece';
      piece.textContent = options.symbole || '🪙';
      piece.style.left = `${5 + Math.random() * 90}vw`;
      piece.style.setProperty('--duree', `${900 + Math.random() * 700}ms`);
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 1800);
      if (delai > 0) await attendre(delai);
    }
  }

  async function transaction(type, montant, source = 'Jeu du Village', details = {}) {
    const profil = lireProfilLocal();
    if (!profil) {
      throw new Error('Aucun profil actif. Choisissez d’abord un joueur.');
    }

    const valeur = entier(montant);
    if (valeur <= 0) throw new Error('Le montant doit être supérieur à zéro.');

    const action = type === 'depense' ? 'depense' : 'gain';
    const donnees = {
      action,
      profilId: profil.id,
      id: profil.id,
      montant: valeur,
      source: texteNonVide(source, 'Jeu du Village'),
      ...details
    };

    const resultat = verifierResultat(
      await requetePost(donnees),
      action === 'gain'
        ? 'Le gain n’a pas pu être enregistré.'
        : 'La dépense n’a pas pu être enregistrée.'
    );

    let nouveauSolde = extraireSolde(resultat, profil);
    if (nouveauSolde === null) {
      nouveauSolde = action === 'gain'
        ? profil.piecesOr + valeur
        : profil.piecesOr - valeur;
    }

    const profilActualise = mettreAJourSoldeLocal(nouveauSolde);
    emettre('village:transaction', {
      action,
      montant: valeur,
      source: donnees.source,
      resultat,
      profil: profilActualise
    });

    return {
      ok: true,
      action,
      montant: valeur,
      solde: nouveauSolde,
      profil: profilActualise,
      resultat
    };
  }

  async function crediter(montant, source, details = {}) {
    return transaction('gain', montant, source, details);
  }

  async function debiter(montant, source, details = {}) {
    return transaction('depense', montant, source, details);
  }

  async function recompenser(montant, source, options = {}) {
    const attente = notifier(
      options.messageAttente || 'Enregistrement du gain…',
      'attente',
      { duree: 0 }
    );

    try {
      const resultat = await crediter(montant, source, options.details || {});
      attente?.fermer();

      if (options.son !== false) jouerSon(options.son || 'gain');
      if (options.animation !== false) pluiePieces(options.nombrePieces || 10);

      notifier(
        options.messageSucces || `Bravo ! +${formaterPieces(montant)}`,
        'succes'
      );

      return resultat;
    } catch (erreur) {
      attente?.fermer();
      notifier(erreur.message, 'erreur', { duree: 5000 });
      throw erreur;
    }
  }

  async function depenser(montant, source, options = {}) {
    const profil = lireProfilLocal();
    if (!profil) throw new Error('Aucun profil actif.');

    if (profil.piecesOr < entier(montant)) {
      const erreur = new Error('Vous n’avez pas assez de pièces d’or.');
      notifier(erreur.message, 'erreur');
      throw erreur;
    }

    const accord = options.confirmer === false
      ? true
      : await confirmer(
          options.messageConfirmation ||
          `Dépenser ${formaterPieces(montant)} ?`
        );

    if (!accord) return { ok: false, annule: true };

    try {
      const resultat = await debiter(montant, source, options.details || {});
      notifier(
        options.messageSucces || `${formaterPieces(montant)} dépensées.`,
        'succes'
      );
      return resultat;
    } catch (erreur) {
      notifier(erreur.message, 'erreur', { duree: 5000 });
      throw erreur;
    }
  }

  function configurer(options = {}) {
    if (!options || typeof options !== 'object') return { ...config };

    if (options.apiUrl) config.apiUrl = texteNonVide(options.apiUrl, config.apiUrl);
    if (options.villageUrl) config.villageUrl = texteNonVide(options.villageUrl, config.villageUrl);
    if (options.cleProfil) config.cleProfil = texteNonVide(options.cleProfil, config.cleProfil);
    if (options.dureeNotification !== undefined) {
      config.dureeNotification = Math.max(0, entier(options.dureeNotification, 3200));
    }
    if (options.debug !== undefined) config.debug = Boolean(options.debug);
    if (options.sons && typeof options.sons === 'object') {
      Object.entries(options.sons).forEach(([nom, url]) => enregistrerSon(nom, url));
    }

    return { ...config, sons: { ...config.sons } };
  }

  const Village = {
    version: VERSION,
    configurer,
    formaterPieces,
    attendre,

    api: {
      get: requeteGet,
      post: requetePost
    },

    profil: {
      lire: lireProfilLocal,
      sauvegarder: sauvegarderProfilLocal,
      effacer() {
        localStorage.removeItem(config.cleProfil);
        emettre('village:profil', null);
      },
      nom() {
        return lireProfilLocal()?.prenom || '';
      },
      id() {
        return lireProfilLocal()?.id || '';
      },
      solde() {
        return lireProfilLocal()?.piecesOr ?? 0;
      }
    },

    or: {
      solde() {
        return lireProfilLocal()?.piecesOr ?? 0;
      },
      crediter,
      debiter,
      recompenser,
      depenser
    },

    ui: {
      info: (message, options) => notifier(message, 'info', options),
      succes: (message, options) => notifier(message, 'succes', options),
      erreur: (message, options) => notifier(message, 'erreur', options),
      attente: (message, options) => notifier(message, 'attente', { duree: 0, ...options }),
      notifier,
      confirmer,
      ajouterBoutonRetour
    },

    son: {
      enregistrer: enregistrerSon,
      jouer: jouerSon
    },

    animation: {
      pieces: pluiePieces
    },

    init(options = {}) {
      configurer(options);
      injecterStyles();
      if (options.boutonRetour) {
        ajouterBoutonRetour(
          options.boutonRetour === true ? {} : options.boutonRetour
        );
      }
      emettre('village:pret', { version: VERSION });
      return Village;
    }
  };

  global.Village = Village;
  journal(`Village.js ${VERSION} chargé.`);
})(window);

