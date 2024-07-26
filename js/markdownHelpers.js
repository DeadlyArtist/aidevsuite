
class MarkdownHelpers {
    static escapeMarkdownChars = {
        '\\': '\\\\',
        '`': '\\`',
        '*': '\\*',
        '_': '\\_',
        '{': '\\{',
        '}': '\\}',
        '[': '\\[',
        ']': '\\]',
        '(': '\\(',
        ')': '\\)',
        '#': '\\#',
        '+': '\\+',
        '-': '\\-',
        '.': '\\.',
        '!': '\\!'
    };

    static escapeMarkdownRegex = new RegExp(`${Object.keys(MarkdownHelpers.escapeMarkdownChars).map(k => escapeRegex(k)).join('|')}`, 'g');

    static highlightExtensionEnabled = true;
    static highlightExtension = {
        name: 'highlight',
        level: 'inline',
        start(src) { return src.match(/==/)?.index; },
        tokenizer(src, tokens) {
            if (!MarkdownHelpers.highlightExtensionEnabled) return;
            const rule = /^==([^=]+)==/;  // Regex to match the custom highlight syntax
            const match = rule.exec(src);
            if (match) {
                return {
                    type: 'highlight',
                    raw: match[0],
                    text: match[1].trim(),
                    tokens: this.lexer.inlineTokens(match[1].trim()) // Parse internal inline tokens
                };
            }
        },
        renderer(token) {
            return `<mark>${this.parser.parseInline(token.tokens)}</mark>`;
        },
        childTokens: ['tokens']
    };

    static setup() {
        // Use the extension with Marked
        marked.use({ extensions: [MarkdownHelpers.highlightExtension] });
    }

    static adjustMarkedOuput(...elements) {
        for (let element of elements) {
            if (element.nodeType != Node.ELEMENT_NODE) continue;
            const tag = element.tagName?.toLowerCase();

            CodeHelpers.adjustCodeBlocks(element);
            if (tag == 'table') element.classList.add('tableBordered');
            [...element.querySelectorAll('a')].forEach(e => e.classList.add('textLink'));
        }
    }

    static createBar(markdownElement, rawTextElement, bottom = false) {
        // Code bar
        const codeBar = fromHTML(`<div class="${bottom ? 'markdownBottomBar' : 'markdownTopBar'} listContainerHorizontal">`);
        const codeLanguage = fromHTML(`<div class="codeLanguage">`);
        codeLanguage.textContent = bottom ? 'end of markdown' : 'markdown';
        codeBar.appendChild(codeLanguage);

        const rightList = fromHTML(`<div class="listHorizontal">`);
        const isText = markdownElement.classList.contains('hide');
        const toggle = fromHTML(`<button tooltip="${isText ? 'Render Markdown' : 'Show Raw Text'}" class="largeElement hoverable">`);
        const toggleIcon = icons.retry();
        toggle.addEventListener('click', e => {
            const wasText = markdownElement.classList.contains('hide');
            if (wasText) {
                markdownElement.classList.remove('hide');
                rawTextElement.classList.add('hide');
                toggle.setAttribute('tooltip', 'Show Raw Text');
            }
            else {
                markdownElement.classList.add('hide');
                rawTextElement.classList.remove('hide');
                toggle.setAttribute('tooltip', 'Render Markdown');
            }
        });
        toggle.appendChild(toggleIcon);
        rightList.appendChild(toggle);
        const copyButton = fromHTML('<button tooltip="Copy Markdown" class="largeElement hoverable">');
        let copyTime = Date.now();
        copyButton.addEventListener('click', e => {
            copyToClipboard(rawTextElement.innerText);
            copyButton.setAttribute('tooltip', 'Copied!');
            copyTime = Date.now();
            const oldCopyTime = copyTime;
            window.setTimeout(function () {
                if (oldCopyTime == copyTime) copyButton.setAttribute('tooltip', 'Copy Markdown'); // Only update if it hasn't been modified in the meantime.
            }, seconds(3));
        });
        const copyIcon = icons.copy();
        copyButton.appendChild(copyIcon);
        rightList.appendChild(copyButton);
        codeBar.appendChild(rightList);

        return codeBar;
    }
}

window.addEventListener('load', e => MarkdownHelpers.setup());

function escapeMarkdown(text) {
    return text.replace(MarkdownHelpers.escapeMarkdownRegex, (match) => MarkdownHelpers.escapeMarkdownChars[match]);
}

/**
 * the `options` parameter can have the following properties:
 *   - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 *   - **sanitize** (bool) [optional]: Whether to sanitize the markdown html. Defaults is `false`.
 *   - **noHighlight** (bool) [optional]: Whether custom `==highlighted text==` syntax is disallowed. Defaults is `false`.
 */
function renderMarkdown(element, markdown, options = null) {
    options ??= {};
    options.katex ??= true;

    // Escape math
    if (options.katex) markdown = KatexHelpers.escapeMathFromMarkdown(markdown);
    if (options.noHighlight) MarkdownHelpers.highlightExtensionEnabled = false;
    else MarkdownHelpers.highlightExtensionEnabled = true;
    // Render markdown
    let html = marked.parse(markdown);
    if (!html.trim()) {
        element.innerHTML = '';
        return;
    }

    // Sanitize markdown html output
    if (options.sanitize) html = sanitizeHtml(html);

    // Render math
    const children = fromHTML(html, false);
    if (!children) {
        element.innerHTML = '';
        return;
    }
    MarkdownHelpers.adjustMarkedOuput(...children);
    for (let child of children) {
        if (options.katex) renderMathInElement(child);
    }

    element.replaceChildren(...children);
    element.classList.add('markdown');
}
