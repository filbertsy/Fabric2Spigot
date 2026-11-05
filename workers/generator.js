
import { zipSync, strToU8 } from "fflate";

function safeName(value) {
    return String(value || "ConvertedMod")
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 48) || "ConvertedMod";
}

function safeModId(value) {
    let id = String(value || "converted_mod")
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "_");

    if (!/^[a-z]/.test(id)) {
        id = `mod_${id}`;
    }

    return id.slice(0, 64);
}

function escapeYaml(value) {
    return String(value || "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "''")
        .replace(/\r?\n/g, " ");
}

function put(files, path, content) {
    files[path] = strToU8(content);
}

function inferSide(item) {
    if (item.side) return item.side;

    const category = String(item.category || "").toLowerCase();

    if (
        category === "client_rendering" ||
        category === "client_entrypoint"
    ) {
        return "client";
    }

    if (
        category === "networking"
    ) {
        return "hybrid";
    }

    if (
        category === "commands" ||
        category === "player_events" ||
        category === "server_events" ||
        category === "items" ||
        category === "blocks" ||
        category === "entities" ||
        category === "recipes"
    ) {
        return "server";
    }

    return "unknown";
}

export async function generatePluginZip({
    metadata,
    features,
    translations,
    target
}) {
    if (
        !metadata ||
        !target ||
        !Array.isArray(features) ||
        !Array.isArray(translations)
    ) {
        throw new Error("Invalid project generation data.");
    }

    const required = [
        "paperApi",
        "apiVersion",
        "minecraft",
        "java",
        "fabricLoader",
        "fabricApi",
        "loom"
    ];

    for (const key of required) {
        if (
            target[key] === undefined ||
            target[key] === null ||
            target[key] === ""
        ) {
            throw new Error(`Missing target configuration: ${key}`);
        }
    }

    const projectName = safeName(metadata.id);
    const modId = safeModId(metadata.id);

    const root = projectName;

    const normalized = translations.map(item => ({
        ...item,
        side: inferSide(item)
    }));

    const experimental = normalized.filter(
        item => item.status === "experimental"
    );

    const manual = normalized.filter(
        item => item.status === "manual_port_required"
    );

    const unsupported = normalized.filter(
        item => item.status === "unsupported"
    );

    const serverFeatures = normalized.filter(
        item => item.side === "server" || item.side === "hybrid"
    );

    const clientFeatures = normalized.filter(
        item => item.side === "client" || item.side === "hybrid"
    );

    const packageName = "dev.fabric2spigot.generated";
    const javaVersion = Number(target.java);

    if (!Number.isInteger(javaVersion) || javaVersion < 17) {
        throw new Error("Invalid Java target version.");
    }

    const javaName = JSON.stringify(metadata.name || metadata.id);
    const description = escapeYaml(
        metadata.description || `Generated from ${metadata.name || metadata.id}`
    );

    const files = {};

    // Root Gradle project
    put(files, `${root}/settings.gradle`, `
pluginManagement {
    repositories {
        maven {
            url = "https://maven.fabricmc.net/"
        }
        gradlePluginPortal()
        mavenCentral()
    }
}

rootProject.name = '${projectName}'

include 'plugin'
include 'client-mod'
`);

    put(files, `${root}/build.gradle`, `
allprojects {
    group = '${packageName}'
    version = '1.0.0'

    repositories {
        mavenCentral()

        maven {
            url = 'https://repo.papermc.io/repository/maven-public/'
        }

        maven {
            url = 'https://maven.fabricmc.net/'
        }
    }
}
`);

    put(files, `${root}/gradle.properties`, `
org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true

minecraft_version=${target.minecraft}
paper_api_version=${target.paperApi}
java_version=${javaVersion}

fabric_loader_version=${target.fabricLoader}
fabric_api_version=${target.fabricApi}
loom_version=${target.loom}
`);

    // Paper plugin module
    put(files, `${root}/plugin/build.gradle`, `
plugins {
    id 'java'
}

dependencies {
    compileOnly "io.papermc.paper:paper-api:\${paper_api_version}"
}

sourceSets {
    main {
        java {
            srcDir rootProject.file('shared/src/main/java')
        }
    }
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(\${javaVersion})
    }
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}
`);

    put(files, `${root}/plugin/src/main/resources/plugin.yml`, `
name: ${projectName}
version: 1.0.0
main: ${packageName}.ConvertedPlugin
api-version: '${target.apiVersion}'
description: '${description}'
`);

    put(files, `${root}/plugin/src/main/java/dev/fabric2spigot/generated/ConvertedPlugin.java`, `
package dev.fabric2spigot.generated;

import org.bukkit.plugin.java.JavaPlugin;

public final class ConvertedPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        getLogger().info("Hybrid Paper module initialized.");
        getLogger().info("Original Fabric mod: " + ${javaName});
        getLogger().info("Server feature entries: ${serverFeatures.length}");
        getLogger().info("Client feature entries: ${clientFeatures.length}");
        getLogger().warning("Generated scaffold: original behavior has not been ported.");
    }

    @Override
    public void onDisable() {
        getLogger().info("Hybrid Paper module disabled.");
    }
}
`);

    // Fabric client module
    put(files, `${root}/client-mod/build.gradle`, `
plugins {
    id 'net.fabricmc.fabric-loom-remap' version "\${loom_version}"
}

base {
    archivesName = '${modId}-client'
}

dependencies {
    minecraft "com.mojang:minecraft:\${minecraft_version}"
    mappings loom.officialMojangMappings()

    modImplementation "net.fabricmc:fabric-loader:\${fabric_loader_version}"
    modImplementation "net.fabricmc.fabric-api:fabric-api:\${fabric_api_version}"
}

sourceSets {
    main {
        java {
            srcDir rootProject.file('shared/src/main/java')
        }
    }
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(\${javaVersion})
    }
}
`);

    const fabricMetadata = {
        schemaVersion: 1,
        id: modId,
        version: "1.0.0",
        name: String(metadata.name || metadata.id),
        description: String(
            metadata.description || "Generated Fabric client module."
        ),
        environment: "client",
        entrypoints: {
            client: [
                "dev.fabric2spigot.generated.ConvertedClient"
            ]
        },
        depends: {
            fabricloader: `>=${target.fabricLoader}`,
            minecraft: `~${target.minecraft}`,
            java: `>=${javaVersion}`,
            "fabric-api": "*"
        }
    };

    put(
        files,
        `${root}/client-mod/src/main/resources/fabric.mod.json`,
        JSON.stringify(fabricMetadata, null, 2)
    );

    put(files, `${root}/client-mod/src/main/java/dev/fabric2spigot/generated/ConvertedClient.java`, `
package dev.fabric2spigot.generated;

import net.fabricmc.api.ClientModInitializer;

public final class ConvertedClient implements ClientModInitializer {

    @Override
    public void onInitializeClient() {
        System.out.println("[Fabric2Spigot] Client module initialized.");
        System.out.println("[Fabric2Spigot] Original mod: " + ${javaName});
        System.out.println("[Fabric2Spigot] Client features detected: ${clientFeatures.length}");
        System.out.println("[Fabric2Spigot] Rendering implementations require manual porting.");
    }
}
`);

    // Shared module
    put(files, `${root}/shared/src/main/java/dev/fabric2spigot/shared/Protocol.java`, `
package dev.fabric2spigot.shared;

public final class Protocol {

    public static final String CHANNEL = "fabric2spigot:hybrid";

    private Protocol() {
    }
}
`);

    // Diagnostics report
    const report = {
        originalMod: metadata,
        target,
        architecture: "hybrid",
        modules: [
            "plugin",
            "client-mod",
            "shared"
        ],
        summary: {
            detectedFeatures: features.length,
            serverFeatures: serverFeatures.length,
            clientFeatures: clientFeatures.length,
            experimental: experimental.length,
            manualPortRequired: manual.length,
            unsupported: unsupported.length
        },
        detectedFeatures: features,
        translations: normalized,
        behaviorAutomaticallyPorted: false
    };

    put(
        files,
        `${root}/conversion-report.json`,
        JSON.stringify(report, null, 2)
    );

    const diagnostics = [
        "# Hybrid conversion diagnostics",
        "",
        `- Original mod: ${metadata.name || metadata.id}`,
        `- Mod ID: ${metadata.id}`,
        `- Mod version: ${metadata.version || "unknown"}`,
        `- Minecraft: ${target.minecraft}`,
        `- Paper API: ${target.paperApi}`,
        `- Java: ${javaVersion}`,
        "- Architecture: Hybrid",
        `- Detected features: ${features.length}`,
        `- Server feature entries: ${serverFeatures.length}`,
        `- Client feature entries: ${clientFeatures.length}`,
        `- Experimental entries: ${experimental.length}`,
        `- Manual port required: ${manual.length}`,
        `- Unsupported entries: ${unsupported.length}`,
        "",
        "## Detected features",
        ...features.map(item =>
            `- ${item.category}: ${item.marker} (${item.source})`
        ),
        "",
        "## Translation assessment",
        ...normalized.map(item =>
            `- [${String(item.status).toUpperCase()}] [${item.side}] ${item.category}: ${item.explanation}`
        ),
        "",
        "## Limitations",
        "- This project is a hybrid scaffold, not a completed behavioral conversion.",
        "- Original Fabric classes and resources are not transferred.",
        "- Client rendering requires individual implementation.",
        "- Paper and Fabric modules must be implemented separately.",
        "- Mixins require individual review.",
        "- The shared protocol currently defines a channel identifier only."
    ].join("\n");

    put(files, `${root}/diagnostics.md`, diagnostics);

    // Project documentation
    const readme = `
# ${projectName}

Hybrid Paper + Fabric project generated by Fabric2Spigot.

## Modules

- plugin/: Paper server plugin.
- client-mod/: Fabric client mod.
- shared/: shared Java source.
- diagnostics.md: conversion diagnostics.
- conversion-report.json: machine-readable report.

## Requirements

- Java ${javaVersion}
- Gradle 8.14 or compatible
- Minecraft ${target.minecraft}
- Paper API ${target.paperApi}

## Build

Run from this directory:

\`\`\`bash
gradle build
\`\`\`

Paper plugin output:

\`plugin/build/libs/\`

Fabric client mod output:

\`client-mod/build/libs/\`

## Installation

1. Install the plugin JAR on the Paper server.
2. Install the Fabric client JAR on each compatible client.
3. Use matching Minecraft and Fabric Loader versions.

## Important

This is a project scaffold. It does not automatically reproduce the
original Fabric mod's behavior.

Review diagnostics.md before using the generated project.
`;

    put(files, `${root}/README.md`, readme);

    put(files, `${root}/.gitignore`, `
.gradle/
build/
*/build/
.idea/
.vscode/
*.iml
`);

    try {
        return zipSync(files, { level: 6 });
    } catch (error) {
        console.error("Fabric2Spigot ZIP generation error:", error);
        throw new Error("Could not package the generated hybrid project.");
    }
}
