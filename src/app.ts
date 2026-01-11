import { DomWaiter } from "./utils/dom"

declare global {
    interface Window {
        $: any
    }
}

export class Core {
    static async removeClosedRows() {
        const rows = await DomWaiter.waitForBNTables()
        if (!rows) {
            console.warn("[BNM-Enhanced] No BNs rows found")
            return
        }

        console.log(`[BNM-Enhanced] Found ${rows.length} BNs rows`)

        const tables = document.querySelectorAll("table.table-dark")
        tables.forEach((table, tableIndex) => {
            const tbody = table.querySelector("tbody")
            if (!tbody) return

            const rowsToRemove = tbody.querySelectorAll('tr:has(span.badge-danger[data-toggle="tooltip"][title="closed"])')

            console.log(`[BNM-Enhanced] Table ${tableIndex + 1}: Removing ${rowsToRemove.length} closed rows`)

            // do remove
            rowsToRemove.forEach((tr) => {
                try {
                    tr.remove()
                } catch (e) {
                    console.error("[BNM-Enhanced] Error removing row:", e)
                }
            })

            // add message if no open BNs
            setTimeout(() => {
                if (tbody && tbody.children.length === 0) {
                    // check if message already exists
                    const existingMsg = tbody.querySelector("tr td.text-muted")
                    if (!existingMsg) {
                        const message = document.createElement("tr")
                        message.innerHTML = `<td colspan="1" class="text-center text-muted">No open BNs in this mode</td>`
                        tbody.appendChild(message)
                    }
                } else if (tbody && tbody.children.length > 0) {
                    // remove message if exists
                    const existingMsg = tbody.querySelector("tr td.text-muted")
                    if (existingMsg && existingMsg.textContent.includes("No open BNs")) {
                        existingMsg.closest("tr")?.remove()
                    }
                }
            }, 100)
        })
    }

    static injectStyles() {
        if (document.querySelector("#bnm-enhanced-styles")) return

        const style = document.createElement("style")
        style.id = "bnm-enhanced-styles"
        style.textContent = `
        html, body {
            scrollbar-gutter: stable both-edges;
        }

        a#mgsite {
            position: absolute;
        }

        /* flex tables vertically */
        section div.row[mode="out-in"] {
            flex-direction: column !important;
        }

        .bn-cards-grid {
            --card-min-width: 250px;
            --card-max-width: 300px;
            --gutter-x: 1rem;
            --gutter-y: 1rem;

            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min-width), 100%), 1fr));
            margin-top: var(--gutter-y);
            gap: var(--gutter-y) var(--gutter-x);
            .card-col {
                width: 100%;
            }
        }

        .bn-mode-section {
            width: 100%;
            padding: 0 1rem;

            .mode-title {
                margin-bottom: 1rem;
            }

            .bn-cards-grid {
                width: 100%;
            }
        }

        .bn-cards-grid .home-card {
            height: 100%;
            margin-bottom: 0 !important;
            overflow: hidden;
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2) !important;
            min-height: 55px !important;
            width: 100% !important;
            padding-left: .9rem !important;
            transition: all 0.2s ease;
            cursor: pointer;

            img.card-avatar-img {
                top: 0;
            }

            span[data-original-title="view request info"] {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100%;
            }
        }

        .bn-cards-grid .home-card:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4) !important;
            z-index: 10;
        }

        .bn-cards-grid .home-card.bn-closed {
            opacity: 0.6;
        }

        .bn-cards-grid .home-card.bn-closed:hover {
            transform: translateY(-1px) !important;
        }

        /* Remove modal fade animation */
        #userInfo.modal,
        #userInfo.modal .modal-dialog,
        .modal-backdrop {
            transition: none !important;
            animation: none !important;
        }

        .modal-backdrop {
            opacity:  0.5 !important;
        }
        `
        document.head.appendChild(style)
    }

