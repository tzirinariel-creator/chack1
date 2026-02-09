// Auto-categorization based on merchant name patterns

const CATEGORY_RULES = [
  // מזון ומשקאות
  { pattern: /סופר|שופרסל|רמי לוי|מגה|יוחננוף|פרש מרקט|חצי חינם|ויקטורי|טיב טעם|אושר עד/i, category: 'מזון' },
  { pattern: /מאפי|לחם|בייקרי|bakery/i, category: 'מזון' },
  { pattern: /ירקות|פירות|אורגני|טבעי|ירוק|טבע|vegan/i, category: 'מזון' },
  { pattern: /סופר יודה|יודה|המוציא/i, category: 'מזון' },
  { pattern: /קפה מכבי|קפה נמרוד|ארומה|קפה קפה|גרג|cofix|קופיקס/i, category: 'אוכל בחוץ' },
  { pattern: /wolt|וולט|תן ביס|japanika|מסעדה|פיצה|בורגר|coffee|cafe|בית קפה|MA JOLIE/i, category: 'אוכל בחוץ' },
  { pattern: /מקדונלד|KFC|דומינו|שווארמה|פלאפל|חומוס|סושי|PIZZA|BURGER/i, category: 'אוכל בחוץ' },

  // תחבורה
  { pattern: /רב.?קו|BIRD|LIME|גט|GETT|מונית|taxi|UBER/i, category: 'תחבורה' },
  { pattern: /דלק|פז |סונול|דור.?אלון|TEN|אלון/i, category: 'תחבורה' },
  { pattern: /רכבת|אגד|דן |מטרופולין|קו אוטובוס|אוטובוס/i, category: 'תחבורה' },
  { pattern: /חניה|חנייה|parking|אחוזת חוף/i, category: 'תחבורה' },

  // קניות
  { pattern: /H&M|ZARA|FOX|קניון|נעלי|ביגוד|SHEIN|ALIEXPRESS|AMAZON|אמזון|TEMU/i, category: 'קניות' },
  { pattern: /איקאה|IKEA|ACE|הום סנטר|HOME|ריהוט|מטבח/i, category: 'קניות' },
  { pattern: /EBAY|איביי|עלי אקספרס|WISH/i, category: 'קניות' },

  // דיור וחשבונות
  { pattern: /חשמל|חברת חשמל|IEC/i, category: 'חשבונות' },
  { pattern: /מים|מקורות|מי /i, category: 'חשבונות' },
  { pattern: /ארנונה|עירייה|עיריית/i, category: 'חשבונות' },
  { pattern: /גז|אמישראגז|סופרגז/i, category: 'חשבונות' },
  { pattern: /בזק|HOT|YES|פרטנר|סלקום|cellcom|גולן|012|013|019/i, category: 'חשבונות' },
  { pattern: /שכירות|דירה|משכנתא|ועד.?בית/i, category: 'דיור' },

  // בריאות
  { pattern: /סופר.?פארם|בית מרקחת|רופא|מכבי|כללית|מאוחדת|לאומית|Be|פארם/i, category: 'בריאות' },
  { pattern: /רופא|שיניים|עיניים|אופטיק/i, category: 'בריאות' },

  // טכנולוגיה ומנויים
  { pattern: /OPENAI|CLAUDE|SPOTIFY|NETFLIX|APPLE|GOOGLE|MICROSOFT|GPT|CHAT/i, category: 'טכנולוגיה' },
  { pattern: /YOUTUBE|DISNEY|HBO|DAZN|אנדרואיד|APP.?STORE/i, category: 'טכנולוגיה' },

  // ספורט ופנאי
  { pattern: /חדר כושר|ספורט|יוגה|פילאטיס|הולמס|GYM/i, category: 'ספורט' },

  // העברות ובנקאות
  { pattern: /העברה|BIT|ביט|פייבוקס|PAYBOX/i, category: 'העברות' },
  { pattern: /דמי כרטיס|עמלה|ריבית/i, category: 'עמלות' },
  { pattern: /CASHPRO|cashback|החזר/i, category: 'החזר כספי' },

  // חינוך
  { pattern: /אוניברסיט|מכללה|קורס|לימוד|ספר|book|UDEMY|COURSERA/i, category: 'חינוך' },

  // פנאי ובילויים
  { pattern: /מועדון|קולנוע|סינמה|yes planet|CINEMA|הופעה|הצגה|מוזיאון|תיאטרון/i, category: 'פנאי' },
  { pattern: /טיול|מלון|HOTEL|BOOKING|AIRBNB|אירבי/i, category: 'נסיעות' },

  // ביטוח
  { pattern: /ביטוח|פניקס|הראל|מגדל|כלל ביטוח|AIG/i, category: 'ביטוח' },

  // חיות מחמד
  { pattern: /וטרינר|חיות|PET/i, category: 'חיות מחמד' },

  // כללי - תפיסת רשת רחבה יותר
  { pattern: /פז אפליקציה|PAZ|פזומט/i, category: 'תחבורה' },
  { pattern: /טרמינל|TERMINAL/i, category: 'קניות' },
  { pattern: /אליעזר/i, category: 'אוכל בחוץ' },
  { pattern: /אריאלה/i, category: 'אוכל בחוץ' },
  { pattern: /ש\. שלמה/i, category: 'תחבורה' },
  { pattern: /מרכז ארצי/i, category: 'חינוך' },
  { pattern: /PENDING/i, category: 'אחר' },
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

// Transactions to exclude from budget calculations
const EXCLUDED_PATTERNS = [
  /דמי כרטיס/i,
  /CASHPRO/i,
  /החזר/i,
];

function isExcludedFromBudget(description) {
  return EXCLUDED_PATTERNS.some(p => p.test(description));
}

module.exports = { categorize, isExcludedFromBudget, CATEGORY_RULES };
