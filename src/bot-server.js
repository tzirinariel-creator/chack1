// CashFlow AI - Interactive Telegram Financial Companion
// Run with: npm run bot

require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const cron = require('node-cron');
const { getBotConfig } = require('./config');
const { connectToSheet, ensureSheetStructure, addManualTransaction } = require('./sheets');
const {
  getBudgetStatus,
  isAnomaly,
  getInsight,
  parseExpenseMessage,
  buildStatusMessage,
  buildTopCategoriesMessage,
  buildExpenseConfirmation,
  TRANSFER_OPTIONS,
  fmt,
} = require('./financial-brain');

// === GLOBALS ===
let doc, txnSheet, manualSheet, budget;
const pendingTransfers = new Map(); // chatId -> { amount, description, messageId }

// === SHEETS CONNECTION ===

async function initSheets(config) {
  const { doc: d } = await connectToSheet(
    config.sheets.sheetId,
    config.sheets.serviceAccountEmail,
    config.sheets.privateKey
  );
  doc = d;
  const structure = await ensureSheetStructure(doc, config.budget);
  txnSheet = structure.txnSheet;
  manualSheet = structure.manualSheet;
  budget = config.budget;
  console.log('📊 Connected to Google Sheets');
}

// === BOT SETUP ===

const config = getBotConfig();
const bot = new Telegraf(config.telegram.botToken);
const CHAT_ID = config.telegram.chatId;

// Auth guard - only respond to Ariel
function isAuthorized(ctx) {
  return String(ctx.chat.id) === String(CHAT_ID);
}

// === COMMANDS ===

bot.command('start', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  await ctx.replyWithHTML(
    `🚀 <b>CashFlow AI פעיל!</b>\n\n` +
    `אני המלווה הפיננסי שלך. הנה מה שאני יודע לעשות:\n\n` +
    `💬 <b>הוספת הוצאה:</b> פשוט כתוב "50 פיצה" או "סופר 120"\n` +
    `📊 /status — מצב התקציב\n` +
    `🏷️ /top — הוצאות לפי קטגוריה\n` +
    `📅 /month — סיכום חודשי\n` +
    `❓ /help — עזרה\n\n` +
    `כל ערב ב-20:00 אשאל אותך על הוצאות מזומן 😉`
  );
});

bot.command('help', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  await ctx.replyWithHTML(
    `📖 <b>איך להשתמש:</b>\n\n` +
    `<b>הוספת הוצאה ידנית:</b>\n` +
    `• "50 פיצה" — מוסיף ₪50, קטגוריה: אוכל בחוץ\n` +
    `• "סופר 120" — מוסיף ₪120, קטגוריה: מזון\n` +
    `• "200" — מוסיף ₪200, קטגוריה: אחר\n\n` +
    `<b>פקודות:</b>\n` +
    `/status — כמה הוצאתי? כמה נשאר?\n` +
    `/top — חלוקה לפי קטגוריות\n` +
    `/month — סיכום חודש נוכחי מפורט\n` +
    `/help — ההודעה הזאת\n\n` +
    `💡 העברות ביט יקבלו שאלת הבהרה אוטומטית`
  );
});

bot.command('status', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  try {
    const status = await getBudgetStatus(txnSheet, manualSheet, budget);
    await ctx.replyWithHTML(buildStatusMessage(status));
  } catch (e) {
    console.error('Status error:', e.message);
    await ctx.reply('❌ שגיאה בטעינת הנתונים. נסה שוב.');
  }
});

bot.command('top', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  try {
    const status = await getBudgetStatus(txnSheet, manualSheet, budget);
    await ctx.replyWithHTML(buildTopCategoriesMessage(status.topCategories));
  } catch (e) {
    console.error('Top error:', e.message);
    await ctx.reply('❌ שגיאה בטעינת הנתונים. נסה שוב.');
  }
});

bot.command('month', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  try {
    const status = await getBudgetStatus(txnSheet, manualSheet, budget);
    let msg = buildStatusMessage(status);
    msg += '\n\n';
    msg += buildTopCategoriesMessage(status.topCategories);
    await ctx.replyWithHTML(msg);
  } catch (e) {
    console.error('Month error:', e.message);
    await ctx.reply('❌ שגיאה בטעינת הנתונים. נסה שוב.');
  }
});

// === NATURAL LANGUAGE EXPENSE ENTRY ===

