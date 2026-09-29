const { app, BrowserWindow } = require("electron");
const path = require("path");

app.setAppUserModelId("com.hypergamous.treechopping");

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

app.whenReady().then(() => {
    createWindow();

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
