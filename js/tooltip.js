class Tooltip {
    static tooltipAttributesSet = new Set(['tooltip', 'tooltip-url']);
    static tooltipAttributes = [];
    static tooltipQuery = "";
    static cachedHtmlsByUrl = {};
    static fetchPromisesByUrl = {};
    static keepTooltipsOpenKey = "q";
    static minDistanceToEdge = 6;
    static distanceToElement = 8;
    static leaveBuffer = 8;
    static tooltipShowDelay = 200;
    static keepTooltipsOpenOnHover = false;

    static tooltipContainer;
    static tooltipStyleContainer;
    static tooltipStack = [];
    static tooltipsByTarget = new Map();

    static closeAll() {
        Tooltip.tooltipStack = [];
        Tooltip.tooltipsByTarget.clear();
        Tooltip.tooltipContainer.innerHTML = "";
        Tooltip.tooltipStyleContainer.innerHTML = "";
    }

    static get currentTooltip() {
        if (this.tooltipStack.length == 0) return null;
        return this.tooltipStack[this.tooltipStack.length - 1];
    }

    static get currentTarget() {
        return Tooltip.currentTooltip?.target;
    }

    static init() {
        document.documentElement.classList.add("colorTooltips");

        Tooltip.tooltipAttributes = [...Tooltip.tooltipAttributesSet];
        Tooltip.tooltipQuery = Tooltip.tooltipAttributes.map(a => `[${a}]`).join(', ');
    }

    static setupEventListeners() {
        Tooltip.tooltipContainer = document.getElementById('tooltips');
        Tooltip.tooltipStyleContainer = document.getElementById('tooltipStyles');

        Tooltip.setupTooltips();

        document.addEventListener('scroll', Tooltip.updateAllPositions, true);
        window.addEventListener('resize', Tooltip.updateAllPositions, true);
        document.addEventListener('mousemove', Tooltip.onMousemove, true);
        document.addEventListener('mousemove-polled', Tooltip.onMousemove, true);

        // MutationObserver to watch for newly added elements and attribute changes
        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            Tooltip.setupTooltips(node);
                        }
                    });
                } else if (mutation.type === 'attributes') {
                    if (Tooltip.tooltipAttributesSet.has(mutation.attributeName)) {
                        Tooltip.updateTooltip(Tooltip.tooltipsByTarget.get(mutation.target));
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: Tooltip.tooltipAttributes });
    }

    static setupTooltips(element = document.documentElement) {
        const elementsWithTooltip = [...element.querySelectorAll(Tooltip.tooltipQuery)];
        if (element.matches(Tooltip.tooltipQuery)) elementsWithTooltip.push(element);
        for (let elem of elementsWithTooltip) {
            elem.addEventListener('mouseenter', (e) => Tooltip.onMouseenter(e));
            elem.classList.add('tooltipTarget');
        }
    }

    static exists(tooltip) {
        return Tooltip.tooltipsByTarget.has(tooltip?.target);
    }

    static updateAllPositions() {
        let counter = 0;
        for (let tooltip of Tooltip.tooltipStack) Tooltip.updatePosition(tooltip, counter++);
    }

    static updatePosition(tooltip, index) {
        if (!Tooltip.exists(tooltip)) return;

        let element = tooltip.target;
        let tooltipElement = tooltip.element;
        tooltipElement.classList.remove('hide');
        let tooltipTop = 0;
        let tooltipLeft = 0;
        let elementRect = element.getBoundingClientRect();
        let tooltipRect = tooltipElement.getBoundingClientRect();
        let minDistanceToEdge = Tooltip.minDistanceToEdge;
        let distanceToElement = Tooltip.distanceToElement;
        let position = 'top';
        let match = true;

        let elementXCenter = elementRect.left + elementRect.width / 2;
        let tooltipXLeftFromCenter = elementXCenter - tooltipRect.width / 2;
        let tooltipXRightFromCenter = elementXCenter + tooltipRect.width / 2;
        let elementYCenter = elementRect.top + elementRect.height / 2;
        let tooltipYTopFromCenter = elementYCenter - tooltipRect.height / 2;
        let tooltipYBottomFromCenter = elementYCenter + tooltipRect.height / 2;

        let yFitsTop = elementRect.top - tooltipRect.height - distanceToElement >= 0;
        let yFitsBottom = elementRect.bottom + tooltipRect.height + distanceToElement <= window.innerHeight;
        let xCenterFitsLeft = tooltipXLeftFromCenter >= 0;
        let xCenterFitsRight = tooltipXRightFromCenter <= window.innerWidth;
        let xCenterFits = xCenterFitsLeft && xCenterFitsRight;
        let xFitsLeft = elementRect.left - tooltipRect.width - distanceToElement >= 0;
        let xFitsRight = elementRect.right + tooltipRect.width + distanceToElement <= window.innerWidth;
        let yCenterFitsTop = tooltipYTopFromCenter >= 0;
        let yCenterFitsBottom = tooltipYBottomFromCenter <= window.innerHeight;
        let yCenterFits = yCenterFitsTop && yCenterFitsBottom;

        if (xCenterFits) {
            if (!yFitsTop) {
                if (yFitsBottom) {
                    position = 'bottom';
                } else if (yCenterFits) {
                    if (xFitsLeft) {
                        position = 'left';
                    } else if (xFitsRight) {
                        position = 'right';
                    }
                }
            }
        } else {
            match = false;
            if (!yFitsTop) {
                if (yFitsBottom) {
                    position = 'bottom';
                } else {
                    position = 'bottom'; // so you can at least read the start
                }
            }
        }

        tooltipElement.setAttribute('tooltip-position', position);

        if (match) {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distanceToElement;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distanceToElement;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'left') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.left - tooltipRect.width - distanceToElement;
            } else if (position === 'right') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.right + distanceToElement;
            }

            tooltipElement.style.top = tooltipTop + 'px';
            tooltipElement.style.left = Math.max(tooltipLeft, minDistanceToEdge) + 'px';
            tooltip.styleElement.innerHTML = "";
        } else {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distanceToElement;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distanceToElement;
            }
            tooltipElement.style.top = tooltipTop + 'px';

            let currentLeft = minDistanceToEdge;
            let newCenterIfLeft = minDistanceToEdge + tooltipRect.width / 2;
            let newCenterIfRight = window.innerWidth - tooltipRect.width / 2;
            if (Math.abs(elementXCenter - newCenterIfLeft) > Math.abs(elementXCenter - newCenterIfRight)) {
                // Closer to right than left.
                currentLeft = window.innerWidth - minDistanceToEdge - tooltipRect.width;
            }
            tooltipElement.style.left = currentLeft + 'px';
            let normalLeft = tooltipXLeftFromCenter;
            // (normal left - current left) / width + 50%
            let leftPercent = ((normalLeft - currentLeft) / tooltipRect.width) * 100 + 50;
            leftPercent = Math.max(10, Math.min(90, leftPercent));
            tooltip.styleElement.innerHTML = `#tooltip-${index}::after {
                left: ${leftPercent}% !important;
            }`;
        }
    }

    static async updateTooltip(tooltip) {
        if (!Tooltip.exists(tooltip)) return;

        let attribute = null;
        let value = null;
        for (const attr of Tooltip.tooltipAttributes) {
            value = tooltip.target.getAttribute(attr);
            if (value != null) {
                attribute = attr;
                break;
            }
        }

        if (attribute == 'tooltip') {
            Tooltip.smallTooltip(tooltip, value);
        } else if (attribute == 'tooltip-url') {
            let url = value;
            if (Tooltip.cachedHtmlsByUrl[url]) {
                Tooltip.cardTooltip(tooltip, Tooltip.cachedHtmlsByUrl[url]);
            } else if (Tooltip.fetchPromisesByUrl[url]) {
                // do nothing
            } else {
                Tooltip.smallTooltip(tooltip, "Loading...");

                Tooltip.fetchPromisesByUrl[url] = (async () => {
                    try {
                        Tooltip.cachedHtmlsByUrl[url] = await fetchText(url);
                    } catch (e) {
                        Tooltip.smallTooltip(tooltip, "Error loading tooltip.");
                        return;
                    }

                    delete Tooltip.fetchPromisesByUrl[url];
                    Tooltip.updateTooltip(tooltip);
                })();
            }
        }
    }

    static addTooltip(target) {
        const tooltipElement = fromHTML(`<div id="tooltip-${Tooltip.tooltipStack.length}" class="tooltip hide">`);
        const styleElement = document.createElement('style');
        Tooltip.tooltipContainer.appendChild(tooltipElement);
        Tooltip.tooltipStyleContainer.appendChild(styleElement);
        let tooltip = { element: tooltipElement, styleElement, target: target, init: false, };
        Tooltip.tooltipStack.push(tooltip);
        Tooltip.tooltipsByTarget.set(target, tooltip);
        Tooltip.updateTooltip(tooltip);
        return tooltip;
    }

    static removeCurrentTooltip() {
        let tooltip = Tooltip.currentTooltip;
        if (!tooltip) return;
        Tooltip.tooltipsByTarget.delete(tooltip.target);
        Tooltip.tooltipStack.pop();
        tooltip.element.remove();
        tooltip.styleElement.remove();
    }

    static setTooltip(tooltip, elementOrHtml) {
        if (!Tooltip.exists(tooltip)) return;
        if (isString(elementOrHtml)) tooltip.element.innerHTML = elementOrHtml;
        else {
            tooltip.element.innerHTML = '';
            tooltip.element.appendChild(elementOrHtml);
        }

        if (!tooltip.init) {
            tooltip.init = true;
            setTimeout(() => Tooltip.updateAllPositions(), Tooltip.tooltipShowDelay)
        } else {
            Tooltip.updateAllPositions();
        }
    }

    static smallTooltip(tooltip, html) {
        if (!Tooltip.exists(tooltip)) return;
        Tooltip.setTooltip(tooltip, html);
        tooltip.element.classList.add('smallTooltip');
        tooltip.element.classList.remove('cardTooltip');
    }

    static cardTooltip(tooltip, html) {
        if (!Tooltip.exists(tooltip)) return;
        Tooltip.setTooltip(tooltip, html);
        tooltip.element.classList.remove('smallTooltip');
        tooltip.element.classList.add('cardTooltip');
    }

    static onMouseenter(event) {
        if (isChildEvent(event)) return;
        Tooltip.tryAddTooltip(event.currentTarget);
    }

    static tryAddTooltip(target) {
        if (pressedKeys["Escape"]) return;
        if (Tooltip.tooltipsByTarget.has(target)) return;
        if (Tooltip.currentTooltip && !Tooltip.currentTooltip.element.contains(target)) return;
        Tooltip.addTooltip(target);
    }

    static eventWithinDistance(event, element, distance = Tooltip.leaveBuffer) {
        const rect = element.getBoundingClientRect();

        // Get mouse position
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Check if mouse is within `buffer` pixels of the element
        if (between(mouseY, rect.top - distance, rect.bottom + distance) &&
            between(mouseX, rect.left - distance, rect.right + distance)) {
            return true;
        }

        return false;
    }

    static onMousemove(event) {
        let target = event.target.closest(Tooltip.tooltipQuery);
        if (target) Tooltip.tryAddTooltip(target);

        if (pressedKeys[Tooltip.keepTooltipsOpenKey]) return;

        let currentTarget = Tooltip.currentTarget;
        if (!currentTarget) return;
        if (currentTarget.contains(event.target) || currentTarget == event.target) return;
        if (Tooltip.eventWithinDistance(event, currentTarget)) return;

        if (Tooltip.keepTooltipsOpenOnHover) {
            if (Tooltip.eventWithinDistance(event, Tooltip.currentTooltip.element)) return;
        }

        Tooltip.removeCurrentTooltip();
        Tooltip.onMousemove(event);
    }

    static escapeTooltips(e) {
        if (e.key == "Escape") {
            Tooltip.closeAll();
        }
    }
}
Tooltip.init();

// Initialize Tooltip on script load
window.addEventListener('load', () => {
    Tooltip.setupEventListeners();
});

window.addEventListener("keydown", e => Tooltip.escapeTooltips(e));