    static async improveTablesDisplay() {
        await DomWaiter.waitForBNTables()

        this.injectStyles()

        const tablesContainer = document.querySelector("section.card.card-body .row.align-items-start")
        if (!tablesContainer) {
            console.log("[BNM-Enhanced] Tables container not found")
            return
        }

        const tables = tablesContainer.querySelectorAll("table.table-dark")

        tables.forEach((table) => {
            const thead = table.querySelector("thead")
            const modeName = thead ? thead.textContent.trim() : ""
            const tbody = table.querySelector("tbody")
            const rows = tbody ? tbody.querySelectorAll("tr") : []

            // create new container
            const container = document.createElement("div")
            container.className = "bn-mode-section mb-5"

            // add mode title
            if (modeName) {
                const titleDiv = document.createElement("div")
                titleDiv.className = "mode-title mb-3 pb-2 border-bottom border-secondary"
                titleDiv.innerHTML = `
                    <h5 class="text-light mb-0">
                        ${modeName} (${rows.length} BNs)
                    </h5>
                `
                container.appendChild(titleDiv)
            }

            // add cards grid
            const cardsContainer = document.createElement("div")
            cardsContainer.className = "bn-cards-grid"
            container.appendChild(cardsContainer)

            // move rows to cards
            rows.forEach((row) => {
                const cardDiv = row.querySelector(".home-card")
                if (!cardDiv) return

                // check if closed
                const isClosed = cardDiv.querySelector('.badge-danger[title="closed"]')

                if (isClosed) {
                    cardDiv.classList.add("bn-closed")
                } else {
                    cardDiv.classList.add("bn-open")
                }

                // create card column
                const cardCol = document.createElement("div")
                cardCol.className = "card-col"

                cardCol.appendChild(cardDiv)
                cardsContainer.appendChild(cardCol)
            })

            table.parentNode?.replaceChild(container, table)
        })

        console.log("[BNM-Enhanced] Tables display improved")
    }

    static modalClosePatched = false

    static patchModalClose() {
        if (this.modalClosePatched) return
        this.modalClosePatched = true

        const checkJQuery = setInterval(() => {
            if (window.$ && window.$.fn && window.$.fn.modal) {
                clearInterval(checkJQuery)

                const addListener = () => {
                    const modal = window.$("#userInfo")
                    if (modal.length > 0) {
                        // remove previous listener to avoid duplication
                        modal.off("hidden.bs.modal.bnmenhanced")

                        // listen for modal close event
                        modal.on("hidden.bs.modal.bnmenhanced", () => {
                            const url = new URL(window.location.href)
                            if (url.searchParams.has("id")) {
                                // remove id parameter
                                url.searchParams.delete("id")
                                // update URL using history API
                                window.history.pushState({}, "", url.pathname + url.search)
                                console.log("[BNM-Enhanced] URL cleaned after modal close")
                            }
                        })

                        console.log("[BNM-Enhanced] Modal close listener added")
                    } else {
                        setTimeout(addListener, 500)
                    }
                }

                addListener()

                // listen for backdrop click
                window.$(document).on("click.bnmenhanced", ".modal-backdrop", () => {
                    setTimeout(() => {
                        const url = new URL(window.location.href)
                        if (url.searchParams.has("id")) {
                            url.searchParams.delete("id")
                            window.history.pushState({}, "", url.pathname + url.search)
                            console.log("[BNM-Enhanced] URL cleaned after backdrop click")
                        }
                    }, 100)
                })

                // listen for close button
                window.$(document).on("click.bnmenhanced", '#userInfo [data-dismiss="modal"]', () => {
                    setTimeout(() => {
                        const url = new URL(window.location.href)
                        if (url.searchParams.has("id")) {
                            url.searchParams.delete("id")
                            window.history.pushState({}, "", url.pathname + url.search)
                            console.log("[BNM-Enhanced] URL cleaned after close button")
                        }
                    }, 100)
                })
            }
        }, 100)

        setTimeout(() => clearInterval(checkJQuery), 10000)
    }

    static fadeRemovalPatched = false

    static patchFadeRemoval() {
        if (this.fadeRemovalPatched) return
        this.fadeRemovalPatched = true

        // intercept setAttribute
        const originalSetAttribute = Element.prototype.setAttribute
        Element.prototype.setAttribute = function (name, value) {
            if (name === "class" && typeof value === "string" && (this.id === "userInfo" || this.classList.contains("modal-backdrop"))) {
                value = value
                    .replace(/\bfade\b/g, "")
                    .replace(/\s+/g, " ")
                    .trim()
            }
            return originalSetAttribute.call(this, name, value)
        }

        // intercept classList.add
        const originalClassListAdd = DOMTokenList.prototype.add
        DOMTokenList.prototype.add = function (...tokens) {
            // find the corresponding element
            const element = Array.from(document.querySelectorAll("*")).find((el) => el.classList === this)

            if (element && (element.id === "userInfo" || element.classList.contains("modal-backdrop"))) {
                tokens = tokens.filter((token) => token !== "fade")
            }

            if (tokens.length > 0) {
                return originalClassListAdd.apply(this, tokens)
            }
        }

        // MutationObserver as a backup
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.attributeName === "class") {
                    const target = mutation.target as Element
                    if ((target.id === "userInfo" || target.classList.contains("modal-backdrop")) && target.classList.contains("fade")) {
                        target.classList.remove("fade")
                    }
                }

                if (mutation.type === "childList") {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && (node as Element).classList && (node as Element).classList.contains("modal-backdrop")) {
                            ;(node as Element).classList.remove("fade")
                        }
                    })
                }
            })
        })

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ["class"],
            childList: true,
            subtree: true,
        })

        console.log("[BNM-Enhanced] Fade removal patched")
    }
}
