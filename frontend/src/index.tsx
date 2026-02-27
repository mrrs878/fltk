/*
 * @Author: mrrs878@foxmail.com
 * @Date: 2026-01-28 19:45:52
 * @LastEditors: mrrs878@foxmail.com
 * @LastEditTime: 2026-02-27 19:27:35
 */

import { createStore } from "solid-js/store";
import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo } from "solid-js";
import { render } from "solid-js/web";
import { AdbApi, type Device } from "./api";
import { ConfigManager } from "./config";

type LogLevel = "Verbose" | "Debug" | "Info" | "Warn" | "Error";

type LogEntry = {
    p: string;
    timestamp: string;
    level: LogLevel;
    tag: string;
    message: string;
    packageName?: string;
    pid?: string;
    parsedJson?: any;          // 解析后的JSON对象
};

type Tab = "device-management" | "logcat" | "quick-actions" | "file-management" | "settings";

type ToastType = "success" | "error" | "info" | "warning";

type Toast = {
    id: number;
    type: ToastType;
    message: string;
};

const [state, setState] = createStore({
    devices: [] as Device[],
    selectedDevice: null as string | null,
    logs: [] as LogEntry[],
    logFilter: {
        packageName: "",
        keywords: "",
        logLevel: "Verbose" as LogLevel,
    },
    isLogging: false,
    isRecording: false,
    recordingStartTime: null as number | null,
    screenshots: [] as string[],
    toasts: [] as Toast[],
    currentCommand: "",
    isLoading: false,
    isInitializing: true,
    previewImage: null as string | null,
    previewVideo: null as string | null,
});

let toastIdCounter = 0;

const showToast = (message: string, type: ToastType = "info") => {
    const id = toastIdCounter++;
    setState("toasts", [...state.toasts, { id, type, message }]);
    
    setTimeout(() => {
        setState("toasts", state.toasts.filter((t) => t.id !== id));
    }, 3000);
};

const showError = (message: string) => showToast(message, "error");
const showSuccess = (message: string) => showToast(message, "success");
const showInfo = (message: string) => showToast(message, "info");
const showWarning = (message: string) => showToast(message, "warning");

const Layout = (props: { activeTab: Tab; setActiveTab: (tab: Tab) => void; children: any }) => (
    <div class="app-container">
        <SideBar
            setActiveTab={props.setActiveTab}
            activeTab={props.activeTab}
        />
        <main>{props.children}</main>
        <ToastContainer />
        <StatusBar />
    </div>
);

const ToastContainer = () => {
    return (
        <div class="toast-container">
            <For each={state.toasts}>
                {(toast) => (
                    <div class={`toast toast-${toast.type}`}>
                        {toast.message}
                    </div>
                )}
            </For>
        </div>
    );
};

const StatusBar = () => {
    return (
        <div class="status-bar">
            <Show when={state.isLoading}>
                <span class="status-loading">⏳</span>
            </Show>
            <Show when={state.currentCommand}>
                <span class="status-command">
                    执行中: {state.currentCommand}
                </span>
            </Show>
            <Show when={!state.currentCommand && !state.isLoading}>
                <span class="status-ready">就绪</span>
            </Show>
        </div>
    );
};

const SideBar = (props: { activeTab: Tab; setActiveTab: (tab: Tab) => void }) => {
    return (
        <div class="sidebar">
            <button
                class={`nav-btn ${props.activeTab === "device-management" ? "active" : ""}`}
                onClick={() => props.setActiveTab("device-management")}
            >
                设备管理
            </button>
            <button
                class={`nav-btn ${props.activeTab === "logcat" ? "active" : ""}`}
                onClick={() => props.setActiveTab("logcat")}
            >
                日志查看
            </button>
            <button
                class={`nav-btn ${props.activeTab === "quick-actions" ? "active" : ""}`}
                onClick={() => props.setActiveTab("quick-actions")}
            >
                便捷操作
            </button>
            <button
                class={`nav-btn ${props.activeTab === "file-management" ? "active" : ""}`}
                onClick={() => props.setActiveTab("file-management")}
            >
                文件管理
            </button>
            <button
                class={`nav-btn ${props.activeTab === "settings" ? "active" : ""}`}
                onClick={() => props.setActiveTab("settings")}
            >
                设置
            </button>
        </div>
    );
};

