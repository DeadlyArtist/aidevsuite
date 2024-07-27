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
        response = await requireResponse(chatEventType, {context, options});
    } else {
        delete options.onUpdate;
        options.hasOnUpdate = true;
        response = await requireResponse(chatEventType, {context, options}, (content, event) => {
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
    static gpt4TurboName = "GPT-4 Turbo";
    static gpt4Name = "GPT-4";
    static gpt3_5TurboName = "GPT-3.5 Turbo";
    static llama3_1_70bName = "Llama 3.1 70b";
    static llama3_1_8bName = "Llama 3.1 8b";

    static gpt4OmniIdentifier = "gpt-4o";
    static gpt4OmniMiniIdentifier = "gpt-4o-mini";
    static gpt4TurboIdentifier = "gpt-4-turbo";
    static gpt4Identifier = "gpt-4";
    static gpt3_5TurboIdentifier = "gpt-3.5-turbo";
    static llama3_1_70bIdentifier = "llama-3.1-70b-versatile";
    static llama3_1_8bIdentifier = "llama-3.1-8b-instant";

    static chatModelNames = {
        [this.gpt4OmniIdentifier]: this.gpt4OmniName,
        [this.gpt4OmniMiniIdentifier]: this.gpt4OmniMiniName,
        [this.llama3_1_70bIdentifier]: this.llama3_1_70bName,
        [this.llama3_1_8bIdentifier]: this.llama3_1_8bName,
        [this.gpt4TurboIdentifier]: this.gpt4TurboName,
        [this.gpt4Identifier]: this.gpt4Name,
        [this.gpt3_5TurboIdentifier]: this.gpt3_5TurboName,
    }

    static chatModels = new Set(Object.keys(this.chatModelNames));

    static chatModelsThatAllowImages = new Set([
        this.gpt4OmniIdentifier,
        this.gpt4OmniMiniIdentifier,
        this.gpt4TurboIdentifier,
    ]);

    static async getAvailableModels() {
        return requireResponse(chatEventType, {get: 'availableModels'});
    }
}

function toMessage(role, prompt, url = null) {
    return {role, prompt, url};
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
    return {userRole, prompt: "", url};
}