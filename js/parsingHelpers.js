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
                if (amount === 3) {
                    let start = i;

                    let before = i - 4;
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
                    }

                    let j = i;
                    let lineHappened = false;
                    let language = null;
                    while (j + 2 < markdown.length) {
                        if (markdown[j] == "\`" && markdown[j + 1] == "\`" && markdown[j + 2] == "\`") {
                            if (!lineHappened) {
                                j += 2;
                                break;
                            }

                            let beforeEnd = j - 1;
                            let endIndentation = "";
                            while (markdown[beforeEnd] !== "\n") {
                                endIndentation = markdown[beforeEnd] + endIndentation;
                                beforeEnd--;
                            }

                            if (endIndentation !== indentation) {
                                j += 2;
                                continue;
                            }

                            j += 2;
                            break;
                        }
                        if (markdown[j] == "\n" && !lineHappened) {
                            lineHappened = true;
                            language = markdown.substring(start, j).trim();
                            if (!language) language = null;
                            start = j + 1;
                        }
                        j++;
                    }
                    i = j;
                    let k = i - 1;
                    while (k >= start && k >= i - 2 && markdown[k] == "\`") k--;

                    codes.push({
                        block: true,
                        language,
                        start: codeStart,
                        end: i,
                        contentStart: start,
                        contentEnd: k,
                        content: markdown.substring(start, k + 1),
                        code: markdown.substring(codeStart, i + 1),
                    });
                } else if (amount === 1) {
                    let start = i;
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
                    let k = i - 1;
                    if (!codeBlocksOnly) codes.push({
                        block: false,
                        start: codeStart,
                        end: i,
                        contentStart: start,
                        contentEnd: k,
                        content: markdown.substring(start, k + 1),
                        code: markdown.substring(codeStart, i + 1),
                    });
                }
                amount = 0;
            }
        }
        console.log(codes);
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