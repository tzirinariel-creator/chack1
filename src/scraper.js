const { createScraper, CompanyTypes } = require('israeli-bank-scrapers');

async function scrapeCalTransactions({ username, password, startDate }) {
  const scraper = createScraper({
    companyId: CompanyTypes.visaCal,
    startDate,
    combineInstallments: false,
    showBrowser: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const result = await scraper.scrape({ username, password });

  if (!result.success) {
    throw new Error(`Scraping failed: ${result.errorType} - ${result.errorMessage}`);
  }

  const transactions = [];
  for (const account of result.accounts) {
    for (const txn of account.txns) {
      transactions.push({
        date: txn.date.split('T')[0],
        processedDate: txn.processedDate?.split('T')[0] || '',
        description: txn.description,
        amount: Math.abs(txn.chargedAmount),
        originalAmount: Math.abs(txn.originalAmount),
        originalCurrency: txn.originalCurrency || 'ILS',
        status: txn.status,
        type: txn.type,
        memo: txn.memo || '',
        identifier: txn.identifier || `${txn.date}_${txn.description}_${txn.chargedAmount}`,
        accountNumber: account.accountNumber,
      });
    }
  }

  return transactions;
}

module.exports = { scrapeCalTransactions };
