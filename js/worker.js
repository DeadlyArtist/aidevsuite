const onEvent = new Map();
const onPingEvent = new Map();

// Event status types
const successStatus = 'successStatus';
const errorStatus = 'errorStatus';

// Event types
const logEventType = "logEventType";
const evalEventType = "evalEventType";
const loadEventType = "loadEventType";
const showEventType = "showEventType";
const readEventType = "readEventType";
const updateEventType = "updateEventType";
const removeEventType = "removeEventType";
const acceptEventType = "acceptEventType";
const validateInputEventType = "validateInputEventType";
const delayedValidateInputEventType = "delayedValidateInputEventType";
const noAcceptShownEventType = "noAcceptShownEventType";
const clickEventType = "clickEventType";
const chatEventType = "chatEventType";
const chatStreamEventType = "chatStreamEventType";
const fileDownloadEventType = "fileDownloadEventType";
const dataURLDownloadEventType = "dataURLDownloadEventType";
const setProgressEventType = "setProgressEventType";
const setStatusEventType = "setStatusEventType";
const storageEventType = "storageEventType";
const urlEventType = "urlEventType";
const fetchInternalEventType = "fetchInternalEventType";
const proxyEventType = "proxyEventType";
const requireEventType = "requireEventType";

// Element types
const breakType = "breakType";
const rulerType = "rulerType";
const emptyType = "emptyType";
const markdownType = "markdownType"; // Includes Katex math parser.

const paragraphType = "paragraphType";
const titleType = "titleType";
const subTitleType = "subTitleType";
const infoType = "infoType";
const codeType = "codeType";
const htmlType = "htmlType";
const imageType = "imageType";
const iconType = "iconType";

// Icon types
const materialIconProvider = "materialIconProvider";
const heroIconProvider = "heroIconProvider";

// Container element types
const verticalType = "verticalType"; // Use this to group multiple elements without any effect on their appearance.
const barType = "barType"; // Use this to group multiple elements horizontally.
const buttonType = "buttonType";

// Bar sub types
const navBarType = "navBarType";
const listBarType = "listBarType";

// Button sub types
const simpleButtonType = "simpleButtonType";
const complexButtonType = "complexButtonType";

// Input element types
const textInputType = "textInputType";
const numberInputType = "numberInputType";
const passwordInputType = "passwordInputType";
const codeInputType = "codeInputType";
const markdownInputType = "markdownInputType";
const checkboxInputType = "checkboxInputType";
const selectInputType = "selectInputType";
const imageInputType = "imageInputType";
const pasteInputType = "pasteInputType";
const fileInputType = "fileInputType";

// Element type sets
const allTypes = new Set([
    breakType,
    rulerType,
    emptyType,
    markdownType,
    paragraphType,
    titleType,
    subTitleType,
    infoType,
    codeType,
    htmlType,
    imageType,
    iconType,
    barType,
    verticalType,
    buttonType,
    textInputType,
    numberInputType,
    passwordInputType,
    codeInputType,
    markdownInputType,
    checkboxInputType,
    selectInputType,
    pasteInputType,
    fileInputType,
]);

const containerTypes = new Set([
    verticalType,
    barType,
    buttonType,
]);

const textTypes = new Set([
    paragraphType,
    titleType,
    subTitleType,
    infoType,
]);

const inputTypes = new Set([
    textInputType,
    numberInputType,
    passwordInputType,
    codeInputType,
    markdownInputType,
    checkboxInputType,
    selectInputType,
    imageInputType,
    pasteInputType,
    fileInputType,
]);


// Paste item types
const htmlPasteItemType = "html";
const textPasteItemType = "text";
const rtfPasteItemType = "rtf";
const filesPasteItemType = "files";

// Group locations
const mainLocation = "main";
const stickyLocation = "sticky";
const dialogLocation = "dialog";

// Helper functions
function generateUniqueId() {
    return Date.now() + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
}

// If you show stuff with `noAccept`, there's a very high chance you will want to await this at the end of your script.
async function forever() {
    await new Promise(() => {
    });
    log('This will never run!');
}

// Event logic to communicate with origin
function postRequest(type, content = null, id = null, pingId = null, pingSourceEvent = null) {
    postMessage({ id, pingId, pingSourceId: pingSourceEvent?.pingId, type, content });
}

function postSuccessResponse(requestEvent, content = null, message = null) {
    postMessage({
        id: requestEvent.id,
        type: requestEvent.type,
        response: true,
        status: successStatus,
        content,
        message
    });
}

function postErrorResponse(requestEvent, message, content = null) {
    postMessage({ id: requestEvent.id, type: requestEvent.type, response: true, status: errorStatus, content, message });
}

function postIFrameMessage(type, content = null) {
    postMessage({ iframe: true, type, content });
}