const DeviceManagement = () => {
    let refreshTimer: number | undefined;
    let previousDeviceCount = 0;
    let isActive = true;
    let isRefreshing = false; // 防止并发刷新
    let ipInputRef: HTMLInputElement | undefined;
    const [connectIP, setConnectIP] = createSignal("");
    const [connectPort, setConnectPort] = createSignal("5555");
    const [showConnectDialog, setShowConnectDialog] = createSignal(false);
    const [showConnectHelpDialog, setShowConnectHelpDialog] = createSignal(false);

    // 当对话框打开时自动聚焦输入框
    createEffect(() => {
        if (showConnectDialog() && ipInputRef) {
            setTimeout(() => ipInputRef?.focus(), 100);
        }
    });

    const refreshDevices = async (showStatus = false) => {
        if (!isActive || isRefreshing) return;
        
        isRefreshing = true;
        if (showStatus) {
            setState("isLoading", true);
            setState("currentCommand", "adb devices");
        }
        
        try {
            const result = await AdbApi.getDevices();
            
            if (!isActive) {
                isRefreshing = false;
                return; // 检查组件是否还在活动
            }
            
            if (result.success && result.data) {
                const devices = result.data.devices.map((dev) => ({
                    id: dev.id,
                    name: dev.product || dev.model || dev.id,
                    status: dev.status === "device" ? "在线" : "离线",
                    model: dev.model,
                    product: dev.product,
                }));
                
                setState("devices", devices);
                
                devices.forEach(async (device) => {
                    if (device.status === "在线" && !device.id.includes(':')) {
                        try {
                            const result = await AdbApi.enableWirelessAdb(device.id);
                            if (result.success && result.data?.ip) {
                                console.log(`[Auto] Enabled wireless for ${device.id}, IP: ${result.data.ip}`);
                            }
                        } catch (error) {
                            console.error('[Auto] Failed to enable wireless:', error);
                        }
                    }
                });
                
                // 如果当前选中的设备不在列表中，清除选择
                if (state.selectedDevice && !devices.find(d => d.id === state.selectedDevice)) {
                    setState("selectedDevice", null);
                    ConfigManager.set('selectedDevice', null);
                }
                
                // 只在手动刷新时显示提示
                if (showStatus) {
                    if (devices.length > 0) {
                        showSuccess(`找到 ${devices.length} 个设备`);
                    } else {
                        showInfo('未找到设备');
                    }
                }
                
                previousDeviceCount = devices.length;
            } else {
                showError(result.error || "获取设备列表失败");
            }
        } catch (error) {
            showError("获取设备列表失败: " + String(error));
        } finally {
            isRefreshing = false;
            if (state.isInitializing) {
                setState("isInitializing", false);
            }
            if (isActive && showStatus) {
                setState("isLoading", false);
                setState("currentCommand", "");
            }
        }
    };

    const selectDevice = (deviceId: string) => {
        setState("selectedDevice", deviceId);
        ConfigManager.set('selectedDevice', deviceId);
        showSuccess("已选择设备: " + deviceId);
    };

    const openConnectDialog = () => {
        setShowConnectDialog(true);
    };

    const closeConnectDialog = () => {
        setShowConnectDialog(false);
        setConnectIP("");
        setConnectPort("5555");
    };

    const openConnectHelpDialog = () => {
        setShowConnectHelpDialog(true);
    };

    const closeConnectHelpDialog = () => {
        setShowConnectHelpDialog(false);
    };

    const connectWirelessDevice = async () => {
        const ip = connectIP().trim();
        const port = connectPort().trim();
        
        if (!ip) {
            showError("请输入IP地址");
            return;
        }
        
        const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipPattern.test(ip)) {
            showError("IP地址格式错误");
            return;
        }
        
        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            showError("端口号必须在 1-65535 之间");
            return;
        }
        
        const address = `${ip}:${port}`;
        setState("isLoading", true);
        setState("currentCommand", `adb connect ${address}`);
        
        try {
            const result = await AdbApi.connectDevice(address);
            if (result.success) {
                showSuccess(`连接成功: ${address}`);
                closeConnectDialog();
                setTimeout(() => refreshDevices(false), 500);
            } else {
                showError(result.error || "连接失败");
                // 连接失败，从 adb 服务器中移除该设备记录
                try {
                    await AdbApi.disconnectDevice(address);
                    setTimeout(() => refreshDevices(false), 300);
                } catch (e) {
                    console.error('Failed to disconnect after connect failure:', e);
                }
            }
        } catch (error) {
            showError("连接失败: " + String(error));
            // 连接失败，从 adb 服务器中移除该设备记录
            try {
                await AdbApi.disconnectDevice(address);
                setTimeout(() => refreshDevices(false), 300);
            } catch (e) {
                console.error('Failed to disconnect after connect failure:', e);
            }
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    };

    const disconnectDevice = async () => { 
        if (!state.selectedDevice) return;
        try {
            setState("isLoading", true);
            setState("currentCommand", `adb connect ${state.selectedDevice}`);
            const result = await AdbApi.disconnectDevice(state.selectedDevice);
            if (result.success) {
                showSuccess("已断开连接");
                setState("selectedDevice", null);
                await refreshDevices(false);
            } else {
                showError(result.error || "断开连接失败");
            }
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    };

    const connectDeviceHelp = async () => {
        try {
            setState("isLoading", true);
            setState("currentCommand", `adb tcpip 5555`);
            const result = await AdbApi.execCommand("adb tcpip 5555");
            if (result.success) {
                showSuccess("修复成功，现在可断开数据线，下次可使用无线连接");
                await connectWirelessDevice();
            } else {
                showError(result.error || "修复失败");
            }
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    }

    const startAutoRefresh = () => {
        stopAutoRefresh();
        const interval = ConfigManager.get('refreshInterval');
        console.log('[DeviceManagement] Starting auto-refresh, interval:', interval, 'ms');
        
        const scheduleNext = () => {
            refreshTimer = window.setTimeout(async () => {
                if (isActive) {
                    console.log('[DeviceManagement] Auto-refresh tick');
                    await refreshDevices();
                    scheduleNext();
                } else {
                    console.warn('[DeviceManagement] Timer fired but component not active');
                }
            }, interval);
            console.log('[DeviceManagement] Timer scheduled with ID:', refreshTimer);
        };
        
        scheduleNext();
    };

    const stopAutoRefresh = () => {
        if (refreshTimer) {
            console.log('[DeviceManagement] Stopping auto-refresh, timer ID:', refreshTimer);
            clearTimeout(refreshTimer);
            refreshTimer = undefined;
        }
    };

    onMount(() => {
        console.log('[DeviceManagement] Component mounted');
        const savedDevice = ConfigManager.get('selectedDevice');
        if (savedDevice) {
            setState("selectedDevice", savedDevice);
        }
        
        isActive = true;
        refreshDevices(true);
        startAutoRefresh();
    });

    onCleanup(() => {
        console.log('[DeviceManagement] Component cleanup');
        isActive = false;
        stopAutoRefresh();
    });

    return (
        <div class="device-management">
            <div class="section-header">
                <h3>设备管理</h3>
                <div style="display: flex; gap: 10px;">
                    <button onClick={() => refreshDevices(true)} class="btn-primary">
                        刷新设备
                    </button>
                    <button onClick={openConnectDialog} class="btn-secondary">
                        无线连接
                    </button>
                </div>
            </div>

            <Show when={showConnectDialog()}>
                <div class="dialog-overlay" onClick={closeConnectDialog}>
                    <div class="dialog" onClick={(e) => e.stopPropagation()}>
                        <div class="dialog-header">
                            <h3>无线连接设备</h3>
                            <button class="dialog-close" onClick={closeConnectDialog}>×</button>
                        </div>
                        <div class="dialog-body wireless-connect">
                            <div class="form-group">
                                <label class="ip-label">
                                    <span>IP 地址</span>
                                    <button class="btn-link ip-help" data-tooltip="设置 - 关于手机 - IP地址">如何查看</button>
                                </label>
                                <input
                                    ref={ipInputRef}
                                    type="text"
                                    placeholder="例如: 192.168.1.100"
                                    value={connectIP()}
                                    onInput={(e) => setConnectIP(e.currentTarget.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            connectWirelessDevice();
                                        }
                                    }}
                                />
                            </div>
                            <div class="form-group">
                                <label>端口</label>
                                <input
                                    type="text"
                                    placeholder="5555"
                                    value={connectPort()}
                                    onInput={(e) => setConnectPort(e.currentTarget.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            connectWirelessDevice();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div class="dialog-footer">
                            <button hidden onClick={openConnectHelpDialog} class="btn-secondary">
                                连接失败❓
                            </button>
                            <div class="flex-1" />
                            <button onClick={closeConnectDialog} class="btn-secondary">
                                取消
                            </button>
                            <button onClick={connectWirelessDevice} class="btn-primary">
                                连接
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            <Show when={showConnectHelpDialog()}>
                <div class="dialog-overlay" onClick={closeConnectHelpDialog}>
                    <div class="dialog" onClick={(e) => e.stopPropagation()}>
                        <div class="dialog-header">
                            <h3>连接设备帮助</h3>
                            <button class="dialog-close" onClick={closeConnectHelpDialog}>×</button>
                        </div>
                        <div class="dialog-body connection-help"> 
                            <div>1. 进入设置 - 关于手机 - 版本号 - 连续点击7次以启用开发者模式</div>
                            <div>2. 进入设置 - 系统 - 开发者选项 - 允许 USB 调试</div>
                            <div>3. 使用数据线连接设备</div>
                            <div>4. 设备中弹窗勾选一律允许，点击确认</div>
                            <div>5. 点击弹窗下方的<span class="help-emoji">👇</span>确认按钮</div>
                        </div>
                        <div class="dialog-footer">
                            <button onClick={connectDeviceHelp} class="btn-primary">
                                👉确认👈
                            </button>
                        </div>
                    </div>
                </div>
            </Show>

            <div class="device-list">
                <Show when={state.devices.length === 0}>
                    <div class="device-guide">
                        <div class="guide-icon">📱</div>
                        <h3>还没有连接的设备</h3>
                        <div class="guide-steps">
                            <div class="guide-step">
                                <div class="step-number">1</div>
                                <div class="step-content">
                                    <strong>启用开发者模式</strong>
                                    <p>设置 → 关于手机 → 版本号（连续点击7次）</p>
                                </div>
                            </div>
                            <div class="guide-step">
                                <div class="step-number">2</div>
                                <div class="step-content">
                                    <strong>开启 USB 调试</strong>
                                    <p>设置 → 系统 → 开发者选项 → USB 调试（打开）</p>
                                </div>
                            </div>
                            <div class="guide-step">
                                <div class="step-number">3</div>
                                <div class="step-content">
                                    <strong>USB 连接或无线连接</strong>
                                    <div class="guide-options">
                                        <div class="guide-option">
                                            <span class="option-icon">🔌</span>
                                            <span>使用数据线连接电脑(第一次使用)</span>
                                        </div>
                                        <div>或</div>
                                        <div class="guide-option">
                                            <span class="option-icon">📡</span>
                                            <span>点击上方"无线连接"按钮</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="guide-step">
                                <div class="step-number">4</div>
                                <div class="step-content">
                                    <strong>授权调试</strong>
                                    <p>手机上弹出提示时，勾选"一律允许"并点击确定</p>
                                </div>
                            </div>
                        </div>
                        <div class="guide-actions">
                            <button onClick={() => refreshDevices(true)} class="btn-primary">
                                🔄 刷新设备列表
                            </button>
                            <button onClick={openConnectDialog} class="btn-secondary">
                                📡 无线连接
                            </button>
                        </div>
                    </div>
                </Show>
                <For each={state.devices}>
                    {(device) => (
                        <div
                            class={`device-item ${state.selectedDevice === device.id ? "selected" : ""}`}
                            onClick={() => selectDevice(device.id)}
                        >
                            <div class="device-info">
                                <h4>{device.name}</h4>
                                <p>ID: {device.id}</p>
                                <p>
                                    型号: {device.model || "未知"} | 版本:{" "}
                                    {device.version || "未知"}
                                </p>
                                <span
                                    class={`status ${device.status === "在线" ? "online" : "offline"}`}
                                >
                                    {device.status}
                                </span>
                            </div>
                        </div>
                    )}
                </For>
            </div>

            <Show when={state.selectedDevice}>
                <div class="device-actions">
                    <button class="btn-secondary" onClick={disconnectDevice}>断开连接</button>
                </div>
            </Show>
        </div>
    );
};

const LogcatView = () => {
    let isActive = true;
    let pollTimer: number | undefined;
    let lastLogIndex = 0; // 记录已读取到的位置
    let logOutputRef: HTMLDivElement | undefined; // 日志容器引用
    const [installedApps, setInstalledApps] = createSignal<Array<{packageName: string, displayName: string}>>([]);
    const [showPackageSuggestions, setShowPackageSuggestions] = createSignal(false);
    const [filterPids, setFilterPids] = createSignal<string[]>([]); // 当前过滤的PID列表
    const [autoScroll, setAutoScroll] = createSignal(true); // 自动滚动开关
    
    const isScrolledToBottom = () => {
        if (!logOutputRef) return false;
        const threshold = 10;
        return logOutputRef.scrollHeight - logOutputRef.scrollTop - logOutputRef.clientHeight < threshold;
    };
    
    const handleScroll = () => {
        if (!logOutputRef) return;
        
        if (isScrolledToBottom()) {
            setAutoScroll(true);
        } else {
            setAutoScroll(false);
        }
    };
    
    const scrollToBottom = () => {
        if (logOutputRef && autoScroll()) {
            logOutputRef.scrollTop = logOutputRef.scrollHeight;
        }
    };
    
    // 合并多行JSON日志
    const mergeJsonLogs = (logs: LogEntry[]): LogEntry[] => {
        if (logs.length === 0) return [];
        const result: LogEntry[] = [];
        const jsonBuffer: LogEntry[] = [logs[0]];

        for (const log of logs.slice(1)) {
            if (log.p === jsonBuffer[0].p) {
                jsonBuffer.push(log);
            } else {
                let parsedJson;
                const _message = jsonBuffer.slice(1).map(log => log.message).join('');
                try {
                    parsedJson = JSON.parse(_message);
                } catch (e) {
                    // ignore
                }
                result.push(
                    ...(parsedJson ? [{
                        ...jsonBuffer[0],
                        message: jsonBuffer[0].message,
                        parsedJson,
                    }] : jsonBuffer)
                );
                jsonBuffer.length = 0;
                jsonBuffer.push(log);
            }
        }

        return [...result, ...jsonBuffer];
    };
    
    const updateLogFilter = async (
        field: keyof typeof state.logFilter,
        value: any,
    ) => {
        setState("logFilter", { [field]: value });
        
        if (field === "packageName") {
            setShowPackageSuggestions(value.length > 0 && installedApps().length > 0);
            if (!value) {
                setFilterPids([]);
            }
        }
    };
    
    // 应用包名过滤（获取PID）
    const applyPackageFilter = async () => {
        const packageName = state.logFilter.packageName;
        if (!packageName || !state.selectedDevice) {
            setFilterPids([]);
            return;
        }
        
        console.log('[Logcat] Applying filter for package:', packageName);
        try {
            const result = await AdbApi.getPackagePid(state.selectedDevice, packageName);
            console.log('[Logcat] Get PID result:', result);
            if (result.success && result.data && result.data.running) {
                const pids = result.data.pid.split(/\s+/).filter(p => p);
                setFilterPids(pids);
                console.log('[Logcat] Filtering by PIDs:', pids);
            } else {
                setFilterPids([]);
                showWarning(`应用未运行: ${packageName}`);
            }
        } catch (error) {
            console.error('[Logcat] Get PID error:', error);
            setFilterPids([]);
            showError('获取应用PID失败');
        }
    };

    const loadInstalledApps = async () => {
        if (!state.selectedDevice) return;
        
        try {
            const result = await AdbApi.getInstalledApps(state.selectedDevice);
            if (result.success && result.data) {
                setInstalledApps(result.data.packages);
            }
        } catch (error) {
            console.error("Load apps error:", error);
        }
    };

    const selectPackage = (packageName: string) => {
        setState("logFilter", "packageName", packageName);
        setShowPackageSuggestions(false);
        // 自动应用过滤
        setTimeout(() => applyPackageFilter(), 100);
    };

    const filteredPackageSuggestions = () => {
        const filter = state.logFilter.packageName.toLowerCase();
        if (!filter) return [];
        return installedApps()
            .filter(app => 
                app.packageName.toLowerCase().includes(filter) || 
                app.displayName.toLowerCase().includes(filter)
            )
            .slice(0, 10);
    };

    const toggleLogging = async () => {
        if (state.isLogging) {
            try {
                await AdbApi.stopLogcat();
                setState("isLogging", false);
                if (pollTimer) {
                    clearTimeout(pollTimer);
                    pollTimer = undefined;
                }
                lastLogIndex = 0; // 重置索引
                showSuccess("日志记录已停止");
            } catch (error) {
                showError("停止日志失败: " + String(error));
            }
        } else {
            if (!state.selectedDevice) {
                showWarning("请先选择设备");
                return;
            }
            
            try {
                const result = await AdbApi.startLogcat(state.selectedDevice);
                if (result.success) {
                    setState("isLogging", true);
                    setState("logs", []); // 清空旧日志
                    lastLogIndex = 0; // 重置索引
                    showSuccess("日志记录已开始");
                    
                    // 立即拉取一次获取初始日志
                    pollLogsInitial();
                } else {
                    showError(result.error || "启动日志失败");
                }
            } catch (error) {
                showError("启动日志失败: " + String(error));
            }
        }
    };

    // 首次拉取，获取所有现有日志
    const pollLogsInitial = async () => {
        try {
            const result = await AdbApi.getLogcatLines(0);
            
            if (result.success && result.data) {
                const allLines = result.data.lines;
                
                if (allLines.length > 0) {
                    const parsedLogs = allLines.map(line => parseLogLine(line)).filter(log => log !== null);
                    const mergedLogs = mergeJsonLogs(parsedLogs);
                    setState("logs", mergedLogs);
                    lastLogIndex = result.data.newIndex;
                    
                    // 初次加载后滚动到底部
                    requestAnimationFrame(() => scrollToBottom());
                }
            }
        } catch (error) {
            console.error("Initial poll error:", error);
        }
        
        // 开始常规轮询
        if (state.isLogging && isActive) {
            const interval = ConfigManager.get('logPollInterval') || 300;
            pollTimer = window.setTimeout(() => pollLogs(), interval);
        }
    };

    const pollLogs = async () => {
        if (!state.isLogging || !isActive) return;
        
        try {
            // 使用增量模式获取日志
            const result = await AdbApi.getLogcatLines(lastLogIndex);
            
            if (result.success && result.data) {
                const newLines = result.data.lines;
                
                // 只有新日志时才更新
                if (newLines.length > 0) {
                    const parsedLogs = newLines.map(line => parseLogLine(line)).filter(log => log !== null);
                    const mergedLogs = mergeJsonLogs(parsedLogs);
                    
                    setState("logs", (logs) => {
                        const combined = [...logs, ...mergedLogs];
                        const maxLogs = 5000; // 增加到5000条，避免频繁丢失日志
                        // 限制总数
                        if (combined.length > maxLogs) {
                            return combined.slice(combined.length - maxLogs);
                        }
                        return combined;
                    });
                    
                    // 更新索引位置
                    lastLogIndex = result.data.newIndex;
                    
                    requestAnimationFrame(() => scrollToBottom());
                }
                
                if (!result.data.isRunning && state.isLogging) {
                    setState("isLogging", false);
                }
            } else {
                console.error('[Logcat] Poll failed:', result.error);
            }
        } catch (error) {
            console.error("Poll logs error:", error);
        }
        
        if (state.isLogging && isActive) {
            const interval = ConfigManager.get('logPollInterval') || 300;
            pollTimer = window.setTimeout(() => pollLogs(), interval);
        }
    };

    const parseLogLine = (line: string): LogEntry | null => {
        const timeRegex = /^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEF])\/(.+?)\(\s*(\d+)\): ?(.*)$/;
        const match = line.match(timeRegex);
        
        if (!match) {
            if (line.trim().length > 0 && !line.startsWith('-')) {
                console.log('[Logcat] Failed to parse line:', line.substring(0, 100));
            }
            return null;
        }
        
        const [, timestamp, levelChar, tag, pid, message] = match;
        const levelMap: Record<string, LogLevel> = {
            'V': 'Verbose', 'D': 'Debug', 'I': 'Info', 'W': 'Warn', 'E': 'Error', 'F': 'Error'
        };
        
        return {
            p: `${timestamp}_${levelChar}_${tag.trim()}_${pid}`,
            timestamp: timestamp, // 保持设备原始时间戳，格式: MM-DD HH:mm:ss.SSS
            level: levelMap[levelChar] || levelMap['I'],
            tag: tag.trim(),
            packageName: tag.trim(), // 添加包名字段，与tag相同
            message: message, // 保留原始消息，包括前导空格
            pid: pid
        };
    };

    const clearLogs = () => {
        setState("logs", []);
    };

    const exportLogs = () => {
        const logsText = state.logs.map(log => 
            `${log.timestamp} ${log.level} ${log.tag}: ${log.message}`
        ).join('\n');
        
        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `logcat_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        
        showSuccess("日志已导出");
    };

    const filteredLogs = createMemo(() => {
        const pids = filterPids();
        const { packageName, keywords, logLevel } = state.logFilter;
        const kwLower = keywords ? keywords.toLowerCase() : '';
        const levelPriority: Record<LogLevel, number> = {
            'Verbose': 0, 'Debug': 1, 'Info': 2, 'Warn': 3, 'Error': 4
        };
        const minLevel = levelPriority[logLevel];

        return state.logs.filter(log => {
            if (packageName) {
                if (pids.length > 0) {
                    if (!pids.includes(log.pid || '')) return false;
                } else {
                    return false;
                }
            }

            if (kwLower) {
                if (!(`${log.tag} ${log.message}`).toLowerCase().includes(kwLower)) return false;
            }

            if (levelPriority[log.level] < minLevel) return false;

            return true;
        });
    });

    onMount(() => {
        isActive = true;
        loadInstalledApps(); // 加载已安装应用列表
    });
    
    onCleanup(() => {
        isActive = false;
        if (pollTimer) {
            clearTimeout(pollTimer);
        }
        if (state.isLogging) {
            AdbApi.stopLogcat();
        }
    });

    const JsonLogEntry = (props: { log: LogEntry }) => {
        const [isCollapsed, setIsCollapsed] = createSignal(true);
        
        const formatJson = () => {
            try {
                return JSON.stringify(props.log.parsedJson, null, 4);
            } catch {
                return props.log.message;
            }
        };
        
        return (
            <div class={`log-entry log-json log-${props.log.level.toLowerCase()}`}>
                <span class="timestamp">{props.log.timestamp}</span>
                <span class="level">{props.log.level[0]}</span>
                <span class="package">{props.log.packageName || props.log.tag}</span>
                <button 
                    class="json-toggle"
                    onClick={() => setIsCollapsed(!isCollapsed())}
                >
                    {(isCollapsed() ? '▶ ' : '▼ ') + props.log.message}
                </button>
                <Show when={!isCollapsed()}>
                    <pre class="json-content">{formatJson()}</pre>
                </Show>
            </div>
        );
    };

    return (
        <div class="logcat-view">
            <div class="section-header">
                <h3>日志查看</h3>
                <div class="log-controls">
                    <button
                        onClick={toggleLogging}
                        class={state.isLogging ? "btn-warning" : "btn-primary"}
                    >
                        {state.isLogging ? "停止记录" : "开始记录"}
                    </button>
                    <button onClick={clearLogs} class="btn-secondary">
                        清空日志
                    </button>
                    <button onClick={exportLogs} class="btn-secondary" disabled={state.logs.length === 0}>
                        导出日志
                    </button>
                </div>
            </div>

            <div class="log-filters">
                <div class="filter-group autocomplete-container">
                    <label>包名/标签过滤:</label>
                    <input
                        type="text"
                        value={state.logFilter.packageName}
                        placeholder="com.example.app 或 ActivityManager"
                        onInput={(e) =>
                            updateLogFilter(
                                "packageName",
                                e.currentTarget.value,
                            )
                        }
                        onFocus={() => setShowPackageSuggestions(state.logFilter.packageName.length > 0)}
                    />
                    <Show when={showPackageSuggestions() && filteredPackageSuggestions().length > 0}>
                        <div class="autocomplete-suggestions">
                            <For each={filteredPackageSuggestions()}>
                                {(app) => (
                                    <div 
                                        class="suggestion-item"
                                        onClick={(e) => {
                                            e.preventDefault(); // 阻止输入框失焦
                                            selectPackage(app.packageName);
                                        }}
                                    >
                                        <span style="font-weight: 500;">{app.displayName}</span>
                                        <span style="color: #888; font-size: 12px; margin-left: 8px;">({app.packageName})</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>

                <div class="filter-group">
                    <label>关键词过滤:</label>
                    <input
                        type="text"
                        value={state.logFilter.keywords}
                        placeholder="搜索关键词"
                        onInput={(e) =>
                            updateLogFilter("keywords", e.currentTarget.value)
                        }
                    />
                </div>

                <div class="filter-group">
                    <label>日志级别:</label>
                    <select
                        value={state.logFilter.logLevel}
                        onChange={(e) =>
                            updateLogFilter(
                                "logLevel",
                                e.currentTarget.value as LogLevel,
                            )
                        }
                    >
                        <option value="Verbose">Verbose</option>
                        <option value="Debug">Debug</option>
                        <option value="Info">Info</option>
                        <option value="Warn">Warn</option>
                        <option value="Error">Error</option>
                    </select>
                </div>
            </div>

            <div class="log-output" ref={logOutputRef} onScroll={handleScroll}>
                <Show when={filteredLogs().length === 0 && !state.isLogging}>
                    <div class="log-empty">
                        {state.logs.length === 0 ? "点击 \"开始记录\" 查看设备日志" : "没有符合过滤条件的日志"}
                    </div>
                </Show>
                <For each={filteredLogs()}>
                    {(log, i) => (
                        <Show when={log.parsedJson} fallback={
                            <div class={`log-entry log-${log.level.toLowerCase()}`}>
                                <div class="log-base-info" style={{ opacity: filteredLogs()[i() - 1]?.timestamp === log.timestamp ? 0 : 1 }}>
                                    <span class="timestamp">
                                        {log.timestamp}
                                    </span>
                                    <span class="level">{log.level[0]}</span>
                                    <span class="package">{log.packageName || log.tag}</span>
                                </div>
                                <span class="message">{log.message}</span>
                            </div>
                        }>
                            <JsonLogEntry log={log} />
                        </Show>
                    )}
                </For>
            </div>
        </div>
    );
};

const QuickActions = () => {
    const getSavePath = () => {
        return ConfigManager.get('lastSavePath') || '';
    };

    const chooseSavePath = async () => {
        try {
            const result = await AdbApi.chooseDirectory();
            if (result.success && result.data) {
                ConfigManager.set('lastSavePath', result.data.path);
                showSuccess('保存位置已设置: ' + result.data.path);
            }
        } catch (error) {
            showError('选择目录失败: ' + String(error));
        }
    };

    const captureScreen = async () => {
        if (!state.selectedDevice) {
            showWarning("请先选择设备");
            return;
        }
        
        setState("isLoading", true);
        setState("currentCommand", "adb shell screencap");
        
        try {
            const savePath = getSavePath();
            const result = await AdbApi.captureScreen(state.selectedDevice, savePath);
            if (result.success && result.data) {
                showSuccess(result.message || "截图成功");
                // 保存截图路径并显示预览
                setState("screenshots", [...state.screenshots, result.data.path]);
                setState("previewImage", "file://" + result.data.path);
            } else {
                showError(result.error || "截图失败");
            }
        } catch (error) {
            showError("截图失败: " + String(error));
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    };

    const startRecording = async () => {
        if (!state.selectedDevice) {
            showWarning("请先选择设备");
            return;
        }

        if (state.isRecording) {
            showWarning("正在录制中");
            return;
        }

        setState("isLoading", true);
        setState("currentCommand", "adb shell screenrecord");

        try {
            const result = await AdbApi.startRecording(state.selectedDevice);
            if (result.success) {
                setState("isRecording", true);
                setState("recordingStartTime", Date.now());
                startRecordingTimer(); // 启动计时器
                showSuccess("录屏已开始（最长3分钟）");
            } else {
                showError(result.error || "启动录屏失败");
            }
        } catch (error) {
            showError("启动录屏失败: " + String(error));
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    };

    const stopRecording = async () => {
        if (!state.selectedDevice || !state.isRecording) {
            return;
        }

        setState("isLoading", true);
        setState("currentCommand", "adb pull recording.mp4");

        try {
            stopRecordingTimer();

            const savePath = getSavePath();
            const result = await AdbApi.stopRecording(state.selectedDevice, savePath);
            
            setState("isRecording", false);
            setState("recordingStartTime", null);
            
            if (result.success && result.data) {
                showSuccess("录屏已保存");
                setState("previewVideo", "file://" + result.data.path);
            } else {
                showError(result.error || "停止录屏失败");
            }
        } catch (error) {
            showError("停止录屏失败: " + String(error));
        } finally {
            setState("isLoading", false);
            setState("currentCommand", "");
        }
    };

    const [recordingTime, setRecordingTime] = createSignal("00:00");
    let recordingTimer: number | undefined;
    
    const startRecordingTimer = () => {
        if (recordingTimer) {
            clearTimeout(recordingTimer);
        }
        
        const updateTimer = () => {
            if (state.recordingStartTime) {
                const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                setRecordingTime(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
                
                recordingTimer = window.setTimeout(updateTimer, 1000);
            }
        };
        
        updateTimer();
    };
    
    const stopRecordingTimer = () => {
        if (recordingTimer) {
            clearTimeout(recordingTimer);
            recordingTimer = undefined;
        }
    };
    
    onCleanup(() => {
        stopRecordingTimer();
    });

    const installApp = () => {
        showInfo("安装应用功能即将推出");
    };

    const uninstallApp = () => {
        showInfo("卸载应用功能即将推出");
    };

    return (
        <div class="quick-actions">
            <div class="section-header">
                <h3>便捷操作</h3>
                <div class="log-controls">
                    <button onClick={chooseSavePath} class="btn-secondary">
                        设置保存位置
                    </button>
                </div>
            </div>

            <div class="action-category">
                <h4>媒体操作</h4>
                <div class="actions-row">
                    <button
                        onClick={captureScreen}
                        class="action-btn btn-primary-light"
                        disabled={state.isLoading}
                    >
                        截取屏幕
                    </button>
                    <Show when={!state.isRecording}>
                        <button
                            onClick={startRecording}
                            class="action-btn btn-primary-light"
                            disabled={state.isLoading}
                        >
                            开始录屏
                        </button>
                    </Show>
                    <Show when={state.isRecording}>
                        <button
                            onClick={stopRecording}
                            class="action-btn btn-warning"
                            disabled={state.isLoading}
                        >
                            停止录屏 ({recordingTime()})
                        </button>
                    </Show>
                </div>
            </div>

            <div class="action-category">
                <h4>应用管理</h4>
                <div class="actions-row">
                    <button
                        onClick={installApp}
                        class="action-btn btn-success-light"
                    >
                        安装应用
                    </button>
                    <button
                        onClick={uninstallApp}
                        class="action-btn btn-danger-light"
                    >
                        卸载应用
                    </button>
                </div>
            </div>
            
        </div>
    );
};

const FileManagement = () => {
    const [remotePath, setRemotePath] = createSignal("/sdcard/Download/");
    const [localPath, setLocalPath] = createSignal("");
    const [browserMode, setBrowserMode] = createSignal("");
    const [selectedFile, setSelectedFile] = createSignal("");
    const [currentDevicePath, setCurrentDevicePath] = createSignal("/sdcard/");
    const [deviceFiles, setDeviceFiles] = createSignal<Array<{name: string, isDirectory: boolean, path: string}>>([]);
    const [showFileBrowser, setShowFileBrowser] = createSignal(false);

    const chooseLocalFile = async () => {
        try {
            const result = await AdbApi.chooseFile();
            if (result.success && result.data?.path) {
                setSelectedFile(result.data.path);
                showSuccess("已选择文件: " + result.data.path);
            }
        } catch (error) {
            showError("选择文件失败: " + String(error));
        }
    };

    const chooseSaveLocation = async () => {
        try {
            const result = await AdbApi.chooseDirectory();
            if (result.success && result.data?.path) {
                setLocalPath(result.data.path);
                showSuccess("保存位置已设置: " + result.data.path);
            }
        } catch (error) {
            showError("选择目录失败: " + String(error));
        }
    };

    const loadDeviceFiles = async (path: string) => {
        if (!state.selectedDevice) {
            showWarning("请先选择设备");
            return;
        }

        setState("isLoading", true);
        try {
            const result = await AdbApi.listDeviceFiles(state.selectedDevice, path);
            if (result.success && result.data) {
                setDeviceFiles(result.data.files);
                setCurrentDevicePath(result.data.currentPath);
            } else {
                showError(result.error || "加载文件列表失败");
            }
        } catch (error) {
            showError("加载文件列表失败: " + String(error));
        } finally {
            setState("isLoading", false);
        }
    };

    const selectDeviceFile = (file: {name: string, isDirectory: boolean, path: string}) => {
        if (file.isDirectory) {
            // 如果是推送模式且点击文件夹，可以选择该文件夹作为目标路径
            if (browserMode() === 'push') {
                setRemotePath(file.path);
                setShowFileBrowser(false);
                showSuccess("已选择目标路径: " + file.path);
            } else {
                loadDeviceFiles(file.path);
            }
        } else {
            setRemotePath(file.path);
            setShowFileBrowser(false);
            showSuccess("已选择文件: " + file.path);
        }
    };

    const goToParentDirectory = () => {
        const path = currentDevicePath();
        const parts = path.split('/').filter(p => p);
        parts.pop();
        const newPath = '/' + parts.join('/') + '/';
        loadDeviceFiles(newPath);
    };

    const openFileBrowser = (mode: 'pull' | 'push' = 'pull') => {
        setBrowserMode(mode);
        setShowFileBrowser(true);
        loadDeviceFiles(currentDevicePath());
    };

    const copyPathToClipboard = (path: string) => {
        navigator.clipboard.writeText(path).then(() => {
            showSuccess('路径已复制: ' + path);
            setRemotePath(path);
        }).catch(() => {
            showError('复制失败');
        });
    };

    const pushFileToDevice = async () => {
        if (!state.selectedDevice) {
            showWarning("请先选择设备");
            return;
        }

        if (!selectedFile()) {
            showWarning("请先选择要推送的文件");
            return;
        }

        if (!remotePath()) {
            showWarning("请输入设备路径");
            return;
        }

        setState("isLoading", true);
        try {
            const result = await AdbApi.pushFile(
                state.selectedDevice,
                selectedFile(),
                remotePath()
            );
            if (result.success) {
                showSuccess(result.message || "文件推送成功");
                setSelectedFile("");
            } else {
                showError(result.error || "文件推送失败");
            }
        } catch (error) {
            showError("文件推送失败: " + String(error));
        } finally {
            setState("isLoading", false);
        }
    };

    const pullFileFromDevice = async () => {
        if (!state.selectedDevice) {
            showWarning("请先选择设备");
            return;
        }

        if (!remotePath()) {
            showWarning("请输入设备文件路径");
            return;
        }

        setState("isLoading", true);
        try {
            const result = await AdbApi.pullFile(
                state.selectedDevice,
                remotePath(),
                localPath()
            );
            if (result.success) {
                showSuccess(result.message || "文件拉取成功");
            } else {
                showError(result.error || "文件拉取失败");
            }
        } catch (error) {
            showError("文件拉取失败: " + String(error));
        } finally {
            setState("isLoading", false);
        }
    };

    return (
        <div class="file-management">
            <div class="section-header">
                <h3>文件管理</h3>
            </div>

            <div class="file-section">
                <h4>推送文件到设备 (Push)</h4>
                <div class="form-group">
                    <label>本地文件:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            value={selectedFile()}
                            readonly
                            placeholder="点击选择文件"
                            style="flex: 1;"
                        />
                        <button onClick={chooseLocalFile} class="btn-secondary">
                            选择文件
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label>设备目标路径:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            value={remotePath()}
                            onInput={(e) => setRemotePath(e.currentTarget.value)}
                            placeholder="/sdcard/Download/"
                            style="flex: 1;"
                        />
                        <button onClick={() => openFileBrowser('push')} class="btn-secondary">
                            浏览
                        </button>
                    </div>
                    <small>设备上的目标路径，如 /sdcard/Download/，或点击"浏览"选择</small>
                </div>
                <button 
                    onClick={pushFileToDevice} 
                    class="btn-primary"
                    disabled={state.isLoading || !selectedFile()}
                >
                    推送文件
                </button>
            </div>

            <div class="file-section">
                <h4>从设备拉取文件 (Pull)</h4>
                <div class="form-group">
                    <label>设备文件路径:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            value={remotePath()}
                            onInput={(e) => setRemotePath(e.currentTarget.value)}
                            placeholder="/sdcard/Download/file.txt"
                            style="flex: 1;"
                        />
                        <button onClick={() => openFileBrowser('pull')} class="btn-secondary">
                            浏览
                        </button>
                    </div>
                    <small>设备上的文件完整路径，或点击"浏览"选择</small>
                </div>
                <div class="form-group">
                    <label>本地保存位置:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            value={localPath()}
                            readonly
                            placeholder="未设置（保存到桌面）"
                            style="flex: 1;"
                        />
                        <button onClick={chooseSaveLocation} class="btn-secondary">
                            选择位置
                        </button>
                    </div>
                    <small>留空将保存到桌面</small>
                </div>
                <button 
                    onClick={pullFileFromDevice} 
                    class="btn-primary"
                    disabled={state.isLoading || !remotePath()}
                >
                    拉取文件
                </button>
            </div>

            <div class="file-section">
                <h4>常用路径参考</h4>
                <div class="path-list">
                    <div class="path-item" onClick={() => copyPathToClipboard('/sdcard/Download/')}>
                        <strong>/sdcard/Download/</strong> - 下载文件夹
                        <button class="copy-btn" title="复制路径">📋</button>
                    </div>
                    <div class="path-item" onClick={() => copyPathToClipboard('/sdcard/DCIM/')}>
                        <strong>/sdcard/DCIM/</strong> - 相机照片
                        <button class="copy-btn" title="复制路径">📋</button>
                    </div>
                    <div class="path-item" onClick={() => copyPathToClipboard('/sdcard/Pictures/')}>
                        <strong>/sdcard/Pictures/</strong> - 图片文件夹
                        <button class="copy-btn" title="复制路径">📋</button>
                    </div>
                    <div class="path-item" onClick={() => copyPathToClipboard('/data/local/tmp/')}>
                        <strong>/data/local/tmp/</strong> - 临时文件夹
                        <button class="copy-btn" title="复制路径">📋</button>
                    </div>
                </div>
            </div>

            <Show when={showFileBrowser()}>
                <div class="dialog-overlay" onClick={() => setShowFileBrowser(false)}>
                    <div class="file-browser-dialog" onClick={(e) => e.stopPropagation()}>
                        <div class="dialog-header">
                            <h3>{browserMode() === 'push' ? '选择目标路径' : '浏览设备文件'}</h3>
                            <button class="dialog-close" onClick={() => setShowFileBrowser(false)}>×</button>
                        </div>
                        <div class="file-browser-toolbar">
                            <button onClick={goToParentDirectory} class="btn-secondary" disabled={currentDevicePath() === '/'}>
                                ← 上级目录
                            </button>
                            <span class="current-path">{currentDevicePath()}</span>
                        </div>
                        <div class="file-browser-content">
                            <Show when={deviceFiles().length === 0}>
                                <div class="file-empty">此目录为空</div>
                            </Show>
                            <For each={deviceFiles()}>
                                {(file) => (
                                    <div 
                                        class="file-item"
                                        onClick={() => selectDeviceFile(file)}
                                    >
                                        <span class="file-icon">{file.isDirectory ? '📁' : '📄'}</span>
                                        <span class="file-name">{file.name}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                        <div class="dialog-footer">
                            <Show when={browserMode() === 'push'}>
                                <button 
                                    onClick={() => {
                                        setRemotePath(currentDevicePath());
                                        setShowFileBrowser(false);
                                        showSuccess('已选择当前路径: ' + currentDevicePath());
                                    }} 
                                    class="btn-primary"
                                >
                                    使用当前路径
                                </button>
                            </Show>
                            <button onClick={() => setShowFileBrowser(false)} class="btn-secondary">
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    );
};

const Settings = () => {
    const [refreshInterval, setRefreshInterval] = createSignal(ConfigManager.get('refreshInterval') || 3000);
    const [lastSavePath, setLastSavePath] = createSignal(ConfigManager.get('lastSavePath') || '');
    const [logLimit, setLogLimit] = createSignal(ConfigManager.get('logLimit') || 100);
    const [logPollInterval, setLogPollInterval] = createSignal(ConfigManager.get('logPollInterval') || 300);
    
    const saveSettings = () => {
        ConfigManager.set('refreshInterval', refreshInterval());
        ConfigManager.set('logLimit', logLimit());
        ConfigManager.set('logPollInterval', logPollInterval());
        alert('设置已保存！');
    };
    
    const chooseSavePath = async () => {
        const result = await AdbApi.chooseDirectory();
        if (result.success && result.data?.path) {
            setLastSavePath(result.data.path);
            ConfigManager.set('lastSavePath', result.data.path);
        }
    };
    
    return (
        <div class="settings">
            <div class="section-header">
                <h3>设置</h3>
            </div>
            
            <div class="settings-section">
                <h4>设备管理</h4>
                <div class="form-group">
                    <label>自动刷新间隔 (毫秒):</label>
                    <input
                        type="number"
                        value={refreshInterval()}
                        onInput={(e) => setRefreshInterval(parseInt(e.currentTarget.value))}
                        min="1000"
                        step="1000"
                    />
                    <small>建议值: 2000-5000ms，过低可能影响性能</small>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>截图/录屏设置</h4>
                <div class="form-group">
                    <label>默认保存位置:</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input
                            type="text"
                            value={lastSavePath()}
                            readonly
                            placeholder="未设置（使用桌面）"
                            style="flex: 1;"
                        />
                        <button onClick={chooseSavePath} class="btn-secondary">
                            选择文件夹
                        </button>
                    </div>
                    <small>留空将默认保存到桌面</small>
                </div>
            </div>
            
            <div class="settings-section">
                <h4>日志设置</h4>
                <div class="form-group">
                    <label>日志显示条数:</label>
                    <input
                        type="number"
                        value={logLimit()}
                        onInput={(e) => setLogLimit(parseInt(e.currentTarget.value))}
                        min="10"
                        max="1000"
                        step="10"
                    />
                    <small>日志列表最多显示的条数 (10-1000)</small>
                </div>
                <div class="form-group">
                    <label>日志轮询间隔 (毫秒):</label>
                    <input
                        type="number"
                        value={logPollInterval()}
                        onInput={(e) => setLogPollInterval(parseInt(e.currentTarget.value))}
                        min="50"
                        max="2000"
                        step="50"
                    />
                    <small>日志更新频率 (50-2000ms)，值越小更新越快但CPU占用越高</small>
                </div>
            </div>
            
            <div class="settings-footer">
                <button onClick={saveSettings} class="btn-primary">
                    保存设置
                </button>
            </div>
        </div>
    );
};

const App = () => {
    const [activeTab, setActiveTab] = createSignal<Tab>("device-management");

    onMount(async () => {
        try {
            const result = await AdbApi.getDevices();
            if (result.success) {
                setState("isInitializing", false);
            } else {
                setState("isInitializing", false);
            }
        } catch (error) {
            setState("isInitializing", false);
        }
    });

    const handleTabChange = (tab: Tab) => {
        setActiveTab(tab);
    };
    
    const closePreview = () => {
        setState("previewImage", null);
    };
    
    const openVideoFolder = async () => {
        if (!state.previewVideo) return;
        
        try {
            const res = await AdbApi.openFolder(state.previewVideo);
            if (!res.success) {
                showError(res.error || '打开文件夹失败');
            }
        } catch (e) {
            showError('打开文件夹失败: ' + String(e));
        }
    };

    const openImageFolder = async () => {
        if (!state.previewImage) return;
        
        try {
            const res = await AdbApi.openFolder(state.previewImage);
            if (!res.success) {
                showError(res.error || '打开文件夹失败');
            }
        } catch (e) {
            showError('打开文件夹失败: ' + String(e));
        }
    };
    
    const copyImageToClipboard = async () => {
        if (!state.previewImage) return;
        
        try {
            const result = await AdbApi.copyFileToClipboard(state.previewImage);
            if (result.success) {
                showSuccess('图片已复制到剪切板');
            } else {
                showError(result.error || '复制失败');
            }
        } catch (error) {
            showError('复制失败: ' + String(error));
        }
    };
    
    const copyVideoToClipboard = async () => {
        if (!state.previewVideo) return;
        
        try {
            const result = await AdbApi.copyFileToClipboard(state.previewVideo);
            if (result.success) {
                showSuccess('视频已复制到剪切板');
            } else {
                showError(result.error || '复制失败');
            }
        } catch (error) {
            showError('复制失败: ' + String(error));
        }
    };
    
    return (
        <>
            <Show when={state.isInitializing}>
                <div class="loading-screen">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">正在初始化 ADB...</div>
                </div>
            </Show>
            
            <Show when={!state.isInitializing}>
                <Layout activeTab={activeTab()} setActiveTab={handleTabChange}>
                    <div style={{ display: activeTab() === 'device-management' ? 'block' : 'none' }}>
                        <DeviceManagement />
                    </div>
                    <div style={{ display: activeTab() === 'logcat' ? 'block' : 'none', overflow: 'auto', height: '100%' }}>
                        <LogcatView />
                    </div>
                    <div style={{ display: activeTab() === 'quick-actions' ? 'block' : 'none' }}>
                        <QuickActions />
                    </div>
                    <div style={{ display: activeTab() === 'file-management' ? 'block' : 'none' }}>
                        <FileManagement />
                    </div>
                    <div style={{ display: activeTab() === 'settings' ? 'block' : 'none' }}>
                        <Settings />
                    </div>
                </Layout>
            </Show>
            
            <Show when={state.previewImage}>
                <div class="dialog-overlay" onClick={closePreview}>
                    <div class="preview-dialog" onClick={(e) => e.stopPropagation()}>
                        <div class="dialog-header">
                            <h3>截图预览</h3>
                            <button class="dialog-close" onClick={closePreview}>×</button>
                        </div>
                        <div class="preview-content">
                            <img src={state.previewImage!} alt="截图预览" />
                        </div>
                        <div class="dialog-footer">
                            <button title="复制到剪切板" onClick={copyImageToClipboard} class="btn-secondary">
                                复制
                            </button>
                            <button title="打开文件夹" onClick={openImageFolder} class="btn-secondary">
                                打开文件夹
                            </button>
                            <div class="flex-1" />
                            <button onClick={closePreview} class="btn-primary">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
            
            <Show when={state.previewVideo}>
                <div class="dialog-overlay" onClick={() => setState("previewVideo", null)}>
                    <div class="preview-dialog" onClick={(e) => e.stopPropagation()}>
                        <div class="dialog-header">
                            <h3>录屏预览</h3>
                            <button class="dialog-close" onClick={() => setState("previewVideo", null)}>×</button>
                        </div>
                        <div class="preview-content">
                            <video src={state.previewVideo!} controls style="max-width: 100%; max-height: 60vh;" />
                        </div>
                        <div class="dialog-footer">
                            <button title="复制到剪切板" onClick={copyVideoToClipboard} class="btn-secondary">
                                复制
                            </button>
                            <button title="打开文件夹" onClick={openVideoFolder} class="btn-secondary">
                                打开文件夹
                            </button>
                            <div class="flex-1" />
                            <button onClick={() => setState("previewVideo", null)} class="btn-primary">
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            </Show>
        </>
    );
};

render(() => <App />, document.getElementById("solid-app")!);
