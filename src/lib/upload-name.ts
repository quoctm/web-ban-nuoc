const uploadTypes = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export function uploadContentType(name: string) {
  const match = /^[a-f0-9-]+\.(jpg|png|webp)$/.exec(name);
  return match ? uploadTypes[match[1] as keyof typeof uploadTypes] : null;
}
