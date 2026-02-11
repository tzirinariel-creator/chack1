// Financial Brain - Budget logic, insights, anomaly detection, message parsing
const { categorize, isExcludedFromBudget } = require('./categories');

// === BUDGET STATUS ===

async function getBudgetStatus(txnSheet, manualSheet, budget) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let total = 0;
  const categoryTotals = {};

  const txnRows = await txnSheet.getRows();
  for (const row of txnRows) {
    const isRefund = (row.get('החזר?') || '').trim();
    if (isRefund === 'כן' || isRefund === 'V' || isRefund === 'v' || isRefund === '✓') continue;

    const description = row.get('עסק') || '';
    if (isExcludedFromBudget(description)) continue;

    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    if (amount <= 0) continue;

    const chargeDate = row.get('תאריך חיוב') || row.get('תאריך עסקה') || '';
    if (!chargeDate.startsWith(currentMonth)) continue;

    const category = row.get('קטגוריה') || 'אחר';
    total += amount;
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;
  }

  const manualRows = await manualSheet.getRows();
  for (const row of manualRows) {
    const date = row.get('תאריך') || '';
    if (!date.startsWith(currentMonth)) continue;

    const amount = parseFloat(row.get('סכום (₪)')) || 0;
    if (amount <= 0) continue;

    const category = row.get('קטגוריה') || 'אחר';
    total += amount;
    if (!categoryTotals[category]) categoryTotals[category] = 0;
    categoryTotals[category] += amount;
  }

  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate();
  const remaining = budget - Math.round(total);
  const usagePercent = Math.round((total / budget) * 100);
  const dailyBudget = remaining > 0 ? Math.round(remaining / Math.max(daysLeft, 1)) : 0;

  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({ category: cat, amount: Math.round(amount) }));

  return {
    total: Math.round(total),
    budget,
    remaining,
    usagePercent,
    daysLeft,
    dailyBudget,
    topCategories,
    categoryTotals,
  };
}

// === ANOMALY DETECTION ===

function isAnomaly(amount, budget) {
  return amount > budget * 0.1;
}

// === SMART INSIGHTS ===

const CATEGORY_INSIGHTS = {
  'אוכל בחוץ': [
    'שוב אוכל בחוץ? 🍕 אולי מחר תבשל משהו?',
    'הרבה מסעדות החודש! 🍔 שווה להכין ארוחה בבית',
    'כמה טעים... אבל הארנק בוכה 😅',
  ],
  'קניות': [
    'עוד שופינג? 🛍️ בודק אם באמת חסר',
    'לפני הקנייה הבאה - שווה לחכות 24 שעות 🤔',
  ],
  'תחבורה': [
    'הרבה נסיעות! 🚗 אולי שווה רב-קו חודשי?',
  ],
  'טכנולוגיה': [
    'מנויים דיגיטליים מצטברים! 💻 בודק מה באמת משתמש?',
  ],
  'פנאי': [
    'חיים רק פעם אחת! 🎉 אבל גם התקציב מוגבל',
  ],
};

function getInsight(category, usagePercent) {
  // Budget threshold alerts take priority
  if (usagePercent >= 100) {
    return '🚨 חריגה מהתקציב! רק הוצאות הכרחיות מכאן';
  }
  if (usagePercent >= 90) {
    return '🔥 90%+ מהתקציב! מומלץ לעצור הוצאות לא חיוניות';
  }
  if (usagePercent >= 75) {
    return '⚠️ עברת 75% מהתקציב. שווה להאט קצת';
  }

  // Category-specific insight
  const insights = CATEGORY_INSIGHTS[category];
  if (insights) {
    return insights[Math.floor(Math.random() * insights.length)];
  }

  return null;
}

// === MESSAGE PARSING ===
// Understands: "50 פיצה", "פיצה 50", "סופר 120.50", "200"

