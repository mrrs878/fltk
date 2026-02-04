/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-02-02 20:00:00
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-02-03 16:12:12
 */

// 配置键
const CONFIG_KEYS = {
    selectedDevice: 'quickadb_selected_device',
    logFilter: 'quickadb_log_filter',
    refreshInterval: 'quickadb_refresh_interval',
    logLimit: 'quickadb_log_limit',
    lastSavePath: 'quickadb_last_save_path',
    logPollInterval: 'quickadb_log_poll_interval',
} as const;

export interface AppConfig {
    selectedDevice: string | null;
    logFilter: {
        packageName: string;
        keywords: string;
        logLevel: string;
    };
    refreshInterval: number;
    logLimit: number;
    lastSavePath: string;
    logPollInterval?: number;
}

const DEFAULT_CONFIG: AppConfig = {
    selectedDevice: null,
    logFilter: {
        packageName: '',
        keywords: '',
        logLevel: 'Verbose',
    },
    refreshInterval: 3000,
    logLimit: 1000,
    lastSavePath: '',
    logPollInterval: 1000,
};

export class ConfigManager {
    static get<K extends keyof AppConfig>(key: K): AppConfig[K] {
        try {
            const storageKey = CONFIG_KEYS[key];
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to get config:', key, error);
        }
        return DEFAULT_CONFIG[key];
    }

    static set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
        try {
            const storageKey = CONFIG_KEYS[key];
            localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (error) {
            console.error('Failed to set config:', key, error);
        }
    }

    static getAll(): AppConfig {
        return {
            selectedDevice: this.get('selectedDevice'),
            logFilter: this.get('logFilter'),
            refreshInterval: this.get('refreshInterval'),
            logLimit: this.get('logLimit'),
            lastSavePath: this.get('lastSavePath'),
        };
    }

    static reset(): void {
        Object.keys(CONFIG_KEYS).forEach((key) => {
            localStorage.removeItem(CONFIG_KEYS[key as keyof typeof CONFIG_KEYS]);
        });
    }
}
