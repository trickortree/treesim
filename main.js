const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

app.setAppUserModelId("com.trickortree.treesim");

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 1000,
        minHeight: 680,
        backgroundColor: "#080a0f",
        show: false,
        title: "Hypergamous Tree Chopping Simulator 3",
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            backgroundThrottling: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, "index.html"));

    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

function cleanReleaseNotes(releaseNotes) {
    let text = "";

    if (Array.isArray(releaseNotes)) {
        text = releaseNotes
            .map(entry => {
                if (typeof entry === "string") {
                    return entry;
                }

                return entry?.note || "";
            })
            .filter(Boolean)
            .join("\n\n");
    } else if (releaseNotes) {
        text = String(releaseNotes);
    }

    // Convert common HTML release-note formatting into clean text
    text = text
        .replace(/\r/g, "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/li>\s*/gi, "\n")
        .replace(/<li[^>]*>/gi, "• ")
        .replace(/<\/(?:p|div|h[1-6]|ul|ol)>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    return text;
}

function sendToGame(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

function setupAutoUpdater() {
    if (!app.isPackaged) {
        console.log("Auto-updater disabled in development mode.");
        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.fullChangelog = true;

    autoUpdater.on("checking-for-update", () => {
        console.log("Checking for updates...");
    });

    autoUpdater.on("update-available", info => {
        console.log(`Update available: ${info.version}`);

        sendToGame("update-available", {
            currentVersion: app.getVersion(),
            newVersion: info.version,
            releaseNotes:
                cleanReleaseNotes(info.releaseNotes) ||
                "Check the GitHub release for details."
        });
    });

    autoUpdater.on("update-not-available", () => {
        console.log("Game is up to date.");
    });

    autoUpdater.on("download-progress", progress => {
        sendToGame("update-progress", {
            percent: Math.round(progress.percent),
            transferred: progress.transferred,
            total: progress.total,
            bytesPerSecond: progress.bytesPerSecond
        });
    });

    autoUpdater.on("update-downloaded", () => {
        console.log("Update downloaded.");

        sendToGame("update-downloaded");

        // Give the HTML modal a moment to show "Restarting..."
        setTimeout(() => {
            autoUpdater.quitAndInstall();
        }, 1200);
    });

    autoUpdater.on("error", error => {
        console.error("Auto-updater error:", error);

        sendToGame("update-error", {
            message: String(error)
        });
    });

    ipcMain.on("download-update", async () => {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error("Failed to download update:", error);

            sendToGame("update-error", {
                message: String(error)
            });
        }
    });

    ipcMain.on("retry-update", async () => {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error) {
            console.error("Update check failed:", error);

            sendToGame("update-error", {
                message: String(error)
            });
        }
    });

    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(error => {
            console.error("Update check failed:", error);
        });
    }, 5000);
}

app.whenReady().then(() => {
    createWindow();
    setupAutoUpdater();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});