function requireResponse(type, content = null, onPing = null, pingSourceEvent = null, eventIdRetriever = null) {
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        if (eventIdRetriever != null) eventIdRetriever(id);
        let pingId = null;
        if (onPing != null) {
            pingId = generateUniqueId();
            onPingEvent.set(pingId, async (event) => {
                try {
                    const result = await onPing(event.content, event);
                    postSuccessResponse(event, result);
                } catch (e) {
                    postErrorResponse(event, e);
                }
            });
        }

        onEvent.set(id, (event) => {
            onEvent.delete(id);
            if (pingId != null) onPingEvent.delete(pingId);

            if (event.status === errorStatus) reject(new Error(event.message));
            else resolve(event.content);
        });

        postRequest(type, content, id, pingId, pingSourceEvent);
    });
}

function createObjectUrl(object, options) {
    const blob = new Blob([object], options);
    const blobUrl = URL.createObjectURL(blob);
    postIFrameMessage('url', blobUrl);
    return blobUrl;
}

const __importCallbacks = new Map();
const __importErrorCallbacks = new Map();

/**
 * You probably don't want to use this.
 */
function importCode(code) {
    return new Promise((resolve, reject) => {
        const id = generateUniqueId();
        const blobUrl = createObjectUrl(`async function _____outerImportWrapper_____() {async function _____importWrapper_____() {\n\n\n/* Script starts here */\n${code}\n/* Script ends here */\n\n\n}\ntry{\nawait _____importWrapper_____();\n__importCallbacks.get("${id}")();}\ncatch(e) {\n__importErrorCallbacks.get("${id}")(e);\n}\n}\n_____outerImportWrapper_____();`, { type: commonMimeTypes.javascript });
        __importCallbacks.set(id, () => resolve());
        __importErrorCallbacks.set(id, e => reject(e));
        importScripts(blobUrl); // Evaluate the incoming code
    });
}

async function log(...data) {
    return await requireResponse(logEventType, JSON.stringify(data));
}

async function onEvalRequest(e) {
    // Important: Your code will be evaluated in here. The moment it ends, the worker will be terminated and callbacks like button `onClick` cease to work. To never terminate, await `forever` at the end of the script.
    await importCode(e.content.code);
    postSuccessResponse(e);
}

onmessage = async function (e) {
    if (e.data.source != 'origin') return;

    const data = e.data.message;
    if (data.type !== logEventType) await log("Origin Message Received:", data);

    try {
        if (onEvent.has(data.id)) {
            onEvent.get(data.id)(data);
        } else if (onPingEvent.has(data.pingSourceId)) {
            onPingEvent.get(data.pingSourceId)(data);
        } else if (data.type === evalEventType) {
            await onEvalRequest(data);
        }
    } catch (error) {
        postErrorResponse(data, error);
        throw error;
    }
};

/**
 * Load and execute a script from a url.
 */
async function load(url) {
    const result = await requireResponse(loadEventType, url);
    return await importCode(result);
}

/**
 * Create elements using various create functions. The `options` parameter of any elements can additionally take the following properties:
 * - **id** (string) [optional]: Allows overwriting the randomly generated id. Use very carefully.
 * - **bordered** (bool) [optional]: Whether to add a border around them.
 * - **breakBefore** (number) [optional]: Adds a break before with the value as its size. Must be between 0 and 8. Default is `0`.
 * - **breakAfter** (number) [optional]: Adds a break after with the value as its size. Must be between 0 and 8. Default is `0`.
 * - **hide** (bool) [optional]: This can be useful when smoothly wanting to add to elements of containers without recreating the entire container, as they can't be added via `update`. Default is `false`.
 * - **stretch** (bool) [optional]: Whether the element should try to maximize its width.
 * - **leftElements** (array) [optional]: An array of small elements to float to the left of an element.
 * - **rightElements** (array) [optional]: An array of small elements to float to the right of an element.
 */

/**
 * Creates a break. Not really necessary due to the default `gap`s.
 *
 * - **size** (number) [optional]: How large the break is. Must be between 1 and 8.
 */
function createBreak(size, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: breakType,
        size,
        options,
    };
    return content;
}

/**
 * Creates a ruler (hr).
 * - **options** (object) [optional]: An object that can have the following properties:
 *     - **vertical** (bool) [optional]: Whether the ruler should be vertical. This is useful for bars.
 */
function createRuler(options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: rulerType,
        options,
    };
    return content;
}

// Create empty placeholder elements. Can for use in navBarLists, as they use `justify-content: space-between;`.
function createEmpty(options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: emptyType,
        options,
    };
    return content;
}

// Use as an invisible anchor for `insertBefore` and `insertAfter`.
function createAnchor(options = null) {
    options ??= {};
    options.hide = true;
    return createEmpty(options);
}

