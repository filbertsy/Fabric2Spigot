
import { unzipSync } from "fflate";

const MAX_ENTRIES = 5000;
const MAX_EXPANDED_SIZE = 100 * 1024 * 1024;

const RULES = [
  {
    category: "commands",
    markers: ["CommandRegistrationCallback", "CommandManager"]
  },
  {
    category: "player_events",
    markers: [
      "UseItemCallback",
      "PlayerBlockBreakEvents",
      "AttackEntityCallback",
      "UseBlockCallback"
    ]
  },
  {
    category: "server_events",
    markers: [
      "ServerTickEvents",
      "ServerLifecycleEvents",
      "ServerPlayConnectionEvents"
    ]
  },
  {
    category: "items",
    markers: ["Registries.ITEM", "Registry.register", "Item.Settings"]
  },
  {
    category: "blocks",
    markers: ["Registries.BLOCK", "Block.Settings"]
  },
  {
    category: "entities",
    markers: ["EntityType.Builder", "Registries.ENTITY_TYPE"]
  },
  {
    category: "recipes",
    markers: ["RecipeSerializer", "RecipeType"]
  },
  {
    category: "networking",
    markers: ["ServerPlayNetworking", "PayloadTypeRegistry"]
  }
];

function decodeText(bytes) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function findMetadata(files) {
  const candidates = Object.keys(files).filter((path) =>
    path === "fabric.mod.json" ||
    path.endsWith("/fabric.mod.json")
  );

  if (candidates.length === 0) {
    throw new Error(
      "fabric.mod.json was not found. Upload a Fabric mod JAR or a source ZIP containing its metadata."
    );
  }

  candidates.sort((a, b) => a.length - b.length);
  return candidates[0];
}

function parseMetadata(bytes) {
  let metadata;

  try {
    metadata = JSON.parse(decodeText(bytes));
  } catch {
    throw new Error("fabric.mod.json contains invalid JSON.");
  }

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Fabric metadata must be a JSON object.");
  }

  if (
    typeof metadata.id !== "string" ||
    !/^[a-z0-9_.-]+$/.test(metadata.id)
  ) {
    throw new Error("Fabric metadata contains an invalid mod ID.");
  }

  return {
    id: metadata.id,
    name: typeof metadata.name === "string"
      ? metadata.name
      : metadata.id,
    version: String(metadata.version ?? "unknown"),
    description: String(metadata.description ?? ""),
    environment: String(metadata.environment ?? "*"),
    entrypoints: metadata.entrypoints ?? {},
    depends: metadata.depends ?? {},
    mixins: metadata.mixins ?? [],
    accessWidener: metadata.accessWidener ?? null,
    metadataPath: null
  };
}

export async function analyzeFabricMod(bytes, filename) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error("Invalid upload data.");
  }

  let files;

  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("The uploaded file is not a valid ZIP/JAR archive.");
  }

  const paths = Object.keys(files);

  if (paths.length === 0) {
    throw new Error("The uploaded archive is empty.");
  }

  if (paths.length > MAX_ENTRIES) {
    throw new Error("The archive contains too many files.");
  }

  let expandedSize = 0;

  for (const content of Object.values(files)) {
    expandedSize += content.length;

    if (expandedSize > MAX_EXPANDED_SIZE) {
      throw new Error("Expanded archive exceeds the 100 MB limit.");
    }
  }

  const metadataPath = findMetadata(files);
  const metadata = parseMetadata(files[metadataPath]);
  metadata.metadataPath = metadataPath;

  const evidence = [];

  for (const path of paths) {
    if (
      !path.endsWith(".class") &&
      !path.endsWith(".java")
    ) {
      continue;
    }

    const content = decodeText(files[path]);

    for (const rule of RULES) {
      for (const marker of rule.markers) {
        if (content.includes(marker)) {
          evidence.push({
            category: rule.category,
            source: path,
            marker
          });
        }
      }
    }

    if (content.includes("net/minecraft/client") ||
        content.includes("net.minecraft.client")) {
      evidence.push({
        category: "client_rendering",
        source: path,
        marker: "Minecraft client reference"
      });
    }

    if (content.includes("org.spongepowered.asm.mixin") ||
        content.includes("@Mixin")) {
      evidence.push({
        category: "mixins",
        source: path,
        marker: "Mixin reference"
      });
    }

    if (content.includes("accessWidener")) {
      evidence.push({
        category: "access_wideners",
        source: path,
        marker: "Access widener reference"
      });
    }
  }

  for (const [entrypoint, value] of Object.entries(metadata.entrypoints)) {
    evidence.push({
      category: entrypoint === "client"
        ? "client_entrypoint"
        : "entrypoint",
      source: metadataPath,
      marker: `Entrypoint: ${entrypoint}`,
      value
    });
  }

  if (metadata.mixins.length > 0) {
    evidence.push({
      category: "mixins",
      source: metadataPath,
      marker: "Mixin configuration declared"
    });
  }

  const unique = new Map();

  for (const item of evidence) {
    const key = `${item.category}:${item.source}:${item.marker}`;
    unique.set(key, item);
  }

  return {
    filename,
    metadata,
    features: [...unique.values()],
    fileCount: paths.length,
    expandedSize
  };
}
