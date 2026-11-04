
const API_URL = "https://fabric2spigot-api.freehook.workers.dev";

const fileInput = document.getElementById("modFile");
const analyzeButton = document.getElementById("analyzeButton");
const output = document.getElementById("output");

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

function log(message) {
    if (output) {
        output.textContent = message;
    }
}

analyzeButton?.addEventListener("click", async () => {
    const file = fileInput?.files?.[0];

    if (!file) {
        log("Select a Fabric JAR or ZIP first.");
        return;
    }

    if (!/\.(jar|zip)$/i.test(file.name)) {
        log("Invalid file. Only JAR and ZIP files are supported.");
        return;
    }

    if (file.size > MAX_UPLOAD_SIZE) {
        log("File exceeds the 25 MB upload limit.");
        return;
    }

    const versionSelect = document.getElementById("targetVersion");
    const version = versionSelect?.value || "1.21.8";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("version", version);

    analyzeButton.disabled = true;
    log("Uploading mod to Fabric2Spigot API...");

    try {
        const response = await fetch(`${API_URL}/api/convert`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const error = await response.json().catch(() => null);

            throw new Error(
                error?.error || `API returned HTTP ${response.status}`
            );
        }

        const contentType = response.headers.get("Content-Type") || "";

        if (!contentType.includes("application/zip")) {
            throw new Error("Server did not return a ZIP archive.");
        }

        log("Conversion complete. Preparing download...");

        const blob = await response.blob();

        if (!blob.size) {
            throw new Error("Generated ZIP is empty.");
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = downloadUrl;
        link.download = "fabric2spigot-project.zip";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

        log(
            `Conversion successful!\n\n` +
            `File: ${file.name}\n` +
            `Target: ${version}\n` +
            `ZIP size: ${(blob.size / 1024).toFixed(2)} KB\n\n` +
            `Your download should be available.`
        );

    } catch (error) {
        log("Conversion failed: " + error.message);
        console.error("Fabric2Spigot conversion error:", error);
    } finally {
        analyzeButton.disabled = false;
    }
});