/**
 * - **type** (string): Specifies the type of element. All `textTypes` are supported.
 * - **options** (object): An object that can have the following properties depending on its `type`:
 *
 * ## All Types
 * - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 * - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the text is empty.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 *
 * ## `infoType`
 * - **mode** (string) [optional]: Whether to highlight the text in a special way. Valid values are:
 *     - `"danger"`
 *     - `"warning"`
 *     - `"success"`
 */
function createText(type, text, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type,
        text,
        options,
    };
    return content;
}

function createParagraph(text, options = null) {
    return createText(paragraphType, text, options);
}

function createTitle(text, options = null) {
    return createText(titleType, text, options);
}

function createSubTitle(text, options = null) {
    return createText(subTitleType, text, options);
}

function createInfo(text, options = null) {
    return createText(infoType, text, options);
}


/**
 * - **options** (object): An object that can have the following properties:
 *     - **language** (string) [optional]: The language of the code.
 *     - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 *     - **placeholder** (string) [optional]: The placeholder text that appears when the code is empty.
 *     - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 */
function createCode(code, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: codeType,
        code,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **placeholder** (string) [optional]: The placeholder text that appears when the markdown is empty.
 *     - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 *     - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 *     - **katexDelimiters** (array) [optional]: The delimiters to use to find find math equations. Default:
 *         [
 *             {left: "$$", right: "$$", display: true},
 *             {left: "\\(", right: "\\)", display: false},
 *             {left: "$", right: "$", display: false} // Uses special rules to prevent normal text from being ruined
 *             {left: "\\begin{equation}", right: "\\end{equation}", display: true},
 *             {left: "\\begin{align}", right: "\\end{align}", display: true},
 *             {left: "\\begin{alignat}", right: "\\end{alignat}", display: true},
 *             {left: "\\begin{gather}", right: "\\end{gather}", display: true},
 *             {left: "\\begin{CD}", right: "\\end{CD}", display: true},
 *             {left: "\\[", right: "\\]", display: true},
 ]
 */
function createMarkdown(markdown, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: markdownType,
        markdown,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **allowScripts** (bool) [optional]: Whether to allow scripts. Default is `true`, as the html is sandboxed anyways.
 *     - **placeholder** (string) [optional]: The placeholder text that appears when the code is empty.
 *     - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 */
function createHtml(html, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: htmlType,
        html,
        options,
    };
    return content;
}

/**
 * - **options** (object): An object that can have the following properties:
 *     - **caption** (string) [optional]: The caption for the image.
 *     - **title** (string) [optional]: The title to be shown on hover.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 *     - **imageMaxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 *     - **captionMaxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 */
function createImage(url, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: imageType,
        url,
        options,
    };
    return content;
}

/**
 * ## Parameters
 * - **ds** (array of strings or a string): If it is an array, it creates a path element for each d. If it is a string, it uses predefined paths. *Only* the following string values are supported (Do not use any other string values): `"close"`, `"expandMore"`, `"expandLess"`, `"menu"`, `"menuClose"`, `"menuHorizontal"`, `"download"`, `"upload"`, `"lock"`, `"noLock"`, `"edit"`, `"noEdit"`, `"delete"`, `"highlight"`, `"highlightOff"`, `"play"`, `"settings"`, `"sparkles"`, `"star"`, `"starFilled"`, `"copy"`, `"user"`, `"cpu"`, `"link"`, `"dollar"`, `"at"`, `"photo"`, `"retry"`, `"undo"`, `"redo"`.
 * - **iconProvider** (string): The type of the icon. Can be null if `ds` is a string. Supported values are:
 *     - `materialIconProvider`
 *     - `heroIconProvider`
 * - **options** (object): An object that can have the following properties:
 *     - **title** (string) [optional]: The title to be shown on hover.
 *     - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 */
function createIcon(ds, iconProvider, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: iconType,
        ds,
        iconProvider,
        options,
    };
    return content;
}

function createPresetIcon(name, options = null) {
    return createIcon(name, null, options);
}

