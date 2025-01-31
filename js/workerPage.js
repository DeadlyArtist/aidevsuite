class WorkerPage {
    static codeEditor = null;

    static adjustContentHeight() {
        const name = getPathPartFromHash(0);
        if (name != 'worker' || WorkerPage.codeEditor == null) return;

        const stickyElement = WorkerPage.introductionElement;
        const fillerElement = WorkerPage.contentElement;

        const availableHeight = getScrollingElement().clientHeight - 16;
        const stickyHeight = stickyElement.offsetHeight;
        const remainingHeight = availableHeight - stickyHeight;

        const newHeight = remainingHeight > 400 ? remainingHeight : 400;
        fillerElement.style.height = `${newHeight}px`;

        const codeBarHeight = WorkerPage.codeEditorContainer.querySelector('.codeBar').clientHeight;
        const originalMaxHeight = WorkerPage.codeEditor.originalMaxHeight;
        let maxHeight = newHeight - codeBarHeight - 16;
        WorkerPage.codeEditor.maxHeight = originalMaxHeight == 0 ? originalMaxHeight : Math.min(originalMaxHeight, maxHeight);
        WorkerPage.codeEditor.update();

        doScrollTick();
    }
}

function getWorkerPage() {
    const element = fromHTML(`<div>`);
    const introduction = fromHTML(`<div>`);
    WorkerPage.introductionElement = introduction;
    const title = fromHTML(`<h1>Worker Script`);
    introduction.appendChild(title);
    const paragraph = fromHTML(`<div>This script is where all of your code is executed.`);
    introduction.appendChild(paragraph);
    introduction.appendChild(hb(4));
    element.appendChild(introduction);
    Flow.clearMonacoContext();

    const content = fromHTML(`<div>`);
    WorkerPage.contentElement = content;
    const codeResult = CodeHelpers.createCodeEditor({
        placeholder: "Loading...",
        readOnly: true,
        language: 'javascript',
        showMinimap: true,
    });
    WorkerPage.codeEditorContainer = codeResult.codeEditorContainer;
    codeResult.codeEditorPromise.then(e => {
        WorkerPage.codeEditor = e;
        WorkerPage.adjustContentHeight();
    });
    content.appendChild(codeResult.codeEditorContainer);
    Flow.getWorkerScript().then(async code => {
        const editor = await codeResult.codeEditorPromise;
        editor.setValue(code);
        editor.update();
    });
    element.appendChild(content);

    return element;
}

window.addEventListener('load', e => {
    new ResizeSensor(document.querySelector('.container'), e => WorkerPage.adjustContentHeight());
});
window.addEventListener('resize', e => WorkerPage.adjustContentHeight());
window.addEventListener('pageloaded', e => WorkerPage.adjustContentHeight());