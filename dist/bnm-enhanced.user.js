// ==UserScript==
// @name         BNM-Enhanced
// @namespace    URL
// @version      0.4.2
// @description  enhance the BN-Management experience with additional features and improved UI.
// @author       Sisyphus
// @license      MIT
// @homepageURL  https://github.com/SisypheOvO
// @match        https://bn.mappersguild.com/*
// @run-at       document-end
// @grant        none
// @downloadURL https://raw.githubusercontent.com/SisypheOvO/BNM-Enhanced/main/dist/bnm-enhanced.user.js
// @updateURL https://raw.githubusercontent.com/SisypheOvO/BNM-Enhanced/main/dist/bnm-enhanced.user.js
// ==/UserScript==

// ============================================
// Config Options - You can modify the feature toggles here
// ============================================
const CONFIG = {
    // Remove closed BNs from the list
    removeClosedBN: true,

    // Add a Selector for filtering closed BNs older than a certain number of days
    // Only works if "removeClosedBN" is set to true
    FilterClosedDuration: true,

    // Improve the table style to a card grid layout
    improveTableStyle: true,

    // Remove fade-in and fade-out effects from modals
    removeFadeEffect: true,

    // Clean URL after closing modals to prevent unwanted query parameters
    cleanURLAfterModalClose: true
};
// ============================================


