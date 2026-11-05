import { zipSync, strToU8 } from "fflate";

const PACKAGE_NAME = "dev.fabric2spigot.generated";
const BROADCAST_CONVERSION = "simple_broadcast_v1";

function safeName(value) {
  return String(value || "ConvertedMod")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 48) || "ConvertedMod";
}

function escapeYaml(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "''")
    .replace(/[\r\n]/g, " ");
}

function javaString(value) {
  return JSON.stringify(String(value ?? ""));
}

function put(files, path, content) {
  files[path] = strToU8(content);
}

function validateInput({ metadata, features, translations, target }) {
  if (
    !metadata ||
    typeof metadata.id !== "string" ||
    !Array.isArray(features) ||
    !Array.isArray(translations) ||
    !target
  ) {
    throw new Error("Invalid project generation data.");
  }

  for (const key of ["paperApi", "apiVersion", "minecraft", "java"]) {
    if (
      target[key] === undefined ||
      target[key] === null ||
      target[key] === ""
    ) {
      throw new Error(`Missing target configuration: ${key}`);
    }
  }

  const javaVersion = Number(target.java);

  if (!Number.isInteger(javaVersion) || javaVersion < 21) {
    throw new Error("This generator requires Java 21 or newer.");
  }

  if (!/^[0-9]+\.[0-9]+(?:\.[0-9]+)?-R[0-9.]+-SNAPSHOT$/.test(target.paperApi)) {
    throw new Error("Invalid Paper API version.");
  }

  if (!/^[0-9]+\.[0-9]+(?:\.[0-9]+)?$/.test(target.apiVersion)) {
    throw new Error("Invalid Paper plugin API version.");
  }
}

function normalizeTranslations(translations, metadata) {
  return translations.map(item => {
    const result = { ...item };

    if (result.conversion === BROADCAST_CONVERSION) {
      if (metadata.id !== "simple_broadcast") {
        result.status = "manual";
        delete result.conversion;
        result.explanation =
          "The recognized command pattern does not match the uploaded mod ID.";
      }
    }

    return result;
  });
}

function generatePluginClass({ broadcastEnabled, originalName }) {
  const commandCode = broadcastEnabled
    ? `
        Objects.requireNonNull(getCommand("broadcast"))
            .setExecutor((sender, command, label, args) -> {
                if (args.length != 1) {
                    return false;
                }

                Component message = Component.text("[Broadcast]", NamedTextColor.GOLD)
                    .append(Component.space())
                    .append(Component.text(args[0], NamedTextColor.GREEN));

                Bukkit.broadcast(message);
                return true;
            });
`
    : "";

  return `
package ${PACKAGE_NAME};

import java.util.Objects;

import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.NamedTextColor;

import org.bukkit.Bukkit;
import org.bukkit.plugin.java.JavaPlugin;

public final class ConvertedPlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        getLogger().info("Converted plugin enabled.");
        getLogger().info("Original mod: " + ${javaString(originalName)});
${commandCode}
    }

    @Override
    public void onDisable() {
        getLogger().info("Converted plugin disabled.");
    }
}
`;
}

