const { app, shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const REPO_OWNER = 'Projet-Independance';
const REPO_NAME = 'NaviDan';
const GITHUB_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

class NaviDanUpdater {
  constructor() {
    this.downloadedFile = null;
    this.downloadAbortController = null;
    this.isDownloading = false;
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

      // Select matching asset for user platform
      const assets = Array.isArray(release.assets) ? release.assets : [];
      let asset = null;

      if (process.platform === 'win32') {
        asset = assets.find(a => /setup.*\.exe$/i.test(a.name)) || assets.find(a => /\.exe$/i.test(a.name));
      } else if (process.platform === 'linux') {
        asset = assets.find(a => /\.AppImage$/i.test(a.name)) || assets.find(a => /\.deb$/i.test(a.name)) || assets.find(a => /\.tar\.gz$/i.test(a.name));
      }

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
          downloadUrl: asset.browser_download_url
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

    this.isDownloading = true;
    const destPath = path.join(app.getPath('temp'), assetName || 'NaviDan-Update-Setup.exe');

    return new Promise((resolve, reject) => {
      const downloadFile = (currentUrl, redirects = 5) => {
        if (redirects <= 0) {
          this.isDownloading = false;
          return reject(new Error('Trop de redirections'));
        }

        const client = currentUrl.startsWith('https') ? https : http;
        const req = client.get(currentUrl, {
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
          const fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk) => {
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
              this.downloadedFile = destPath;
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

  installAndRestart(customFilePath = null) {
    const targetFile = customFilePath || this.downloadedFile;
    if (!targetFile || !fs.existsSync(targetFile)) {
      throw new Error('Fichier d\'installation introuvable');
    }

    if (process.platform === 'win32') {
      try {
        const installerProcess = spawn(targetFile, [], {
          detached: true,
          stdio: 'ignore'
        });
        installerProcess.unref();
      } catch (err) {
        shell.openPath(targetFile);
      }
    } else {
      shell.openPath(targetFile);
    }

    setTimeout(() => {
      app.quit();
    }, 500);
    return true;
  }
}

module.exports = new NaviDanUpdater();
