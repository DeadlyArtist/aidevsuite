class Tooltip {
    static tooltipAttributesSet = new Set(['tooltip', 'tooltip-url']);
    static tooltipAttributes = [];
    static tooltipQuery = "";
    static cachedHtmlsByUrl = {};
    static fetchPromisesByUrl = {};
    static currentElement = null;
    static keepTooltipsOpenKey = "q";
    static minDistanceToEdge = 6;
    static distanceToElement = 8;

    static tooltip = null;
    static tooltipStyle = null;

    static init() {
        Tooltip.tooltipAttributes = [...Tooltip.tooltipAttributesSet];
        Tooltip.tooltipQuery = Tooltip.tooltipAttributes.map(a => `[${a}]`).join(', ');
    }

    static setupEventListeners() {
        Tooltip.setupTooltips(document);

        document.addEventListener('scroll', Tooltip.updatePosition, true);
        window.addEventListener('resize', Tooltip.updatePosition, true);
        document.addEventListener('mousemove', Tooltip.onMousemove, true);

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
                        if (mutation.target === Tooltip.currentElement) {
                            Tooltip.updateTooltip();
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: Tooltip.tooltipAttributes });
    }

    static setupTooltips(element = document) {
        const elementsWithTooltip = [...element.querySelectorAll(Tooltip.tooltipQuery)];
        for (let elem of elementsWithTooltip) {
            elem.addEventListener('mouseenter', (e) => Tooltip.onMouseenter(e));
            elem.classList.add('tooltipTarget');
        }
    }

    static updatePosition() {
        if (!Tooltip.currentElement) return;
        Tooltip.positionTooltipRelativeTo(Tooltip.currentElement);
    }

    static positionTooltipRelativeTo(element) {
        let tooltipTop = 0;
        let tooltipLeft = 0;
        let elementRect = element.getBoundingClientRect();
        let tooltipRect = Tooltip.tooltip.getBoundingClientRect();
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
                }
            }
        }

        Tooltip.tooltip.setAttribute('tooltip-position', position);

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

            Tooltip.tooltip.style.top = tooltipTop + 'px';
            Tooltip.tooltip.style.left = Math.max(tooltipLeft, minDistanceToEdge) + 'px';
            Tooltip.tooltipStyle.innerHTML = "";
        } else {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distanceToElement;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distanceToElement;
            }
            Tooltip.tooltip.style.top = tooltipTop + 'px';

            let currentLeft = minDistanceToEdge;
            let newCenterIfLeft = minDistanceToEdge + tooltipRect.width / 2;
            let newCenterIfRight = window.innerWidth - tooltipRect.width / 2;
            if (Math.abs(elementXCenter - newCenterIfLeft) > Math.abs(elementXCenter - newCenterIfRight)) {
                // Closer to right than left.
                currentLeft = window.innerWidth - minDistanceToEdge - tooltipRect.width;
            }
            Tooltip.tooltip.style.left = currentLeft + 'px';
            let normalLeft = tooltipXLeftFromCenter;
            // (normal left - current left) / width + 50%
            let leftPercent = ((normalLeft - currentLeft) / tooltipRect.width) * 100 + 50;
            leftPercent = Math.max(10, Math.min(90, leftPercent));
            Tooltip.tooltipStyle.innerHTML = `#tooltip::after {
                left: ${leftPercent}% !important;
            }`;
        }
    }

    static async updateTooltip() {
        const element = Tooltip.currentElement;
        let attribute = null;
        let value = null;
        for (const attr of Tooltip.tooltipAttributes) {
            value = element.getAttribute(attr);
            if (value != null) {
                attribute = attr;
                break;
            }
        }

        if (attribute == 'tooltip') {
            Tooltip.smallTooltip(value);
        } else if (attribute == 'tooltip-url') {
            let url = value;
            if (Tooltip.cachedHtmlsByUrl[url]) {
                Tooltip.cardTooltip(Tooltip.cachedHtmlsByUrl[url]);
            } else if (Tooltip.fetchPromisesByUrl[url]) {
                // do nothing
            } else {
                Tooltip.smallTooltip("Loading...");

                Tooltip.fetchPromisesByUrl[url] = (async () => {
                    try {
                        Tooltip.cachedHtmlsByUrl[url] = await fetchText(url);
                    } catch (e) {
                        if (Tooltip.currentElement == element) {
                            Tooltip.smallTooltip("Error loading tooltip.");
                        }
                        return;
                    }

                    delete Tooltip.fetchPromisesByUrl[url];
                    if (Tooltip.currentElement == element) Tooltip.updateTooltip();
                })();
            }
        }

        if (Tooltip.currentElement) {
            Tooltip.tooltip.classList.remove('hide');
            Tooltip.updatePosition();
        }
    }

    static setTooltip(html) {
        Tooltip.tooltip.innerHTML = html;
    }

    static smallTooltip(html) {
        Tooltip.setTooltip(html);
        Tooltip.tooltip.classList.add('smallTooltip');
        Tooltip.tooltip.classList.remove('cardTooltip');
    }

    static cardTooltip(html) {
        Tooltip.setTooltip(html);
        Tooltip.tooltip.classList.remove('smallTooltip');
        Tooltip.tooltip.classList.add('cardTooltip');
    }

    static async onMouseenter(event) {
        if (isChildEvent(event)) return;

        let element = event.currentTarget;
        Tooltip.currentElement = element;
        Tooltip.updateTooltip();
    }

    static eventWithinDistance(event, element) {
        const buffer = 8; // Distance in pixels that is allowed
        const rect = element.getBoundingClientRect();

        // Get mouse position
        const mouseX = event.clientX;
        const mouseY = event.clientY;

        // Check if mouse is within `buffer` pixels of the element
        if (between(mouseY, rect.top - buffer, rect.bottom + buffer) &&
            between(mouseX, rect.left - buffer, rect.right + buffer)) {
            return true;
        }

        return false;
    }

    static onMousemove(event) {
        let currentElement = Tooltip.currentElement;
        if (!currentElement) return;
        if (currentElement.contains(event.toElement) || currentElement == event.toElement) return;
        if (pressedKeys[Tooltip.keepTooltipsOpenKey]) return;
        if (Tooltip.eventWithinDistance(event, currentElement)) return;

        Tooltip.tooltip.classList.add('hide');
        Tooltip.currentElement = null;
    }
}
Tooltip.init();

// Initialize Tooltip on script load
window.addEventListener('load', () => {
    Tooltip.tooltip = document.getElementById('tooltip');
    Tooltip.tooltipStyle = document.getElementById('tooltipStyle');
    Tooltip.setupEventListeners();
});
