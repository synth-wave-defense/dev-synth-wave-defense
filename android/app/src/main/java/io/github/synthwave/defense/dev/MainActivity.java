package io.github.synthwave.defense.dev;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
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
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

@Keep
public class MainActivity extends BridgeActivity {
    private static final String TAG = "SynthWaveDiag";
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

    private static final String DIAG_PREFS = "SynthWaveDevDiagPrefs";
    private static final String KEY_PREV_LOG = "prev_session_log";
    private static final String KEY_CURR_LOG = "curr_session_log";
    private static final String KEY_LAST_CRASH = "last_crash_stack";
    private static final String KEY_LAST_EXIT = "last_exit_reason";

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable = null;
    private boolean isRollingBack = false;

    private final StringBuilder liveSessionLog = new StringBuilder();
    private long bootStartTimeMs = 0L;
    private NativeYandexAdsBridge adsBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        bootStartTimeMs = System.currentTimeMillis();
        installSilentCrashInterceptor();

        SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
        String prevCurrLog = dp.getString(KEY_CURR_LOG, "");
        String lastExit = dp.getString(KEY_LAST_EXIT, "NONE");

        if (prevCurrLog != null && !prevCurrLog.isEmpty()) {
            dp.edit().putString(KEY_PREV_LOG, prevCurrLog).commit();
        }

        dp.edit()
            .putString(KEY_CURR_LOG, "")
            .putString(KEY_LAST_EXIT, "RUNNING")
            .commit();

        recordStep("onCreate start | prevExit=" + lastExit);

