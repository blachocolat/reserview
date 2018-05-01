function remindReservations() {
    const folder = _getFolderByName(EVENT_NAME);
    const spread = _getSpreadsheetByName(SPREADSHEET_NAME, folder);
    const reservSheet = spread.getSheetByName(RESERV_SHEET_NAME);
    const itemSheet = spread.getSheetByName(ITEM_SHEET_NAME);

    const [reservIdCol, purchDateCol, emailCol, customNameCol] =
        _getColumnsByNameOfSheet(['予約番号', '購入日時', 'メールアドレス', 'お名前'], reservSheet);
    const values = reservSheet.getDataRange().getValues().slice(1);

    const itemNameCol = _getColumnByNameOfSheet('商品名', itemSheet);
    const itemNamesRange = itemSheet.getRange(2, itemNameCol, itemSheet.getLastRow() - 1);
    const itemNames = itemNamesRange.getValues().map(function (line) { return line[0]; });

    for (var row in values) {
        // Skip purchased orders
        var purchDate = values[row][purchDateCol - 1];
        if (purchDate !== '') {
            continue;
        }

        // Skip orders have no e-mail address
        var email = values[row][emailCol - 1];
        if (email === '') {
            continue;
        }

        var reservId = values[row][reservIdCol - 1];
        var itemCounts = {};
        itemNames.some(function (itemName) {
            var itemCol = _getColumnByNameOfSheet(itemName, reservSheet);
            itemCounts[itemName] = values[row][itemCol - 1];
        });

        // Build HTML from template file
        var html = HtmlService.createTemplateFromFile('templates/email_remind');
        html.customName = values[row][customNameCol - 1];
        html.items = _parseItems(itemSheet, itemCounts);
        html.reservId = reservId;

        // Send e-mail to customers
        MailApp.sendEmail({
            to: email,
            name: PUBLISHER_SIGNATURE,
            subject: Utilities.formatString('【リマインド】%s', PUBLISHER_SIGNATURE),
            htmlBody: html.evaluate().getContent(),
            inlineImages: {
                qrCode: _makeQRCode(reservId)
            }
        });
    }
}