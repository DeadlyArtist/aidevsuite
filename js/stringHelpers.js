function getIndexBeyond(searchTerm, text, startIndex = 0) {
    // Find the next occurrence of the search term starting from startIndex
    const nextIndex = text.indexOf(searchTerm, startIndex);

    // If the searchTerm is not found, return null
    if (nextIndex === -1) {
        return null;
    }

    // Return the index just after the found searchTerm
    const newIndex = nextIndex + searchTerm.length;


    // If the new index is out of bounds, return null
    if (newIndex === searchTerm.length) {
        return null;
    }

    return nextIndex;
}

const _htmlStringHelpers = {
    escapeHtmlChars: {
        '¢': 'cent',
        '£': 'pound',
        '¥': 'yen',
        '€': 'euro',
        '©': 'copy',
        '®': 'reg',
        '<': 'lt',
        '>': 'gt',
        '"': 'quot',
        '&': 'amp',
        '\'': '#39',
        ' ': 'nbsp',
    },
    getEscapeHtmlRegex() {
        let escapeHtmlRegexString = '[';
        for (let key in _htmlStringHelpers.escapeHtmlChars) {
            escapeHtmlRegexString += key;
        }
        escapeHtmlRegexString += ']';
        const regex = new RegExp(escapeHtmlRegexString, 'g');
        return regex;
    },
    htmlEntities: {
        nbsp: ' ',
        cent: '¢',
        pound: '£',
        yen: '¥',
        euro: '€',
        copy: '©',
        reg: '®',
        lt: '<',
        gt: '>',
        quot: '"',
        amp: '&',
        apos: '\'',
        nbsp: ' ',
    },
};
_htmlStringHelpers.escapeHtmlRegex = _htmlStringHelpers.getEscapeHtmlRegex();

function escapeHTML(str) {
    return str.replace(_htmlStringHelpers.escapeHtmlRegex, function (m) {
        return '&' + _htmlStringHelpers.escapeHtmlChars[m] + ';';
    });
}
function unescapeHTML(str) {
    return str.replace(/\\&([^;]+);/g, function (entity, entityCode) {
        let match;

        if (entityCode in _htmlStringHelpers.htmlEntities) {
            return _htmlStringHelpers.htmlEntities[entityCode];
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#x([\\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#(\\d+)$/)) {
            return String.fromCharCode(~~match[1]);
        } else {
            return entity;
        }
    });
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function unescapeRegex(string) {
    return string.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');  // $1 refers to the captured group
}

function escapeReplacement(string) {
    return string.replace(/\$/g, '$$$$');
}

function escapeCamelCase(name) {
    const parts = escapeFileName(name).replace('\.\-', ' ').replace('( )*', ' ').trim().split(' ');
    if (parts[0].length != 0) parts[0] = parts[0][0].toLowerCase() + parts[0].slice(1);
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].length != 0) parts[i] = parts[i][0].toUpperCase() + parts[i].slice(1);
    }
    return parts.join('');
}

function removeFirstChar(str) {
    return str.substring(1);
}
function removeLastChar(str) {
    return str.substring(0, str.length - 1);
}

function isString(str, orNull = false) {
    return (orNull && str == null) || typeof str === 'string' || str instanceof String;
}

function getStringByteSize(string) {
    string.length * 2;
}

function addIndent(string, spaces = 4) {
    return string.split('\n').map(l => ' '.repeat(spaces) + l).join('\n');
}

function replaceSubstring(original, start, end, placeholder) {
    return original.slice(0, start) + placeholder + original.slice(end == null ? end : end + 1);
}