/**
 * ## Parameters
 * - **type** (string): Specifies the type of the container. All `containerTypes` are supported. Use `verticalType` for simple grouping of elements without any effect on their appearance.
 * - **elements** (object or array): A single element or a list of elements displayed within the container. Please do not put buttons or interactables within buttons.
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 *
 * ## Options Configuration by Container Type
 * ### All Types
 * - **gap** (number) [optional]: The gap between elements. Must be between `0` and `8`. Default is `4`.
 * - **title** (string) [optional]: The title to be shown on hover. *Only* use for small labels with size constraints.
 * - **useTooltipInstead** (bool) [optional]: Whether to show the title using a custom tooltip instead of the inbuilt title property. Default is `true`.
 *
 * ### `verticalType`
 * - **centered** (bool) [optional]: Whether the items should be centered. Default is `false`.
 *
 * ### `barType`
 * - **barSubType** (string) [optional]: The type of the bar or list. Default is `navBarType`. Supported values are:
 *     - `navBarType` // Uses `justify-content: space-between;`, works well with `emptyType` elements. E.g. a navBar with an emptyElement and a button will cause the button to float right.
 *     - `listBarType` // Normal wrapping list. You can use `stretch` on its children to fill the available width.
 * - **centered** (bool) [optional]: Whether the items should be centered. Default is `false`.
 *
 * ### `buttonType`
 * - **buttonSubType** (string) [optional]: Specifies the type of the button. Default is `complexButtonType`. Supported values are:
 *     - `simpleButtonType` // *Only* use this for small buttons that should blend in, such as an X to close a dialog.
 *     - `complexButtonType` // Use this for buttons that should be strongly visible, such as a Save or Cancel button.
 * - **onClick** (function): A callback function that is called whenever the button is clicked. It has neither parameters nor a return value.
 * - **fullWidth** (bool) [optional]: Whether its width should be stretched to 100%. Default is `false`.
 * - **disabled** (bool) [optional]: Whether the button is disabled. Default is `false`.
 * - **closeDialogOnClick** (bool) [optional]: Whether to close the current dialog on click. This is exclusive to dialogs with `noAccept`. Default is `false`.
 */
function createContainer(type, elements, options = null) {
    options ??= {};
    const content = {
        id: options?.id ?? generateUniqueId(),
        type,
        elements: Array.isArray(elements) ? elements : [elements],
        options,
    };
    return content;
}

/**
 * Use this for grouping element(s) without affecting their appearance.
 */
function createGroup(elements, options = null) {
    return createContainer(verticalType, elements, options);
}

function createCenteredGroup(elements, options = null) {
    options ??= {};
    options.centered = true;
    return createContainer(verticalType, elements, options);
}

function createNavBar(elements, options = null) {
    return createContainer(barType, elements, options);
}

function createHorizontalList(elements, options = null) {
    options ??= {};
    options.barSubType = listBarType;
    return createContainer(barType, elements, options);
}

/**
 * Use this to cause elements to float to the right.
 */
function createFloatRightWrapper(element, options = null) {
    return createContainer(barType, [createEmpty(), element], options);
}

function createButton(elements, onClick, options = null) {
    options ??= {};
    options.onClick = onClick;
    return createContainer(buttonType, elements, options);
}

function createSimpleButton(elements, onClick, options = null) {
    options ??= {};
    options.buttonSubType = simpleButtonType;
    options.onClick = onClick;
    return createContainer(buttonType, elements, options);
}

/**
 * Creates an input. After an shown input is accepted, it is automatically converted into its non input counterpart for the user to review. To stop this, you must `remove` the element.
 *
 * ## Parameters
 * - **type** (string): Specifies the type of input. All `inputTypes` are supported.
 * - **options** (object): An object that contains various options specific to the `type` of input. The options available depend on the input type.
 *
 * ## Options Configuration by Input Type
 *
 * ### All Types
 * - **disabled** (bool) [optional]: Whether user input is disabled. Default is `false`.
 *
 * ### All Input Types
 * - **onValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called whenever the value of an input changes, including directly after the element is first shown. Its parameters are allInputs, input. No return value means the current input is valid. To invalidate, the return value of onValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 * - **onDelayedValidate** (function) [optional]: A callback function that can be used for custom validation logic. It is called only when a user wants to accept input. This doesn't work in combination with `noAccept`. Its parameters are group, element. No return value means the current input is valid. To invalidate, the return value of onDelayedValidate must be an object with the following properties:
 *     - **valid** (bool): Whether the value is valid.
 *     - **message** (string) [optional]: An error message. Defaults to `'Invalid value. Please choose a different value.'`.
 *
 * ### `textInputType`
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter text here..."`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * - **minimal** (bool) [optional]: Whether to show a minimal text editor instead of Monaco. Default is `false`.
 *
 * ### `numberInputType`
 * - **defaultValue** (number) [optional]: The default number value for the input. Default is `0`.
 *
 * ### `passwordInputType`
 * - **defaultValue** (string) [optional]: The default text value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter password here..."`.
 *
 * ### `codeInputType`
 * - **defaultValue** (string) [optional]: The default code value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter code here..."`.
 * - **language** (string) [optional]: The language of the code.
 * - **context** (string) [optional]: Information about the context in which the code will be executed. Allows better integration with chatbots.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 *
 * ### `markdownInputType`
 * - **defaultValue** (string) [optional]: The default code value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter markdown here..."`.
 * - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 * - **katexDelimiters** (array) [optional]: The delimiters to use to find find math equations. Default: Same as for `createText`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 *
 * ### `checkboxInputType`
 * - **defaultValue** (number) [optional]: The default bool value for the input. Default is false.
 * - **description** (string) [optional]: A short description to the left of the checkbox. Default is an empty string `''`.
 *
 * ### `selectInputType`
 * - **defaultValue** (number) [optional]: The default number value for the input. Default is the value of the first choice.
 * - **choices** (array): An array of option objects that have the following properties.
 *     - **value** (string) [optional]: The value of the option. Default is its index.
 *     - **name** (string) [optional]: The name of the option. Default is its value.
 *
 * ### `imageInputType`
 * - **defaultValue** (string) [optional]: The default url value for the input. Default is an empty string `''`.
 * - **placeholder** (string) [optional]: The placeholder text that appears when the input is empty. Default is `"Enter image here..."`.
 * - **editableCaption** (bool) [optional]: Whether the caption can be edited. Default is false.
 * - **defaultCaptionValue** (string) [optional]: The default caption value for the input. Default is an empty string `''`.
 * - **captionPlaceholder** (string) [optional]: The placeholder text that appears when the caption input is empty. Default is `"Enter caption here..."`.
 * - **maxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * - **captionMaxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `6`.
 * - **imageMaxHeight** (number) [optional]: Must be between `0` and `8`. For no max height use `0`. Default is `0`.
 * - **allowImagePasting** (bool) [optional]: Whether the user can paste an image as dataURL. Default is `true`.
 *
 * ### `fileInputType`
 * - **allowedMimeTypes** (array of strings) [optional]: Specifies the mime types (e.g application/json) that are allowed. Wildcards are supported. Default is an empty array `[]`.
 * - **allowedExtensions** (array of strings) [optional]: Specifies the file extensions (e.g .json) that are allowed. Default is an empty array `[]`.
 * - **dropDescription** (string) [optional]: Description text for the drag-and-drop area. Default is `"Drag and drop valid files (any type)."` if `allowedExtensions` is empty, or will list the allowed file types.
 * - **selectDescription** (string) [optional]: Description text for the file selection area. Default is `"Or select files"`.
 * - **noFileSelectedMessage** (string) [optional]: Shown when no file is selected. Default is `"No file selected."`.
 * - **multiple** (boolean) [optional]: Specifies whether multiple file selection is allowed. Default is `false`.
 * - **maxSize** (number) [optional]: Specifies the maximum size (in bytes) for the file upload.
 *
 * ### `pasteInputType`
 * - **emptyDescription** (string) [optional]: Description text when nothing has been pasted. Default is `'Paste (STRG + V) into here to continue.'`.
 * - **replaceDescription** (string) [optional]: Description text when something has been pasted. Default is `Successfully pasted. Paste (STRG + V) into here to change its content.`.
 *
 * ## Returns
 * A content object for the `show` function.
 * */
