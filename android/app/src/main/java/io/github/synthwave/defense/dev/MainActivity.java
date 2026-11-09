package io.github.synthwave.defense.dev;

import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
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
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
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

    // Диагностические ключи для хранения краш-логов между перезапусками
    private static final String DIAG_PREFS = "SynthWaveCrashDiagPrefs";
    private static final String KEY_PREV_SESSION_LOG = "prev_session_log";
    private static final String KEY_CURR_SESSION_LOG = "curr_session_log";
    private static final String KEY_LAST_CRASH_STACK = "last_crash_stack";
    private static final String KEY_LAST_EXIT_REASON = "last_exit_reason";
    private static final String KEY_SESSION_START_TS = "session_start_ts";
    private static final String KEY_SESSION_CLEAN_BOOT = "session_clean_boot";
    private static final String KEY_SAFE_MODE_NEXT = "safe_mode_next_boot";

    private final Handler watchdogHandler = new Handler(Looper.getMainLooper());
    private Runnable watchdogRunnable = null;
    private boolean isRollingBack = false;

    private long bootStartTimeMs = 0L;
    private boolean safeModeActive = false;
    private boolean isDiagDialogShowing = false;
    private boolean allowExplicitFinish = false;
    private final StringBuilder liveSessionLog = new StringBuilder();

    @Override
    public void onCreate(Bundle savedInstanceState) {
        bootStartTimeMs = System.currentTimeMillis();
        installGlobalCrashInterceptor();

        SharedPreferences diagPrefs = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
        String prevCurrLog = diagPrefs.getString(KEY_CURR_SESSION_LOG, "");
        String lastCrashStack = diagPrefs.getString(KEY_LAST_CRASH_STACK, "");
        String lastExitReason = diagPrefs.getString(KEY_LAST_EXIT_REASON, "NONE");
        long prevStartTs = diagPrefs.getLong(KEY_SESSION_START_TS, 0L);
        boolean prevCleanBoot = diagPrefs.getBoolean(KEY_SESSION_CLEAN_BOOT, true);
        safeModeActive = diagPrefs.getBoolean(KEY_SAFE_MODE_NEXT, false);

        // Определяем, был ли прошлый запуск аварийным или оборвался в первые 12 секунд
        boolean hadCrash = (lastCrashStack != null && !lastCrashStack.isEmpty());
        boolean hadAbnormalEarlyExit = !prevCleanBoot && prevStartTs > 0;
        boolean shouldShowReportOnStart = hadCrash || hadAbnormalEarlyExit || safeModeActive;

        // Сохраняем лог прошлой сессии в архив перед стартом новой
        if (prevCurrLog != null && !prevCurrLog.isEmpty()) {
            diagPrefs.edit().putString(KEY_PREV_SESSION_LOG, prevCurrLog).commit();
        }

        // Инициализируем новую сессию (флаг clean_boot станет true только после 12 секунд стабильной работы)
        diagPrefs.edit()
            .putString(KEY_CURR_SESSION_LOG, "")
            .putLong(KEY_SESSION_START_TS, bootStartTimeMs)
            .putBoolean(KEY_SESSION_CLEAN_BOOT, false)
            .putBoolean(KEY_SAFE_MODE_NEXT, false)
            .commit();

        recordStep("onCreate start | safeMode=" + safeModeActive + " | prevExit=" + lastExitReason);

        super.onCreate(savedInstanceState);
        recordStep("super.onCreate completed");

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                this.bridge.getWebView().addJavascriptInterface(new AssetCacheManager(this), "AssetCacheManager");
                this.bridge.getWebView().addJavascriptInterface(new NativeYandexAdsBridge(this), "NativeYandexAdsBridge");
                recordStep("JS Bridges attached (AssetCacheManager, NativeYandexAdsBridge)");
            } else {
                recordStep("WARN: bridge or WebView is null after super.onCreate");
            }

            if (safeModeActive) {
                recordStep("SAFE MODE ACTIVE: skipping verifyAndMountAssetCache, forcing builtin assets");
                if (this.bridge != null) {
                    this.bridge.setServerAssetPath("public");
                }
            } else if (shouldShowReportOnStart) {
                recordStep("DIAG PAUSE: Holding OTA mount until user reviews previous crash/exit log");
            } else {
                verifyAndMountAssetCache();
            }
        } catch (Throwable e) {
            recordStep("ERROR in onCreate init: " + Log.getStackTraceString(e));
        }

        // Добавляем плавающую кнопку "🐞 LOG" поверх WebView
        attachFloatingLogButton();

        // Через 12 секунд стабильной работы помечаем запуск как успешный
        watchdogHandler.postDelayed(() -> {
            getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_SESSION_CLEAN_BOOT, true)
                .commit();
            recordStep("12s stability mark reached (clean boot = true)");
        }, 12000);

        // Если прошлый запуск упал или закрылся сразу — замораживаем таймеры и показываем отчет
        if (shouldShowReportOnStart) {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                try {
                    this.bridge.getWebView().pauseTimers();
                    recordStep("WebView timers paused for diagnostic inspection");
                } catch (Throwable ignored) {}
            }
            watchdogHandler.postDelayed(() -> showDiagnosticDialog(true), 250);
        }
    }

	private void installGlobalCrashInterceptor() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                String stack = Log.getStackTraceString(throwable);
                String tName = thread != null ? thread.getName() : "unknown";
                boolean isMainThread = (thread == Looper.getMainLooper().getThread());

                // Проверяем, является ли это фоновым крашем рекламного SDK / корутин
                boolean isBgSdkCrash = !isMainThread && (
                    tName.contains("YandexAds") ||
                    tName.contains("ExoPlayer") ||
                    tName.contains(" OkHttp") ||
                    stack.contains("com.monetization.ads") ||
                    stack.contains("com.yandex.mobile.ads") ||
                    stack.contains("CompletionHandlerException")
                );

                if (isBgSdkCrash) {
                    // Поглощаем ошибку фонового потока SDK без закрытия игры!
                    recordStep("SUPPRESSED BG SDK EXCEPTION on [" + tName + "]: "
                        + throwable.getClass().getSimpleName() + " - " + throwable.getMessage());
                    return;
                }

                String header = "FATAL UNCAUGHT EXCEPTION on thread [" + tName + "]:\n"
                    + throwable.getClass().getName() + ": " + throwable.getMessage() + "\n" + stack;

                recordStep(header);

                SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
                dp.edit()
                    .putString(KEY_LAST_CRASH_STACK, header)
                    .putString(KEY_LAST_EXIT_REASON, "JAVA_CRASH (" + throwable.getClass().getSimpleName() + " on " + tName + ")")
                    .putBoolean(KEY_SESSION_CLEAN_BOOT, false)
                    .commit();

                writeLogFileToDisk();

                // Если краш случился не на главном потоке, также не убиваем процесс
                if (!isMainThread) {
                    recordStep("Non-main thread crash absorbed to keep app alive: " + tName);
                    return;
                }
            } catch (Throwable ignored) {
            }

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
        Log.d("SynthWaveDiag", msg);

        try {
            SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
            dp.edit().putString(KEY_CURR_SESSION_LOG, liveSessionLog.toString()).commit();
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
        sb.append("=== SYNTH WAVE DEFENSE DIAGNOSTIC REPORT ===\n");
        sb.append("Last Exit Reason : ").append(dp.getString(KEY_LAST_EXIT_REASON, "NONE")).append("\n");
        sb.append("Safe Mode Active : ").append(safeModeActive).append("\n");
        sb.append("OTA Active Ver   : ").append(otaPrefs.getString(KEY_ACTIVE_VER, "builtin")).append("\n");
        sb.append("OTA Pending Ver  : ").append(otaPrefs.getString(KEY_PENDING_VER, "none")).append("\n");
        sb.append("OTA Boot Status  : ").append(otaPrefs.getString(KEY_BOOT_STATUS, "SUCCESS")).append("\n");
        sb.append("OTA Boot Log     : ").append(otaPrefs.getString(KEY_BOOT_LOG, "none")).append("\n\n");

        String crashStack = dp.getString(KEY_LAST_CRASH_STACK, "");
        if (crashStack != null && !crashStack.isEmpty()) {
            sb.append("--- LAST FATAL CRASH / STACK TRACE ---\n");
            sb.append(crashStack).append("\n\n");
        }

        String prevLog = dp.getString(KEY_PREV_SESSION_LOG, "");
        if (prevLog != null && !prevLog.isEmpty()) {
            sb.append("--- PREVIOUS LAUNCH TIMELINE ---\n");
            sb.append(prevLog).append("\n");
        }

        sb.append("--- CURRENT LAUNCH TIMELINE ---\n");
        sb.append(liveSessionLog.toString()).append("\n");
        return sb.toString();
    }

    private void attachFloatingLogButton() {
        runOnUiThread(() -> {
            try {
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT
                );
                lp.gravity = Gravity.TOP | Gravity.START;
                lp.topMargin = dpToPx(36);
                lp.leftMargin = dpToPx(10);

                Button btn = new Button(this);
                btn.setText("🐞 LOG");
                btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
                btn.setTextColor(Color.parseColor("#00e5ff"));
                btn.setBackgroundColor(Color.argb(190, 6, 7, 13));
                btn.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
                btn.setAllCaps(false);
                btn.setOnClickListener(v -> showDiagnosticDialog(false));

                addContentView(btn, lp);
            } catch (Throwable e) {
                recordStep("Failed to attach floating log button: " + e.getMessage());
            }
        });
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private void showDiagnosticDialog(final boolean isStartupIntercept) {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            isDiagDialogShowing = true;

            final SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
            final String reportText = buildFullDiagnosticText(dp);

            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setBackgroundColor(Color.parseColor("#0b0f19"));
            int pad = dpToPx(14);
            root.setPadding(pad, pad, pad, pad);

            TextView titleView = new TextView(this);
            titleView.setText(isStartupIntercept
                ? "⚠️ Перехвачено закрытие / сбой при старте"
                : "🐞 Журнал диагностики запуска");
            titleView.setTextColor(Color.parseColor("#00e5ff"));
            titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
            titleView.setTypeface(Typeface.DEFAULT_BOLD);
            root.addView(titleView);

            TextView subView = new TextView(this);
            subView.setText("Файл также сохранен в: Android/data/" + getPackageName() + "/files/crash_log.txt");
            subView.setTextColor(Color.parseColor("#94a3b8"));
            subView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
            subView.setPadding(0, dpToPx(4), 0, dpToPx(8));
            root.addView(subView);

            ScrollView scroll = new ScrollView(this);
            LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dpToPx(340)
            );
            scroll.setLayoutParams(scrollLp);
            scroll.setBackgroundColor(Color.parseColor("#05070c"));

            final TextView logTv = new TextView(this);
            logTv.setText(reportText);
            logTv.setTextColor(Color.parseColor("#e2e8f0"));
            logTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.5f);
            logTv.setTypeface(Typeface.MONOSPACE);
            logTv.setTextIsSelectable(true);
            int innerPad = dpToPx(8);
            logTv.setPadding(innerPad, innerPad, innerPad, innerPad);
            scroll.addView(logTv);
            root.addView(scroll);

            AlertDialog.Builder builder = new AlertDialog.Builder(this);
            builder.setView(root);
            builder.setCancelable(false);

            builder.setPositiveButton("📋 Скопировать", null);
            builder.setNeutralButton("🛡 Safe Mode (Без OTA/РСЯ)", null);
            builder.setNegativeButton("▶️ Продолжить", null);

            final AlertDialog dialog = builder.create();
            dialog.show();

            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                try {
                    String latest = buildFullDiagnosticText(dp);
                    logTv.setText(latest);
                    ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) {
                        cm.setPrimaryClip(ClipData.newPlainText("SynthWaveCrashLog", latest));
                    }
                    Toast.makeText(this, "Лог скопирован в буфер обмена!", Toast.LENGTH_SHORT).show();
                } catch (Throwable e) {
                    Toast.makeText(this, "Ошибка копирования: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                }
            });

            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v -> {
                isDiagDialogShowing = false;
                safeModeActive = true;
                recordStep("User activated SAFE MODE (Resetting OTA to builtin & disabling Yandex Ads)");

                // Очищаем OTA-пути, чтобы гарантированно грузился встроенный APK
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .remove(KEY_ACTIVE_PATH)
                    .remove(KEY_ACTIVE_VER)
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_VER)
                    .putString(KEY_BOOT_STATUS, "SUCCESS")
                    .putString(KEY_BOOT_LOG, "Safe Mode Reset to builtin")
                    .commit();

                dp.edit()
                    .putString(KEY_LAST_CRASH_STACK, "")
                    .putString(KEY_LAST_EXIT_REASON, "SAFE_MODE_RESET")
                    .putBoolean(KEY_SESSION_CLEAN_BOOT, true)
                    .commit();

                dialog.dismiss();
                if (this.bridge != null) {
                    if (this.bridge.getWebView() != null) {
                        this.bridge.getWebView().resumeTimers();
                    }
                    this.bridge.setServerAssetPath("public");
                }
            });

            dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> {
                isDiagDialogShowing = false;
                dp.edit()
                    .putString(KEY_LAST_CRASH_STACK, "")
                    .putBoolean(KEY_SESSION_CLEAN_BOOT, true)
                    .commit();
                dialog.dismiss();

                if (isStartupIntercept) {
                    recordStep("User chose normal continue after intercept -> mounting cache & resuming timers");
                    if (this.bridge != null && this.bridge.getWebView() != null) {
                        this.bridge.getWebView().resumeTimers();
                    }
                    if (!safeModeActive) {
                        verifyAndMountAssetCache();
                    }
                }
            });
        });
    }

    // Перехват любых попыток программно закрыть или свернуть Activity в первые 10 секунд
    private boolean shouldInterceptAutoClose(String methodName) {
        long elapsed = System.currentTimeMillis() - bootStartTimeMs;
        String callerStack = Log.getStackTraceString(new Throwable("Caller of " + methodName));
        recordStep("INTERCEPTED " + methodName + " at +" + elapsed + "ms!\nStack:\n" + callerStack);

        SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
        dp.edit()
            .putString(KEY_LAST_EXIT_REASON, methodName + " called at +" + elapsed + "ms")
            .putString(KEY_LAST_CRASH_STACK, "App called " + methodName + ":\n" + callerStack)
            .commit();

        if (!allowExplicitFinish && (elapsed < 10000 || isDiagDialogShowing)) {
            recordStep("BLOCKED automatic " + methodName + " (within 10s boot protection window)");
            showDiagnosticDialog(false);
            return true;
        }
        return false;
    }

    @Override
    public void finish() {
        if (shouldInterceptAutoClose("finish()")) return;
        super.finish();
    }

    @Override
    public void finishAffinity() {
        if (shouldInterceptAutoClose("finishAffinity()")) return;
        super.finishAffinity();
    }

    @Override
    public void finishAndRemoveTask() {
        if (shouldInterceptAutoClose("finishAndRemoveTask()")) return;
        super.finishAndRemoveTask();
    }

    @Override
    public boolean moveTaskToBack(boolean nonRoot) {
        if (shouldInterceptAutoClose("moveTaskToBack(" + nonRoot + ")")) return false;
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
        SharedPreferences dp = getSharedPreferences(DIAG_PREFS, Context.MODE_PRIVATE);
        if ("NONE".equals(dp.getString(KEY_LAST_EXIT_REASON, "NONE"))) {
            dp.edit().putString(KEY_LAST_EXIT_REASON, "onDestroy (isFinishing=" + isFinishing() + ")").commit();
        }
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
            recordStep("JS called syncResourcePack: ver=" + version + ", immediate=" + applyImmediately + ", safeMode=" + safeModeActive);
            if (safeModeActive) {
                recordStep("syncResourcePack blocked by Safe Mode");
                return "ERR: Blocked in Safe Mode";
            }
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
            recordStep("JS called NativeYandexAdsBridge.initialize(" + defaultAdUnitId + ") | safeMode=" + safeModeActive);
            if (safeModeActive) {
                recordStep("YandexAds initialize skipped due to Safe Mode");
                return;
            }
            runOnUiThread(() -> {
                try {
                    recordStep("Calling MobileAds.initialize...");
                    MobileAds.initialize(context.getApplicationContext(), new InitializationListener() {
                        @Override
                        public void onInitializationCompleted() {
                            try {
                                isSdkInitialized = true;
                                recordStep("MobileAds.onInitializationCompleted()");
                                setupLoader();
                                if (defaultAdUnitId != null && !defaultAdUnitId.isEmpty()) {
                                    loadRewardedAd(defaultAdUnitId);
                                }
                            } catch (Throwable t) {
                                recordStep("ERROR in onInitializationCompleted: " + Log.getStackTraceString(t));
                            }
                        }
                    });
                } catch (Throwable t) {
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
                        recordStep("YandexAds: onAdLoaded");
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
                        recordStep("YandexAds: onAdFailedToLoad (" + desc + ")");
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
                        runJs("window.onYandexAdDismissed && window.onYandexAdDismissed();");
                    }

                    @Override
                    public void onAdClicked() {}

                    @Override
                    public void onRewarded(@NonNull Reward reward) {
                        recordStep("YandexAds: onRewarded");
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
            if (safeModeActive) return;
            runOnUiThread(() -> {
                try {
                    if (!isSdkInitialized) {
                        recordStep("loadRewardedAd deferred: MobileAds SDK not initialized yet");
                        return;
                    }
                    if (isAdLoading || rewardedAd != null) return;
                    setupLoader();
                    if (rewardedAdLoader == null) {
                        runJs("window.onYandexAdFailedToLoad && window.onYandexAdFailedToLoad('Loader unavailable');");
                        return;
                    }
                    isAdLoading = true;
                    recordStep("YandexAds: loading rewarded ad (" + adUnitId + ")");
                    AdRequestConfiguration config = new AdRequestConfiguration.Builder(adUnitId).build();
                    rewardedAdLoader.loadAd(config);
                } catch (Throwable t) {
                    isAdLoading = false;
                    recordStep("ERROR in loadRewardedAd: " + Log.getStackTraceString(t));
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
                    recordStep("ERROR in showRewardedAd: " + Log.getStackTraceString(t));
                    String msg = t.getMessage() != null ? t.getMessage().replace("'", "\\'") : "Show exception";
                    runJs("window.onYandexAdFailedToShow && window.onYandexAdFailedToShow('" + msg + "');");
                }
            });
        }
    }
}