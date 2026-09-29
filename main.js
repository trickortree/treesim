const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

app.setAppUserModelId("com.trickortree.treesim");

let mainWindow;
let pendingUpdateInfo = null;

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

    mainWindow.loadFile(
        path.join(__dirname, "index.html")
    );

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

    // Convert common HTML formatting into clean text
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
        !mainWindow.isDestroyed()
    ) {
        mainWindow.webContents.send(
            channel,
            data
        );
    }
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

        if (
            !fs.existsSync(file)
        ) {
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

        if (
            fs.existsSync(file)
        ) {
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
                `Update available: ${info.version}`
            );

            const releaseNotes =
                cleanReleaseNotes(
                    info.releaseNotes
                ) ||
                "No release notes provided.";

            // Remember the update information
            // while the current game is running.
            pendingUpdateInfo = {
                version: info.version,
                releaseNotes
            };

            // Tell the HTML game to show
            // the in-game update modal.
            sendToGame(
                "update-available",
                {
                    currentVersion:
                        app.getVersion(),

                    newVersion:
                        info.version,

                    releaseNotes
                }
            );

        }
    );

    autoUpdater.on(
        "update-not-available",
        () => {

            console.log(
                "Game is up to date."
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

            // Save the release information
            // so the NEW version can show
            // the changelog after restarting.
            await savePendingUpdate();

            sendToGame(
                "update-downloaded"
            );

            // Give the HTML modal time
            // to display "Restarting..."
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
                "Auto-updater error:",
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

    // User clicked UPDATE NOW
    ipcMain.on(
        "download-update",
        async () => {

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

    // User clicked RETRY UPDATE
    ipcMain.on(
        "retry-update",
        async () => {

            try {

                await autoUpdater.checkForUpdates();

            } catch (error) {

                console.error(
                    "Update check failed:",
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

    // Check for updates 5 seconds after launch
    setTimeout(
        () => {

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

    createWindow();

    setupAutoUpdater();

    // Check whether the previous version
    // downloaded an update and restarted.
    const previousUpdate =
        await loadPendingUpdate();

    if (
        previousUpdate &&
        previousUpdate.version ===
            app.getVersion()
    ) {

        // Wait until index.html has loaded.
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

                // Delete the file so the
                // changelog only shows once.
                await clearPendingUpdate();

            }
        );

    } else if (previousUpdate) {

        // Safety cleanup if the saved
        // version doesn't match.
        await clearPendingUpdate();

    }

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