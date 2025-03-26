function escapeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\. \-]/g, "_");
}

function escapeFileNameMinimal(name) {
    name = name.toLowerCase(); // Lowercase
    name = name.replace(/[^a-z0-9_]/g, '_'); // Replace non-alphanumeric characters with an underscore
    name = name.replace(/_+/g, '_'); // Replace multiple underscores with a single one
    name = name.replace(/_$/, ''); // Remove trailing underscore

    return name;
}

let commonMimeTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv",
    html: "text/html",
}

function downloadFile(name, contents, mime_type) {
    mime_type = mime_type || commonMimeTypes.plainText;

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
    const mime_type = commonMimeTypes.plainText;
    if (!name.endsWith(".txt") && addFileType) name += ".txt";
    downloadFile(name, contents, mime_type);
}

function downloadJson(name, contents, addFileType = true) {
    const mime_type = commonMimeTypes.json;
    if (!name.endsWith(".json") && addFileType) name += ".json";
    downloadFile(name, contents, mime_type);
}

function downloadCsv(name, contents, addFileType = true) {
    const mime_type = commonMimeTypes.csv;
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

async function getDataURL(file) {
    return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    })
}
