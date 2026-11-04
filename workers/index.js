
import { analyzeFabricMod } from "./analyzer.js";
import { translateFeatures } from "./translator.js";
import { generatePluginZip } from "./generator.js";

const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;

const VERSIONS = {
    "1.21.8": {
        minecraft: "1.21.8",
        paper: "1.21.8-R0.1-SNAPSHOT",
        java: 21,
        apiVersion: "1.21"
    }
};

const ALLOWED_ORIGIN = "https://fabric2spigot.pages.dev";

function corsHeaders(origin) {
    return {
        "Access-Control-Allow-Origin":
            origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
    };
}

function json(data, status = 200, origin = "") {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            ...corsHeaders(origin),
            "Content-Type": "application/json"
        }
    });
}

export default {
    async fetch(request) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin") || "";

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(origin)
            });
        }

        if (url.pathname === "/api/health" && request.method === "GET") {
            return json({
                ok: true,
                name: "Fabric2Spigot API",
                status: "running"
            }, 200, origin);
        }

        if (url.pathname === "/api/versions" && request.method === "GET") {
            return json({
                ok: true,
                versions: Object.keys(VERSIONS)
            }, 200, origin);
        }

        if (url.pathname === "/api/convert" && request.method === "POST") {
            try {
                const form = await request.formData();
                const file = form.get("file");
                const version = form.get("version");

                if (!file || typeof file.arrayBuffer !== "function") {
                    return json({
                        ok: false,
                        error: "A Fabric JAR or ZIP file is required."
                    }, 400, origin);
                }

                if (![".jar", ".zip"].some(ext =>
                    file.name.toLowerCase().endsWith(ext)
                )) {
                    return json({
                        ok: false,
                        error: "Only .jar and .zip files are supported."
                    }, 400, origin);
                }

                if (file.size > MAX_UPLOAD_SIZE) {
                    return json({
                        ok: false,
                        error: "File exceeds the 25 MB upload limit."
                    }, 413, origin);
                }

                const target = VERSIONS[version];

                if (!target) {
                    return json({
                        ok: false,
                        error: "Unsupported Minecraft target version."
                    }, 400, origin);
                }

                const bytes = new Uint8Array(await file.arrayBuffer());

                const analysis = await analyzeFabricMod(
                    bytes,
                    file.name
                );

                const translation = await translateFeatures(
                    analysis,
                    target
                );

                const zip = await generatePluginZip(
                    analysis,
                    translation,
                    target
                );

                if (!zip) {
                    throw new Error("The generator returned no ZIP data.");
                }

                const zipBytes = zip instanceof Uint8Array
                    ? zip
                    : new Uint8Array(zip);

                return new Response(zipBytes, {
                    status: 200,
                    headers: {
                        ...corsHeaders(origin),
                        "Content-Type": "application/zip",
                        "Content-Disposition":
                            'attachment; filename="fabric2spigot-project.zip"',
                        "Content-Length": String(zipBytes.byteLength)
                    }
                });

            } catch (error) {
                return json({
                    ok: false,
                    error: error.message || "Conversion failed."
                }, 500, origin);
            }
        }

        return json({
            ok: false,
            error: "Endpoint not found."
        }, 404, origin);
    }
};
