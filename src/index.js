const { getConfig } = require('./config');
const { scrapeCalTransactions } = require('./scraper');
const {
  connectToSheet,
  ensureSheetStructure,
  getExistingIdentifiers,
  addTransactions,
  updateMonthlySummary,
  updateLastSync,
} = require('./sheets');

async function sync() {
  console.log('🔄 Starting sync...');
  const config = getConfig();

  // Scrape transactions from last 60 days
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 60);

  console.log(`📅 Fetching transactions since ${startDate.toISOString().split('T')[0]}`);
  const transactions = await scrapeCalTransactions({
    username: config.cal.username,
    password: config.cal.password,
    startDate,
  });
  console.log(`📥 Found ${transactions.length} transactions`);

  // Connect to Google Sheets
  console.log('📊 Connecting to Google Sheets...');
  const doc = await connectToSheet(
    config.sheets.sheetId,
    config.sheets.serviceAccountEmail,
    config.sheets.privateKey
  );

  // Ensure sheet structure
  const { txnSheet, summarySheet, settingsSheet } = await ensureSheetStructure(doc, config.budget);

  // Get existing identifiers for deduplication
  const existingIds = await getExistingIdentifiers(txnSheet);
  console.log(`📋 Found ${existingIds.size} existing transactions in sheet`);

  // Add new transactions
  const result = await addTransactions(txnSheet, transactions, existingIds);
  console.log(`✅ Added ${result.added} new transactions (${result.skipped} already existed)`);

  // Update monthly summary
  if (result.added > 0) {
    console.log('📈 Updating monthly summary...');
    await updateMonthlySummary(txnSheet, summarySheet, config.budget);
  }

  // Update last sync timestamp
  await updateLastSync(settingsSheet);

  console.log('🎉 Sync complete!');
  return result;
}

sync().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
