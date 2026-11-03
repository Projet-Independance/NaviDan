const { app, shell } = require('electron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO_OWNER = 'Projet-Independance';
const REPO_NAME = 'NaviDan';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'codeload.github.com'
]);

class NaviDanUpdater {
  constructor() {
    this.downloadedFile = null;
    this.downloadedSha256 = null;
    this.expectedSha256 = null;
    this.downloadAbortController = null;
    this.isDownloading = false;
  }

  isAllowedDownloadUrl(rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'https:') return false;
      return ALLOWED_DOWNLOAD_HOSTS.has(parsed.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  isNewerVersion(current, latest) {
    const parse = (v) => String(v || '').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
    const [cMaj = 0, cMin = 0, cPat = 0] = parse(current);
    const [lMaj = 0, lMin = 0, lPat = 0] = parse(latest);
    if (lMaj > cMaj) return true;
    if (lMaj === cMaj && lMin > cMin) return true;
    if (lMaj === cMaj && lMin === cMin && lPat > cPat) return true;
    return false;
  }

  async checkUpdate() {
    const currentVersion = (app && typeof app.getVersion === 'function')
      ? app.getVersion()
      : require('../../package.json').version;
    try {
      const release = await this.fetchJson(GITHUB_API_URL);
      if (!release || !release.tag_name) {
        return { updateAvailable: false, currentVersion, error: 'Réponse GitHub invalide' };
      }

      const latestVersion = release.tag_name.replace(/^v/i, '');
      const updateAvailable = this.isNewerVersion(currentVersion, latestVersion);

      const assets = Array.isArray(release.assets) ? release.assets : [];
      let asset = null;

      if (process.platform === 'win32') {
        asset = assets.find(a => /setup.*\.exe$/i.test(a.name)) || assets.find(a => /\.exe$/i.test(a.name));
      } else if (process.platform === 'linux') {
        asset = assets.find(a => /\.AppImage$/i.test(a.name)) || assets.find(a => /\.deb$/i.test(a.name)) || assets.find(a => /\.tar\.gz$/i.test(a.name));
      }

      let sha256 = null;
      if (asset && typeof asset.digest === 'string' && asset.digest.startsWith('sha256:')) {
        sha256 = asset.digest.slice(7).toLowerCase();
      }
      this.expectedSha256 = sha256;

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        releaseName: release.name || release.tag_name,
        releaseNotes: release.body || '',
        releaseUrl: release.html_url,
        publishedAt: release.published_at,
        asset: asset ? {
          name: asset.name,
          size: asset.size,
          downloadUrl: asset.browser_download_url,
          sha256
        } : null
      };
    } catch (err) {
      console.warn('Updater check error:', err.message);
      return {
        updateAvailable: false,
        currentVersion,
        error: err.message
      };
    }
  }

  fetchJson(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        headers: {
          'User-Agent': 'NaviDan-Browser-Updater',
          'Accept': 'application/vnd.github.v3+json'
        },
        timeout: 8000
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return resolve(this.fetchJson(res.headers.location));
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Délai d\'attente dépassé'));
      });
    });
  }

  downloadUpdate(downloadUrl, assetName, onProgress = null) {
    if (this.isDownloading) {
      return Promise.reject(new Error('Téléchargement déjà en cours'));
    }

    if (!this.isAllowedDownloadUrl(downloadUrl)) {
      return Promise.reject(new Error('URL de mise à jour non autorisée (HTTPS GitHub requis)'));
    }

    this.isDownloading = true;
    const safeAssetName = path.basename(String(assetName || 'NaviDan-Update-Setup.exe')).replace(/[^a-zA-Z0-9._ -]/g, '_');
    const destPath = path.join(app.getPath('temp'), safeAssetName);

    return new Promise((resolve, reject) => {
      const downloadFile = (currentUrl, redirects = 5) => {
        if (redirects <= 0) {
          this.isDownloading = false;
          return reject(new Error('Trop de redirections'));
        }

        if (!this.isAllowedDownloadUrl(currentUrl)) {
          this.isDownloading = false;
          return reject(new Error('Redirection vers un hôte non autorisé bloquée'));
        }

        const req = https.get(currentUrl, {
          headers: {
            'User-Agent': 'NaviDan-Browser-Updater'
          }
        }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return downloadFile(res.headers.location, redirects - 1);
          }

          if (res.statusCode !== 200) {
            this.isDownloading = false;
            return reject(new Error(`Erreur HTTP ${res.statusCode}`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let transferredBytes = 0;
          const hasher = crypto.createHash('sha256');
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
            hasher.update(chunk);
            transferredBytes += chunk.length;
            if (totalBytes > 0 && typeof onProgress === 'function') {
              const percent = Math.min(100, Math.round((transferredBytes / totalBytes) * 100));
              onProgress({
                percent,
                transferred: transferredBytes,
                total: totalBytes
              });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              this.isDownloading = false;
              const computedHash = hasher.digest('hex').toLowerCase();
              if (this.expectedSha256 && computedHash !== this.expectedSha256.toLowerCase()) {
                fs.unlink(destPath, () => {});
                return reject(new Error('Échec de vérification d\'intégrité SHA-256 du binaire téléchargé'));
              }
              this.downloadedFile = destPath;
              this.downloadedSha256 = computedHash;
              resolve(destPath);
            });
          });

          fileStream.on('error', (err) => {
            this.isDownloading = false;
            fs.unlink(destPath, () => {});
            reject(err);
          });
        });

        req.on('error', (err) => {
          this.isDownloading = false;
          reject(err);
        });
      };

      downloadFile(downloadUrl);
    });
  }

  installAndRestart() {
    const targetFile = this.downloadedFile;
    if (!targetFile || !fs.existsSync(targetFile)) {
      throw new Error('Fichier d\'installation introuvable');
    }

    const resolvedTarget = path.resolve(targetFile);
    const tempDir = path.resolve(app.getPath('temp'));
    if (!resolvedTarget.toLowerCase().startsWith(tempDir.toLowerCase() + path.sep)) {
      throw new Error('Chemin d\'exécutable hors du dossier temporaire sécurisé');
    }

    if (process.platform === 'win32') {
      try {
        const installerProcess = spawn(resolvedTarget, [], {
          detached: true,
          stdio: 'ignore'
        });
        installerProcess.unref();
      } catch (err) {
        shell.openPath(resolvedTarget);
      }
    } else {
      shell.openPath(resolvedTarget);
    }

    setTimeout(() => {
      app.quit();
    }, 600);

    return true;
  }
}

module.exports = new NaviDanUpdater();
