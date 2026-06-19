import { Page, Locator } from '@playwright/test';

const FILL_SUGGESTION_TIMEOUT_MS = 3000;
const SUGGESTION_VISIBLE_TIMEOUT_MS = 5000;

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
    await this.page.addLocatorHandler(this.overlayDismissButton, async () => {
      await this.overlayDismissButton.click();
      await this.overlayDismissButton.waitFor({ state: 'hidden' }).catch(() => {});
    });
    await this.page.goto('/');
  }

  async searchForCountry(term: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible' });
    await this.searchInput.click();
    await this.searchInput.fill(term);

    const appeared = await this.suggestions(term).first()
      .waitFor({ state: 'visible', timeout: FILL_SUGGESTION_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);

    if (!appeared) {
      await this.searchInput.clear();
      await this.searchInput.pressSequentially(term, { delay: 50 });
      await this.suggestions(term).first().waitFor({ state: 'visible', timeout: SUGGESTION_VISIBLE_TIMEOUT_MS });
    }
  }

  async selectCountry(countryName: string): Promise<void> {
    const withFlag = this.suggestions(countryName).filter({
      has: this.page.locator(`img[alt*="${countryName}"], svg[aria-label*="${countryName}"]`),
    });
    const target = (await withFlag.count()) > 0 ? withFlag.first() : this.suggestions(countryName).first();
    await target.click();
  }

  private suggestions(countryName: string): Locator {
    return this.page.locator(`li:has-text("${countryName}")`);
  }
}
