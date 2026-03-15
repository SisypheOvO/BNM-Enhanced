export interface FilterConfig {
    filterDays: number;
}

const STORAGE_KEY = 'bnm-enhanced-filter-config';

export class ConfigManager {
    static config: FilterConfig = {
        filterDays: 100, // default to 100 days
    };

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
        } catch (e) {
            console.error('[BNM-Enhanced] Failed to load config from storage:', e);
        }
    }

    static saveToStorage() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
        } catch (e) {
            console.error('[BNM-Enhanced] Failed to save config to storage:', e);
        }
    }

    static getFilterDays(): number {
        return this.config.filterDays;
    }

    static setFilterDays(days: number) {
        this.config.filterDays = days;
        this.saveToStorage();
    }
}