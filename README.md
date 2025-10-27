# aidevsuite (https://deadlyartist.github.io/aidevsuite)
Automatically and quickly create tools by hand or with AI. Simple syntax allows quickly iterating through and creating highly specific tools for you or your clients without the need to go through the pain and effort of setting up **yet another website**.

Often enough, a small tool is all that is needed, but the effort of creating even the smallest of tools far exceeds the effort of just doing it manually. For example, what if you have 10 strings that are urls with a json encoded in a data property that contains a name property that you need to extract?

**That's where this tool comes in.**

_Prompt:_

i have a url with a json encoded in a data query parameter that contains a name property that you need to extract

_Result:_

```javascript
const urlInput = createInput(textInputType, {
    placeholder: "Enter the URL here..."
});
await show(urlInput, { noAccept: true });

const resultElement = createMarkdown("");
await show(resultElement);

async function extractName(url) {
    try {
        const urlObj = new URL(url);
        const data = urlObj.searchParams.get("data");

        if (!data) throw new Error("No data query parameter found.");

        const jsonData = JSON.parse(data);
        if (!jsonData.name) throw new Error("No name property found in the JSON data.");

        return jsonData.name;
    } catch (error) {
        return `Error: ${error.message}`;
    }
}

async function run() {
    const url = (await read(urlInput.id)).text;
    const name = await extractName(url);
    await update(resultElement.id, { markdown: `**Result:** ${name}` });
}

const button = createButton(createText(paragraphType, "Extract Name"), run);
const wrapper = createFloatRightWrapper(button);
await show(wrapper);

await forever();
```

_Test url:_ https://example.com/?data=%7B%22name%22%3A%22aidevsuite%22%2C%22value%22%3A%229999%22%7D

_Try it out:_ https://deadlyartist.github.io/aidevsuite/#local


_**For devs that want to develop in the future.**_

## Goals

Welcome to **aidevsuite**! This project empowers developers to create and share simple JavaScript tools on demand. Most programs are about input/output, so this project takes that to heart and streamlines this as much as possible. For example, you can simply await any input, such as text, file upload, code, markdown and many more. Essentially, this is a tool to create tools.

## Getting Started

Follow these steps to get started with creating and customizing your own tools:

1. **Open the Website:**
   Navigate to https://deadlyartist.github.io/aidevsuite/.

2. **Enter API Key:**
   Enter at least one API key to enable AI integration. If you don't have one, head over to https://console.groq.com/keys to create one.

3. **Open the Simple Chat Sample:**
   Click on the "Simple Chat" sample to open it.

4. **Edit the Script:**
   - Click on the "star" icon.
   - Uncheck "Link to External Url" to enable editing.
   - Click "Save" to confirm changes.
   - Press "Play" to run the script.

5. **Interact with AI:**
   Ask the AI something to ensure it is working correctly.

6. **Modify the Script:**
   - Click "edit" to open the script editor.
   - Try adding a delete button with a close icon to the right of each message. This button should remove the message both visually and from the context.
   - Compare your results with the "Chat" sample.

