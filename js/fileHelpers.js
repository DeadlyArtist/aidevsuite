function escapeFileName(filename) {
    return filename.replace(/[^a-zA-Z0-9]/g, "_");
}

let commonFileTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv"
}

function downloadFile(name, contents, mime_type) {
    mime_type = mime_type || commonFileTypes.plainText;

    const blob = new Blob([contents], { type: mime_type });

    const linkElement = document.createElement('a');
    linkElement.download = name;
    linkElement.href = window.URL.createObjectURL(blob);
    linkElement.onclick = function (e) {
        // revokeObjectURL needs a delay to work properly
        setTimeout(function () {
            window.URL.revokeObjectURL(linkElement.href);
        }, 1500);
    };

    linkElement.click();
    linkElement.remove();
}

function downloadPlainText(name, contents, addFileType = true) {
    const mime_type = commonFileTypes.plainText;
    if (!name.endsWith(".txt") && addFileType) name += ".txt";
    downloadFile(name, contents, mime_type);
}

function downloadJson(name, contents, addFileType = true) {
    const mime_type = commonFileTypes.json;
    if (!name.endsWith(".json") && addFileType) name += ".json";
    downloadFile(name, contents, mime_type);
}

function downloadCsv(name, contents, addFileType = true) {
    const mime_type = commonFileTypes.csv;
    if (!name.endsWith(".csv") && addFileType) name += ".csv";
    downloadFile(name, contents, mime_type);
}

function downloadDataURL(dataURL, fileName) {
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function getFileNameFromUrl(url) {
    const nameWithExt = url.split('/')
        .pop()
        .split('#')[0]
        .split('?')[0];
    const dotSplit = nameWithExt.split(".");
    if (dotSplit.length > 1)
        dotSplit.length = dotSplit.length - 1;
    const fileName = dotSplit.join(".");
    return fileName;
}