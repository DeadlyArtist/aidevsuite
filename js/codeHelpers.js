
class CodeHelpers {
    static createCodeElement(code, language) {
        const preContainer = fromHTML(`<div class="preContainer">`);
        const languageClass = language != null ? 'language-' + escapeHTML(language) : null;

        const pre = fromHTML(`<pre>`);
        const codeElement = fromHTML(`<code>`);
        if (language != null) codeElement.classList.add(languageClass);
        codeElement.textContent = code;
        if (language != null) highlightCode(codeElement);


        // Code bar
        const codeBar = fromHTML(`<div class="codeBar listContainerHorizontal">`);
        const codeLanguage = fromHTML(`<div class="codeLanguage">`);
        codeLanguage.textContent = language ? CodeHelpers.extractLanguage(languageClass) : 'any';
        codeBar.appendChild(codeLanguage);
        let copyText = language == "Text" ? 'Copy Text' : 'Copy Code';
        const copyButton = fromHTML(`<button tooltip="${copyText}" class="largeElement hoverable">`);
        let copyTime = Date.now();
        copyButton.addEventListener('click', e => {
            copyToClipboard(codeElement.innerText);
            copyButton.setAttribute('tooltip', 'Copied!');
            copyTime = Date.now();
            const oldCopyTime = copyTime;
            window.setTimeout(function () {
                if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', copyText); // Only update if it hasn't been modified in the meantime.
            }, seconds(3));
        });
        const copyIcon = icons.copy();
        copyButton.appendChild(copyIcon);
        codeBar.appendChild(copyButton);
        preContainer.appendChild(codeBar);

        pre.appendChild(codeElement);
        preContainer.appendChild(pre);

        return preContainer;
    }

    static findLanguageClass(codeElement) {
        return [...codeElement.classList].find(c => c.startsWith('language-'));
    }

    static extractLanguage(languageClass) {
        if (!languageClass) return null;

        const parts = languageClass.split('language-');
        return parts.length == 1 ? null : parts[1];
    }

    static _adjustPre(pre) {
        const code = pre.querySelector('code');
        const languageClass = CodeHelpers.findLanguageClass(code);
        const wrappedElement = CodeHelpers.createCodeElement(code.innerText, CodeHelpers.extractLanguage(languageClass));
        pre.replaceWith(wrappedElement);
    }

    static adjustCodeBlocks(element) {
        if (element.nodeType != Node.ELEMENT_NODE) return;

        const pres = (element.matches('pre')) ? [element] : [...element.querySelectorAll('pre')];
        for (let pre of pres) CodeHelpers._adjustPre(pre);
    }

    static createCodeEditor(options) {
        options ??= {};

        const preContainer = fromHTML(`<div class="preContainer">`);

        let copyButton = null;
        let copyText = options.language == "Text" ? 'Copy Text' : 'Copy Code';
        // Code bar
        if (!options.noBar) {
            const codeBar = fromHTML(`<div class="codeBar listContainerHorizontal">`);
            const codeLanguage = fromHTML(`<div class="codeLanguage">`);
            codeLanguage.textContent = options.language ?? 'any';
            codeBar.appendChild(codeLanguage);
            copyButton = fromHTML(`<button tooltip="${copyText}" class="largeElement hoverable">`);
            const copyIcon = icons.copy();
            copyButton.appendChild(copyIcon);
            codeBar.appendChild(copyButton);
            preContainer.appendChild(codeBar);
        }

        let copyTime = Date.now();
        if (options.noMonaco) {
            copyButton?.addEventListener('click', e => {
                copyToClipboard(codeElement.innerText);
                copyButton.setAttribute('tooltip', 'Copied!');
                copyTime = Date.now();
                const oldCopyTime = copyTime;
                window.setTimeout(function () {
                    if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', copyText); // Only update if it hasn't been modified in the meantime.
                }, seconds(3));
            });

            const codeEditorContainer = fromHTML(`<pre class="contenteditableContainer">`);
            const codeEditor = fromHTML(`<code contenteditable-type="plainTextOnly" contenteditable="true" class="fixText" placeholder="Enter code here...">`);
            if (options.onInput != null) codeEditor.addEventListener('input', options.onInput);
            codeEditor.setAttribute('spellcheck', false);
            codeEditor.textContent = options.content ?? '';
            codeEditor.addEventListener('keydown', e => ContentEditableHelpers.checkForTab(e));
            codeEditorContainer.appendChild(codeEditor);

            preContainer.appendChild(codeEditorContainer);
            return { preContainer, codeEditor };
        } else {
            const codeEditorContainerWrapper = fromHTML(`<div class="monacoWrapper">`);
            const codeEditorContainerWrapperInner = fromHTML(`<div class="monacoWrapperInner">`);
            const codeEditorContainer = fromHTML(`<div class="monacoTarget" style="height: ${options.height ?? '800px'};">`);
            if (options.text) preContainer.classList.add('textEditor');
            codeEditorContainerWrapperInner.appendChild(codeEditorContainer);
            codeEditorContainerWrapper.appendChild(codeEditorContainerWrapperInner);
            preContainer.appendChild(codeEditorContainerWrapper);

            const codeEditorPromise = Monaco.initEditor(codeEditorContainer, options.content, options.language, options);
            if (options.onInput != null) codeEditorPromise.then(e => e.onDidChangeModelContent(options.onInput));

            copyButton?.addEventListener('click', async e => {
                const codeEditor = await codeEditorPromise;
                copyToClipboard(codeEditor.getValue());
                copyButton.setAttribute('tooltip', 'Copied!');
                copyTime = Date.now();
                const oldCopyTime = copyTime;
                window.setTimeout(function () {
                    if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', copyText); // Only update if it hasn't been modified in the meantime.
                }, seconds(3));
            });

            return { codeEditorContainer: preContainer, codeEditorPromise };
        }

    }
}

function highlightCode(codeElement) {
    codeElement.removeAttribute('data-highlighted');
    codeElement.classList.remove('hljs');
    hljs.highlightElement(codeElement);
}