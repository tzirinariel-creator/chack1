require('dotenv').config();

function getConfig() {
  const required = {
    CAL_USERNAME: process.env.CAL_USERNAME,
    CAL_PASSWORD: process.env.CAL_PASSWORD,
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}\nSee .env.example for reference.`);
  }

  return {
    cal: {
      username: required.CAL_USERNAME,
      password: required.CAL_PASSWORD,
    },
    sheets: {
      sheetId: required.GOOGLE_SHEET_ID,
      serviceAccountEmail: required.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      privateKey: required.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    budget: parseInt(process.env.MONTHLY_BUDGET || '3000', 10),
  };
}

module.exports = { getConfig };
