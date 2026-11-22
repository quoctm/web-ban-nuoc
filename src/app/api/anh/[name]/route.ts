import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { dataDirectory } from "@/lib/json-store";
import { uploadContentType } from "@/lib/upload-name";

export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const contentType = uploadContentType(name);
  if (!contentType) return new Response(null, { status: 404 });
  try {
    const data = await readFile(join(dataDirectory(), "uploads", name));
    return new Response(new Uint8Array(data), { headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, immutable",
    } });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Response(null, { status: 404 });
    return new Response("Không đọc được ảnh sản phẩm.", { status: 500 });
  }
}
