class Tooltip {
    static tooltipQuery = ".tooltipAnchor, [tooltip], [tooltip-url]";
    static cachedHtmlsByUrl = {};
    static fetchPromisesByUrl = {};
    static currentElement = null;
    static keepTooltipsOpenKey = "q";
    static minEdgeDistance = 6;

    static tooltip = null;
    static tooltipStyle = null;

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
                    if (mutation.attributeName === 'tooltip' || mutation.attributeName === 'tooltip-url') {
                        if (mutation.target === Tooltip.currentElement) {
                            Tooltip.updateTooltip();
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['tooltip', 'tooltip-url'] });
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
        let distance = 8;
        let position = 'top';
        let match = true;

        let elementXCenter = elementRect.left + elementRect.width / 2;
        let tooltipXLeftFromCenter = elementXCenter - tooltipRect.width / 2;
        let tooltipXRightFromCenter = elementXCenter + tooltipRect.width / 2;
        let elementYCenter = elementRect.top + elementRect.height / 2;
        let tooltipYTopFromCenter = elementYCenter - tooltipRect.height / 2;
        let tooltipYBottomFromCenter = elementYCenter + tooltipRect.height / 2;

        let yFitsTop = elementRect.top - tooltipRect.height - distance >= 0;
        let yFitsBottom = elementRect.bottom + tooltipRect.height + distance <= window.innerHeight;
        let xCenterFitsLeft = tooltipXLeftFromCenter >= 0;
        let xCenterFitsRight = tooltipXRightFromCenter <= window.innerWidth;
        let xCenterFits = xCenterFitsLeft && xCenterFitsRight;
        let xFitsLeft = elementRect.left - tooltipRect.width - distance >= 0;
        let xFitsRight = elementRect.right + tooltipRect.width + distance <= window.innerWidth;
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
                tooltipTop = elementRect.top - tooltipRect.height - distance;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distance;
                tooltipLeft = tooltipXLeftFromCenter;
            } else if (position === 'left') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.left - tooltipRect.width - distance;
            } else if (position === 'right') {
                tooltipTop = tooltipYTopFromCenter;
                tooltipLeft = elementRect.right + distance;
            }

            Tooltip.tooltip.style.top = tooltipTop + 'px';
            Tooltip.tooltip.style.left = Math.max(tooltipLeft, Tooltip.minEdgeDistance) + 'px';
            Tooltip.tooltipStyle.innerHTML = "";
        } else {
            if (position === 'top') {
                tooltipTop = elementRect.top - tooltipRect.height - distance;
            } else if (position === 'bottom') {
                tooltipTop = elementRect.bottom + distance;
            }
            Tooltip.tooltip.style.top = tooltipTop + 'px';

            let currentLeft = Tooltip.minEdgeDistance;
            let newCenterIfLeft = Tooltip.minEdgeDistance + tooltipRect.width / 2;
            let newCenterIfRight = window.innerWidth - tooltipRect.width / 2;
            if (Math.abs(elementXCenter - newCenterIfLeft) > Math.abs(elementXCenter - newCenterIfRight)) {
                // Closer to right than left.
                currentLeft = window.innerWidth - Tooltip.minEdgeDistance - tooltipRect.width;
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
        let tooltipAttribute = element.getAttribute('tooltip');
        if (tooltipAttribute == null) {
            let url = element.getAttribute('tooltip-url');
            let alreadyLoading = false;
            if (url) {
                if (Tooltip.fetchPromisesByUrl[url]) {
                    alreadyLoading = true;
                } else {
                    if (!Tooltip.cachedHtmlsByUrl[url]) {
                        Tooltip.tooltip.innerHTML = "Loading...";
                    }
                    try {
                        const fetchPromise = fetch(url);
                        Tooltip.fetchPromisesByUrl[url] = fetchPromise;
                        const response = await fetchPromise;
                        Tooltip.cachedHtmlsByUrl[url] = await response.text();
                        Tooltip.tooltip.innerHTML = Tooltip.cachedHtmlsByUrl[url];
                    } catch (e) {
                        Tooltip.tooltip.innerHTML = "Error loading tooltip.";
                    }

                    delete Tooltip.fetchPromisesByUrl[url];
                }
            }

            if (!alreadyLoading) {
                Tooltip.tooltip.classList.remove('smallTooltip');
                Tooltip.tooltip.classList.add('cardTooltip');
            }
        } else {
            Tooltip.tooltip.innerHTML = tooltipAttribute;
            Tooltip.tooltip.classList.add('smallTooltip');
            Tooltip.tooltip.classList.remove('cardTooltip');
        }

        if (Tooltip.currentElement) {
            Tooltip.tooltip.classList.remove('hide');
            Tooltip.updatePosition();
        }
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

// Initialize Tooltip on script load
window.addEventListener('load', () => {
    Tooltip.tooltip = document.getElementById('tooltip');
    Tooltip.tooltipStyle = document.getElementById('tooltipStyle');
    Tooltip.setupEventListeners();
});
