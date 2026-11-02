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
    private static final String KEY_PREV_PATH = "prev_ota_path";
    private static final String KEY_PREV_VER = "prev_ota_version";
    private static final String KEY_PENDING_PATH = "pending_ota_path";
    private static final String KEY_PENDING_VER = "pending_ota_version";
    private static final String KEY_BAD_VER = "bad_ota_version";
    private static final String KEY_APK_TIME = "last_apk_update_time";
    private static final String KEY_BOOT_LOG = "last_boot_ota_log";
    private static final String KEY_BOOT_STATUS = "ota_boot_status";

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable = null;

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
            if ("PENDING".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS"))) {
                performSilentRollback(prefs, "Watchdog timeout");
            }
        };
        watchdogHandler.postDelayed(watchdogRunnable, 5000);
    }

    private void performSilentRollback(SharedPreferences prefs, String reason) {
        cancelWatchdogTimer();
        String deadVer = prefs.getString(KEY_ACTIVE_VER, "");
        String prevPath = prefs.getString(KEY_PREV_PATH, null);
        String prevVer = prefs.getString(KEY_PREV_VER, "builtin");
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
            editor.putString(KEY_BOOT_LOG, reason + " -> Rolled back to v" + prevVer);
        } else {
            editor.remove(KEY_ACTIVE_PATH);
            editor.remove(KEY_ACTIVE_VER);
            editor.putString(KEY_BOOT_LOG, reason + " -> Rolled back to builtin APK");
        }
        editor.putString(KEY_BOOT_STATUS, "ROLLED_BACK");
        editor.apply();

        final String targetPath = canUsePrev ? prevPath : null;
        runOnUiThread(() -> {
            if (MainActivity.this.bridge != null) {
                if (targetPath != null) {
                    MainActivity.this.bridge.setServerBasePath(targetPath);
                } else {
                    MainActivity.this.bridge.setServerAssetPath("public");
                }
            }
        });
    }

    private void checkAndApplyStartupOta() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        StringBuilder bootLog = new StringBuilder();

        // 1. Сброс OTA при установке свежего APK поверх старого
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
                .putString(KEY_BOOT_LOG, "Fresh APK install detected, reset OTA")
                .apply();
            return;
        }

        // 2. Если предыдущий запуск упал (остался в PENDING), сразу переключаемся на prevPath (или builtin APK)
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
                bootLog.append("Auto-rollback to v").append(prevVer).append("; ");
            } else {
                ed.remove(KEY_ACTIVE_PATH)
                  .remove(KEY_ACTIVE_VER)
                  .putString(KEY_BOOT_STATUS, "ROLLED_BACK")
                  .apply();
                bootLog.append("Auto-rollback to builtin APK; ");
            }
            bootStatus = "ROLLED_BACK";
        }

        // 3. Продвижение ожидающей (pending) версии в активную при холодном старте
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
                    ed.putString(KEY_PREV_VER, curActiveVer != null ? curActiveVer : "ota");
                }
                ed.putString(KEY_ACTIVE_PATH, pendingPath)
                  .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "ota")
                  .remove(KEY_PENDING_PATH)
                  .remove(KEY_PENDING_VER)
                  .putString(KEY_BOOT_STATUS, "PENDING")
                  .apply();
                bootStatus = "PENDING";
                bootLog.append("Promoted v").append(pendingVer).append("; ");
            } else {
                prefs.edit().remove(KEY_PENDING_PATH).remove(KEY_PENDING_VER).apply();
                bootLog.append("Pending index missing; ");
            }
        }

        // 4. Загрузка активной версии
        String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
        String activeVer = prefs.getString(KEY_ACTIVE_VER, "builtin");
        if (activePath != null) {
            File indexFile = new File(activePath, "index.html");
            if (indexFile.exists() && this.bridge != null) {
                this.bridge.setServerBasePath(activePath);
                bootLog.append("Loaded OTA v").append(activeVer);
                if ("PENDING".equals(bootStatus)) {
                    startWatchdogTimer();
                }
            } else {
                this.bridge.setServerAssetPath("public");
                bootLog.append("Active index missing, loaded builtin");
            }
        } else {
            bootLog.append("Running builtin APK");
        }
        prefs.edit().putString(KEY_BOOT_LOG, bootLog.toString()).apply();
    }

    public class NativeOtaBridge {
        private final Context ctx;
        public NativeOtaBridge(Context c) { this.ctx = c; }

        @JavascriptInterface
        public void markBootSuccessful() {
            cancelWatchdogTimer();
            SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String activePath = prefs.getString(KEY_ACTIVE_PATH, null);
            String activeVer = prefs.getString(KEY_ACTIVE_VER, null);
            SharedPreferences.Editor ed = prefs.edit();
            ed.putString(KEY_BOOT_STATUS, "SUCCESS");
            if (activePath != null && new File(activePath, "index.html").exists()) {
                ed.putString(KEY_PREV_PATH, activePath);
                ed.putString(KEY_PREV_VER, activeVer != null ? activeVer : "ota");
            }
            ed.apply();
        }

        @JavascriptInterface
        public String rollbackToPreviousNow() {
            try {
                SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                performSilentRollback(prefs, "JS boot error");
                return "OK_ROLLBACK";
            } catch (Exception e) {
                return "ERR_ROLLBACK:" + e.getMessage();
            }
        }

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
                String prevPath = prefs.getString(KEY_PREV_PATH, null);

                File bundlesDir = new File(ctx.getFilesDir(), "ota_bundles");
                if (bundlesDir.exists() && bundlesDir.isDirectory()) {
                    File[] files = bundlesDir.listFiles();
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
                        ed.putString(KEY_PREV_VER, curVer != null ? curVer : "ota");
                    }
                    ed.putString(KEY_ACTIVE_PATH, finalPath)
                      .putString(KEY_ACTIVE_VER, version)
                      .remove(KEY_PENDING_PATH)
                      .remove(KEY_PENDING_VER)
                      .putString(KEY_BOOT_STATUS, "PENDING")
                      .putString(KEY_BOOT_LOG, "Applied critical v" + version)
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

        @JavascriptInterface
        public String applyPendingNow() {
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
                    return "ERR: No staged bundle on disk";
                }

                final String pathToApply = pendingPath;
                SharedPreferences.Editor ed = prefs.edit();
                if (curActivePath != null && !curActivePath.equals(pathToApply) && "SUCCESS".equals(prefs.getString(KEY_BOOT_STATUS, "SUCCESS"))) {
                    ed.putString(KEY_PREV_PATH, curActivePath);
                    ed.putString(KEY_PREV_VER, curActiveVer != null ? curActiveVer : "ota");
                }
                ed.putString(KEY_ACTIVE_PATH, pathToApply)
                  .putString(KEY_ACTIVE_VER, pendingVer != null ? pendingVer : "ota")
                  .remove(KEY_PENDING_PATH)
                  .remove(KEY_PENDING_VER)
                  .putString(KEY_BOOT_STATUS, "PENDING")
                  .putString(KEY_BOOT_LOG, "Manual Dev Apply v" + pendingVer)
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
}