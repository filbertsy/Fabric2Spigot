
const TRANSLATION_RULES = {
  commands: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.command",
    explanation:
      "Command functionality may be recreated using Paper command registration."
  },

  player_events: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.event.player",
    explanation:
      "Some player events have Bukkit equivalents. Individual event behavior must be mapped."
  },

  server_events: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.event.server",
    explanation:
      "Some server lifecycle events can be recreated with Bukkit listeners."
  },

  items: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.inventory",
    explanation:
      "Basic custom item behavior may be recreated using Bukkit item stacks and metadata."
  },

  blocks: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.block",
    explanation:
      "Some block interactions can be recreated using Bukkit events."
  },

  entities: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.entity",
    explanation:
      "Some entity interactions can be recreated using Bukkit entity APIs."
  },

  recipes: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.inventory",
    explanation:
      "Supported recipes may be recreated using Bukkit recipe classes."
  },

  networking: {
    status: "unsupported",
    side: "hybrid",
    paperApi: null,
    explanation:
      "Fabric networking requires protocol-specific rewriting."
  },

  dynamic_lighting: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation:
      "Dynamic lighting is a client-side rendering feature and cannot directly run as a Paper plugin."
  },

  client_rendering: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation:
      "Client rendering features cannot run as ordinary Paper server plugins."
  },

  client_entrypoint: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation:
      "Client entrypoints do not have a direct Paper server equivalent."
  },

  mixins: {
    status: "unsupported",
    side: "unknown",
    paperApi: null,
    explanation:
      "Mixin transformations require manual redesign."
  },

  access_wideners: {
    status: "unsupported",
    side: "unknown",
    paperApi: null,
    explanation:
      "Access wideners modify Minecraft internals and cannot be directly transferred."
  },

  entrypoint: {
    status: "manual",
    side: "unknown",
    paperApi: null,
    explanation:
      "The entrypoint class must be inspected to identify its initialization behavior before conversion."
  }
};

export function translateFeatures(features, target) {
  if (!Array.isArray(features)) {
    throw new Error("Feature analysis is invalid.");
  }

  return features.map(feature => {
    const rule = TRANSLATION_RULES[feature.category];

    if (!rule) {
      return {
        category: feature.category,
        source: feature.source,
        marker: feature.marker,
        status: "unsupported",
        side: "unknown",
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
      side: rule.side,
      paperApi: rule.paperApi,
      explanation: rule.explanation,
      targetJava: target.java
    };
  });
}
