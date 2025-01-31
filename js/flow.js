class Flow {
    static log = !!window.location.port;

    static runMode = 'run';
    static editMode = 'edit';
    static isRunning = false;
    static loadedExternPage = null;
    static onIframeEvent = new Map();

    static sampleClassLinks = ['data/Simple Chat.json'];
    static sampleClassPages = new Map();
    static baseWorkerScript = null;
    static workerScript = null;

    static progress = 0;
    static maxProgress = 1;
    static status = "Running...";
    static noOutputMessage = "No output yet...";
    static output = [];
    static elementById = new Map();
    static groupById = new Map();
    static clickEventById = new Map();

    static monacoContext = null;

    static async setupMonacoContext() {
        if (Flow.mode == Flow.runMode) {
            Flow.clearMonacoContext();
        } else {
            Flow.loadMonacoContext();
        }
    }

    static async loadMonacoContext() {
        if (Flow.monacoContext == null) {
            const script = await Flow.getWorkerScript();
            Flow.monacoContext = Monaco.addContext(script, 'javascript');
        }
    }

    static async clearMonacoContext() {
        if (Flow.monacoContext != null) {
            Monaco.clearContext();
            Flow.monacoContext = null;
        }
    }

    static async refreshMonacoContext() {
        Monaco.clearNonEditorContext();
        Flow.monacoContext = null;
        Flow.loadMonacoContext();
    }

    static onPageLoaded() {
        const name = getPathFromHash();
        if (!flowPages.has(name) && !localPages.has(getPathPartFromHash(1))) return;

        Flow.mode = getHashQueryVariable('mode') ?? Flow.editMode;
        const locked = getHashQueryVariable('locked') ?? false;

        Flow.setupMonacoContext();

        if (locked || isUser || Flow.mode == Flow.runMode || name == 'help') {
            Flow.run();
        }
    }

    static async setupMessageChannel(event) {
        if (event.data.source == 'origin') return;
        const data = event.data.message;

        if (event.data.source == 'worker') {
            Flow.onWorkerMessage(data);
        } else if (event.data.source == 'iframe') {
            if (Flow.log && !event.data.response) console.log('IFrame Message Received:', data ?? event);
            Flow.onIframeEvent.get(event.data.id)?.(event.data);
        }
    }

    static async setupIframe() {
        return new Promise((resolve, reject) => {
            Flow.iframe?.remove();

            const iframeContainer = document.getElementById("iframeContainer");

            // Create the iframe element
            const iframe = fromHTML(`<iframe id="sandbox" sandbox="allow-scripts" src="iframe.html" style="display:none;">`);

            Flow.iframe = iframe;

            // Resolve the promise when the iframe is loaded
            iframe.onload = () => {
                resolve(iframe);
            };

            // Reject the promise if there's an error loading the iframe
            iframe.onerror = () => {
                reject(new Error('Failed to load iframe'));
            };

            iframeContainer.appendChild(iframe);
        });
    }

    static postIframeRequest(content, id = null) {
        //const allowedOrigin = window.location.origin; // Doesn't work because iframe is sandboxed with different origin (null)
        //console.log('IFrame Message Posted:', content);
        Flow.iframe.contentWindow.postMessage({ message: content, id, source: 'origin' }, '*');
    }

    static requireIframeResponse(content) {
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();

            Flow.onIframeEvent.set(id, (event) => {
                Flow.onIframeEvent.delete(id);
                resolve(event.message);
            });


            Flow.postIframeRequest(content, id);
        });
    }

    static async setupFetchIframe() {
        return new Promise((resolve, reject) => {
            resolve();
            return;

            Flow.iframe?.remove();

            const iframeContainer = document.getElementById("fetchiframeContainer");

            // Create the iframe element
            const iframe = fromHTML(`<iframe id="sandbox" sandbox="allow-scripts" src="fetchiframe.html" style="display:none;">`);

            Flow.fetchiframe = iframe;

            // Resolve the promise when the iframe is loaded
            iframe.onload = () => {
                resolve(iframe);
            };

            // Reject the promise if there's an error loading the iframe
            iframe.onerror = () => {
                reject(new Error('Failed to load iframe'));
            };

            iframeContainer.appendChild(iframe);
        });
    }

    static sendIframedFetchRequest(url, options) {
        return new Promise((resolve, reject) => {
            const requestId = generateUniqueId();

            function handleIframeResponse(event) {
                if (event.origin !== Flow.fetchiframe.src) return;

                const { id, response, success, data } = event.data;
                if (response && id === requestId) {
                    window.removeEventListener("message", handleIframeResponse);
                    success ? resolve(data) : reject(new Error(data.error || "Unknown error occurred"));
                }
            }

            window.addEventListener("message", handleIframeResponse);

            iframe.contentWindow.postMessage({
                id: requestId,
                source: "origin",
                message: {
                    fetchRequest: { url, options }
                }
            }, iframe.src);
        });
    }

    static updateDefaultCode(code) {
        localStorage.setItem('lastCode', code);
    }

    static updateCode(code) {
        const name = getPathFromHash();
        if (name == 'local') {
            Flow.updateDefaultCode(code);
        } else if (name == 'extern') {
            return;
        } else {
            const page = localPages.get(getPathPartFromHash(1));
            page.code = code;
            updateLocalPage(page);
        }
    }

    static updateUrl(url) {
        localStorage.setItem('externUrl', url);
        const newUrl = getUrlWithChangedHashParam('url', url);
        history.replaceState(null, "", newUrl);
    }

    static getPage() {
        const name = getPathFromHash();
        if (name == 'local') {
            const item = {
                prompt: localStorage.getItem('lastPrompt'),
                code: localStorage.getItem('lastCode'),
            };
            return item;
        } else if (name == 'extern') {
            return (Flow.loadedExternPage?.url == getHashQueryVariable('url') && Flow.loadedExternPage?.url != null) ? Flow.loadedExternPage : { code: '' };
        } else if (name == 'help') {
            return (Flow.loadedHelpPage != null) ? Flow.loadedHelpPage : { code: '' };
        } else {
            return localPages.get(getPathPartFromHash(1));
        }
    }

    static getCode() {
        return Flow.getPage().code;
    }

    static async loadScript() {
        Flow.loadedExternPage = null;
        const url = getHashQueryVariable('url');
        Flow.setStatus('Loading external script...');

        Flow.externCodeEditorPromise?.then(e => {
            Flow.externContainerElement.classList.remove('hide');
            Flow.externTargetElement.updatePlaceholder('Loading...');
            Flow.externTargetElement.update();
            doScrollTick();
        });

        try {
            const promise = fetchExternalPage(url)
            Flow.loadScriptPromise = promise;
            const page = await promise;
            page.url = url;
            Flow.loadedExternPage = page;
            if (page.code.length == 0) Flow.externTargetElement?.updatePlaceholder('Loaded script seems to be empty...');
            else Flow.externTargetElement?.setValue(page.code);
            Flow.externTargetElement?.update();
            Flow.setStatus('Finished loading external script.');
        } catch (e) {
            console.log(e);
            Flow.externTargetElement?.updatePlaceholder('Failed loading external script.');
            Flow.externTargetElement?.update();
            Flow.setStatus('Error: Failed loading external script: ' + e.message, true);
        }
        doScrollTick();
    }

    static async loadHelp() {
        if (Flow.loadedHelpPage != null) return;

        const url = 'data/Help Chat.json';
        Flow.setStatus('Loading help chat...');
        try {
            const promise = fetchExternalPage(url)
            Flow.loadHelpPromise = promise;
            const page = await promise;
            page.url = url;
            Flow.loadedHelpPage = page;
            Flow.setStatus('Finished loading help chat.');
        } catch (e) {
            console.log(e);
            Flow.setStatus('Error: Failed loading help chat: ' + e.message, true);
        }
        doScrollTick();
    }

    static async wrapPageInStaticFunction(page) {
        return `static async ${escapeCamelCase(page.name)}() {\n${addIndent(page.code)}\n}`;
    }

    static onCodeInput(event) {
        let text = Flow.codeEditor.getValue();
        Flow.updateCode(text);
    }

    static updatePrompt(prompt) {
        const name = getPathFromHash();
        if (name == 'local') {
            localStorage.setItem('lastPrompt', prompt);
        } else if (name == 'extern') {
            return;
        } else {
            const page = localPages.get(getPathPartFromHash(1));
            page.prompt = prompt;
            updateLocalPage(page);
        }
    }

    static getPrompt() {
        return Flow.getPage().prompt;
    }

    static onPromptInput(event) {
        let text = Flow.promptEditor.getValue();
        Flow.updatePrompt(text);
    }

    static async run() {
        if (Flow.mode != Flow.runMode) {
            Flow.mode = Flow.runMode;
            if (getPathFromHash() != 'help') {
                goToUrl(getUrlWithChangedHashParam('mode', Flow.runMode));
                return;
            }
        }

        if (Flow.isRunning) {
            Flow.setStatus("Terminating previous session...");
            Flow.interruptRun();
        }

        Flow.setStatus("Booting up...");
        await Flow.setupFetchIframe();
        await Flow.setupIframe();

        Flow.executeCode();
    }

    static edit() {
        if (Flow.isRunning) {
            Flow.interruptRun();
        }

        goToUrl(getUrlWithChangedHashParam('mode', null));
    }

    static async generateScript(rewrite = false) {
        if (Flow.generating) return;
        Flow.generating = true;
        const needsApiKey = ChatApi.getApiKey() == null;
        if (needsApiKey) await Settings.open();
        if (ChatApi.getApiKey() == null) {
            Flow.setStatus('Required API key was missing.');
            return;
        }

        Flow.generateScriptButton.setAttribute('disabled', '');
        Flow.rewriteScriptButton.setAttribute('disabled', '');
        Flow.setStatus('Generating script...');
        Flow.setProgress(30);

        const page = Flow.getPage();
        const hasStorage = page.id != null;
        const storageAddendum = hasStorage ? '' : ' The storage is disabled for this script.';

        const systemPrompt = await Flow.getWorkerScript() + `\n\nThe user will ask you to write a script for a custom interactive tool that clearly communicates with the user.${storageAddendum} Your script will be evaluated in the eval part of onmessage on a worker. Above is the worker script that will eval your script. All code you write will be executed within an async function within eval. Write the whole script and only the script within a single code block (use \`\`\`code here\`\`\`), such that it can be easily parsed.`;
        const secondSystemPrompt = Flow.getCode() + `Above is the existing code written by the user that needs to be changed and adjusted according to the user's wishes.`;
        const prompt = Flow.getPrompt();
        const systemMessage = ChatApi.toSystemMessage(systemPrompt);
        const secondSystemMessage = ChatApi.toSystemMessage(secondSystemPrompt);
        const userMessage = ChatApi.toUserMessage(prompt);
        const context = rewrite ? [systemMessage, secondSystemMessage, userMessage] : [systemMessage, userMessage];

        Flow.streamTargetElement.textContent = "";
        Flow.codeEditorContainerElement.classList.add('hide');
        Flow.streamContainerElement.classList.remove('hide');
        doScrollTick();

        const result = await ChatApi.streamChat(context, t => {
            const code = ParsingHelpers.extractCode(t);
            Flow.streamTargetElement.textContent = code;
            highlightCode(Flow.streamTargetElement);
            doScrollTick();
        });
        const code = ParsingHelpers.extractCode(result);

        Flow.codeEditor.pushUndoStop();
        Flow.codeEditor.executeEdits('name-of-edit', [
            {
                range: Flow.codeEditor.getModel().getFullModelRange(), // full range
                text: code, // target value here
            },
        ]);
        Flow.codeEditor.pushUndoStop();
        doScrollTick();

        Flow.codeEditorContainerElement.classList.remove('hide');
        Flow.streamContainerElement.classList.add('hide');

        Flow.updateCode(code);

        Flow.setStatus('Finished');
        Flow.setProgress(100);
        Flow.generating = false;
        Flow.generateScriptButton.removeAttribute('disabled');
        Flow.rewriteScriptButton.removeAttribute('disabled');
    }

    static showProgress() {
        Flow.progressBar.classList.remove('hide');
    }

    static hideProgress() {
        Flow.progressBar.classList.add('hide');
    }

    static setProgress(value) {
        if (value == null) {
            Flow.hideProgress();
            return;
        }

        Flow.showProgress();
        Flow.progress = clamp(value, 0, 100);
        Flow.progressBar.value = Flow.progress;
    }

    static setStatus(message, error = false) {
        Flow.status = message;
        Flow.statusElement.textContent = Flow.status;
        if (error) Flow.statusElement.classList.add('danger-text');
        else Flow.statusElement.classList.remove('danger-text');
    }

    static interruptRun() {
        Flow.destroyWorker();
        Flow.clearOutput();
        Flow.dialogOutputContainer.classList.add('hide');
        Flow.isRunning = false;
    }

    static async executeCode() {
        Flow.isRunning = true;
        const name = getPathFromHash();

        Flow.setStatus("Running...");
        console.log(Flow.status);
        Flow.output = [];
        Flow.groupById.clear();
        Flow.elementById.clear();
        Flow.clickEventById.clear();

        await Flow.createWorker();
        let error = false;
        try {
            if (name == 'extern') {
                await Flow.loadScriptPromise;
            } else if (name == 'help') {
                await Flow.loadHelpPromise;
            }
            const code = Flow.getCode();
            await Flow.evalOnWorker(code);
        } catch (e) {
            error = e;
        }
        await Flow.destroyWorker();
        Flow.hideProgress();

        if (error) {
            let errorMessage = "Script Error: " + error;
            if (error.message == 'api_key_missing') errorMessage = "Error: Required API key was missing."
            Flow.setStatus(errorMessage, true);
        } else Flow.setStatus("Finished");
        console.log(Flow.status);

        Flow.isRunning = false;
    }

    static async destroyWorker() {
        await Flow.requireIframeResponse({ command: 'terminateWorker' });
    }

    static async createWorker() {
        await Flow.requireIframeResponse({ loadWorker: await Flow.getWorkerScript() });
    }

    static async getWorkerScript(forceRefresh = false) {
        if (Flow.workerScript == null || forceRefresh) {
            Flow.baseWorkerScript = await fetchText('js/worker.js');
            Flow.workerAIPartScript = await fetchText('js/workerAIPart.js');
            for (let link of Flow.sampleClassLinks) {
                const page = await fetchExternalPage(link);
                Flow.sampleClassPages.set(link, page);
            }
        }

        Flow.workerScript = Flow.baseWorkerScript;
        if (!settings.disableAI) Flow.workerScript += '\n\n' + Flow.workerAIPartScript;

        let samplePages = [...Flow.sampleClassPages.entries()];
        if (settings.disableAI) samplePages = samplePages.filter(s => !s[0].endsWith('data/Chat.json'));
        samplePages = samplePages.map(s => s[1]);
        if (samplePages.length != 0) {
            let classScript = '\n\nclass Samples {\n';
            for (let page of samplePages) {
                let pageFunction = await Flow.wrapPageInStaticFunction(page);
                classScript += addIndent(pageFunction);
            }
            classScript += '\n}';
            Flow.workerScript += classScript;
        }

        return Flow.workerScript;
    }

    static onEvent = new Map();
    static onPingEvent = new Map();

    // Event status types
    static successStatus = 'successStatus';
    static errorStatus = 'errorStatus';

    // Event types
    static logEventType = "logEventType";
    static evalEventType = "evalEventType";
    static loadEventType = "loadEventType";
    static showEventType = "showEventType";
    static readEventType = "readEventType";
    static updateEventType = "updateEventType";
    static removeEventType = "removeEventType";
    static acceptEventType = "acceptEventType";
    static validateInputEventType = "validateInputEventType";
    static delayedValidateInputEventType = "delayedValidateInputEventType";
    static noAcceptShownEventType = "noAcceptShownEventType";
    static clickEventType = "clickEventType";
    static chatEventType = "chatEventType";
    static chatStreamEventType = "chatStreamEventType";
    static fileDownloadEventType = "fileDownloadEventType";
    static dataURLDownloadEventType = "dataURLDownloadEventType";
    static setProgressEventType = "setProgressEventType";
    static setStatusEventType = "setStatusEventType";
    static storageEventType = "storageEventType";
    static urlEventType = "urlEventType";
    static fetchInternalEventType = "fetchInternalEventType";
    static proxyEventType = "proxyEventType";
    static requireEventType = "requireEventType";

    // Element types
    static breakType = "breakType";
    static rulerType = "rulerType";
    static emptyType = "emptyType";
    static codeType = "codeType";
    static markdownType = "markdownType"; // Includes Katex math parser.
    static paragraphType = "paragraphType";
    static titleType = "titleType";
    static subTitleType = "subTitleType";
    static infoType = "infoType";
    static htmlType = "htmlType";
    static imageType = "imageType";
    static iconType = "iconType";

    // Icon types
    static materialIconProvider = "materialIconProvider";
    static heroIconProvider = "heroIconProvider";

    // Container element types
    static barType = "barType";
    static verticalType = "verticalType";
    static buttonType = "buttonType";

    // Bar sub types
    static navBarType = "navBarType";
    static listBarType = "listBarType";

    // Button sub types
    static simpleButtonType = "simpleButtonType";
    static complexButtonType = "complexButtonType";

    // Input element types
    static textInputType = "textInputType";
    static numberInputType = "numberInputType";
    static passwordInputType = "passwordInputType";
    static codeInputType = "codeInputType";
    static markdownInputType = "markdownInputType";
    static checkboxInputType = "checkboxInputType";
    static selectInputType = "selectInputType";
    static imageInputType = "imageInputType";
    static pasteInputType = "pasteInputType";
    static fileInputType = "fileInputType";

    // Element type sets
    static allTypes = new Set([
        Flow.breakType,
        Flow.rulerType,
        Flow.emptyType,
        Flow.markdownType,
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
        Flow.infoType,
        Flow.codeType,
        Flow.imageType,
        Flow.iconType,
        Flow.barType,
        Flow.verticalType,
        Flow.buttonType,
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.markdownInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.imageInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);

    static containerTypes = new Set([
        Flow.barType,
        Flow.verticalType,
        Flow.buttonType,
    ]);

    static textTypes = new Set([
        Flow.paragraphType,
        Flow.titleType,
        Flow.subTitleType,
        Flow.infoType,
    ]);

    static inputTypes = new Set([
        Flow.textInputType,
        Flow.numberInputType,
        Flow.passwordInputType,
        Flow.codeInputType,
        Flow.markdownInputType,
        Flow.checkboxInputType,
        Flow.selectInputType,
        Flow.imageInputType,
        Flow.pasteInputType,
        Flow.fileInputType,
    ]);


    // Paste item types
    static htmlPasteItemType = "html";
    static textPasteItemType = "text";
    static rtfPasteItemType = "rtf";
    static filesPasteItemType = "files";

    // Group locations
    static mainLocation = "main";
    static stickyLocation = "sticky";
    static dialogLocation = "dialog";

    // Event logic to communicate with worker
    static _postMessage(message) {
        Flow.postIframeRequest({ workerCommand: message });
    }

    static postRequest(type, content, id = null, pingId = null, pingSourceEvent = null) {
        Flow._postMessage({ id, pingId, pingSourceId: pingSourceEvent?.pingId, type, content });
    }

    static postSuccessResponse(requestEvent, content = null, message = null) {
        Flow._postMessage({
            id: requestEvent.id,
            type: requestEvent.type,
            response: true,
            status: Flow.successStatus,
            content,
            message
        });
    }

    static postErrorResponse(requestEvent, message, content = null) {
        Flow._postMessage({
            id: requestEvent.id,
            type: requestEvent.type,
            response: true,
            status: Flow.errorStatus,
            content,
            message
        });
    }

    static requireResponse(type, content, onPing = null, pingSourceEvent = null) {
        return new Promise((resolve, reject) => {
            const id = generateUniqueId();
            let pingId = null;
            if (onPing != null) {
                pingId = generateUniqueId();
                Flow.onPingEvent.set(pingId, async (event) => {
                    try {
                        const result = await onPing(event.content, event);
                        Flow.postSuccessResponse(event, result);
                    } catch (e) {
                        Flow.postErrorResponse(event, "Executing request produced an error.");
                    }
                });
            }

            Flow.onEvent.set(id, (event) => {
                Flow.onEvent.delete(id);
                if (pingId != null) Flow.onPingEvent.delete(pingId);
                if (event.status === Flow.errorStatus) reject(event.message);
                else resolve(event.content);
            });


            Flow.postRequest(type, content, id, pingId, pingSourceEvent);
        });
    }

    static onWorkerMessage(event) {
        const e = event;
        const type = e.type;
        if (Flow.log && type !== Flow.logEventType) console.log("Worker Message Received:", event);

        try {
            if (Flow.onEvent.has(e.id)) {
                Flow.onEvent.get(e.id)(e);
            } else if (Flow.onPingEvent.has(e.pingSourceId)) {
                Flow.onPingEvent.get(e.pingSourceId)(e);
            } else if (type === Flow.logEventType) {
                Flow.onLogRequest(e);
            } else if (type === Flow.loadEventType) {
                Flow.onLoadRequest(e);
            } else if (type === Flow.showEventType) {
                Flow.onShowRequest(e);
            } else if (type === Flow.readEventType) {
                Flow.onRead(e);
            } else if (type === Flow.updateEventType) {
                Flow.onUpdate(e);
            } else if (type === Flow.removeEventType) {
                Flow.onRemove(e);
            } else if (type === Flow.acceptEventType) {
                Flow.onAcceptRequest(e);
            } else if (type === Flow.clickEventType) {
                Flow.onClick(e);
            } else if (type === Flow.chatEventType) {
                Flow.onChat(e);
            } else if (type === Flow.fileDownloadEventType) {
                Flow.onFileDownloadRequest(e);
            } else if (type === Flow.dataURLDownloadEventType) {
                Flow.onDataURLDownloadRequest(e);
            } else if (type === Flow.setProgressEventType) {
                Flow.onSetProgressRequest(e);
            } else if (type === Flow.setStatusEventType) {
                Flow.onSetStatusRequest(e);
            } else if (type === Flow.storageEventType) {
                Flow.onStorageRequest(e);
            } else if (type === Flow.urlEventType) {
                Flow.onUrlRequest(e);
            } else if (type === Flow.fetchInternalEventType) {
                Flow.onFetchInternalRequest(e);
            } else if (type === Flow.proxyEventType) {
                Flow.onProxy(e);
            } else if (type === Flow.requireEventType) {
                Flow.onRequire(e);
            }
        } catch (error) {
            console.error("Error while executing worker request:", error.stack);
            Flow.postErrorResponse(e, "Error while executing worker request.");
        }
    }

    static onLogRequest(event) {
        const e = event;
        if (e.content == null) {
            console.log("Worker Log:", e.content);
        } else {
            const contentArray = JSON.parse(e.content);

            if (Array.isArray(contentArray)) {
                if (Flow.log || contentArray.length == 0 || contentArray[0] != "Origin Message Received:") console.log("Worker Log:", ...contentArray);
            } else {
                console.log("Worker Log:", contentArray);
            }
        }
        Flow.postSuccessResponse(e);
    }

    static async evalOnWorker(code) {
        return await Flow.requireResponse(Flow.evalEventType, { code });
    }

    static async onLoadRequest(event) {
        const url = event.content;
        try {
            const page = await fetchExternalPage(url);
            Flow.postSuccessResponse(event, page.code);
        } catch (e) {
            Flow.postErrorResponse(event, "Failed to fetch.");
        }
    }

    static async onStorageRequest(event) {
        const e = event;
        const content = event.content;
        const page = Flow.getPage();
        const id = page.id;
        let exists = false;
        if (id) exists = true;

        if (content.exists) Flow.postSuccessResponse(e, exists);

        if (!exists) {
            Flow.postErrorResponse('script does not qualify for storage, as it is not a local script.');
            return;
        }

        if (content.set != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage')) ?? {};
            scriptStorage[id] ??= {};
            scriptStorage[id][content.set.key] = content.set.value;
            const jsonStorage = JSON.stringify(scriptStorage);
            const targetSize = getStringByteSize(JSON.stringify(scriptStorage[id]));
            const totalSize = getStringByteSize(jsonStorage);
            if (totalSize > megabyte * 3 || targetSize > kilobyte * 100) {
                Flow.postErrorResponse(e, new Error("Not enough storage."));
            } else {
                localStorage.setItem('scriptStorage', jsonStorage);
                Flow.postSuccessResponse(e);
            }
        } else if (content.get != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage')) ?? {};
            scriptStorage[id] ??= {};
            const value = scriptStorage[id][content.get];
            Flow.postSuccessResponse(e, value);
        } else if (content.delete != null) {
            const scriptStorage = JSON.parse(localStorage.getItem('scriptStorage')) ?? {};
            scriptStorage[id] ??= {};
            delete scriptStorage[id][content.delete];
            localStorage.setItem('scriptStorage', JSON.stringify(scriptStorage));
            Flow.postSuccessResponse(e);
        }
    }

    static async onUrlRequest(event) {
        const e = event;
        Flow.postSuccessResponse(e, { base: getUrlBase() });
    }

    static async onFetchInternalRequest(event) {
        const e = event;
        const excludedFolders = ['safe', 'private'];

        const path = e.content.path;
        const parts = path.split('?')[0].split('#')[0].split('/');
        parts.pop();
        let url = getUrlBase().split('/');
        url.pop();
        url = url.join('/') + '/' + path;

        if (parts.some(p => excludedFolders.includes(p))) {
            Flow.postErrorResponse(e, "request_denied");
        } else {
            Flow.postSuccessResponse(e, await fetchText(url));
        }
    }

    static async onProxy(event) {
        const e = event;
        const content = e.content;

        if (content.get == 'has') {
            let has = Settings.hasProxy();
            Flow.postSuccessResponse(e, has);
            return;
        } else if (content.get === 'fetch') {
            // Security risk, as malicious scripts can easily find out proxy data, including your api key.
        }

        return;
    }

    static async onRequire(event) {
        const e = event;
        const content = e.content;
        let error = null;
        if (content.apiKeyFor !== undefined) {
            let hasApiKey = ChatApi.getApiKey(content.apiKeyFor);
            if (!hasApiKey) {
                await Settings.open();
                hasApiKey = ChatApi.getApiKey(content.apiKeyFor);
                if (!hasApiKey) {
                    error = 'api_key_missing';
                }
            }
        } else if (content.proxy !== undefined) {
            let hasProxy = Settings.hasProxy();
            if (!hasProxy) {
                await Settings.open();
                hasProxy = Settings.hasProxy();
                if (!hasProxy) {
                    error = 'proxy_missing';
                }
            }
        }

        if (error) Flow.postErrorResponse(e, error);
        else Flow.postSuccessResponse(e);
        return;
    }

    // Validation
    static async requestValidation(settings, delayed = false) {
        if ((delayed && !settings.hasDelayedValidation) || (!delayed && !settings.hasValidation)) return;

        const inputValues = Flow.output.map(group => Flow.extractInputValues(group)).flat();
        const inputs = Flow.extractInputElements(settings.group);
        const targetInputValue = inputValues.find(v => v.id == settings.id);

        const response = await Flow.requireResponse(
            delayed ? Flow.delayedValidateInputEventType : Flow.validateInputEventType,
            { allInputs: inputValues, input: targetInputValue },
            null,
            settings.group.event
        );
        const valid = response?.valid ?? true;

        settings.isInvalid = !valid;
        if (valid) {
            settings.validationContainer.classList.add('hide');
        } else {
            settings.validationMessageElement.textContent = response?.message ?? 'Invalid value. Please choose a different value.';
            settings.validationContainer.classList.remove('hide');
        }

        settings.group.isInvalid = inputs.some(s => s.isInvalid);

        if (settings.group.isInvalid) {
            settings.group.validationContainer.classList.remove('hide');
            settings.group.acceptButtonElement.setAttribute('disabled', '');
        } else {
            settings.group.validationContainer.classList.add('hide');
            settings.group.acceptButtonElement.removeAttribute('disabled');
        }

        doScrollTick();
    }

    static async requestDelayedValidation(settings) {
        await Flow.requestValidation(settings, true);
    }

    // Element of group
    static extractSettingsFromElement(element, groupSettings) {
        const type = element.type;
        const options = element.options ?? {};

        const settings = { type, id: element.id, group: groupSettings, children: [] };
        if (options.leftElements) {
            settings.leftChildren = options.leftElements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.leftChildren);
            settings.leftChildren.forEach(s => s.parent = settings);
        }
        if (options.rightElements) {
            settings.rightChildren = options.rightElements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.rightChildren);
            settings.rightChildren.forEach(s => s.parent = settings);
        }
        settings.hide = options.hide ?? false;
        settings.disabled = options.disabled ?? false;
        settings.stretch = options.stretch ?? false;
        settings.bordered = options.bordered ?? false;
        settings.breakBefore = clamp(options.breakBefore ?? 0, 0, 8);
        settings.breakAfter = clamp(options.breakAfter ?? 0, 0, 8);
        Flow.elementById.set(settings.id, settings);

        if (Flow.textTypes.has(type)) {
            settings.text = element.text ?? '';
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
            settings.placeholder = options.placeholder;
            settings.maxHeight = clamp(options.maxHeight ?? 0, 0, 8);
            if (type == Flow.infoType) {
                settings.mode = options.mode;
            }
        } else if (type === Flow.emptyType) {
            // Do nothing
        } else if (type === Flow.breakType) {
            settings.size = clamp(element.size ?? 4, 0, 8);
        } else if (type === Flow.rulerType) {
            settings.vertical = options.vertical;
        } else if (type === Flow.codeType) {
            settings.code = element.code ?? '';
            settings.language = options.language;
            settings.placeholder = options.placeholder;
            settings.maxHeight = clamp(options.maxHeight ?? 0, 0, 8);
        } else if (type === Flow.markdownType) {
            settings.markdown = element.markdown ?? '';
            settings.katex = options.katex ?? true;
            settings.katexDelimiters = options.katexDelimiters;
            settings.noHighlight = options.noHighlight;
            settings.placeholder = options.placeholder;
            settings.maxHeight = clamp(options.maxHeight ?? 0, 0, 8);
        } else if (type === Flow.htmlType) {
            settings.html = element.html ?? '';
            settings.allowScripts = options.allowScripts ?? true;
            settings.placeholder = options.placeholder;
            settings.maxHeight = clamp(options.maxHeight ?? 6, 0, 8);
        } else if (type === Flow.imageType) {
            settings.url = element.url ?? '';
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
            settings.imageMaxHeight = clamp(options.imageMaxHeight ?? 0, 0, 8);
            settings.captionMaxHeight = clamp(options.captionMaxHeight ?? 0, 0, 8);
        } else if (type === Flow.iconType) {
            settings.ds = element.ds ?? '';
            settings.iconProvider = element.iconProvider;
            settings.caption = options.caption;
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
        } else if (Flow.containerTypes.has(type)) {
            settings.mainChildren = element.elements.map(e => Flow.extractSettingsFromElement(e, groupSettings));
            settings.children = settings.children.concat(settings.mainChildren);
            settings.children.forEach(s => s.parent = settings);
            settings.title = options.title;
            settings.useTooltipInstead = options.useTooltipInstead ?? true;
            settings.gap = clamp(options.gap ?? 2, 0, 8);

            if (type === Flow.barType) {
                settings.barSubType = options.barSubType ?? Flow.navBarType;
                settings.centered = options.centered ?? false;
            } else if (type === Flow.verticalType) {
                settings.centered = options.centered ?? false;
            } else if (type === Flow.buttonType) {
                settings.buttonSubType = options.buttonSubType ?? Flow.complexButtonType;
                settings.fullWidth = options.fullWidth ?? false;
                settings.closeDialogOnClick = options.closeDialogOnClick;
            }
        } else if (Flow.inputTypes.has(type)) {
            settings.hasValidation = element.hasValidation ?? false;
            settings.hasDelayedValidation = element.hasDelayedValidation ?? false;
            settings.isInvalid = false;
            settings.validationMessage = null;

            if (type === Flow.textInputType) {
                settings.text = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter text here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.maxHeight = clamp(options.maxHeight ?? 6, 0, 8);
                settings.minimal = options.minimal ?? false;
            } else if (type === Flow.numberInputType) {
                settings.number = options.defaultValue ?? 0;
            } else if (type === Flow.passwordInputType) {
                settings.password = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter password here...';
            } else if (type === Flow.codeInputType) {
                settings.code = options.defaultValue ?? '';
                settings.language = options.language;
                settings.context = options.context;
                settings.placeholder = options.placeholder ?? 'Enter code here...';
                settings.maxHeight = clamp(options.maxHeight ?? 6, 0, 8);
            } else if (type === Flow.markdownInputType) {
                settings.markdown = options.defaultValue ?? '';
                settings.placeholder = options.placeholder ?? 'Enter markdown here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.katex = options.katex ?? true;
                settings.katexDelimiters = options.katexDelimiters;
                settings.noHighlight = options.noHighlight;
                settings.maxHeight = clamp(options.maxHeight ?? 6, 0, 8);
            } else if (type === Flow.checkboxInputType) {
                settings.checked = options.defaultValue ?? false;
                settings.description = options.description ?? '';
            } else if (type === Flow.selectInputType) {
                options.choices.forEach((c, index) => {
                    c.value ??= index;
                    c.name ??= c.value;
                });
                settings.value = options.defaultValue ?? options.choices[0].value;
                settings.choices = options.choices;
            } else if (type === Flow.imageInputType) {
                settings.url = options.defaultValue ?? '';
                settings.caption = options.caption ?? '';
                settings.editableCaption = options.editableCaption ?? false;
                settings.placeholder = options.placeholder ?? 'Enter url here...';
                settings.captionPlaceholder = options.captionPlaceholder ?? 'Enter caption here...';
                settings.spellcheck = options.spellcheck ?? false;
                settings.maxHeight = clamp(options.maxHeight ?? 6, 0, 8);
                settings.imageMaxHeight = clamp(options.imageMaxHeight ?? 0, 0, 8);
                settings.captionMaxHeight = clamp(options.captionMaxHeight ?? 6, 0, 8);
            } else if (type === Flow.fileInputType) {
                settings.files = [];
                settings.allowedMimeTypes = options.allowedMimeTypes ?? [];
                settings.allowedExtensions = options.allowedExtensions ?? [];
                settings.dropDescription = options.dropDescription ?? ("Drag and drop valid files (" + (settings.allowedMimeTypes.length === 0 ? "any type" : settings.allowedMimeTypes.join(', ')) + ").");
                settings.selectDescription = options.selectDescription ?? 'Or select files';
                settings.noFileSelectedMessage = options.noFileSelectedMessage ?? 'No file selected.';
                settings.multiple = options.multiple ?? false;
                settings.maxSize = options.maxSize;
            } else if (type === Flow.pasteInputType) {
                settings.html = "";
                settings.text = "";
                settings.rtf = "";
                settings.files = [];
                settings.emptyDescription = options.emptyDescription ?? "Paste (STRG + V) into here to continue.";
                settings.replaceDescription = options.replaceDescription ?? "Successfully pasted. Paste (STRG + V) into here to change its content.";
            }
        }

        return settings;
    }

    static extractSettingsFromGroup(group) {
        const options = group.options;
        const element = group.element;
        const settings = {};
        settings.id = element.id;
        Flow.groupById.set(settings.id, settings);
        settings.element = Flow.extractSettingsFromElement(element, settings);
        settings.acceptButtonContent = options.acceptButtonContent == null ? null : Flow.extractSettingsFromElement(options.acceptButtonContent, settings);
        settings.noAccept = options.noAccept ?? false;
        settings.accepted = false;
        settings.location = options.location ?? Flow.mainLocation;
        const inputs = Flow.extractInputElements(settings);
        settings.isInvalid = inputs.some(s => s.isInvalid);
        settings.noCloseOnOverlay = options.noCloseOnOverlay ?? false;
        return settings;
    }

    static tryAddTitle(element, settings) {
        if (settings.title) {
            if (settings.useTooltipInstead) element.setAttribute('tooltip', escapeHTML(settings.title));
            else element.setAttribute('title', settings.title);
        }
        return element;
    }

    static processInput(element, settings, settingsProperty, elementProperty = 'value') {
        settings[settingsProperty] = element[elementProperty];
        doScrollTick();

        // Validation
        Flow.requestValidation(settings);
    }

    static processContentEditableInput(element, settings, settingsProperty) {
        let text = element.innerText;
        if (ContentEditableHelpers.textNeedsFixing(text)) element.textContent = text = ContentEditableHelpers.fixText(text);
        Flow.processInput(element, settings, settingsProperty, 'innerText');
    }

    static processMonacoInput(settings, settingsProperty) {
        settings[settingsProperty] = settings[settingsProperty + "Editor"].getValue();
        doScrollTick();
        Flow.requestValidation(settings);
    }

    static removeFile(index, settings) {
        settings.files.splice(index, 1);
        spliceChildren(settings.filesDisplayElement, index, 1);

        if (settings.files.length == 0) {
            const noFileSelectedElement = fromHTML(`<i>`);
            noFileSelectedElement.textContent = settings.noFileSelectedMessage;
            settings.filesDisplayElement.appendChild(noFileSelectedElement);
        }
    }

    static async extractFileData(file) {
        const fileData = {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            lastModifiedDate: file.lastModifiedDate,
            text: await file.text(),
            dataURL: await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(file);
            })
        };

        return fileData;
    }

    static async addFiles(files, settings) {
        if (settings.files.length == 0 && files.length != 0) {
            settings.filesDisplayElement.innerHTML = '';
        }

        for (let [index, file] of Object.entries(files)) {
            const fileData = await Flow.extractFileData(file);
            settings.files.push(fileData);
            const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
            const fileNameElement = fromHTML(`<div>`);
            fileNameElement.textContent = fileData.name;
            fileDisplayElement.appendChild(fileNameElement);
            const fileDeleteElement = fromHTML(`<button>`);
            fileDeleteElement.textContent = "X";
            fileDeleteElement.addEventListener('click', e => Flow.removeFile(index, settings));
            fileDisplayElement.appendChild(fileDeleteElement);
            settings.filesDisplayElement.appendChild(fileDisplayElement);
        }
    }

    static async processFileInput(event, settings) {
        const e = event;
        let files = getFilesFromEvent(e);
        console.log("Files Input:", files.map(f => f.name));
        await Flow.addFiles(files, settings);
        doScrollTick();

        // Validation
        Flow.requestValidation(settings);
    }

    static updatePaste(settings, newSettings) {
        const html = newSettings.html;
        const text = newSettings.text;
        const rtf = newSettings.rtf;
        const files = newSettings.files;

        if (newSettings.hasOwnPropertyType('html')) settings.html = html;
        if (newSettings.hasOwnPropertyType('text')) settings.text = text;
        if (newSettings.hasOwnPropertyType('rtf')) settings.rtf = rtf;
        if (newSettings.hasOwnPropertyType('files')) settings.files = files;

        if (settings.html) {
            settings.htmlDisplayElement.innerHTML = '';
            const titleElement = fromHTML(`<h2>`);
            titleElement.textContent = "Pasted Html";
            settings.htmlDisplayElement.appendChild(titleElement);
            const htmlContainer = fromHTML(`<div>`);
            htmlContainer.textContent = settings.html;
            settings.htmlDisplayElement.appendChild(htmlContainer);
            settings.htmlDisplayElement.classList.remove('hide');
        } else settings.htmlDisplayElement.classList.add('hide');

        if (settings.files.length != 0) {
            settings.filesDisplayElement.innerHTML = '';
            const titleElement = fromHTML(`<h2>`);
            titleElement.textContent = "Pasted Files";
            settings.filesDisplayElement.appendChild(titleElement);
            const filesContainer = fromHTML(`<div>`);
            for (let file of files) {
                const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
                const fileNameElement = fromHTML(`<div>`);
                fileNameElement.textContent = file.name;
                fileDisplayElement.appendChild(fileNameElement);
                filesContainer.appendChild(fileDisplayElement);
            }
            settings.filesDisplayElement.appendChild(filesContainer);
            settings.filesDisplayElement.classList.remove('hide');
        } else settings.filesDisplayElement.classList.add('hide');

        doScrollTick();

        // Validation
        Flow.requestValidation(settings);
    }

    static async processPaste(event, settings) {
        event.preventDefault();

        settings.descriptionElement.textContent = settings.replaceDescription;

        const html = event.clipboardData.getData('text/html');
        const text = event.clipboardData.getData('text/plain');
        const rtf = event.clipboardData.getData('text/rtf');
        const files = [];
        const unprocessFiles = [];
        for (let item of event.clipboardData.items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                unprocessFiles.push(file);
            }
        }
        for (let file of unprocessFiles) {
            const fileData = await Flow.extractFileData(file);
            files.push(fileData);
        }

        Flow.updatePaste(settings, { html, text, rtf, files });
    }

    static fromElementSettings(settings) {
        const type = settings.type;

        const container = fromHTML(`<div>`);
        settings.htmlElement = container;
        if (settings.hide) container.classList.add('hide');
        if (settings.stretch) {
            container.classList.add('w-100');
            container.classList.add('flexFill');
        }
        const containered = Flow.containerTypes.has(settings.parent?.type);
        let decorated = settings.leftChildren != null || settings.rightChildren != null;
        let element = container;
        if (settings.breakBefore != 0 || settings.breakAfter != 0) {
            const horizontal = settings.parent?.type == Flow.listBarType || settings.parent?.type == Flow.buttonType;
            const name = horizontal ? 'h' : 'b';
            const subContainer = fromHTML(`<div>`);
            if (settings.breakBefore) container.appendChild(fromHTML(`<${name + 'b-' + settings.breakBefore}>`));
            container.appendChild(subContainer);
            if (settings.breakAfter) container.appendChild(fromHTML(`<${name + 'b-' + settings.breakAfter}>`));
            element = subContainer;
        }

        if (decorated) {
            container.classList.add('decoratedContainer');
            const leftElement = fromHTML(`<div>`);
            settings.leftElement = leftElement;
            container.appendChild(leftElement);
            element = fromHTML(`<div>`);
            container.appendChild(element);
            const rightElement = fromHTML(`<div>`);
            settings.rightElement = rightElement;
            container.appendChild(rightElement);
        }
        if (settings.bordered) {
            container.classList.add('bordered');
            container.classList.add('largeElement');
        }
        settings.disabledElements = [];
        settings.contentElement = element;

        if (type == Flow.breakType) {
            if (containered) element.classList.add('vb-' + settings.size);
            else element.classList.add('hb-' + settings.size);
        } else if (type == Flow.rulerType) {
            const ruler = element.vertical ? vr() : hr();
            element.appendChild(ruler);
            settings.rulerElement = ruler;
        } else if (type == Flow.emptyType) {
            // Do nothing
        } else if (type == Flow.paragraphType) {
            Flow.tryAddTitle(element, settings);
            if (settings.maxHeight > 0) element.classList.add("maxHeight-" + settings.maxHeight);
            element.classList.add('fixText');
            element.classList.add('scroll-y');
            element.textContent = settings.text;
            settings.textElement = element;
            if (settings.placeholder != null) element.setAttribute('placeholder', settings.placeholder);
        } else if (type == Flow.titleType) {
            Flow.tryAddTitle(element, settings);
            if (settings.maxHeight > 0) element.classList.add("maxHeight-" + settings.maxHeight);
            element.classList.add('fixText');
            element.classList.add('scroll-y');
            const titleElement = fromHTML(`<h1>`);
            titleElement.textContent = settings.text;
            element.appendChild(titleElement);
            settings.textElement = titleElement;
            if (settings.placeholder != null) element.setAttribute('placeholder', settings.placeholder);
        } else if (type == Flow.subTitleType) {
            Flow.tryAddTitle(element, settings);
            if (settings.maxHeight > 0) element.classList.add("maxHeight-" + settings.maxHeight);
            element.classList.add('fixText');
            element.classList.add('scroll-y');
            const subTitleElement = fromHTML(`<h2>`);
            subTitleElement.textContent = settings.text;
            element.appendChild(subTitleElement);
            settings.textElement = subTitleElement;
            if (settings.placeholder != null) element.setAttribute('placeholder', settings.placeholder);
        } else if (type == Flow.infoType) {
            Flow.tryAddTitle(element, settings);
            if (settings.maxHeight > 0) element.classList.add("maxHeight-" + settings.maxHeight);
            element.classList.add('fixText');
            element.classList.add('info');
            element.classList.add('scroll-y');
            if (settings.mode != null) element.classList.add(settings.mode + '-text');
            element.textContent = settings.text;
            settings.textElement = element;
            if (settings.placeholder != null) element.setAttribute('placeholder', settings.placeholder);
        } else if (type == Flow.codeType) {
            Flow.tryAddTitle(element, settings);
            const codeEditorResult = CodeHelpers.createCodeEditor({
                content: settings.code,
                language: settings.language,
                readOnly: true,
                placeholder: settings.placeholder,
                maxHeight: settings.maxHeight * 100,
            });
            settings.editorContainer = codeEditorResult.codeEditorContainer;
            codeEditorResult.codeEditorPromise.then(e => settings.codeEditor = e);
            element.appendChild(codeEditorResult.codeEditorContainer);
            const streamTarget = fromHTML(`<div contenteditable="false" class="w-100 fixText hide scroll-y codeBlock">`);
            if (settings.language != null) streamTarget.classList.add('language-' + settings.language);
            if (settings.maxHeight > 0) streamTarget.classList.add("maxHeight-" + settings.maxHeight);
            if (settings.placeholder != null) streamTarget.setAttribute('placeholder', settings.placeholder);
            settings.streamTarget = streamTarget;
            element.appendChild(streamTarget);
        } else if (type == Flow.markdownType) {
            const markdownContainer = fromHTML(`<div class="w-100 scroll-y">`);
            if (settings.maxHeight > 0) markdownContainer.classList.add("maxHeight-" + settings.maxHeight);
            if (settings.placeholder != null) markdownContainer.setAttribute('placeholder', settings.placeholder);
            renderMarkdown(markdownContainer, settings.markdown, {
                delimiters: settings.katexDelimiters,
                noHighlight: settings.noHighlight,
                sanitize: true,
                katex: settings.katex
            });
            settings.markdownElement = markdownContainer;
            const rawTextElement = fromHTML(`<div class="w-100 markdownRawText hide language-markdown scroll-y">`);
            if (settings.maxHeight > 0) rawTextElement.classList.add("maxHeight-" + settings.maxHeight);
            if (settings.placeholder != null) rawTextElement.setAttribute('placeholder', settings.placeholder);
            rawTextElement.textContent = settings.markdown;
            highlightCode(rawTextElement);
            settings.rawTextElement = rawTextElement;

            const topBar = MarkdownHelpers.createBar(markdownContainer, rawTextElement);
            const bottomBar = MarkdownHelpers.createBar(markdownContainer, rawTextElement, true);
            element.appendChild(topBar);
            element.appendChild(markdownContainer);
            element.appendChild(rawTextElement);
            element.appendChild(bottomBar);
        } else if (type == Flow.htmlType) {
            settings.url = settings.html ? createObjectUrl(settings.html, { type: commonMimeTypes.html }) : null;
            const iframe = fromHTML(`<iframe sandbox="" class="scroll-y">`);
            if (settings.allowScripts) iframe.setAttribute('sandbox', 'allow-scripts');
            if (settings.maxHeight > 0) {
                iframe.classList.add("maxHeight-" + settings.maxHeight);
                iframe.classList.add("height-" + settings.maxHeight);
            }
            if (settings.url) iframe.setAttribute('src', settings.url);
            settings.iframe = iframe;
            element.appendChild(iframe);

            const rawTextElement = fromHTML(`<div class="w-100 htmlRawText hide language-html scroll-y">`);
            if (settings.maxHeight > 0) rawTextElement.classList.add("maxHeight-" + settings.maxHeight);
            if (settings.placeholder != null) rawTextElement.setAttribute('placeholder', settings.placeholder);
            rawTextElement.textContent = settings.html;
            highlightCode(rawTextElement);
            settings.rawTextElement = rawTextElement;

            const topBar = HtmlHelpers.createBar(iframe, rawTextElement);
            const bottomBar = HtmlHelpers.createBar(iframe, rawTextElement, true);
            element.appendChild(topBar);
            element.appendChild(iframe);
            element.appendChild(rawTextElement);
            element.appendChild(bottomBar);
        } else if (type == Flow.imageType) {
            Flow.tryAddTitle(element, settings);
            const figureElement = fromHTML(`<figure>`);
            const imgElement = fromHTML(`<img class="rounded-xl">`);
            if (settings.imageMaxHeight > 0) imgElement.classList.add("maxHeight-" + settings.imageMaxHeight);
            imgElement.setAttribute('src', settings.url);
            imgElement.setAttribute('alt', settings.caption ?? "");
            figureElement.appendChild(imgElement);
            const captionElement = fromHTML(`<figcaption class="scroll-y">`);
            if (settings.captionMaxHeight > 0) captionElement.classList.add("maxHeight-" + settings.captionMaxHeight);
            figureElement.appendChild(captionElement);
            settings.captionElement = captionElement;
            if (settings.caption) {
                captionElement.textContent = settings.caption;
            } else {
                captionElement.classList.add('hide');
            }
            element.appendChild(figureElement);
            settings.imgElement = imgElement;
            settings.figureElement = figureElement;
        } else if (type == Flow.iconType) {
            if (isString(settings.ds)) {
                element.appendChild(icons[settings.ds]());
            } else {
                const pathHtml = IconHelpers.dsToPathHtml(settings.ds, settings.iconProvider);
                const svgElement = IconHelpers.icon(pathHtml, settings.iconProvider, settings.title, settings.useTooltipInstead);
                element.appendChild(svgElement);
                settings.svgElement = svgElement;
            }
        } else if (Flow.containerTypes.has(settings.type)) {
            Flow.tryAddTitle(element, settings);
            let mainChildElements = settings.mainChildren.map(s => Flow.fromElementSettings(s));
            settings.mainChildElements = mainChildElements;
            element.classList.add('gap-' + settings.gap);

            if (type == Flow.barType) {
                if (settings.barSubType == Flow.navBarType) {
                    element.classList.add('listContainerHorizontal');
                } else if (settings.barSubType == Flow.listBarType) {
                    element.classList.add('listHorizontal');
                }

                if (settings.centered == true) {
                    element.classList.add('centerContentHorizontally');
                }
                mainChildElements.forEach(e => element.appendChild(e));
            } else if (type == Flow.verticalType) {
                if (settings.centered == true) {
                    element.classList.add('listVertical');
                } else {
                    element.classList.add('divList');
                }
                mainChildElements.forEach(e => element.appendChild(e));
            } else if (type == Flow.buttonType) {
                const buttonElement = fromHTML(`<button class="listHorizontal">`);
                if (settings.group.location == Flow.dialogLocation && settings.group.noAccept && settings.closeDialogOnClick) {
                    buttonElement.addEventListener('click', settings.group.dialogCloseCallback);
                    buttonElement.classList.add('dialogCloseButton');
                }
                settings.disabledElements.push(buttonElement);
                if (settings.buttonSubType == Flow.complexButtonType) {
                    buttonElement.classList.add('complexButton');
                    buttonElement.classList.add('largeElement');
                }
                if (settings.fullWidth) {
                    buttonElement.classList.add('w-100');
                }
                buttonElement.addEventListener('click', e => Flow.requireResponse(Flow.clickEventType, null, null, Flow.clickEventById.get(settings.id)));
                mainChildElements.forEach(e => buttonElement.appendChild(e));
                element.appendChild(buttonElement);
                settings.buttonElement = buttonElement;
            }
        } else if (type == Flow.textInputType) {
            if (settings.minimal) {
                const editorContainer = fromHTML(`<div class="contenteditableContainer">`);
                const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
                settings.disabledElements.push(codeEditor);
                if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
                codeEditor.setAttribute('placeholder', settings.placeholder);
                codeEditor.textContent = settings.url;
                codeEditor.addEventListener('input', e => {
                    Flow.processContentEditableInput(e.srcElement, settings, 'text');
                });
                codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
                settings.textEditor = codeEditor;
                settings.editorContainer = editorContainer;
                editorContainer.appendChild(codeEditor);
                element.appendChild(editorContainer);
            } else {
                const textEditorResult = CodeHelpers.createCodeEditor({
                    content: settings.text,
                    language: "Text",
                    onInput: e => Flow.processMonacoInput(settings, 'text'),
                    text: true,
                    placeholder: settings.placeholder,
                    maxHeight: settings.maxHeight * 100,
                    readOnly: settings.disabled,
                });
                settings.disabledElements.push(textEditorResult.codeEditorContainer);
                settings.editorContainer = textEditorResult.codeEditorContainer;
                textEditorResult.codeEditorPromise.then(e => settings.textEditor = e);
                element.appendChild(textEditorResult.codeEditorContainer);
            }

            const streamTarget = fromHTML(`<div class="w-100 largeElement fixText hide scroll-y">`);
            if (settings.placeholder != null) streamTarget.setAttribute('placeholder', settings.placeholder);
            if (settings.maxHeight > 0) streamTarget.classList.add("maxHeight-" + settings.maxHeight);
            settings.streamTarget = streamTarget;
            element.appendChild(streamTarget);
        } else if (type == Flow.numberInputType) {
            const inputElement = fromHTML(`<input type="number">`);
            settings.disabledElements.push(inputElement);
            inputElement.value = settings.number;
            inputElement.addEventListener('input', e => {
                InputHelpers.fixNumberInput(e.srcElement);
                Flow.processInput(e.srcElement, settings, 'number', 'value');
            });
            element.appendChild(inputElement);
            settings.inputElement = inputElement;
        } else if (type == Flow.passwordInputType) {
            const passwordElement = fromHTML(`<input type="password">`);
            settings.disabledElements.push(passwordElement);
            passwordElement.value = settings.password;
            passwordElement.setAttribute('placeholder', settings.placeholder);
            passwordElement.addEventListener('input', e => Flow.processInput(e.srcElement, settings, 'password', 'value'));
            element.appendChild(passwordElement);
            settings.passwordElement = passwordElement;
        } else if (type == Flow.codeInputType) {
            const codeEditorResult = CodeHelpers.createCodeEditor({
                content: settings.code,
                language: settings.language,
                onInput: e => Flow.processMonacoInput(settings, 'code'),
                placeholder: settings.placeholder,
                maxHeight: settings.maxHeight * 100,
                readOnly: settings.disabled,
            });
            settings.disabledElements.push(codeEditorResult.codeEditorContainer);
            settings.editorContainer = codeEditorResult.codeEditorContainer;
            codeEditorResult.codeEditorPromise.then(e => settings.codeEditor = e);
            element.appendChild(codeEditorResult.codeEditorContainer);

            const streamTarget = fromHTML(`<code contenteditable="false" class="w-100 largeElement fixText hide scroll-y codeBlock">`);
            if (settings.placeholder != null) streamTarget.setAttribute('placeholder', settings.placeholder);
            if (settings.maxHeight > 0) streamTarget.classList.add("maxHeight-" + settings.maxHeight);
            settings.streamTarget = streamTarget;
            element.appendChild(streamTarget);
        } else if (type == Flow.markdownInputType) {
            const contentContainer = fromHTML(`<div class="flex bordered rounded-xl markdownEditor">`);

            // Markdown editor
            const markdownEditorResult = CodeHelpers.createCodeEditor({
                content: settings.markdown,
                language: "markdown",
                onInput: e => {
                    Flow.processMonacoInput(settings, 'markdown');
                    renderMarkdown(settings.markdownElement, settings.markdown, {
                        delimiters: settings.katexDelimiters,
                        noHighlight: settings.noHighlight,
                        sanitize: true,
                        katex: settings.katex
                    });
                },
                text: true,
                placeholder: settings.placeholder,
                maxHeight: settings.maxHeight * 100,
                readOnly: settings.disabled,
            });
            settings.disabledElements.push(markdownEditorResult.codeEditorContainer);
            markdownEditorResult.codeEditorContainer.classList.add('w-100');
            settings.editorContainer = markdownEditorResult.codeEditorContainer;
            markdownEditorResult.codeEditorPromise.then(e => settings.markdownEditor = e);
            contentContainer.appendChild(markdownEditorResult.codeEditorContainer);

            // Stream target
            const streamTarget = fromHTML(`<div contenteditable="false" class="w-100 fixText hide scroll-y">`);
            if (settings.placeholder != null) streamTarget.setAttribute('placeholder', settings.placeholder);
            if (settings.maxHeight > 0) streamTarget.classList.add("maxHeight-" + settings.maxHeight);
            settings.streamTarget = streamTarget;
            contentContainer.appendChild(streamTarget);

            const outputContainer = fromHTML(`<div class="w-100">`);
            // Fake bar for same height, could also add bottom border
            // const fakeBar = fromHTML(`<div class="listContainerHorizontal">`);
            // const starButton = fromHTML(`<div class="largeElement hoverable invisible">`);
            // starButton.appendChild(icons.copy());
            // fakeBar.appendChild(starButton);
            // outputContainer.appendChild(fakeBar);

            // Markdown output
            const markdownElement = fromHTML(`<div class="w-100 markdownPreview scroll-y" placeholder="Markdown Output">`);
            markdownElement.setAttribute('placeholder', "The Markdown will be rendered here.");
            if (settings.maxHeight > 0) markdownElement.classList.add("maxHeight-" + settings.maxHeight);
            renderMarkdown(markdownElement, settings.markdown, {
                delimiters: settings.katexDelimiters,
                noHighlight: settings.noHighlight,
                sanitize: true,
                katex: settings.katex
            });
            settings.markdownElement = markdownElement;
            outputContainer.appendChild(markdownElement);
            contentContainer.appendChild(outputContainer);
            element.appendChild(contentContainer);
        } else if (type == Flow.checkboxInputType) {
            const checkboxContainer = fromHTML(`<div class="checkboxContainer">`);
            const checkboxElement = fromHTML(`<input type="checkbox">`);
            settings.disabledElements.push(checkboxElement);
            checkboxElement.checked = settings.checked;
            checkboxElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'checked', 'checked'));
            checkboxContainer.appendChild(checkboxElement);
            element.appendChild(checkboxContainer);
            settings.checkboxElement = checkboxElement;
        } else if (type == Flow.selectInputType) {
            const selectElement = fromHTML(`<select>`);
            settings.disabledElements.push(selectElement);
            selectElement.addEventListener('change', e => Flow.processInput(e.srcElement, settings, 'value', 'value'));
            settings.choices.forEach(c => {
                const choiceElement = fromHTML(`<option>`);
                choiceElement.value = c.value;
                choiceElement.text = c.name;
                choiceElement.selected = settings.value == c.value;
                selectElement.appendChild(choiceElement);
            });
            element.appendChild(selectElement);
            settings.selectElement = selectElement;
        } else if (type == Flow.imageInputType) {
            const editorContainer = fromHTML(`<div class="contenteditableContainer">`);
            const contentContainer = fromHTML(`<div>`);
            const codeEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 fixText">`);
            settings.disabledElements.push(codeEditor);
            if (settings.maxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.maxHeight);
            codeEditor.setAttribute('placeholder', settings.placeholder);
            codeEditor.textContent = settings.url;
            codeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'url');
                settings.imgElement.setAttribute('src', settings.url);
            });
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            contentContainer.appendChild(codeEditor);
            settings.codeEditor = codeEditor;

            const figureElement = fromHTML(`<figure class="contenteditableContainerContent">`);
            const imgElement = fromHTML(`<img class="rounded-xl">`);
            if (settings.imageMaxHeight > 0) imgElement.classList.add("maxHeight-" + settings.imageMaxHeight);
            imgElement.setAttribute('src', settings.url);
            imgElement.setAttribute('alt', settings.caption ?? "");
            figureElement.appendChild(imgElement);
            const captionCodeEditor = fromHTML(`<figcaption contenteditable-type="plainTextOnly" contenteditable="true" class="w-100 contenteditableContainerFooter fixText">`);
            settings.disabledElements.push(captionCodeEditor);
            if (!settings.editableCaption) captionCodeEditor.classList.add('hide');
            if (settings.captionMaxHeight != 0) codeEditor.classList.add('maxHeight-' + settings.captionMaxHeight);
            figureElement.appendChild(captionCodeEditor);

            const streamTarget = fromHTML(`<figcaption class="w-100 contenteditableContainerFooter fixText hide">`);
            settings.streamTarget = streamTarget;
            figureElement.appendChild(streamTarget);

            contentContainer.appendChild(figureElement);
            settings.imgElement = imgElement;
            settings.figureElement = figureElement;

            captionCodeEditor.setAttribute('placeholder', settings.captionPlaceholder);
            captionCodeEditor.setAttribute('spellcheck', settings.spellcheck);
            captionCodeEditor.textContent = settings.caption;
            captionCodeEditor.addEventListener('input', e => {
                Flow.processContentEditableInput(e.srcElement, settings, 'caption');
            });
            captionCodeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            settings.captionCodeEditor = captionCodeEditor;
            contentContainer.appendChild(captionCodeEditor);

            editorContainer.appendChild(contentContainer);

            settings.editorContainer = editorContainer;
            element.appendChild(editorContainer);
        } else if (type == Flow.fileInputType) {
            const fileElement = fromHTML(`<div class="w-100 largeElement bordered">`);
            const dropArea = fromHTML(`<div class="dropArea">`);
            dropArea.setAttribute('allowed-mime-types', settings.allowedMimeTypes);
            if (settings.maxSize) dropArea.setAttribute('max-file-size', settings.maxSize);
            dropArea.addEventListener('drop', e => Flow.processFileInput(e, settings));
            const dropDescriptionElement = fromHTML(`<div>`);
            dropDescriptionElement.textContent = settings.dropDescription;
            dropArea.appendChild(dropDescriptionElement);
            dropArea.appendChild(hb(4));
            const selectFilesElement = fromHTML(`<input type="file" class="dropInput">`);
            if (settings.multiple) selectFilesElement.setAttribute('multiple', '');
            selectFilesElement.setAttribute('accept', settings.allowedExtensions);
            selectFilesElement.addEventListener('change', e => Flow.processFileInput(e, settings));
            dropArea.appendChild(selectFilesElement);
            const dropButtonElement = fromHTML(`<button class="w-100 dropButton largeElement complexButton">`);
            settings.disabledElements.push(dropButtonElement);
            dropButtonElement.textContent = settings.selectDescription;
            dropArea.appendChild(dropButtonElement);
            fileElement.appendChild(dropArea);
            fileElement.appendChild(hb(4));
            const filesDisplayElement = fromHTML(`<div>`);
            const noFileSelectedElement = fromHTML(`<i>`);
            noFileSelectedElement.textContent = settings.noFileSelectedMessage;
            filesDisplayElement.appendChild(noFileSelectedElement);
            fileElement.appendChild(filesDisplayElement);
            settings.filesDisplayElement = filesDisplayElement;
            settings.dropArea = dropArea;
            settings.dropDescriptionElement = dropDescriptionElement;
            settings.selectFilesElement = selectFilesElement;
            settings.dropButtonElement = dropButtonElement;
            element.appendChild(fileElement);
        } else if (type == Flow.pasteInputType) {
            const pasteElement = fromHTML(`<div class="w-100 largeElement bordered" tabIndex="0">`);
            settings.disabledElements.push(pasteElement);
            pasteElement.addEventListener('paste', e => Flow.processPaste(e, settings));
            const descriptionElement = fromHTML(`<i>`);
            descriptionElement.textContent = settings.emptyDescription;
            settings.descriptionElement = descriptionElement;
            pasteElement.appendChild(descriptionElement);
            pasteElement.appendChild(hb(2));
            const filesDisplayElement = fromHTML(`<div class="w-100 scroll-y hide">`);
            settings.filesDisplayElement = filesDisplayElement;
            pasteElement.appendChild(filesDisplayElement);
            pasteElement.appendChild(hb(2));
            const htmlDisplayElement = fromHTML(`<div class="w-100 scroll-y hide" style="max-height: 400px;">`);
            settings.htmlDisplayElement = htmlDisplayElement;
            pasteElement.appendChild(htmlDisplayElement);
            element.appendChild(pasteElement);
            settings.pasteElement = pasteElement;
        }

        if (Flow.inputTypes.has(type)) {
            const validationContainer = fromHTML(`<div>`);
            if (!settings.isInvalid) validationContainer.classList.add('hide');
            validationContainer.appendChild(hb(1));
            const validationMessageElement = fromHTML(`<div class="validationMessage">`);
            validationMessageElement.textContent = settings.validationMessage;
            validationContainer.appendChild(validationMessageElement);
            element.appendChild(validationContainer);
            settings.validationMessageElement = validationMessageElement;
            settings.validationContainer = validationContainer;
        }

        if (settings.disabled) {
            if (settings.disabledElements.length == 0) settings.disabledElements.push(element);
            settings.disabledElements.forEach(e => e.setAttribute('disabled', ''));
        }

        settings.leftChildren?.forEach(s => settings.leftElement.appendChild(Flow.fromElementSettings(s)));
        settings.rightChildren?.forEach(s => settings.rightElement.appendChild(Flow.fromElementSettings(s)));

        return container;
    }

    static extractElements(settings) {
        let isGroup = false;
        if (settings.element) isGroup = true;

        const elements = [];
        let unprocessed = [isGroup ? settings.element : settings];
        if (settings.acceptButtonContent != null) unprocessed = unprocessed.concat(settings.acceptButtonContent);
        while (unprocessed.length != 0) {
            let newUnprocessed = [];
            for (let element of unprocessed) {
                elements.push(element);
                if (element.children != null) newUnprocessed = newUnprocessed.concat(element.children);
            }
            unprocessed = newUnprocessed;
        }

        return elements;
    }

    static extractInputElements(groupSettings) {
        const inputs = [];
        let unprocessed = [groupSettings.element];
        if (groupSettings.acceptButtonContent != null) unprocessed = unprocessed.concat(groupSettings.acceptButtonContent);
        while (unprocessed.length != 0) {
            let newUnprocessed = [];
            for (let settings of unprocessed) {
                if (Flow.inputTypes.has(settings.type)) inputs.push(settings);
                else if (settings.children != null) newUnprocessed = newUnprocessed.concat(settings.children);
            }
            unprocessed = newUnprocessed;
        }

        return inputs;
    }

    static extractInputValues(groupSettings) {
        const inputs = Flow.extractInputElements(groupSettings);
        const inputValues = [];
        for (let settings of inputs) {
            const value = { id: settings.id, isInvalid: settings.isInvalid };
            const type = settings.type;

            if (type == Flow.textInputType) {
                value.text = settings.text;
            } else if (type == Flow.numberInputType) {
                value.number = settings.number;
            } else if (type == Flow.passwordInputType) {
                value.password = settings.password;
            } else if (type == Flow.codeInputType) {
                value.code = settings.code;
            } else if (type == Flow.markdownInputType) {
                value.markdown = settings.markdown;
            } else if (type == Flow.checkboxInputType) {
                value.checked = settings.checked;
            } else if (type == Flow.selectInputType) {
                value.value = settings.value;
            } else if (type == Flow.imageInputType) {
                value.url = settings.url;
                value.caption = settings.caption;
            } else if (type == Flow.fileInputType) {
                value.files = settings.files;
            } else if (type == Flow.pasteInputType) {
                value.html = settings.html;
                value.rtf = settings.rtf;
                value.text = settings.text;
                value.files = settings.files;
            }

            inputValues.push(value);
        }

        return inputValues;
    }

    static closeOutputDialog() {
        Flow.dialogOutputElement.innerHTML = '';
        Flow.dialogOutputContainer.classList.add('hide');
    }

    static onCloseDialog(groupSettings) {
        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.id);
        Flow.postSuccessResponse(groupSettings.event);
        Flow.closeOutputDialog();
    }

    static onCancelDialog(groupSettings) {
        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.id);
        Flow.postErrorResponse(groupSettings.event, "dialog_canceled");
        Flow.closeOutputDialog();
    }

    static async onAccept(groupSettings, forceAccept = false) {
        if (groupSettings.accepted) return;

        if (groupSettings.location == Flow.dialogLocation) Flow.remove(groupSettings.id);

        const inputValues = Flow.extractInputValues(groupSettings);
        if (groupSettings.location != Flow.dialogLocation) groupSettings.acceptButtonElement.remove();

        const inputs = Flow.extractInputElements(groupSettings);
        if (!forceAccept) {
            for (let settings of inputs) {
                await Flow.requestDelayedValidation(settings)
            }
        }

        if (groupSettings.isInvalid && !forceAccept) return;

        groupSettings.accepted = true;
        Flow.postSuccessResponse(groupSettings.event, inputValues);
        if (groupSettings.location == Flow.dialogLocation) {
            Flow.closeOutputDialog();
            return;
        }

        for (let settings of inputs) {
            const element = fromHTML(`<div>`);

            // Create an uneditable element based on the input type
            const type = settings.type;

            if (type == Flow.textInputType) {
                element.classList.add('fixText');
                element.textContent = settings.text;
            } else if (type == Flow.numberInputType) {
                element.classList.add('fixText');
                element.textContent = settings.number;
            } else if (type == Flow.passwordInputType) {
                element.classList.add('fixText');
                element.textContent = '••••••••'; // Hide the actual password
            } else if (type == Flow.codeInputType) {
                const codeEditorResult = CodeHelpers.createCodeEditor({
                    content: settings.code,
                    language: settings.language,
                    readOnly: true,
                    maxHeight: settings.maxHeight == 0 ? null : settings.maxHeight * 100,
                });
                settings.editorContainer = codeEditorResult.codeEditorContainer;
                codeEditorResult.codeEditorPromise.then(e => settings.codeEditor = e);
                element.appendChild(codeEditorResult.codeEditorContainer);
            } else if (type == Flow.markdownInputType) {
                const markdownContainer = fromHTML(`<div class="w-100">`);
                renderMarkdown(markdownContainer, settings.markdown, {
                    delimiters: settings.katexDelimiters,
                    noHighlight: settings.noHighlight,
                    sanitize: true,
                    katex: settings.katex
                });
                const rawTextContainer = fromHTML(`<div class="w-100 fixText hide language-markdown">`);
                rawTextContainer.textContent = settings.markdown;
                highlightCode(rawTextContainer);

                const topBar = MarkdownHelpers.createBar(markdownContainer, rawTextContainer);
                const bottomBar = MarkdownHelpers.createBar(markdownContainer, rawTextContainer, true);
                element.appendChild(topBar);
                element.appendChild(markdownContainer);
                element.appendChild(rawTextContainer);
                element.appendChild(bottomBar);
            } else if (type == Flow.checkboxInputType) {
                const checkboxElement = fromHTML(`<input type="checkbox" disabled>`);
                checkboxElement.checked = settings.checked;
                element.appendChild(checkboxElement);
            } else if (type == Flow.selectInputType) {
                element.classList.add('fixText');
                const selectedChoice = settings.choices.find(c => c.value == settings.value);
                element.textContent = selectedChoice ? selectedChoice.name : '';
            } else if (type == Flow.imageInputType) {
                const figureElement = fromHTML(`<figure>`);
                const imgElement = fromHTML(`<img class="rounded-xl">`);
                imgElement.setAttribute('src', settings.url);
                imgElement.setAttribute('alt', settings.caption ?? "");
                figureElement.appendChild(imgElement);
                const captionElement = fromHTML(`<figcaption>`);
                figureElement.appendChild(captionElement);
                settings.captionElement = captionElement;
                if (settings.caption) {
                    captionElement.textContent = settings.caption;
                } else {
                    captionElement.classList.add('hide');
                }
                element.appendChild(figureElement);
                settings.imgElement = imgElement;
                settings.figureElement = figureElement;
            } else if (type == Flow.fileInputType) {
                const fileList = settings.filesDisplayElement.children;
                const displayList = document.createElement('div');
                for (const file of fileList) {
                    const fileElement = fromHTML(`<div>`);
                    fileElement.textContent = file.textContent;
                    displayList.appendChild(fileElement);
                }
                element.appendChild(displayList);
            } else if (type == Flow.pasteInputType) {
                const filesDisplay = settings.filesDisplayElement.innerHTML;
                const htmlDisplay = settings.htmlDisplayElement.innerHTML;
                element.innerHTML = filesDisplay || htmlDisplay || settings.emptyDescription;
            }

            settings.htmlElement.replaceWith(element);
        }
    }

    static fromGroupSettings(settings) {
        const container = fromHTML(`<div class="w-100 divList gap-2">`);
        if (settings.element.hide) container.classList.add('hide');
        settings.htmlElement = container;
        settings.dialogCloseCallback = e => Flow.onCloseDialog(settings);

        let element = container;

        const childElement = Flow.fromElementSettings(settings.element);
        element.appendChild(childElement);

        const inputs = Flow.extractInputElements(settings);

        if (inputs.length != 0) {
            const validationContainer = fromHTML(`<div class="listContainerHorizontal">`);
            if (!settings.isInvalid) validationContainer.classList.add('hide');
            validationContainer.appendChild(hb(1));
            validationContainer.appendChild(fromHTML(`<div>`));
            const validationMessageElement = fromHTML(`<div class="validationMessage">Some inputs are invalid.`);
            settings.validationMessageElement = validationMessageElement;
            settings.validationContainer = validationContainer;
            validationContainer.appendChild(validationMessageElement);
            validationContainer.appendChild(hb(1));

            element.appendChild(validationContainer);

            if (settings.location != Flow.dialogLocation) {
                const footer = fromHTML(`<div class="listContainerHorizontal">`);
                footer.appendChild(fromHTML(`<div>`));
                const acceptButton = fromHTML(`<button class="largeElement complexButton">`);
                if (settings.isInvalid) acceptButton.setAttribute('disabled', '');
                if (settings.acceptButtonContent == null) acceptButton.textContent = "Accept";
                else acceptButton.appendChild(Flow.fromElementSettings(settings.acceptButtonContent));
                acceptButton.addEventListener('click', e => Flow.onAccept(settings));
                footer.appendChild(acceptButton);
                element.appendChild(footer);
                settings.acceptButtonElement = acceptButton;
                if (settings.noAccept) footer.classList.add('hide');
            }

        }

        if (settings.location == Flow.dialogLocation) {
            Flow.dialogOutputOverlay.classList.remove('dialogCloseButton');
            Flow.dialogOutputCancelButton.classList.remove('dialogCloseButton');
            if (settings.noAccept) {
                Flow.dialogOutputAcceptButton.removeAttribute('disabled');
                Flow.dialogOutputFooter.classList.add('hide');

                if (!settings.noCloseOnOverlay) {
                    Flow.dialogOutputOverlay = replaceElementWithClone(Flow.dialogOutputOverlay);
                    Flow.dialogOutputOverlay.addEventListener('click', settings.dialogCloseCallback);
                }
            } else {
                settings.acceptButtonElement = Flow.dialogOutputAcceptButton;
                if (settings.isInvalid) Flow.dialogOutputAcceptButton.setAttribute('disabled', '');
                else Flow.dialogOutputAcceptButton.removeAttribute('disabled');

                Flow.dialogOutputCancelButton = replaceElementWithClone(Flow.dialogOutputCancelButton);
                Flow.dialogOutputCancelButton.classList.add('dialogCloseButton');
                Flow.dialogOutputCancelButton.addEventListener('click', e => Flow.onCancelDialog(settings));
                Flow.dialogOutputAcceptButton = replaceElementWithClone(Flow.dialogOutputAcceptButton);
                Flow.dialogOutputAcceptButton.addEventListener('click', e => Flow.onAccept(settings));

                Flow.dialogOutputOverlay.classList.remove('hide');
                Flow.dialogOutputFooter.classList.remove('hide');
            }

            Flow.dialogOutputOverlay.classList.remove('hide');
        }

        return element;
    }

    static clearOutput() {
        Flow.output.forEach(s => s.htmlElement.remove());
        Flow.output = [];
    }

    static async spliceOutput(start = -1, deleteCount = 0, ...insertGroupSettings) {
        if (start < 0) start = Flow.output.length + 1 + start;

        if (Flow.output.length == 0 && insertGroupSettings.length > 0) Flow.outputElement.innerHTML = '';

        // Create elements
        const elements = insertGroupSettings.map(s => Flow.fromGroupSettings(s));

        // Splice settings
        const deleted = Flow.output.splice(start, deleteCount, ...insertGroupSettings);
        const htmlElements = deleted.map(s => Flow.extractElements(s)).flat().filter(s => s.type == Flow.htmlType);
        htmlElements.forEach(s => {
            if (s.url != null) URL.revokeObjectURL(s.url);
        });

        // Validate inputs before showing (but after creating)
        for (let groupSettings of insertGroupSettings) {
            const inputs = Flow.extractInputElements(groupSettings);
            for (let settings of inputs) {
                await Flow.requestValidation(settings);
            }
        }

        // Remove deleted elements from their respective parent elements
        deleted.forEach(s => {
            s.htmlElement.remove();
            Flow.groupById.delete(s.id);
            Flow.elementById.delete(s.id);
        });

        // Find the count of elements in different locations up to the start index
        let mainCountBeforeStart = 0;
        let stickyCountBeforeStart = 0;
        let dialogCountBeforeStart = 0;

        for (let i = 0; i < start; i++) {
            const location = Flow.output[i].location;
            if (location === Flow.stickyLocation) {
                stickyCountBeforeStart++;
            } else if (location === Flow.dialogLocation) {
                dialogCountBeforeStart++;
            } else {
                mainCountBeforeStart++;
            }
        }

        // Insert new elements into their respective parent elements
        const mainParent = Flow.outputElement;
        const stickyParent = Flow.stickyOutputElement;
        const dialogParent = Flow.dialogOutputElement;

        let mainInsertIndex = mainCountBeforeStart;
        let stickyInsertIndex = stickyCountBeforeStart;
        let dialogInsertIndex = dialogCountBeforeStart;

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const groupSettings = insertGroupSettings[i];
            const location = groupSettings.location;

            if (location === Flow.stickyLocation) {
                Flow.stickyOutputContainer.classList.remove('hide');
                // Insert into the stickyParent
                if (stickyInsertIndex < stickyParent.children.length) {
                    stickyParent.insertBefore(element, stickyParent.children[stickyInsertIndex]);
                } else {
                    stickyParent.appendChild(element);
                }
                stickyInsertIndex++;
            } else if (location === Flow.dialogLocation) {
                // Insert into the dialogParent
                dialogParent.replaceChildren(element);
                Flow.dialogOutputContainer.classList.remove('hide');
                dialogInsertIndex++;
            } else {
                // Insert into the mainParent
                if (mainInsertIndex < mainParent.children.length) {
                    mainParent.insertBefore(element, mainParent.children[mainInsertIndex]);
                } else {
                    mainParent.appendChild(element);
                }
                mainInsertIndex++;
            }
        }
        if (stickyInsertIndex == 0) Flow.stickyOutputContainer.classList.add('hide');

        if (Flow.output.length == 0) Flow.mainLocation.textContent = Flow.noOutputMessage;

        doScrollTick();
    }

    static async onShowRequest(event) {
        const e = event;
        const content = e.content;
        content.options ??= {};
        const options = content.options;
        options.sticky ??= false;
        options.insertAt ??= -1;
        options.insertBefore ??= null;
        options.insertAfter ??= null;
        options.deleteAfter ??= 0;
        options.deleteBefore ??= 0;
        let insertAt = options.insertAt;
        if (options.insertBefore != null) insertAt = Flow.output.findIndex(s => s.id == options.insertBefore);
        if (options.insertAfter != null) insertAt = Flow.output.findIndex(s => s.id == options.insertAfter) + 1;

        const settings = Flow.extractSettingsFromGroup(content);
        settings.event = e;

        const inputs = Flow.extractInputElements(settings);

        await Flow.spliceOutput(insertAt, options.deleteAfter, settings);
        if (Flow.log) console.log(Flow.output[Flow.output.length - 1]);
        if (options.deleteBefore > 0) {
            await Flow.spliceOutput(insertAt - options.deleteBefore, options.deleteBefore);
        }

        if (options.noAccept) await Flow.requireResponse(Flow.noAcceptShownEventType, null, null, e);
        if (inputs.length == 0) Flow.postSuccessResponse(e);
    }

    static async onRead(event) {
        const e = event;
        const content = e.content;
        let values;
        if (content.all) {
            const groups = content.id == null ? Flow.output : [Flow.groupById.get(content.id)];
            values = groups.map(group => Flow.extractInputValues(group)).flat();
        } else {
            const group = Flow.elementById.get(content.id).group;
            values = Flow.extractInputValues(group).find(v => v.id == content.id)
        }

        Flow.postSuccessResponse(e, values);
    }

    static async onUpdate(event) {
        const e = event;
        const properties = e.content.properties;

        const settings = Flow.elementById.get(e.content.id);
        let rerenderMarkdown = false;
        if (Flow.inputTypes.has(settings.type) && settings.group.accepted) return;

        for (let key in properties) {
            if (properties[key] === settings[key]) {
                delete properties[key];
            }
        }

        const retainSelection = properties.retainSelection ?? false;
        let selection;

        // Update settings and corresponding elements
        if (properties.hide !== undefined) {
            settings.hide = properties.hide;
            if (settings.hide) settings.htmlElement.classList.add('hide');
            else settings.htmlElement.classList.remove('hide');

            if (settings.group.element == settings) {
                if (settings.hide) settings.group.htmlElement.classList.add('hide');
                else settings.group.htmlElement.classList.remove('hide');
            }
        }
        if (properties.disabled !== undefined) {
            settings.disabled = properties.disabled;
            if (settings.disabled) settings.disabledElements.forEach(e => e.addAttribute('disabled', ''));
            else settings.disabledElements.forEach(e => e.removeAttribute('disabled'));
        }
        if (properties.text !== undefined) {
            settings.text = properties.text;
            if (settings.type === Flow.textInputType) {
                if (settings.minimal) {
                    settings.textEditor.textContent = settings.text;
                } else {
                    if (retainSelection) selection = settings.textEditor?.getPosition();
                    settings.textEditor?.setValue(settings.text);
                    if (retainSelection) settings.textEditor?.setPosition(selection);
                }
            } else {
                settings.textElement.textContent = settings.text;
            }
        }
        if (properties.code !== undefined) {
            settings.code = properties.code;
            if (retainSelection) selection = settings.codeEditor?.getPosition();
            settings.codeEditor?.setValue(settings.code);
            if (retainSelection) settings.codeEditor?.setPosition(selection);
        }
        if (properties.markdown !== undefined) {
            settings.markdown = properties.markdown;
            if (settings.type === Flow.markdownInputType) {
                rerenderMarkdown = true;
                if (retainSelection) selection = settings.markdownEditor?.getPosition();
                settings.markdownEditor?.setValue(settings.markdown);
                if (retainSelection) settings.markdownEditor?.setPosition(selection);

            } else {
                rerenderMarkdown = true;
                settings.rawTextElement.textContent = settings.markdown;
                highlightCode(settings.rawTextElement);
            }
        }
        if (properties.html !== undefined) {
            settings.html = properties.html;
            if (settings.url) URL.revokeObjectURL(settings.url);
            settings.url = settings.html ? createObjectUrl(settings.html, { type: commonMimeTypes.html }) : null;
            if (settings.url) settings.iframe.setAttribute('src', settings.url);

            settings.rawTextElement.textContent = settings.html;
            highlightCode(settings.rawTextElement);
        }
        if (properties.url !== undefined) {
            settings.url = properties.url;
            if (settings.type === Flow.imageType) {
                settings.imgElement.setAttribute('src', settings.url);
            }
        }
        if (properties.caption !== undefined) {
            settings.caption = properties.caption;
            if (settings.type === Flow.imageType) {
                settings.captionElement.textContent = settings.caption;
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.textContent = settings.caption;
            }
        }
        if (properties.editableCaption !== undefined && settings.type === Flow.imageInputType) {
            if (properties.editableCaption) {
                settings.captionCodeEditor.classList.remove('hide');
            } else {
                settings.captionCodeEditor.classList.add('hide');
            }
        }
        if (properties.checked !== undefined && settings.type === Flow.checkboxInputType) {
            settings.checked = properties.checked;
            settings.checkboxElement.checked = properties.checked;
        }
        if (properties.value !== undefined && settings.type === Flow.selectInputType) {
            settings.value = properties.value;
            settings.selectElement.value = properties.value;
        }
        if (properties.spellcheck !== undefined) {
            settings.spellcheck = properties.spellcheck;
            if (settings.type === Flow.textInputType || settings.type === Flow.markdownInputType) {
                settings.codeEditor.setAttribute('spellcheck', settings.spellcheck);
            } else if (settings.type === Flow.imageInputType) {
                settings.captionCodeEditor.setAttribute('spellcheck', settings.spellcheck);
            }
        }
        if (properties.placeholder !== undefined && (settings.type === Flow.textInputType || settings.type === Flow.codeInputType || settings.type === Flow.passwordInputType)) {
            settings.placeholder = properties.placeholder;
            settings.codeEditor?.setAttribute('placeholder', settings.placeholder);
        }
        if (properties.number !== undefined && settings.type === Flow.numberInputType) {
            settings.number = properties.number;
            settings.inputElement.value = settings.number;
        }
        if (properties.password !== undefined && settings.type === Flow.passwordInputType) {
            settings.password = properties.password;
            settings.passwordElement.value = settings.password;
        }
        if (properties.noHighlight !== undefined) {
            settings.noHighlight = properties.noHighlight;
            rerenderMarkdown = true;
        }
        if (properties.files !== undefined && settings.type === Flow.fileInputType) {
            settings.filesDisplayElement.innerHTML = '';
            settings.files = [];
            Flow.addFiles(properties.files, settings);
        }
        if (settings.type === Flow.pasteInputType) {
            if (properties.html !== undefined ||
                properties.rtf !== undefined ||
                properties.text !== undefined ||
                properties.files !== undefined) {
                Flow.updatePaste(settings, properties);
            }
            if (properties.emptyDescription !== undefined) {
                settings.emptyDescription = properties.pasemptyDescriptionsword;
            }
            if (properties.replaceDescription !== undefined) {
                settings.replaceDescription = properties.replaceDescription;
            }
        }

        if (rerenderMarkdown) {
            renderMarkdown(settings.markdownElement, settings.markdown, {
                delimiters: settings.katexDelimiters,
                noHighlight: settings.noHighlight,
                sanitize: true,
                katex: settings.katex
            });
        }

        doScrollTick();
        Flow.postSuccessResponse(e);
    }

    static remove(id = null) {
        if (id == null) {
            Flow.output.forEach(s => Flow.remove(s.id));
            return;
        }

        if (Flow.groupById.has(id)) {
            const start = Flow.output.findIndex(s => s.id == id);
            Flow.spliceOutput(start, 1);
        } else {
            const settings = Flow.elementById.get(id);
            Flow.elementById.delete(id);
            const start = settings.parent.children.findIndex(s => s.id == id); // Has definitely a parent since it can no longer be a top level element.
            settings.parent.children.splice(start, 1);
            settings.htmlElement.remove();

            const htmlElements = Flow.extractElements(settings).filter(s => s.type == Flow.htmlType);
            htmlElements.forEach(s => {
                if (s.url != null) URL.revokeObjectURL(s.url);
            });
        }
    }

    static async onRemove(event) {
        const e = event;
        const content = e.content;
        Flow.remove(content.id);
        Flow.postSuccessResponse(e);
    }

    static async onAcceptRequest(event) {
        const e = event;
        const content = e.content;
        if (content.id == null) {
            Flow.output.forEach(s => Flow.onAccept(s, true));
        } else {
            const group = Flow.groupById.get(content.id);
            Flow.onAccept(group, true);
        }

        Flow.postSuccessResponse(e);
    }

    static async onClick(event) {
        const e = event;
        const id = e.content;
        Flow.clickEventById.set(id, event);
        // No response here
    }

    static async onChat(event) {
        const e = event;
        const content = e.content;

        const needsApiKey = ChatApi.getApiKey(content.options?.model) == null;
        if (needsApiKey) await Settings.open();

        if (content.get != null) {
            if (content.get == 'availableModels') {
                const models = ChatApi.getSortedModels(ChatApi.getAvailableModels(Settings.hasProxy()));
                Flow.postSuccessResponse(e, models);
            }
            return;
        }

        if (!ChatApi.getApiKey(content.options?.model)) {
            Flow.setStatus('Required Api Key was missing.', true);
            Flow.postErrorResponse(e, 'api_key_missing');
            return;
        }

        let hasProxy = Settings.hasProxy();
        let requiresProxy = ChatApi.requiresProxy(content.options?.model);
        if (requiresProxy && !hasProxy) {
            await Settings.open();
            if (!Settings.hasProxy()) {
                Flow.setStatus('Required Proxy was missing.', true);
                Flow.postErrorResponse(e, 'proxy_missing');
                return;
            }
        }
        let customFetch = UserProxy.fetchProvider(requiresProxy);

        const context = [];
        for (let message of content.context) {
            if (message.url) context.push(ChatApi.toImageMessage(message.prompt, message.url));
            else context.push(ChatApi.toMessage(message.role, message.prompt));
        }
        const options = content.options ?? {};
        const chatOptions = {
            model: options.model,
            maxTokens: options.maxTokens,
            continueAfterMaxTokens: options.continueAfterMaxTokens,
            seed: options.seed,
            jsonMode: options.jsonMode,
            fetchOverride: customFetch,
        };
        let settings = Flow.elementById.get(options.id);

        let result = '';
        try {
            if (options.hasOnUpdate || settings != null) {
                if (settings != null && (Flow.inputTypes.has(settings.type) || settings.type == Flow.codeType)) {
                    if (settings.type == Flow.imageInputType) {
                        settings.captionCodeEditor.classList.add('hide');
                    } else {
                        settings.editorContainer.classList.add('hide');
                    }

                    settings.streamTarget.classList.remove('hide');
                }
                doScrollTick();

                // Stream
                let timeRef = Date.now();
                const minTime = second / 5;
                const maxLength = 10000;
                result = await ChatApi.streamChat(context, async text => {
                    if (options.hasOnUpdate) {
                        const transformed = await Flow.requireResponse(Flow.chatStreamEventType, text, null, e);
                        if (transformed != null) text = transformed;
                    }
                    settings = Flow.elementById.get(options.id);
                    if (settings != null) {
                        // Update the string value of the element based on its type
                        if (settings.type === Flow.paragraphType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.titleType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.subTitleType) {
                            settings.text = text;
                            settings.textElement.textContent = text;
                        } else if (settings.type === Flow.codeType) {
                            settings.code = text;
                            settings.streamTarget.textContent = text;
                            if (settings.language != null) highlightCode(settings.streamTarget);
                        } else if (settings.type === Flow.markdownType) {
                            settings.markdown = text;
                            if (isDurationOver(timeRef, minTime) && text.length < maxLength) {
                                timeRef = Date.now();
                                settings.rawTextElement.textContent = text;
                                renderMarkdown(settings.markdownElement, text, {
                                    delimiters: settings.katexDelimiters,
                                    noHighlight: settings.noHighlight,
                                    sanitize: true,
                                    katex: settings.katex
                                });
                                highlightCode(settings.rawTextElement);
                            }
                        } else if (settings.type === Flow.imageType) {
                            settings.caption = text;
                            settings.captionElement.textContent = text;
                            settings.streamTarget.textContent = text;
                        } else if (settings.type === Flow.textInputType) {
                            settings.text = text;
                            settings.streamTarget.textContent = text;
                        } else if (settings.type === Flow.codeInputType) {
                            settings.code = text;
                            settings.streamTarget.textContent = text;
                            highlightCode(settings.streamTarget);
                        } else if (settings.type === Flow.markdownInputType) {
                            settings.markdown = text;
                            if (isDurationOver(timeRef, minTime) && text.length < maxLength) {
                                timeRef = Date.now();
                                renderMarkdown(settings.markdownElement, text, {
                                    delimiters: settings.katexDelimiters,
                                    noHighlight: settings.noHighlight,
                                    sanitize: true,
                                    katex: settings.katex
                                });
                                settings.streamTarget.textContent = text;
                                highlightCode(settings.streamTarget);
                            }
                        } else if (settings.type === Flow.imageInputType) {
                            settings.caption = text;
                            settings.captionCodeEditor.textContent = text;
                            settings.streamTarget.textContent = text;
                        } else {
                            console.warn(`Unsupported type for streaming updates: ${settings.type}`);
                        }
                    }

                    doScrollTick();
                }, chatOptions);

                settings = Flow.elementById.get(options.id);
                if (settings?.type === Flow.markdownType) {
                    settings.rawTextElement.textContent = result;
                    renderMarkdown(settings.markdownElement, result, {
                        delimiters: settings.katexDelimiters,
                        noHighlight: settings.noHighlight,
                        sanitize: true,
                        katex: settings.katex
                    });
                    highlightCode(settings.rawTextElement);
                }
                if (settings != null && (Flow.inputTypes.has(settings.type) || settings.type == Flow.codeType)) {
                    if (settings.type == Flow.imageInputType) {
                        settings.captionCodeEditor.classList.remove('hide');
                        InputHelpers.replaceTextWithUndo(settings.captionCodeEditor, result);
                    } else {
                        settings.codeEditor.classList.remove('hide');
                        if (settings.type == Flow.textInputType) {
                            if (settings.minimal) {
                                InputHelpers.replaceTextWithUndo(settings.textEditor, result);
                            } else {
                                Monaco.replaceCodeWithUndo(settings.textEditor, result);
                            }
                        } else if (settings.type == Flow.codeInputType || settings.type == Flow.codeType) {
                            Monaco.replaceCodeWithUndo(settings.codeEditor, result);
                        } else if (settings.type == Flow.markdownInputType) {
                            Monaco.replaceCodeWithUndo(settings.markdownEditor, result);
                            renderMarkdown(settings.markdownElement, result, {
                                delimiters: settings.katexDelimiters,
                                noHighlight: settings.noHighlight,
                                sanitize: true,
                                katex: settings.katex
                            });
                            settings.streamTarget.textContent = result;
                            highlightCode(settings.streamTarget);
                        }
                    }
                    settings.streamTarget.classList.add('hide');
                }
            } else {
                // Don't stream if no id and no onUpdate
                result = await ChatApi.chat(context, chatOptions);
            }

            doScrollTick();
            Flow.postSuccessResponse(e, result);
        } catch (error) {
            console.log(error.stack);
            Flow.postErrorResponse(e, "chat_error");
        }
    }

    static async onFileDownloadRequest(event) {
        const e = event;
        const content = e.content;
        downloadFile(content.name, content.content, content.type);
    }

    static async onDataURLDownloadRequest(event) {
        const e = event;
        const content = e.content;
        downloadDataURL(content.name, content.dataURL);
    }

    static async onSetProgressRequest(event) {
        const e = event;
        Flow.showProgress();
        Flow.setProgress(e.content);
        Flow.postSuccessResponse(e);
    }

    static async onSetStatusRequest(event) {
        const e = event;
        Flow.setStatus(e.content);
        Flow.postSuccessResponse(e);
    }

    static import() {
        for (let fileInfo of Flow.importData.files) {
            if (fileInfo.starred) {
                addLocalPage(fileInfo.item.name, fileInfo.item.link, fileInfo.item.code);
            } else {
                // Empty because unstarring input is currently not in development
            }
        }
        Flow.closeImportDialog();
    }

    static openImportDialog() {
        Flow.importData.files = [];
        Flow.importData.filesDisplayElement.innerHTML = '';
        Flow.importData.filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        Flow.importDialog.classList.remove('hide');
    }

    static closeImportDialog() {
        Flow.importDialog.classList.add('hide');
    }

    static removeImportFile(index) {
        spliceChildren(Flow.importData.filesDisplayElement, index, 1);
        Flow.importData.files.splice(index, 1);
        if (Flow.importData.files.length == 0) {
            Flow.importData.importButton.setAttribute('disabled', '');
            Flow.importData.filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        }
    }

    static async processImport(event) {
        const fileData = [];
        const files = getFilesFromEvent(event);
        for (let file of files) {
            const text = await file.text();
            const json = JSON.parse(text);
            if (!json) {
                console.log("Error: File couldn't be parsed.");
                continue;
            }
            if (!isString(json.code) || !isString(json.name, true) || !isString(json.link, true)) {
                console.log("Error: Invalid file.");
                continue;
            }
            const item = {
                code: json.code,
                name: json.name,
                link: json.link,
            }
            const fileInfo = {
                name: file.name,
                starred: true,
                item,
            }
            fileData.push(fileInfo);
            break;
        }
        if (fileData.length == 0) return;
        if (Flow.importData.files.length == 0) Flow.importData.filesDisplayElement.innerHTML = '';
        Flow.importData.importButton.removeAttribute('disabled');

        Flow.importData.files = Flow.importData.files.concat(fileData);
        for (let [index, fileInfo] of Object.entries(fileData)) {
            const fileDisplayElement = fromHTML(`<div class="listHorizontal">`);
            const fileNameElement = fromHTML(`<div>`);
            fileNameElement.textContent = fileInfo.name + ':';
            fileDisplayElement.appendChild(fileNameElement);
            const nameInputElement = fromHTML(`<input type="text" tooltip="Enter name. Discarded if link is empty." placeholder="Enter name here...">`);
            nameInputElement.value = fileInfo.item.name;
            fileDisplayElement.appendChild(nameInputElement);
            const linkInputElement = fromHTML(`<input type="text" tooltip="Enter link. An empty link will override the default Code Flow page." placeholder="Enter link here...">`);
            linkInputElement.value = escapeFileNameMinimal(fileInfo.item.name);

            nameInputElement.addEventListener('input', e => {
                fileInfo.item.name = e.srcElement.value;
                if (fileInfo.item.name.trim() == '') e.srcElement.value = fileInfo.item.name = fileInfo.item.link;
                else if (!fileInfo.hasChanged) {
                    linkInputElement.value = fileInfo.item.link = escapeFileNameMinimal(fileInfo.item.name);
                }

            });
            linkInputElement.addEventListener('input', e => {
                fileInfo.item.link = e.srcElement.value;
                if (fileInfo.item.link.trim() == '') {
                    fileInfo.hasChanged = false;
                    //e.srcElement.value = escapeFileNameMinimal(fileInfo.item.name);
                    nameInputElement.value = fileInfo.item.name = '';
                } else if (fileInfo.item.link != e.srcElement.value) {
                    fileInfo.hasChanged = true;
                    fileInfo.item.link = e.srcElement.value = escapeFileNameMinimal(e.srcElement.value);
                    ;
                    if (fileInfo.item.name.trim() == '') nameInputElement.value = fileInfo.item.name = fileInfo.item.link;
                }
            });

            fileDisplayElement.appendChild(linkInputElement);

            // Star button
            // const starButton = fromHTML(`<button>`);
            // starButton.addEventListener('click', e => {
            //     fileInfo.starred = !fileInfo.starred;
            //     starButton.innerHTML = '';
            //     if (fileInfo.starred) starButton.appendChild(icons.star());
            //     else starButton.appendChild(icons.starFilled());
            // });
            // const starIcon = icons.starFilled();
            // starButton.appendChild(starIcon);
            // leftBarList.appendChild(starButton);

            const fileDeleteElement = fromHTML(`<button>`);
            fileDeleteElement.textContent = "X";
            fileDeleteElement.addEventListener('click', e => Flow.removeImportFile(index));
            fileDisplayElement.appendChild(fileDeleteElement);
            Flow.importData.filesDisplayElement.appendChild(fileDisplayElement);
        }

    }

    static setupImportDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);

        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Import Code`));
        element.appendChild(titleBar);
        element.appendChild(hb(2));

        // File drop area
        Flow.importData = { files: [] };
        const dropArea = fromHTML(`<div class="dropArea" allowed-mime-types="${commonMimeTypes.json}">`);
        dropArea.addEventListener('drop', e => Flow.processImport(e));
        const dropDescriptionElement = fromHTML(`<div>Drag and drop valid .json files.`);
        dropArea.appendChild(dropDescriptionElement);
        dropArea.appendChild(hb(4));
        const selectFilesElement = fromHTML(`<input type="file" class="dropInput" multiple accept=".json">`);
        selectFilesElement.addEventListener('change', e => Flow.processImport(e));
        dropArea.appendChild(selectFilesElement);
        const dropButtonElement = fromHTML(`<button class="w-100 dropButton largeElement complexButton">Or select files`);
        dropArea.appendChild(dropButtonElement);
        element.appendChild(dropArea);

        // Files display
        element.appendChild(hb(4));
        const filesDisplayElement = fromHTML(`<div class="listVertical divList">`);
        filesDisplayElement.appendChild(fromHTML(`<i>No file selected.`));
        Flow.importData.filesDisplayElement = filesDisplayElement;
        element.appendChild(filesDisplayElement);
        element.appendChild(hb(4));

        // Footer
        const footer = fromHTML(`<div class="listHorizontal">`);
        const cancelButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill dialogCloseButton">Cancel`);
        cancelButton.addEventListener('click', e => Flow.closeImportDialog());
        footer.appendChild(cancelButton);
        const importButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill" disabled>Import`);
        importButton.addEventListener('click', e => Flow.import());
        Flow.importData.importButton = importButton;
        footer.appendChild(importButton);
        element.appendChild(footer);

        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);

        Flow.importDialog = dialogElement;
    }

    static export() {
        const page = Flow.getPage();
        const item = { securityId, name: page.name, code: page.code, link: page.link };
        const json = JSON.stringify(item);
        let name = item.name;
        const url = getHashQueryVariable('url');
        if (linkedPages.has(url)) {
            name = linkedPages.get(url).name;
        }

        const fileName = name ? escapeFileName(name) : escapeFileName(item.link ?? 'tool');
        downloadJson(fileName, json);
    }

    static closeStarDialog() {
        Flow.starDialog.classList.add('hide');
    }

    static openStarDialog() {
        const page = Flow.getPage();
        const url = getHashQueryVariable('url');
        const isLinked = getPathFromHash() == 'extern' && linkedPages.has(url);
        const linkedPage = linkedPages.get(url);

        Flow.starData.name = isLinked ? linkedPage.name : page.name ?? '';
        Flow.starData.link = page.link ?? '';
        Flow.starData.hasChanged = false;

        Flow.starData.linkedCheckbox.checked = isLinked;
        Flow.starData.autoRunCheckbox.checked = isLinked ? linkedPage.autoRun : !!page.autoRun;

        Flow.starData.nameInputElement.value = Flow.starData.name;
        Flow.starData.linkInputElement.value = Flow.starData.link;
        if (isLinked) Flow.starData.linkInputElement.classList.add('hide');
        else Flow.starData.linkInputElement.classList.remove('hide');
        Flow.starData.urlInputElement.value = getHashQueryVariable('url');
        if (isLinked) Flow.starData.urlInputElement.classList.remove('hide');
        else Flow.starData.urlInputElement.classList.add('hide');

        if (getPathFromHash() == 'extern') {
            Flow.starData.linkedToggleBar.checked = false;
            Flow.starData.linkedToggleBar.classList.remove('hide');
        } else {
            Flow.starData.linkedToggleBar.classList.add('hide');
        }

        Flow.updateSaveButton();

        Flow.starDialog.classList.remove('hide');
    }

    static saveStarSettings() {
        const page = Flow.getPage();
        const name = getPathFromHash();
        const url = getHashQueryVariable('url');
        const isLinked = name == 'extern' && linkedPages.has(url);
        const linked = Flow.starData.linkedCheckbox.checked;
        const autoRun = Flow.starData.autoRunCheckbox.checked;
        if (linked) {
            if (isLinked && url.trim() == '') {
                deleteLinkedPage(url);
            } else {
                addLinkedPage(Flow.starData.name, url, { autoRun });
                openPage('extern?url=' + url);
            }
        } else {
            if (specialFlowPages.has(name)) {
                if (Flow.starData.link.trim() != '') {
                    // Add bookmark
                    addLocalPage(Flow.starData.name, Flow.starData.link, page.code, { autoRun });
                    openPage("local/" + Flow.starData.link);
                }
            } else {
                if (Flow.starData.link.trim() == '') {
                    // Delete bookmark
                    deleteLocalPage(page);
                    openPage();
                } else if (Flow.starData.link == page.link) {
                    page.autoRun = autoRun;
                    updateLocalPage(page);
                } else {
                    // Move bookmark
                    page.name = Flow.starData.name;
                    page.autoRun = autoRun;
                    moveLocalPage(page, Flow.starData.link);
                    openPage("local/" + Flow.starData.link);
                }
            }
        }

        Flow.closeStarDialog();
    }

    static updateSaveButton() {
        const page = Flow.getPage();
        const name = getPathFromHash();
        const linked = Flow.starData.linkedCheckbox.checked;
        const autoRun = Flow.starData.autoRunCheckbox.checked;

        function enableSave() {
            Flow.starData.saveButton.removeAttribute('disabled');
            Flow.starData.saveButton.setAttribute('tooltip', 'Save changes');
        }

        function disableSave() {
            Flow.starData.saveButton.setAttribute('disabled', '');
            Flow.starData.saveButton.setAttribute('tooltip', 'No changes');
        }

        if (name == 'extern') {
            if (linked) {
                const newUrl = getHashQueryVariable('url');
                const linkedPage = linkedPages.get(newUrl);
                if (linkedPages.has(newUrl) && Flow.starData.name == linkedPage.name && !!linkedPage.autoRun == autoRun) {
                    disableSave();
                } else {
                    enableSave();
                }
            } else {
                if (Flow.starData.link.trim() == '') {
                    disableSave();
                } else {
                    enableSave();
                }
            }
        } else {
            if ((Flow.starData.link == page.link && Flow.starData.name == page.name && !!page.autoRun == autoRun) || (name == 'local' && Flow.starData.link.trim() == '')) {
                disableSave();
            } else {
                enableSave();
            }
        }
    }

    static setupStarDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        const contentElement = fromHTML(`<div class="dialogContent">`);

        const element = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const titleBar = fromHTML(`<div class="listContainerHorizontal">`);
        titleBar.appendChild(fromHTML(`<h1>Edit Bookmark`));
        element.appendChild(titleBar);
        element.appendChild(hb(7));

        // Star settings
        const starData = Flow.starData = {};
        const settingsElement = fromHTML(`<div class="listHorizontal">`);
        const fileNameElement = fromHTML(`<div>`);
        fileNameElement.textContent = 'Bookmark As:';
        settingsElement.appendChild(fileNameElement);

        // Linked toggle bar
        const linkedToggleBar = fromHTML(`<div class="listHorizontal">`);
        starData.linkedToggleBar = linkedToggleBar;
        const label = fromHTML(`<div>Link to External Url`);
        label.setAttribute('tooltip', `If checked, the script will be saved in a linked state, meaning you can't change it. In return, it is always updated to the latest version.`);
        linkedToggleBar.appendChild(label);
        const linkedCheckbox = fromHTML(`<input type="checkbox">`);
        starData.linkedCheckbox = linkedCheckbox;
        linkedToggleBar.appendChild(linkedCheckbox);
        element.appendChild(linkedToggleBar);

        // Name, url and link inputs
        const nameInputElement = fromHTML(`<input type="text" tooltip="Enter name. Discarded if link is empty." placeholder="Enter name here...">`);
        starData.nameInputElement = nameInputElement;
        settingsElement.appendChild(nameInputElement);
        const linkInputElement = fromHTML(`<input type="text" placeholder="Enter link here...">`);
        starData.linkInputElement = linkInputElement;
        const linkInputTooltip = `Enter link. An empty link will delete the bookmark. Please export code to json before deleting a bookmark. ` +
            `Using an existing link will override the existing one.`;
        linkInputElement.setAttribute('tooltip', linkInputTooltip);
        const urlInputElement = fromHTML(`<input type="text" tooltip="Enter an external url." class="hide" placeholder="Enter url here...">`);
        starData.urlInputElement = urlInputElement;
        linkedCheckbox.addEventListener('input', e => {
            if (linkedCheckbox.checked) {
                linkInputElement.classList.add('hide');
                urlInputElement.classList.remove('hide');
            } else {
                linkInputElement.classList.remove('hide');
                urlInputElement.classList.add('hide');
            }

            Flow.updateSaveButton();
        });

        nameInputElement.addEventListener('input', e => {
            Flow.starData.name = e.srcElement.value;
            if (Flow.starData.name.trim() == '') e.srcElement.value = Flow.starData.name = Flow.starData.link;
            else if (!Flow.starData.hasChanged) {
                linkInputElement.value = Flow.starData.link = escapeFileNameMinimal(Flow.starData.name);
            }

            Flow.updateSaveButton();
        });
        linkInputElement.addEventListener('input', e => {
            Flow.starData.link = e.srcElement.value;
            if (Flow.starData.link.trim() == '') {
                Flow.starData.hasChanged = false;
                nameInputElement.value = Flow.starData.name = '';
            } else if (Flow.starData.link != e.srcElement.value) {
                Flow.starData.hasChanged = true;
                Flow.starData.link = e.srcElement.value = escapeFileNameMinimal(e.srcElement.value);
                if (Flow.starData.name.trim() == '') nameInputElement.value = Flow.starData.name = Flow.starData.link;
            }

            Flow.updateSaveButton();
        });
        urlInputElement.addEventListener('input', e => Flow.updateSaveButton());

        settingsElement.appendChild(linkInputElement);
        settingsElement.appendChild(urlInputElement);
        element.appendChild(settingsElement);


        // Auto run toggle bar
        const autoRunToggleBar = fromHTML(`<div class="listHorizontal">`);
        starData.autoRunToggleBar = autoRunToggleBar;
        const autoRunLabel = fromHTML(`<div>Auto Run`);
        label.setAttribute('tooltip', `If checked, the sidebar link will open the script in run mode.`);
        autoRunToggleBar.appendChild(autoRunLabel);
        const autoRunCheckbox = fromHTML(`<input type="checkbox">`);
        starData.autoRunCheckbox = autoRunCheckbox;
        autoRunToggleBar.appendChild(autoRunCheckbox);
        element.appendChild(autoRunToggleBar);
        autoRunCheckbox.addEventListener('input', e => {
            Flow.updateSaveButton();
        });

        element.appendChild(hb(8));

        // Footer
        const footer = fromHTML(`<div class="listHorizontal">`);
        const cancelButton = fromHTML(`<button tooltip="Savely cancel any changes" class="w-100 largeElement complexButton flexFill dialogCloseButton">Cancel`);
        cancelButton.addEventListener('click', e => Flow.closeStarDialog());
        footer.appendChild(cancelButton);
        const saveButton = fromHTML(`<button tooltip="No changes" class="w-100 largeElement complexButton flexFill" disabled>Save`);
        saveButton.addEventListener('click', e => Flow.saveStarSettings());
        Flow.starData.saveButton = saveButton;
        footer.appendChild(saveButton);
        element.appendChild(footer);

        contentElement.appendChild(element);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);

        Flow.starDialog = dialogElement;
    }

    static setupOutputDialog() {
        const dialogsContainer = document.getElementById('dialogs');
        const dialogElement = fromHTML(`<div class="dialog hide">`);
        Flow.dialogOutputContainer = dialogElement;
        const contentElement = fromHTML(`<div class="dialogContent">`);
        const innerContentElement = fromHTML(`<div class="dialogInnerContent largeElement bordered grounded">`);
        const dialogOutputElement = fromHTML(`<div class="w-100 divList gap-4">`);
        Flow.dialogOutputElement = dialogOutputElement;
        innerContentElement.appendChild(dialogOutputElement);
        innerContentElement.appendChild(hb(4));
        const dialogFooter = fromHTML(`<div class="listHorizontal">`);
        Flow.dialogOutputFooter = dialogFooter;
        const cancelButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill">Cancel`);
        Flow.dialogOutputCancelButton = cancelButton;
        dialogFooter.appendChild(cancelButton);
        const acceptButton = fromHTML(`<button class="w-100 largeElement complexButton flexFill" disabled>Accept`);
        Flow.dialogOutputAcceptButton = acceptButton;
        dialogFooter.appendChild(acceptButton);
        innerContentElement.appendChild(dialogFooter);
        contentElement.appendChild(innerContentElement);
        dialogElement.appendChild(contentElement);
        const overlayElement = fromHTML(`<div class="dialogOverlay">`);
        Flow.dialogOutputOverlay = overlayElement;
        dialogElement.appendChild(overlayElement);
        dialogsContainer.appendChild(dialogElement);
    }

    static setupDialogs() {
        Flow.setupImportDialog();
        Flow.setupStarDialog();
        Flow.setupOutputDialog();
    }

    static adjustContentHeight() {
        const type = getPathPartFromHash(0);
        if ((
            (!Flow.codeEditor && (type == 'local')) ||
            (!Flow.externTargetElement && (type == 'extern'))) ||
            !flowPages.has(type)) return;

        const innerContainer = document.getElementById('pages');
        const stickyElement = innerContainer.querySelector('.sticky');
        const contentElement = type == 'extern' ? Flow.loadContainer : Flow.promptEditorContainerElement;
        const fillerElement = innerContainer.querySelector('.contentContainer');

        if (Flow.mode != Flow.editMode) {
            fillerElement.style.height = '';
            return;
        }

        const availableHeight = getScrollingElement().clientHeight - 16;
        const stickyHeight = stickyElement.offsetHeight;
        const contentHeight = contentElement?.offsetHeight ?? 0;
        const remainingHeight = availableHeight - stickyHeight - contentHeight;

        const newHeight = remainingHeight > 400 ? remainingHeight : 400;
        fillerElement.style.height = `${newHeight}px`;

        if (type == 'extern') {
            const codeBarHeight = Flow.externContainerElement.querySelector('.codeBar').clientHeight;
            const originalMaxHeight = Flow.externTargetElement.originalMaxHeight;
            const maxHeight = newHeight - codeBarHeight - 16;
            Flow.externTargetElement.maxHeight = originalMaxHeight == 0 ? originalMaxHeight : Math.min(originalMaxHeight, maxHeight);
            Flow.externTargetElement.update();
        } else {
            const codeBarHeight = Flow.codeEditorContainerElement.querySelector('.codeBar').clientHeight;
            const originalMaxHeight = Flow.codeEditor.originalMaxHeight;
            const maxHeight = newHeight - codeBarHeight - 16;
            Flow.codeEditor.maxHeight = originalMaxHeight == 0 ? originalMaxHeight : Math.min(originalMaxHeight, maxHeight);
            Flow.codeEditor.update();
        }


        doScrollTick();
    }
}

