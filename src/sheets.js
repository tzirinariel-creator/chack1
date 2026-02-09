const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { categorize, isExcludedFromBudget } = require('./categories');

const TRANSACTIONS_SHEET = 'עסקאות';
const SUMMARY_SHEET = 'סיכום חודשי';
const CATEGORIES_SHEET = 'לפי קטגוריה';
const MANUAL_SHEET = 'עסקאות ידניות';
const SETTINGS_SHEET = 'הגדרות';

const HEADERS = [
  'תאריך עסקה',
  'תאריך חיוב',
  'עסק',
  'קטגוריה',
  'סכום (₪)',
  'סכום מקורי',
  'מטבע',
  'סטטוס',
  'סוג',
  'הערה',
  'החזר?',
  'מזהה',
];

const MANUAL_HEADERS = [
  'תאריך',
  'תיאור',
  'קטגוריה',
  'סכום (₪)',
  'הערה',
];

async function connectToSheet(sheetId, serviceAccountEmail, privateKey) {
  const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(sheetId, auth);
  await doc.loadInfo();
  return doc;
}

async function ensureSheetStructure(doc, monthlyBudget) {
  // Transactions sheet
  let txnSheet = doc.sheetsByTitle[TRANSACTIONS_SHEET];
  if (!txnSheet) {
    txnSheet = await doc.addSheet({
      title: TRANSACTIONS_SHEET,
      headerValues: HEADERS,
    });
  }

  // Monthly summary sheet
  let summarySheet = doc.sheetsByTitle[SUMMARY_SHEET];
  if (!summarySheet) {
    summarySheet = await doc.addSheet({ title: SUMMARY_SHEET });
    await summarySheet.setHeaderRow(['חודש', 'סה"כ הוצאות', 'יעד', 'יתרה', 'אחוז ניצול', 'סטטוס']);
  }

  // Categories breakdown sheet
  let categoriesSheet = doc.sheetsByTitle[CATEGORIES_SHEET];
  if (!categoriesSheet) {
    categoriesSheet = await doc.addSheet({ title: CATEGORIES_SHEET });
    await categoriesSheet.setHeaderRow(['חודש', 'קטגוריה', 'סה"כ', 'מספר עסקאות', 'אחוז מהחודש']);
  }

  // Manual transactions sheet
  let manualSheet = doc.sheetsByTitle[MANUAL_SHEET];
  if (!manualSheet) {
    manualSheet = await doc.addSheet({
      title: MANUAL_SHEET,
      headerValues: MANUAL_HEADERS,
    });
  }

  // Settings sheet
  let settingsSheet = doc.sheetsByTitle[SETTINGS_SHEET];
  if (!settingsSheet) {
    settingsSheet = await doc.addSheet({ title: SETTINGS_SHEET });
    await settingsSheet.setHeaderRow(['הגדרה', 'ערך']);
    await settingsSheet.addRow({ 'הגדרה': 'יעד חודשי', 'ערך': monthlyBudget });
    await settingsSheet.addRow({ 'הגדרה': 'עדכון אחרון', 'ערך': '' });
  }

  return { txnSheet, summarySheet, categoriesSheet, manualSheet, settingsSheet };
}

async function getExistingIdentifiers(txnSheet) {
  const rows = await txnSheet.getRows();
  const identifiers = new Set();
  for (const row of rows) {
    const id = row.get('מזהה');
    if (id) identifiers.add(id);
  }
  return identifiers;
}

async function addTransactions(txnSheet, transactions, existingIds) {
  const newTransactions = transactions.filter(t => !existingIds.has(t.identifier));

  if (newTransactions.length === 0) {
    return { added: 0, skipped: transactions.length };
  }

  const rows = newTransactions.map(t => ({
    'תאריך עסקה': t.date,
    'תאריך חיוב': t.processedDate,
    'עסק': t.description,
    'קטגוריה': categorize(t.description),
    'סכום (₪)': t.amount,
    'סכום מקורי': t.originalCurrency !== 'ILS' ? `${t.originalAmount} ${t.originalCurrency}` : t.amount,
    'מטבע': t.originalCurrency,
    'סטטוס': t.status === 'completed' ? 'הושלם' : 'ממתין',
    'סוג': t.type === 'normal' ? 'רגיל' : t.type === 'installments' ? 'תשלומים' : t.type,
    'הערה': t.memo,
    'החזר?': '',
    'מזהה': t.identifier,
  }));

  await txnSheet.addRows(rows);
  return { added: newTransactions.length, skipped: transactions.length - newTransactions.length };
}

