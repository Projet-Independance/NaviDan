# NaviDdan 🌐

Un navigateur web de bureau moderne, ultra-rapide et personnalisable, propulsé par Chromium et Electron.
**Compatible à 100 % avec Windows et Linux (Ubuntu, Debian, Fedora, Arch Linux, etc.).**

---

## ⚡ Les 5 Gestionnaires Intégrés & Modules Avancés

1. 🤖 **NaviAI (Assistant Intelligent Intégré)** :
   * **Volet latéral ancré rétractable (Split-view)** : la page web se redimensionne en direct sans être masquée.
   * **Onglet IA 100% Gratuite (Duck.ai Chat)** : Discutez instantanément avec **GPT-4o mini, Claude 3 Haiku, Llama 3.3 ou Mixtral** sans aucune clé d'API, sans compte et sans carte bancaire !
   * **Multi-moteurs hybride** : Support de **Google Gemini** (1.5 Flash / 2.0 - gratuit 1 500 req/jour), **Groq** (Llama 3.3 à 500+ tok/s - gratuit 14 400 req/jour), **OpenAI** (GPT-4o mini) et **Ollama local** (100% privé, sans internet).
   * **Actions instantanées en 1 clic** : *Résumer la page*, *Traduire en français*, *Points clés & FAQ*, *Expliquer simplement*.
   * **Bulle contextuelle en page** : Sélectionner un passage sur n'importe quel site fait apparaître le badge rapide `⚡ NaviAI` (Résumer, Traduire, Expliquer).
   * **Streaming temps réel** avec rendu Markdown soigné et bouton de copie de code.

2. 🔑 **Gestionnaire de Mots de Passe (Coffre-fort)** :
   * Enregistrement local sécurisé de vos comptes (site, identifiant, mot de passe).
   * Révélation/masquage instantané avec l'icône œil `👁️` et copie rapide au presse-papier `📋`.
   * **Générateur de mots de passe forts** intégré (aléatoire, majuscules, minuscules, symboles, chiffres).
   * Recherche en direct parmi vos identifiants.

2. 🔖 **Gestionnaire de Favoris** :
   * Panneau flottant sous l'icône `🔖` : liste de tous vos favoris avec bouton de suppression `✕`.
   * Bouton rapide `+ Ajouter cette page` pour sauvegarder l'onglet actif en 1 clic.
   * Barre de favoris permanente sous la barre d'adresse (activable/désactivable).

3. 🎨 **Gestionnaire de Thèmes & Couleurs Néon** :
   * **5 Thèmes complets** : *Cyber Dark*, *Tokyo Night (Violet)*, *Océan Abyssal (Cyan/Bleu)*, *Matrix Hacker (Vert néon)* et *Clair Épuré*.
   * **Palette de couleurs néon** : Bleu électrique, Rouge Cyber, Violet Tokyo, Vert Matrix, Cyan Cyberpunk et Ambre Sunset.
   * Application en direct sans redémarrer le navigateur.

4. ⚡ **Gestionnaire de Performances (NaviControl)** :
   * **Jauge cybernétique circulaire** affichant la RAM consommée par le navigateur et la RAM totale du PC en temps réel.
   * **Limiteur de RAM** avec curseur réglable (1 à 32 GB) et bascule de *Limite matérielle*.
   * **Limiteur de bande passante réseau** avec préréglages (100 Mbps, 50 Mbps, 25 Mbps, etc.).
   * **Hot Tabs Killer** : Liste en direct des onglets ouverts avec leur consommation mémoire exacte et un bouton **KILL** pour terminer immédiatement les onglets trop lourds.
   * Bouton **⚡ Libérer** pour forcer l'optimisation immédiate de la mémoire.

5. 🧹 **Gestionnaire de Place / Nettoyeur d'Espace (NaviCleaner)** :
   * Cadre cybernétique affichant l'espace occupé par les fichiers temporaires du navigateur (Cache, Cookies, Fichiers résiduels).
   * Préréglages en un clic : **MIN**, **MED** et **MAX**.
   * Configuration avancée avec bascules granulaires : *Cache*, *Cookies & LocalStorage*, *Historique*, *Téléchargements*.
   * Bouton **« Commencer à nettoyer »** pour récupérer instantanément de l'espace disque.

---

## 🛡️ Protection & Navigation

- 🛡️ **Bouclier Anti-Publicité & Anti-Traqueurs** : Filtrage réseau en temps réel avec popover de protection par site.
- 📥 **Gestionnaire de Téléchargements** : Suivi de la progression, ouverture directe du fichier ou de son dossier parent.
- 🕒 **Historique de Navigation** : Recherche rapide et nettoyage en un clic.
- 📑 **Navigation Multi-Onglets & Navigation Privée** : Isolation des sessions incognito.
- 🔍 **Barre d'Adresse Intelligente (Omnibox)** : Détection automatique des URLs directes et recherches Google, DuckDuckGo, Brave, Bing, Qwant.
- 🔎 **Recherche dans la page (Ctrl+F)** & Outils de développement (F12).

---

## ⌨️ Raccourcis Clavier

| Raccourci | Action |
|---|---|
| `Ctrl + T` | Ouvrir un nouvel onglet |
| `Ctrl + Shift + N` | Ouvrir un onglet en navigation privée |
| `Ctrl + W` | Fermer l'onglet actif |
| `Ctrl + L` | Sélectionner la barre d'adresse |
| `Ctrl + R` ou `F5` | Actualiser la page |
| `Ctrl + H` | Ouvrir l'historique |
| `Ctrl + J` | Ouvrir les téléchargements |
| `Ctrl + D` | Ajouter aux favoris |
| `Ctrl + F` | Rechercher dans la page |
| `Ctrl + \` / `Ctrl + B` | Afficher / Masquer la barre latérale |
| `Ctrl + Shift + A` | Afficher / Masquer le volet **NaviAI** (Assistant IA) |
| `Alt + P` | Détacher la vidéo en Picture-in-Picture (PiP Gaming) |
| `F12` | Ouvrir les Outils de Développement |

---

## 🚀 Démarrage

```powershell
cd D:\application\NaviDdan
npm start
```