function createInput(type, options = null) {
    const content = {
        id: options?.id ?? generateUniqueId(),
        type: type,
        options: options,
    };

    return content;
}

function _extractElements(group) {
    const elements = [];
    let unprocessedElements = [group];
    if (group.acceptButtonContent != null) unprocessedElements = unprocessedElements.concat(group.acceptButtonContent);
    while (unprocessedElements.length != 0) {
        let newUnprocessedElements = [];
        for (let element of unprocessedElements) {
            if (containerTypes.has(element.type)) newUnprocessedElements = newUnprocessedElements.concat(element.elements);
            if (element.options?.leftElements != null) newUnprocessedElements = newUnprocessedElements.concat(element.options.leftElements);
            if (element.options?.rightElements != null) newUnprocessedElements = newUnprocessedElements.concat(element.options.rightElements);
            elements.push(element);
        }
        unprocessedElements = newUnprocessedElements;
    }
    return elements;
}

function _mapElements(elements) {
    const mapped = {};
    for (let element of elements) {
        mapped[element.id] = element;
    }
    return mapped;
}

/**
 * The element parameter should be created via any of the create functions.
 * For showing multiple elements at once, use a container element.
 * Important: The returned objects are deep copies. They are not updated on input. The updated values must be fetched either via the `onValidate` callback or the `read` function.
 *
 * ## Parameters
 * - **element** (object): The `element` parameter accepts an element created via any of the create functions.
 * - **options** (object) [optional]: An object that can have the following properties:
 *     - **acceptButtonContent** (object) [optional]: An element to be shown within the default accept button. Default is a paragraph with `Accept`.
 *     - **noAccept** (bool) [optional]: Whether the input can be accepted via a default accept button. If an input can be accepted multiple times, add a custom button that uses the `read` function to read the input values `onClick`. If you add your own custom accept button (instead of modifying `acceptButtonContent`), you must set this to true. If you show an input and do not use the result, you probably want to set this to true. Default is `false`.
 *     - **location** (string) [optional]: The location of element. Default is `mainLocation`. The following values are supported:
 *         - `mainLocation`: The default location.
 *         - `stickyLocation`: The element will stick to the top of the page.
 *         - `dialogLocation`: The element will be shown as a dialog. It is recommended to start the element with a title. Only one dialog can be shown at a time, which is why `noAccept` is discouraged on a dialog. Removing a dialog element will close the dialog. A dialog element is automatically `remove`d after the user closes (noAccept == true only), cancels (noAccept == false only) or accepts (noAccept == false only) it. This will be awaited. Returns error response on cancel.
 *     - **insertAt** (number) [optional]: Where to insert. This allows negative indices. The default is `-1`.
 *     - **insertBefore** (string) [optional]: `id` of the top level element to insert before.
 *     - **insertAfter** (string) [optional]: `id` of the top level element to insert after.
 *     - **deleteAfter** (number) [optional]: How many to delete after this. The default is `0`.
 *     - **deleteBefore** (number) [optional]: How many to delete before this. The default is `0`.
 *     - **noCloseOnOverlay** (bool) [optional]: This is exclusive to dialogs with `noAccept == true`. This requires implementing custom closing logic. Default is `false`.
 *
 * ## Return value when awaited
 *  When this function is awaited, it waits until it the user presses the accept button, or the `accept` function is called on the input. If `noAccept == true`, awaiting it returns an async function that resolves when `accept` is called. Then it returns an object that contains each input element (only input elements), including all nested input elements, from the element parameter with their id as a key. If there is only a single input element, then the element is returned directly instead of as part of an object. If there is no input element, null is returned. Each returned element is an object with the following properties.
 *
 * ### For `textInputType`
 * - **text** (string): The text value of the input.
 *
 * ### For `codeInputType`
 * - **code** (string): The code value of the input.
 *
 * ### For `markdownInputType`
 * - **markdown** (string): The markdown value of the input.
 *
 * ### For `numberInputType`
 * - **number** (number): The number value of the input.
 *
 * ### For `passwordInputType`
 * - **password** (string): The password value of the input.
 *
 * ### For `checkboxInputType`
 * - **checked** (bool): Whether the checkbox was checked.
 *
 * ### For `selectInputType`
 * - **value** (string): The selected value.
 *
 * ### For `imageInputType`
 * - **url** (string): The url value of the input.
 * - **caption** (string): The caption value of the input.
 *
 * ### For `fileInputType`
 * - **files** (array): List of objects with the following properties:
 *     - **name** (string): The name of the file.
 *     - **size** (number): The size of the file in bytes.
 *     - **type** (string): The MIME type of the file.
 *     - **lastModified** (number): The last modified timestamp of the file.
 *     - **lastModifiedDate** (Date): The last modified date of the file.
 *     - **text** (string): The text content of the file. This is a STRING! DONT AWAIT OR CALL IT!
 *     - **dataURL** (string): The Data URL of the file. This is a STRING! DONT AWAIT OR CALL IT!
 *
 * ### For `pasteInputType`
 * - **html** (string): The html value of the input.
 * - **text** (string): The text value of the input.
 * - **rtf** (string): The rtf value of the input.
 * - **files** (array): List of objects with the following properties:
 *     - **name** (string): The name of the file.
 *     - **size** (number): The size of the file in bytes.
 *     - **type** (string): The MIME type of the file.
 *     - **lastModified** (number): The last modified timestamp of the file.
 *     - **lastModifiedDate** (Date): The last modified date of the file.
 *     - **text** (string): The text content extracted from the file. This is a STRING! DONT AWAIT OR CALL IT!
 *     - **dataURL** (string): The Data URL extracted from the file. This is a STRING! DONT AWAIT OR CALL IT!
 * */
