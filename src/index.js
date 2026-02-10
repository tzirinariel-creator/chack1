const { getConfig } = require('./config');
const { scrapeCalTransactions } = require('./scraper');
const { categorize } = require('./categories');
const {
  connectToSheet,
  ensureSheetStructure,
  getExistingIdentifiers,
  addTransactions,
  updateMonthlySummary,
  updateCategoryBreakdown,
  updateLastSync,
  createMonthlySheets,
} = require('./sheets');
const { formatSheet } = require('./format');

async function recategorizeExisting(txnSheet) {
  const rows = await txnSheet.getRows();
  if (rows.length === 0) return 0;

  const CATEGORY_COL = 3;
  const DESCRIPTION_COL = 2;

  await txnSheet.loadCells({
    startRowIndex: 1,
    endRowIndex: rows.length + 1,
    startColumnIndex: DESCRIPTION_COL,
    endColumnIndex: CATEGORY_COL + 1,
  });

  let updated = 0;
  for (let i = 0; i < rows.length; i++) {
    const descCell = txnSheet.getCell(i + 1, DESCRIPTION_COL);
    const catCell = txnSheet.getCell(i + 1, CATEGORY_COL);
    const description = descCell.value || '';
    const currentCategory = catCell.value || '';
    const newCategory = categorize(description);

    if (currentCategory !== newCategory && (currentCategory === 'אחר' || !currentCategory)) {
      catCell.value = newCategory;
      updated++;
    }
  }

  if (updated > 0) {
    await txnSheet.saveUpdatedCells();
  }
  return updated;
}

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
  const { doc, auth } = await connectToSheet(
    config.sheets.sheetId,
    config.sheets.serviceAccountEmail,
    config.sheets.privateKey
  );

  // Ensure sheet structure
  const { txnSheet, summarySheet, categoriesSheet, manualSheet, settingsSheet } =
    await ensureSheetStructure(doc, config.budget);

  // Get existing identifiers for deduplication
  const existingIds = await getExistingIdentifiers(txnSheet);
  console.log(`📋 Found ${existingIds.size} existing transactions in sheet`);

  // Add new transactions
  const result = await addTransactions(txnSheet, transactions, existingIds);
  console.log(`✅ Added ${result.added} new transactions (${result.skipped} already existed)`);

  // Re-categorize any "אחר" transactions with improved rules
  console.log('🏷️  Re-categorizing transactions...');
  const recategorized = await recategorizeExisting(txnSheet);
  if (recategorized > 0) console.log(`🏷️  Updated ${recategorized} categories`);

  // Create monthly sheets with category breakdowns
  console.log('📅 Creating monthly sheets...');
  const monthlySheetInfo = await createMonthlySheets(doc, txnSheet, manualSheet, config.budget);
  console.log(`📅 Updated ${monthlySheetInfo.length} monthly sheets`);

  // Update overview summaries
  console.log('📈 Updating monthly summary...');
  await updateMonthlySummary(txnSheet, summarySheet, manualSheet, config.budget);

  console.log('📊 Updating category breakdown...');
  await updateCategoryBreakdown(txnSheet, categoriesSheet, manualSheet);

  // Apply formatting + charts
  console.log('🎨 Applying formatting & charts...');
  await formatSheet(doc, auth, monthlySheetInfo);

  // Update last sync timestamp
  await updateLastSync(settingsSheet);

  console.log('🎉 Sync complete!');
  return result;
}

sync().catch(err => {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
});
