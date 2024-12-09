class Settings {
    static _initialSettings = JSON.parse(localStorage.getItem('settings')) || {};

    static _settingsHandler = {
        set(settings, property, value) {
            settings[property] = value;
            localStorage.setItem('settings', JSON.stringify(settings));
            window.settings = settings;
            return true;
        }
    };

    static element = null;
    static pagesElement = null;

    static chatbotPage = 'chatbot';

    static getChatbotPage() {
        const chatbotPage = fromHTML(`<div class="divList gap-2 hide">`);
        chatbotPage.setAttribute('settings-page', Settings.chatbotPage);

        const aiHeader = fromHTML(`<h3>AI`);
        chatbotPage.appendChild(aiHeader);

        const groqNote = fromHTML(`<div>`);
        renderMarkdown(groqNote, '_Note: Groq currently (23.07.2024) allows [creating API keys for free](https://console.groq.com/keys)._');
        chatbotPage.appendChild(groqNote);

        // Disable AI
        const disableAISetting = fromHTML(`<div tooltip="Disables all AI functionality." class="listHorizontal">`);
        const disableAILabel = fromHTML(`<div>Disable AI`);
        disableAISetting.appendChild(disableAILabel);
        const disableAIElement = fromHTML(`<input type="checkbox">`);
        disableAIElement.checked = settings.disableAI;
        disableAIElement.addEventListener('input', async e => {
            settings.disableAI = disableAIElement.checked;
            Flow.refreshMonacoContext();
            WorkerPage.workerEditor?.setValue(await Flow.getWorkerScript());
            if (settings.disableAI) Flow.promptEditorContainerElement?.classList.add('hide');
            else Flow.promptEditorContainerElement?.classList.remove('hide');
        });
        disableAISetting.appendChild(disableAIElement);
        chatbotPage.appendChild(disableAISetting);

        // OpenAI Api key
        const openAIApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const openAIApiKeyLabel = fromHTML(`<div>OpenAI Api Key`);
        openAIApiKeySetting.appendChild(openAIApiKeyLabel);
        const openAIApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        openAIApiKeyElement.value = settings.openAIApiKey ?? '';
        openAIApiKeyElement.addEventListener('input', e => {
            settings.openAIApiKey = openAIApiKeyElement.value;
            Settings.checkHasApiKey();
        });
        openAIApiKeySetting.appendChild(openAIApiKeyElement);
        chatbotPage.appendChild(openAIApiKeySetting);

        // Google Api key
        const googleApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const googleApiKeyLabel = fromHTML(`<div>Google Api Key`);
        googleApiKeySetting.appendChild(googleApiKeyLabel);
        const googleApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        googleApiKeyElement.value = settings.googleApiKey ?? '';
        googleApiKeyElement.addEventListener('input', e => {
            settings.googleApiKey = googleApiKeyElement.value;
            Settings.checkHasApiKey();
        });
        googleApiKeySetting.appendChild(googleApiKeyElement);
        chatbotPage.appendChild(googleApiKeySetting);

        // Groq Api key
        const groqApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const groqApiKeyLabel = fromHTML(`<div>Groq Api Key`);
        groqApiKeySetting.appendChild(groqApiKeyLabel);
        const groqApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        groqApiKeyElement.value = settings.groqApiKey ?? '';
        groqApiKeyElement.addEventListener('input', e => {
            settings.groqApiKey = groqApiKeyElement.value;
        });
        groqApiKeySetting.appendChild(groqApiKeyElement);
        chatbotPage.appendChild(groqApiKeySetting);

        // Anthropic Api key
        const anthropicApiKeySetting = fromHTML(`<div class="listHorizontal">`);
        const anthropicApiKeyLabel = fromHTML(`<div>Anthropic Api Key`);
        anthropicApiKeySetting.appendChild(anthropicApiKeyLabel);
        const anthropicApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        anthropicApiKeyElement.value = settings.anthropicApiKey;
        anthropicApiKeyElement.addEventListener('input', e => {
            settings.anthropicApiKey = anthropicApiKeyElement.value;
            Settings.checkHasApiKey();
        });
        anthropicApiKeySetting.appendChild(anthropicApiKeyElement);
        chatbotPage.appendChild(anthropicApiKeySetting);

        chatbotPage.appendChild(hb(2));
        const proxyHeader = fromHTML(`<h3>Proxy`);
        chatbotPage.appendChild(proxyHeader);

        // Proxy Api Url
        const proxyApiUrlSetting = fromHTML(`<div tooltip="Set this to allow scripts to use a proxy if needed." class="listHorizontal">`);
        const proxyApiUrlLabel = fromHTML(`<div>Proxy Api Url`);
        proxyApiUrlSetting.appendChild(proxyApiUrlLabel);
        const proxyApiUrlElement = fromHTML(`<input type="text" placeholder="Enter api url...">`);
        proxyApiUrlElement.value = settings.proxyApiUrl ?? '';
        proxyApiUrlElement.addEventListener('input', e => {
            settings.proxyApiUrl = proxyApiUrlElement.value;
        });
        proxyApiUrlSetting.appendChild(proxyApiUrlElement);
        chatbotPage.appendChild(proxyApiUrlSetting);

        // Proxy Auth Header
        const proxyApiHeaderSetting = fromHTML(`<div tooltip="Set this to allow scripts to use a proxy if needed." class="listHorizontal">`);
        const proxyApiHeaderLabel = fromHTML(`<div>Proxy Auth Header`);
        proxyApiHeaderSetting.appendChild(proxyApiHeaderLabel);
        const proxyApiHeaderElement = fromHTML(`<input type="text">`);
        proxyApiHeaderElement.setAttribute('placeholder', defaultProxyAuthorizationHeader);
        proxyApiHeaderElement.value = settings.proxyApiHeader ?? '';
        proxyApiHeaderElement.addEventListener('input', e => {
            settings.proxyApiHeader = proxyApiHeaderElement.value;
        });
        proxyApiHeaderSetting.appendChild(proxyApiHeaderElement);
        chatbotPage.appendChild(proxyApiHeaderSetting);

        // Proxy Api Key
        const proxyApiKeySetting = fromHTML(`<div tooltip="Set this if your proxy requires an api key (Proxy-Authorization header)." class="listHorizontal">`);
        const proxyApiKeyLabel = fromHTML(`<div>Proxy Api Key`);
        proxyApiKeySetting.appendChild(proxyApiKeyLabel);
        const proxyApiKeyElement = fromHTML(`<input type="password" placeholder="Enter api key...">`);
        proxyApiKeyElement.value = settings.proxyApiKey ?? '';
        proxyApiKeyElement.addEventListener('input', e => {
            settings.proxyApiKey = proxyApiKeyElement.value;
        });
        proxyApiKeySetting.appendChild(proxyApiKeyElement);
        chatbotPage.appendChild(proxyApiKeySetting);

        // Disable Proxy
        const disableScriptOverrideSetting = fromHTML(`<div tooltip="Denies the requests of scripts to use a proxy." class="listHorizontal">`);
        const disableScriptOverrideLabel = fromHTML(`<div>Disable Proxy`);
        disableScriptOverrideSetting.appendChild(disableScriptOverrideLabel);
        const disableScriptOverrideElement = fromHTML(`<input type="checkbox">`);
        disableScriptOverrideElement.checked = settings.disableScriptOverride;
        disableScriptOverrideElement.addEventListener('input', async e => {
            settings.disableScriptOverride = disableScriptOverrideElement.checked;
        });
        disableScriptOverrideSetting.appendChild(disableScriptOverrideElement);
        chatbotPage.appendChild(disableScriptOverrideSetting);

        return chatbotPage;
    }

    static changePage(page) {
        [...Settings.pagesElement.children].forEach(e => e.getAttribute('settings-page') == page ? e.classList.remove('hide') : e.classList.add('hide'));
        [...Settings.pageBar.children].forEach(e => e.getAttribute('settings-button') == page ? e.setAttribute('disabled', '') : e.removeAttribute('disabled'));
    }

    static async open(page = null) {
        page ??= Settings.chatbotPage;
        closeAllDialogs();

        let closeCallback;
        const promise = new Promise(resolve => {
            closeCallback = e => {
                Settings.close();
                resolve();
            }
        });

        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);

        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Settings`));
        const closeButton = fromHTML(`<button class="h-100 dialogCloseButton">`);
        closeButton.setAttribute('tooltip', 'Settings are saved automatically even before closing.');
        closeButton.appendChild(icons.close());
        closeButton.addEventListener('click', closeCallback);
        titleBar.appendChild(closeButton);
        element.appendChild(titleBar);
        element.appendChild(hb(2));

        // Page bar
        const pageBar = fromHTML(`<div class="listHorizontal hide">`);
        const chatbotPageButton = fromHTML(`<button class="largeElement complexButton raised" disabled>`);
        Settings.pageBar = pageBar;
        chatbotPageButton.setAttribute('settings-button', Settings.chatbotPage);
        chatbotPageButton.textContent = 'chatbot';
        pageBar.appendChild(chatbotPageButton);
        element.appendChild(pageBar);
        //element.appendChild(hb(6));
        const pagesElement = fromHTML(`<div>`);

        // Settings pages
        pagesElement.appendChild(Settings.getChatbotPage());

        element.appendChild(pagesElement);
        Settings.pagesElement = pagesElement;
        element.appendChild(hb(6));

        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        overlayElement.addEventListener('click', closeCallback);
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);

        Settings.element = dialogElement;

        Settings.changePage(page);

        return promise;
    }

    static close() {
        if (Settings.element) Settings.element.remove();
    }

    static hasProxy() {
        return !settings.disableScriptOverride && settings.proxyApiUrl;
    }
}

// Create a proxy for the settings object
const settings = new Proxy(Settings._initialSettings, Settings._settingsHandler);
window.settings = settings;