
package dev.fabric2spigot;

import java.nio.file.Path;

public final class Main {

    private Main() {}

    public static void main(String[] args) {
        if (args.length < 2) {
            System.err.println(
                "Usage: java -jar fabric2spigot-engine.jar <input.jar|input.zip> <output-directory>"
            );
            System.exit(2);
        }

        Path input = Path.of(args[0]).toAbsolutePath().normalize();
        Path output = Path.of(args[1]).toAbsolutePath().normalize();

        try {
            Engine engine = new Engine();
            Engine.Result result = engine.convert(input, output);

            System.out.println("Fabric2Spigot engine finished.");
            System.out.println("Input: " + input);
            System.out.println("Output: " + result.outputDirectory());
            System.out.println("Features detected: " + result.featureCount());
            System.out.println("Experimental translations: " + result.translationCount());
            System.out.println("Warnings: " + result.warningCount());
        } catch (Exception exception) {
            System.err.println("Conversion failed: " + exception.getMessage());
            exception.printStackTrace(System.err);
            System.exit(1);
        }
    }
}