async function show(element, options = null) {
    options ??= {};
    const onValidateMap = new Map();
    const onDelayedValidateMap = new Map();
    const onClickMap = new Map();
    const elements = _extractElements(element);
    const inputs = elements.filter(e => inputTypes.has(e.type));

    for (let [index, element] of elements.entries()) {
        element.options ??= {};

        if (element.options?.onValidate != null) {
            const onValidate = element.options.onValidate;
            delete element.options.onValidate;
            element.hasValidation = true;
            onValidateMap.set(element.id, onValidate);
        }

        if (element.options?.onDelayedValidate != null) {
            const onDelayedValidate = element.options.onDelayedValidate;
            delete element.options.onDelayedValidate;
            element.hasDelayedValidation = true;
            onDelayedValidateMap.set(element.id, onDelayedValidate);
        }

        if (element.options?.onClick != null) {
            const onClick = element.options.onClick;
            delete element.options.onClick;
            onClickMap.set(element.id, onClick);
        }
    }

    const buttons = elements.filter(e => e.type == buttonType);
    for (let element of buttons) {
        requireResponse(clickEventType, element.id, _ => onClickMap.get(element.id)()); // Don't await
    }

    let finishedShowingPromiseResolver;
    const finishedShowingPromise = new Promise(resolve => finishedShowingPromiseResolver = resolve);
    const promise = requireResponse(showEventType, { element, options }, async (content, event) => {
        let map = null;
        if (event.type == validateInputEventType) {
            map = onValidateMap;
        } else if (event.type == delayedValidateInputEventType) {
            map = onDelayedValidateMap;
        } else if (event.type == noAcceptShownEventType) {
            finishedShowingPromiseResolver();
            return;
        }
        return await map.get(content.input.id)(content.input, _mapElements(content.allInputs));
    });

    if (options.noAccept) {
        await finishedShowingPromise;
        return async () => {
            await promise;
        };
    } else {
        const response = await promise;
        return inputs.length == 1 ? response[0] : (inputs.length == 0 ? null : _mapElements(response));
    }
}