async function getAllTransactions(txnSheet, manualSheet) {
  const txnRows = await txnSheet.getRows();
  const transactions = [];

  for (const row of txnRows) {
    const isRefund = (row.get('החזר?') || '').trim();
    if (isRefund === 'כן' || isRefund === 'V' || isRefund === 'v' || isRefund === '✓') continue;

    const description = row.get('עסק') || '';
    if (isExcludedFromBudget(description)) continue;

    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    const chargeDate = row.get('תאריך חיוב') || row.get('תאריך עסקה') || '';
    const category = row.get('קטגוריה') || categorize(description);

    if (chargeDate && amount > 0) {
      transactions.push({ date: chargeDate, amount, category, description });
    }
  }

  // Include manual transactions
  const manualRows = await manualSheet.getRows();
  for (const row of manualRows) {
    const date = row.get('תאריך') || '';
    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    const category = row.get('קטגוריה') || 'אחר';
    const description = row.get('תיאור') || '';

    if (date && amount > 0) {
      transactions.push({ date, amount, category, description });
    }
  }

  return transactions;
}

async function updateMonthlySummary(txnSheet, summarySheet, manualSheet, monthlyBudget) {
  const transactions = await getAllTransactions(txnSheet, manualSheet);

  // Group by month
  const months = {};
  for (const t of transactions) {
    const monthKey = t.date.substring(0, 7); // YYYY-MM
    if (!months[monthKey]) months[monthKey] = 0;
    months[monthKey] += t.amount;
  }

  // Clear and rewrite
  const existingRows = await summarySheet.getRows();
  for (const row of existingRows) await row.delete();

  const sortedMonths = Object.keys(months).sort().reverse();
  const summaryRows = sortedMonths.map(month => {
    const total = Math.round(months[month]);
    const remaining = monthlyBudget - total;
    const usagePercent = Math.round((total / monthlyBudget) * 100);
    let status;
    if (usagePercent <= 70) status = '🟢 מצוין';
    else if (usagePercent <= 90) status = '🟡 שים לב';
    else if (usagePercent <= 100) status = '🟠 קרוב לגבול';
    else status = '🔴 חריגה!';

    return {
      'חודש': month,
      'סה"כ הוצאות': total,
      'יעד': monthlyBudget,
      'יתרה': remaining,
      'אחוז ניצול': `${usagePercent}%`,
      'סטטוס': status,
    };
  });

  if (summaryRows.length > 0) await summarySheet.addRows(summaryRows);
}

async function updateCategoryBreakdown(txnSheet, categoriesSheet, manualSheet) {
  const transactions = await getAllTransactions(txnSheet, manualSheet);

  // Group by month + category
  const breakdown = {};
  const monthTotals = {};

  for (const t of transactions) {
    const monthKey = t.date.substring(0, 7);
    const key = `${monthKey}|${t.category}`;

    if (!breakdown[key]) breakdown[key] = { total: 0, count: 0 };
    breakdown[key].total += t.amount;
    breakdown[key].count += 1;

    if (!monthTotals[monthKey]) monthTotals[monthKey] = 0;
    monthTotals[monthKey] += t.amount;
  }

  // Clear and rewrite
  const existingRows = await categoriesSheet.getRows();
  for (const row of existingRows) await row.delete();

  const rows = Object.entries(breakdown)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => {
      const [month, category] = key.split('|');
      const monthTotal = monthTotals[month] || 1;
      const percent = Math.round((data.total / monthTotal) * 100);
      return {
        'חודש': month,
        'קטגוריה': category,
        'סה"כ': Math.round(data.total),
        'מספר עסקאות': data.count,
        'אחוז מהחודש': `${percent}%`,
      };
    });

  if (rows.length > 0) await categoriesSheet.addRows(rows);
}

async function updateLastSync(settingsSheet) {
  const rows = await settingsSheet.getRows();
  const syncRow = rows.find(r => r.get('הגדרה') === 'עדכון אחרון');
  if (syncRow) {
    syncRow.set('ערך', new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }));
    await syncRow.save();
  }
}

module.exports = {
  connectToSheet,
  ensureSheetStructure,
  getExistingIdentifiers,
  addTransactions,
  updateMonthlySummary,
  updateCategoryBreakdown,
  updateLastSync,
};
