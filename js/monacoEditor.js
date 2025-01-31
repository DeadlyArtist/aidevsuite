class Monaco {
    static onInitMonacoEditor = new Map();

    static setupEventListeners() {
        document.querySelectorAll('[monaco-editor-init]').forEach(e => Monaco._tryInitializeMonaco(e));

        const observer = new MutationObserver((mutationsList) => {
            for (let mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check the node itself
                            Monaco._tryInitializeMonaco(node);

                            // Query and check all descendants
                            node.querySelectorAll('*').forEach(descendant => {
                                Monaco._tryInitializeMonaco(descendant);
                            });
                        }
                    });
                }
            }
        });

        // Start observing the body for child additions
        observer.observe(document.body, { childList: true, subtree: true });

        monaco.editor.defineTheme('my-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#111111',
            },
        });
        monaco.editor.defineTheme('my-light', {
            base: 'vs',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#FFFFFF',
            },
        });

        Monaco.updateTheme();
    }

    static currentTheme = null;

    static updateTheme() {
        if (colorScheme == lightColorScheme) {
            Monaco.currentTheme = 'my-light';
        } else {
            Monaco.currentTheme = 'my-dark';
        }

        monaco.editor.setTheme(Monaco.currentTheme);
    }

    static _tryInitializeMonaco(element) {
        if (element.hasAttribute('monaco-editor-init')) {
            const id = element.getAttribute('monaco-editor-init');
            const callback = Monaco.onInitMonacoEditor.get(id);

            if (callback) {
                // Call the callback with the element
                callback(element);

                // Clean up
                Monaco.onInitMonacoEditor.delete(id);
                element.removeAttribute('monaco-editor-init');
            }
        }
    }

    static addContext(content, language, path = null) {
        return monaco.editor.createModel(content, language, path);
    }

    static clearContext() {
        monaco.editor.getModels().forEach(model => model.dispose());
    }

    static clearNonEditorContext() {
        monaco.editor.getModels().filter(m => !m.isAttachedToEditor()).forEach(model => model.dispose());
    }

    static _createEditor(containerElement, content, language, options = null) {
        options ??= {};
        options.value = content;
        options.language = language;
        options.theme ??= Monaco.currentTheme;
        options.wordWrap ??= 'on';
        options.automaticLayout ??= true;
        options.formatOnPaste ??= true;
        options.formatOnType ??= true;
        if (!options.text) options.wrappingIndent ??= 'deepIndent';
        options.autoDetectHighContrast = false;
        options.padding ??= { top: '25px', bottom: '25px' };
        if (!options.showMinimap) options.minimap ??= {
            enabled: false,
        }

        options.expand ??= options.height == null;
        if (options.expand) {
            options.scrollBeyondLastLine = false;
        }

        if (options.minimal) {
            options.overviewRulerLanes ??= 0;
        }

        if (options.text) {
            options.language = null;
            options.fontFamily = "Arial";
            options.fontSize = 16;
            options.overviewRulerLanes ??= 0;
            options.wordBasedSuggestions ??= "off";
            options.stickyScroll ??= {
                enabled: false,
            };
        }

        const editor = monaco.editor.create(containerElement, options);

        const placeholder = new PlaceholderContentWidget(options.placeholder, editor);
        editor.updatePlaceholder = p => placeholder.updatePlaceholder(p);

        if (options.expand) {
            let ignoreEvent = false;
            editor.maxHeight = options.maxHeight ?? 800;
            editor.originalMaxHeight = editor.maxHeight;

            function updateHeight() {
                const contentHeight = editor.maxHeight == 0 ? editor.getContentHeight() : Math.min(editor.maxHeight, editor.getContentHeight());
                const contentWidth = containerElement.parentElement.offsetWidth;
                containerElement.style.width = `${contentWidth}px`;
                containerElement.style.height = `${contentHeight}px`;
                try {
                    ignoreEvent = true;
                    editor.layout({ width: contentWidth, height: contentHeight });
                } finally {
                    ignoreEvent = false;
                }
                doScrollTick();
            };
            editor.onDidContentSizeChange(updateHeight);
            updateHeight();
            editor.update = updateHeight;
        }

        return editor;
    }

    static initEditor(containerElement, content, language, options) {
        return new Promise((resolve, reject) => {
            if (document.contains(containerElement)) {
                // Element is already in the DOM, initialize Monaco Editor immediately
                const editor = Monaco._createEditor(containerElement, content, language, options);
                resolve(editor);
            } else {
                // Generate a unique ID for the element
                const uniqueId = generateUniqueId();
                containerElement.setAttribute('monaco-editor-init', uniqueId);

                // Register the callback that initializes Monaco Editor
                Monaco.onInitMonacoEditor.set(uniqueId, (element) => {
                    const editor = Monaco._createEditor(element, content, language, options);
                    resolve(editor);
                });

            }
        });
    }

    static replaceCodeWithUndo(codeEditor, text) {
        codeEditor.pushUndoStop()

        codeEditor.executeEdits('replace', [
            {
                range: codeEditor.getModel().getFullModelRange(), // full range
                text: text, // target value here
            },
        ])

        codeEditor.pushUndoStop()
    }
}

/**
 * Represents an placeholder renderer for monaco editor
 * Roughly based on https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/codeEditor/browser/untitledTextEditorHint/untitledTextEditorHint.ts
 */
class PlaceholderContentWidget {
    static ID = 'editor.widget.placeholderHint';


    constructor(placeholder, editor) {
        this.placeholder = placeholder;
        this.editor = editor;
        // register a listener for editor code changes
        editor.onDidChangeModelContent(() => this.onDidChangeModelContent());
        // ensure that on initial load the placeholder is shown
        this.onDidChangeModelContent();
    }

    onDidChangeModelContent() {
        if (this.editor.getValue() === '') {
            this.editor.addContentWidget(this);
        } else {
            this.editor.removeContentWidget(this);
        }
    }

    getId() {
        return PlaceholderContentWidget.ID;
    }

    getDomNode() {
        if (!this.domNode) {
            this.domNode = fromHTML(`<div class="placeholder">`);
            this.domNode.style.pointerEvents = 'none'
            this.domNode.style.width = 'max-content';
            this.domNode.textContent = this.placeholder;
            this.domNode.style.fontStyle = 'italic';
            this.editor.applyFontInfo(this.domNode);
        }

        return this.domNode;
    }

    updatePlaceholder(placeholder) {
        if (!this.domNode) return;
        this.domNode.textContent = this.placeholder = placeholder;
    }

    getPosition() {
        return {
            position: { lineNumber: 1, column: 1 },
            preference: [monaco.editor.ContentWidgetPositionPreference.EXACT],
        };
    }

    dispose() {
        this.editor.removeContentWidget(this);
    }
}

require.config({ paths: { vs: 'dist/monaco-editor/min/vs' } });

window.addEventListener('load', e => Monaco.setupEventListeners());
window.addEventListener('color-scheme-changed', e => Monaco.updateTheme());