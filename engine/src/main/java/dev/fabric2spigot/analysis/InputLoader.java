package dev.fabric2spigot.analysis;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class InputLoader {

    private static final long MAX_ARCHIVE_SIZE = 100L * 1024 * 1024;
    private static final long MAX_EXPANDED_SIZE = 250L * 1024 * 1024;
    private static final int MAX_ENTRIES = 10000;

    public record LoadedInput(Map<String, byte[]> files) {}

    public LoadedInput load(Path input) throws IOException {
        if (!Files.isRegularFile(input)) {
            throw new IOException("Input file does not exist.");
        }

        long size = Files.size(input);

        if (size <= 0 || size > MAX_ARCHIVE_SIZE) {
            throw new IOException("Input archive must be between 1 byte and 100 MB.");
        }

        String name = input.getFileName().toString().toLowerCase();

        if (!name.endsWith(".jar") && !name.endsWith(".zip")) {
            throw new IOException("Only .jar and .zip files are accepted.");
        }

        Map<String, byte[]> files = new LinkedHashMap<>();
        long expanded = 0;
        int entries = 0;

        try (ZipInputStream zip = new ZipInputStream(Files.newInputStream(input))) {
            ZipEntry entry;

            while ((entry = zip.getNextEntry()) != null) {
                if (++entries > MAX_ENTRIES) {
                    throw new IOException("Archive contains too many entries.");
                }

                if (entry.isDirectory()) {
                    continue;
                }

                String path = entry.getName().replace('\\', '/');

                if (path.startsWith("/") ||
                    path.contains("../") ||
                    path.equals("..") ||
                    path.contains("\0")) {
                    throw new IOException("Unsafe archive entry detected.");
                }

                byte[] content = zip.readNBytes(20 * 1024 * 1024 + 1);

                if (content.length > 20 * 1024 * 1024) {
                    throw new IOException("An archive entry exceeds 20 MB.");
                }

                expanded += content.length;

                if (expanded > MAX_EXPANDED_SIZE) {
                    throw new IOException("Expanded archive exceeds 250 MB.");
                }

                files.put(path, content);
                zip.closeEntry();
            }
        }

        if (files.isEmpty()) {
            throw new IOException("The archive is empty.");
        }

        return new LoadedInput(files);
    }
}
