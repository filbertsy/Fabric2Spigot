const TRANSLATION_RULES = {
  commands: {
    status: "manual",
    side: "server",
    paperApi: "org.bukkit.command",
    explanation:
      "Only explicitly recognized command implementations can be automatically converted."
  },

  player_events: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.event.player",
    explanation: "Individual player events require behavior-specific mapping."
  },

  server_events: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.event.server",
    explanation: "Individual server events require behavior-specific mapping."
  },

  items: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.inventory",
    explanation: "Custom item behavior requires individual mapping."
  },

  blocks: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.block",
    explanation: "Custom block behavior requires individual mapping."
  },

  entities: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.entity",
    explanation: "Entity behavior requires individual mapping."
  },

  recipes: {
    status: "experimental",
    side: "server",
    paperApi: "org.bukkit.inventory",
    explanation: "Recipe behavior requires individual mapping."
  },

  networking: {
    status: "unsupported",
    side: "hybrid",
    paperApi: null,
    explanation: "Fabric networking requires protocol-specific rewriting."
  },

  dynamic_lighting: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation: "Dynamic lighting is a client-side rendering feature."
  },

  client_rendering: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation: "Client rendering cannot run as an ordinary Paper plugin."
  },

  client_entrypoint: {
    status: "unsupported",
    side: "client",
    paperApi: null,
    explanation: "Client entrypoints have no direct Paper equivalent."
  },

  mixins: {
    status: "unsupported",
    side: "unknown",
    paperApi: null,
    explanation: "Mixin transformations require manual redesign."
  },

  access_wideners: {
    status: "unsupported",
    side: "unknown",
    paperApi: null,
    explanation: "Access wideners modify Minecraft internals."
  },

  entrypoint: {
    status: "manual",
    side: "unknown",
    paperApi: null,
    explanation: "Entrypoint initialization must be inspected individually."
  }
};

const BROADCAST_SOURCE =
  "net/mcreator/simplebroadcast/init/SimpleBroadcastModCommands.class";

function identifyCommandConversion(feature) {
  const source = String(feature.source || "").replace(/\\/g, "/");

  if (
    source.endsWith(BROADCAST_SOURCE) &&
    feature.marker === "CommandRegistrationCallback"
  ) {
    return {
      id: "simple_broadcast_v1",
      description: "Simple Broadcast command conversion"
    };
  }

  return null;
}

export function translateFeatures(features, target) {
  if (!Array.isArray(features)) {
    throw new Error("Feature analysis is invalid.");
  }

  if (!target || !Number.isInteger(Number(target.java))) {
    throw new Error("Target Java configuration is invalid.");
  }

  return features.map(feature => {
    if (!feature || typeof feature.category !== "string") {
      throw new Error("Invalid feature entry.");
    }

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

    const result = {
      category: feature.category,
      source: feature.source,
      marker: feature.marker,
      status: rule.status,
      side: rule.side,
      paperApi: rule.paperApi,
      explanation: rule.explanation,
      targetJava: target.java
    };

    if (feature.category === "commands") {
      const conversion = identifyCommandConversion(feature);

      if (conversion) {
        result.status = "supported";
        result.conversion = conversion.id;
        result.explanation =
          "Recognized Simple Broadcast command. Generates /broadcast with its original single-word argument behavior.";
      }
    }

    return result;
  });
}
