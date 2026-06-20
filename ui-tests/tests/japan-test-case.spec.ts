import { test } from '@playwright/test';
import { LandingPage } from '../pages/landingPage';
import { JapanOptionsPage } from '../pages/japanOptionsPage';

test.describe('Japan eSIM purchase flow', () => {
  test('search for a country, select it and verify unlimited plan price matches cart', async ({ page }) => {
    const landing = new LandingPage(page);
    await landing.goto();
    await landing.verifyOnPage();

    await landing.searchForCountry('Japan');
    await landing.selectCountry('Japan');

    const japan = new JapanOptionsPage(page);
    await japan.verifyOnPage();
    await japan.selectUnlimitedTab();
    await japan.selectUnlimitedSevenDays();
    await japan.verifyButtonPriceMatchesCart();
  });
});
