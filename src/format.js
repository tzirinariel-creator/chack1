// Sheet formatting - RTL, colors, clean layout

const COLORS = {
  headerBg: { red: 0.15, green: 0.35, blue: 0.6 },       // כחול כהה
  headerText: { red: 1, green: 1, blue: 1 },               // לבן
  altRowBg: { red: 0.93, green: 0.95, blue: 0.98 },        // תכלת בהיר
  white: { red: 1, green: 1, blue: 1 },
};

async function formatSheet(doc) {
  const requests = [];

  for (const sheet of doc.sheetsByIndex) {
    const sheetId = sheet.sheetId;

    // Set RTL direction
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, rightToLeft: true },
        fields: 'rightToLeft',
      },
    });

    // Format header row
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: COLORS.headerBg,
            textFormat: {
              foregroundColor: COLORS.headerText,
              bold: true,
              fontSize: 11,
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    });

    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: 'gridProperties.frozenRowCount',
      },
    });

    // Set header row height
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 40 },
        fields: 'pixelSize',
      },
    });
  }

  // Format transactions sheet
  const txnSheet = doc.sheetsByTitle['עסקאות'];
  if (txnSheet) {
    const sheetId = txnSheet.sheetId;

    // Auto resize columns
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 11 },
      },
    });

    // Hide מזהה column (index 11)
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 11, endIndex: 12 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser',
      },
    });
  }

  // Auto resize summary sheet columns
  const summarySheet = doc.sheetsByTitle['סיכום חודשי'];
  if (summarySheet) {
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: summarySheet.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
      },
    });
  }

  // Auto resize categories sheet columns
  const catSheet = doc.sheetsByTitle['לפי קטגוריה'];
  if (catSheet) {
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId: catSheet.sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 5 },
      },
    });
  }

  // Apply main formatting
  if (requests.length > 0) {
    await doc.sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId: doc.spreadsheetId,
      requestBody: { requests },
    });
  }

  // Apply banding separately (may fail on repeat runs if already exists)
  if (txnSheet) {
    try {
      // First, check for existing banding and remove it
      const sheetMeta = await doc.sheetsApi.spreadsheets.get({
        spreadsheetId: doc.spreadsheetId,
        fields: 'sheets.bandedRanges',
      });

      const bandingRequests = [];
      const sheetData = sheetMeta.data.sheets.find(
        s => s.bandedRanges && s.bandedRanges.some(br =>
          br.range && br.range.sheetId === txnSheet.sheetId
        )
      );

      if (sheetData) {
        for (const br of sheetData.bandedRanges) {
          if (br.range.sheetId === txnSheet.sheetId) {
            bandingRequests.push({ deleteBanding: { bandedRangeId: br.bandedRangeId } });
          }
        }
      }

      // Add new banding
      bandingRequests.push({
        addBanding: {
          bandedRange: {
            range: {
              sheetId: txnSheet.sheetId,
              startRowIndex: 0,
              startColumnIndex: 0,
              endColumnIndex: 11,
            },
            rowProperties: {
              headerColor: COLORS.headerBg,
              firstBandColor: COLORS.white,
              secondBandColor: COLORS.altRowBg,
            },
          },
        },
      });

      await doc.sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId: doc.spreadsheetId,
        requestBody: { requests: bandingRequests },
      });
    } catch (e) {
      console.log('⚠️  Banding skipped:', e.message);
    }
  }
}

module.exports = { formatSheet };