/**
 * If the element is an input element, it returns the current values of the input as described by the `show` function, as well as `isInvalid`, which indicates whether validation failed. It does NOT await user input. Calling this directly after showing something with `noAccept` is pointless.
 */
async function read(id) {
    return await requireResponse(readEventType, { id });
}

/**
 * Returns the current values of all nested inputs of the element (and itself if it is an input) as described by the `show` function, as well as `isInvalid`. If `id` is null, it returns all elements regardless of their parent.
 */
async function readAll(id = null) {
    const inputs = await requireResponse(readEventType, { id, all: true });
    return _mapElements(inputs);
}

/**
 * - **id** (string): The id of the element to update. You cannot update accepted inputs (after awaiting return value).
 * - **properties** (object): An object that contains the properties to update. The following properties are available:
 *     - All properties passed into any of the create functions, except `type`, `options`, any child element properties and any of the callback functions.
 *     - All properties of the `options` property, except `defaultValue` and any of the callback functions.
 *     - All return value properties from inputs.
 */
async function update(id, properties) {
    await requireResponse(updateEventType, { id, properties });
}

/**
 * - **id** (string) [optional]: The id of the element to delete. All nested elements are also deleted. If null, all elements will be deleted instead.
 */
async function remove(id = null) {
    await requireResponse(removeEventType, { id });
}

/**
 * - **id** (string) [optional]: The id of the top level element to accept input from. This ignores validation. If you want to accept an input with `noAccept == true`, then you need to use this function. If null, all inputs across all top level elements will be accepted instead.
 */
async function accept(id = null) {
    await requireResponse(acceptEventType, { id });
}

async function requestFileDownload(name, type, content) {
    const file = {
        name: name,
        type: type,
        content: content,
    }
    return await requireResponse(fileDownloadEventType, file);
}

async function requestDataURLDownload(name, dataURL) {
    const file = {
        name: name,
        dataURL: dataURL,
    }
    return await requireResponse(dataURLDownloadEventType, file);
}

/**
 * Shows a progress bar at the top. This is useful if something may take long.
 *
 * ## Parameters
 * - **progress** (float): The desired progress. This is clamped between 0 and 100. Set to null to hide progress again.
 * */
async function setProgress(progress) {
    return await requireResponse(setProgressEventType, progress);
}

/**
 * Sets the current status message of the application. Can be used in combination with progress if something may take long.
 *
 * ## Parameters
 * - **status** (string): The status message.
 * */
async function setStatus(status) {
    return await requireResponse(setStatusEventType, status);
}

// Storage that persists across sessions. Useful for inputs that become repetitive for the user.
class Store {
    // Returns false if the script doesn't have access to a storage.
    static async exists() {
        return await requireResponse(storageEventType, { exists: true });
    }

    static async set(key, object) {
        await requireResponse(storageEventType, { set: { key, value: object } });
    }

    // Returns null if the script doesn't have access to a storage. Otherwise the object associated with the key.
    static async get(key) {
        return await requireResponse(storageEventType, { get: key });
    }

    static async delete(key) {
        await requireResponse(storageEventType, { delete: key });
    }
}

async function getUrl() {
    const url = await requireResponse(urlEventType);
    return url.base;
}

async function fetchTextInternal(path) {
    return await requireResponse(fetchInternalEventType, { path });
}

async function requireProxy() {
    return await requireResponse(requireEventType, { proxy: true })
}

async function hasProxy() {
    return requireResponse(proxyEventType, { get: 'has' });
}

// Internal helper functions
const _helpers = {
    escapeHtmlChars: {
        '¢': 'cent',
        '£': 'pound',
        '¥': 'yen',
        '€': 'euro',
        '©': 'copy',
        '®': 'reg',
        '<': 'lt',
        '>': 'gt',
        '"': 'quot',
        '&': 'amp',
        '\'': '#39',
    },
    getEscapeHtmlRegex() {
        let escapeHtmlRegexString = '[';
        for (let key in _helpers.escapeHtmlChars) {
            escapeHtmlRegexString += key;
        }
        escapeHtmlRegexString += ']';
        const regex = new RegExp(escapeHtmlRegexString, 'g');
        return regex;
    },
    htmlEntities: {
        nbsp: ' ',
        cent: '¢',
        pound: '£',
        yen: '¥',
        euro: '€',
        copy: '©',
        reg: '®',
        lt: '<',
        gt: '>',
        quot: '"',
        amp: '&',
        apos: '\''
    },
};
_helpers.escapeHtmlRegex = _helpers.getEscapeHtmlRegex();

