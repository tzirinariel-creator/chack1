// Auto-categorization based on merchant name patterns
// The user can add/edit categories in the "הגדרות" sheet

const CATEGORY_RULES = [
  // מזון ומשקאות
  { pattern: /סופר|שופרסל|רמי לוי|מגה|יוחננוף|פרש מרקט|חצי חינם|ויקטורי/i, category: 'מזון' },
  { pattern: /מאפי|לחם|בייקרי|bakery/i, category: 'מזון' },
  { pattern: /wolt|וולט|תן ביס|japanika|מסעדה|פיצה|בורגר|קפה|coffee|cafe|בית קפה|MA JOLIE/i, category: 'אוכל בחוץ' },
  { pattern: /סופר יודה|יודה/i, category: 'מזון' },
  { pattern: /המוציא/i, category: 'מזון' },

  // תחבורה
  { pattern: /רב.?קו|BIRD|LIME|גט|GETT|מונית|taxi|דלק|פז |סונול|דור אלון/i, category: 'תחבורה' },
  { pattern: /רכבת|אגד|דן |מטרופולין|קו אוטובוס/i, category: 'תחבורה' },

  // קניות
  { pattern: /אושר עד|H&M|ZARA|FOX|קניון|נעלי|ביגוד|SHEIN|ALIEXPRESS|AMAZON|אמזון/i, category: 'קניות' },
  { pattern: /CASHPRO|cashback/i, category: 'החזר כספי' },

  // דיור וחשבונות
  { pattern: /חשמל|מים|ארנונה|גז|בזק|HOT|YES|פרטנר|סלקום|cellcom/i, category: 'חשבונות' },
  { pattern: /שכירות|דירה|משכנתא/i, category: 'דיור' },

  // בריאות
  { pattern: /סופר.?פארם|בית מרקחת|רופא|מכבי|כללית|מאוחדת|לאומית/i, category: 'בריאות' },

  // טכנולוגיה ומנויים
  { pattern: /OPENAI|CLAUDE|SPOTIFY|NETFLIX|APPLE|GOOGLE|MICROSOFT|GPT|CHAT/i, category: 'טכנולוגיה' },

  // ספורט ופנאי
  { pattern: /חדר כושר|ספורט|יוגה|פילאטיס|הולמס/i, category: 'ספורט' },

  // העברות ובנקאות
  { pattern: /העברה|BIT|ביט|פייבוקס|PAYBOX/i, category: 'העברות' },
  { pattern: /דמי כרטיס|עמלה|ריבית/i, category: 'עמלות' },

  // חינוך
  { pattern: /אוניברסיט|מכללה|קורס|לימוד|ספר|book/i, category: 'חינוך' },

  // מועדון
  { pattern: /מועדון/i, category: 'פנאי' },
];

function categorize(description) {
  if (!description) return 'אחר';

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) {
      return rule.category;
    }
  }

  return 'אחר';
}

// Transactions to exclude from budget calculations (not real expenses)
const EXCLUDED_PATTERNS = [
  /דמי כרטיס/i,
  /CASHPRO/i,
  /החזר/i,
];

function isExcludedFromBudget(description) {
  return EXCLUDED_PATTERNS.some(p => p.test(description));
}

module.exports = { categorize, isExcludedFromBudget, CATEGORY_RULES };
