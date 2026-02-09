# הגדרת chack1 - מעקב הוצאות אשראי אוטומטי

## מה צריך (פעם אחת)

### 1. Google Sheet חדש
- צור Google Sheet חדש
- העתק את ה-ID מה-URL: `https://docs.google.com/spreadsheets/d/**SHEET_ID_HERE**/edit`

### 2. Google Service Account
זה מה שמאפשר לסקריפט לכתוב ל-Sheet שלך.

1. לך ל-[Google Cloud Console](https://console.cloud.google.com)
2. צור פרויקט חדש (או השתמש בקיים)
3. הפעל את **Google Sheets API**:
   - תפריט > APIs & Services > Enable APIs
   - חפש "Google Sheets API" > Enable
4. צור Service Account:
   - תפריט > IAM & Admin > Service Accounts
   - Create Service Account
   - תן שם (למשל "chack1")
   - Create and Continue > Done
5. צור מפתח:
   - לחץ על ה-Service Account שיצרת
   - Keys > Add Key > Create New Key > JSON
   - הקובץ יורד אוטומטית
6. שתף את ה-Sheet:
   - פתח את ה-Google Sheet
   - Share > הוסף את כתובת ה-email של ה-Service Account (נמצאת בקובץ JSON בשדה `client_email`)
   - תן הרשאת Editor

### 3. הגדרת Secrets ב-GitHub
לך ל-Settings > Secrets and Variables > Actions ב-repo שלך, והוסף:

| Secret | ערך |
|--------|-----|
| `CAL_USERNAME` | תעודת הזהות שלך |
| `CAL_PASSWORD` | הסיסמה לאתר כאל |
| `GOOGLE_SHEET_ID` | ה-ID מה-URL של ה-Sheet |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ה-`client_email` מקובץ ה-JSON |
| `GOOGLE_PRIVATE_KEY` | ה-`private_key` מקובץ ה-JSON (כולל ה-BEGIN/END) |
| `MONTHLY_BUDGET` | 3000 (או כל סכום אחר) |

## הרצה ידנית (לבדיקה)

```bash
# העתק את קובץ ההגדרות ומלא את הפרטים
cp .env.example .env
nano .env

# התקן חבילות
npm install

# הרץ
npm run sync
```

## מה קורה אחרי ההגדרה?
- הסקריפט רץ אוטומטית כל 6 שעות דרך GitHub Actions
- אפשר גם להפעיל ידנית: Actions > Sync Cal Transactions > Run workflow
- ה-Google Sheet מתעדכן עם עסקאות חדשות
- גיליון "סיכום חודשי" מראה לך אם אתה בתקציב

## מבנה ה-Google Sheet

### גיליון "עסקאות"
כל שורה = עסקה אחת עם: תאריך, שם העסק, סכום, סטטוס

### גיליון "סיכום חודשי"
סה"כ הוצאות לכל חודש, מול היעד שלך (3000₪)

### גיליון "הגדרות"
יעד חודשי + זמן עדכון אחרון
