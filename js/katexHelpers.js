class KatexHelpers {
    static getMathHtmlRaw(text, optionsCopy, replaceMathParts = false) {
        const data = this.splitAtDelimiters(text, optionsCopy.delimiters);

        let result = '';
        const mathParts = [];
        for (let i = 0; i < data.length; i++) {
            if (data[i].type === "text") {
                result += replaceMathParts ? data[i].data : escapeHTML(data[i].data);
            } else {
                const mathPart = { id: 'MATHPART' + generateUniqueId(), html: '' };
                mathPart += `<span>`;
                let math = escapeHTML(data[i].data);
                // Override any display mode defined in the settings with that
                // defined by the text itself
                optionsCopy.displayMode = data[i].display;
                try {
                    if (optionsCopy.preProcess) {
                        math = optionsCopy.preProcess(math);
                    }
                    mathPart.html += katex.renderToString(math, optionsCopy);
                } catch (e) {
                    if (!(e instanceof katex.ParseError)) {
                        throw e;
                    }
                    optionsCopy.errorCallback(
                        "KaTeX auto-render: Failed to parse `" + data[i].data +
                        "` with ",
                        e
                    );
                    mathPart.html += escapeHTML(data[i].rawData);
                }
                mathPart.html += `</span>`;
                mathParts.push(mathPart);
                if (replaceMathParts) result += mathPart.id;
                else result += mathPart.html;
            }
        }

        if (replaceMathParts) return { result, mathParts };
        else return result;
    };

    static escapeMathFromMarkdown(text, options = null) {
        const optionsCopy = this.getOptionsCopy(options);
        const data = this.splitAtDelimiters(text, optionsCopy.delimiters);

        let result = '';
        for (let i = 0; i < data.length; i++) {
            if (data[i].type === "text") {
                result += data[i].data;
            } else {
                result += escapeMarkdown(data[i].rawData ?? data[i].data);
            }
        }

        return result;
    }

    static getOptionsCopy(options = null) {
        options ??= {};

        const optionsCopy = {};
        optionsCopy.output = 'mathml';

        // Object.assign(optionsCopy, option)
        for (const option in options) {
            if (options.hasOwnProperty(option)) {
                optionsCopy[option] = options[option];
            }
        }

        // default options
        optionsCopy.delimiters = optionsCopy.delimiters || [
            { left: "$$", right: "$$", display: true },
            { left: "\\(", right: "\\)", display: false },

            // Render AMS environments even if outside $$…$$ delimiters.
            { left: "\\begin{equation}", right: "\\end{equation}", display: true },
            { left: "\\begin{align}", right: "\\end{align}", display: true },
            { left: "\\begin{alignat}", right: "\\end{alignat}", display: true },
            { left: "\\begin{gather}", right: "\\end{gather}", display: true },
            { left: "\\begin{CD}", right: "\\end{CD}", display: true },

            { left: "\\[", right: "\\]", display: true },
        ];
        optionsCopy.delimiters.dollar ??= true; // has special parsing
        optionsCopy.errorCallback = optionsCopy.errorCallback || console.error;

        // Enable sharing of global macros defined via `\gdef` between different
        // math elements within a single call to `renderMathInElement`.
        optionsCopy.macros = optionsCopy.macros || {};
        return optionsCopy;
    }

    static getMathHtml(str, options = null) {
        if (!str || str.length === 0) {
            return '';
        }

        const optionsCopy = this.getOptionsCopy(options);
        return this.getMathHtmlRaw(str, optionsCopy);
    };

    /* eslint no-constant-condition:0 */
    static findEndOfMath(delimiter, text, startIndex) {
        // Adapted from
        // https://github.com/Khan/perseus/blob/master/src/perseus-markdown.jsx
        let index = startIndex;
        let braceLevel = 0;

        const delimLength = delimiter.length;

        while (index < text.length) {
            const character = text[index];

            if (braceLevel <= 0 &&
                text.slice(index, index + delimLength) === delimiter) {
                return index;
            } else if (character === "\\") {
                index++;
            } else if (character === "{") {
                braceLevel++;
            } else if (character === "}") {
                braceLevel--;
            }

            index++;
        }

        return -1;
    };

    static escapeRegex(string) {
        return string.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    };

    static amsRegex = /^\\begin{/;

    static splitAtDelimiters(text, delimiters) {
        // Temporarily replace code blocks
        let codes = MarkdownHelpers.extractCodeInfo(text);
        codes.sort((a, b) => b.start - a.start)
        for (let [index, code] of Object.entries(codes)) {
            code.placeholder = `__CODE_BLOCK_PLACEHOLDER_9x91n2w87x87z127t7wtnx761t2_${index}__`;
            text = replaceSubstring(text, code.start, code.end, code.placeholder);
        }

        let index;
        const data = [];

        const regexLeft = new RegExp(
            "(" + delimiters.map((x) => this.escapeRegex(x.left)).join("|") + ")"
        );

        while (true) {
            index = text.search(regexLeft);
            if (index === -1) {
                break;
            }
            if (index > 0) {
                data.push({
                    type: "text",
                    data: text.slice(0, index),
                });
                text = text.slice(index); // now text starts with delimiter
            }
            // ... so this always succeeds:
            const i = delimiters.findIndex((delim) => text.startsWith(delim.left));
            index = this.findEndOfMath(delimiters[i].right, text, delimiters[i].left.length);
            if (index === -1) {
                break;
            }
            const rawData = text.slice(0, index + delimiters[i].right.length);
            const math = this.amsRegex.test(rawData)
                ? rawData
                : text.slice(delimiters[i].left.length, index);
            data.push({
                type: "math",
                data: math,
                rawData,
                display: delimiters[i].display,
            });
            text = text.slice(index + delimiters[i].right.length);
        }

        if (text !== "") {
            data.push({
                type: "text",
                data: text,
            });
        }


        // Restore code blocks in the final data array using placeholders
        data.forEach(part => {
            codes.forEach(code => {
                part.data = part.data.replace(code.placeholder, function () { return code.code }); // function to escape $
                if (part.rawData) {
                    part.rawData = part.rawData.replace(code.placeholder, function () { return code.code }); // function to escape $
                }
            });
        });

        return data;
    };
}
