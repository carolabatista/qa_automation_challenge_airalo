import { Page, Locator } from '@playwright/test';

const OVERLAY_APPEAR_TIMEOUT_MS = 1500;

export class LandingPage {
  private readonly page: Page;
  private readonly searchInput: Locator;
  private readonly overlayDismissButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.locator('[data-testid="search-input_text-field"]').first();
    this.overlayDismissButton = page
      .locator('button, [role="button"]')
      .filter({ hasText: /accept|allow/i })
      .or(page.locator('#wzrk-cancel'))
      .first();
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.clearOverlays();
  }

  async searchForCountry(term: string): Promise<void> {
    await this.searchInput.click();
    await this.searchInput.pressSequentially(term);
    await this.suggestions(term).first().waitFor({ state: 'visible' });
  }

  async selectCountry(countryName: string): Promise<void> {
    const withFlag = this.suggestions(countryName).filter({
      has: this.page.locator(`img[alt*="${countryName}"], svg[aria-label*="${countryName}"]`),
    });
    const target = (await withFlag.count()) > 0 ? withFlag.first() : this.suggestions(countryName).first();
    await target.click();
  }

  private async clearOverlays(): Promise<void> {
    await this.dismissVisibleOverlays();
    try {
      await this.overlayDismissButton.waitFor({ state: 'visible', timeout: OVERLAY_APPEAR_TIMEOUT_MS });
      await this.dismissVisibleOverlays();
    } catch {
      // No delayed overlay appeared within the grace window
    }
  }

  private async dismissVisibleOverlays(): Promise<void> {
    while (await this.overlayDismissButton.isVisible()) {
      await this.overlayDismissButton.click();
      const dismissed = await this.overlayDismissButton
        .waitFor({ state: 'hidden', timeout: OVERLAY_APPEAR_TIMEOUT_MS })
        .then(() => true)
        .catch(() => false);
      if (!dismissed) {
        await this.overlayDismissButton.dispatchEvent('click');
        await this.overlayDismissButton.waitFor({ state: 'hidden' });
      }
    }
  }

  private suggestions(countryName: string): Locator {
    return this.page.locator(`li:has-text("${countryName}")`);
  }
}
