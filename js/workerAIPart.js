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
    const onUpdate = options?.onUpdate;

    let response;
    if (onUpdate == null) {
        response = await requireResponse(chatEventType, { context, options });
    } else {
        delete options.onUpdate;
        options.hasOnUpdate = true;
        response = await requireResponse(chatEventType, { context, options }, (content, event) => {
            const transformed = onUpdate(content);
            postSuccessResponse(event, transformed);
        });
    }

    return response;
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
    static gpt4TurboName = "GPT-4 Turbo (Outdated)";
    static gpt4Name = "GPT-4 (Outdated)";
    static gpt3_5TurboName = "GPT-3.5 Turbo (Outdated)";
    static geminiExperimentalName = "Gemini Experimental";
    static gemini2_0FlashName = "Gemini 2.0 Flash";
    static gemini1_5ProName = "Gemini 1.5 Pro";
    static gemini1_5FlashName = "Gemini 1.5 Flash";
    static gemini1_5Flash8bName = "Gemini 1.5 Flash-8b";
    static llama3_3_70bName = "Llama 3.3 70b";
    static llama3_1_8bName = "Llama 3.1 8b";
    static claude3_5SonnetName = "Claude 3.5 Sonnet";
    static claude3_5HaikuName = "Claude 3.5 Haiku";

    static gpt4OmniIdentifier = "chatgpt-4o-latest";
    static gpt4OmniMiniIdentifier = "gpt-4o-mini";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";
    static geminiExperimentalIdentifier = "gemini-exp-1206";
    static gemini2_0FlashIdentifier = "gemini-2.0-flash-exp";
    static gemini1_5ProIdentifier = "gemini-1.5-pro-latest";
    static gemini1_5FlashIdentifier = "gemini-1.5-flash-latest";
    static gemini1_5Flash8bIdentifier = "gemini-1.5-flash-8b-latest";
    static llama3_3_70bIdentifier = "llama-3.3-70b-versatile";
    static llama3_1_8bIdentifier = "llama-3.1-8b-instant";
    static claude3_5SonnetIdentifier = "claude-3-5-sonnet-latest";
    static claude3_5HaikuIdentifier = "claude-3-5-haiku-latest";

    static chatModelNames = {
        [this.gpt4OmniIdentifier]: this.gpt4OmniName,
        [this.gpt4OmniMiniIdentifier]: this.gpt4OmniMiniName,
        [this.geminiExperimentalIdentifier]: this.geminiExperimentalName,
        [this.gemini2_0FlashIdentifier]: this.gemini2_0FlashName,
        [this.gemini1_5ProIdentifier]: this.gemini1_5ProName,
        [this.gemini1_5FlashIdentifier]: this.gemini1_5FlashName,
        [this.gemini1_5Flash8bIdentifier]: this.gemini1_5Flash8bName,
        [this.llama3_3_70bIdentifier]: this.llama3_3_70bName,
        [this.llama3_1_8bIdentifier]: this.llama3_1_8bName,
        [this.gpt4TurboIdentifier]: this.gpt4TurboName,
        [this.gpt4Identifier]: this.gpt4Name,
        [this.gpt3_5TurboIdentifier]: this.gpt3_5TurboName,
        [this.claude3_5SonnetIdentifier]: this.claude3_5SonnetName,
        [this.claude3_5HaikuIdentifier]: this.claude3_5HaikuName,
    }

    static chatModels = new Set(Object.keys(this.chatModelNames));

    static chatModelsThatAllowImages = new Set([
        this.gpt4OmniIdentifier,
        this.gpt4OmniMiniIdentifier,
        this.gpt4TurboIdentifier,
        this.geminiExperimentalIdentifier,
        this.gemini2_0FlashIdentifier,
        this.gemini1_5ProIdentifier,
        this.gemini1_5FlashIdentifier,
        this.gemini1_5Flash8bIdentifier,
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