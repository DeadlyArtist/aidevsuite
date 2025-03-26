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

let defaultProxyAuthorizationHeader = "x-api-key";
function createProxy(proxyUrl, settings = null) {
    settings ??= {};
    settings.proxyAuthHeader ??= defaultProxyAuthorizationHeader;
    const { apiKey = null, request = {}, proxyAuthHeader, stream = null } = settings;
    stream ??= request.stream;

    return async function (targetUrl, proxyRequestOptions = {}) {
        const proxyRequestBody = {
            url: targetUrl,
            method: proxyRequestOptions.method || request.method || "GET",
            headers: {
                ...(request.headers || {}),
                ...(proxyRequestOptions.headers || {}),
            },
            body: proxyRequestOptions.body || request.body || null,
        };
        let streamOverride = proxyRequestOptions.stream ?? stream;
        if (streamOverride != null) proxyRequestBody.stream = streamOverride;

        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(proxyRequestBody),
        };

        if (apiKey != null) options.headers[proxyAuthHeader] = apiKey;

        const response = await fetch(proxyUrl, options);

        if (!response.ok) {
            throw new Error(`Proxy error: ${response.status} ${response.statusText}`);
        }

        // Detect if the response is a stream (e.g., "text/event-stream" or other types)
        const responseContentType = response.headers.get("Content-Type")?.toLowerCase() || "";

        // Skip parsing JSON if it's a stream; just return the raw response
        if (proxyRequestOptions.stream || responseContentType.includes("text/event-stream") || responseContentType.includes("application/octet-stream")) {
            return response; // Raw streaming response
        }

        // Parse the JSON response from the proxy
        const proxyResponse = await response.json();

        // Create and return a fake Response object using the `proxyResponse`
        const headers = new Headers(proxyResponse.headers);
        const { status, content } = proxyResponse;

        return new Response(content, {
            status: status,
            headers: headers
        });
    };
}

async function proxy(targetUrl, proxyUrl, settings = null) {
    return await createProxy(proxyUrl, settings)(targetUrl);
}

