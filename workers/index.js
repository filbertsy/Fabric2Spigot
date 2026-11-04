
import { analyzeFabricMod } from "./analyzer.js";
import { translateFeatures } from "./translator.js";
import { generatePluginZip } from "./generator.js";

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

const SUPPORTED_VERSIONS = {
  "1.21.8": {
    paperApi: "1.21.8-R0.1-SNAPSHOT",
    java: 21,
    apiVersion: "1.21"
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        name: "Fabric2Spigot API",
        status: "running"
      });
    }

    if (url.pathname === "/api/versions" && request.method === "GET") {
      return json({
        versions: Object.keys(SUPPORTED_VERSIONS)
      });
    }

    if (url.pathname === "/api/convert" && request.method === "POST") {
      try {
        const form = await request.formData();
        const file = form.get("file");
        const version = String(form.get("version") || "");

        if (!file || typeof file.arrayBuffer !== "function") {
          return json({ error: "Upload a JAR or ZIP file." }, 400);
        }

        if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
          return json({
            error: "File must be between 1 byte and 25 MB."
          }, 413);
        }

        if (!/\.(jar|zip)$/i.test(file.name || "")) {
          return json({
            error: "Only .jar and .zip files are supported."
          }, 400);
        }

        const target = SUPPORTED_VERSIONS[version];

        if (!target) {
          return json({
            error: "Unsupported Minecraft version.",
            supportedVersions: Object.keys(SUPPORTED_VERSIONS)
          }, 400);
        }

        const bytes = new Uint8Array(await file.arrayBuffer());

        const analysis = await analyzeFabricMod(bytes, file.name);
        const translations = translateFeatures(analysis.features, target);

        const zip = await generatePluginZip({
          metadata: analysis.metadata,
          features: analysis.features,
          translations,
          target
        });

        return new Response(zip, {
          status: 200,
          headers: {
            ...corsHeaders(),
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="fabric2spigot-project.zip"',
            "Cache-Control": "no-store"
          }
        });
      } catch (error) {
        return json({
          error: error instanceof Error
            ? error.message
            : "Conversion failed."
        }, 422);
      }
    }

    return json({ error: "Endpoint not found." }, 404);
  }
};
