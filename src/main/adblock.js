/**
 * NaviDdan Built-in Privacy & Content Protection Shield
 * Manages Ad Blocking and Tracker Blocking with per-site exceptions.
 */

const AD_DOMAINS = [
  // Major ad networks
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adservice.google.',
  'adnxs.com',
  'adform.net',
  'criteo.com',
  'criteo.net',
  'outbrain.com',
  'taboola.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'casalemedia.com',
  'smartadserver.com',
  'yieldmo.com',
  'sovrn.com',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'zergnet.com',
  'revcontent.com',
  'adroll.com',
  'bidswitch.net',
  'carbonads.net',
  'buysellads.com',
  'amazon-adsystem.com',
  'media.net',
  'infolinks.com'
];

const TRACKER_DOMAINS = [
  // Telemetry & Trackers
  'google-analytics.com',
  'hotjar.com',
  'mouseflow.com',
  'crazyegg.com',
  'segment.io',
  'mixpanel.com',
  'amplitude.com',
  'scorecardresearch.com',
  'quantserve.com',
  'facebook.net/tr',
  'connect.facebook.net/signals',
  'tiktok.com/i18n/pixel',
  'snapchat.com/tr',
  'clarity.ms',
  'yandex.ru/metrika'
];

const AD_PATH_PATTERNS = [
  /\/ads?\//i,
  /\/ad-banner/i,
  /\/adservice\./i,
  /\/adserver\./i,
  /\/pagead\//i,
  /\/sponsored\//i,
  /\/popunder/i,
  /\/banner_ads\//i
];

const TRACKER_PATH_PATTERNS = [
  /\/tracking\//i,
  /\/telemetry\//i,
  /\/analytics\//i,
  /\/pixel\//i,
  /\/collect\?/i
];

class AdBlocker {
  constructor() {
    this.adsEnabled = true;
    this.trackersEnabled = true;
    this.blockedCount = 0;
    this.siteBlockedCounts = new Map(); // domain -> count
    this.disabledAdsSites = new Set(); // domains where ads blocking is off
    this.disabledTrackersSites = new Set(); // domains where tracker blocking is off
  }

  isDomainDisabled(set, domain) {
    if (!domain) return false;
    domain = domain.toLowerCase();
    for (const d of set) {
      if (domain === d || domain.endsWith('.' + d)) return true;
    }
    return false;
  }

  toggleSiteAds(domain) {
    if (!domain) return false;
    domain = domain.toLowerCase();
    if (this.disabledAdsSites.has(domain)) {
      this.disabledAdsSites.delete(domain);
      return true; // enabled
    } else {
      this.disabledAdsSites.add(domain);
      return false; // disabled
    }
  }

  toggleSiteTrackers(domain) {
    if (!domain) return false;
    domain = domain.toLowerCase();
    if (this.disabledTrackersSites.has(domain)) {
      this.disabledTrackersSites.delete(domain);
      return true; // enabled
    } else {
      this.disabledTrackersSites.add(domain);
      return false; // disabled
    }
  }

  isSiteAdsEnabled(domain) {
    if (!this.adsEnabled) return false;
    return !this.isDomainDisabled(this.disabledAdsSites, domain);
  }

  isSiteTrackersEnabled(domain) {
    if (!this.trackersEnabled) return false;
    return !this.isDomainDisabled(this.disabledTrackersSites, domain);
  }

  getSiteStats(domain) {
    domain = (domain || '').toLowerCase();
    return {
      domain,
      adsEnabled: this.isSiteAdsEnabled(domain),
      trackersEnabled: this.isSiteTrackersEnabled(domain),
      siteBlockedCount: this.siteBlockedCounts.get(domain) || 0,
      totalBlockedCount: this.blockedCount
    };
  }

  extractDomain(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return u.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  shouldBlock(requestUrl, pageUrl) {
    const pageDomain = this.extractDomain(pageUrl);
    const reqDomain = this.extractDomain(requestUrl);
    const parsedPath = requestUrl.toLowerCase();

    // Check Ads
    if (this.isSiteAdsEnabled(pageDomain)) {
      for (const d of AD_DOMAINS) {
        if (reqDomain === d || reqDomain.endsWith('.' + d)) return 'ad';
      }
      for (const p of AD_PATH_PATTERNS) {
        if (p.test(parsedPath)) return 'ad';
      }
    }

    // Check Trackers
    if (this.isSiteTrackersEnabled(pageDomain)) {
      for (const d of TRACKER_DOMAINS) {
        if (reqDomain === d || reqDomain.endsWith('.' + d)) return 'tracker';
      }
      for (const p of TRACKER_PATH_PATTERNS) {
        if (p.test(parsedPath)) return 'tracker';
      }
    }

    return null;
  }

  attachSession(ses, onBlockCallback) {
    ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
      const pageUrl = details.initiator || details.referrer || '';
      const blockReason = this.shouldBlock(details.url, pageUrl);

      if (blockReason) {
        this.blockedCount++;
        const pageDomain = this.extractDomain(pageUrl);
        if (pageDomain) {
          const current = this.siteBlockedCounts.get(pageDomain) || 0;
          this.siteBlockedCounts.set(pageDomain, current + 1);
        }

        if (onBlockCallback) {
          onBlockCallback({
            url: details.url,
            reason: blockReason,
            count: this.blockedCount,
            pageDomain,
            tabId: details.webContentsId
          });
        }
        return callback({ cancel: true });
      }

      return callback({ cancel: false });
    });
  }

  getBlockedCount() {
    return this.blockedCount;
  }
}

module.exports = new AdBlocker();
