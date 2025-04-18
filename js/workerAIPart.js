/**
 * This allows communicating with a chatbot. A chatbot always responds with markdown.
 * - **context** (array): A list of message objects.
 * - **options** (object): An object that can have the following properties:
 *     - **id** (string) [optional]: Allows streaming to an element. If streaming to an input, it will be disabled for user input while streaming. This only works on elements with a string value, such as text, caption, code etc..
 *     - **onUpdate** (function) [optional]: Allows streaming to a callback function. The function can optionally return a string to update the value to e.g. extract code blocks. The function takes in the following parameters:
 *         - **response** (string): The newly streamed tokens concatenated with the previous response text.
 *     - **model** (string) [optional]: The model to be used. Default is the best available.
 *     - **seed** (number) [optional]: The seed to be used. Very unreliable.
 *     - **jsonMode** (bool) [optional]: Whether to require valid json as output. Default is `false`.
 */
async function chat(context, options = null) {
    options ??= {};
    const onUpdate = options.onUpdate;

    let response;
    if (onUpdate == null) {
        response = await requireResponse(chatEventType, { context, options }, null, null, id => options.eventId = id);
    } else {
        delete options.onUpdate;
        options.hasOnUpdate = true;
        response = await requireResponse(chatEventType, { context, options }, (content, event) => {
            const transformed = onUpdate(content);
            postSuccessResponse(event, transformed);
        }, null, id => options.eventId = id);
    }

    return response;
}

async function stopStream(chatEventId) {
    return await requireResponse(chatEventType, { stop: chatEventId });
}

const systemRole = "system";
const userRole = "user";
const assistantRole = "assistant";

class ChatHelpers {
    static messageToString(message) {
        return message.role + ": " + message.content;
    }

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

    static chatModelNames = {
        [this.gpt4OmniIdentifier]: this.gpt4OmniName,
        [this.gpt4OmniMiniIdentifier]: this.gpt4OmniMiniName,
        [this.gemini2_5ProExperimentalIdentifier]: this.gemini2_5ProExperimentalName,
        [this.gemini2_5FlashPreviewIdentifier]: this.gemini2_5FlashPreviewName,
        [this.gemini2_0FlashIdentifier]: this.gemini2_0FlashName,
        [this.gemini2_0FlashLiteIdentifier]: this.gemini2_0FlashLiteName,
        [this.qwen_qwq32bIdentifier]: this.qwen_qwq32bName,
        [this.llama3_3_70bIdentifier]: this.llama3_3_70bName,
        [this.llama3_1_8bIdentifier]: this.llama3_1_8bName,
        [this.claude3_5SonnetIdentifier]: this.claude3_5SonnetName,
        [this.claude3_5HaikuIdentifier]: this.claude3_5HaikuName,
    }

    static chatModels = new Set(Object.keys(this.chatModelNames));

    static chatModelsThatAllowImages = new Set([
        this.gpt4OmniIdentifier,
        this.gpt4OmniMiniIdentifier,
        this.gemini2_5ProExperimentalIdentifier,
        this.gemini2_5FlashPreviewIdentifier,
        this.gemini2_0FlashIdentifier,
        this.gemini2_0FlashLiteIdentifier,
        this.claude3_5SonnetIdentifier,
        this.claude3_5HaikuIdentifier,
    ]);

    static async getAvailableModels() {
        return requireResponse(chatEventType, { get: 'availableModels' });
    }
}

function toMessage(role, prompt, url = null) {
    return { role, prompt, url };
}

function toSystemMessage(prompt) {
    return toMessage(systemRole, prompt);
}

/**
 * The image url is optional and only available for models that allow images.
 */
function toUserMessage(prompt, url = null) {
    return toMessage(userRole, prompt, url);
}

function toAssistantMessage(prompt) {
    return toMessage(assistantRole, prompt);
}

function toImageMessage(url) {
    return { userRole, prompt: "", url };
}

async function requireApiKey(model = null) {
    return await requireResponse(requireEventType, { apiKeyFor: model })
}