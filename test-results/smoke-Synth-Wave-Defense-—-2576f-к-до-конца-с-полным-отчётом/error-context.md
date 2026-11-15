# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Synth Wave Defense — Full Core & Meta Smoke Suite (Non-Stop Report) >> Прогон всех 20 проверок до конца с полным отчётом
- Location: tests\smoke.spec.js:5:3

# Error details

```
Error: Провалены проверки: [14/20] Открытие Dev-меню по 5 тапам и чит-начисление

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   Object {
+     "code": "14/20",
+     "detail": "expect(locator).toBeVisible() failed",
+     "status": "FAIL",
+     "title": "Открытие Dev-меню по 5 тапам и чит-начисление",
+   },
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: "484"
      - generic [ref=e11]: "5"
    - button "Settings & Pause" [ref=e19] [cursor=pointer]
  - button "Daily Bonus" [ref=e23] [cursor=pointer]
  - generic [ref=e26]:
    - generic:
      - generic [ref=e27]:
        - generic [ref=e28]: Synth Wave
        - generic [ref=e29]: Defense
      - generic [ref=e30]:
        - button "RESUME" [ref=e31] [cursor=pointer]
        - button "PLAY" [ref=e36] [cursor=pointer]
        - generic [ref=e45] [cursor=pointer]:
          - generic [ref=e46]: SYNTH PASS
          - generic [ref=e47]: TIER 0
        - button "TECH TREE" [ref=e53] [cursor=pointer]
        - button "BONUSES" [ref=e61] [cursor=pointer]
  - text: FAILED FAILED
  - generic: +1 Prism synthesized!
```

# Test source

```ts
  436 |         gold = 500;
  437 |         buildTowerAt('gun', builtC, builtR);
  438 |         wave = 3;
  439 |         gold = 345;
  440 |         saveActiveBattleSnapshot();
  441 | 
  442 |         showStartScreen();
  443 |         const resumeBtnVisible = !document.getElementById('mainResumeBtn').classList.contains('hidden');
  444 | 
  445 |         resumeSavedBattle();
  446 |         return {
  447 |           resumeBtnVisible,
  448 |           gameState,
  449 |           restoredLevel: currentLevel,
  450 |           restoredWave: wave,
  451 |           restoredGold: gold,
  452 |           restoredTowers: towers.length
  453 |         };
  454 |       });
  455 |       expect(resumeBattleCheck.resumeBtnVisible).toBe(true);
  456 |       expect(resumeBattleCheck.gameState).toBe('PLAYING');
  457 |       expect(resumeBattleCheck.restoredLevel).toBe(3);
  458 |       expect(resumeBattleCheck.restoredWave).toBe(3);
  459 |       expect(resumeBattleCheck.restoredGold).toBe(345);
  460 |       expect(resumeBattleCheck.restoredTowers).toBe(1);
  461 |     });
  462 | 
  463 |     await runCheck('18/20', 'Прокачка в Tech Tree', async () => {
  464 |       const techTreeCheck = await page.evaluate(() => {
  465 |         showStartScreen();
  466 |         if (typeof openUpgradesScreen === 'function') openUpgradesScreen('main');
  467 |         diamonds = Math.max(diamonds, 500);
  468 |         maxUnlockedLevel = Math.max(maxUnlockedLevel, 15);
  469 |         const lvlBefore = upgradeTreeData['gun_power'] || 0;
  470 |         handleNodeClick('gun_power', lvlBefore + 1);
  471 |         const lvlAfter = upgradeTreeData['gun_power'] || 0;
  472 |         if (typeof closeUpgradesScreen === 'function') closeUpgradesScreen();
  473 |         return { ok: lvlAfter === lvlBefore + 1, diff: `${lvlBefore} -> ${lvlAfter}` };
  474 |       });
  475 |       expect(techTreeCheck.ok).toBe(true);
  476 |       return `gun_power: ${techTreeCheck.diff}`;
  477 |     });
  478 | 
  479 |     await runCheck('19/20', 'Магазин: Daily Gift и обмен валюты (Currency Exchange)', async () => {
  480 |       const shopCheck = await page.evaluate(() => {
  481 |         dailyGiftsClaimedCount = 0;
  482 |         const dBefore = diamonds;
  483 |         claimDailyGiftsPack();
  484 |         const dAfterGift = diamonds;
  485 | 
  486 |         maxUnlockedLevel = 21;
  487 |         diamonds = Math.max(diamonds, 100);
  488 |         const pBefore = prisms;
  489 |         synthesizePrism();
  490 |         const pAfterSynth = prisms;
  491 | 
  492 |         return {
  493 |           giftOk: dAfterGift === dBefore + 10,
  494 |           synthOk: pAfterSynth === pBefore + 1
  495 |         };
  496 |       });
  497 |       expect(shopCheck.giftOk).toBe(true);
  498 |       expect(shopCheck.synthOk).toBe(true);
  499 |     });
  500 | 
  501 |     await runCheck('20/20', 'Локализация (10 языков) и переключение тем оформления', async () => {
  502 |       const i18nAndThemeCheck = await page.evaluate(() => {
  503 |         const langs = ['en', 'ru', 'es', 'pt', 'de', 'fr', 'it', 'tr', 'pl', 'uk'];
  504 |         const missing = [];
  505 |         for (const l of langs) {
  506 |           if (typeof setLanguage === 'function') setLanguage(l, false);
  507 |           const playStr = typeof t === 'function' ? t('play') : '';
  508 |           if (!playStr || playStr === 'play') missing.push(l);
  509 |         }
  510 |         if (typeof setLanguage === 'function') setLanguage('en', false);
  511 | 
  512 |         applyPaletteColors('cyber_gold');
  513 |         const themeApplied = document.body.getAttribute('data-theme') === 'cyber_gold';
  514 |         applyPaletteColors('default');
  515 | 
  516 |         return { missingCount: missing.length, themeApplied };
  517 |       });
  518 |       expect(i18nAndThemeCheck.missingCount).toBe(0);
  519 |       expect(i18nAndThemeCheck.themeApplied).toBe(true);
  520 |     });
  521 | 
  522 |     // =========================================================
  523 |     // ИТОГОВАЯ СВОДКА ПО ВСЕМ 20 ПРОВЕРКАМ
  524 |     // =========================================================
  525 |     const passed = report.filter(r => r.status === 'PASS');
  526 |     const failed = report.filter(r => r.status === 'FAIL');
  527 | 
  528 |     console.log('\n==================== СВОДНЫЙ ОТЧЁТ SMOKE-ТЕСТОВ ====================');
  529 |     console.log(`Пройдено: ${passed.length} из ${report.length} | Упало: ${failed.length} | JS-ошибок: ${fatalErrors.length}`);
  530 |     if (failed.length > 0) {
  531 |       console.log('\nСписок проваленных проверок:');
  532 |       failed.forEach(f => console.log(`  ❌ [${f.code}] ${f.title}: ${f.detail}`));
  533 |     }
  534 |     console.log('====================================================================\n');
  535 | 
> 536 |     expect(failed, `Провалены проверки: ${failed.map(f => `[${f.code}] ${f.title}`).join(', ')}`).toEqual([]);
      |                                                                                                   ^ Error: Провалены проверки: [14/20] Открытие Dev-меню по 5 тапам и чит-начисление
  537 |     expect(fatalErrors, `Непойманные JS-ошибки: ${fatalErrors.join('; ')}`).toEqual([]);
  538 |   });
  539 | });
```