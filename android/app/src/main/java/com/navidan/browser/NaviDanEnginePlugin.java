package com.navidan.browser;

import android.annotation.SuppressLint;
import android.graphics.Bitmap;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "NaviDanEngine")
public class NaviDanEnginePlugin extends Plugin {

    private FrameLayout container;
    private final Map<Integer, WebView> tabWebViews = new HashMap<>();
    private int activeTabId = -1;
    private int topMargin = 0;
    private int viewHeight = 0;

    @PluginMethod
    public void init(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (container == null) {
                container = new FrameLayout(getContext());
                ViewGroup root = (ViewGroup) getActivity().findViewById(android.R.id.content);
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                );
                root.addView(container, params);
            }

            Integer top = call.getInt("top");
            Integer height = call.getInt("height");
            if (top != null) topMargin = top;
            if (height != null) viewHeight = height;

            updateContainerBounds();
            call.resolve();
        });
    }

    @PluginMethod
    public void updateBounds(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Integer top = call.getInt("top");
            Integer height = call.getInt("height");
            if (top != null) topMargin = top;
            if (height != null) viewHeight = height;
            updateContainerBounds();
            call.resolve();
        });
    }

    private void updateContainerBounds() {
        if (container != null && viewHeight > 0) {
            FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) container.getLayoutParams();
            params.topMargin = topMargin;
            params.height = viewHeight;
            container.setLayoutParams(params);
        }
    }

    @PluginMethod
    public void navigate(PluginCall call) {
        Integer id = call.getInt("id");
        String url = call.getString("url");
        if (id == null || url == null) {
            call.reject("Tab ID et URL requis");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView webView = getOrCreateWebView(id);
            switchTabInternal(id);
            container.setVisibility(View.VISIBLE);
            webView.setVisibility(View.VISIBLE);
            webView.loadUrl(url);
            call.resolve();
        });
    }

    @PluginMethod
    public void switchTab(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("Tab ID requis");
            return;
        }

        getActivity().runOnUiThread(() -> {
            switchTabInternal(id);
            call.resolve();
        });
    }

    private void switchTabInternal(int id) {
        activeTabId = id;
        for (Map.Entry<Integer, WebView> entry : tabWebViews.entrySet()) {
            if (entry.getKey() == id) {
                entry.getValue().setVisibility(View.VISIBLE);
            } else {
                entry.getValue().setVisibility(View.GONE);
            }
        }
    }

    @PluginMethod
    public void closeTab(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("Tab ID requis");
            return;
        }

        getActivity().runOnUiThread(() -> {
            WebView wv = tabWebViews.remove(id);
            if (wv != null) {
                container.removeView(wv);
                wv.destroy();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void hideContent(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (container != null) {
                container.setVisibility(View.GONE);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void showContent(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (container != null) {
                container.setVisibility(View.VISIBLE);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void goBack(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView wv = tabWebViews.get(activeTabId);
            if (wv != null && wv.canGoBack()) {
                wv.goBack();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void goForward(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView wv = tabWebViews.get(activeTabId);
            if (wv != null && wv.canGoForward()) {
                wv.goForward();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void reload(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WebView wv = tabWebViews.get(activeTabId);
            if (wv != null) {
                wv.reload();
            }
            call.resolve();
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView getOrCreateWebView(int id) {
        if (tabWebViews.containsKey(id)) {
            return tabWebViews.get(id);
        }

        WebView webView = new WebView(getContext());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " NaviDanMobile/1.0");

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                JSObject data = new JSObject();
                data.put("tabId", id);
                data.put("url", url);
                notifyListeners("urlChanged", data);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                JSObject data = new JSObject();
                data.put("tabId", id);
                data.put("url", url);
                data.put("title", view.getTitle());
                data.put("canGoBack", view.canGoBack());
                data.put("canGoForward", view.canGoForward());
                notifyListeners("pageFinished", data);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false; // Load all web URLs inside this WebView
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                JSObject data = new JSObject();
                data.put("tabId", id);
                data.put("progress", newProgress);
                notifyListeners("progressChanged", data);
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                JSObject data = new JSObject();
                data.put("tabId", id);
                data.put("title", title);
                notifyListeners("titleChanged", data);
            }
        });

        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        container.addView(webView, params);
        tabWebViews.put(id, webView);
        return webView;
    }
}

