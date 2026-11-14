// tests/smoke.spec.js
const { test, expect } = require('@playwright/test');

test.describe('Synth Wave Defense — Core Smoke Suite', () => {
  test('Полный базовый цикл игры (11 ключевых сценариев)', async ({ page }) => {
    const fatalErrors = [];

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

    // 1. Игра запускается, включается
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__gameBooted === true, null, { timeout: 10000 });

    const goLoaderBtn = page.locator('#initialLoadingScreen button');
    await expect(goLoaderBtn).toBeVisible({ timeout: 10000 });
    await goLoaderBtn.click({ force: true });

    const startScreen = page.locator('#startScreen');
    await expect(startScreen).not.toHaveClass(/hidden/, { timeout: 5000 });

    // Закрываем модалку ежедневного бонуса, если открылась
    await page.evaluate(() => {
      if (typeof closeDailyLoginModal === 'function') closeDailyLoginModal();
    });
    console.log('✓ [1/11] Игра запустилась, главное меню открыто');

    // 2. Можно выбрать уровень, уровень загружается
    await page.locator('#mainPlayBtn').click({ force: true });
    await expect(page.locator('#levelsScreen')).not.toHaveClass(/hidden/);

    const firstLevelBtn = page.locator('#levelsGrid button, #levelsGrid > div').first();
    await expect(firstLevelBtn).toBeVisible();
    await firstLevelBtn.click({ force: true });

    // Закрываем туториал штатной функцией, чтобы не ждать анимацию кнопки
    await page.evaluate(() => {
      if (typeof skipTutorial === 'function') skipTutorial();
    });

    await expect(page.locator('#levelsScreen')).toHaveClass(/hidden/, { timeout: 5000 });
    await expect(page.locator('#waveBtn')).toBeVisible();
    await expect(page.locator('#econHpSplitBadge')).not.toHaveClass(/hidden/);
    console.log('✓ [2/11] Уровень выбран и загружен');
	
    // 3. Музыка в меню играет
    const menuMusicState = await page.evaluate(() => {
      if (typeof musicUnlock === 'function') musicUnlock();
      if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
      const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
      return { ok: true, cat };
    });
    expect(menuMusicState.ok).toBe(true);
    expect(menuMusicState.cat).toBe('menu');
    console.log(`✓ [3/11] Музыка в меню активна (категория: ${menuMusicState.cat})`);

    // 4. Музыка в битве играет
    
    const battleMusicState = await page.evaluate(() => {
      if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
      const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
      return { ok: true, cat };
    });
    expect(battleMusicState.ok).toBe(true);
    expect(battleMusicState.cat).toBe('battle');
    console.log(`✓ [4/11] Музыка в битве активна (категория: ${battleMusicState.cat})`);
	
    // 5. Звуки игры есть
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
    console.log(`✓ [5/11] Звуки игры (SFX) активны (манифест: ${sfxCheck.manifestCount}, пресетов: ${sfxCheck.count})`);
    
    // 6. По нажатию на старт мобы появляются
    
    await page.locator('#waveBtn').click({ force: true });

    await page.waitForFunction(
      () => typeof enemies !== 'undefined' && Array.isArray(enemies) && enemies.length > 0,
      null,
      { timeout: 6000 }
    );
    console.log('✓ [6/11] Волна запущена, мобы появились на карте');

    // Переходим на 2-й уровень (на 1-м уровне при первом запуске canUpgrade === false по правилам обучения)
    await page.evaluate(() => {
      maxUnlockedLevel = 2;
      startSpecificLevel(2);
      if (typeof skipTutorial === 'function') skipTutorial();
    });

    
    // 7. Можно построить башню
    
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
      return { ok: placed === true && towers.length === 1, count: towers.length };
    });
    expect(buildResult.ok).toBe(true);
    console.log('✓ [7/11] Башня построена');

    
    // 8. Можно улучшить башню
    
    const upgradeResult = await page.evaluate(() => {
      const t = towers[0];
      if (!t) return { ok: false };
      gold = Math.max(gold, 500);
      selectedTower = t;
      upgradeSelectedTower();
      return { ok: t.level === 2, level: t.level };
    });
    expect(upgradeResult.ok).toBe(true);
    console.log('✓ [8/11] Башня улучшена до Lv.2');

    
    // 9. Можно продать башню
    
    const sellResult = await page.evaluate(() => {
      const t = towers[0];
      if (!t) return { ok: false };
      const goldBefore = gold;
      selectedTower = t;
      sellSelectedTower(); // 1-й вызов: armSellConfirm()
      sellSelectedTower(); // 2-й вызов: подтверждение продажи
      return { ok: towers.length === 0 && gold > goldBefore, count: towers.length };
    });
    expect(sellResult.ok).toBe(true);
    console.log('✓ [9/11] Башня продана с возвратом золота');

    
    // 10. Можно выиграть уровень
    
    await page.evaluate(() => {
      clearedLevels = [1, 2];
      maxUnlockedLevel = 3;
      spawnQueue = [];
      enemies = [];
      triggerVictory();
    });
    await expect(page.locator('#victoryScreen')).not.toHaveClass(/hidden/, { timeout: 5000 });
    console.log('✓ [10/11] Экран победы открыт');

    
    // 11. Можно проиграть уровень
    
    await page.evaluate(() => {
      if (typeof retryLevel === 'function') {
        retryLevel();
      } else {
        startSpecificLevel(currentLevel);
      }
      if (typeof skipTutorial === 'function') skipTutorial();
    });
    await expect(page.locator('#victoryScreen')).toHaveClass(/hidden/, { timeout: 5000 });

    await page.evaluate(() => {
      baseHp = 0;
      reviveUsedThisMatch = true;
      triggerDefeat();
    });
    await expect(page.locator('#defeatScreen')).not.toHaveClass(/hidden/, { timeout: 5000 });
    console.log('✓ [11/11] Экран поражения открыт');

    expect(fatalErrors).toEqual([]);
  });
});