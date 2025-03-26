function closeAllDialogs() {
    let dialogs = document.getElementsByClassName("dialog");
    for (let dialog of dialogs) {
        const closeButton = dialog.querySelector('.dialogCloseButton');
        if (closeButton && !dialog.classList.contains("hide")) closeButton.click();
        else dialog.classList.add("hide");
    }
}

function escapeDialogs(e) {
    if (e.key == "Escape") {
        closeAllDialogs();
    }
}

window.addEventListener("keyup", e => escapeDialogs(e));
