// @param {String} folderName - The name of folder to search.
// @param {Folder} [parentFolder=DriveApp] - The folder object for searching.
// @returns {Folder} - The folder object.
function _getFolderByName(folderName, searchFolder) {
    var folders = (searchFolder || DriveApp).getFoldersByName(folderName);
    while (folders.hasNext()) {
        var folder = folders.next();
        if (folder.getName() == folderName) {
            return folder;
        }
    }
    return null;
}

// @param {String} fileName - The name of Spreadsheet file to search. 
// @param {Folder} [parentFolder=DriveApp] - The folder object for searching.
// @returns {Spreadsheet} - The Spreadsheet object.
function _getSpreadsheetByName(fileName, searchFolder) {
    var files = (searchFolder || DriveApp).getFilesByName(fileName);
    while (files.hasNext()) {
        var file = files.next();
        if (file.getMimeType().indexOf('spreadsheet') > 0) {
            return SpreadsheetApp.open(file);
        }
    }
    return null;
}

// @param {String[]} colNames - The array of column name to search.
// @param {Sheet} sheet - The sheet object for searching.
// @returns {Integer[]} - The column numbers (starting with 1).
function _getColumnsByNameOfSheet(colNames, sheet) {
    var values = sheet.getDataRange().getValues().slice(0, 1);
    if (!values || values.length === 0 || values[0].length === 0) {
        throw new InternalError('no column name is defined');
    }

    return colNames.map(function (colName) {
        var index = values[0].indexOf(colName);
        if (index < 0) {
            throw new RangeError(Utilities.formatString('column not found named: %s', colName));
        }

        return index + 1;
    });
}

// @param {String} colName - The name of column to search.
// @param {Sheet} sheet - The sheet object for searching.
// @returns {Integer} - The column number (starting with 1).
function _getColumnByNameOfSheet(colName, sheet) {
    return _getColumnsByNameOfSheet([colName], sheet)[0];
}

// @param {Any} value - The value to search.
// @param {Range} range - The range for searching.
// @returns {Boolean} - `value` is in `range` or not.
function _isUniqueInRange(value, range) {
    var values = range.getValues();
    for (var row in values) {
        for (var col in values[row]) {
            if (values[row][col] === value) {
                return false;
            }
        }
    }
    return true;
}

// @param {String} fileName - The name of HTML, CSS or JS file to import.
// @returns {String} - The content of `fileName`.
function _importHTML(fileName) {
    return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

// @params {String} longUrl - The URL you want to shorten.
// @returns {String} - The shortend URL.
function _shortenUrl(longUrl) {
    var payload = {
        longUrl: longUrl
    };

    var options = {
        contentType: 'application/json',
        method: 'post',
        payload: JSON.stringify(payload)
    };

    var fetchUrl = Utilities.formatString(
        'https://www.googleapis.com/urlshortener/v1/url?key=%s', 
        SHORTENER_API_KEY
    );
    var response = UrlFetchApp.fetch(fetchUrl, options);
    return JSON.parse(response).id;
}