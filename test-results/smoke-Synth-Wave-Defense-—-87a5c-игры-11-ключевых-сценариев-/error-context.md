# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Synth Wave Defense — Core Smoke Suite >> Полный базовый цикл игры (11 ключевых сценариев)
- Location: tests\smoke.spec.js:5:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "menu"
Received: "battle"
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic: LOADING...
    - generic:
      - generic: Synth Wave
      - generic: Defense
    - button "GO" [ref=e2] [cursor=pointer]
  - generic [ref=e5]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - img [ref=e10]:
          - generic [ref=e12]: $
        - generic [ref=e13]: "90"
      - generic [ref=e15]: "10"
    - generic [ref=e19]:
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: LVL
          - generic [ref=e23]: "1"
        - generic [ref=e24]: ·
        - generic [ref=e25]: 1/2
      - button "Settings & Pause" [ref=e28] [cursor=pointer]
  - generic:
    - button "GO" [ref=e32] [cursor=pointer]
    - generic [ref=e35]:
      - generic [ref=e36]:
        - generic: Gun
        - generic [ref=e37]:
          - img [ref=e39]:
            - generic [ref=e41]: $
          - text: "50"
      - generic [ref=e42]:
        - generic: Laser
        - generic [ref=e43]: L3
      - generic [ref=e48]:
        - generic: Splash
        - generic [ref=e49]: L4
  - text: FAILED FAILED
