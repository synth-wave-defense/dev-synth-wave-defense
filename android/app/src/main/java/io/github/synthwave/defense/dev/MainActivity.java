package io.github.synthwave.defense.dev;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "SynthWaveNativeOtaPrefs";
    private static final String KEY_ACTIVE_PATH = "active_ota_path";
    private static final String KEY_ACTIVE_VER = "active_ota_version";
    private static final String KEY_PENDING_PATH = "pending_ota_path";
    private static final String KEY_PENDING_VER = "pending_ota_version";
    private static final String KEY_APK_TIME = "last_apk_update_time";
    private static final String KEY_BOOT_LOG = "last_boot_ota_log";
    private static final String KEY_BOOT_STATUS = "ota_boot_status";

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().addJavascriptInterface(new NativeOtaBridge(this), "NativeOtaBridge");
            }
            checkAndApplyStartupOta();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void checkAndApplyStartupOta() {
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
                .remove(KEY_PENDING_PATH)
                .remove(KEY_PENDING_VER)
                .putString(KEY_BOOT_STATUS, "SUCCESS")
                .putString(KEY_BOOT_LOG, "Fresh APK install detected, reset OTA")
                .apply();
            return;
        }

        // Проверка сторожевого флага: если предыдущий запуск так и не сообщил об успехе (был SyntaxError или краш)
        String bootStatus = prefs.getString(KEY_BOOT_STATUS, "SUCCESS");
        if ("PENDING".equals(bootStatus)) {
            String deadVer = prefs.getString(KEY_ACTIVE_VER, "unknown");
            prefs.edit()
                .remove(KEY_ACTIVE_PATH)
                .remove(KEY_ACTIVE_VER)
                .putString(KEY_BOOT_STATUS, "ROLLED_BACK")
                .putString(KEY_BOOT_LOG, "Auto-rollback from crashed v" + deadVer + " to builtin")
                .apply();
            bootLog.append("Rollback due to boot crash; ");
        }

        // Применение ожидающего (staging) обновления
        String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
        String pendingVer = prefs.getString(KEY_PENDING_VER, null);
        if (pendingPath != null) {
            File pIdx = new File(pendingPath, "index.html");
            if (pIdx.exists()) {
                prefs.edit()
                    .putString(KEY_ACTIVE_PATH, pendingPath)
                    .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "ota")
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_VER)
                    .apply();
                bootLog.append("Promoted pending v").append(pendingVer).append("; ");
            } else {
                bootLog.append("Pending index.html missing; ");
            }
        }

        String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
        String activeVer = prefs.getString(KEY_ACTIVE_VER, "builtin");
        if (activePath != null) {
            File indexFile = new File(activePath, "index.html");
            if (indexFile.exists() && this.bridge != null) {
                // Ставим отметку ожидания проверки жизнеспособности бандла
                prefs.edit().putString(KEY_BOOT_STATUS, "PENDING").apply();
                this.bridge.setServerBasePath(activePath);
                bootLog.append("Loaded OTA v").append(activeVer);

                // Запускаем Watchdog: если через 6 секунд JS не вызовет markBootSuccessful, откатываемся
                startWatchdogTimer();
            } else {
                bootLog.append("Active index missing at ").append(activePath);
            }
        } else {
            bootLog.append("Running builtin APK assets");
        }
        prefs.edit().putString(KEY_BOOT_LOG, bootLog.toString()).apply();
    }

    private void startWatchdogTimer() {
        watchdogRunnable = () -> {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if ("PENDING".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS"))) {
                // Движок так и не отозвался: сбрасываем бандл и перезагружаем WebView на чистый APK
                prefs.edit()
                    .remove(KEY_ACTIVE_PATH)
                    .remove(KEY_ACTIVE_VER)
                    .putString(KEY_BOOT_STATUS, "WATCHDOG_ROLLBACK")
                    .putString(KEY_BOOT_LOG, "Watchdog triggered: JS failed to boot in 6s")
                    .apply();

                if (bridge != null && bridge.getWebView() != null) {
                    bridge.setServerBasePath(null);
                    bridge.getWebView().post(() -> bridge.getWebView().loadUrl(bridge.getServerUrl()));
                }
            }
        };
        watchdogHandler.postDelayed(watchdogRunnable, 6000);
    }

    public class NativeOtaBridge {
        private final Context ctx;
        public NativeOtaBridge(Context c) { this.ctx = c; }

        @JavascriptInterface
        public void markBootSuccessful() {
            if (watchdogRunnable != null) {
                watchdogHandler.removeCallbacks(watchdogRunnable);
            }
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_BOOT_STATUS, "SUCCESS").apply();
        }

        @JavascriptInterface
        public String getStatusJson() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                JSONObject obj = new JSONObject();
                obj.put("activeVersion", prefs.getString(KEY_ACTIVE_VER, "builtin"));
                obj.put("activePath", prefs.getString(KEY_ACTIVE_PATH, "builtin"));
                obj.put("pendingVersion", prefs.getString(KEY_PENDING_VER, "none"));
                obj.put("bootLog", prefs.getString(KEY_BOOT_LOG, "none"));
                obj.put("bootStatus", prefs.getString(KEY_BOOT_STATUS, "SUCCESS"));
                obj.put("currentServerPath", MainActivity.this.bridge != null ? MainActivity.this.bridge.getServerBasePath() : "null");
                return obj.toString();
            } catch (Exception e) {
                return "{\"error\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String unpackAndStage(String zipFileName, String version, boolean applyImmediately) {
            try {
                File zipFile = new File(ctx.getFilesDir(), zipFileName);
                if (!zipFile.exists()) {
                    return "ERR: Zip missing at " + zipFile.getAbsolutePath();
                }
                long zipLen = zipFile.length();
                if (zipLen < 1000) {
                    return "ERR: Zip too small (" + zipLen + "B)";
                }

                File destDir = new File(ctx.getFilesDir(), "ota_bundles/v_" + version.replaceAll("[^a-zA-Z0-9._-]", "_"));
                if (destDir.exists()) {
                    deleteRecursive(destDir);
                }
                destDir.mkdirs();

                int fileCount = 0;
                byte[] buffer = new byte[8192];
                try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new FileInputStream(zipFile)))) {
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
                    return "ERR: Unzipped " + fileCount + " files, but index.html not in root";
                }

                if (zipFile.exists()) {
                    zipFile.delete();
                }

                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
                File bundlesDir = new File(ctx.getFilesDir(), "ota_bundles");
                if (bundlesDir.exists() && bundlesDir.isDirectory()) {
                    File[] files = bundlesDir.listFiles();
                    if (files != null) {
                        for (File f : files) {
                            if (f.isDirectory()) {
                                boolean isDest = f.getAbsolutePath().equals(destDir.getAbsolutePath());
                                boolean isActive = activePath != null && f.getAbsolutePath().equals(new File(activePath).getAbsolutePath());
                                if (!isDest && !isActive) {
                                    deleteRecursive(f);
                                }
                            }
                        }
                    }
                }

                String finalPath = destDir.getAbsolutePath();

                if (applyImmediately) {
                    prefs.edit()
                        .putString(KEY_ACTIVE_PATH, finalPath)
                        .putString(KEY_ACTIVE_VER, version)
                        .remove(KEY_PENDING_PATH)
                        .remove(KEY_PENDING_VER)
                        .putString(KEY_BOOT_STATUS, "PENDING")
                        .putString(KEY_BOOT_LOG, "Applied immediately v" + version)
                        .apply();
                    runOnUiThread(() -> {
                        if (MainActivity.this.bridge != null) {
                            MainActivity.this.bridge.setServerBasePath(finalPath);
                        }
                    });
                    startWatchdogTimer();
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

        @JavascriptInterface
        public String applyPendingNow() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
                String pendingVer = prefs.getString(KEY_PENDING_VER, null);
                if (pendingPath == null) {
                    pendingPath = prefs.getString(KEY_ACTIVE_PATH, null);
                    pendingVer = prefs.getString(KEY_ACTIVE_VER, null);
                }
                if (pendingPath == null || !new File(pendingPath, "index.html").exists()) {
                    return "ERR: No staged bundle on disk";
                }
                final String pathToApply = pendingPath;
                prefs.edit()
                    .putString(KEY_ACTIVE_PATH, pathToApply)
                    .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "ota")
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_VER)
                    .putString(KEY_BOOT_STATUS, "PENDING")
                    .putString(KEY_BOOT_LOG, "Force applied v" + pendingVer)
                    .apply();
                runOnUiThread(() -> {
                    if (MainActivity.this.bridge != null) {
                        MainActivity.this.bridge.setServerBasePath(pathToApply);
                    }
                });
                startWatchdogTimer();
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
}