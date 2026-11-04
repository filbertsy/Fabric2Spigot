package dev.fabric2spigot.translation;

import dev.fabric2spigot.analysis.FeatureDetector.Feature;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public final class TranslationRegistry {

    public record Translation(
        String category,
        String source,
        String status,
        String target,
        String message
    ) {}

    private static final Map<String, String> TARGETS = Map.ofEntries(
        Map.entry("commands", "org.bukkit.command"),
        Map.entry("player_events", "org.bukkit.event.player"),
        Map.entry("server_events", "org.bukkit.event.server"),
        Map.entry("items", "org.bukkit.inventory"),
        Map.entry("blocks", "org.bukkit.block"),
        Map.entry("entities", "org.bukkit.entity"),
        Map.entry("recipes", "org.bukkit.inventory"),
        Map.entry("registries", "org.bukkit.Registry")
    );

    public List<Translation> translate(List<Feature> features) {
        List<Translation> result = new ArrayList<>();

        for (Feature feature : features) {
            String category = feature.category();

            if (TARGETS.containsKey(category)) {
                result.add(new Translation(
                    category,
                    feature.source(),
                    "experimental",
                    TARGETS.get(category),
                    "Potential Paper/Bukkit equivalent detected. " +
                    "Behavioral translation still requires implementation."
                ));
            } else if (category.equals("mixins") ||
                       category.equals("access_widener")) {
                result.add(new Translation(
                    category,
                    feature.source(),
                    "unsupported",
                    "",
                    "Requires Minecraft internals or bytecode-level changes."
                ));
            } else if (category.equals("client_rendering") ||
                       category.equals("client_networking") ||
                       category.equals("client_entrypoint")) {
                result.add(new Translation(
                    category,
                    feature.source(),
                    "unsupported",
                    "",
                    "Client-side functionality cannot run as a normal server plugin."
                ));
            } else if (category.equals("networking")) {
                result.add(new Translation(
                    category,
                    feature.source(),
                    "experimental",
                    "org.bukkit.plugin.messaging",
                    "Server plugin messaging may be an alternative. " +
                    "Protocol compatibility is not guaranteed."
                ));
            } else {
                result.add(new Translation(
                    category,
                    feature.source(),
                    "unsupported",
                    "",
                    "No translation rule is currently registered."
                ));
            }
        }

        return result;
    }
}