// Extended helper functions
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Executes async function on an iterator of items in parallel and returns their output in an array in the same order as the iterator.
 *
 * ## Parameters
 * - **iterator** (iterator): Iterable object such as an array.
 * - **asyncFunc** (function): Async function with the following parameters: item, index.
 * */
async function parallel(iterator, asyncFunc) {
    const array = [...iterator];
    const results = new Array(array.length);
    const promises = [];
    const errors = [];
    array.forEach((item, index) => promises.push(asyncFunc(item, index).then(result => results[index] = result, error => errors.push(error))));

    await Promise.allSettled(promises);

    if (errors.length != 0) throw errors[0];
    return results;
}

let commonMimeTypes = {
    plainText: "text/plain",
    json: "application/json",
    csv: "text/csv",
    javascript: "text/javascript",
}

function escapeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\. \-]/g, "_");
}

function escapeFileNameMinimal(name) {
    name = name.toLowerCase(); // Lowercase
    name = name.replace(/[^a-z0-9_]/g, '_'); // Replace non-alphanumeric characters with an underscore
    name = name.replace(/_+/g, '_'); // Replace multiple underscores with a single one
    name = name.replace(/_$/, ''); // Remove trailing underscore

    return name;
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function unescapeRegex(string) {
    return string.replace(/\\([.*+?^${}()|[\]\\])/g, '$1');  // $1 refers to the captured group
}

function escapeHTML(str) {
    return str.replace(_helpers.escapeHtmlRegex, function (m) {
        return '&' + _helpers.escapeHtmlChars[m] + ';';
    });
}

function unescapeHTML(str) {
    return str.replace(/\\&([^;]+);/g, function (entity, entityCode) {
        let match;

        if (entityCode in _helpers.htmlEntities) {
            return _helpers.htmlEntities[entityCode];
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#x([\\da-fA-F]+)$/)) {
            return String.fromCharCode(parseInt(match[1], 16));
            /*eslint no-cond-assign: 0*/
        } else if (match = entityCode.match(/^#(\\d+)$/)) {
            return String.fromCharCode(~~match[1]);
        } else {
            return entity;
        }
    });
}

function clamp(number, min, max) {
    return Math.max(min, Math.min(number, max));
}

function intDivision(a, b) {
    return Math.floor(a / b);
}

async function fetchText(url) {
    const response = await fetch(url);
    return await response.text();
}

async function fetchJson(url) {
    return JSON.parse(await fetchText(url));
}

let defaultProxyAuthorizationHeader = "x-api-key";
function createProxy(proxyUrl, settings = null) {
    settings ??= {};
    settings.proxyAuthHeader ??= defaultProxyAuthorizationHeader;
    const { apiKey = null, request = {}, proxyAuthHeader, stream = null } = settings;

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


const second = 1000;

function seconds(seconds) {
    return second * seconds;
}

const minute = second * 60;

function minutes(minutes) {
    return minute * minutes;
}

const hour = minute * 60;

function hours(hours) {
    return hour * hours;
}

const day = hour * 24;

function days(days) {
    return day * days;
}

const week = day * 24;

function weeks(weeks) {
    return week * weeks;
}

function extractCode(markdown, codeBlocksOnly = true) {
    let amount = 0;
    let isCodeBlock = false;
    let isIndentedCode = false;
    let codes = [];
    let codeStart = 0;
    for (let i = 0; i < markdown.length; i++) {
        if (markdown[i] === "\`") {
            amount++;
        } else {
            if (amount === 3) {
                if (isCodeBlock) {
                    codes.push(markdown.substring(codeStart, i - 2));
                    isCodeBlock = false;
                } else if (isIndentedCode) {
                    continue;
                } else {
                    let cutOff = false;
                    while (markdown[i] !== "\n") {
                        i++;
                        if (i === markdown.length || i + 1 === markdown.length) {
                            cutOff = true;
                            break;
                        }
                    }
                    if (cutOff) break;
                    codeStart = i + 1;
                    isCodeBlock = true;
                }
            } else if (amount === 1) {
                if (isIndentedCode) {
                    if (!codeBlocksOnly) codes.push(markdown.substring(codeStart, i));
                    isIndentedCode = false;
                } else if (isCodeBlock) {
                    continue;
                } else {
                    if (i + 1 === markdown.length) break;
                    codeStart = i + 1;
                    isIndentedCode = true;
                }
            }
            amount = 0;
        }
    }

    if (isCodeBlock) {
        codes.push(markdown.substring(codeStart, markdown.length - amount));
    } else if (isIndentedCode) {
        if (!codeBlocksOnly) codes.push(markdown.substring(codeStart, markdown.length - amount));
    }

    return codes;
}
