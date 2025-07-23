class ParsingHelpers {
    static extractCodeInfo(markdown, codeBlocksOnly = true) {
        let amount = 0;
        let codes = [];
        let codeStart = 0;
        for (let i = 0; i < markdown.length; i++) {
            if (markdown[i] === "\`") {
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
                    if (lineHappened) continue;
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
        let codes = ParsingHelpers.extractCodeInfo(markdown, codeBlocksOnly).map(c => c.content);

        if (concatenate) codes = codes.join('\n');
        return codes;
    }
}

function sanitizeHtml(html) {
    return DOMPurify.sanitize(html);
}