(function () {
    'use strict';

    class DomWaiter {
        static waitForElement(selector, timeout = 5000) {
            return new Promise((resolve) => {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    resolve(elements);
                    return;
                }
                let timer = null;
                const observer = new MutationObserver(() => {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        observer.disconnect();
                        if (timer !== null)
                            clearTimeout(timer);
                        resolve(elements);
                    }
                });
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                });
                timer = window.setTimeout(() => {
                    observer.disconnect();
                    console.warn(`[DomWaiter] Timeout waiting for: ${selector}`);
                    resolve(null);
                }, timeout);
            });
        }
        static waitForBNTables(timeout = 5000) {
            const selector = `table.table-dark tbody tr`;
            return this.waitForElement(selector, timeout);
        }
    }

    const STORAGE_KEY = 'bnm-enhanced-filter-config';
    class ConfigManager {
        static init() {
            this.loadFromStorage();
        }
        static loadFromStorage() {
            try {
                const saved = localStorage.getItem(STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this.config = { ...this.config, ...parsed };
                }
            }
            catch (e) {
                console.error('[BNM-Enhanced] Failed to load config from storage:', e);
            }
        }
        static saveToStorage() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
            }
            catch (e) {
                console.error('[BNM-Enhanced] Failed to save config to storage:', e);
            }
        }
        static getFilterDays() {
            return this.config.filterDays;
        }
        static setFilterDays(days) {
            this.config.filterDays = days;
            this.saveToStorage();
        }
    }
    ConfigManager.config = {
        filterDays: 100, // default to 100 days
    };

    class ApiClient {
        static async fetchRelevantInfo() {
            try {
                const response = await fetch("https://bn.mappersguild.com/api/relevantInfo");
                const data = await response.json();
                this.cache.clear();
                // traverse the API response to populate the cache
                if (data.allUsersByMode && Array.isArray(data.allUsersByMode)) {
                    data.allUsersByMode.forEach((modeGroup) => {
                        if (modeGroup.users && Array.isArray(modeGroup.users)) {
                            modeGroup.users.forEach((user) => {
                                const isClosed = user.requestStatus?.includes("closed") || false;
                                this.cache.set(user.osuId, {
                                    osuId: user.osuId,
                                    username: user.username,
                                    requestStatus: user.requestStatus || [],
                                    lastOpenedForRequests: user.lastOpenedForRequests,
                                    isClosed: isClosed,
                                });
                            });
                        }
                    });
                }
                console.log(`[BNM-Enhanced] Fetched info for ${this.cache.size} users`);
                return this.cache;
            }
            catch (e) {
                console.error("[BNM-Enhanced] Failed to fetch relevant info:", e);
                return this.cache;
            }
        }
        static getBNInfo(osuId) {
            return this.cache.get(osuId);
        }
        static getCache() {
            return this.cache;
        }
        static clearCache() {
            this.cache.clear();
        }
    }
    ApiClient.cache = new Map();

    class DateUtils {
        static parseOsuDate(dateStr) {
            try {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
            }
            catch {
                return null;
            }
        }
        static daysSince(date) {
            const now = new Date();
            const diffTime = now.getTime() - date.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            return Math.max(0, diffDays); // insure non-negative
        }
        static formatDate(dateStr) {
            const date = this.parseOsuDate(dateStr);
            if (!date)
                return "Unknown";
            const days = this.daysSince(date);
            return `${days} days ago (${date.toLocaleDateString()})`;
        }
    }

    class Core {
        static async addFilterButton() {
            if (this.filterButtonAdded)
                return;
            await DomWaiter.waitForBNTables();
            const filterContainer = document.createElement("div");
            filterContainer.className = "bn-filter-container mb-3 p-2 px-3 bg-dark rounded";
            filterContainer.innerHTML = `
            <div class="d-flex align-items-center gap-3 flex-wrap">
                <label class="text-light">
                    <span class="me-2">Closed Days Filter:</span>
                    <input type="number"
                           class="form-control form-control-sm d-inline-block"
                           style="width: 80px;"
                           min="1"
                           max="999"
                           value="${ConfigManager.getFilterDays()}"
                           id="bn-filter-days">
                    <span class="ms-2">days</span>
                </label>
                <span class="text-muted small">(BNs closed for more than this number of days will be retained)</span>
                <button class="btn btn-sm btn-primary" id="bn-apply-filter">Apply Filter</button>
            </div>
        `;
            const tablesContainer = document.querySelector("section.card.card-body .row.align-items-start");
            if (tablesContainer) {
                tablesContainer.parentElement?.insertBefore(filterContainer, tablesContainer);
            }
            const input = document.getElementById("bn-filter-days");
            const applyBtn = document.getElementById("bn-apply-filter");
            if (input && applyBtn) {
                const applyFilter = () => {
                    const days = parseInt(input.value);
                    if (!isNaN(days) && days > 0) {
                        ConfigManager.setFilterDays(days);
                        window.location.reload();
                    }
                };
                input.addEventListener("keypress", (e) => {
                    if (e.key === "Enter") {
                        applyFilter();
                    }
                });
                applyBtn.addEventListener("click", applyFilter);
            }
            this.filterButtonAdded = true;
        }
        static async removeClosedRows(useDateFilter = false) {
            const rows = await DomWaiter.waitForBNTables();
            if (!rows) {
                console.warn("[BNM-Enhanced] No BNs rows found");
                return;
            }
            if (useDateFilter) {
                await ApiClient.fetchRelevantInfo();
            }
            console.log(`[BNM-Enhanced] Found ${rows.length} BNs rows`);
            const tables = document.querySelectorAll("table.table-dark");
            const filterDays = ConfigManager.getFilterDays();
            for (const [tableIndex, table] of tables.entries()) {
                const tbody = table.querySelector("tbody");
                if (!tbody)
                    continue;
                const rowsToRemove = [];
                const rowsKept = [];
                const allRows = tbody.querySelectorAll("tr");
                for (const row of allRows) {
                    const closedBadge = row.querySelector('span.badge.bg-danger[data-bs-original-title="closed"]');
                    const isClosed = !!closedBadge;
                    if (isClosed) {
                        if (useDateFilter) {
                            // then compare lastOpenedForRequests with filterDays to decide remove or keep
                            const homeCard = row.querySelector(".home-card");
                            let osuId = null;
                            let username = null;
                            // get info from card
                            if (homeCard) {
                                const userLink = homeCard.querySelector('a[href*="users/"]');
                                if (userLink) {
                                    username = userLink.textContent?.trim() || null;
                                    const href = userLink.getAttribute("href");
                                    const match = href?.match(/users[/=](\d+)/);
                                    if (match)
                                        osuId = parseInt(match[1]);
                                }
                                if (!osuId) {
                                    const avatarImg = homeCard.querySelector("img.card-avatar-img");
                                    if (avatarImg) {
                                        const src = avatarImg.getAttribute("src");
                                        const match = src?.match(/https:\/\/a\.ppy\.sh\/(\d+)/);
                                        if (match)
                                            osuId = parseInt(match[1]);
                                    }
                                }
                                if (!osuId && username) {
                                    for (const [id, info] of ApiClient.getCache().entries()) {
                                        if (info.username === username) {
                                            osuId = id;
                                            break;
                                        }
                                    }
                                }
                            }
                            if (osuId) {
                                const bnInfo = ApiClient.getBNInfo(osuId);
                                if (bnInfo) {
                                    if (bnInfo.isClosed && bnInfo.lastOpenedForRequests) {
                                        const daysSinceLastOpen = DateUtils.daysSince(new Date(bnInfo.lastOpenedForRequests));
                                        const lastOpenDate = new Date(bnInfo.lastOpenedForRequests).toLocaleDateString();
                                        console.log(`[BNM-Enhanced] ${bnInfo.username} (${osuId}):
                                        Last opened: ${lastOpenDate}
                                        Days since: ${daysSinceLastOpen}
                                        Filter days: ${filterDays}
                                        Action: ${daysSinceLastOpen <= filterDays ? "REMOVE (recently closed)" : "KEEP (long closed)"}`);
                                        if (daysSinceLastOpen <= filterDays) {
                                            rowsToRemove.push(row);
                                        }
                                        else {
                                            rowsKept.push(row);
                                        }
                                    }
                                    else if (bnInfo.isClosed && !bnInfo.lastOpenedForRequests) {
                                        console.log(`[BNM-Enhanced] ${bnInfo.username} is closed but no lastOpened date, keeping`);
                                        rowsKept.push(row);
                                    }
                                    else {
                                        console.log(`[BNM-Enhanced] ${bnInfo.username} is not closed but has closed badge?`);
                                        rowsKept.push(row);
                                    }
                                }
                                else {
                                    console.log(`[BNM-Enhanced] No API info for osuId ${osuId} (${username}), removing closed row by default`);
                                    rowsToRemove.push(row);
                                }
                            }
                            else {
                                console.log(`[BNM-Enhanced] Could not extract osuId for ${username || "unknown user"}, removing closed row by default`);
                                rowsToRemove.push(row);
                            }
                        }
                        else {
                            rowsToRemove.push(row);
                        }
                    }
                    else {
                        rowsKept.push(row);
                    }
                }
                console.log(`[BNM-Enhanced] Table ${tableIndex + 1}:
                Total: ${allRows.length}
                Closed: ${rowsToRemove.length + rowsKept.length}
                → Removing: ${rowsToRemove.length} (recently closed)
                → Keeping: ${rowsKept.length} (long closed + open)`);
                // do remove
                rowsToRemove.forEach((tr) => {
                    try {
                        tr.remove();
                    }
                    catch (e) {
                        console.error("[BNM-Enhanced] Error removing row:", e);
                    }
                });
                // add message if no open BNs
                setTimeout(() => {
                    if (tbody && tbody.children.length === 0) {
                        // check if message already exists
                        const existingMsg = tbody.querySelector("tr td.text-muted");
                        if (!existingMsg) {
                            const message = document.createElement("tr");
                            message.innerHTML = `<td colspan="1" class="text-center text-muted">No open BNs in this mode</td>`;
                            tbody.appendChild(message);
                        }
                    }
                    else if (tbody && tbody.children.length > 0) {
                        // remove message if exists
                        const existingMsg = tbody.querySelector("tr td.text-muted");
                        if (existingMsg && existingMsg.textContent.includes("No open BNs")) {
                            existingMsg.closest("tr")?.remove();
                        }
                    }
                }, 100);
            }
        }
        static injectStyles() {
            if (document.querySelector("#bnm-enhanced-styles"))
                return;
            const style = document.createElement("style");
            style.id = "bnm-enhanced-styles";
            style.textContent = `
        html, body {
            scrollbar-gutter: stable both-edges;
            min-width: 330px !important;
        }

        a#mgsite {
            position: absolute;
        }

        section div.row[mode="out-in"] {
            flex-direction: column !important;
        }

        .col-6.col-md-3 {
            width: 100% !important;
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
            min-width: 220px !important;
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

        .bn-filter-container {
            background: #1a2623 !important;
            border: 1px solid #1a201f;
            border-radius: 8px !important;
            margin-bottom: 1rem 0 !important;
            margin-left: 1rem !important;
            margin-right: 1rem !important;
        }

        .bn-filter-container .form-control {
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #fff;
            text-align: center;
        }

        .bn-filter-container .form-control:focus {
            border-color: #304844;
            box-shadow: 0 0 0 0.25rem rgba(48, 72, 68, 0.25);
        }

        .bn-filter-container .btn-primary {
            background: linear-gradient(45deg, #304844, #243633);
            border: none;
            padding: 0.375rem 1.5rem;
            font-weight: 500;
            transition: transform 0.2s;
        }

        .bn-filter-container .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 10px #293d3a;
        }
        `;
            document.head.appendChild(style);
        }
        static async improveTablesDisplay() {
            await DomWaiter.waitForBNTables();
            const tablesContainer = document.querySelector("section.card.card-body .row.align-items-start");
            if (!tablesContainer) {
                console.log("[BNM-Enhanced] Tables container not found");
                return;
            }
            const tables = tablesContainer.querySelectorAll("table.table-dark");
            tables.forEach((table) => {
                const thead = table.querySelector("thead");
                const modeName = thead ? thead.textContent.trim() : "";
                const tbody = table.querySelector("tbody");
                const rows = tbody ? tbody.querySelectorAll("tr") : [];
                // create new container
                const container = document.createElement("div");
                container.className = "bn-mode-section mb-5";
                // add mode title
                if (modeName) {
                    const titleDiv = document.createElement("div");
                    titleDiv.className = "mode-title mb-3 pb-2 border-bottom border-secondary";
                    titleDiv.innerHTML = `
                    <h5 class="text-light mb-0">
                        ${modeName} (${rows.length} BNs)
                    </h5>
                `;
                    container.appendChild(titleDiv);
                }
                // add cards grid
                const cardsContainer = document.createElement("div");
                cardsContainer.className = "bn-cards-grid";
                container.appendChild(cardsContainer);
                // move rows to cards
                rows.forEach((row) => {
                    const cardDiv = row.querySelector(".home-card");
                    if (!cardDiv)
                        return;
                    // check if closed
                    const isClosed = cardDiv.querySelector('.badge-danger[data-bs-original-title="closed"]');
                    if (isClosed) {
                        cardDiv.classList.add("bn-closed");
                    }
                    else {
                        cardDiv.classList.add("bn-open");
                    }
                    cardsContainer.appendChild(cardDiv);
                });
                table.parentNode?.replaceChild(container, table);
            });
            console.log("[BNM-Enhanced] Tables display improved");
        }
        static patchModalClose() {
            if (this.modalClosePatched)
                return;
            this.modalClosePatched = true;
            const checkJQuery = setInterval(() => {
                if (window.$ && window.$.fn && window.$.fn.modal) {
                    clearInterval(checkJQuery);
                    // listen for modal close event using delegation
                    window.$(document).on("hidden.bs.modal.bnmenhanced", "#userInfo", () => {
                        const url = new URL(window.location.href);
                        if (url.searchParams.has("id")) {
                            url.searchParams.delete("id");
                            window.history.pushState({}, "", url.pathname + url.search);
                            console.log("[BNM-Enhanced] URL cleaned after modal close");
                        }
                    });
                    // listen for backdrop click
                    window.$(document).on("click.bnmenhanced", ".modal-backdrop", () => {
                        setTimeout(() => {
                            const url = new URL(window.location.href);
                            if (url.searchParams.has("id")) {
                                url.searchParams.delete("id");
                                window.history.pushState({}, "", url.pathname + url.search);
                                console.log("[BNM-Enhanced] URL cleaned after backdrop click");
                            }
                        }, 100);
                    });
                    // listen for close button
                    window.$(document).on("click.bnmenhanced", '#userInfo [data-dismiss="modal"]', () => {
                        setTimeout(() => {
                            const url = new URL(window.location.href);
                            if (url.searchParams.has("id")) {
                                url.searchParams.delete("id");
                                window.history.pushState({}, "", url.pathname + url.search);
                                console.log("[BNM-Enhanced] URL cleaned after close button");
                            }
                        }, 100);
                    });
                }
            }, 100);
            setTimeout(() => clearInterval(checkJQuery), 10000);
        }
        static patchFadeRemoval() {
            if (this.fadeRemovalPatched)
                return;
            this.fadeRemovalPatched = true;
            // intercept setAttribute
            const originalSetAttribute = Element.prototype.setAttribute;
            Element.prototype.setAttribute = function (name, value) {
                if (name === "class" && typeof value === "string" && (this.id === "userInfo" || this.classList.contains("modal-backdrop"))) {
                    value = value
                        .replace(/\bfade\b/g, "")
                        .replace(/\s+/g, " ")
                        .trim();
                }
                return originalSetAttribute.call(this, name, value);
            };
            // intercept classList.add
            const originalClassListAdd = DOMTokenList.prototype.add;
            DOMTokenList.prototype.add = function (...tokens) {
                // find the corresponding element
                const element = Array.from(document.querySelectorAll("*")).find((el) => el.classList === this);
                if (element && (element.id === "userInfo" || element.classList.contains("modal-backdrop"))) {
                    tokens = tokens.filter((token) => token !== "fade");
                }
                if (tokens.length > 0) {
                    return originalClassListAdd.apply(this, tokens);
                }
            };
            // MutationObserver as a backup
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === "attributes" && mutation.attributeName === "class") {
                        const target = mutation.target;
                        if ((target.id === "userInfo" || target.classList.contains("modal-backdrop")) && target.classList.contains("fade")) {
                            target.classList.remove("fade");
                        }
                    }
                    if (mutation.type === "childList") {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === 1 && node.classList && node.classList.contains("modal-backdrop")) {
                                node.classList.remove("fade");
                            }
                        });
                    }
                });
            });
            observer.observe(document.body, {
                attributes: true,
                attributeFilter: ["class"],
                childList: true,
                subtree: true,
            });
            console.log("[BNM-Enhanced] Fade removal patched");
        }
    }
    Core.filterButtonAdded = false;
    Core.modalClosePatched = false;
    Core.fadeRemovalPatched = false;

    function init() {
        ConfigManager.init();
        // perform patches as early as possible
        if (CONFIG.removeFadeEffect) {
            Core.patchFadeRemoval();
        }
        if (CONFIG.cleanURLAfterModalClose) {
            Core.patchModalClose();
        }
        const initCore = async () => {
            if (CONFIG.improveTableStyle) {
                // inject styles early to avoid FOUC
                Core.injectStyles();
            }
            if (CONFIG.removeClosedBN) {
                if (CONFIG.FilterClosedDuration) {
                    await Core.addFilterButton();
                    await Core.removeClosedRows(true);
                }
                else {
                    await Core.removeClosedRows(false);
                }
            }
            if (CONFIG.improveTableStyle) {
                await Core.improveTablesDisplay();
            }
        };
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initCore);
        }
        else {
            initCore();
        }
        // listen 2 url changes (if BN Management uses SPA routing)
        if (window.MutationObserver) {
            let lastUrl = location.href;
            new MutationObserver(() => {
                const url = location.href;
                if (url !== lastUrl) {
                    lastUrl = url;
                    setTimeout(() => {
                        initCore();
                    }, 500);
                }
            }).observe(document, { subtree: true, childList: true });
        }
    }
    // GM_addStyle maybe
    init();

})();
