// tests/smoke.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Synth Wave Defense — Full Core & Meta Smoke Suite (Non-Stop Report)', () => {
  test('Прогон всех 20 проверок до конца с полным отчётом', async ({ page }) => {
    const fatalErrors = [];
    const report = [];

    // Универсальный раннер: ловит ошибку конкретной проверки, но даёт тесту идти дальше
    async function runCheck(code, title, fn) {
      try {
        const detail = await fn();
        const suffix = detail ? ` (${detail})` : '';
        console.log(`✅ [${code}] ${title}${suffix}`);
        report.push({ code, title, status: 'PASS', detail: detail || '' });
      } catch (err) {
        const reason = String(err && err.message ? err.message : err).split('\n')[0];
        console.error(`❌ [${code}] ${title} -> ОШИБКА: ${reason}`);
        report.push({ code, title, status: 'FAIL', detail: reason });
      }
    }

    page.on('pageerror', (err) => {
      const msg = String(err && err.message ? err.message : err);
      if (msg.includes('Unable to decode audio data')) return;
      fatalErrors.push(msg);
    });

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.startsWith('http://127.0.0.1') ||
        url.startsWith('http://localhost') ||
        url.startsWith('data:') ||
        url.startsWith('blob:')
      ) {
        return route.continue();
      }
      return route.abort();
    });

    await page.addInitScript(() => {
      try {
        localStorage.clear();
        localStorage.setItem('dev_auth_token', 'MTMzNw==');
      } catch (e) {}
    });

    // =========================================================
    // ЧАСТЬ 1. БАЗОВЫЙ SMOKE (1–11)
    // =========================================================

    await runCheck('1/20', 'Игра запускается и открывает главное меню', async () => {
      await page.goto('/index.html');
      await page.waitForFunction(() => window.__gameBooted === true, null, { timeout: 10000 });

      const goLoaderBtn = page.locator('#initialLoadingScreen button');
      await expect(goLoaderBtn).toBeVisible({ timeout: 10000 });
      await goLoaderBtn.click({ force: true });

      const startScreen = page.locator('#startScreen');
      await expect(startScreen).not.toHaveClass(/hidden/, { timeout: 5000 });

      await page.evaluate(() => {
        if (typeof closeDailyLoginModal === 'function') closeDailyLoginModal();
      });
    });

    await runCheck('3/20', 'Музыка в меню инициализирована', async () => {
      const menuMusicState = await page.evaluate(() => {
        if (typeof musicUnlock === 'function') musicUnlock();
        if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
        const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
        return { ok: true, cat };
      });
      expect(menuMusicState.ok).toBe(true);
      expect(menuMusicState.cat).toBe('menu');
      return `категория: ${menuMusicState.cat}`;
    });

    await runCheck('5/20', 'Звуки игры (SFX и манифест) активны', async () => {
      const sfxCheck = await page.evaluate(() => {
        if (typeof SFX === 'undefined' || !SFX) return { ok: false, reason: 'SFX missing' };
        const manifestKeys = (typeof window.SFX_MANIFEST === 'object' && window.SFX_MANIFEST)
          ? Object.keys(window.SFX_MANIFEST)
          : [];
        if (manifestKeys.length === 0) return { ok: false, reason: 'SFX_MANIFEST empty' };
        try {
          SFX.unlock();
          const names = typeof SFX._names === 'function' ? SFX._names() : [];
          SFX.play('tap');
          return { ok: true, count: names.length, manifestCount: manifestKeys.length };
        } catch (e) {
          return { ok: false, reason: e.message };
        }
      });
      expect(sfxCheck.ok).toBe(true);
      expect(sfxCheck.manifestCount).toBeGreaterThan(0);
      return `манифест: ${sfxCheck.manifestCount}, пресетов: ${sfxCheck.count}`;
    });

    await runCheck('2/20', 'Выбор и загрузка уровня', async () => {
      await page.locator('#mainPlayBtn').click({ force: true });
      await expect(page.locator('#levelsScreen')).not.toHaveClass(/hidden/, { timeout: 3000 });

      const firstLevelBtn = page.locator('#levelsGrid button, #levelsGrid > div').first();
      await expect(firstLevelBtn).toBeVisible({ timeout: 3000 });
      await firstLevelBtn.click({ force: true });

      await page.evaluate(() => {
        if (typeof skipTutorial === 'function') skipTutorial();
      });

      await expect(page.locator('#levelsScreen')).toHaveClass(/hidden/, { timeout: 3000 });
      await expect(page.locator('#waveBtn')).toBeVisible({ timeout: 3000 });
    });

    await runCheck('4/20', 'Музыка в битве активна', async () => {
      const battleMusicState = await page.evaluate(() => {
        if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
        const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
        return { ok: true, cat };
      });
      expect(battleMusicState.ok).toBe(true);
      expect(battleMusicState.cat).toBe('battle');
      return `категория: ${battleMusicState.cat}`;
    });

    await runCheck('6/20', 'По нажатию на GO появляются мобы', async () => {
      // На случай, если шаг 2 не загрузил бой — принудительно открываем 1 уровень
      await page.evaluate(() => {
        if (gameState !== 'PLAYING') {
          startSpecificLevel(1);
          if (typeof skipTutorial === 'function') skipTutorial();
        }
      });
      await page.locator('#waveBtn').click({ force: true });
      await page.waitForFunction(
        () => typeof enemies !== 'undefined' && Array.isArray(enemies) && enemies.length > 0,
        null,
        { timeout: 5000 }
      );
    });

    // Подготавливаем 2-й уровень для проверки постройки, апгрейда и продажи
    await page.evaluate(() => {
      maxUnlockedLevel = 2;
      startSpecificLevel(2);
      if (typeof skipTutorial === 'function') skipTutorial();
    });

    await runCheck('7/20', 'Постройка башни', async () => {
      const buildResult = await page.evaluate(() => {
        let freeR = -1;
        let freeC = -1;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === 0) {
              freeR = r;
              freeC = c;
              break;
            }
          }
          if (freeR !== -1) break;
        }
        if (freeR === -1) return { ok: false, reason: 'no free cell' };

        gold = Math.max(gold, 500);
        const placed = buildTowerAt('gun', freeC, freeR);
        return { ok: placed === true && towers.length === 1 };
      });
      expect(buildResult.ok).toBe(true);
    });

    await runCheck('8/20', 'Улучшение башни до Lv.2', async () => {
      const upgradeResult = await page.evaluate(() => {
        // Если шаг 7 упал и башни нет — создаём тестовую, чтобы проверить сам апгрейд
        if (towers.length === 0) {
          towers.push({ c: 0, r: 0, x: 35, y: 35, type: 'gun', level: 1, totalInvested: 50, damage: 10, range: 120, fireRate: 0.5, color: '#00e5ff' });
        }
        const t = towers[0];
        gold = Math.max(gold, 500);
        selectedTower = t;
        upgradeSelectedTower();
        return { ok: t.level === 2, level: t.level };
      });
      expect(upgradeResult.ok).toBe(true);
    });

    await runCheck('9/20', 'Продажа башни с возвратом золота', async () => {
      const sellResult = await page.evaluate(() => {
        if (towers.length === 0) {
          towers.push({ c: 0, r: 0, x: 35, y: 35, type: 'gun', level: 1, totalInvested: 50, damage: 10, range: 120, fireRate: 0.5, color: '#00e5ff' });
        }
        const t = towers[0];
        const goldBefore = gold;
        selectedTower = t;
        sellSelectedTower();
        sellSelectedTower();
        return { ok: towers.length === 0 && gold > goldBefore };
      });
      expect(sellResult.ok).toBe(true);
    });

    await runCheck('10/20', 'Победа на уровне (#victoryScreen)', async () => {
      await page.evaluate(() => {
        clearedLevels = [1, 2];
        maxUnlockedLevel = 3;
        spawnQueue = [];
        enemies = [];
        triggerVictory();
      });
      await expect(page.locator('#victoryScreen')).not.toHaveClass(/hidden/, { timeout: 3000 });
    });

    // =========================================================
    // ЧАСТЬ 2. РЕКЛАМА, ПОРАЖЕНИЕ, REVIVE, DEV-МЕНЮ, ENDLESS, HARDCORE
    // =========================================================

    await runCheck('12/20', 'Просмотр рекламы (NativeYandexAdsBridge + CLAIM x2)', async () => {
      const adClaimResult = await page.evaluate(async () => {
        window.NativeYandexAdsBridge = {
          initialize: () => {},
          loadRewardedAd: () => {
            if (typeof window.onYandexAdLoaded === 'function') window.onYandexAdLoaded();
          },
          isRewardedAdReady: () => true,
          showRewardedAd: () => {
            if (typeof window.onYandexAdRewarded === 'function') window.onYandexAdRewarded();
            if (typeof window.onYandexAdDismissed === 'function') window.onYandexAdDismissed();
          }
        };
        if (typeof initAdsBridge === 'function') await initAdsBridge();

        const diamondsBefore = diamonds;
        const expectedBonus = lastVictoryDiamondsReward || 2;
        hasClaimedX2ThisLevel = false;
        if (typeof claimX2Reward === 'function') claimX2Reward();

        return {
          ok: diamonds === diamondsBefore + expectedBonus && hasClaimedX2ThisLevel === true,
          diff: `${diamondsBefore} -> ${diamonds} 💎`
        };
      });
      expect(adClaimResult.ok).toBe(true);
      return adClaimResult.diff;
    });

    await runCheck('11/20', 'Поражение на уровне (#defeatScreen)', async () => {
      await page.evaluate(() => {
        retryLevel();
        if (typeof skipTutorial === 'function') skipTutorial();
        baseHp = 0;
        reviveUsedThisMatch = true;
        triggerDefeat();
      });
      await expect(page.locator('#defeatScreen')).not.toHaveClass(/hidden/, { timeout: 3000 });
    });

    await runCheck('13/20', 'Экстренное возрождение (Emergency Revive)', async () => {
      const reviveState = await page.evaluate(() => {
        retryLevel();
        if (typeof skipTutorial === 'function') skipTutorial();
        if (Array.isArray(WAYPOINTS) && WAYPOINTS.length > 1) {
          enemies.push({
            x: WAYPOINTS[1].x,
            y: WAYPOINTS[1].y,
            wpIndex: 1,
            type: 'grunt',
            hp: 50,
            maxHp: 50,
            speed: 50,
            baseSpeed: 50,
            bounty: 5,
            radius: 12
          });
        }
        baseHp = 0;
        reviveUsedThisMatch = false;
        triggerEmergencyRevivePrompt();
        acceptEmergencyRevive();
        return {
          gameState,
          baseHp,
          reviveUsedThisMatch,
          hasPushAnim: enemies.length > 0 && !!enemies[0].revivePushAnim
        };
      });
      expect(reviveState.gameState).toBe('PLAYING');
      expect(reviveState.baseHp).toBeGreaterThan(0);
      expect(reviveState.reviveUsedThisMatch).toBe(true);
      expect(reviveState.hasPushAnim).toBe(true);
      return `база: ${reviveState.baseHp} HP`;
    });

    await runCheck('14/20', 'Открытие Dev-меню по 5 тапам и чит-начисление', async () => {
      await page.evaluate(() => {
        if (typeof showStartScreen === 'function') showStartScreen();
      });

      // Имитируем 5 быстрых тапов по шестерёнке
      await page.evaluate(() => {
        for (let i = 0; i < 5; i++) {
          if (typeof handleHudSettingsClick === 'function') handleHudSettingsClick();
        }
      });
      await page.waitForTimeout(300);

      const isProdStage = await page.evaluate(() => window.__APP_STAGE__ === 'production');
      if (isProdStage) {
        const modalVisible = await page.locator('#devCustomInputModal').isVisible({ timeout: 1500 }).catch(() => false);
        expect(modalVisible).toBe(true);
        await page.locator('#devModalCancelBtn').click({ force: true }).catch(() => {});
        return 'Prod-задел проверен (5 тапов открыли окно Access Code)';
      }

      // Проверяем, что 5 тапов создали тег загрузки dev-panel.js
      const scriptTagExists = await page.evaluate(() => !!document.getElementById('devPanelStageScript'));
      expect(scriptTagExists).toBe(true);

      // Догружаем dev-panel.js (если ещё грузится) и вызываем window.openDevMode()
      const openState = await page.evaluate(async () => {
        if (typeof window.openDevMode !== 'function') {
          const resp = await fetch('/dev/dev-panel.js?t=' + Date.now());
          if (!resp.ok) return { ok: false, err: 'HTTP ' + resp.status };
          const code = await resp.text();
          (new Function(code))();
        }
        window.openDevMode();
        const bar = document.getElementById('devBar');
        return {
          ok: !!bar && !bar.classList.contains('hidden'),
          devMode: typeof devMode !== 'undefined' && devMode === true
        };
      });

      expect(openState.ok).toBe(true);
      expect(openState.devMode).toBe(true);

      // Проверяем начисление +50 алмазов и закрытие панели
      const devMenuCheck = await page.evaluate(() => {
        const dBefore = diamonds;
        if (typeof window.handleDevDiamondClick === 'function') {
          window.handleDevDiamondClick();
        }
        const dAfter = diamonds;
        if (typeof window.closeDevMode === 'function') {
          window.closeDevMode();
        }
        return {
          devWorked: dAfter === dBefore + 50,
          devClosed: typeof devMode !== 'undefined' && devMode === false
        };
      });
      expect(devMenuCheck.devWorked).toBe(true);
      expect(devMenuCheck.devClosed).toBe(true);
    });
	
    await runCheck('15/20', 'Endless Arena: запуск, спавн и завершение с наградами', async () => {
      await page.evaluate(() => {
        if (!clearedLevels.includes(15)) clearedLevels.push(15);
        maxUnlockedLevel = Math.max(maxUnlockedLevel, 16);
        showLevelSelectFromGame();
        if (typeof switchLevelSelectMode === 'function') switchLevelSelectMode('endless');
        startEndlessMatch();
      });

      const started = await page.evaluate(() => gameState === 'PLAYING' && isEndlessMode === true);
      expect(started).toBe(true);

      await page.locator('#waveBtn').click({ force: true });
      await page.waitForFunction(() => Array.isArray(enemies) && enemies.length > 0, null, { timeout: 5000 });

      const endlessFinishState = await page.evaluate(() => {
        const dBefore = diamonds;
        const pBefore = prisms;
        wave = 11;
        reviveUsedThisMatch = true;
        triggerDefeat();
        return {
          dGained: diamonds - dBefore,
          pGained: prisms - pBefore
        };
      });
      await expect(page.locator('#endlessRewardsBox')).not.toHaveClass(/hidden/, { timeout: 3000 });
      expect(endlessFinishState.dGained).toBe(20);
      expect(endlessFinishState.pGained).toBeGreaterThanOrEqual(1);
      return `+${endlessFinishState.dGained} 💎, +${endlessFinishState.pGained} 🔮`;
    });

    await runCheck('16/20', 'Hardcore Mode: 1 HP, победа (Призмы) и поражение без Revive', async () => {
      const hardcoreResult = await page.evaluate(() => {
        if (!clearedLevels.includes(20)) clearedLevels.push(20);
        maxUnlockedLevel = Math.max(maxUnlockedLevel, 21);
        isEndlessMode = false;
        isOverdriveMode = true;
        startSpecificLevel(1);
        if (typeof skipTutorial === 'function') skipTutorial();

        const startHp = baseHp;

        const pBefore = prisms;
        overdriveClearedLevels[1] = false;
        spawnQueue = [];
        enemies = [];
        triggerVictory();
        const victoryState = gameState;
        const pGained = prisms - pBefore;

        retryLevel();
        reviveUsedThisMatch = false;
        baseHp = 0;
        triggerDefeat();
        const defeatState = gameState;
        const reviveHidden = document.getElementById('reviveBtn').classList.contains('hidden');

        return { startHp, victoryState, pGained, defeatState, reviveHidden };
      });
      expect(hardcoreResult.startHp).toBe(1);
      expect(hardcoreResult.victoryState).toBe('VICTORY');
      expect(hardcoreResult.pGained).toBeGreaterThan(0);
      expect(hardcoreResult.defeatState).toBe('DEFEAT');
      expect(hardcoreResult.reviveHidden).toBe(true);
      return `HP=${hardcoreResult.startHp}, +${hardcoreResult.pGained} 🔮`;
    });

    // =========================================================
    // ЧАСТЬ 3. МЕТА-СИСТЕМЫ (17–20)
    // =========================================================

    await runCheck('17/20', 'Автосохранение боя (Snapshot) и кнопка RESUME', async () => {
      const resumeBattleCheck = await page.evaluate(() => {
        isOverdriveMode = false;
        isEndlessMode = false;
        startSpecificLevel(3);
        if (typeof skipTutorial === 'function') skipTutorial();

        let builtC = -1, builtR = -1;
        for (let r = 0; r < grid.length; r++) {
          for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c] === 0) { builtC = c; builtR = r; break; }
          }
          if (builtC !== -1) break;
        }
        gold = 500;
        buildTowerAt('gun', builtC, builtR);
        wave = 3;
        gold = 345;
        saveActiveBattleSnapshot();

        showStartScreen();
        const resumeBtnVisible = !document.getElementById('mainResumeBtn').classList.contains('hidden');

        resumeSavedBattle();
        return {
          resumeBtnVisible,
          gameState,
          restoredLevel: currentLevel,
          restoredWave: wave,
          restoredGold: gold,
          restoredTowers: towers.length
        };
      });
      expect(resumeBattleCheck.resumeBtnVisible).toBe(true);
      expect(resumeBattleCheck.gameState).toBe('PLAYING');
      expect(resumeBattleCheck.restoredLevel).toBe(3);
      expect(resumeBattleCheck.restoredWave).toBe(3);
      expect(resumeBattleCheck.restoredGold).toBe(345);
      expect(resumeBattleCheck.restoredTowers).toBe(1);
    });

    await runCheck('18/20', 'Прокачка в Tech Tree', async () => {
      const techTreeCheck = await page.evaluate(() => {
        showStartScreen();
        if (typeof openUpgradesScreen === 'function') openUpgradesScreen('main');
        diamonds = Math.max(diamonds, 500);
        maxUnlockedLevel = Math.max(maxUnlockedLevel, 15);
        const lvlBefore = upgradeTreeData['gun_power'] || 0;
        handleNodeClick('gun_power', lvlBefore + 1);
        const lvlAfter = upgradeTreeData['gun_power'] || 0;
        if (typeof closeUpgradesScreen === 'function') closeUpgradesScreen();
        return { ok: lvlAfter === lvlBefore + 1, diff: `${lvlBefore} -> ${lvlAfter}` };
      });
      expect(techTreeCheck.ok).toBe(true);
      return `gun_power: ${techTreeCheck.diff}`;
    });

    await runCheck('19/20', 'Магазин: Daily Gift и обмен валюты (Currency Exchange)', async () => {
      const shopCheck = await page.evaluate(() => {
        dailyGiftsClaimedCount = 0;
        const dBefore = diamonds;
        claimDailyGiftsPack();
        const dAfterGift = diamonds;

        maxUnlockedLevel = 21;
        diamonds = Math.max(diamonds, 100);
        const pBefore = prisms;
        synthesizePrism();
        const pAfterSynth = prisms;

        return {
          giftOk: dAfterGift === dBefore + 10,
          synthOk: pAfterSynth === pBefore + 1
        };
      });
      expect(shopCheck.giftOk).toBe(true);
      expect(shopCheck.synthOk).toBe(true);
    });

    await runCheck('20/20', 'Локализация (10 языков) и переключение тем оформления', async () => {
      const i18nAndThemeCheck = await page.evaluate(() => {
        const langs = ['en', 'ru', 'es', 'pt', 'de', 'fr', 'it', 'tr', 'pl', 'uk'];
        const missing = [];
        for (const l of langs) {
          if (typeof setLanguage === 'function') setLanguage(l, false);
          const playStr = typeof t === 'function' ? t('play') : '';
          if (!playStr || playStr === 'play') missing.push(l);
        }
        if (typeof setLanguage === 'function') setLanguage('en', false);

        applyPaletteColors('cyber_gold');
        const themeApplied = document.body.getAttribute('data-theme') === 'cyber_gold';
        applyPaletteColors('default');

        return { missingCount: missing.length, themeApplied };
      });
      expect(i18nAndThemeCheck.missingCount).toBe(0);
      expect(i18nAndThemeCheck.themeApplied).toBe(true);
    });

    // =========================================================
    // ИТОГОВАЯ СВОДКА ПО ВСЕМ 20 ПРОВЕРКАМ
    // =========================================================
    const passed = report.filter(r => r.status === 'PASS');
    const failed = report.filter(r => r.status === 'FAIL');

    console.log('\n==================== СВОДНЫЙ ОТЧЁТ SMOKE-ТЕСТОВ ====================');
    console.log(`Пройдено: ${passed.length} из ${report.length} | Упало: ${failed.length} | JS-ошибок: ${fatalErrors.length}`);
    if (failed.length > 0) {
      console.log('\nСписок проваленных проверок:');
      failed.forEach(f => console.log(`  ❌ [${f.code}] ${f.title}: ${f.detail}`));
    }
    console.log('====================================================================\n');

    expect(failed, `Провалены проверки: ${failed.map(f => `[${f.code}] ${f.title}`).join(', ')}`).toEqual([]);
    expect(fatalErrors, `Непойманные JS-ошибки: ${fatalErrors.join('; ')}`).toEqual([]);
  });
});