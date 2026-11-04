package dev.fabric2spigot.analysis;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

public final class MetadataReader {

    private final Gson gson = new Gson();

    public Map<String, Object> read(Map<String, byte[]> files) {
        byte[] metadata = files.get("fabric.mod.json");

        if (metadata == null) {
            throw new IllegalArgumentException(
                "fabric.mod.json was not found. This may not be a Fabric mod."
            );
        }

        JsonObject json = JsonParser.parseString(
            new String(metadata, StandardCharsets.UTF_8)
        ).getAsJsonObject();

        Map<String, Object> result = new LinkedHashMap<>();

        result.put("id", getString(json, "id", "unknown"));
        result.put("name", getString(json, "name", "Unknown mod"));
        result.put("version", getString(json, "version", "unknown"));
        result.put("description", getString(json, "description", ""));
        result.put("environment", getString(json, "environment", "*"));

        result.put("authors", json.has("authors")
            ? gson.toJson(json.get("authors"))
            : "[]");

        result.put("depends", json.has("depends")
            ? gson.toJson(json.get("depends"))
            : "{}");

        result.put("entrypoints", json.has("entrypoints")
            ? gson.toJson(json.get("entrypoints"))
            : "{}");

        result.put("mixins", json.has("mixins")
            ? gson.toJson(json.get("mixins"))
            : "[]");

        result.put("schemaVersion",
            json.has("schemaVersion")
                ? json.get("schemaVersion").getAsInt()
                : 0
        );

        return result;
    }

    private String getString(
        JsonObject json,
        String key,
        String fallback
    ) {
        return json.has(key) && !json.get(key).isJsonNull()
            ? json.get(key).getAsString()
            : fallback;
    }
}
