
const TRANSLATION_RULES = {
  commands: {
    status: "experimental",
    paperApi: "org.bukkit.command",
    explanation:
      "Command functionality may be recreated using Paper command registration."
  },

  player_events: {
    status: "experimental",
    paperApi: "org.bukkit.event.player",
    explanation:
      "Some player events have Bukkit equivalents. Individual event behavior must be mapped."
  },

  server_events: {
    status: "experimental",
    paperApi: "org.bukkit.event.server",
    explanation:
      "Some server lifecycle events can be recreated with Bukkit listeners."
  },

  items: {
    status: "experimental",
    paperApi: "org.bukkit.inventory",
    explanation:
      "Basic custom item behavior may be recreated with Bukkit item stacks and metadata."
  },

  blocks: {
    status: "experimental",
    paperApi: "org.bukkit.block",
    explanation:
      "Some block interactions can be recreated with Bukkit events."
  },

  entities: {
    status: "experimental",
    paperApi: "org.bukkit.entity",
    explanation:
      "Some entity interactions can be recreated with Bukkit APIs."
  },

  recipes: {
    status: "experimental",
    paperApi: "org.bukkit.inventory",
    explanation:
      "Supported recipes may be recreated using Bukkit recipe classes."
  },

  networking: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Fabric networking payloads require protocol-specific rewriting."
  },

  client_rendering: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Client rendering features cannot run as ordinary Paper server plugins."
  },

  client_entrypoint: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Client entrypoints do not have a direct Paper server equivalent."
  },

  mixins: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Mixin transformations require manual redesign for the Paper API."
  },

  access_wideners: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Access wideners modify Minecraft internals and cannot be directly transferred."
  },

  entrypoint: {
    status: "unsupported",
    paperApi: null,
    explanation:
      "Fabric entrypoints require manual mapping to a Paper plugin lifecycle."
  }
};

export function translateFeatures(features, target) {
  if (!Array.isArray(features)) {
    throw new Error("Feature analysis is invalid.");
  }

  return features.map((feature) => {
    const rule = TRANSLATION_RULES[feature.category];

    if (!rule) {
      return {
        category: feature.category,
        source: feature.source,
        marker: feature.marker,
        status: "unsupported",
        paperApi: null,
        explanation: "No translation rule exists for this feature.",
        targetJava: target.java
      };
    }

    return {
      category: feature.category,
      source: feature.source,
      marker: feature.marker,
      status: rule.status,
      paperApi: rule.paperApi,
      explanation: rule.explanation,
      targetJava: target.java
    };
  });
}
