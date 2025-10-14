
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
        '!': '\\!',
        '~': '\\~',
        '=': '\\=', // for highlighter extension
        '>': '\\>',
        '|': '\\|',
        ':': '\\:',
        '<': '\\<',  // especially to prevent HTML tag confusion
        '&': '\\&',  // if using HTML rendering
        '^': '\\^',  // in case of extensions like footnotes
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
        const renderer = new marked.Renderer();
        const tokenizer = {
            // Uncomment to remove indented code blocks
            // code(src, tokens) {
            //     // Return undefined
            // }
        };

        marked.use({ tokenizer });
        marked.use({ renderer });
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

    static _replaceCodeblocks(markdown, codeBlocks) {
        codeBlocks.sort((a, b) => b.start - a.start)
        for (let [index, code] of Object.entries(codeBlocks)) {
            code.placeholder = `__CODE_BLOCK_PLACEHOLDER_nvcr79vTLCNRoxvuisvusekvmsa92_${index}__`;
            code.markEscaped_placeholder = escapeMarkdown(code.placeholder);
            code.htmlEscaped_placeholder = escapeHTML(code.placeholder);
            code.htmlMarkEscaped_placeholder = escapeHTML(code.markEscaped_placeholder);
            code.htmlEscaped_language = code.language ? escapeHTML(code.language) : code.language;
            code.htmlEscaped_content = escapeHTML(code.content);
            markdown = replaceSubstring(markdown, code.start, code.end, code.markEscaped_placeholder);
        }
        return markdown;
    }

    static _readdCodeblocks(element, codeBlocks) {
        let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
        let textNodes = [];

        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        textNodes.forEach(textNode => {
            let updatedText = escapeHTML(textNode.nodeValue);
            let modified = false;

            codeBlocks.forEach(code => {
                // Check for both escaped and not to mitigate errors
                for (let text of [code.htmlEscaped_placeholder, code.htmlMarkEscaped_placeholder]) {
                    updatedText = updatedText.replace(text, function () {
                        modified = true;
                        let classPart = '';
                        if (code.language) classPart = ` class="language-${code.htmlEscaped_language}"`;
                        return `<pre><code${classPart}>${code.htmlEscaped_content}</code></pre>`;
                    });
                }
            });

            if (modified) {
                replaceTextNodeWithHTML(textNode, updatedText);
            }
        });
    }

    static extractCodeInfo(markdown, codeBlocksOnly = true) {
        let amount = 0;
        let codes = [];
        let codeStart = 0;
        for (let i = 0; i < markdown.length; i++) {
            if (markdown[i] === "\\") {
                i++;
                amount = 0;
                continue;
            } else if (markdown[i] === "\`") {
                if (amount == 0) codeStart = i;
                amount++;
            } else {
                if (amount >= 3) {
                    let contentStart = i;

                    let before = codeStart - 1;
                    let indentation = "";
                    let invalid = false;
                    while (before >= 0 && markdown[before] !== "\n") {
                        if (markdown[before] === " " || markdown[before] === "\t") {
                            indentation = markdown[before] + indentation;
                        } else {
                            invalid = true;
                        }
                        before--;
                    }
                    if (invalid) {
                        amount = 0;
                        continue;
                    } else {
                        codeStart = before + 1;
                    }

                    let j = i;
                    let lineHappened = false;
                    let language = null;
                    let contentEnd = j - 1;
                    let starters = 0;
                    let toNext = (amount - 1);
                    while (j + toNext < markdown.length) {
                        contentEnd = j - 1;
                        let maybeClosing = true;
                        for (let t = j; t < j + amount; t++) {
                            if (markdown[t] != "\`") {
                                maybeClosing = false;
                                break;
                            }
                        }
                        if (j + amount < markdown.length && markdown[j + amount] == "\`") maybeClosing = false;

                        if (maybeClosing) {
                            if (!lineHappened) {
                                j += toNext;
                                break;
                            }

                            let beforeEnd = contentEnd;
                            let endIndentation = "";
                            while (markdown[beforeEnd] !== "\n") {
                                endIndentation = markdown[beforeEnd] + endIndentation;
                                beforeEnd--;
                            }

                            if (endIndentation !== indentation) {
                                j += toNext;
                                continue;
                            }

                            if (j + amount < markdown.length && !/^\s$/.test(markdown[j + amount])) {
                                starters++;
                                j += toNext;
                                continue;
                            } else if (starters > 0) {
                                starters--;
                                j += toNext;
                                continue;
                            }

                            contentEnd = beforeEnd;
                            j += toNext;
                            break;
                        }
                        if (markdown[j] == "\n" && !lineHappened) {
                            lineHappened = true;
                            language = markdown.substring(contentStart, j).trim();
                            if (!language) language = null;
                            contentStart = j + 1;
                        }
                        j++;
                    }
                    i = j;
                    if (markdown[contentEnd] == "\n") contentEnd--;

                    let rawContent = markdown.substring(contentStart, contentEnd + 1);
                    let lines = rawContent.split('\n');
                    // Remove indentation from all lines if it matches the detected indentation
                    if (indentation) {
                        let indentRegex = new RegExp('^' + escapeRegex(indentation));
                        lines = lines.map(line => line.replace(indentRegex, ''));
                    }
                    let cleanedContent = lines.join('\n');

                    codes.push({
                        block: true,
                        language,
                        indentation,
                        start: codeStart,
                        end: i,
                        contentStart: contentStart,
                        contentEnd: contentEnd,
                        content: cleanedContent,
                        code: markdown.substring(codeStart, i + 1),
                    });
                } else if (amount === 1) {
                    let contentStart = i;
                    let j = i;
                    let lineHappened = false;
                    while (j < markdown.length) {
                        if (markdown[j] == "\`") break;
                        if (markdown[j] == "\n") {
                            lineHappened = true;
                            break;
                        }
                        j++;
                    }
                    i = j;
                    if (lineHappened) {
                        amount = 0;
                        continue;
                    }
                    let contentEnd = i - 1;
                    if (!codeBlocksOnly) codes.push({
                        block: false,
                        start: codeStart,
                        end: i,
                        contentStart: contentStart,
                        contentEnd: contentEnd,
                        content: markdown.substring(contentStart, contentEnd + 1),
                        code: markdown.substring(codeStart, i + 1),
                    });
                }
                amount = 0;
            }
        }

        return codes;
    }

    static extractCode(markdown, codeBlocksOnly = true, concatenate = true) {
        let codes = MarkdownHelpers.extractCodeInfo(markdown, codeBlocksOnly).map(c => c.content);

        if (concatenate) codes = codes.join('\n');
        return codes;
    }
}