function getFlowPage() {
    const name = getPathFromHash();
    const page = Flow.getPage();
    let code = page.code;
    let prompt = page.prompt;
    const url = getHashQueryVariable('url');
    const isLinked = name == 'extern' && linkedPages.has(url);

    const elements = [];

    let mode = getHashQueryVariable('mode') ?? Flow.editMode;
    const locked = getHashQueryVariable('locked') ?? false;
    if (locked || name == 'help') mode = Flow.runMode;

    const sticky = fromHTML(`<div class="sticky flowStickyContainer">`); // Outline to overshadow input outlines
    const bar = fromHTML(`<div class="listContainerHorizontal">`);
    const leftBarList = fromHTML(`<div class="listHorizontal">`);
    bar.appendChild(leftBarList);

    if (!isUser && name != 'help') {
        // Top left buttons
        const importButton = fromHTML(`<button tooltip="Import Code from JSON" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        importButton.addEventListener('click', e => Flow.openImportDialog());
        importButton.appendChild(icons.upload());
        leftBarList.appendChild(importButton);
        const exportButton = fromHTML(`<button tooltip="Export Code to JSON" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        exportButton.addEventListener('click', e => Flow.export());
        exportButton.appendChild(icons.download());
        leftBarList.appendChild(exportButton);
        const starButton = fromHTML(`<button class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        starButton.setAttribute('tooltip', (specialFlowPages.has(name)) ? 'Bookmark for Easy Access' : 'Edit Bookmark');
        starButton.addEventListener('click', e => Flow.openStarDialog());
        const starIcon = (specialFlowPages.has(name) && !isLinked) ? icons.star() : icons.starFilled();
        starButton.appendChild(starIcon);
        leftBarList.appendChild(starButton);
        if (!locked) {
            const editButton = fromHTML(`<button tooltip="Edit Code" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
            editButton.addEventListener('click', e => Flow.edit());
            editButton.appendChild(icons.edit());
            if (mode == Flow.editMode) editButton.setAttribute('disabled', '');
            leftBarList.appendChild(editButton);
        }
        const runButton = fromHTML(`<button tooltip="Execute Code" class="largeElement dark-only-raised dark-only-hoverable light-only-complexButton">`);
        runButton.addEventListener('click', e => Flow.run());
        runButton.appendChild(icons.play());
        leftBarList.appendChild(runButton);
    }

    // Progress and status
    sticky.appendChild(bar);
    sticky.appendChild(hb(2));
    const progressBar = fromHTML(`<progress value="0" max="100" class="w-100 hide">`);
    Flow.progressBar = progressBar;
    sticky.appendChild(progressBar);
    const status = fromHTML(`<div class="info indented">Not running...`);
    Flow.statusElement = status;
    sticky.appendChild(status);
    sticky.appendChild(hb(1));

    // Sticky output
    const stickyOutputContainer = fromHTML(`<div class="hide">`);
    const stickyOutputElement = fromHTML(`<div>`);
    Flow.stickyOutputElement = stickyOutputElement;
    stickyOutputContainer.appendChild(stickyOutputElement);
    Flow.stickyOutputContainer = stickyOutputContainer;
    stickyOutputContainer.appendChild(hb(1));
    sticky.appendChild(stickyOutputContainer);
    elements.push(sticky);

    const newUrl = url ?? localStorage.getItem('externUrl');
    if (!url && newUrl && name == 'extern') Flow.updateUrl(newUrl);
    if (mode == Flow.editMode) {
        const loadContainer = fromHTML(`<div>`);
        Flow.loadContainer = loadContainer;
        // Extern url editor
        const urlEditorContainer = fromHTML(`<div class="contenteditableContainer">`);
        if (name != 'extern') urlEditorContainer.classList.add('hide');
        const urlEditor = fromHTML(`<div contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter url here...">`);
        urlEditor.textContent = newUrl;
        urlEditor.setAttribute('spellcheck', false);
        urlEditor.addEventListener('input', e => Flow.updateUrl(urlEditor.textContent));
        urlEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
        Flow.urlEditorElement = urlEditor;
        urlEditorContainer.appendChild(urlEditor);
        Flow.urlEditorContainerElement = urlEditorContainer;
        loadContainer.appendChild(urlEditorContainer);
        if (name == 'extern') loadContainer.appendChild(hb(2));
        const externTopList = fromHTML(`<div class="listContainerHorizontal">`);
        externTopList.appendChild(fromHTML(`<div>`));
        const rightExternTopList = fromHTML(`<div class="listHorizontal">`);

        // Load extern page button
        const loadButton = fromHTML(`<button class="largeElement complexButton">`);
        if (name != 'extern') loadButton.classList.add('hide');
        Flow.loadScriptButton = loadButton;
        const loadButtonList = fromHTML(`<div class="listHorizontal">`);
        const loadIcon = icons.download();
        loadIcon.classList.add('smallIcon');
        loadButtonList.appendChild(loadIcon);
        const loadButtonTextElement = fromHTML(`<div>Load Script`);
        loadButtonList.appendChild(loadButtonTextElement);
        loadButton.appendChild(loadButtonList);
        loadButton.addEventListener('click', e => Flow.loadScript());
        rightExternTopList.appendChild(loadButton);
        externTopList.appendChild(rightExternTopList);
        loadContainer.appendChild(externTopList);

        elements.push(loadContainer);
    }

    const contentContainer = fromHTML(`<div class="contentContainer">`);
    elements.push(contentContainer);
    if (mode == Flow.editMode) {
        // Code editor
        if (name != 'extern') {
            const codeEditorResult = CodeHelpers.createCodeEditor({
                content: code,
                onInput: Flow.onCodeInput,
                language: 'javascript',
                placeholder: "Enter code here...",
            });
            contentContainer.appendChild(codeEditorResult.codeEditorContainer);
            Flow.codeEditorContainerElement = codeEditorResult.codeEditorContainer;
            codeEditorResult.codeEditorPromise.then(e => {
                Flow.codeEditor = e;
                Flow.adjustContentHeight();
            });
            Flow.codeEditorPromise = codeEditorResult.codeEditorPromise;
        }

        // Stream target
        const streamContainerElement = fromHTML(`<pre class="largeElement codeBlock hide maxHeight-8 scroll-y">`);
        Flow.streamContainerElement = streamContainerElement;
        const streamTargetElement = fromHTML(`<code class="fixText language-javascript" placeholder="Loading...">`);
        Flow.streamTargetElement = streamTargetElement;
        streamContainerElement.appendChild(streamTargetElement);
        contentContainer.appendChild(streamContainerElement);
        contentContainer.appendChild(hb(4));

        // Extern target
        if (name == 'extern') {
            const externCode = (Flow.loadedExternPage?.url == newUrl && newUrl != null) ? Flow.loadedExternPage.code : '';
            const externCodeResult = CodeHelpers.createCodeEditor({
                content: externCode,
                readOnly: true,
                language: 'javascript',
            });
            if (name != 'extern' || Flow.loadedExternPage?.url != newUrl || newUrl == null) externCodeResult.codeEditorContainer.classList.add('hide');
            contentContainer.appendChild(externCodeResult.codeEditorContainer);
            Flow.externContainerElement = externCodeResult.codeEditorContainer;
            externCodeResult.codeEditorPromise.then(e => {
                Flow.externTargetElement = e;
                Flow.adjustContentHeight();
            });
            Flow.externCodeEditorPromise = externCodeResult.codeEditorPromise;
            contentContainer.appendChild(hb(4));
        }

        // Prompt editor
        if (name != 'extern') {
            const promptEditorResult = CodeHelpers.createCodeEditor({
                content: prompt,
                language: "Prompt",
                onInput: Flow.onPromptInput,
                text: true,
                placeholder: "Enter prompt here...",
            });
            const promptEditorContainer = Flow.promptEditorContainerElement = promptEditorResult.codeEditorContainer;
            promptEditorContainer.classList.add('promptContainer');
            if (settings.disableAI) promptEditorContainer.classList.add('hide');
            elements.push(promptEditorContainer);
            promptEditorResult.codeEditorPromise.then(e => {
                Flow.promptEditor = e;
                Flow.adjustContentHeight();
            });
            Flow.promptEditorPromise = promptEditorResult.codeEditorPromise;
            const footer = fromHTML(`<div class="listContainerHorizontal contenteditableContainerFooter">`);
            footer.appendChild(fromHTML(`<div>`));
            const rightFooterList = fromHTML(`<div class="listHorizontal">`);

            // Rewrite button
            const rewriteButton = fromHTML(`<button class="largeElement complexButton">`);
            Flow.rewriteScriptButton = rewriteButton;
            const rewriteButtonList = fromHTML(`<div class="listHorizontal">`);
            const rewriteIcon = icons.retry();
            rewriteIcon.classList.add('smallIcon');
            rewriteButtonList.appendChild(rewriteIcon);
            const rewriteButtonTextElement = fromHTML(`<div>`);
            rewriteButtonTextElement.textContent = "Rewrite Script";
            rewriteButtonList.appendChild(rewriteButtonTextElement);
            rewriteButton.appendChild(rewriteButtonList);
            rewriteButton.addEventListener('click', e => Flow.generateScript(true));
            rightFooterList.appendChild(rewriteButton);

            // Generate button
            const generateButton = fromHTML(`<button class="largeElement complexButton">`);
            Flow.generateScriptButton = generateButton;
            const generateButtonList = fromHTML(`<div class="listHorizontal">`);
            const sparklesIcon = icons.sparkles();
            sparklesIcon.classList.add('smallIcon');
            generateButtonList.appendChild(sparklesIcon);
            const generateButtonTextElement = fromHTML(`<div>`);
            generateButtonTextElement.textContent = "Generate Script";
            generateButtonList.appendChild(generateButtonTextElement);
            generateButton.appendChild(generateButtonList);
            generateButton.addEventListener('click', e => Flow.generateScript());
            rightFooterList.appendChild(generateButton);

            // Settings button
            const settingsButton = fromHTML(`<button class="largeElement complexButton">`);
            settingsButton.setAttribute('tooltip', 'Open chatbot settings');
            const settingsIcon = icons.settings();
            settingsIcon.classList.add('smallIcon');
            settingsButton.appendChild(settingsIcon);
            settingsButton.addEventListener('click', e => Settings.open(Settings.chatbotPage));
            rightFooterList.appendChild(settingsButton);

            footer.appendChild(rightFooterList);
            promptEditorContainer.appendChild(footer);
        }
    } else {
        // Output container
        const outputContainer = fromHTML(`<div class="divList gap-2">`);
        Flow.outputElement = outputContainer;
        outputContainer.textContent = Flow.noOutputMessage;
        contentContainer.appendChild(outputContainer);
    }

    if (name == 'extern' && Flow.loadedExternPage?.url != newUrl && newUrl) Flow.loadScript();
    else if (name == 'help') Flow.loadHelp();

    return elements;
}

window.addEventListener('pageloaded', e => Flow.onPageLoaded());
window.addEventListener('message', e => Flow.setupMessageChannel(e));


window.addEventListener('load', e => {
    new ResizeSensor(document.querySelector('.container'), e => Flow.adjustContentHeight());
});
window.addEventListener('resize', e => Flow.adjustContentHeight());
window.addEventListener('pageloaded', e => Flow.adjustContentHeight());

window.addEventListener('load', e => Flow.setupDialogs());