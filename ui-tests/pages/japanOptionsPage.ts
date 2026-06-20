import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './basePage';

export class JapanOptionsPage extends BasePage {
  private readonly pageTitle: Locator;
  private readonly unlimitedTab: Locator;
  private readonly unlimitedSevenDaysButton: Locator;
  private readonly cartContainer: Locator;

  constructor(page: Page) {
    super(page);
    this.pageTitle = page.getByTestId('package-location-header_title');
    this.unlimitedTab = page.getByTestId('segmented-control_tab-unlimited');
    this.unlimitedSevenDaysButton = page.getByRole('button', { name: /Select Unlimited - 7 days/i });
    this.cartContainer = page.getByTestId('cart-navigation_container');
  }

  async verifyOnPage(): Promise<void> {
    await expect(this.pageTitle).toContainText('Japan');
  }

  async selectUnlimitedTab(): Promise<void> {
    await this.unlimitedTab.scrollIntoViewIfNeeded();
    await this.unlimitedTab.click();
    await expect(this.unlimitedTab).toHaveAttribute('aria-selected', 'true');
  }

  async selectUnlimitedSevenDays(): Promise<void> {
    await this.unlimitedSevenDaysButton.scrollIntoViewIfNeeded();
    await this.unlimitedSevenDaysButton.click();
    await expect(this.page).toHaveURL(/7days-unlimited/i);
    await expect(this.cartContainer).toBeVisible();
  }

  async verifyButtonPriceMatchesCart(): Promise<void> {
    const priceElement = this.unlimitedSevenDaysButton.getByTestId('price_amount');
    await expect(this.cartContainer).toContainText(await priceElement.innerText());
  }
}
