package io.github.synthwave.defense.dev;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
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
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "SynthWaveAssetCachePrefs";
    private static final String KEY_ACTIVE_PATH = "active_cache_path";
    private static final String KEY_ACTIVE_VER = "active_cache_version";
    private static final String KEY_PREV_PATH = "prev_cache_path";
    private static final String KEY_PREV_VER = "prev_cache_version";
    private static final String KEY_PENDING_PATH = "pending_cache_path";
    private static final String KEY_PENDING_VER = "pending_cache_version";
    private static final String KEY_BAD_VER = "bad_cache_version";
    private static final String KEY_APK_TIME = "last_pkg_update_time";
    private static final String KEY_BOOT_LOG = "last_boot_cache_log";
    private static final String KEY_BOOT_STATUS = "cache_boot_status";

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable = null;
    private boolean isRollingBack = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().addJavascriptInterface(new AssetCacheManager(this), "AssetCacheManager");
                this.bridge.getWebView().addJavascriptInterface(new NativeYandexAdsBridge(this), "NativeYandexAdsBridge");
            }
            verifyAndMountAssetCache();
        } catch (Throwable e) {
            e.printStackTrace();
        }
    }

    private void cancelWatchdogTimer() {
        if (watchdogRunnable != null) {
            watchdogHandler.removeCallbacks(watchdogRunnable);
            watchdogRunnable = null;
        }
    }

    private void startWatchdogTimer() {
        cancelWatchdogTimer();
        watchdogRunnable = () -> {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if ("PENDING".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS")) && !isRollingBack) {
                restorePreviousCacheState(prefs, "Watchdog timeout");
            }
        };
        watchdogHandler.postDelayed(watchdogRunnable, 8000);
    }

    private void restorePreviousCacheState(SharedPreferences prefs, String reason) {
        if (isRollingBack) return;
        isRollingBack = true;
        cancelWatchdogTimer();

        String deadVer = prefs.getString(KEY_ACTIVE_VER, "");
        String prevPath = prefs.getString(KEY_PREV_PATH, null);
        String prevVer = prefs.getString(KEY_PREV_VER, "builtin");

        String curActivePath = prefs.getString(KEY_ACTIVE_PATH, null);
        if (prevPath != null && prevPath.equals(curActivePath)) {
            prevPath = null;
            prevVer = "builtin";
        }

        boolean canUsePrev = prevPath != null && new File(prevPath, "index.html").exists();

        SharedPreferences.Editor editor = prefs.edit();
        if (deadVer != null && !deadVer.isEmpty() && !"builtin".equals(deadVer)) {
            editor.putString(KEY_BAD_VER, deadVer);
        }
        editor.remove(KEY_PENDING_PATH);
        editor.remove(KEY_PENDING_VER);

        if (canUsePrev) {
            editor.putString(KEY_ACTIVE_PATH, prevPath);
            editor.putString(KEY_ACTIVE_VER, prevVer);
            editor.putString(KEY_BOOT_LOG, reason + " -> Restored v" + prevVer);
        } else {
            editor.remove(KEY_ACTIVE_PATH);
            editor.remove(KEY_ACTIVE_VER);
            editor.putString(KEY_BOOT_LOG, reason + " -> Restored builtin assets");
        }
        editor.putString(KEY_BOOT_STATUS, "ROLLED_BACK");
        editor.commit();

        final String targetPath = canUsePrev ? prevPath : null;
        runOnUiThread(() -> {
            try {
                if (MainActivity.this.bridge != null) {
                    if (targetPath != null) {
                        MainActivity.this.bridge.setServerBasePath(targetPath);
                    } else {
                        MainActivity.this.bridge.setServerAssetPath("public");
                    }
                }
            } finally {
                watchdogHandler.postDelayed(() -> { isRollingBack = false; }, 2000);
            }
        });
    }

    private void verifyAndMountAssetCache() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        StringBuilder bootLog = new StringBuilder();

        // 1. Сброс кэша при установке свежего APK поверх старого
        long curApkTime = 0;
        try {
            PackageInfo pInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            curApkTime = pInfo.lastUpdateTime;
        } catch (Exception ignored) {}

        long savedApkTime = prefs.getLong(KEY_APK_TIME, 0);
        if (curApkTime != 0 && savedApkTime != curApkTime) {
            prefs.edit()
                .putLong(KEY_APK_TIME, curApkTime)
                .remove(KEY_ACTIVE_PATH)
                .remove(KEY_ACTIVE_VER)
                .remove(KEY_PREV_PATH)
                .remove(KEY_PREV_VER)
                .remove(KEY_PENDING_PATH)
                .remove(KEY_PENDING_VER)
                .remove(KEY_BAD_VER)
                .putString(KEY_BOOT_STATUS, "SUCCESS")
                .putString(KEY_BOOT_LOG, "Fresh package install detected, reset cache")
                .apply();
            return;
        }

        // 2. Если предыдущий запуск не завершился (остался в PENDING), восстанавливаем prevPath или builtin
        String bootStatus = prefs.getString(KEY_BOOT_STATUS, "SUCCESS");
        if ("PENDING".equals(bootStatus)) {
            String deadVer = prefs.getString(KEY_ACTIVE_VER, "");
            String prevPath = prefs.getString(KEY_PREV_PATH, null);
            String prevVer = prefs.getString(KEY_PREV_VER, "builtin");
            SharedPreferences.Editor ed = prefs.edit();
            if (deadVer != null && !deadVer.isEmpty() && !"builtin".equals(deadVer)) {
                ed.putString(KEY_BAD_VER, deadVer);
            }
            ed.remove(KEY_PENDING_PATH).remove(KEY_PENDING_VER);

            if (prevPath != null && new File(prevPath, "index.html").exists()) {
                ed.putString(KEY_ACTIVE_PATH, prevPath)
                    .putString(KEY_ACTIVE_VER, prevVer)
                    .putString(KEY_BOOT_STATUS, "ROLLED_BACK")
                    .apply();
                bootLog.append("Restored v").append(prevVer).append("; ");
            } else {
                ed.remove(KEY_ACTIVE_PATH)
                    .remove(KEY_ACTIVE_VER)
                    .putString(KEY_BOOT_STATUS, "ROLLED_BACK")
                    .apply();
                bootLog.append("Restored builtin assets; ");
            }
            bootStatus = "ROLLED_BACK";
        }

        // 3. Активация подготовленного кэша при холодном старте
        String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
        String pendingVer = prefs.getString(KEY_PENDING_VER, null);
        if (pendingPath != null) {
            File pIdx = new File(pendingPath, "index.html");
            if (pIdx.exists()) {
                String curActivePath = prefs.getString(KEY_ACTIVE_PATH, null);
                String curActiveVer = prefs.getString(KEY_ACTIVE_VER, null);
                SharedPreferences.Editor ed = prefs.edit();
                if (curActivePath != null && new File(curActivePath, "index.html").exists() && "SUCCESS".equals(bootStatus)) {
                    ed.putString(KEY_PREV_PATH, curActivePath);
                    ed.putString(KEY_PREV_VER, curActiveVer != null ? curActiveVer : "cached");
                }
                ed.putString(KEY_ACTIVE_PATH, pendingPath)
                    .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "cached")
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_VER)
                    .putString(KEY_BOOT_STATUS, "PENDING")
                    .apply();
                bootStatus = "PENDING";
                bootLog.append("Mounted v").append(pendingVer).append("; ");
            } else {
                prefs.edit().remove(KEY_PENDING_PATH).remove(KEY_PENDING_VER).apply();
                bootLog.append("Staged index missing; ");
            }
        }

        // 4. Загрузка активного пути ресурсов
        String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
        String activeVer = prefs.getString(KEY_ACTIVE_VER, "builtin");
        if (activePath != null) {
            File indexFile = new File(activePath, "index.html");
            if (indexFile.exists() && this.bridge != null) {
                this.bridge.setServerBasePath(activePath);
                bootLog.append("Loaded pack v").append(activeVer);
                if ("PENDING".equals(bootStatus)) {
                    startWatchdogTimer();
                }
            } else {
                this.bridge.setServerAssetPath("public");
                bootLog.append("Active index missing, loaded builtin");
            }
        } else {
            bootLog.append("Running builtin assets");
        }
        prefs.edit().putString(KEY_BOOT_LOG, bootLog.toString()).apply();
    }

    @Keep
    public class AssetCacheManager {
        private final Context ctx;
        public AssetCacheManager(Context c) { this.ctx = c; }

        @Keep
        @JavascriptInterface
        public void confirmCacheValid() {
            cancelWatchdogTimer();
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
            String activeVer = prefs.getString(KEY_ACTIVE_VER, null);
            SharedPreferences.Editor ed = prefs.edit();
            ed.putString(KEY_BOOT_STATUS, "SUCCESS");
            if (activePath != null && new File(activePath, "index.html").exists()) {
                ed.putString(KEY_PREV_PATH, activePath);
                ed.putString(KEY_PREV_VER, activeVer != null ? activeVer : "cached");
            }
            ed.apply();
        }

        @Keep
        @JavascriptInterface
        public String restoreBackupPack() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                restorePreviousCacheState(prefs, "JS runtime fallback");
                return "OK_ROLLBACK";
            } catch (Exception e) {
                return "ERR_ROLLBACK:" + e.getMessage();
            }
        }

        @Keep
        @JavascriptInterface
        public String getStatusJson() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                JSONObject obj = new JSONObject();
                obj.put("activeVersion", prefs.getString(KEY_ACTIVE_VER, "builtin"));
                obj.put("activePath", prefs.getString(KEY_ACTIVE_PATH, "builtin"));
                obj.put("prevVersion", prefs.getString(KEY_PREV_VER, "builtin"));
                obj.put("pendingVersion", prefs.getString(KEY_PENDING_VER, "none"));
                obj.put("badVersion", prefs.getString(KEY_BAD_VER, ""));
                obj.put("bootLog", prefs.getString(KEY_BOOT_LOG, "none"));
                obj.put("bootStatus", prefs.getString(KEY_BOOT_STATUS, "SUCCESS"));
                obj.put("currentServerPath", MainActivity.this.bridge != null ? MainActivity.this.bridge.getServerBasePath() : "null");
                return obj.toString();
            } catch (Exception e) {
                return "{\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @Keep
        @JavascriptInterface
        public String syncResourcePack(String cacheFileName, String version, boolean applyImmediately) {
            try {
                File packFile = new File(ctx.getFilesDir(), cacheFileName);
                if (!packFile.exists()) {
                    return "ERR: Cache file missing at " + packFile.getAbsolutePath();
                }
                long packLen = packFile.length();
                if (packLen < 1000) {
                    return "ERR: Cache file too small (" + packLen + "B)";
                }

                File destDir = new File(ctx.getFilesDir(), "asset_packs/v_" + version.replaceAll("[^a-zA-Z0-9._-]", "_"));
                if (destDir.exists()) {
                    deleteRecursive(destDir);
                }
                destDir.mkdirs();

                int fileCount = 0;
                byte[] buffer = new byte[8192];
                try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(packFile)))) {
                    ZipEntry ze;
                    while ((ze = zis.getNextEntry()) != null) {
                        File outFile = new File(destDir, ze.getName());
                        String canonicalDest = destDir.getCanonicalPath();
                        String canonicalOut = outFile.getCanonicalPath();
                        if (!canonicalOut.startsWith(canonicalDest + File.separator)) {
                            continue;
                        }
                        if (ze.isDirectory()) {
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
                            fileCount++;
                        }
                        zis.closeEntry();
                    }
                }

                File indexCheck = new File(destDir, "index.html");
                if (!indexCheck.exists()) {
                    return "ERR: Extracted " + fileCount + " files, but index.html not in root";
                }

                if (packFile.exists()) {
                    packFile.delete();
                }

                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
                String prevPath = prefs.getString(KEY_PREV_PATH, null);

                File packsDir = new File(ctx.getFilesDir(), "asset_packs");
                if (packsDir.exists() && packsDir.isDirectory()) {
                    File[] files = packsDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (f.isDirectory()) {
                                String fPath = f.getAbsolutePath();
                                boolean isDest = fPath.equals(destDir.getAbsolutePath());
                                boolean isActive = activePath != null && fPath.equals(new File(activePath).getAbsolutePath());
                                boolean isPrev = prevPath != null && fPath.equals(new File(prevPath).getAbsolutePath());
                                if (!isDest && !isActive && !isPrev) {
                                    deleteRecursive(f);
                                }
                            }
                        }
                    }
                }

                String finalPath = destDir.getAbsolutePath();

                if (applyImmediately) {
                    String curVer = prefs.getString(KEY_ACTIVE_VER, null);
                    SharedPreferences.Editor ed = prefs.edit();
                    if (activePath != null && "SUCCESS".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS"))) {
                        ed.putString(KEY_PREV_PATH, activePath);
                        ed.putString(KEY_PREV_VER, curVer != null ? curVer : "cached");
                    }
                    ed.putString(KEY_ACTIVE_PATH, finalPath)
                        .putString(KEY_ACTIVE_VER, version)
                        .remove(KEY_PENDING_PATH)
                        .remove(KEY_PENDING_VER)
                        .putString(KEY_BOOT_STATUS, "PENDING")
                        .putString(KEY_BOOT_LOG, "Synced critical v" + version)
                        .apply();
                    runOnUiThread(() -> {
                        if (MainActivity.this.bridge != null) {
                            MainActivity.this.bridge.setServerBasePath(finalPath);
                            startWatchdogTimer();
                        }
                    });
                    return "OK_APPLIED:" + fileCount + "_files";
                } else {
                    prefs.edit()
                        .putString(KEY_PENDING_PATH, finalPath)
                        .putString(KEY_PENDING_VER, version)
                        .apply();
                    return "OK_STAGED:" + fileCount + "_files";
                }
            } catch (Exception e) {
                return "ERR_JAVA:" + e.getClass().getSimpleName() + ": " + e.getMessage();
            }
        }

        @Keep
        @JavascriptInterface
        public String activateStagedPack() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
                String pendingVer = prefs.getString(KEY_PENDING_VER, null);
                String curActivePath = prefs.getString(KEY_ACTIVE_PATH, null);
                String curActiveVer = prefs.getString(KEY_ACTIVE_VER, null);

                if (pendingPath == null) {
                    pendingPath = curActivePath;
                    pendingVer = curActiveVer;
                }
                if (pendingPath == null || !new File(pendingPath, "index.html").exists()) {
                    return "ERR: No staged pack on disk";
                }

                final String pathToApply = pendingPath;
                SharedPreferences.Editor ed = prefs.edit();
                if (curActivePath != null && !curActivePath.equals(pathToApply) && "SUCCESS".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS"))) {
                    ed.putString(KEY_PREV_PATH, curActivePath);
                    ed.putString(KEY_PREV_VER, curActiveVer != null ? curActiveVer : "cached");
                }
                ed.putString(KEY_ACTIVE_PATH, pathToApply)
                    .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "cached")
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_VER)
                    .putString(KEY_BOOT_STATUS, "PENDING")
                    .putString(KEY_BOOT_LOG, "Manual Sync v" + pendingVer)
                    .apply();

                cancelWatchdogTimer();

                runOnUiThread(() -> {
                    if (MainActivity.this.bridge != null) {
                        MainActivity.this.bridge.setServerBasePath(pathToApply);
                    }
                });
                return "OK_APPLIED:v" + pendingVer;
            } catch (Exception e) {
                return "ERR_APPLY:" + e.getMessage();
            }
        }

        private void deleteRecursive(File f) {
            if (f.isDirectory()) {
                File[] children = f.listFiles();
                if (children != null) {
                    for (File c : children) deleteRecursive(c);
                }
            }
            f.delete();
        }
    }

    @Keep
    public class NativeYandexAdsBridge {
        private final Context context;
        private RewardedAdLoader rewardedAdLoader;
        private RewardedAd rewardedAd;
        private boolean isAdLoading = false;

        public NativeYandexAdsBridge(Context context) {
            this.context = context;
        }

        private void runJs(final String jsCode) {
            runOnUiThread(() -> {
                try {
                    if (MainActivity.this.bridge != null && MainActivity.this.bridge.getWebView() != null) {
                        MainActivity.this.bridge.getWebView().evaluateJavascript(jsCode, null);
                    }
                } catch (Throwable e) {
                    e.printStackTrace();
                }
            });
        }

        @Keep
        @JavascriptInterface
        public void initialize(final String defaultAdUnitId) {
            runOnUiThread(() -> {
                try {
                    MobileAds.initialize(context, new InitializationListener() {
                        @Override
                        public void onInitializationCompleted() {
                            try {
                                setupLoader();
                                if (defaultAdUnitId != null && !defaultAdUnitId.isEmpty()) {
                                    loadRewardedAd(defaultAdUnitId);
                                }
                            } catch (Throwable t) {
                                t.printStackTrace();
                            }
                        }
                    });
                } catch (Throwable t) {
                    t.printStackTrace();
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Init error";
                    runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Native init error: " + msg + "');");
                }
            });
        }

        private void setupLoader() {
            if (rewardedAdLoader != null) return;
            try {
                rewardedAdLoader = new RewardedAdLoader(context);
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
                        String desc = adRequestError.getDescription() != null ? adRequestError.getDescription() : "Load error";
                        String safeDescription = desc.replace("'", "\\'");
                        runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('" + safeDescription + "');");
                    }
                });
            } catch (Throwable t) {
                t.printStackTrace();
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
                        String desc = adError.getDescription() != null ? adError.getDescription() : "Show error";
                        String safeDescription = desc.replace("'", "\\'");
                        runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('" + safeDescription + "');");
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
            } catch (Throwable t) {
                t.printStackTrace();
            }
        }

        @Keep
        @JavascriptInterface
        public void loadRewardedAd(final String adUnitId) {
            runOnUiThread(() -> {
                try {
                    if (isAdLoading || rewardedAd != null) return;
                    setupLoader();
                    if (rewardedAdLoader == null) {
                        runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Loader unavailable');");
                        return;
                    }
                    isAdLoading = true;
                    AdRequestConfiguration config = new AdRequestConfiguration.Builder(adUnitId).build();
                    rewardedAdLoader.loadAd(config);
                } catch (Throwable t) {
                    isAdLoading = false;
                    t.printStackTrace();
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Load exception";
                    runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('" + msg + "');");
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
                    }
                } catch (Throwable t) {
                    rewardedAd = null;
                    t.printStackTrace();
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Show exception";
                    runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('" + msg + "');");
                }
            });
        }
    }
}