import { Core } from "@/app"
import { ConfigManager } from "@/utils/config"

declare const CONFIG: {
    removeClosedBN: boolean
    FilterClosedDuration: boolean
    improveTableStyle: boolean
    removeFadeEffect: boolean
    cleanURLAfterModalClose: boolean
}

function init() {
    ConfigManager.init()

    // perform patches as early as possible
    if (CONFIG.removeFadeEffect) {
        Core.patchFadeRemoval()
    }
    if (CONFIG.cleanURLAfterModalClose) {
        Core.patchModalClose()
    }

    const initCore = async () => {
        if (CONFIG.improveTableStyle) {
            // inject styles early to avoid FOUC
            Core.injectStyles()
        }
        if (CONFIG.removeClosedBN) {
            if (CONFIG.FilterClosedDuration) {
                await Core.addFilterButton()
                await Core.removeClosedRows(true)
            } else {
                await Core.removeClosedRows(false)
            }
        }
        if (CONFIG.improveTableStyle) {
            await Core.improveTablesDisplay()
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initCore)
    } else {
        initCore()
    }

    // listen 2 url changes (if BN Management uses SPA routing)
    if (window.MutationObserver) {
        let lastUrl = location.href
        new MutationObserver(() => {
            const url = location.href
            if (url !== lastUrl) {
                lastUrl = url
                setTimeout(() => {
                    initCore()
                }, 500)
            }
        }).observe(document, { subtree: true, childList: true })
    }
}

// GM_addStyle maybe

init()
