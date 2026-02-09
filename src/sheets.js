const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const TRANSACTIONS_SHEET = 'עסקאות';
const SUMMARY_SHEET = 'סיכום חודשי';
const SETTINGS_SHEET = 'הגדרות';

const HEADERS = [
  'תאריך עסקה',
  'תאריך חיוב',
  'עסק',
  'סכום (₪)',
  'סכום מקורי',
  'מטבע',
  'סטטוס',
  'סוג',
  'הערה',
  'מזהה',
  'חשבון',
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
  // Ensure transactions sheet exists
  let txnSheet = doc.sheetsByTitle[TRANSACTIONS_SHEET];
  if (!txnSheet) {
    txnSheet = await doc.addSheet({
      title: TRANSACTIONS_SHEET,
      headerValues: HEADERS,
    });
  }

  // Ensure summary sheet exists
  let summarySheet = doc.sheetsByTitle[SUMMARY_SHEET];
  if (!summarySheet) {
    summarySheet = await doc.addSheet({ title: SUMMARY_SHEET });
    await summarySheet.setHeaderRow(['חודש', 'סה"כ הוצאות', 'יעד', 'יתרה', 'סטטוס']);
  }

  // Ensure settings sheet exists
  let settingsSheet = doc.sheetsByTitle[SETTINGS_SHEET];
  if (!settingsSheet) {
    settingsSheet = await doc.addSheet({ title: SETTINGS_SHEET });
    await settingsSheet.setHeaderRow(['הגדרה', 'ערך']);
    await settingsSheet.addRow({ 'הגדרה': 'יעד חודשי', 'ערך': monthlyBudget });
    await settingsSheet.addRow({ 'הגדרה': 'עדכון אחרון', 'ערך': new Date().toISOString() });
  }

  return { txnSheet, summarySheet, settingsSheet };
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
    'סכום (₪)': t.amount,
    'סכום מקורי': t.originalAmount,
    'מטבע': t.originalCurrency,
    'סטטוס': t.status === 'completed' ? 'הושלם' : 'ממתין',
    'סוג': t.type === 'normal' ? 'רגיל' : t.type === 'installments' ? 'תשלומים' : t.type,
    'הערה': t.memo,
    'מזהה': t.identifier,
    'חשבון': t.accountNumber,
  }));

  await txnSheet.addRows(rows);

  return { added: newTransactions.length, skipped: transactions.length - newTransactions.length };
}

async function updateMonthlySummary(txnSheet, summarySheet, monthlyBudget) {
  const rows = await txnSheet.getRows();

  // Group by month
  const months = {};
  for (const row of rows) {
    const date = row.get('תאריך חיוב') || row.get('תאריך עסקה');
    if (!date) continue;
    const monthKey = date.substring(0, 7); // YYYY-MM
    if (!months[monthKey]) months[monthKey] = 0;
    months[monthKey] += parseFloat(row.get('סכום (₪)')) || 0;
  }

  // Clear and rewrite summary
  const existingSummaryRows = await summarySheet.getRows();
  for (const row of existingSummaryRows) {
    await row.delete();
  }

  const sortedMonths = Object.keys(months).sort().reverse();
  const summaryRows = sortedMonths.map(month => {
    const total = Math.round(months[month]);
    const remaining = monthlyBudget - total;
    return {
      'חודש': month,
      'סה"כ הוצאות': total,
      'יעד': monthlyBudget,
      'יתרה': remaining,
      'סטטוס': remaining >= 0 ? 'בתקציב ✓' : 'חריגה ✗',
    };
  });

  if (summaryRows.length > 0) {
    await summarySheet.addRows(summaryRows);
  }
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
  updateLastSync,
};