bot.on('text', async (ctx) => {
  if (!isAuthorized(ctx)) return;

  const text = ctx.message.text;

  // Skip if it starts with / (command)
  if (text.startsWith('/')) return;

  const parsed = parseExpenseMessage(text);
  if (!parsed) {
    await ctx.reply('🤔 לא הבנתי. כתוב סכום + תיאור, למשל: "50 פיצה"');
    return;
  }

  // Ambiguous transfer? Ask for clarification
  if (parsed.isAmbiguous) {
    const key = `${ctx.chat.id}`;
    pendingTransfers.set(key, {
      amount: parsed.amount,
      description: parsed.description,
    });

    await ctx.replyWithHTML(
      `🔄 העברה של <b>₪${fmt(parsed.amount)}</b> — ${parsed.description}\n\nמה סוג ההוצאה?`,
      Markup.inlineKeyboard(
        TRANSFER_OPTIONS.map(opt =>
          Markup.button.callback(opt.label, `transfer_${opt.value}`)
        ),
        { columns: 2 }
      )
    );
    return;
  }

  // Regular expense - add immediately
  try {
    await addManualTransaction(manualSheet, {
      description: parsed.description,
      amount: parsed.amount,
      category: parsed.category,
    });

    // Get current budget status for insight
    const status = await getBudgetStatus(txnSheet, manualSheet, budget);
    const insight = getInsight(parsed.category, status.usagePercent);

    let anomalyNote = '';
    if (isAnomaly(parsed.amount, budget)) {
      anomalyNote = `\n\n⚡ הוצאה גדולה! זה ${Math.round((parsed.amount / budget) * 100)}% מהתקציב החודשי`;
    }

    await ctx.replyWithHTML(
      buildExpenseConfirmation(parsed, insight) + anomalyNote
    );
  } catch (e) {
    console.error('Add expense error:', e.message);
    await ctx.reply('❌ לא הצלחתי לרשום. נסה שוב.');
  }
});

// === TRANSFER DISAMBIGUATION CALLBACKS ===

bot.action(/^transfer_(.+)$/, async (ctx) => {
  const choice = ctx.match[1];
  const key = `${ctx.chat.id}`;
  const pending = pendingTransfers.get(key);

  if (!pending) {
    await ctx.answerCbQuery('⏰ פג תוקף, שלח שוב');
    return;
  }

  pendingTransfers.delete(key);
  await ctx.answerCbQuery();

  if (choice === 'ignore') {
    await ctx.editMessageText('🚫 לא נספר את זה.');
    return;
  }

  const categoryMap = {
    expense: 'העברות',
    gift: 'מתנות',
    savings: 'חיסכון',
  };
  const category = categoryMap[choice] || 'העברות';

  try {
    await addManualTransaction(manualSheet, {
      description: pending.description,
      amount: pending.amount,
      category,
      note: `סיווג: ${choice}`,
    });

    await ctx.editMessageText(
      `✅ נרשם: ${pending.description} — ₪${fmt(pending.amount)} (${category})`,
      { parse_mode: 'HTML' }
    );
  } catch (e) {
    console.error('Transfer save error:', e.message);
    await ctx.editMessageText('❌ שגיאה בשמירה, נסה שוב');
  }
});

// === PROACTIVE: EVENING REMINDER (20:00 Israel time) ===

cron.schedule('0 20 * * *', async () => {
  console.log('🌙 Sending evening reminder...');
  try {
    const status = await getBudgetStatus(txnSheet, manualSheet, budget);
    let msg = `🌙 <b>ערב טוב אריאל!</b>\n\n`;
    msg += `יש הוצאות מזומן מהיום?\n`;
    msg += `פשוט כתוב לי, למשל: "50 פיצה"\n\n`;
    msg += `📊 מצב היום: ₪${fmt(status.total)} / ₪${fmt(status.budget)} (${status.usagePercent}%)`;

    if (status.dailyBudget > 0) {
      msg += `\n🎯 תקציב יומי: ₪${fmt(status.dailyBudget)}`;
    }

    await bot.telegram.sendMessage(CHAT_ID, msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error('Evening reminder error:', e.message);
  }
}, { timezone: 'Asia/Jerusalem' });

// === STARTUP ===

async function start() {
  console.log('🚀 Starting CashFlow AI...');

  await initSheets(config);

  bot.launch();
  console.log('🤖 Bot is running (long polling)');
  console.log('📱 Send /start to the bot to begin');
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start().catch(err => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});
