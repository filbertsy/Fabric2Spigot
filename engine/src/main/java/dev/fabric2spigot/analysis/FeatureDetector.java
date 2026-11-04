package dev.fabric2spigot.analysis;

import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FeatureDetector {

    public record Feature(
        String category,
        String source,
        String evidence,
        String confidence
    ) {}

    private static final Map<String, String> RULES = new LinkedHashMap<>();

    static {
        RULES.put("CommandRegistrationCallback", "commands");
        RULES.put("CommandManager", "commands");
        RULES.put("UseItemCallback", "player_events");
        RULES.put("AttackBlockCallback", "player_events");
        RULES.put("PlayerBlockBreakEvents", "player_events");
        RULES.put("ServerTickEvents", "server_events");
        RULES.put("ServerLifecycleEvents", "server_events");
        RULES.put("Registry.register", "registries");
        RULES.put("FabricItemSettings", "items");
        RULES.put("BlockItem", "items");
        RULES.put("Block", "blocks");
        RULES.put("EntityType", "entities");
        RULES.put("RecipeSerializer", "recipes");
        RULES.put("ServerPlayNetworking", "networking");
        RULES.put("ClientPlayNetworking", "client_networking");
        RULES.put("Screen", "client_rendering");
        RULES.put("Renderer", "client_rendering");
        RULES.put("RenderLayer", "client_rendering");
        RULES.put("@Mixin", "mixins");
        RULES.put("Mixin", "mixins");
        RULES.put("AccessWidener", "access_widener");
    }

    public List<Feature> detect(
        Map<String, byte[]> files,
        Map<String, Object> metadata
    ) {
        List<Feature> result = new ArrayList<>();

        for (Map.Entry<String, byte[]> entry : files.entrySet()) {
            String path = entry.getKey();

            if (path.endsWith(".java")) {
                inspectText(path, new String(
                    entry.getValue(), StandardCharsets.UTF_8
                ), result);
            } else if (path.endsWith(".class")) {
                inspectClass(path, entry.getValue(), result);
            } else if (path.endsWith(".accesswidener")) {
                result.add(new Feature(
                    "access_widener",
                    path,
                    "Access widener resource",
                    "high"
                ));
            }
        }

        inspectMetadata(metadata, result);

        return deduplicate(result);
    }

    private void inspectText(
        String path,
        String source,
        List<Feature> output
    ) {
        for (Map.Entry<String, String> rule : RULES.entrySet()) {
            if (source.contains(rule.getKey())) {
                output.add(new Feature(
                    rule.getValue(),
                    path,
                    rule.getKey(),
                    "medium"
                ));
            }
        }
    }

    private void inspectClass(
        String path,
        byte[] bytes,
        List<Feature> output
    ) {
        try {
            ClassReader reader = new ClassReader(bytes);

            reader.accept(new ClassVisitor(Opcodes.ASM9) {
                @Override
                public MethodVisitor visitMethod(
                    int access,
                    String name,
                    String descriptor,
                    String signature,
                    String[] exceptions
                ) {
                    return new MethodVisitor(Opcodes.ASM9) {
                        @Override
                        public void visitMethodInsn(
                            int opcode,
                            String owner,
                            String methodName,
                            String methodDescriptor,
                            boolean isInterface
                        ) {
                            inspectReference(
                                path,
                                owner + "." + methodName,
                                output
                            );
                        }

                        @Override
                        public void visitTypeInsn(int opcode, String type) {
                            inspectReference(path, type, output);
                        }

                        @Override
                        public void visitFieldInsn(
                            int opcode,
                            String owner,
                            String fieldName,
                            String fieldDescriptor
                        ) {
                            inspectReference(path, owner, output);
                        }

                        @Override
                        public void visitLdcInsn(Object value) {
                            if (value instanceof String text) {
                                inspectReference(path, text, output);
                            }
                        }
                    };
                }
            }, ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);

        } catch (Exception ignored) {
            output.add(new Feature(
                "unreadable_bytecode",
                path,
                "Class could not be inspected",
                "low"
            ));
        }
    }

    private void inspectReference(
        String path,
        String reference,
        List<Feature> output
    ) {
        for (Map.Entry<String, String> rule : RULES.entrySet()) {
            if (reference.contains(rule.getKey())) {
                output.add(new Feature(
                    rule.getValue(),
                    path,
                    reference,
                    "high"
                ));
            }
        }

        if (reference.contains("net/minecraft/client")) {
            output.add(new Feature(
                "client_rendering",
                path,
                "Minecraft client API reference",
                "high"
            ));
        }
    }

    private void inspectMetadata(
        Map<String, Object> metadata,
        List<Feature> output
    ) {
        String entrypoints = String.valueOf(metadata.get("entrypoints"));

        if (entrypoints.contains("client")) {
            output.add(new Feature(
                "client_entrypoint",
                "fabric.mod.json",
                "Client entrypoint declared",
                "high"
            ));
        }

        String mixins = String.valueOf(metadata.get("mixins"));

        if (!mixins.equals("[]")) {
            output.add(new Feature(
                "mixins",
                "fabric.mod.json",
                "Mixin configuration declared",
                "high"
            ));
        }
    }

    private List<Feature> deduplicate(List<Feature> features) {
        Map<String, Feature> unique = new LinkedHashMap<>();

        for (Feature feature : features) {
            String key = feature.category() + "|" +
                feature.source() + "|" + feature.evidence();

            unique.putIfAbsent(key, feature);
        }

        return new ArrayList<>(unique.values());
    }
}
