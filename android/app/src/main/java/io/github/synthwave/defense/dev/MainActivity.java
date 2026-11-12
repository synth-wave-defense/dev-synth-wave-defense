package io.github.synthwave.defense.dev;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import androidx.annotation.Keep;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import com.getcapacitor.BridgeActivity;
import com.yandex.mobile.ads.common.AdError;
import com.yandex.mobile.ads.common.AdRequestConfiguration;
import com.yandex.mobile.ads.common.AdRequestError;
import com.yandex.mobile.ads.common.ImpressionData;
import com.yandex.mobile.ads.common.InitializationListener;
import com.yandex.mobile.ads.common.MobileAds;
import com.yandex.mobile.ads.rewarded.Reward;
import com.yandex.mobile.ads.rewarded.RewardedAd;
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoadListener;
import com.yandex.mobile.ads.rewarded.RewardedAdLoader;
import org.json.JSONObject;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Keep
public class MainActivity extends BridgeActivity {
    private static final String TAG = "SynthWaveDiag";
    private static final String DIAG_PREFS = "SynthWaveSilentDiagPrefs";
    private static final String KEY_LAST_CRASH_STACK = "last_crash_stack";
    private static final String KEY_LAST_EXIT_REASON = "last_exit_reason";
    private static final String KEY_SESSION_CLEAN_BOOT = "session_clean_boot";

    private NativeYandexAdsBridge adsBridge;

    private AssetCacheManager cacheManager;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        installSilentCrashInterceptor();
        super.onCreate(savedInstanceState);

