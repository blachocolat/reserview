// Get method
// @returns {HtmlOutput}
function doGet(e) {
    var folder = _getFolderByName(EVENT_NAME);
    var spread = _getSpreadsheetByName(SPREADSHEET_NAME, folder);
    var reservSheet = spread.getSheetByName(RESERV_SHEET_NAME);
    var itemSheet = spread.getSheetByName(ITEM_SHEET_NAME);

    // If no reservation ID is specified, register a new reservation and redirect.
    var reservId = e.parameter.rid;
    if (!reservId) {
        var items = _parseItems(itemSheet, e.parameter);
        var purchId = _registerReservation(reservSheet, reservSheet.getLastRow() + 1, items);
        var redirectUrl = Utilities.formatString(
            '%s?rid=%s',
            ScriptApp.getService().getUrl().replace(/\?.*$/, ''),
            purchId
        );

        return HtmlService.createHtmlOutput(Utilities.formatString(
            '<script>window.open(\'%s\', \'_top\');</script>',
            redirectUrl
        ));
    }

    // Purchase items with the reservation ID
    var [reservIdCol, purchDateCol, customNameCol] =
        _getColumnsByNameOfSheet(['予約番号', '購入日時', 'お名前'], reservSheet);
    var values = reservSheet.getDataRange().getValues().slice(1);

    var itemNameCol = _getColumnByNameOfSheet('商品名', itemSheet);
    var itemNamesRange = itemSheet.getRange(2, itemNameCol, itemSheet.getLastRow() - 1);
    var itemNames = itemNamesRange.getValues().map(function (line) { return line[0]; });

    // Build HTML from template file
    var html = null;

    for (var row in values) {
        if (values[row][reservIdCol - 1] === reservId) {
            if (values[row][purchDateCol - 1] !== '') {
                // Already purchased
                html = HtmlService.createTemplateFromFile('templates/purchase_already');
                break;
            }

            var itemCounts = {};
            itemNames.some(function (itemName) {
                var itemCol = _getColumnByNameOfSheet(itemName, reservSheet);
                itemCounts[itemName] = values[row][itemCol - 1];
            });

            html = HtmlService.createTemplateFromFile('templates/purchase_success');
            html.customName = values[row][customNameCol - 1];
            html.items = _parseItems(itemSheet, itemCounts);

            // Update the purchased date
            var purchDate = Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm:SS');
            reservSheet.getRange(parseInt(row) + 2, purchDateCol).setValue(purchDate);

            break;
        }
    }

    if (!html) {
        html = HtmlService.createTemplateFromFile('templates/purchase_failure');
    }
    html.reservId = reservId;

    return html.evaluate();
}