        super.onCreate(savedInstanceState);
        recordStep("super.onCreate completed");

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                adsBridge = new NativeYandexAdsBridge(this);
                webView.addJavascriptInterface(new AssetCacheManager(this), "AssetCacheManager");
                webView.addJavascriptInterface(adsBridge, "NativeYandexAdsBridge");
                webView.addJavascriptInterface(adsBridge, "NativeAdsBridge");
                recordStep("JS Bridges attached (NativeYandexAdsBridge + AssetCacheManager)");
            } else {
                recordStep("WARN: bridge or WebView is null!");
            }

            verifyAndMountAssetCache();
        } catch (Throwable e) {
            recordStep("ERROR in onCreate init: " + Log.getStackTraceString(e));
        }
    }

    private void installSilentCrashInterceptor() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                String stack = Log.getStackTraceString(throwable);
                String tName = thread != null ? thread.getName() : "unknown";
                boolean isMainThread = (thread == Looper.getMainLooper().getThread());

                // Поглощаем сбои сторонних фоновых потоков (SDK Яндекса, OkHttp и др.)
                if (!isMainThread) {
                    recordStep("ABSORBED BG THREAD EXCEPTION [" + tName + "]: "
                        + throwable.getClass().getSimpleName() + " - " + throwable.getMessage());
                    return;
                }

                String header = "FATAL MAIN THREAD CRASH [" + tName + "]:\n"
                    + throwable.getClass().getName() + ": " + throwable.getMessage() + "\n" + stack;
                recordStep(header);

                SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
                dp.edit()
                    .putString(KEY_LAST_CRASH, header)
                    .putString(KEY_LAST_EXIT, "JAVA_CRASH: " + throwable.getClass().getSimpleName())
                    .commit();

                writeLogFileToDisk();
            } catch (Throwable ignored) {}

            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            } else {
                System.exit(1);
            }
        });
    }

    private synchronized void recordStep(String msg) {
        long elapsed = System.currentTimeMillis() - bootStartTimeMs;
        String timeStr = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(new Date());
        String line = "[" + timeStr + " | +" + elapsed + "ms] " + msg + "\n";
        liveSessionLog.append(line);
        Log.d(TAG, msg);

        try {
            SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
            dp.edit().putString(KEY_CURR_LOG, liveSessionLog.toString()).commit();
            writeLogFileToDisk();
        } catch (Throwable ignored) {}
    }

    private void writeLogFileToDisk() {
        try {
            SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
            String fullReport = buildFullDiagnosticText(dp);
            File extDir = getExternalFilesDir(null);
            if (extDir != null) {
                File out = new File(extDir, "crash_log.txt");
                try (FileOutputStream fos = new FileOutputStream(out, false)) {
                    fos.write(fullReport.getBytes(StandardCharsets.UTF_8));
                }
            }
        } catch (Throwable ignored) {}
    }

    private String buildFullDiagnosticText(SharedPreferences dp) {
        SharedPreferences otaPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        StringBuilder sb = new StringBuilder();
        sb.append("=== SYNTH WAVE STAGE DIAGNOSTIC LOG ===\n");
        sb.append("Package          : ").append(getPackageName()).append("\n");
        sb.append("Last Exit Reason : ").append(dp.getString(KEY_LAST_EXIT, "NONE")).append("\n");
        sb.append("OTA Active Ver   : ").append(otaPrefs.getString(KEY_ACTIVE_VER, "builtin")).append("\n");
        sb.append("OTA Pending Ver  : ").append(otaPrefs.getString(KEY_PENDING_VER, "none")).append("\n");
        sb.append("OTA Boot Status  : ").append(otaPrefs.getString(KEY_BOOT_STATUS, "SUCCESS")).append("\n");
        sb.append("OTA Boot Log     : ").append(otaPrefs.getString(KEY_BOOT_LOG, "none")).append("\n\n");

        String crashStack = dp.getString(KEY_LAST_CRASH, "");
        if (crashStack != null && !crashStack.isEmpty()) {
            sb.append("--- LAST CRASH STACK ---\n");
            sb.append(crashStack).append("\n\n");
        }

        String prevLog = dp.getString(KEY_PREV_LOG, "");
        if (prevLog != null && !prevLog.isEmpty()) {
            sb.append("--- PREVIOUS SESSION TIMELINE ---\n");
            sb.append(prevLog).append("\n");
        }

        sb.append("--- CURRENT SESSION TIMELINE ---\n");
        sb.append(liveSessionLog.toString()).append("\n");
        return sb.toString();
    }

    private void logCloseCall(String methodName) {
        long elapsed = System.currentTimeMillis() - bootStartTimeMs;
        String stack = Log.getStackTraceString(new Throwable("Caller of " + methodName));
        recordStep("CALLED " + methodName + " at +" + elapsed + "ms:\n" + stack);

        SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
        dp.edit().putString(KEY_LAST_EXIT, methodName + " at +" + elapsed + "ms").commit();
        writeLogFileToDisk();
    }

    @Override
    public void finish() {
        logCloseCall("finish()");
        super.finish();
    }

    @Override
    public void finishAffinity() {
        logCloseCall("finishAffinity()");
        super.finishAffinity();
    }

    @Override
    public void finishAndRemoveTask() {
        logCloseCall("finishAndRemoveTask()");
        super.finishAndRemoveTask();
    }

    @Override
    public boolean moveTaskToBack(boolean nonRoot) {
        logCloseCall("moveTaskToBack(" + nonRoot + ")");
        return super.moveTaskToBack(nonRoot);
    }

    @Override
    public void onPause() {
        recordStep("Lifecycle: onPause()");
        super.onPause();
    }

    @Override
    public void onStop() {
        recordStep("Lifecycle: onStop()");
        super.onStop();
    }

    @Override
    public void onDestroy() {
        recordStep("Lifecycle: onDestroy() | isFinishing=" + isFinishing());
        super.onDestroy();
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
                recordStep("Watchdog 8s timeout triggered -> restoring previous cache state");
                restorePreviousCacheState(prefs, "Watchdog timeout");
            }
        };
        watchdogHandler.postDelayed(watchdogRunnable, 8000);
    }

    private void restorePreviousCacheState(SharedPreferences prefs, String reason) {
        if (isRollingBack) return;
        isRollingBack = true;
        cancelWatchdogTimer();
        recordStep("restorePreviousCacheState called, reason: " + reason);

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
            recordStep("verifyAndMountAssetCache: Fresh APK install detected, cache reset to builtin");
            return;
        }

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

        String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
        String activeVer = prefs.getString(KEY_ACTIVE_VER, "builtin");
        if (activePath != null) {
            File indexFile = new File(activePath, "index.html");
            if (indexFile.exists() && this.bridge != null) {
                recordStep("verifyAndMountAssetCache: Mounting OTA pack v" + activeVer + " at " + activePath);
                this.bridge.setServerBasePath(activePath);
                bootLog.append("Loaded pack v").append(activeVer);
                if ("PENDING".equals(bootStatus)) {
                    startWatchdogTimer();
                }
            } else {
                recordStep("verifyAndMountAssetCache: Active index missing, falling back to builtin");
                this.bridge.setServerAssetPath("public");
                bootLog.append("Active index missing, loaded builtin");
            }
        } else {
            recordStep("verifyAndMountAssetCache: Running builtin APK assets");
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
        public void logJsDiagnostic(String msg) {
            recordStep("[JS] " + msg);
        }

        @Keep
        @JavascriptInterface
        public void confirmCacheValid() {
            recordStep("JS called confirmCacheValid() -> Boot marked SUCCESS");
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
                recordStep("JS called restoreBackupPack()");
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
            recordStep("JS called syncResourcePack: ver=" + version + ", immediate=" + applyImmediately);
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
                    recordStep("syncResourcePack applying immediately: setServerBasePath(" + finalPath + ")");
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
                    recordStep("syncResourcePack staged v" + version + " for next restart (" + fileCount + " files)");
                    prefs.edit()
                        .putString(KEY_PENDING_PATH, finalPath)
                        .putString(KEY_PENDING_VER, version)
                        .apply();
                    return "OK_STAGED:" + fileCount + "_files";
                }
            } catch (Exception e) {
                recordStep("syncResourcePack exception: " + e.getMessage());
                return "ERR_JAVA:" + e.getClass().getSimpleName() + ": " + e.getMessage();
            }
        }

        @Keep
        @JavascriptInterface
        public String activateStagedPack() {
            try {
                recordStep("JS called activateStagedPack()");
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
        private boolean isSdkInitialized = false;
        private boolean isInitializing = false;
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
                } catch (Throwable e) {
                    recordStep("YandexAds runJs error: " + e.getMessage());
                }
            });
        }

        @Keep
        @JavascriptInterface
        public void initialize(final String defaultAdUnitId) {
            recordStep("JS called NativeYandexAdsBridge.initialize(" + defaultAdUnitId + ")");
            if (defaultAdUnitId != null && !defaultAdUnitId.isEmpty()) {
                pendingAdUnitId = defaultAdUnitId;
            }
            runOnUiThread(() -> {
                try {
                    if (isSdkInitialized) {
                        recordStep("YandexAds already initialized -> loading " + pendingAdUnitId);
                        loadRewardedAd(pendingAdUnitId);
                        return;
                    }
                    if (isInitializing) {
                        recordStep("YandexAds initialization already in progress...");
                        return;
                    }
                    isInitializing = true;
                    recordStep("Calling MobileAds.initialize...");
                    MobileAds.initialize(context.getApplicationContext(), new InitializationListener() {
                        @Override
                        public void onInitializationCompleted() {
                            runOnUiThread(() -> {
                                try {
                                    isSdkInitialized = true;
                                    isInitializing = false;
                                    recordStep("MobileAds.onInitializationCompleted() SUCCESS");
                                    setupLoader();
                                    loadRewardedAd(pendingAdUnitId);
                                } catch (Throwable t) {
                                    recordStep("ERROR in onInitializationCompleted: " + Log.getStackTraceString(t));
                                }
                            });
                        }
                    });
                } catch (Throwable t) {
                    isInitializing = false;
                    recordStep("ERROR in MobileAds.initialize: " + Log.getStackTraceString(t));
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Init error";
                    runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Native init error: " + msg + "');");
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
                        recordStep("YandexAds: onAdLoaded SUCCESS");
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
                        recordStep("YandexAds: onAdFailedToLoad (" + adRequestError.getCode() + ": " + desc + ")");
                        String safeDescription = desc.replace("'", "\\'");
                        runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('" + safeDescription + "');");
                    }
                });
            } catch (Throwable t) {
                recordStep("ERROR in setupLoader: " + Log.getStackTraceString(t));
                rewardedAdLoader = null;
            }
        }

        private void attachEventListener(RewardedAd ad) {
            try {
                ad.setAdEventListener(new RewardedAdEventListener() {
                    @Override
                    public void onAdShown() {
                        recordStep("YandexAds: onAdShown");
                    }

                    @Override
                    public void onAdFailedToShow(@NonNull AdError adError) {
                        rewardedAd = null;
                        String desc = adError.getDescription() != null ? adError.getDescription() : "Show error";
                        recordStep("YandexAds: onAdFailedToShow (" + desc + ")");
                        String safeDescription = desc.replace("'", "\\'");
                        runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('" + safeDescription + "');");
                    }

                    @Override
                    public void onAdDismissed() {
                        recordStep("YandexAds: onAdDismissed");
                        rewardedAd = null;
                        isAdLoading = false;
                        runJs("if (window.onYandexAdDismissed) { window.onYandexAdDismissed(); }");
                        loadRewardedAd(pendingAdUnitId);
                    }

                    @Override
                    public void onAdClicked() {
                        recordStep("YandexAds: onAdClicked");
                    }

                    @Override
                    public void onRewarded(@NonNull Reward reward) {
                        recordStep("YandexAds: onRewarded!");
                        runJs("window.onYandexAdRewarded && window.onYandexAdRewarded();");
                    }

                    @Override
                    public void onAdImpression(@Nullable ImpressionData impressionData) {}
                });
            } catch (Throwable t) {
                recordStep("ERROR in attachEventListener: " + Log.getStackTraceString(t));
            }
        }

        @Keep
        @JavascriptInterface
        public void loadRewardedAd(final String adUnitId) {
            final String unitToLoad = (adUnitId != null && !adUnitId.isEmpty()) ? adUnitId : pendingAdUnitId;
            pendingAdUnitId = unitToLoad;
            recordStep("YandexAds.loadRewardedAd called for: " + unitToLoad + " | isSdkInit=" + isSdkInitialized);

            runOnUiThread(() -> {
                try {
                    if (!isSdkInitialized) {
                        recordStep("loadRewardedAd: SDK not initialized yet, calling initialize()");
                        initialize(unitToLoad);
                        return;
                    }
                    if (isAdLoading) {
                        recordStep("loadRewardedAd: already loading, ignoring duplicate call");
                        return;
                    }
                    if (rewardedAd != null) {
                        recordStep("loadRewardedAd: ad already in memory and ready -> notifying JS");
                        runJs("if (window.onYandexAdLoaded) { window.onYandexAdLoaded(); }");
                        return;
                    }

                    setupLoader();
                    if (rewardedAdLoader == null) {
                        runJs("if (window.onYandexAdFailedToLoad) { window.onYandexAdFailedToLoad('Loader unavailable'); }");
                        return;
                    }

                    isAdLoading = true;
                    recordStep("YandexAds: requesting ad from server (" + unitToLoad + ")...");
                    AdRequestConfiguration config = new AdRequestConfiguration.Builder(unitToLoad).build();
                    rewardedAdLoader.loadAd(config);
                } catch (Throwable t) {
                    isAdLoading = false;
                    recordStep("ERROR in loadRewardedAd: " + Log.getStackTraceString(t));
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Load exception";
                    runJs("if (window.onYandexAdFailedToLoad) { window.onYandexAdFailedToLoad('" + msg + "'); }");
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
            recordStep("JS called showRewardedAd() | adReady=" + (rewardedAd != null));
            runOnUiThread(() -> {
                try {
                    if (rewardedAd != null) {
                        rewardedAd.show(MainActivity.this);
                    } else {
                        recordStep("showRewardedAd