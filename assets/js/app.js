
(() => {
    "use strict";

    const API_URL = "https://fabric2spigot-api.freehook.workers.dev";
    const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
    const TARGET_VERSION = "1.21.8";

    function initialize() {
        const fileInput = document.getElementById("modFile");
        const analyzeButton = document.getElementById("analyzeButton");
        const output = document.getElementById("output");
        const selectedFile = document.getElementById("selectedFile");
        const dropZone = document.getElementById("dropZone");

        if (!fileInput || !analyzeButton || !output) {
            console.error("[Fabric2Spigot] Required HTML elements missing.");
            return;
        }

        let currentFile = null;

        function log(message) {
            output.textContent = message;
            console.log("[Fabric2Spigot]", message);
        }

        function selectFile(file) {
            if (!file) return;

            if (!/\.(jar|zip)$/i.test(file.name)) {
                currentFile = null;
                log("Error: select a .jar or .zip file.");
                return;
            }

            if (file.size > MAX_UPLOAD_SIZE) {
                currentFile = null;
                log("Error: file exceeds the 25 MB upload limit.");
                return;
            }

            currentFile = file;

            if (selectedFile) {
                selectedFile.textContent = "selected: " + file.name;
            }

            log(
                "File selected successfully.\n" +
                "Name: " + file.name + "\n" +
                "Size: " + (file.size / 1024).toFixed(2) + " KB"
            );
        }

        fileInput.addEventListener("change", () => {
            selectFile(fileInput.files?.[0]);
        });

        if (dropZone) {
            dropZone.addEventListener("dragover", event => {
                event.preventDefault();
                dropZone.classList.add("dragging");
            });

            dropZone.addEventListener("dragleave", () => {
                dropZone.classList.remove("dragging");
            });

            dropZone.addEventListener("drop", event => {
                event.preventDefault();
                dropZone.classList.remove("dragging");

                selectFile(event.dataTransfer?.files?.[0]);
            });
        }

        analyzeButton.addEventListener("click", async () => {
            if (analyzeButton.disabled) return;

            if (!currentFile) {
                log("Please select a Fabric JAR first.");
                return;
            }

            const formData = new FormData();
            formData.append("file", currentFile);
            formData.append("version", TARGET_VERSION);

            analyzeButton.disabled = true;
            log("Uploading " + currentFile.name + "...");

            try {
                const endpoint = API_URL + "/api/convert";

                console.log("[Fabric2Spigot] Sending POST:", endpoint);

                const response = await fetch(endpoint, {
                    method: "POST",
                    body: formData
                });

                console.log("[Fabric2Spigot] Response:", response.status);

                if (!response.ok) {
                    const error = await response.json().catch(() => ({}));

                    throw new Error(
                        error.error || "Server returned HTTP " + response.status
                    );
                }

                const contentType =
                    response.headers.get("content-type") || "";

                if (!contentType.includes("application/zip")) {
                    throw new Error(
                        "Expected ZIP, received: " + contentType
                    );
                }

                const blob = await response.blob();

                if (!blob.size) {
                    throw new Error("The generated ZIP is empty.");
                }

                const downloadURL = URL.createObjectURL(blob);
                const link = document.createElement("a");

                link.href = downloadURL;
                link.download = "fabric2spigot-project.zip";

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(downloadURL), 10000);

                log(
                    "CONVERSION COMPLETE\n\n" +
                    "File: " + currentFile.name + "\n" +
                    "Target: " + TARGET_VERSION + "\n" +
                    "ZIP size: " + (blob.size / 1024).toFixed(2) + " KB\n\n" +
                    "Your plugin project has been generated."
                );

            } catch (error) {
                console.error("[Fabric2Spigot] Conversion error:", error);
                log("CONVERSION FAILED\n\n" + error.message);
            } finally {
                analyzeButton.disabled = false;
            }
        });

        log("Fabric2Spigot initialized.\nWaiting for a Fabric mod...");
        console.log("[Fabric2Spigot] Application initialized.");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize, {
            once: true
        });
    } else {
        initialize();
    }
})();
