const API_URL = "https://fabric2spigot-api.freehook.workers.dev";

const fileInput = document.getElementById("modFile");
const analyzeButton = document.getElementById("analyzeButton");
const output = document.getElementById("output");

analyzeButton.addEventListener("click", async () => {
    const file = fileInput.files[0];

    if (!file) {
        output.textContent = "Select a Fabric JAR first.";
        return;
    }

    analyzeButton.disabled = true;
    output.textContent = "Analyzing mod...";

    try {
        const result = await analyzeFabricMod(file);

        output.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
        output.textContent = "Analysis failed: " + error.message;
    } finally {
        analyzeButton.disabled = false;
    }
});
