function _tryRemoveIndexHtml() {
    let pathname = window.location.pathname;
    const search = window.location.search;
    const hash = window.location.hash;

    if (pathname.endsWith('index.html')) {
        pathname = pathname.substring(0, pathname.length - 'index.html'.length);
        const newUrl = `${pathname}${search}${hash}`;
        window.history.replaceState(null, "", newUrl);
    }
}

_tryRemoveIndexHtml();


pressedKeys = {};

function onKeyDown(event) {
    pressedKeys[event.key] = true;
}

function onKeyUp(event) {
    delete pressedKeys[event.key];
}

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateUniqueId() {
    return Date.now() + Math.random().toString(36).substring(2, 9) + Math.random().toString(36).substring(2, 9);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}


function isChildEvent(event) {
    return event.currentTarget.contains(event.fromElement) || event.currentTarget === event.fromElement;
}

function isChildLeaveEvent(event) {
    return event.currentTarget.contains(event.toElement) || event.currentTarget === event.toElement;
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function equalSets(set1, set2) {
    return set1.size === set2.size &&
        [...set1].every((x) => set2.has(x));
}


function between(x, min, max) {
    return x >= min && x <= max;
}

// Defaults to max length
function setCookie(name, value, days = null) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    } else {
        const daysToExpire = new Date(2147483647 * 1000).toUTCString();
        expires = "; expires=" + daysToExpire;
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function jsonEquals(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * @param {String} HTML representing a single element.
 * @param {Boolean} collapse representing whether or not to return only the element when only one element exists.
 * @param {Boolean} flag representing whether or not to trim input whitespace, defaults to true.
 * @return {Element | Node | HTMLCollection | null}
 */
function fromHTML(html, collapse = true, trim = true) {
    // Process the HTML string.
    html = trim ? html.trim() : html;
    if (!html) return null;

    // Then set up a new template element.
    const template = document.createElement('template');
    template.innerHTML = html;
    const result = template.content.childNodes;

    // Then return either an HTMLElement or HTMLCollection,
    // based on whether the input HTML had one or more roots.
    if (collapse && result.length === 1) return result[0];
    return result;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text);
}

function removeHash() {
    // Get the current URL without the hash
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + window.location.search;
    // Replace the current history state with the clean URL
    history.replaceState(null, "", cleanUrl);
}

function goToUrl(url) {
    window.location.href = url;
}

function spliceChildren(element, start = -1, deleteCount = 0, ...newChildren) {
    if (start < 0) start = element.children.length + 1 + start;

    const childElements = [...element.children];
    const removedChildren = childElements.splice(start, deleteCount, ...newChildren);
    removedChildren.forEach(child => child.remove());
    const isLast = element.children.length <= start;
    // Insert new children into the DOM
    newChildren.forEach((child, index) => {
        if (isLast) {
            element.appendChild(child);
        } else {
            element.insertBefore(child, element.children[start + index]);
        }
    });
}

function wrapElement(element, wrapper) {
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
}

(function () {
    const observer = new MutationObserver(() => {
        if (document.body) {
            observer.disconnect(); // Stop observing once the body is found

            // Dispatch custom body-created event
            const event = new CustomEvent('body-created');
            window.dispatchEvent(event);
        }
    });

    // Start observing the document element for added nodes (the body)
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

function onBodyCreated(callback) {
    if (document.body) {
        callback();
    } else {
        window.addEventListener('body-created', e => callback());
    }
}

const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

// Stop save events
document.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
    }
});

function intDivision(a, b) {
    return Math.floor(a / b);
}

function logStorageSizes() {
    let _lsTotal = 0, _xLen, _x;
    for (_x in localStorage) {
        if (!localStorage.hasOwnProperty(_x)) {
            continue;
        }
        _xLen = ((localStorage[_x].length + _x.length) * 2);
        _lsTotal += _xLen;
        console.log(_x.substr(0, 50) + " = " + (_xLen / 1024).toFixed(2) + " KB")
    }
    ; console.log("Total = " + (_lsTotal / 1024).toFixed(2) + " KB");
}

function replaceElementWithClone(element) {
    const clone = element.cloneNode(true);
    element.parentNode.replaceChild(clone, element);
    return clone;
}

function replaceTextNodeWithHTML(node, html) {
    if (node && node.nodeType === Node.TEXT_NODE) {
        // Create a temporary container for the new HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // Replace the text node with new HTML content
        while (tempDiv.firstChild) {
            node.parentNode.insertBefore(tempDiv.firstChild, node);
        }

        // Remove the original text node
        node.remove();
    }
}

function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}

function getUrlBase() {
    return window.location.href.split('?')[0].split('#')[0];
}

function createObjectUrl(object, options = undefined) {
    const blob = new Blob([object], options);
    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
}

/**
 * Executes async function on an iterator of items in parallel and returns their output in an array in the same order as the iterator.
 * */
async function parallel(iterator, asyncFunc) {
    const array = [...iterator];
    const results = new Array(array.length);
    const promises = [];
    const errors = [];
    array.forEach((item, index) => promises.push(asyncFunc(item, index).then(result => results[index] = result, error => errors.push(error))));

    await Promise.allSettled(promises);

    if (errors.length != 0) throw errors[0];
    return results;
}