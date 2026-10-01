const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

app.setAppUserModelId("com.trickortree.treesim");

let mainWindow = null;

let pendingUpdateInfo = null;
let rendererReady = false;
let queuedUpdate = null;

function getUpdateInfoFile() {
    return path.join(
        app.getPath("userData"),
        "pending-update.json"
    );
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 1280,
        minHeight: 820,
        maxWidth: 1280,
        maxHeight: 820,
        resizable: false,
        maximizable: false,
        fullscreenable: false,
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

    rendererReady = false;

    mainWindow.loadFile(
        path.join(__dirname, "index.html")
    );

    mainWindow.webContents.on(
        "console-message",
        (event, level, message, line, sourceId) => {
            console.log(`[renderer] ${message} (${sourceId}:${line})`);
        }
    );

    mainWindow.webContents.on(
        "did-finish-load",
        () => {
            rendererReady = true;

            console.log(
                "Game HTML finished loading."
            );

            // Send an update that was discovered
            // before the renderer was ready.
            if (queuedUpdate) {
                sendToGame(
                    "update-available",
                    queuedUpdate
                );

                queuedUpdate = null;
            }
        }
    );

    mainWindow.once(
        "ready-to-show",
        () => {
            mainWindow.show();
        }
    );

    mainWindow.on(
        "closed",
        () => {
            mainWindow = null;
            rendererReady = false;
        }
    );
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

    if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        rendererReady
    ) {
        mainWindow.webContents.send(
            channel,
            data
        );

        return true;
    }

    return false;
}

async function savePendingUpdate() {

    if (!pendingUpdateInfo) {
        return;
    }

    try {

        await fs.promises.writeFile(
            getUpdateInfoFile(),
            JSON.stringify(
                pendingUpdateInfo,
                null,
                2
            ),
            "utf8"
        );

        console.log(
            "Saved post-update information."
        );

    } catch (error) {

        console.error(
            "Failed to save post-update information:",
            error
        );
    }
}

async function loadPendingUpdate() {

    try {

        const file =
            getUpdateInfoFile();

        if (!fs.existsSync(file)) {
            return null;
        }

        const data =
            await fs.promises.readFile(
                file,
                "utf8"
            );

        return JSON.parse(data);

    } catch (error) {

        console.error(
            "Failed to load post-update information:",
            error
        );

        return null;
    }
}

async function clearPendingUpdate() {

    try {

        const file =
            getUpdateInfoFile();

        if (fs.existsSync(file)) {
            await fs.promises.unlink(file);
        }

    } catch (error) {

        console.error(
            "Failed to clear post-update information:",
            error
        );
    }
}

function setupAutoUpdater() {

    if (!app.isPackaged) {

        console.log(
            "Auto-updater disabled in development mode."
        );

        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.fullChangelog = true;

    autoUpdater.on(
        "checking-for-update",
        () => {

            console.log(
                "Checking for updates..."
            );
        }
    );

    autoUpdater.on(
        "update-available",
        info => {

            console.log(
                `UPDATE AVAILABLE: ${info.version}`
            );

            const releaseNotes =
                cleanReleaseNotes(
                    info.releaseNotes
                ) ||
                "No release notes provided.";

            const updateData = {
                currentVersion:
                    app.getVersion(),

                newVersion:
                    info.version,

                releaseNotes
            };

            pendingUpdateInfo = {
                version:
                    info.version,

                releaseNotes
            };

            // If HTML is already ready, show it now.
            // Otherwise queue it until did-finish-load.
            if (!sendToGame(
                "update-available",
                updateData
            )) {

                console.log(
                    "Renderer not ready; queuing update modal."
                );

                queuedUpdate =
                    updateData;
            }
        }
    );

    autoUpdater.on(
        "update-not-available",
        info => {

            console.log(
                `No update available. Current version: ${app.getVersion()}`
            );
        }
    );

    autoUpdater.on(
        "download-progress",
        progress => {

            sendToGame(
                "update-progress",
                {
                    percent:
                        Math.round(
                            progress.percent
                        ),

                    transferred:
                        progress.transferred,

                    total:
                        progress.total,

                    bytesPerSecond:
                        progress.bytesPerSecond
                }
            );
        }
    );

    autoUpdater.on(
        "update-downloaded",
        async () => {

            console.log(
                "Update downloaded."
            );

            await savePendingUpdate();

            sendToGame(
                "update-downloaded"
            );

            setTimeout(
                () => {

                    autoUpdater.quitAndInstall();

                },
                1200
            );
        }
    );

    autoUpdater.on(
        "error",
        error => {

            console.error(
                "AUTO-UPDATER ERROR:",
                error
            );

            sendToGame(
                "update-error",
                {
                    message:
                        String(error)
                }
            );
        }
    );

    ipcMain.on(
        "download-update",
        async () => {

            console.log(
                "Downloading update..."
            );

            try {

                await autoUpdater.downloadUpdate();

            } catch (error) {

                console.error(
                    "Failed to download update:",
                    error
                );

                sendToGame(
                    "update-error",
                    {
                        message:
                            String(error)
                    }
                );
            }
        }
    );

    ipcMain.on(
        "retry-update",
        async () => {

            console.log(
                "Retrying update check..."
            );

            try {

                await autoUpdater.checkForUpdates();

            } catch (error) {

                console.error(
                    "Update retry failed:",
                    error
                );

                sendToGame(
                    "update-error",
                    {
                        message:
                            String(error)
                    }
                );
            }
        }
    );

    // Check shortly after startup.
    setTimeout(
        () => {

            console.log(
                "Starting automatic update check..."
            );

            autoUpdater
                .checkForUpdates()
                .catch(error => {

                    console.error(
                        "Update check failed:",
                        error
                    );
                });

        },
        5000
    );
}

app.whenReady().then(async () => {

    const previousUpdate =
        await loadPendingUpdate();

    createWindow();

    // Show the "What's New" screen after
    // the game has restarted into the new version.
    if (
        previousUpdate &&
        previousUpdate.version ===
            app.getVersion()
    ) {

        mainWindow.webContents.once(
            "did-finish-load",
            async () => {

                console.log(
                    "Showing post-update changelog."
                );

                sendToGame(
                    "post-update",
                    {
                        version:
                            previousUpdate.version,

                        releaseNotes:
                            previousUpdate.releaseNotes
                    }
                );

                await clearPendingUpdate();
            }
        );

    } else if (previousUpdate) {

        await clearPendingUpdate();
    }

    setupAutoUpdater();

    app.on(
        "activate",
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {
                createWindow();
            }
        }
    );
});

app.on(
    "window-all-closed",
    () => {

        if (
            process.platform !== "darwin"
        ) {
            app.quit();
        }
    }
);