        try {
            cacheManager = new AssetCacheManager();
            String customWebDir = cacheManager.prepareBootWebDir();
            if (customWebDir != null && this.bridge != null) {
                this.bridge.setServerBasePath(customWebDir);
            }

            if (this.bridge != null && this.bridge.getWebView() != null) {
                adsBridge = new NativeYandexAdsBridge(this);
                this.bridge.getWebView().addJavascriptInterface(cacheManager, "AssetCacheManager");
                this.bridge.getWebView().addJavascriptInterface(adsBridge, "NativeYandexAdsBridge");
                this.bridge.getWebView().addJavascriptInterface(adsBridge, "NativeAdsBridge");
            }
        } catch (Throwable e) {
            Log.e(TAG, "ERROR attaching bridges: " + Log.getStackTraceString(e));
        }
    }

    private void installSilentCrashInterceptor() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                String stack = Log.getStackTraceString(throwable);
                String tName = thread != null ? thread.getName() : "unknown";
                boolean isMainThread = (thread == Looper.getMainLooper().getThread());

                boolean isBgSdkCrash = !isMainThread && (
                    tName.contains("YandexAds") ||
                    tName.contains("ExoPlayer") ||
                    tName.contains(" OkHttp") ||
                    stack.contains("com.monetization.ads") ||
                    stack.contains("com.yandex.mobile.ads") ||
                    stack.contains("CompletionHandlerException")
                );

                if (isBgSdkCrash || !isMainThread) {
                    return; 
                }

                String header = "FATAL UNCAUGHT EXCEPTION on thread [" + tName + "]:\n"
                    + throwable.getClass().getName() + ": " + throwable.getMessage() + "\n" + stack;

                SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
                dp.edit()
                    .putString(KEY_LAST_CRASH_STACK, header)
                    .putString(KEY_LAST_EXIT_REASON, "JAVA_CRASH (" + throwable.getClass().getSimpleName() + ")")
                    .putBoolean(KEY_SESSION_CLEAN_BOOT, false)
                    .commit();
                    
                File extDir = getExternalFilesDir(null);
                if (extDir != null) {
                    File out = new File(extDir, "crash_log.txt");
                    try (FileOutputStream fos = new FileOutputStream(out, false)) {
                        fos.write(header.getBytes(StandardCharsets.UTF_8));
                    }
                }
            } catch (Throwable ignored) {}

            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            } else {
                System.exit(1);
            }
        });
    }

    @Keep
    public class AssetCacheManager {
        private static final String OTA_PREFS = "SynthWaveOtaPrefs";
        private static final String KEY_ACTIVE_VER = "active_version";
        private static final String KEY_PREV_VER = "prev_version";
        private static final String KEY_PENDING_VER = "pending_version";
        private static final String KEY_BAD_VER = "bad_version";

        private String bootStatus = "SUCCESS";
        private String bootLog = "builtin";

        private SharedPreferences prefs() {
            return getSharedPreferences(OTA_PREFS, Context.MODE_PRIVATE);
        }

        private File getPackDir(String version) {
            return new File(getFilesDir(), "ota_packs/" + version);
        }

        public String prepareBootWebDir() {
            try {
                SharedPreferences sp = prefs();
                String pending = sp.getString(KEY_PENDING_VER, null);
                String active = sp.getString(KEY_ACTIVE_VER, "builtin");

                if (pending != null && !pending.isEmpty()) {
                    File pendingDir = getPackDir(pending);
                    if (new File(pendingDir, "index.html").exists()) {
                        sp.edit()
                            .putString(KEY_PREV_VER, active)
                            .putString(KEY_ACTIVE_VER, pending)
                            .remove(KEY_PENDING_VER)
                            .commit();
                        active = pending;
                        bootLog = "promoted:" + active;
                    } else {
                        sp.edit().remove(KEY_PENDING_VER).commit();
                        bootLog = "missing_pending";
                    }
                }

                if (active != null && !"builtin".equals(active)) {
                    File activeDir = getPackDir(active);
                    if (new File(activeDir, "index.html").exists()) {
                        bootStatus = "SUCCESS";
                        if ("builtin".equals(bootLog)) bootLog = "loaded:" + active;
                        return activeDir.getAbsolutePath();
                    } else {
                        sp.edit().putString(KEY_ACTIVE_VER, "builtin").commit();
                        bootStatus = "FALLBACK_MISSING";
                        bootLog = "fallback_builtin";
                    }
                }
            } catch (Throwable e) {
                bootStatus = "ERR";
                bootLog = e.getMessage();
            }
            return null;
        }

        @Keep
        @JavascriptInterface
        public void logJsDiagnostic(String msg) {
            Log.d(TAG, "[OTA] " + msg);
        }

        @Keep
        @JavascriptInterface
        public void confirmCacheValid() {}

        @Keep
        @JavascriptInterface
        public String restoreBackupPack() {
            prefs().edit()
                .putString(KEY_ACTIVE_VER, "builtin")
                .remove(KEY_PENDING_VER)
                .commit();
            return "OK_BUILTIN";
        }

        @Keep
        @JavascriptInterface
        public String getStatusJson() {
            try {
                SharedPreferences sp = prefs();
                JSONObject obj = new JSONObject();
                obj.put("bootStatus", bootStatus);
                obj.put("bootLog", bootLog);
                obj.put("activeVersion", sp.getString(KEY_ACTIVE_VER, "builtin"));
                obj.put("prevVersion", sp.getString(KEY_PREV_VER, "builtin"));
                obj.put("pendingVersion", sp.getString(KEY_PENDING_VER, "none"));
                obj.put("badVersion", sp.getString(KEY_BAD_VER, ""));
                return obj.toString();
            } catch (Exception e) {
                return "{\"bootStatus\":\"ERR\"}";
            }
        }

        @Keep
        @JavascriptInterface
        public String syncResourcePack(String cacheFileName, String version, boolean immediate) {
            try {
                File zipFile = new File(getFilesDir(), cacheFileName);
                if (!zipFile.exists()) {
                    return "ERR_NO_ZIP";
                }

                File targetDir = getPackDir(version);
                deleteRecursive(targetDir);
                if (!targetDir.mkdirs() && !targetDir.exists()) {
                    return "ERR_MKDIR";
                }

                unzipToDir(zipFile, targetDir);

                if (!new File(targetDir, "index.html").exists()) {
                    deleteRecursive(targetDir);
                    return "ERR_NO_INDEX_HTML";
                }

                prefs().edit()
                    .putString(KEY_PENDING_VER, version)
                    .commit();

                if (immediate) {
                    return activateStagedPack();
                }
                return "OK_STAGED";
            } catch (Throwable e) {
                Log.e(TAG, "syncResourcePack error", e);
                return "ERR_UNZIP: " + e.getMessage();
            }
        }

        @Keep
        @JavascriptInterface
        public String activateStagedPack() {
            try {
                SharedPreferences sp = prefs();
                String pending = sp.getString(KEY_PENDING_VER, null);
                if (pending == null || pending.isEmpty()) {
                    return "ERR_NO_PENDING";
                }
                File pendingDir = getPackDir(pending);
                if (!new File(pendingDir, "index.html").exists()) {
                    return "ERR_PENDING_MISSING";
                }

                String prev = sp.getString(KEY_ACTIVE_VER, "builtin");
                sp.edit()
                    .putString(KEY_PREV_VER, prev)
                    .putString(KEY_ACTIVE_VER, pending)
                    .remove(KEY_PENDING_VER)
                    .commit();

                runOnUiThread(() -> {
                    try {
                        if (MainActivity.this.bridge != null) {
                            MainActivity.this.bridge.setServerBasePath(pendingDir.getAbsolutePath());
                        }
                    } catch (Throwable ignored) {}
                });

                return "OK_ACTIVATED";
            } catch (Throwable e) {
                return "ERR_ACTIVATE: " + e.getMessage();
            }
        }

        private void unzipToDir(File zipFile, File destDir) throws Exception {
            String destCanonical = destDir.getCanonicalPath() + File.separator;
            try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
                ZipEntry entry;
                byte[] buffer = new byte[8192];
                while ((entry = zis.getNextEntry()) != null) {
                    File outFile = new File(destDir, entry.getName());
                    if (!outFile.getCanonicalPath().startsWith(destCanonical)) {
                        throw new SecurityException("Zip Slip blocked: " + entry.getName());
                    }
                    if (entry.isDirectory()) {
                        outFile.mkdirs();
                    } else {
                        File parent = outFile.getParentFile();
                        if (parent != null && !parent.exists()) parent.mkdirs();
                        try (FileOutputStream fos = new FileOutputStream(outFile)) {
                            int count;
                            while ((count = zis.read(buffer)) != -1) {
                                fos.write(buffer, 0, count);
                            }
                        }
                    }
                    zis.closeEntry();
                }
            }
        }

        private void deleteRecursive(File file) {
            if (file == null || !file.exists()) return;
            if (file.isDirectory()) {
                File[] children = file.listFiles();
                if (children != null) {
                    for (File child : children) deleteRecursive(child);
                }
            }
            file.delete();
        }
    }

    @Keep
    public class NativeYandexAdsBridge {
        private final Context context;
        private RewardedAdLoader rewardedAdLoader;
        private RewardedAd rewardedAd;
        private boolean isAdLoading = false;
        private boolean isSdkInitialized = false;
        private String pendingAdUnitId = "demo-rewarded-yandex";

        public NativeYandexAdsBridge(Context context) {
            this.context = context;
        }

        private void runJs(final String jsCode) {
            runOnUiThread(() -> {
                try {
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        MainActivity.this.bridge.getWebView().evaluateJavascript(jsCode, null);
                    }
                } catch (Throwable e) {}
            });
        }

        @Keep
        @JavascriptInterface
        public void initialize(final String defaultAdUnitId) {
            if (defaultAdUnitId != null && !defaultAdUnitId.isEmpty()) {
                pendingAdUnitId = defaultAdUnitId;
            }
            runOnUiThread(() -> {
                try {
                    MobileAds.initialize(context.getApplicationContext(), new InitializationListener() {
                        @Override
                        public void onInitializationCompleted() {
                            isSdkInitialized = true;
                            setupLoader();
                            loadRewardedAd(pendingAdUnitId);
                        }
                    });
                } catch (Throwable t) {
                    runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Native init error');");
                }
            });
        }

        private void setupLoader() {
            if (rewardedAdLoader != null) return;
            try {
                rewardedAdLoader = new RewardedAdLoader(context.getApplicationContext());
                rewardedAdLoader.setAdLoadListener(new RewardedAdLoadListener() {
                    @Override
                    public void onAdLoaded(@NonNull RewardedAd ad) {
                        rewardedAd = ad;
                        isAdLoading = false;
                        attachEventListener(ad);
                        runJs("window.onYandexAdLoaded && window.onYandexAdLoaded();");
                    }

                    @Override
                    public void onAdFailedToLoad(@NonNull AdRequestError adRequestError) {
                        rewardedAd = null;
                        isAdLoading = false;
                        runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Load error');");
                    }
                });
            } catch (Throwable t) {
                rewardedAdLoader = null;
            }
        }

        private void attachEventListener(RewardedAd ad) {
            try {
                ad.setAdEventListener(new RewardedAdEventListener() {
                    @Override
                    public void onAdShown() {}

                    @Override
                    public void onAdFailedToShow(@NonNull AdError adError) {
                        rewardedAd = null;
                        runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('Show error');");
                    }

                    @Override
                    public void onAdDismissed() {
                        rewardedAd = null;
                        runJs("window.onYandexAdDismissed && window.onYandexAdDismissed();");
                    }

                    @Override
                    public void onAdClicked() {}

                    @Override
                    public void onRewarded(@NonNull Reward reward) {
                        runJs("window.onYandexAdRewarded && window.onYandexAdRewarded();");
                    }

                    @Override
                    public void onAdImpression(@Nullable ImpressionData impressionData) {}
                });
            } catch (Throwable t) {}
        }

        @Keep
        @JavascriptInterface
        public void loadRewardedAd(final String adUnitId) {
            final String unitToLoad = (adUnitId != null && !adUnitId.isEmpty()) ? adUnitId : pendingAdUnitId;
            pendingAdUnitId = unitToLoad;

            runOnUiThread(() -> {
                try {
                    if (!isSdkInitialized) {
                        initialize(unitToLoad);
                        return;
                    }
                    if (isAdLoading || rewardedAd != null) return;
                    
                    setupLoader();
                    isAdLoading = true;
                    AdRequestConfiguration config = new AdRequestConfiguration.Builder(unitToLoad).build();
                    rewardedAdLoader.loadAd(config);
                } catch (Throwable t) {
                    isAdLoading = false;
                    runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Load exception');");
                }
            });
        }

        @Keep
        @JavascriptInterface
        public boolean isRewardedAdReady() {
            return rewardedAd != null;
        }

        @Keep
        @JavascriptInterface
        public void showRewardedAd() {
            runOnUiThread(() -> {
                try {
                    if (rewardedAd != null) {
                        rewardedAd.show(MainActivity.this);
                    } else {
                        runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('Ad not ready');");
                        loadRewardedAd(pendingAdUnitId);
                    }
                } catch (Throwable t) {
                    rewardedAd = null;
                    runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('Show exception');");
                }
            });
        }
    }
}