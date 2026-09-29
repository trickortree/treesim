const { app, BrowserWindow, dialog } = require("electron");
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

function setupAutoUpdater() {
    // Never run the updater while you're developing with npm start.
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

    autoUpdater.on("update-available", async (info) => {
        let releaseNotes = "";

        if (Array.isArray(info.releaseNotes)) {
            releaseNotes = info.releaseNotes
                .map(entry => {
                    if (typeof entry === "string") {
                        return entry;
                    }

                    return entry?.note || "";
                })
                .filter(Boolean)
                .join("\n\n");
        } else if (info.releaseNotes) {
            releaseNotes = String(info.releaseNotes);
        }

        const result = await dialog.showMessageBox({
            type: "info",
            title: "Update Available",
            message: "Hypergamous Tree Chopping Simulator 3 has an update!",
            detail:
                `Current version: ${app.getVersion()}\n` +
                `New version: ${info.version}\n\n` +
                `What's New:\n` +
                `${releaseNotes || "Check the GitHub release notes for details."}`,
            buttons: ["Update Now", "Later"],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            try {
                await autoUpdater.downloadUpdate();
            } catch (error) {
                console.error("Failed to download update:", error);

                await dialog.showMessageBox({
                    type: "error",
                    title: "Update Failed",
                    message: "The update could not be downloaded.",
                    detail: String(error)
                });
            }
        }
    });

    autoUpdater.on("update-not-available", () => {
        console.log("Game is up to date.");
    });

    autoUpdater.on("update-downloaded", async () => {
        const result = await dialog.showMessageBox({
            type: "info",
            title: "Update Ready",
            message: "The update has finished downloading.",
            detail: "Restart the game now to install it.",
            buttons: ["Restart & Install", "Later"],
            defaultId: 0,
            cancelId: 1
        });

        if (result.response === 0) {
            autoUpdater.quitAndInstall();
        }
    });

    autoUpdater.on("error", (error) => {
        console.error("Auto-updater error:", error);
    });

    // Wait a few seconds so the game has finished opening before checking.
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