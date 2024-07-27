/**
 * Retrieves the value of the specified query parameter from the current URL.
 *
 * @param {string} param - The name of the parameter to retrieve.
 * @param {boolean} log - Whether to log the param.
 * @returns {string|null} - Returns the value of the parameter, or null if the parameter is not found.
 */
function getHashQueryVariable(param, log = false) {
    let hashSearchParams = getHashParams();

    let value = hashSearchParams.get(param);
    if (log) console.log(param, value);
    // Use the get method to retrieve the value of the parameter
    return value;
}

class URLHashParams {
    constructor(params) {
        this.params = new Map(params ? params.split('&').map(p => p.split('=').map(q => unescapeHashParameter(q))) : []);
    }

    get(key) {
        return this.params.get(key);
    }

    set(key, value) {
        return this.params.set(key, value);
    }

    delete(key) {
        return this.params.delete(key);
    }

    values() {
        return this.params.values();
    }

    keys() {
        return this.params.keys();
    }

    entries() {
        return this.params.entries();
    }

    toString() {
        return Array.from(this.params.entries())
            .map(([key, value]) => `${escapeHashParameter(key)}=${escapeHashParameter(value)}`)
            .join('&');
    }
}

function getHashParams() {
    let hashParts = window.location.hash.split("?");
    let hashSearchParams = new URLHashParams(hashParts.length === 1 ? '' : hashParts[1]);
    return hashSearchParams;
}

function getHash() {
    return window.location.hash;
}

function getHashUrl() {
    let hashParts = window.location.hash.split("?");
    return hashParts[0];
}

function getPathFromHash() {
    return removeFirstChar(getHashUrl());
}

function getPathPartFromHash(index) {
    const parts = getPathFromHash().split("/");
    return parts.length > index ? parts[index] : null;
}

function buildUrlWithNewHashParams(hashSearchParams) {
    let url = new URL(window.location);
    url.hash = '';
    let hashParts = window.location.hash.split("?");
    let baseHash = hashParts[0];
    let hashSearchParamsString = hashSearchParams.toString();
    let urlString = url.toString() + baseHash + (hashSearchParamsString === '' ? '' : ('?' + hashSearchParamsString));
    return urlString;
}

function getUrlWithChangedHashParam(name, value) {
    const hashParams = this.getHashParams();
    if (value == null || value == "") {
        hashParams.delete(name);
    } else {
        hashParams.set(name, value);
    }
    const url = this.buildUrlWithNewHashParams(hashParams);
    return url;
}

function escapeHashParameter(param) {
    return param.replace(/[#?&=%]/g, match => encodeURIComponent(match));
}

function unescapeHashParameter(param) {
    return decodeURIComponent(param);
}