class ChatApi {
    static systemRole = "system";
    static userRole = "user";
    static assistantRole = "assistant";

    static toMessage(role, content) {
        return { role, content };
    }

    static toSystemMessage(prompt) {
        return ChatApi.toMessage(ChatApi.systemRole, prompt);
    }

    static toUserMessage(prompt) {
        return ChatApi.toMessage(ChatApi.userRole, prompt);
    }

    static toAssistantMessage(prompt) {
        return ChatApi.toMessage(ChatApi.assistantRole, prompt);
    }

    static toImageMessage(prompt, url) {
        return ChatApi.toMessage(ChatApi.userRole, [
            {
                "type": "text",
                "text": prompt
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": url
                },
            },
        ]);
    }

    static logMessage(message) {
        console.log(message.role + ":", message.content);
    }

    static gptEndpoint = "https://api.openai.com/v1/chat/completions";
    static googleEndpoint = "https://generativelanguage.googleapis.com/v1beta/chat/completions";
    static groqEndpoint = "https://api.groq.com/openai/v1/chat/completions";
    static anthropicEndpoint = "https://api.anthropic.com/v1/messages";

    static gpt4OmniName = "GPT-4 Omni";
    static gpt4OmniMiniName = "GPT-4 Omni Mini";
    static gemini2_5ProExperimentalName = "Gemini 2.5 Pro Experimental";
    static gemini2_5FlashPreviewName = "Gemini 2.5 Flash Preview";
    static gemini2_0FlashName = "Gemini 2.0 Flash";
    static gemini2_0FlashLiteName = "Gemini 2.0 Flash Lite";
    static qwen_qwq32bName = "QwQ 32b";
    static llama3_3_70bName = "Llama 3.3 70b";
    static llama3_1_8bName = "Llama 3.1 8b";
    static claude3_5SonnetName = "Claude 3.5 Sonnet";
    static claude3_5HaikuName = "Claude 3.5 Haiku";

    static gpt4OmniIdentifier = "chatgpt-4o-latest";
    static gpt4OmniMiniIdentifier = "gpt-4o-mini";
    static gemini2_5ProExperimentalIdentifier = "gemini-2.5-pro-exp-03-25";
    static gemini2_5FlashPreviewIdentifier = "gemini-2.5-flash-preview-04-17";
    static gemini2_0FlashIdentifier = "gemini-2.0-flash";
    static gemini2_0FlashLiteIdentifier = "gemini-2.0-flash-lite";
    static qwen_qwq32bIdentifier = "qwen-qwq-32b";
    static llama3_3_70bIdentifier = "llama-3.3-70b-versatile";
    static llama3_1_8bIdentifier = "llama-3.1-8b-instant";
    static claude3_5SonnetIdentifier = "claude-3-5-sonnet-latest";
    static claude3_5HaikuIdentifier = "claude-3-5-haiku-latest";

    static defaultGptModel = ChatApi.gpt4OmniIdentifier;
    static defaultGoogleModel = ChatApi.gemini2_5ProExperimentalIdentifier;
    static defaultGroqModel = ChatApi.qwen_qwq32bIdentifier;
    static defaultAnthropicModel = ChatApi.claude3_5SonnetIdentifier;

    static chatModelNames = {
        [ChatApi.gpt4OmniIdentifier]: ChatApi.gpt4OmniName,
        [ChatApi.gpt4OmniMiniIdentifier]: ChatApi.gpt4OmniMiniName,
        [ChatApi.gemini2_5ProExperimentalIdentifier]: ChatApi.gemini2_5ProExperimentalName,
        [ChatApi.gemini2_5FlashPreviewIdentifier]: ChatApi.gemini2_5FlashPreviewName,
        [ChatApi.gemini2_0FlashIdentifier]: ChatApi.gemini2_0FlashName,
        [ChatApi.gemini2_0FlashLiteIdentifier]: ChatApi.gemini2_0FlashLiteName,
        [ChatApi.qwen_qwq32bIdentifier]: ChatApi.qwen_qwq32bName,
        [ChatApi.llama3_3_70bIdentifier]: ChatApi.llama3_3_70bName,
        [ChatApi.llama3_1_8bIdentifier]: ChatApi.llama3_1_8bName,
        [ChatApi.claude3_5SonnetIdentifier]: ChatApi.claude3_5SonnetName,
        [ChatApi.claude3_5HaikuIdentifier]: ChatApi.claude3_5HaikuName,
    }

    static chatModels = new Set(Object.keys(ChatApi.chatModelNames));

    static chatModelsThatAllowImages = new Set([
        ChatApi.gpt4OmniIdentifier,
        ChatApi.gpt4OmniMiniIdentifier,
        ChatApi.claude3_5SonnetIdentifier,
        ChatApi.gemini2_5ProExperimentalIdentifier,
        ChatApi.gemini2_5FlashPreviewIdentifier,
        ChatApi.gemini2_0FlashIdentifier,
        ChatApi.gemini2_0FlashLiteIdentifier,
        ChatApi.claude3_5SonnetIdentifier,
        ChatApi.claude3_5HaikuIdentifier,
    ]);

    static gptModels = new Set([
        ChatApi.gpt4OmniIdentifier,
        ChatApi.gpt4OmniMiniIdentifier,
    ]);

    static googleModels = new Set([
        ChatApi.gemini2_5ProExperimentalIdentifier,
        ChatApi.gemini2_5FlashPreviewIdentifier,
        ChatApi.gemini2_0FlashIdentifier,
        ChatApi.gemini2_0FlashLiteIdentifier,
    ]);

    static groqModels = new Set([
        ChatApi.qwen_qwq32bIdentifier,
        ChatApi.llama3_3_70bIdentifier,
        ChatApi.llama3_1_8bIdentifier,
    ]);

    static anthropicModels = new Set([
        ChatApi.claude3_5SonnetIdentifier,
        ChatApi.claude3_5HaikuIdentifier,
    ]);

    static modelsThatCantCombineJsonAndStreaming = new Set([
        ...ChatApi.groqModels.values(),
    ]);

    static getModelName(model) {
        return ChatApi.chatModelNames.get(model) ?? ChatApi.chatModelNames.get(ChatApi.getDefaultModel());
    }

    static getDefaultModel() {
        if (settings.openAIApiKey) return ChatApi.defaultGptModel;
        else if (settings.googleApiKey) return ChatApi.defaultGoogleModel;
        else if (settings.anthropicApiKey) return ChatApi.defaultAnthropicModel;
        else if (settings.groqApiKey) return ChatApi.defaultGroqModel;
    }

    static getApiKey(model = null) {
        model ??= ChatApi.getDefaultModel();
        if (ChatApi.gptModels.has(model)) return settings.openAIApiKey;
        else if (ChatApi.googleModels.has(model)) return settings.googleApiKey;
        else if (ChatApi.anthropicModels.has(model)) return settings.anthropicApiKey;
        else if (ChatApi.groqModels.has(model)) return settings.groqApiKey;

        return null;
    }

    static authorizationAuthMethod = "authorizationAuthMethod";
    static xapikeyAuthMethod = "xapikeyAuthMethod";
    static getAuthMethod(model) {
        if (ChatApi.anthropicModels.has(model)) return ChatApi.xapikeyAuthMethod;

        return ChatApi.authorizationAuthMethod;
    }

    static getEndpoint(model) {
        if (ChatApi.gptModels.has(model)) return ChatApi.gptEndpoint;
        else if (ChatApi.googleModels.has(model)) return ChatApi.googleEndpoint;
        else if (ChatApi.anthropicModels.has(model)) return ChatApi.anthropicEndpoint;
        else if (ChatApi.groqModels.has(model)) return ChatApi.groqEndpoint;
    }

    static requiresProxy(model) {
        if (ChatApi.gptModels.has(model)) return false;
        else if (ChatApi.googleModels.has(model)) return true;
        else if (ChatApi.anthropicModels.has(model)) return true;
        else if (ChatApi.groqModels.has(model)) return false;

        return false;
    }

    static getMaxTokens(model) {
        if (ChatApi.groqModels.has(model)) return 8000;
        else if (model == ChatApi.gpt4OmniIdentifier) return 16384;
        else if (ChatApi.googleModels.has(model)) return 8192;
        else return 4096;
    }

    static getAvailableModels(hasProxy = false) {
        let models = [];
        if (settings.openAIApiKey) models = [...models, ...ChatApi.gptModels.values()];
        if (settings.googleApiKey) models = [...models, ...ChatApi.googleModels.values()];
        if (settings.groqApiKey) models = [...models, ...ChatApi.groqModels.values()];
        if (settings.anthropicApiKey) models = [...models, ...ChatApi.anthropicModels.values()];
        if (!hasProxy) models = models.filter(m => !ChatApi.requiresProxy(m));
        return models;
    }

    static getSortedModels(models = null) {
        models ??= [...ChatApi.chatModels.values()];
        const modelSet = new Set(models);
        let sortedModels = [];
        if (modelSet.delete(ChatApi.gpt4OmniIdentifier)) sortedModels.push(ChatApi.gpt4OmniIdentifier);
        if (modelSet.delete(ChatApi.gpt4OmniMiniIdentifier)) sortedModels.push(ChatApi.gpt4OmniMiniIdentifier);
        if (modelSet.delete(ChatApi.gemini2_5ProExperimentalIdentifier)) sortedModels.push(ChatApi.gemini2_5ProExperimentalIdentifier);
        if (modelSet.delete(ChatApi.gemini2_5FlashPreviewIdentifier)) sortedModels.push(ChatApi.gemini2_5FlashPreviewIdentifier);
        if (modelSet.delete(ChatApi.gemini2_0FlashIdentifier)) sortedModels.push(ChatApi.gemini2_0FlashIdentifier);
        if (modelSet.delete(ChatApi.gemini2_0FlashLiteIdentifier)) sortedModels.push(ChatApi.gemini2_0FlashLiteIdentifier);
        if (modelSet.delete(ChatApi.claude3_5SonnetIdentifier)) sortedModels.push(ChatApi.claude3_5SonnetIdentifier);
        if (modelSet.delete(ChatApi.claude3_5HaikuIdentifier)) sortedModels.push(ChatApi.claude3_5HaikuIdentifier);
        if (modelSet.delete(ChatApi.qwen_qwq32bIdentifier)) sortedModels.push(ChatApi.qwen_qwq32bIdentifier);
        if (modelSet.delete(ChatApi.llama3_3_70bIdentifier)) sortedModels.push(ChatApi.llama3_3_70bIdentifier);
        if (modelSet.delete(ChatApi.llama3_1_8bIdentifier)) sortedModels.push(ChatApi.llama3_1_8bIdentifier);
        sortedModels = [...sortedModels, ...modelSet.values()];
        return sortedModels;
    }

    static tryReplaceImagePrompts(messages, model) {
        if (ChatApi.chatModelsThatAllowImages.has(model)) return messages;

        const newMessages = [];
        messages.forEach(m => {
            if (Array.isArray(m.content)) {
                m.content = m.content[0].text;

                if (m.content) newMessages.push(m);
            } else {
                newMessages.push(m);
            }

        });

        return newMessages;
    }

    static async _internalGetChatResponse(messages, options = null) {
        options ??= {};
        const model = options.model ?? ChatApi.getDefaultModel();
        const apiKey = options.apiKey ?? ChatApi.getApiKey(model);
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');
        const endpoint = ChatApi.getEndpoint(model);
        if (!endpoint) throw new Error('Chat model is not supported.');
        let customFetch = options.fetchOverride ?? fetch;
        let authMethod = ChatApi.getAuthMethod(model);

        const messagesCopy = ChatApi.tryReplaceImagePrompts([...messages], model);

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? ChatApi.getMaxTokens(model),
            messages: messagesCopy,
        };
        if (options.seed != null) body.seed = options.seed;
        if (options.jsonMode == true) body.response_format = { "type": "json_object" };

        let headers = {
            'Content-Type': 'application/json',
        };
        if (authMethod == ChatApi.authorizationAuthMethod) headers.Authorization = 'Bearer ' + apiKey;
        else if (authMethod == ChatApi.xapikeyAuthMethod) headers["x-api-key"] = apiKey;

        let retries = 0;
        let maxRetries = options.maxRetries ?? 10;
        let lastError = null;
        while (true) {
            retries++;

            let json = null;
            let error = "";
            try {
                json = await customFetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body)
                }).then(response => response.json());
            } catch (e) {
                error = e.message;
                if (error === "Failed to fetch") {
                    retries -= 1;
                }
            }

            console.log("GPT Model used:", model);
            if (json && json['choices'] && json['choices'].length > 0) {
                console.log('Request:', messagesCopy);
                console.log('Response:', json);
                console.log('Response content:', json.choices[0].message.content);
                if (options.seed) {
                    console.log('Seed:', options.seed, 'Fingerprint:', json.system_fingerprint);
                }
                return { response: json.choices[0].message.content, finish_reason: json.finish_reason };
            }

            console.log("Json response:", json);
            console.log("Error message:", error);
            if (json?.error?.code && json.error.code === "rate_limit_exceeded") {
                retries -= 0.9;
            }
            let errorMessage = error.length > 0 ? error : json?.error?.code;
            console.warn('ChatApi.getChatResponse ERROR Try Again', retries, errorMessage);
            lastError = errorMessage;

            if (retries < maxRetries) {
                await sleep((retries + 1 + Math.random()) * 1000);
            } else throw lastError;
        }
    }

    /**
     * options:
     * model = null, seed = null, apiKey = null, continueAfterMaxTokens = true, maxTokens = null, jsonMode = false, fetchOverride = null
     *
     * Returns the full response string.
     */
    static async chat(messages, options = null) {
        options ??= {};
        options.continueAfterMaxTokens ??= true;


        const needsApiKey = ChatApi.getApiKey(options.model) == null;
        if (needsApiKey) await Settings.open();

        const messagesCopy = [...messages];
        let response;
        let result = '';
        do {
            response = await ChatApi._internalGetChatResponse(messages, options);
            result += response.response;
            messagesCopy.push(ChatApi.toAssistantMessage(response.response));
        } while (options.continueAfterMaxTokens && response.finish_reason == 'length');


        return result;
    }

    /**
     * options:
     * model = null, seed = null, apiKey = null, maxTokens = null, jsonMode = false, maxRetries = 10, fetchOverride = null
     */
    static async getChatStream(messages, options = null) {
        options ??= {};
        const model = options.model ?? ChatApi.getDefaultModel();
        const apiKey = options.apiKey ?? ChatApi.getApiKey(model);
        if (!apiKey) throw new Error('Required OpenAI Api Key was missing.');
        const endpoint = ChatApi.getEndpoint(model);
        if (!endpoint) throw new Error('Chat model is not supported.');
        let customFetch = options.fetchOverride ?? fetch;
        let authMethod = ChatApi.getAuthMethod(model);

        const messagesCopy = ChatApi.tryReplaceImagePrompts([...messages], model);

        let body = {
            model: model,
            max_tokens: options.maxTokens ?? ChatApi.getMaxTokens(model),
            messages: messagesCopy,
            stream: true
        };
        if (options.seed != null) body.seed = options.seed;
        if (options.jsonMode == true) body.response_format = { "type": "json_object" };

        let headers = {
            'Content-Type': 'application/json',
        };
        if (authMethod == ChatApi.authorizationAuthMethod) headers.Authorization = 'Bearer ' + apiKey;
        else if (authMethod == ChatApi.xapikeyAuthMethod) headers["x-api-key"] = apiKey;

        let retries = 0;
        let maxRetries = options.maxRetries ?? 10;
        let lastError = null;
        while (true) {
            retries++;

            let response = null;
            let error = "";
            try {
                response = await customFetch(endpoint, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(body),
                    stream: true,
                });
            } catch (e) {
                error = e.message;
                if (error === "Failed to fetch") {
                    retries -= 1;
                }
            }

            if (response?.ok) {
                const reader = response.body?.getReader();
                if (reader) return reader;

                error = "Error: fail to read data from response";
                console.error(error);
            } else {
                console.error(`Error: ${response?.statusText}`);
            }


            let errorMessage = error.length > 0 ? error : response?.statusText;
            console.warn('ChatApi.getChatResponse ERROR Try Again', retries, errorMessage);
            lastError = errorMessage;

            if (retries < maxRetries) {
                await sleep((retries + 1 + Math.random()) * 1000);
            } else throw lastError;
        }
    }

    /**
     * Fetches and reads a stream. The onUpdate parameter is a function that is called whenever the stream updates. This function has a string parameter of the updated full response string.
     *
     * options:
     * model = null, seed = null, apiKey = null, stopStream = false, continueAfterMaxTokens = true, maxTokens = null, jsonMode = false, maxRetries = 10, fetchOverride = null
     *
     * Returns the full response string.
     */
    static async streamChat(messages, onUpdate, options) {
        options ??= {};
        options.continueAfterMaxTokens ??= true;

        const needsApiKey = ChatApi.getApiKey(options.model) == null;
        if (needsApiKey) await Settings.open();

        const model = options.model ?? ChatApi.getDefaultModel();
        console.log("Chat Model:", model);

        let result = '';
        if (options.jsonMode && ChatApi.modelsThatCantCombineJsonAndStreaming.has(model)) {
            result = await ChatApi.chat(messages, options);
            await onUpdate(result);
            return result;
        } else {
            const messagesCopy = [...messages];
            let response;
            do {
                response = await ChatApi._internalStreamChat(messagesCopy, onUpdate, options);
                result = response.response;
                messagesCopy.push(ChatApi.toAssistantMessage(response.response));
            } while (options.continueAfterMaxTokens && response.finish_reason == 'length');
        }

        return result;
    }

    static async _internalStreamChat(messages, onUpdate, options, previousResponse = null) {
        options ??= {};
        let reader = await ChatApi.getChatStream(messages, options);

        let fullResponse = previousResponse ?? '';
        const textDecoder = new TextDecoder("utf-8");
        let buffer = "";
        let finish_reason = '';
        while (true) {
            if (options.stopStream) {
                options.stopStream = false;
                break;
            }

            let value, done;
            try {
                ({ value, done } = await reader.read());
            } catch (e) {
                console.log("Error reading stream:", e.message);
                if (e.message === "network error") {
                    await sleep((1 + Math.random()) * 1000);
                    reader = await ChatApi.getChatStream(messages, options);
                    fullResponse = previousResponse ?? '';
                    onUpdate('');
                    continue;
                } else {
                    break;
                }
            }
            if (done) break;

            const chunk = textDecoder.decode(value);
            for (const line of chunk.split("\n")) {
                if (options.stopStream) {
                    break;
                }

                const trimmedLine = line.trimStart();
                if (!trimmedLine || trimmedLine.startsWith("data: [DONE]")) {
                    continue;
                }

                const json = trimmedLine.replace("data: ", "");
                try {
                    let obj;
                    if (buffer === "") {
                        obj = JSON.parse(json);
                    } else {
                        try {
                            obj = JSON.parse(json);
                            if (!obj.choices) throw new Error();
                            if (buffer.trim() != "data:") console.warn("Failed resolving chunk split error. Skipped data:", buffer);
                        } catch (e) {
                            let fullData = buffer + json;
                            if (fullData.startsWith('data: ')) fullData = fullData.replace("data: ", "");
                            obj = JSON.parse(fullData);
                            //console.log("Successfully resolved chunk split error. Full data:", fullData);
                        }
                        buffer = "";
                    }

                    const content = obj.choices?.[0]?.delta?.content?.toString() ?? "";
                    finish_reason = obj.finish_reason;

                    fullResponse = fullResponse.concat(content);
                    try {
                        onUpdate(fullResponse);
                    } catch (e) {
                    }
                } catch (e) {
                    if (e.message.includes("JSON") && json != null) {
                        buffer += json;
                        //console.log("Chunk split error:", e.message, "For stream:", json);
                    } else {
                        console.warn("Error decoding stream:", e.message, "For stream:", json);
                    }

                    if (buffer.length > 1000000) {
                        options.stopStream = true;
                        console.warn("Buffer grew too large:", e.message);
                    }
                }
            }
        }

        console.log('Request:', messages);
        console.log('Response:', fullResponse);
        return { response: fullResponse, finish_reason };
    }
}
