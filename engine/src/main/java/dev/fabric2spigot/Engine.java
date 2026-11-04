package dev.fabric2spigot;

import dev.fabric2spigot.analysis.InputLoader;
import dev.fabric2spigot.analysis.MetadataReader;
import dev.fabric2spigot.analysis.FeatureDetector;
import dev.fabric2spigot.translation.TranslationRegistry;
import dev.fabric2spigot.generation.ProjectGenerator;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

public final class Engine {

    public record Result(
        Path outputDirectory,
        int featureCount,
        int translationCount,
        int warningCount
    ) {}

    public Result convert(Path input, Path output) throws Exception {
        InputLoader loader = new InputLoader();
        MetadataReader metadataReader = new MetadataReader();
        FeatureDetector detector = new FeatureDetector();
        TranslationRegistry translator = new TranslationRegistry();
        ProjectGenerator generator = new ProjectGenerator();

        InputLoader.LoadedInput loaded = loader.load(input);

        Map<String, Object> metadata =
            metadataReader.read(loaded.files());

        List<FeatureDetector.Feature> features =
            detector.detect(loaded.files(), metadata);

        List<TranslationRegistry.Translation> translations =
            translator.translate(features);

        generator.generate(
            output,
            metadata,
            features,
            translations
        );

        int warnings = (int) translations.stream()
            .filter(item -> item.status().equals("unsupported")
                || item.status().equals("experimental"))
            .count();

        return new Result(
            output,
            features.size(),
            translations.size(),
            warnings
        );
    }
}
