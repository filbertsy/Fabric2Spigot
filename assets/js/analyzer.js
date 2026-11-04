
async function analyzeFabricMod(file) {
    if (!file || !file.name.toLowerCase().endsWith(".jar")) {
        throw new Error("Please select a valid JAR file.");
    }

    if (!window.JSZip) {
        throw new Error("JAR reader failed to load.");
    }

    const zip = await JSZip.loadAsync(file);

    const metadataFile = zip.file("fabric.mod.json");

    if (!metadataFile) {
        throw new Error("fabric.mod.json not found.");
    }

    const metadata = JSON.parse(
        await metadataFile.async("string")
    );

    const files = Object.keys(zip.files);

    return {
        name: metadata.name || metadata.id,
        id: metadata.id,
        version: metadata.version,
        description: metadata.description || "No description",
        entrypoints: metadata.entrypoints || {},
        dependencies: metadata.depends || {},
        mixins: metadata.mixins || [],
        classes: files.filter(file => file.endsWith(".class")).length,
        totalFiles: files.length
    };
}