export async function generatePluginZip({
  metadata,
  features,
  translations,
  target
}) {
  validateInput({ metadata, features, translations, target });

  const normalized = normalizeTranslations(translations, metadata);

  const broadcastEnabled = normalized.some(
    item =>
      item.status === "supported" &&
      item.conversion === BROADCAST_CONVERSION
  );

  const projectName = safeName(metadata.id);
  const javaVersion = Number(target.java);
  const description = escapeYaml(
    metadata.description || `Generated from ${metadata.name || metadata.id}`
  );

  const files = {};

  put(files, `${projectName}/settings.gradle`, `
rootProject.name = '${projectName}'
`);

  put(files, `${projectName}/build.gradle`, `
plugins {
    id 'java'
}

group = '${PACKAGE_NAME}'
version = '1.0.0'

repositories {
    mavenCentral()

    maven {
        url = 'https://repo.papermc.io/repository/maven-public/'
    }
}

dependencies {
    compileOnly "io.papermc.paper:paper-api:${target.paperApi}"
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(${javaVersion})
    }
}

tasks.withType(JavaCompile).configureEach {
    options.encoding = 'UTF-8'
}
`);

  const commandDeclaration = broadcastEnabled
    ? `
commands:
  broadcast:
    description: Broadcast a message to all players.
    usage: /broadcast <broadcast>
`
    : "";

  put(files, `${projectName}/src/main/resources/plugin.yml`, `
name: ${projectName}
version: 1.0.0
main: ${PACKAGE_NAME}.ConvertedPlugin
api-version: '${target.apiVersion}'
description: '${description}'
${commandDeclaration}
`);

  put(
    files,
    `${projectName}/src/main/java/dev/fabric2spigot/generated/ConvertedPlugin.java`,
    generatePluginClass({
      broadcastEnabled,
      originalName: metadata.name || metadata.id
    })
  );

  const supported = normalized.filter(
    item => item.status === "supported"
  );

  const experimental = normalized.filter(
    item => item.status === "experimental"
  );

  const manual = normalized.filter(
    item => item.status === "manual"
  );

  const unsupported = normalized.filter(
    item => item.status === "unsupported"
  );

  const report = {
    originalMod: {
      id: metadata.id,
      name: metadata.name,
      version: metadata.version
    },
    target,
    architecture: "paper-only",
    summary: {
      detectedFeatures: features.length,
      supported: supported.length,
      experimental: experimental.length,
      manual: manual.length,
      unsupported: unsupported.length
    },
    automaticallyConverted: broadcastEnabled
      ? ["simple_broadcast_v1"]
      : [],
    detectedFeatures: features,
    translations: normalized,
    behaviorAutomaticallyPorted: broadcastEnabled
  };

  put(
    files,
    `${projectName}/conversion-report.json`,
    JSON.stringify(report, null, 2)
  );

  const diagnostics = [
    "# Fabric2Spigot conversion diagnostics",
    "",
    `- Original mod: ${metadata.name || metadata.id}`,
    `- Mod ID: ${metadata.id}`,
    `- Mod version: ${metadata.version || "unknown"}`,
    `- Minecraft: ${target.minecraft}`,
    `- Paper API: ${target.paperApi}`,
    `- Java: ${javaVersion}`,
    "- Architecture: Paper-only",
    `- Detected features: ${features.length}`,
    `- Supported entries: ${supported.length}`,
    `- Experimental entries: ${experimental.length}`,
    `- Manual entries: ${manual.length}`,
    `- Unsupported entries: ${unsupported.length}`,
    "",
    "## Automatically converted behavior",
    broadcastEnabled
      ? "- `/broadcast <broadcast>`: single-word broadcast command."
      : "- No behavior was automatically converted.",
    "",
    "## Detected features",
    ...features.map(item =>
      `- ${item.category}: ${item.marker} (${item.source})`
    ),
    "",
    "## Translation assessment",
    ...normalized.map(item =>
      `- [${String(item.status).toUpperCase()}] ${item.category}: ${item.explanation}`
    ),
    "",
    "## Limitations",
    "- Only explicitly recognized conversion patterns are generated.",
    "- Unsupported Fabric functionality is not included.",
    "- Experimental features are not implemented.",
    "- The generated project must be compiled and tested on a compatible Paper server."
  ].join("\n");

  put(files, `${projectName}/diagnostics.md`, diagnostics);

  const readme = `
# ${projectName}

Paper plugin project generated by Fabric2Spigot.

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

The compiled plugin will be located in:

\`build/libs/\`

## Converted functionality

${broadcastEnabled
    ? "- `/broadcast <broadcast>` broadcasts one word to all online players.\n- The prefix is gold and the message is green."
    : "- No automatic behavior conversion was performed."}

## Installation

1. Build the project.
2. Copy the generated JAR from \`build/libs/\` into the Paper server's \`plugins/\` folder.
3. Restart the server.
4. Check the server console for plugin startup messages.

## Important

Review \`diagnostics.md\` before using the plugin.
Only the functionality listed as automatically converted has been implemented.
`;

  put(files, `${projectName}/README.md`, readme);

  put(files, `${projectName}/.gitignore`, `
.gradle/
build/
.idea/
.vscode/
*.iml
`);

  try {
    return zipSync(files, { level: 6 });
  } catch (error) {
    console.error("Fabric2Spigot ZIP generation error:", error);
    throw new Error("Could not package the generated Paper project.");
  }
}