7. **Explore More Features:**
   For advanced functionalities such as saving (exclusive to local scripts), exporting, and importing the current chat, check out the "Chat" sample and the [Worker page](https://deadlyartist.github.io/aidevsuite/#worker). Experiment to your heart's content to create your ultimate chatbot.

8. **Share Your Chatbot:**
    - Download the script
    - Either send the file to others so they can import it, or fork the repo (see the "Fork It!" section further below) and add the file into the data folder before deploying it via GitHub Pages.
    - If you chose to deploy, others can access it by pasting [your github pages website name]/data/[your file name] into the "Extern" page and pressing "Load Script". If you want to add it to your Home page as a sample, you can add it to the `const samples` array in the `js/pages.js` file.

## Samples

This project is currently deployed using GitHub Pages to https://deadlyartist.github.io/aidevsuite/. Check out the samples to see how everything works, or browse the repo. The project is still in very early stages, so there are still a lot of bugs and no documentation.

## Help plz

Once you have input at least one API key, you can open the [Help page](https://deadlyartist.github.io/aidevsuite/#help) and ask any questions to the friendly AI helper, who has a solid understanding of the website and how to make tools.

## Overview of Key Functions

This is a small overview of key functions. It is highly recommended that you check out the [Worker page](https://deadlyartist.github.io/aidevsuite/#worker) to view all the functions and their available options.

### 1. **Element Creation Functions**
These functions help you create various types of UI elements.

- **createBreak(size, options = null)**: Creates a break element with an optional size.
- **createRuler(options = null)**: Creates a horizontal or vertical ruler (hr).
- **createAnchor(options = null)**: Creates a hidden empty element to help with inserting at the right position.
- **createCode(code, options = null)**: Creates an element to display code with optional language highlighting.
- **createMarkdown(markdown, options = null)**: Creates a markdown element that can also handle math via Katex. This is excellent for chatbot outputs.
- **createImage(url, options = null)**: Creates an image element with optional caption.
- **createPresetIcon(name, options = null)**: Creates an icon element from a set of predefined names, such as `"close"`.

### 2. **Input Creation Functions**
These functions help you create various types of user input elements.

- **createInput(type, options = null)**: Creates a generic input element of a specified type.

  Examples for specific types:
  ```javascript
  createInput(textInputType, options);  // Creates a text input
  createInput(codeInputType, options);  // Creates a code input
  createInput(numberInputType, options); // Creates a number input
  ```

  Important options:
  - `onValidate` (can be used to call a function whenever input changes)
  - `defaultValue`

### 3. **Container and Button Creation Functions**
These functions help you group elements and create buttons.

- **createGroup(elements, options = null)**: Group elements without affecting their appearance.
- **createNavBar(type, elements, options = null)**: Creates a horizontal list of spaced out elements.
- **createHorizontalList(type, elements, options = null)**: Creates a horizontal list of elements.
- **createButton(elements, onClick, options = null)**: Creates a button with specific elements inside it and an `onClick` callback.

### 4. **Display Functions**
These functions help you show, update, read, and remove elements on the screen.

- **show(element, options = null)**: Displays an element on the screen. Use `noAccept` for custom input handling.

- **update(id, properties)**: Updates properties of an already displayed element.
- **read(id)**: Reads the current values from an input element.
- **readAll(id = null)**: Reads the current values from all input elements.
- **remove(id = null)**: Removes an element from the screen.

### 5. **Utility Functions**
Auxiliary functions to help with various tasks.

- **generateUniqueId()**: Generates a unique ID.
- **forever()**: A helper function to keep the script running indefinitely.
- **requireResponse(type, content, onPing = null, pingSourceEvent = null)**: Sends an event request and waits for a response.
- **sleep(ms)**: Waits before continuing to execute code.
- **clone(obj)**: Deep clones an object via JSON.
- **clamp(number, min, max)**: Clamps a number between 2 values.
- **importCode(code)**: Imports and evaluates a code string.
- **setProgress(progress)**: Shows a progress bar, useful for long operations.
- **setStatus(status)**: Sets the current status message of the application.

### 6. **Chat Functions**
Functions to interact with chatbots.

- **chat(context, options = null)**: Communicate with a chatbot. Supports streaming and callback updates.
- **toMessage(role, prompt, url = null)**: Creates a chat message.
- **toUserMessage(prompt, url = null)**: Creates a user chat message.
- **toSystemMessage(prompt, url = null)**: Creates a system chat message.
- **toAssistantMessage(prompt)**: Creates an assistant chat message.
- **ChatHelpers.getAvailableModels()**: Gets all models for which the user has input an API key.

## Fork It!

This tool is primarily targeted towards devs. As it is serverless and written in vanilla js without any dependencies or build steps, you can easily fork this on github and one click setup github pages ([just like this repo](https://deadlyartist.github.io/aidevsuite/)), or throw them into just about any web project, **whether public or private**. 

Then you can export your favorite scripts, throw them into the project, and voila, everyone with the link can access the script.

## AI Integration

A very simple and straightforward input/ouput syntax even for complex inputs allows AI to effortlessly write your tools. AI is tightly integrated into the core, allowing you to quickly generate or rewrite tools.

This uses chatbots like OpenAI ChatGPT or Llama using groq.com (Claude doesn't work due to cors) and requires API keys to work. If you don’t like AI or don’t have an API key, you can simply disable it in the settings. However, it seems as though groq.com currently (23.07.2024) allows [creating API keys for free](https://console.groq.com/keys).

## Safe Execution

Code is run in a worker from a sandboxed iframe, allowing secure execution of arbitrary code. Both the worker and the iframe are recreated for every code execution.

For your security, please do not enter sensitive data into scripts that rely on external code.

## License

This project is licensed under MIT license.

## Author

[Deadly Artist](https://deadlyartist.com)

See my website for my other projects: https://deadlyartist.com