# Politique de Confidentialité — NaviDan Browser

Dernière mise à jour : 6 novembre 2026

Le respect de votre vie privée et la sécurité de vos données personnelles sont au cœur de la conception de **NaviDan** (« l'Application »), développé par **Projet-Independance**.

---

### 1. Données collectées et Télémétrie
NaviDan est un navigateur orienté vers la souveraineté numérique et la confidentialité :
- **Aucune télémétrie** : NaviDan ne collecte, n'enregistre et ne transmet aucune donnée d'utilisation, statistique ou métrique de navigation vers des serveurs tiers ou vers Projet-Independance.
- **Aucun profilage** : Vos habitudes de navigation, requêtes de recherche et sites visités restent strictement privés.

---

### 2. Stockage Local des Données
Toutes les données de session sont conservées **exclusivement en local sur votre appareil** :
- **Historique et Favoris** : Enregistrés localement dans le dossier de données de l'application (`AppData` sur Windows, `~/.config` sur Linux).
- **Mots de passe** : Chiffrés localement à l'aide des mécanismes cryptographiques du système d'exploitation (**Windows DPAPI** via `safeStorage` et hash salé pour le code PIN maître).
- **Suppression intégrale** : Vous pouvez à tout moment effacer l'historique, les cookies, le cache et les mots de passe via les outils intégrés (Gestionnaire de nettoyage et paramètres).

---

### 3. Filtrage des Contenus et Bouclier Anti-Pub
Le bouclier de protection bloque les publicités intrusives, scripts de minage et traqueurs tiers :
- Les listes de blocage sont traitées **localement** dans le moteur de l'application via les API réseau de Chromium/Electron.
- Aucune URL consultée n'est envoyée à un serveur d'analyse externe.

---

### 4. Assistant Intelligent NaviAI
Si vous utilisez les fonctionnalités d'assistance NaviAI :
- Les échanges textuels sont envoyés **directement** au fournisseur d'IA sélectionné (Google Gemini, Groq, OpenAI ou votre instance Ollama locale).
- Vos clés d'API personnelles sont chiffrées localement et ne transitent par aucun serveur intermédiaire opéré par Projet-Independance.

---

### 5. Permissions Requises
L'Application requiert les autorisations techniques standards nécessaires à tout navigateur web :
- **Accès réseau / Internet** : Charger les pages web demandées par l'utilisateur.
- **Accès au stockage local** : Télécharger des fichiers choisis par l'utilisateur et persister les préférences locales.

---

### 6. Contact
Pour toute question relative à cette politique de confidentialité :
- **Dépôt officiel** : https://github.com/Projet-Independance/NaviDan
- **Courriel** : contact@navidan.browser
