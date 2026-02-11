const { getConfig } = require('./config');
const { connectToSheet, ensureSheetStructure } = require('./sheets');
const { categorize, isExcludedFromBudget } = require('./categories');
const { sendMessage, buildWeeklyMessage } = require('./telegram');

async function getWeeklyData(txnSheet, manualSheet, budget) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Last 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];

  const txnRows = await txnSheet.getRows();
  let monthTotal = 0;
  let weekTotal = 0;
  let weekCount = 0;
  const categoryTotals = {};

  for (const row of txnRows) {
    const isRefund = (row.get('החזר?') || '').trim();
    if (isRefund === 'כן' || isRefund === 'V' || isRefund === 'v' || isRefund === '✓') continue;

    const description = row.get('עסק') || '';
    if (isExcludedFromBudget(description)) continue;

    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    if (amount <= 0) continue;

    const chargeDate = row.get('תאריך חיוב') || row.get('תאריך עסקה') || '';
    if (!chargeDate.startsWith(currentMonth)) continue;

    const category = row.get('קטגוריה') || categorize(description);
    monthTotal += amount;

    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;

    if (chargeDate >= weekAgoStr) {
      weekTotal += amount;
      weekCount++;
    }
  }

  // Include manual transactions
  const manualRows = await manualSheet.getRows();
  for (const row of manualRows) {
    const date = row.get('תאריך') || '';
    if (!date.startsWith(currentMonth)) continue;

    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    if (amount <= 0) continue;

    const category = row.get('קטגוריה') || 'אחר';
    monthTotal += amount;

    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;

    if (date >= weekAgoStr) {
      weekTotal += amount;
      weekCount++;
    }
  }

  // Days left in month
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();

  const remaining = budget - Math.round(monthTotal);
  const usagePercent = Math.round((monthTotal / budget) * 100);

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => [cat, Math.round(amount)]);

  return {
    weekTotal: Math.round(weekTotal),
    monthTotal: Math.round(monthTotal),
    remaining,
    weekCount,
    usagePercent,
    daysLeftInMonth: daysLeft,
    topCategories,
  };
}

async function sendWeeklySummary() {
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;

  if (!telegramToken || !telegramChatId) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set, skipping weekly summary');
    return;
  }

  console.log('📊 Generating weekly summary...');
  const config = getConfig();

  const { doc } = await connectToSheet(
    config.sheets.sheetId,
    config.sheets.serviceAccountEmail,
    config.sheets.privateKey
  );

  const { txnSheet, manualSheet } = await ensureSheetStructure(doc, config.budget);
  const weekData = await getWeeklyData(txnSheet, manualSheet, config.budget);
  const message = buildWeeklyMessage(weekData);

  await sendMessage(telegramToken, telegramChatId, message);
  console.log('📊 Weekly summary sent!');
}

sendWeeklySummary().catch(err => {
  console.error('❌ Weekly summary failed:', err.message);
  process.exit(1);
});
