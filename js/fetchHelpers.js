class FetchHelpers {
    static fetchCache = {};
    static fetchPromises = {};
    static fetchTextCache = {};
    static fetchTextPromises = {};
}

async function fetchText(url) {
    const response = await fetch(url);
    return await response.text();
}

async function fetchJson(url) {
    return JSON.parse(await fetchText(url));
}

async function fetchWithCache(url) {
    if (FetchHelpers.fetchCache[url]) return FetchHelpers.fetchCache[url];
    if (FetchHelpers.fetchPromises[url]) return await FetchHelpers.fetchPromises[url];

    const promise = fetch(url);
    FetchHelpers.fetchPromises[url] = promise;
    const result = await promise;
    FetchHelpers.fetchCache[url] = result;
    delete FetchHelpers.fetchPromises[url];
    return result;
}

async function fetchTextWithCache(url) {
    if (FetchHelpers.fetchTextCache[url]) return await FetchHelpers.fetchTextCache[url];
    if (FetchHelpers.fetchTextPromises[url]) return await FetchHelpers.fetchTextPromises[url];

    const promise = (async () => {
        const response = await fetch(url);
        const text = await response.text();
        return text;
    })();
    FetchHelpers.fetchTextPromises[url] = promise;
    const result = await promise;
    FetchHelpers.fetchTextCache[url] = result;
    delete FetchHelpers.fetchTextPromises[url];
    return result;
}

async function fetchJsonWithCache(url) {
    return JSON.parse(await fetchTextWithCache(url));
}