```

# Test source

```ts
  1   | // tests/smoke.spec.js
  2   | const { test, expect } = require('@playwright/test');
  3   | 
  4   | test.describe('Synth Wave Defense — Core Smoke Suite', () => {
  5   |   test('Полный базовый цикл игры (11 ключевых сценариев)', async ({ page }) => {
  6   |     const fatalErrors = [];
  7   | 
  8   |     page.on('pageerror', (err) => {
  9   |       const msg = String(err && err.message ? err.message : err);
  10  |       if (msg.includes('Unable to decode audio data')) return;
  11  |       fatalErrors.push(msg);
  12  |     });
  13  | 
  14  |     await page.route('**/*', (route) => {
  15  |       const url = route.request().url();
  16  |       if (
  17  |         url.startsWith('http://127.0.0.1') ||
  18  |         url.startsWith('http://localhost') ||
  19  |         url.startsWith('data:') ||
  20  |         url.startsWith('blob:')
  21  |       ) {
  22  |         return route.continue();
  23  |       }
  24  |       return route.abort();
  25  |     });
  26  | 
  27  |     await page.addInitScript(() => {
  28  |       try {
  29  |         localStorage.clear();
  30  |         localStorage.setItem('dev_auth_token', 'MTMzNw==');
  31  |       } catch (e) {}
  32  |     });
  33  | 
  34  |     // 1. Игра запускается, включается
  35  |     await page.goto('/index.html');
  36  |     await page.waitForFunction(() => window.__gameBooted === true, null, { timeout: 10000 });
  37  | 
  38  |     const goLoaderBtn = page.locator('#initialLoadingScreen button');
  39  |     await expect(goLoaderBtn).toBeVisible({ timeout: 10000 });
  40  |     await goLoaderBtn.click({ force: true });
  41  | 
  42  |     const startScreen = page.locator('#startScreen');
  43  |     await expect(startScreen).not.toHaveClass(/hidden/, { timeout: 5000 });
  44  | 
  45  |     // Закрываем модалку ежедневного бонуса, если открылась
  46  |     await page.evaluate(() => {
  47  |       if (typeof closeDailyLoginModal === 'function') closeDailyLoginModal();
  48  |     });
  49  |     console.log('✓ [1/11] Игра запустилась, главное меню открыто');
  50  | 
  51  |     // 2. Можно выбрать уровень, уровень загружается
  52  |     await page.locator('#mainPlayBtn').click({ force: true });
  53  |     await expect(page.locator('#levelsScreen')).not.toHaveClass(/hidden/);
  54  | 
  55  |     const firstLevelBtn = page.locator('#levelsGrid button, #levelsGrid > div').first();
  56  |     await expect(firstLevelBtn).toBeVisible();
  57  |     await firstLevelBtn.click({ force: true });
  58  | 
  59  |     // Закрываем туториал штатной функцией, чтобы не ждать анимацию кнопки
  60  |     await page.evaluate(() => {
  61  |       if (typeof skipTutorial === 'function') skipTutorial();
  62  |     });
  63  | 
  64  |     await expect(page.locator('#levelsScreen')).toHaveClass(/hidden/, { timeout: 5000 });
  65  |     await expect(page.locator('#waveBtn')).toBeVisible();
  66  |     await expect(page.locator('#econHpSplitBadge')).not.toHaveClass(/hidden/);
  67  |     console.log('✓ [2/11] Уровень выбран и загружен');
  68  | 	
  69  |     // 3. Музыка в меню играет
  70  |     const menuMusicState = await page.evaluate(() => {
  71  |       if (typeof musicUnlock === 'function') musicUnlock();
  72  |       if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
  73  |       const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
  74  |       return { ok: true, cat };
  75  |     });
  76  |     expect(menuMusicState.ok).toBe(true);
> 77  |     expect(menuMusicState.cat).toBe('menu');
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  78  |     console.log(`✓ [3/11] Музыка в меню активна (категория: ${menuMusicState.cat})`);
  79  | 
  80  |     // 4. Музыка в битве играет
  81  |     
  82  |     const battleMusicState = await page.evaluate(() => {
  83  |       if (typeof MusicManager === 'undefined' || !MusicManager) return { ok: false, cat: null };
  84  |       const cat = typeof MusicManager.current === 'function' ? MusicManager.current() : null;
  85  |       return { ok: true, cat };
  86  |     });
  87  |     expect(battleMusicState.ok).toBe(true);
  88  |     expect(battleMusicState.cat).toBe('battle');
  89  |     console.log(`✓ [4/11] Музыка в битве активна (категория: ${battleMusicState.cat})`);
  90  | 	
  91  |     // 5. Звуки игры есть
  92  |     const sfxCheck = await page.evaluate(() => {
  93  |       if (typeof SFX === 'undefined' || !SFX) return { ok: false, reason: 'SFX missing' };
  94  |       const manifestKeys = (typeof window.SFX_MANIFEST === 'object' && window.SFX_MANIFEST)
  95  |         ? Object.keys(window.SFX_MANIFEST)
  96  |         : [];
  97  |       if (manifestKeys.length === 0) return { ok: false, reason: 'SFX_MANIFEST empty' };
  98  |       try {
  99  |         SFX.unlock();
  100 |         const names = typeof SFX._names === 'function' ? SFX._names() : [];
  101 |         SFX.play('tap');
  102 |         return { ok: true, count: names.length, manifestCount: manifestKeys.length };
  103 |       } catch (e) {
  104 |         return { ok: false, reason: e.message };
  105 |       }
  106 |     });
  107 |     expect(sfxCheck.ok).toBe(true);
  108 |     expect(sfxCheck.manifestCount).toBeGreaterThan(0);
  109 |     console.log(`✓ [5/11] Звуки игры (SFX) активны (манифест: ${sfxCheck.manifestCount}, пресетов: ${sfxCheck.count})`);
  110 |     
  111 |     // 6. По нажатию на старт мобы появляются
  112 |     
  113 |     await page.locator('#waveBtn').click({ force: true });
  114 | 
  115 |     await page.waitForFunction(
  116 |       () => typeof enemies !== 'undefined' && Array.isArray(enemies) && enemies.length > 0,
  117 |       null,
  118 |       { timeout: 6000 }
  119 |     );
  120 |     console.log('✓ [6/11] Волна запущена, мобы появились на карте');
  121 | 
  122 |     // Переходим на 2-й уровень (на 1-м уровне при первом запуске canUpgrade === false по правилам обучения)
  123 |     await page.evaluate(() => {
  124 |       maxUnlockedLevel = 2;
  125 |       startSpecificLevel(2);
  126 |       if (typeof skipTutorial === 'function') skipTutorial();
  127 |     });
  128 | 
  129 |     
  130 |     // 7. Можно построить башню
  131 |     
  132 |     const buildResult = await page.evaluate(() => {
  133 |       let freeR = -1;
  134 |       let freeC = -1;
  135 |       for (let r = 0; r < grid.length; r++) {
  136 |         for (let c = 0; c < grid[r].length; c++) {
  137 |           if (grid[r][c] === 0) {
  138 |             freeR = r;
  139 |             freeC = c;
  140 |             break;
  141 |           }
  142 |         }
  143 |         if (freeR !== -1) break;
  144 |       }
  145 |       if (freeR === -1) return { ok: false, reason: 'no free cell' };
  146 | 
  147 |       gold = Math.max(gold, 500);
  148 |       const placed = buildTowerAt('gun', freeC, freeR);
  149 |       return { ok: placed === true && towers.length === 1, count: towers.length };
  150 |     });
  151 |     expect(buildResult.ok).toBe(true);
  152 |     console.log('✓ [7/11] Башня построена');
  153 | 
  154 |     
  155 |     // 8. Можно улучшить башню
  156 |     
  157 |     const upgradeResult = await page.evaluate(() => {
  158 |       const t = towers[0];
  159 |       if (!t) return { ok: false };
  160 |       gold = Math.max(gold, 500);
  161 |       selectedTower = t;
  162 |       upgradeSelectedTower();
  163 |       return { ok: t.level === 2, level: t.level };
  164 |     });
  165 |     expect(upgradeResult.ok).toBe(true);
  166 |     console.log('✓ [8/11] Башня улучшена до Lv.2');
  167 | 
  168 |     
  169 |     // 9. Можно продать башню
  170 |     
  171 |     const sellResult = await page.evaluate(() => {
  172 |       const t = towers[0];
  173 |       if (!t) return { ok: false };
  174 |       const goldBefore = gold;
  175 |       selectedTower = t;
  176 |       sellSelectedTower(); // 1-й вызов: armSellConfirm()
  177 |       sellSelectedTower(); // 2-й вызов: подтверждение продажи
```