const AMOUNT_FIRST = /^(\d+(?:\.\d+)?)\s+(.+)$/;
const AMOUNT_LAST = /^(.+?)\s+(\d+(?:\.\d+)?)$/;
const AMOUNT_ONLY = /^(\d+(?:\.\d+)?)$/;

function parseExpenseMessage(text) {
  const trimmed = text.trim();

  let amount, description;

  // Try "50 פיצה"
  let match = trimmed.match(AMOUNT_FIRST);
  if (match) {
    amount = parseFloat(match[1]);
    description = match[2].trim();
  }

  // Try "פיצה 50"
  if (!amount) {
    match = trimmed.match(AMOUNT_LAST);
    if (match) {
      description = match[1].trim();
      amount = parseFloat(match[2]);
    }
  }

  // Try just "50" (amount only)
  if (!amount) {
    match = trimmed.match(AMOUNT_ONLY);
    if (match) {
      amount = parseFloat(match[1]);
      description = '';
    }
  }

  if (!amount || amount <= 0 || amount > 50000) return null;

  const category = description ? categorize(description) : 'אחר';
  const isAmbiguous = category === 'העברות' || /ביט|bit|פייבוקס|paybox/i.test(description);

  return { amount, description: description || 'הוצאה ידנית', category, isAmbiguous };
}

// === TRANSFER DISAMBIGUATION ===

const TRANSFER_OPTIONS = [
  { label: '💸 הוצאה', value: 'expense' },
  { label: '🎁 מתנה', value: 'gift' },
  { label: '💰 חיסכון', value: 'savings' },
  { label: '🚫 לא לספור', value: 'ignore' },
];

// === FORMAT HELPERS ===

function fmt(amount) {
  return amount.toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function buildStatusMessage(status) {
  let emoji;
  if (status.usagePercent <= 50) emoji = '🟢';
  else if (status.usagePercent <= 70) emoji = '🟢';
  else if (status.usagePercent <= 90) emoji = '🟡';
  else if (status.usagePercent <= 100) emoji = '🟠';
  else emoji = '🔴';

  let msg = `${emoji} <b>מצב התקציב:</b>\n\n`;
  msg += `💰 הוצאות: <b>₪${fmt(status.total)}</b> / ₪${fmt(status.budget)}\n`;
  msg += `📊 ניצול: <b>${status.usagePercent}%</b>\n`;
  msg += `💵 נשאר: ₪${fmt(status.remaining)}\n`;
  msg += `📅 ימים עד סוף החודש: ${status.daysLeft}\n`;

  if (status.dailyBudget > 0) {
    msg += `\n🎯 <b>תקציב יומי מומלץ: ₪${fmt(status.dailyBudget)}</b>`;
  }

  return msg;
}

function buildTopCategoriesMessage(categories) {
  if (categories.length === 0) return 'אין עדיין הוצאות החודש 🎉';

  let msg = `📊 <b>הוצאות לפי קטגוריה:</b>\n\n`;
  const total = categories.reduce((sum, c) => sum + c.amount, 0);

  for (const { category, amount } of categories.slice(0, 8)) {
    const pct = Math.round((amount / total) * 100);
    const bar = '█'.repeat(Math.max(1, Math.round(pct / 10))) + '░'.repeat(Math.max(0, 10 - Math.round(pct / 10)));
    msg += `${bar} ${category}: ₪${fmt(amount)} (${pct}%)\n`;
  }

  return msg;
}

function buildExpenseConfirmation(expense, insight) {
  let msg = `✅ <b>נרשם!</b>\n\n`;
  msg += `📝 ${expense.description}\n`;
  msg += `💰 ₪${fmt(expense.amount)}\n`;
  msg += `🏷️ ${expense.category}`;

  if (insight) {
    msg += `\n\n💡 ${insight}`;
  }

  return msg;
}

module.exports = {
  getBudgetStatus,
  isAnomaly,
  getInsight,
  parseExpenseMessage,
  buildStatusMessage,
  buildTopCategoriesMessage,
  buildExpenseConfirmation,
  TRANSFER_OPTIONS,
  fmt,
};
