class UserProxy {
    static async fetch(isProxyRequested, targetUrl, request = null) {
        if (isProxyRequested && Settings.hasProxy()) {
            let proxySettings = {
                request,
            };
            let apiKey = settings.proxyApiKey;
            if (apiKey) {
                proxySettings.apiKey = apiKey;
            }
            let proxyUrl = settings.proxyApiUrl;
            if (!proxyUrl.startsWith('http://') && !proxyUrl.startsWith('https://')) {
                proxyUrl = 'https://' + proxyUrl;
            }
            let proxyApiHeader = settings.proxyApiHeader;
            if (proxyApiHeader) proxySettings.proxyAuthHeader = proxyApiHeader;
            return await proxy(targetUrl, proxyUrl, proxySettings);
        } else {
            return await fetch(targetUrl, request);
        }
    }

    static fetchProvider(isProxyRequested) {
        return (targetUrl, request) => this.fetch(isProxyRequested, targetUrl, request);
    }
}