// Telegram Bot API wrapper (uses Node.js 22 built-in fetch)

const TELEGRAM_API = 'https://api.telegram.org';

async function sendMessage(botToken, chatId, text, options = {}) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...options,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram: ${data.description}`);
  return data;
}

async function getUpdates(botToken) {
  const res = await fetch(`${TELEGRAM_API}/bot${botToken}/getUpdates`);
  const data = await res.json();
  return data.ok ? data.result : [];
}

function fmt(amount) {
  return amount.toLocaleString('he-IL', { maximumFractionDigits: 0 });
}

function buildSyncMessage(added, newTransactions, budgetInfo) {
  let msg = '';

  if (added > 0) {
    msg += `💳 <b>${added} חיובים חדשים:</b>\n\n`;
    for (const t of newTransactions.slice(0, 8)) {
      msg += `• ${t.description} — ${fmt(t.amount)} ₪\n`;
    }
    if (newTransactions.length > 8) {
      msg += `   ...ועוד ${newTransactions.length - 8}\n`;
    }
    msg += '\n';
  }

  const { total, budget, remaining, usagePercent } = budgetInfo;
  let emoji;
  if (usagePercent <= 70) emoji = '🟢';
  else if (usagePercent <= 90) emoji = '🟡';
  else if (usagePercent <= 100) emoji = '🟠';
  else emoji = '🔴';

  msg += `${emoji} <b>סטטוס החודש:</b>\n`;
  msg += `   הוצאות: <b>${fmt(total)} ₪</b>\n`;
  msg += `   יעד: ${fmt(budget)} ₪\n`;
  msg += `   יתרה: ${fmt(remaining)} ₪\n`;
  msg += `   ניצול: ${usagePercent}%`;

  if (usagePercent >= 90 && usagePercent < 100) {
    msg += '\n\n⚠️ <b>שים לב!</b> מתקרב לגבול התקציב!';
  } else if (usagePercent >= 100) {
    msg += '\n\n🚨 <b>חריגה מהתקציב!</b>';
  }

  return msg;
}

function buildWeeklyMessage(weekData) {
  let msg = `📊 <b>סיכום שבועי</b>\n\n`;

  msg += `💰 הוצאות השבוע: <b>${fmt(weekData.weekTotal)} ₪</b>\n`;
  msg += `📅 הוצאות החודש: <b>${fmt(weekData.monthTotal)} ₪</b>\n`;
  msg += `🎯 יתרה: ${fmt(weekData.remaining)} ₪\n`;
  msg += `📝 ${weekData.weekCount} חיובים השבוע\n\n`;

  if (weekData.topCategories.length > 0) {
    msg += `<b>קטגוריות מובילות:</b>\n`;
    for (const [cat, amount] of weekData.topCategories.slice(0, 5)) {
      msg += `   ${cat}: ${fmt(amount)} ₪\n`;
    }
  }

  const { usagePercent } = weekData;
  const daysLeft = weekData.daysLeftInMonth;
  const dailyBudget = weekData.remaining > 0 ? Math.round(weekData.remaining / Math.max(daysLeft, 1)) : 0;

  msg += `\n💡 <b>נשארו ${daysLeft} ימים בחודש</b>`;
  if (dailyBudget > 0) {
    msg += `\n   תקציב יומי מומלץ: ${fmt(dailyBudget)} ₪`;
  }

  return msg;
}

function buildErrorMessage(error) {
  let msg = `🚨 <b>שגיאה בסנכרון!</b>\n\n`;
  msg += `❌ ${error.message || 'Unknown error'}\n\n`;
  msg += `⏰ ${new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' })}`;
  return msg;
}

module.exports = { sendMessage, getUpdates, buildSyncMessage, buildWeeklyMessage, buildErrorMessage, fmt };