window.addEventListener('load', e => MarkdownHelpers.setup());

function escapeMarkdown(text) {
    return text.replace(MarkdownHelpers.escapeMarkdownRegex, (match) => MarkdownHelpers.escapeMarkdownChars[match]);
}

/**
 * the `options` parameter can have the following properties:
 *   - **katex** (bool) [optional]: Whether to render katex. Default is `true`.
 *   - **sanitize** (bool) [optional]: Whether to sanitize the markdown html. Default is `false`.
 *   - **noHighlight** (bool) [optional]: Whether custom `==highlighted text==` syntax is disallowed. Default is `false`.
 *   - **codeblocksKeepIndent** (bool) [optional]: Whether code blocks should keep indent. Default is `true`.
 */
function renderMarkdown(element, markdown, options = null) {
    options ??= {};
    options.katex ??= true;
    options.codeblocksKeepIndent ??= true;

    markdown = markdown.replaceAll("‑", "-").replace(/[  ]/g, " "); // Fix ChatGPT madness

    // Escape math
    if (options.katex) markdown = KatexHelpers.escapeMathFromMarkdown(markdown);
    if (options.noHighlight) MarkdownHelpers.highlightExtensionEnabled = false;
    else MarkdownHelpers.highlightExtensionEnabled = true;

    // Temporarily replace code blocks
    let codeBlocks = MarkdownHelpers.extractCodeInfo(markdown, true);
    if (options.codeblocksKeepIndent) {
        markdown = MarkdownHelpers._replaceCodeblocks(markdown, codeBlocks);
    }

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
    if (options.codeblocksKeepIndent) {
        for (let child of children) MarkdownHelpers._readdCodeblocks(child, codeBlocks);
    }

    MarkdownHelpers.adjustMarkedOuput(...children);
    for (let child of children) {
        if (options.katex) renderMathInElement(child);
    }

    element.replaceChildren(...children);
    element.classList.add('markdown');
}
